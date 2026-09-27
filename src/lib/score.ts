// 「ドパ」（ポイント）の計算と表示のしかたです。
// 連続正解するほど倍率が爆上がりして、万 → 億 → 兆 → 京… とインフレしていきます。
// 数字を変えるとインフレの速さを調整できます。

/** 連続正解（コンボ）ごとに倍率が何倍になるか */
const COMBO_GROWTH = 8;
/** フィーバー中の倍率の伸び */
const FEVER_GROWTH = 25;
const FEVER_BASE = 1_000_000;

const DIGIT_BASE = 120;
const CLEAR_BASE = 50_000;

export function getMultiplier(combo: number, fever: boolean): number {
  return fever ? FEVER_BASE * Math.pow(FEVER_GROWTH, combo) : Math.pow(COMBO_GROWTH, combo);
}

/** 1桁正解したときのドパ */
export function digitPoints(combo: number, fever: boolean): number {
  return DIGIT_BASE * getMultiplier(combo, fever);
}

/** 1問クリアしたときのドパ（速く解くほどボーナス最大3倍） */
export function clearPoints(combo: number, fever: boolean, secondsTaken: number): number {
  const speedBonus = Math.min(3, Math.max(1, 3 - secondsTaken / 4));
  return CLEAR_BASE * getMultiplier(combo, fever) * speedBonus;
}

/**
 * 演出の段階（0〜4）。コンボが続くほど派手になります。フィーバー中は常に 5。
 */
export function getLevel(combo: number, fever: boolean): number {
  if (fever) return 5;
  if (combo >= 6) return 4;
  if (combo >= 4) return 3;
  if (combo >= 2) return 2;
  if (combo >= 1) return 1;
  return 0;
}

const UNITS: [number, string][] = [
  [1e68, '無量大数'],
  [1e64, '不可思議'],
  [1e60, '那由他'],
  [1e56, '阿僧祇'],
  [1e52, '恒河沙'],
  [1e48, '極'],
  [1e44, '載'],
  [1e40, '正'],
  [1e36, '澗'],
  [1e32, '溝'],
  [1e28, '穣'],
  [1e24, '𥝱'],
  [1e20, '垓'],
  [1e16, '京'],
  [1e12, '兆'],
  [1e8, '億'],
  [1e4, '万'],
];

/** 例: 42000 → "4.2万", 29900000000 → "299億" */
export function formatDopa(value: number): string {
  if (!Number.isFinite(value)) return '∞';
  if (value >= 1e72) return '無量大数超え';
  for (const [size, unit] of UNITS) {
    if (value >= size) {
      const n = value / size;
      if (n >= 1000) return `${Math.floor(n).toLocaleString('ja-JP')}${unit}`;
      return `${n >= 100 ? Math.floor(n) : n >= 10 ? n.toFixed(1).replace(/\.0$/, '') : n.toFixed(2).replace(/\.?0+$/, '')}${unit}`;
    }
  }
  return Math.floor(value).toLocaleString('ja-JP');
}

/** 目標タイム（1問あたり秒数） */
export const TARGET_SECONDS_PER_QUESTION = 8;

export function formatTime(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}
