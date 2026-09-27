// 演出の「呼び出し口」です。ゲーム画面から fx.burst(...) のように呼ぶと、
// EffectsLayer（画面全体にかぶさる演出レイヤー）が受け取って表示します。

export type ParticleKind = 'star' | 'confetti' | 'coin' | 'heart' | 'moru' | 'spark';

export type BurstOptions = {
  x: number;
  y: number;
  count: number;
  kinds: ParticleKind[];
  /** 飛び散る勢い（1 が標準） */
  power?: number;
  /** 上向きに飛ばすか（噴水） */
  fountain?: boolean;
};

export type BannerStyle = 'pop' | 'gold' | 'rainbow' | 'miss';

export type FxEvent =
  | { type: 'burst'; options: BurstOptions }
  | { type: 'rain'; kinds: ParticleKind[]; count: number; durationMs: number }
  | { type: 'banner'; text: string; style: BannerStyle; sub?: string }
  | { type: 'floatText'; x: number; y: number; text: string; big?: boolean }
  | { type: 'flash'; color: string }
  | { type: 'shake'; strength: number }
  | { type: 'cutIn'; text: string; sub: string }
  | { type: 'ambient'; level: number };

type Listener = (event: FxEvent) => void;
const listeners = new Set<Listener>();

export function subscribeFx(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function emit(event: FxEvent) {
  listeners.forEach((listener) => listener(event));
}

export const fx = {
  burst: (options: BurstOptions) => emit({ type: 'burst', options }),
  rain: (kinds: ParticleKind[], count: number, durationMs = 1500) => emit({ type: 'rain', kinds, count, durationMs }),
  banner: (text: string, style: BannerStyle = 'pop', sub?: string) => emit({ type: 'banner', text, style, sub }),
  floatText: (x: number, y: number, text: string, big = false) => emit({ type: 'floatText', x, y, text, big }),
  flash: (color = '#fff') => emit({ type: 'flash', color }),
  shake: (strength = 1) => emit({ type: 'shake', strength }),
  cutIn: (text: string, sub: string) => emit({ type: 'cutIn', text, sub }),
  /** 常に流れる背景演出の強さ（0〜5、-1 でなし） */
  ambient: (level: number) => emit({ type: 'ambient', level }),
};

/** 要素の中心の画面座標 */
export function centerOf(element: Element | null | undefined): { x: number; y: number } {
  if (!element) return { x: window.innerWidth / 2, y: window.innerHeight / 2 };
  const rect = element.getBoundingClientRect();
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}
