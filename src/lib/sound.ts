// 効果音と BGM。音声ファイルは使わず、ブラウザの Web Audio でその場で合成しています。
// 同じ関数でオフライン合成もできるので、デモ動画にも同じ音を入れられます。

export type SoundName =
  | 'tap'
  | 'digit'
  | 'clear'
  | 'miss'
  | 'levelUp'
  | 'cutIn'
  | 'feverStart'
  | 'coin'
  | 'drumroll'
  | 'perfect'
  | 'result'
  | 'start'
  | 'tick'
  | 'sixSeven';

export type SoundOptions = { step?: number; level?: number };
export type BgmPattern = 'menu' | 'game' | 'hot' | 'fever';

/** デモ動画用: 鳴らした音の記録（window.__soundLog があるときだけ記録） */
type SoundLogEntry =
  | { kind: 'sfx'; time: number; name: SoundName; options: SoundOptions }
  | { kind: 'bgm'; time: number; pattern: BgmPattern | null };

declare global {
  interface Window {
    __soundLog?: SoundLogEntry[];
  }
}

let context: AudioContext | null = null;
let master: GainNode | null = null;
/** BGM だけの音量つまみ（67 の曲を流すあいだ、いつもの BGM を小さくする） */
let bgmBus: GainNode | null = null;
let muted = false;

/** 最初のタップのときに呼ぶ（ブラウザは操作前に音を鳴らせないため） */
export function unlockAudio() {
  if (!context) {
    const AudioContextClass = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    context = new AudioContextClass();
    master = createMaster(context, context.destination);
    bgmBus = context.createGain();
    bgmBus.connect(master);
  }
  if (context.state === 'suspended') void context.resume();
  ensureBgmLoaded();
  applyBgm();
}

export function setMuted(value: boolean) {
  muted = value;
  if (master && context) master.gain.setTargetAtTime(value ? 0 : 1, context.currentTime, 0.02);
}

export function play(name: SoundName, options: SoundOptions = {}) {
  window.__soundLog?.push({ kind: 'sfx', time: epochNow(), name, options });
  if (muted || !context || !master) return;
  renderSound(context, master, context.currentTime + 0.005, name, options);
}

/** 音量が大きくなりすぎないよう、全体にコンプレッサーをかける */
export function createMaster(ctx: BaseAudioContext, destination: AudioNode): GainNode {
  const compressor = ctx.createDynamicsCompressor();
  compressor.threshold.value = -14;
  compressor.ratio.value = 6;
  compressor.connect(destination);
  const gain = ctx.createGain();
  gain.gain.value = 0.9;
  gain.connect(compressor);
  return gain;
}

// ---------- 音づくりの部品 ----------

type ToneOptions = {
  freq: number;
  type?: OscillatorType;
  duration: number;
  gain?: number;
  slideTo?: number;
  attack?: number;
};

function tone(ctx: BaseAudioContext, dest: AudioNode, t: number, o: ToneOptions) {
  const osc = ctx.createOscillator();
  const env = ctx.createGain();
  osc.type = o.type ?? 'triangle';
  osc.frequency.setValueAtTime(o.freq, t);
  if (o.slideTo) osc.frequency.exponentialRampToValueAtTime(o.slideTo, t + o.duration);
  const peak = o.gain ?? 0.2;
  const attack = o.attack ?? 0.005;
  env.gain.setValueAtTime(0.0001, t);
  env.gain.exponentialRampToValueAtTime(peak, t + attack);
  env.gain.exponentialRampToValueAtTime(0.0001, t + o.duration);
  osc.connect(env).connect(dest);
  osc.start(t);
  osc.stop(t + o.duration + 0.02);
}

let noiseBuffer: { ctx: BaseAudioContext; buffer: AudioBuffer } | null = null;
function getNoise(ctx: BaseAudioContext) {
  if (noiseBuffer?.ctx === ctx) return noiseBuffer.buffer;
  const buffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  let seed = 12345;
  for (let i = 0; i < data.length; i++) {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    data[i] = (seed / 0x7fffffff) * 2 - 1;
  }
  noiseBuffer = { ctx, buffer };
  return buffer;
}

