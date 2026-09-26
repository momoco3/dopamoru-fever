// アプリ全体で使う「データの形」をまとめたファイルです。

export type Operation = 'add' | 'sub' | 'mix';
export type QuestionCount = 5 | 10 | 20;

/** 1問分の筆算 */
export type Problem = {
  top: number;
  bottom: number;
  op: '+' | '-';
  answer: number;
  /** 答えの各位の数字（[0] が一の位） */
  answerDigits: number[];
  /** 一の位からくり上がりがあるか（たし算） */
  carry: boolean;
  /** 十の位からくり下がりがあるか（ひき算） */
  borrow: boolean;
};

export type GameConfig = {
  count: QuestionCount;
  operation: Operation;
};

/** 1回のプレイの結果 */
export type GameResult = {
  config: GameConfig;
  cleared: number;
  /** ミスせずに解けた問題数 */
  perfectCount: number;
  misses: number;
  timeMs: number;
  targetMs: number;
  dopa: number;
  maxCombo: number;
};

export type FeverResult = {
  solved: number;
  dopa: number;
  maxCombo: number;
};

export type Screen =
  | { name: 'title' }
  | { name: 'game'; config: GameConfig }
  | { name: 'result'; result: GameResult }
  | { name: 'fever'; config: GameConfig; startDopa: number }
  | { name: 'feverResult'; result: FeverResult; config: GameConfig };
