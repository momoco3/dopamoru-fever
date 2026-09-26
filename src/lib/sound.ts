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
  | 'tick';

export type SoundOptions = { step?: number; level?: number };
export type BgmPattern = 'game' | 'hot' | 'fever';

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
let muted = false;

/** 最初のタップのときに呼ぶ（ブラウザは操作前に音を鳴らせないため） */
export function unlockAudio() {
  if (!context) {
    const AudioContextClass = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    context = new AudioContextClass();
    master = createMaster(context, context.destination);
  }
  if (context.state === 'suspended') void context.resume();
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
      const count = Math.min(notes.length, 4 + level);
      const stepTime = Math.max(0.035, 0.075 - level * 0.009);
      const base = C5 + Math.min(level, 4) * 2;
      for (let i = 0; i < count; i++) {
        const last = i === count - 1;
        tone(ctx, dest, t + i * stepTime, { freq: note(base + notes[i]), type: 'square', duration: last ? 0.35 : 0.09, gain: 0.08 });
        tone(ctx, dest, t + i * stepTime, { freq: note(base + notes[i] + 12), type: 'triangle', duration: last ? 0.45 : 0.1, gain: 0.1 });
      }
      if (level >= 2) {
        const coins = Math.min(10, (level - 1) * 3);
        for (let i = 0; i < coins; i++) renderSound(ctx, dest, t + 0.12 + i * 0.07, 'coin', {});
      }
      if (level >= 3) noise(ctx, dest, t + count * stepTime, { duration: 0.6, gain: 0.12, freq: 6000 });
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
  }
}

// ---------- BGM ----------

const BGM_TEMPO: Record<BgmPattern, number> = { game: 120, hot: 140, fever: 168 };
const BASS_LINE = [-9, -9, -12, -12, -16, -16, -14, -14]; // A → F# → D → E あたり（2拍ずつ）

/** BGM の t0〜t1 の範囲の音を並べる。startTime は BGM を始めた時刻 */
export function renderBgm(ctx: BaseAudioContext, dest: AudioNode, pattern: BgmPattern, startTime: number, t0: number, t1: number) {
  const beat = 60 / BGM_TEMPO[pattern];
  const sixteenth = beat / 4;
  const first = Math.max(0, Math.ceil((t0 - startTime) / sixteenth));
  const last = Math.floor((t1 - startTime) / sixteenth);
  for (let i = first; i <= last; i++) {
    const t = startTime + i * sixteenth;
    if (t < t0 || t >= t1) continue;
    const beatIndex = Math.floor(i / 4);
    const inBeat = i % 4;
    const bass = BASS_LINE[Math.floor(beatIndex / 2) % BASS_LINE.length];

    if (pattern === 'game') {
      if (inBeat === 0) tone(ctx, dest, t, { freq: note(bass - 12), type: 'triangle', duration: beat * 0.9, gain: 0.1 });
      if (inBeat === 2) noise(ctx, dest, t, { duration: 0.04, gain: 0.03, freq: 8000 });
    } else if (pattern === 'hot') {
      if (inBeat === 0) kick(ctx, dest, t, 0.35);
      if (inBeat % 2 === 0) tone(ctx, dest, t, { freq: note(bass - 12), type: 'square', duration: sixteenth * 1.6, gain: 0.05 });
      noise(ctx, dest, t, { duration: 0.03, gain: inBeat === 2 ? 0.05 : 0.025, freq: 9000 });
    } else {
      if (inBeat === 0) kick(ctx, dest, t, 0.45);
      tone(ctx, dest, t, { freq: note(bass - 12 + (inBeat % 2 ? 12 : 0)), type: 'square', duration: sixteenth * 0.9, gain: 0.05 });
      noise(ctx, dest, t, { duration: 0.03, gain: 0.035, freq: 9000 });
      // きらきらしたアルペジオ
      const arp = [0, 4, 7, 12][i % 4];
      tone(ctx, dest, t, { freq: note(bass + 24 + arp), type: 'triangle', duration: sixteenth * 0.9, gain: 0.035 });
      if (beatIndex % 2 === 1 && inBeat === 0) noise(ctx, dest, t, { duration: 0.12, gain: 0.1, filter: 'bandpass', freq: 1800 });
    }
  }
}

let bgm: { pattern: BgmPattern; startTime: number; scheduledUntil: number; timer: number } | null = null;

/** BGM を切り替える（null で停止） */
export function setBgm(pattern: BgmPattern | null) {
  if (bgm?.pattern === pattern) return;
  window.__soundLog?.push({ kind: 'bgm', time: epochNow(), pattern });
  if (bgm) {
    clearInterval(bgm.timer);
    bgm = null;
  }
  if (!pattern || !context || !master) return;
  const ctx = context;
  const dest = master;
  const startTime = ctx.currentTime + 0.05;
  const state = { pattern, startTime, scheduledUntil: startTime, timer: 0 };
  const schedule = () => {
    if (muted) {
      state.scheduledUntil = ctx.currentTime + 0.3;
      return;
    }
    const until = ctx.currentTime + 0.3;
    if (until > state.scheduledUntil) {
      renderBgm(ctx, dest, pattern, startTime, state.scheduledUntil, until);
      state.scheduledUntil = until;
    }
  };
  schedule();
  state.timer = window.setInterval(schedule, 100);
  bgm = state;
}

function epochNow() {
  return performance.timeOrigin + performance.now();
}