function noise(
  ctx: BaseAudioContext,
  dest: AudioNode,
  t: number,
  o: { duration: number; gain?: number; filter?: BiquadFilterType; freq?: number },
) {
  const src = ctx.createBufferSource();
  src.buffer = getNoise(ctx);
  const filter = ctx.createBiquadFilter();
  filter.type = o.filter ?? 'highpass';
  filter.frequency.value = o.freq ?? 5000;
  const env = ctx.createGain();
  env.gain.setValueAtTime(o.gain ?? 0.2, t);
  env.gain.exponentialRampToValueAtTime(0.0001, t + o.duration);
  src.connect(filter).connect(env).connect(dest);
  src.start(t, Math.random() * 0.5);
  src.stop(t + o.duration + 0.02);
}

function kick(ctx: BaseAudioContext, dest: AudioNode, t: number, gain = 0.5) {
  tone(ctx, dest, t, { freq: 150, slideTo: 45, type: 'sine', duration: 0.18, gain });
}

const note = (semitonesFromA4: number) => 440 * Math.pow(2, semitonesFromA4 / 12);
/** C5 からの音階（ペンタトニック） */
const PENTATONIC = [0, 2, 4, 7, 9];
const C5 = 3;

// ---------- 効果音 ----------

export function renderSound(ctx: BaseAudioContext, dest: AudioNode, t: number, name: SoundName, options: SoundOptions) {
  const level = options.level ?? 0;
  switch (name) {
    case 'tap':
      tone(ctx, dest, t, { freq: 700, type: 'sine', duration: 0.05, gain: 0.12 });
      break;

    case 'digit': {
      // 連続するほど音が上がっていく「ピロッ」
      const step = options.step ?? 0;
      const semitone = C5 + PENTATONIC[step % 5] + 12 * Math.min(2, Math.floor(step / 5));
      tone(ctx, dest, t, { freq: note(semitone), type: 'square', duration: 0.1, gain: 0.1 });
      tone(ctx, dest, t, { freq: note(semitone + 12), type: 'triangle', duration: 0.14, gain: 0.12 });
      noise(ctx, dest, t, { duration: 0.06, gain: 0.05, freq: 8000 });
      break;
    }

    case 'clear': {
      // 段階が上がるほど長く・速く・高くなる「ピロリロリン♪」
      const notes = [0, 4, 7, 12, 16, 19, 24, 28, 31];
      const count = Math.min(notes.length, 5 + level);
      const stepTime = Math.max(0.035, 0.075 - level * 0.009);
      const base = C5 + Math.min(level, 4) * 2;
      for (let i = 0; i < count; i++) {
        const last = i === count - 1;
        tone(ctx, dest, t + i * stepTime, { freq: note(base + notes[i]), type: 'square', duration: last ? 0.35 : 0.09, gain: 0.08 });
        tone(ctx, dest, t + i * stepTime, { freq: note(base + notes[i] + 12), type: 'triangle', duration: last ? 0.45 : 0.1, gain: 0.1 });
      }
      {
        // コインの「チャリン」は段階0から
        const coins = Math.min(12, 3 + level * 2);
        for (let i = 0; i < coins; i++) renderSound(ctx, dest, t + 0.12 + i * 0.07, 'coin', {});
      }
      noise(ctx, dest, t + count * stepTime, { duration: 0.4 + Math.min(level, 4) * 0.1, gain: 0.12, freq: 6000 });
      break;
    }

    case 'coin':
      tone(ctx, dest, t, { freq: note(C5 + 7 + 12), type: 'square', duration: 0.06, gain: 0.06 });
      tone(ctx, dest, t + 0.06, { freq: note(C5 + 12 + 12), type: 'square', duration: 0.16, gain: 0.06 });
      break;

    case 'miss':
      tone(ctx, dest, t, { freq: 240, slideTo: 110, type: 'sawtooth', duration: 0.28, gain: 0.12 });
      tone(ctx, dest, t, { freq: 180, slideTo: 90, type: 'square', duration: 0.22, gain: 0.06 });
      break;

    case 'levelUp':
      for (let i = 0; i < 6; i++) tone(ctx, dest, t + i * 0.045, { freq: note(C5 + i * 3), type: 'square', duration: 0.08, gain: 0.08 });
      tone(ctx, dest, t, { freq: 300, slideTo: 1800, type: 'sine', duration: 0.35, gain: 0.08 });
      break;

    case 'cutIn':
      // 「キュイイィン!!」＋ドンドンドン
      tone(ctx, dest, t, { freq: 200, slideTo: 2400, type: 'sawtooth', duration: 0.5, gain: 0.1 });
      tone(ctx, dest, t, { freq: 400, slideTo: 3200, type: 'square', duration: 0.5, gain: 0.05 });
      for (let i = 0; i < 3; i++) {
        kick(ctx, dest, t + 0.5 + i * 0.14, 0.6);
        noise(ctx, dest, t + 0.5 + i * 0.14, { duration: 0.12, gain: 0.2, filter: 'bandpass', freq: 1800 });
      }
      break;

    case 'feverStart': {
      // ファンファーレ＋シンバル
      const chords = [[0, 4, 7], [5, 9, 12], [7, 11, 14], [12, 16, 19]];
      chords.forEach((chord, i) => {
        chord.forEach((n) =>
          tone(ctx, dest, t + i * 0.16, { freq: note(C5 + n - 12), type: 'sawtooth', duration: i === 3 ? 0.9 : 0.15, gain: 0.07 }),
        );
      });
      for (let i = 0; i < 12; i++) noise(ctx, dest, t + i * 0.04, { duration: 0.05, gain: 0.08, filter: 'bandpass', freq: 2000 });
      noise(ctx, dest, t + 0.48, { duration: 1.4, gain: 0.25, freq: 5000 });
      kick(ctx, dest, t + 0.48, 0.8);
      break;
    }

    case 'drumroll':
      for (let i = 0; i < 28; i++) noise(ctx, dest, t + i * 0.05, { duration: 0.05, gain: 0.04 + i * 0.004, filter: 'bandpass', freq: 1800 });
      break;

    case 'perfect':
    case 'result': {
      const melody = name === 'perfect' ? [0, 4, 7, 12, 7, 12, 16, 19, 24] : [0, 4, 7, 12];
      melody.forEach((n, i) => {
        const last = i === melody.length - 1;
        tone(ctx, dest, t + i * 0.1, { freq: note(C5 + n), type: 'square', duration: last ? 0.8 : 0.12, gain: 0.08 });
        tone(ctx, dest, t + i * 0.1, { freq: note(C5 + n - 12), type: 'triangle', duration: last ? 0.8 : 0.12, gain: 0.1 });
      });
      noise(ctx, dest, t + melody.length * 0.1, { duration: 1.2, gain: 0.18, freq: 5000 });
      break;
    }

    case 'start':
      tone(ctx, dest, t, { freq: note(C5 + 12), type: 'square', duration: 0.12, gain: 0.08 });
      tone(ctx, dest, t + 0.1, { freq: note(C5 + 19), type: 'square', duration: 0.3, gain: 0.08 });
      break;

    case 'tick':
      tone(ctx, dest, t, { freq: 1600, type: 'square', duration: 0.03, gain: 0.05 });
      break;

    case 'sixSeven':
      renderSixSevenBgm(ctx, dest, t);
      break;
  }
}

