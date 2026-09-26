// 開発用: WAV などの音声を AAC（.m4a）に変換します。
// scripts/convert-bgm.mjs から record.html 経由で呼ばれます。公開されるアプリには含まれません。
import { ArrayBufferTarget, Muxer } from 'mp4-muxer';

export async function encodeAac(base64: string, bitrate = 128_000): Promise<{ m4a: string; seconds: number; sampleRate: number }> {
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  const context = new OfflineAudioContext(2, 1, 44100);
  const audio = await context.decodeAudioData(bytes.buffer);
  const { sampleRate } = audio;
  const channels = [audio.getChannelData(0), audio.getChannelData(audio.numberOfChannels > 1 ? 1 : 0)];

  const muxer = new Muxer({
    target: new ArrayBufferTarget(),
    audio: { codec: 'aac', numberOfChannels: 2, sampleRate },
    fastStart: 'in-memory',
  });
  let failure: Error | null = null;
  const encoder = new AudioEncoder({
    output: (chunk, meta) => muxer.addAudioChunk(chunk, meta),
    error: (e) => (failure = e),
  });
  encoder.configure({ codec: 'mp4a.40.2', sampleRate, numberOfChannels: 2, bitrate });

  const block = 1024;
  for (let offset = 0; offset < audio.length; offset += block) {
    const frames = Math.min(block, audio.length - offset);
    const data = new Float32Array(frames * 2);
    data.set(channels[0].subarray(offset, offset + frames), 0);
    data.set(channels[1].subarray(offset, offset + frames), frames);
    const audioData = new AudioData({
      format: 'f32-planar',
      sampleRate,
      numberOfFrames: frames,
      numberOfChannels: 2,
      timestamp: Math.round((offset / sampleRate) * 1e6),
      data,
    });
    encoder.encode(audioData);
    audioData.close();
  }
  await encoder.flush();
  if (failure) throw failure;
  muxer.finalize();

  const out = new Uint8Array(muxer.target.buffer);
  let binary = '';
  for (let i = 0; i < out.length; i += 0x8000) binary += String.fromCharCode(...out.subarray(i, i + 0x8000));
  return { m4a: btoa(binary), seconds: audio.length / sampleRate, sampleRate };
}
