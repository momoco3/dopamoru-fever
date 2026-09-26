// 開発用: 録画した画面（JPEG の連番）と、鳴った音の記録から、音つき MP4 を作ります。
// record.html から呼ばれるだけで、公開されるアプリには含まれません。
// 映像は WebCodecs（H.264）、音はゲームと同じ合成処理をオフラインで鳴らして AAC にし、mp4-muxer でまとめます。
import { ArrayBufferTarget, Muxer } from 'mp4-muxer';
import { createMaster, renderBgm, renderSound, type BgmPattern, type SoundName, type SoundOptions } from '../lib/sound';

type SoundLogEntry =
  | { kind: 'sfx'; time: number; name: SoundName; options: SoundOptions }
  | { kind: 'bgm'; time: number; pattern: BgmPattern | null };

type EncodeInput = {
  /** フレーム画像の URL と、撮影された時刻（ミリ秒・エポック） */
  frames: { url: string; time: number }[];
  sounds: SoundLogEntry[];
  fps: number;
  /** 最後に何秒余韻を残すか */
  tailSeconds?: number;
};

const SAMPLE_RATE = 48000;

export async function encodeDemo({ frames, sounds, fps, tailSeconds = 0.5 }: EncodeInput): Promise<string> {
  const t0 = frames[0].time;
  const duration = (frames[frames.length - 1].time - t0) / 1000 + tailSeconds;
  const first = await createImageBitmap(await (await fetch(frames[0].url)).blob());
  const width = first.width - (first.width % 2);
  const height = first.height - (first.height % 2);

  // ---- 音をオフラインで合成 ----
  const offline = new OfflineAudioContext(2, Math.ceil(SAMPLE_RATE * duration), SAMPLE_RATE);
  const master = createMaster(offline, offline.destination);
  let bgm: { pattern: BgmPattern; start: number } | null = null;
  const closeBgm = (end: number) => {
    if (bgm) renderBgm(offline, master, bgm.pattern, bgm.start, bgm.start, Math.min(end, duration));
    bgm = null;
  };
  for (const entry of sounds) {
    const t = (entry.time - t0) / 1000;
    if (t < 0 || t > duration) continue;
    if (entry.kind === 'sfx') renderSound(offline, master, t, entry.name, entry.options);
    else {
      closeBgm(t);
      if (entry.pattern) bgm = { pattern: entry.pattern, start: t + 0.05 };
    }
  }
  closeBgm(duration);
  const audio = await offline.startRendering();

  // ---- MP4 の準備 ----
  const muxer = new Muxer({
    target: new ArrayBufferTarget(),
    video: { codec: 'avc', width, height, frameRate: fps },
    audio: { codec: 'aac', numberOfChannels: 2, sampleRate: SAMPLE_RATE },
    fastStart: 'in-memory',
    firstTimestampBehavior: 'offset',
  });

  let failure: Error | null = null;
  const videoEncoder = new VideoEncoder({
    output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
    error: (e) => (failure = e),
  });
  videoEncoder.configure({ codec: 'avc1.640033', width, height, bitrate: 3_500_000, framerate: fps });

  const audioEncoder = new AudioEncoder({
    output: (chunk, meta) => muxer.addAudioChunk(chunk, meta),
    error: (e) => (failure = e),
  });
  audioEncoder.configure({ codec: 'mp4a.40.2', sampleRate: SAMPLE_RATE, numberOfChannels: 2, bitrate: 160_000 });

  // ---- 映像: 30fps の各時刻に、その時点で最新の録画フレームを使う ----
  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext('2d')!;
  const totalFrames = Math.floor(duration * fps);
  let source = 0;
  let bitmap = first;
  let loadedIndex = 0;
  for (let i = 0; i < totalFrames; i++) {
    if (failure) throw failure;
    const time = t0 + (i / fps) * 1000;
    while (source + 1 < frames.length && frames[source + 1].time <= time) source++;
    if (source !== loadedIndex) {
      bitmap.close();
      bitmap = await createImageBitmap(await (await fetch(frames[source].url)).blob());
      loadedIndex = source;
    }
    ctx.drawImage(bitmap, 0, 0, width, height, 0, 0, width, height);
    const frame = new VideoFrame(canvas, { timestamp: Math.round((i / fps) * 1e6), duration: Math.round(1e6 / fps) });
    videoEncoder.encode(frame, { keyFrame: i % (fps * 2) === 0 });
    frame.close();
    while (videoEncoder.encodeQueueSize > 8) await new Promise((r) => setTimeout(r, 1));
  }

  // ---- 音: 1024 サンプルずつ AAC へ ----
  const channels = [audio.getChannelData(0), audio.getChannelData(1)];
  const block = 1024;
  for (let offset = 0; offset < audio.length; offset += block) {
    const frames = Math.min(block, audio.length - offset);
    const data = new Float32Array(frames * 2);
    data.set(channels[0].subarray(offset, offset + frames), 0);
    data.set(channels[1].subarray(offset, offset + frames), frames);
    const audioData = new AudioData({
      format: 'f32-planar',
      sampleRate: SAMPLE_RATE,
      numberOfFrames: frames,
      numberOfChannels: 2,
      timestamp: Math.round((offset / SAMPLE_RATE) * 1e6),
      data,
    });
    audioEncoder.encode(audioData);
    audioData.close();
  }

  await videoEncoder.flush();
  await audioEncoder.flush();
  if (failure) throw failure;
  muxer.finalize();

  // base64 にして返す（録画スクリプトがファイルに保存する）
  const bytes = new Uint8Array(muxer.target.buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}