// ---------- 67 の専用 BGM ----------
// 答えが 67 の問題を解いたときだけ流れる、オリジナルのノリノリな曲（Web Audio で合成）。
// 「シックス!」「セブン!」の2つの叩きつける音がくり返し出てくる。

const SIX_SEVEN_BPM = 150;
const SIX_SEVEN_BARS = 4;
/** 67 の曲の長さ（秒） */
export const SIX_SEVEN_SECONDS = (SIX_SEVEN_BARS * 4 * 60) / SIX_SEVEN_BPM + 0.6;

function renderSixSevenBgm(ctx: BaseAudioContext, dest: AudioNode, t: number) {
  const beat = 60 / SIX_SEVEN_BPM;
  const bus = ctx.createGain();
  bus.gain.value = 1.1;
  bus.connect(dest);
  // ベース（ラ → ファ → ソ → ミ の繰り返し）
  const roots = [-12 - 12, -16 - 12, -14 - 12, -17 - 12];
  for (let bar = 0; bar < SIX_SEVEN_BARS; bar++) {
    const b0 = t + bar * 4 * beat;
    const root = roots[bar % roots.length];
    for (let i = 0; i < 4; i++) {
      const bt = b0 + i * beat;
      kick(ctx, bus, bt, 0.7);
      noise(ctx, bus, bt + beat / 2, { duration: 0.05, gain: 0.07, freq: 9000 });
      noise(ctx, bus, bt + beat / 4, { duration: 0.03, gain: 0.04, freq: 10000 });
      noise(ctx, bus, bt + (beat * 3) / 4, { duration: 0.03, gain: 0.04, freq: 10000 });
      if (i % 2 === 1) noise(ctx, bus, bt, { duration: 0.14, gain: 0.22, filter: 'bandpass', freq: 1500 });
      tone(ctx, bus, bt + beat / 2, { freq: note(root), type: 'sawtooth', duration: beat * 0.45, gain: 0.12 });
      tone(ctx, bus, bt + beat / 2, { freq: note(root + 12), type: 'square', duration: beat * 0.3, gain: 0.05 });
    }
    // 「シックス!」「セブン!」（6度 → 7度の和音で叩く）。2小節目と4小節目は音を上げて畳みかける
    const lift = bar % 2 === 1 ? 5 : 0;
    const stab = (at: number, semis: number[]) =>
      semis.forEach((n) => {
        tone(ctx, bus, at, { freq: note(n + lift), type: 'sawtooth', duration: beat * 0.7, gain: 0.07 });
        tone(ctx, bus, at, { freq: note(n + lift + 12), type: 'square', duration: beat * 0.5, gain: 0.035 });
      });
    stab(b0, [C5 + 9 - 12, C5 + 12 - 12, C5 + 16 - 12]);
    stab(b0 + beat * 1.5, [C5 + 11 - 12, C5 + 14 - 12, C5 + 17 - 12]);
    noise(ctx, bus, b0, { duration: 0.25, gain: 0.12, filter: 'bandpass', freq: 3000 });
    noise(ctx, bus, b0 + beat * 1.5, { duration: 0.25, gain: 0.12, filter: 'bandpass', freq: 3000 });
    // ピロピロの上がっていくメロディ
    [0, 4, 7, 9, 12, 9, 7, 11].forEach((n, i) =>
      tone(ctx, bus, b0 + beat * 2 + i * (beat / 4), { freq: note(C5 + n + lift), type: 'square', duration: beat * 0.22, gain: 0.05 }),
    );
  }
  // 最後に「ジャーン!」
  const end = t + SIX_SEVEN_BARS * 4 * beat;
  [C5 + 9 - 12, C5 + 12 - 12, C5 + 16 - 12, C5 + 21 - 12].forEach((n) =>
    tone(ctx, bus, end - beat * 0.5, { freq: note(n), type: 'sawtooth', duration: 1.1, gain: 0.06 }),
  );
  noise(ctx, bus, end - beat * 0.5, { duration: 1, gain: 0.2, freq: 5000 });
}

