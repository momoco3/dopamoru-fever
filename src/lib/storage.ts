// 記録と設定を、この端末のブラウザの中だけに保存します（どこにも送信しません）。

export type Records = {
  bestDopa: number;
  totalDopa: number;
  plays: number;
  bestFeverSolved: number;
  /** 問題数ごとのベストタイム（ミリ秒） */
  bestTime: Record<string, number>;
};

export type Preferences = {
  sound: boolean;
  reduceMotion: boolean;
  count: 5 | 10 | 20;
  operation: 'add' | 'sub' | 'mix';
};

const RECORDS_KEY = 'dopamoru-fever:records';
const PREFS_KEY = 'dopamoru-fever:prefs';

const DEFAULT_RECORDS: Records = { bestDopa: 0, totalDopa: 0, plays: 0, bestFeverSolved: 0, bestTime: {} };
export const DEFAULT_PREFS: Preferences = { sound: true, reduceMotion: false, count: 10, operation: 'mix' };

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? { ...fallback, ...JSON.parse(raw) } : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // 保存できない環境（プライベートモードなど）では何もしない
  }
}

export const loadRecords = () => read(RECORDS_KEY, DEFAULT_RECORDS);
export const saveRecords = (records: Records) => write(RECORDS_KEY, records);
export const loadPrefs = () => read(PREFS_KEY, DEFAULT_PREFS);
export const savePrefs = (prefs: Preferences) => write(PREFS_KEY, prefs);