/** 67 の曲を流す。いつもの BGM はそのあいだ小さくする */
export function playSixSeven() {
  play('sixSeven');
  if (!context || !bgmBus || muted) return;
  const now = context.currentTime;
  const g = bgmBus.gain;
  g.cancelScheduledValues(now);
  g.setValueAtTime(g.value, now);
  g.linearRampToValueAtTime(0.08, now + 0.15);
  g.setValueAtTime(0.08, now + SIX_SEVEN_SECONDS - 0.6);
  g.linearRampToValueAtTime(1, now + SIX_SEVEN_SECONDS);
  speak('シックス、セブン！');
  window.setTimeout(() => speak('シックスセブン！'), ((4 * 2 * 60) / SIX_SEVEN_BPM) * 1000);
}

/** 端末に入っている読み上げの声でしゃべらせる（声が無い端末では何もしない） */
function speak(text: string) {
  if (muted || typeof speechSynthesis === 'undefined') return;
  try {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'ja-JP';
    u.rate = 1.5;
    u.pitch = 1.8;
    u.volume = 1;
    speechSynthesis.speak(u);
  } catch {
    // 読み上げが使えなくても曲は流れる
  }
}

// ---------- BGM ----------
// フリー音源（CC0）を使っています。曲の情報は README を見てください。
// タイトル・結果画面はチップチューン、ゲーム中は EDM（ふつう → コンボが続くと明るい版 → フィーバーは「キメ」入りの版）。

type BgmTrack = {
  url: string;
  /** 1ループの長さ（秒） */
  seconds: number;
  /** 曲の頭の「間」（秒）。最初の音がループの頭より後ろにある曲だけ指定 */
  leadIn?: number;
  /** 曲ごとの音量の補正（1 = そのまま） */
  volume?: number;
  /** 再生スピード（2 = 2倍速。音も高くなる）。指定がなければ BGM_SPEED */
  speed?: number;
};

/** BGM の再生スピード（娘さんの希望で 2倍速。1 に戻すと元どおり） */
const BGM_SPEED = 2;
const trackSpeed = (pattern: BgmPattern) => BGM_TRACKS[pattern].speed ?? BGM_SPEED;

/** BGM の曲。差し替えるときは public/bgm/ のファイルと、ここの秒数（ループの長さ）を変える */
export const BGM_TRACKS: Record<BgmPattern, BgmTrack> = {
  menu: { url: 'bgm/menu.m4a', seconds: 2830338 / 44100, leadIn: 3693 / 44100, volume: 2.2 },
  game: { url: 'bgm/game.m4a', seconds: 303188 / 44100 },
  hot: { url: 'bgm/hot.m4a', seconds: 303188 / 44100 },
  fever: { url: 'bgm/fever.m4a', seconds: 605588 / 44100 },
};
const BGM_VOLUME = 0.32;
const CROSSFADE_SECONDS = 0.3;

export type LoadedBgm = Record<BgmPattern, { buffer: AudioBuffer; loopStart: number; loopEnd: number }>;

/** BGM を読み込む。AAC は頭に短い無音が入ることがあるので、音が始まる位置を探してループ位置を合わせる */
export async function loadBgmTracks(ctx: BaseAudioContext, baseUrl: string = document.baseURI): Promise<LoadedBgm> {
  const entries = await Promise.all(
    (Object.keys(BGM_TRACKS) as BgmPattern[]).map(async (pattern) => {
      const track = BGM_TRACKS[pattern];
      const data = await (await fetch(new URL(track.url, baseUrl))).arrayBuffer();
      const buffer = await ctx.decodeAudioData(data);
      const loopStart = Math.max(0, findFirstSound(buffer) - (track.leadIn ?? 0));
      const loopEnd = Math.min(buffer.duration, loopStart + track.seconds);
      return [pattern, { buffer, loopStart, loopEnd }] as const;
    }),
  );
  return Object.fromEntries(entries) as LoadedBgm;
}

function findFirstSound(buffer: AudioBuffer): number {
  const limit = Math.min(buffer.length, Math.round(buffer.sampleRate * 0.25));
  const channels = Array.from({ length: buffer.numberOfChannels }, (_, i) => buffer.getChannelData(i));
  for (let i = 0; i < limit; i++) {
    if (channels.some((c) => Math.abs(c[i]) > 0.012)) return i / buffer.sampleRate;
  }
  return 0;
}

type BgmVoice = { source: AudioBufferSourceNode; gain: GainNode; level: number };

/** BGM を1本鳴らし始める。offset はループの中のどこから始めるか（秒） */
export function startBgmVoice(ctx: BaseAudioContext, dest: AudioNode, loaded: LoadedBgm, pattern: BgmPattern, when: number, offset: number): BgmVoice {
  const track = loaded[pattern];
  const length = track.loopEnd - track.loopStart;
  const source = ctx.createBufferSource();
  source.buffer = track.buffer;
  source.loop = true;
  source.loopStart = track.loopStart;
  source.loopEnd = track.loopEnd;
  // offset は実際の経過時間なので、スピードをかけて曲の中の位置にする
  const speed = trackSpeed(pattern);
  source.playbackRate.value = speed;
  const position = offset * speed;
  const level = BGM_VOLUME * (BGM_TRACKS[pattern].volume ?? 1);
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, when);
  gain.gain.exponentialRampToValueAtTime(level, when + CROSSFADE_SECONDS);
  source.connect(gain).connect(dest);
  source.start(when, track.loopStart + (((position % length) + length) % length));
  return { source, gain, level };
}

export function stopBgmVoice(voice: BgmVoice, when: number) {
  voice.gain.gain.cancelScheduledValues(when);
  voice.gain.gain.setValueAtTime(voice.level, when);
  voice.gain.gain.exponentialRampToValueAtTime(0.0001, when + CROSSFADE_SECONDS);
  voice.source.stop(when + CROSSFADE_SECONDS + 0.05);
}

let loadedBgm: LoadedBgm | null = null;
let loadingBgm = false;
let wantedBgm: BgmPattern | null = null;
let playing: { pattern: BgmPattern; voice: BgmVoice } | null = null;
/** 曲を切り替えても拍がずれないよう、最初に鳴らし始めた時刻を基準にする */
let bgmEpoch = 0;

/**
 * 次の曲をループのどこから鳴らすか。
 * ゲーム中の EDM どうしは拍をそろえてつなぎ、メニュー曲とのあいだは頭から鳴らす。
 */
export function nextBgmStart(previous: BgmPattern | null, next: BgmPattern, now: number, epoch: number) {
  const family = (p: BgmPattern) => (p === 'menu' ? 'menu' : 'edm');
  const sameFamily = previous !== null && family(previous) === family(next);
  const newEpoch = sameFamily ? epoch : now;
  return { epoch: newEpoch, offset: now - newEpoch };
}

function ensureBgmLoaded() {
  if (loadedBgm || loadingBgm || !context) return;
  loadingBgm = true;
  loadBgmTracks(context)
    .then((loaded) => {
      loadedBgm = loaded;
      applyBgm();
    })
    .catch(() => {
      // 読み込めなかったときは BGM なしで遊べるようにする
    });
}

function applyBgm() {
  if (!context || !master || !loadedBgm) return;
  if (playing?.pattern === wantedBgm) return;
  const now = context.currentTime + 0.02;
  if (!wantedBgm) {
    if (playing) stopBgmVoice(playing.voice, now);
    playing = null;
    return;
  }
  const start = nextBgmStart(playing?.pattern ?? null, wantedBgm, now, bgmEpoch);
  bgmEpoch = start.epoch;
  const voice = startBgmVoice(context, bgmBus ?? master, loadedBgm, wantedBgm, now, start.offset);
  if (playing) stopBgmVoice(playing.voice, now);
  playing = { pattern: wantedBgm, voice };
}

/** BGM を切り替える（null で停止） */
export function setBgm(pattern: BgmPattern | null) {
  if (wantedBgm === pattern) return;
  window.__soundLog?.push({ kind: 'bgm', time: epochNow(), pattern });
  wantedBgm = pattern;
  ensureBgmLoaded();
  applyBgm();
}

// アプリが裏に回ったら音を止め、戻ってきたら再開する
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (!context) return;
    if (document.hidden) void context.suspend();
    else void context.resume();
  });
}

function epochNow() {
  return performance.timeOrigin + performance.now();
}
