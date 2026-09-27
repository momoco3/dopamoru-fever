// ゲーム画面（ふつうのテストとフィーバーの両方）。
// 一の位から1桁ずつ入力。正解するとドパと演出、連続正解（コンボ）で演出がどんどん派手になります。
import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { centerOf, fx, type ParticleKind } from '../lib/effects';
import { createProblem, PLACE_NAMES, SIX_SEVEN } from '../lib/problems';
import { clearPoints, digitPoints, formatDopa, formatTime, getLevel, getMultiplier, TARGET_SECONDS_PER_QUESTION } from '../lib/score';
import { play, playSixSeven, setBgm } from '../lib/sound';
import type { Expression } from '../lib/dopamoruArt';
import type { FeverResult, GameConfig, GameResult, Problem } from '../types';
import { DopaCounter } from './DopaCounter';
import { Dopamoru, type Motion } from './Dopamoru';
import styles from './GameScreen.module.css';
import { Keypad } from './Keypad';

type Props =
  | { mode: 'normal'; config: GameConfig; onFinish: (result: GameResult) => void; onQuit: () => void }
  | { mode: 'fever'; config: GameConfig; startDopa: number; onFinish: (result: FeverResult) => void; onQuit: () => void };

export const FEVER_SECONDS = 30;

/** 段階ごとの「正解！」の言葉 */
const CLEAR_WORDS = [
  ['いいね！', 'OK！', 'せいかい！'],
  ['ナイス！', 'やるじゃん！', 'いい感じ！'],
  ['すごい!!', 'キレッキレ!!', 'その調子!!'],
  ['激アツ!!', 'ドパッ!!', '止まらない!!'],
  ['神!!!', 'ドパドパ!!!', '天才!!!'],
  ['モルモル!!!', '大当たり!!!', 'ドッパーン!!!'],
];

type GameState = {
  problem: Problem;
  questionNumber: number;
  place: number;
  locked: (number | null)[];
  wrongPlace: number | null;
  combo: number;
  maxCombo: number;
  digitStreak: number;
  misses: number;
  questionMissed: boolean;
  perfectCount: number;
  cleared: number;
  dopa: number;
  questionStartedAt: number;
  startedAt: number;
  busy: boolean;
  finished: boolean;
  lastGain: number;
};

export function GameScreen(props: Props) {
  const fever = props.mode === 'fever';
  const { config } = props;
  const [now, setNow] = useState(() => performance.now());
  const [mascot, setMascot] = useState<{ expression: Expression; motion: Motion; key: number }>({
    expression: fever ? 'fever' : 'normal',
    motion: fever ? 'dance' : 'idle',
    key: 0,
  });
  const [bubble, setBubble] = useState<string>(fever ? 'フィーバーだモル!!' : 'がんばるモル！');
  const cardRef = useRef<HTMLDivElement>(null);
  const boxRefs = useRef<(HTMLDivElement | null)[]>([]);
  const finishRef = useRef(props.onFinish);
  useEffect(() => {
    finishRef.current = props.onFinish;
  });

  // 画面に表示する状態（game）と、入力処理で書き換える作業用コピー（stateRef）
  const [game, setGame] = useState<GameState>(() => {
    const problem = createProblem(config.operation);
    const t = performance.now();
    return {
      problem,
      questionNumber: 1,
      place: 0,
      locked: problem.answerDigits.map(() => null),
      wrongPlace: null,
      combo: 0,
      maxCombo: 0,
      digitStreak: 0,
      misses: 0,
      questionMissed: false,
      perfectCount: 0,
      cleared: 0,
      dopa: fever ? (props as { startDopa: number }).startDopa : 0,
      questionStartedAt: t,
      startedAt: t,
      busy: false,
      finished: false,
      lastGain: 0,
    };
  });
  const stateRef = useRef<GameState>(game);
  /** 作業用コピーの内容を画面に反映する */
  const rerender = useCallback(() => {
    const s = stateRef.current;
    setGame({ ...s, locked: [...s.locked] });
  }, []);
  const state = game;
  const level = getLevel(state.combo, fever);

  // ---- タイマー ----
  useEffect(() => {
    const timer = window.setInterval(() => setNow(performance.now()), 200);
    return () => clearInterval(timer);
  }, []);

  // ---- 背景演出と BGM を段階に合わせる ----
  useEffect(() => {
    fx.ambient(level);
    setBgm(fever ? 'fever' : level >= 3 ? 'hot' : 'game');
  }, [level, fever]);

  useEffect(() => {
    if (fever) {
      fx.cutIn('モルモルフィーバー!!', `${FEVER_SECONDS}秒でドパを稼げ!!`);
      play('feverStart');
      fx.rain(['coin', 'star', 'moru', 'confetti'], 120, 2000);
    } else {
      // 最初からドパを出す（おとなしいと見てもらえないので）
      play('start');
      play('levelUp');
      fx.banner('スタート!!', 'gold', 'ドパを集めろ!!');
      fx.burst({ x: window.innerWidth / 2, y: window.innerHeight * 0.4, count: 70, kinds: ['star', 'confetti', 'coin', 'spark'], power: 1.2 });
      fx.rain(['star', 'confetti', 'coin'], 40, 1400);
      fx.flash('#ffffff');
    }
    return () => {
      fx.ambient(-1);
    };
  }, [fever]);

  const finish = useCallback(() => {
    const s = stateRef.current;
    if (s.finished) return;
    s.finished = true;
    s.busy = true;
    rerender();
    if (props.mode === 'fever') {
      fx.banner('タイムアップ!!', 'gold');
      play('result');
      window.setTimeout(() => finishRef.current({ solved: s.cleared, dopa: s.dopa, maxCombo: s.maxCombo } as never), 1400);
    } else {
      const timeMs = performance.now() - s.startedAt;
      window.setTimeout(
        () =>
          finishRef.current({
            config,
            cleared: s.cleared,
            perfectCount: s.perfectCount,
            misses: s.misses,
            timeMs,
            targetMs: config.count * TARGET_SECONDS_PER_QUESTION * 1000,
            dopa: s.dopa,
            maxCombo: s.maxCombo,
          } as never),
        900,
      );
    }
  }, [config, props.mode, rerender]);

  // フィーバーの残り時間
  const feverLeftMs = fever ? Math.max(0, FEVER_SECONDS * 1000 - (now - state.startedAt)) : 0;
  useEffect(() => {
    if (fever && feverLeftMs <= 0) finish();
    if (fever && feverLeftMs > 0 && feverLeftMs <= 5000 && Math.floor(feverLeftMs / 1000) !== Math.floor((feverLeftMs + 200) / 1000)) play('tick');
  }, [fever, feverLeftMs, finish]);

  const nextProblem = useCallback(() => {
    const s = stateRef.current;
    if (s.finished) return;
    const problem = createProblem(config.operation, Math.random, s.problem);
    s.problem = problem;
    s.questionNumber += 1;
    s.place = 0;
    s.locked = problem.answerDigits.map(() => null);
    s.questionMissed = false;
    s.wrongPlace = null;
    s.questionStartedAt = performance.now();
    s.busy = false;
    rerender();
  }, [config.operation, rerender]);

  // ---- 数字の入力 ----
  const input = useCallback(
    (digit: number) => {
      const s = stateRef.current;
      if (s.busy || s.finished) return;
      const expected = s.problem.answerDigits[s.place];
      const box = boxRefs.current[s.place];
      const lv = getLevel(s.combo, fever);

      if (digit !== expected) {
        // ---- ミス ----
        s.misses += 1;
        s.questionMissed = true;
        s.wrongPlace = s.place;
        const lostCombo = s.combo;
        s.combo = 0;
        s.digitStreak = 0;
        play('miss');
        cardRef.current?.animate(
          [{ transform: 'translateX(0)' }, { transform: 'translateX(-12px)' }, { transform: 'translateX(10px)' }, { transform: 'translateX(-6px)' }, { transform: 'translateX(0)' }],
          { duration: 320 },
        );
        setMascot((m) => ({ expression: 'sad', motion: 'shake', key: m.key + 1 }));
        setBubble(lostCombo >= 3 ? `${lostCombo}コンボが…！` : 'おしいモル…');
        if (lostCombo >= 3) fx.banner('コンボ終了…', 'miss');
        rerender();
        window.setTimeout(() => {
          if (stateRef.current.wrongPlace === s.place) {
            stateRef.current.wrongPlace = null;
            rerender();
          }
        }, 450);
        return;
      }

      // ---- 1桁正解 ----
      s.locked[s.place] = digit;
      s.wrongPlace = null;
      s.digitStreak += 1;
      const gained = digitPoints(s.combo, fever);
      s.dopa += gained;
      s.lastGain = gained;
      play('digit', { step: s.digitStreak });
      const pos = centerOf(box);
      const kinds: ParticleKind[] = lv >= 2 ? ['star', 'spark', 'coin', 'confetti'] : ['star', 'spark', 'coin'];
      fx.burst({ x: pos.x, y: pos.y, count: 22 + lv * 10, kinds, power: 0.9 + lv * 0.12 });
      if (lv >= 1) fx.shake(0.25 + lv * 0.1);
      fx.floatText(pos.x, pos.y - 30, `+${formatDopa(gained)}`);
      s.place += 1;

      if (s.place < s.problem.answerDigits.length) {
        rerender();
        return;
      }

      // ---- 1問クリア ----
      const seconds = (performance.now() - s.questionStartedAt) / 1000;
      const points = clearPoints(s.combo, fever, seconds);
      s.dopa += points;
      s.lastGain = points;
      s.cleared += 1;
      if (!s.questionMissed) s.perfectCount += 1;
      const before = getLevel(s.combo, fever);
      s.combo += 1;
      s.maxCombo = Math.max(s.maxCombo, s.combo);
      const after = getLevel(s.combo, fever);
      s.busy = true;
      rerender();

      const sixSeven = s.problem.answer === SIX_SEVEN;
      celebrate({ level: after, points, combo: s.combo, fever, card: cardRef.current, setMascot, setBubble });
      if (sixSeven) celebrateSixSeven(cardRef.current, setBubble);
      else if (!fever && after > before && after >= 2) announceLevelUp(after);

      const done = !fever && s.cleared >= config.count;
      window.setTimeout(() => (done ? finish() : nextProblem()), sixSeven ? 1300 : fever ? 380 : done ? 300 : 700);
    },
    [config.count, fever, finish, nextProblem, rerender],
  );

  // ---- キーボード操作 ----
  const [pressedKey, setPressedKey] = useState<number | null>(null);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (/^[0-9]$/.test(event.key)) {
        event.preventDefault();
        const d = Number(event.key);
        setPressedKey(d);
        window.setTimeout(() => setPressedKey(null), 110);
        input(d);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [input]);

  const { problem } = state;
  const elapsed = now - state.startedAt;
  const targetMs = config.count * TARGET_SECONDS_PER_QUESTION * 1000;
  const showCarryHint = state.place >= 1 && (problem.carry || problem.borrow);
  const topTens = Math.floor(problem.top / 10);

  return (
    <main className={`${styles.screen} ${fever ? styles.fever : ''} ${styles[`level${level}`]}`}>
      {/* ---- 上の情報 ---- */}
      <header className={styles.hud}>
        <div className={styles.hudRow}>
          {fever ? (
            <span className={styles.feverTag}>FEVER</span>
          ) : (
            <ol className={styles.dots} aria-label={`${state.cleared}問 / ${config.count}問`}>
              {Array.from({ length: config.count }, (_, i) => (
                <li key={i} className={i < state.cleared ? styles.dotDone : i === state.cleared ? styles.dotNow : ''} />
              ))}
            </ol>
          )}
          <div className={styles.timer}>
            {fever ? (
              <>
                <span className={styles.timerLabel}>のこり</span>
                <strong className={feverLeftMs <= 5000 ? styles.timerDanger : ''}>{formatTime(feverLeftMs + 999)}</strong>
              </>
            ) : (
              <>
                <span className={styles.timerLabel}>目標 {formatTime(targetMs)}</span>
                <strong className={elapsed > targetMs ? styles.timerOver : ''}>{formatTime(elapsed)}</strong>
              </>
            )}
          </div>
          <button type="button" className={styles.quit} onClick={props.onQuit} aria-label="やめてタイトルへ">
            ✕
          </button>
        </div>
        <div className={styles.hudRow}>
          <div className={styles.pills}>
            <span className={styles.pill}>
              {fever ? '解いた' : '正解'} <b>{fever ? state.cleared : `${state.perfectCount}/${config.count}`}</b>
            </span>
            <span className={`${styles.pill} ${styles.pillMiss}`}>
              ミス <b>{state.misses}</b>
            </span>
          </div>
          <DopaCounter value={state.dopa} level={level} />
        </div>
        <div className={styles.comboRow}>
          {state.combo >= 1 && (
            <span key={state.combo} className={styles.combo}>
              {state.combo}コンボ <small>×{formatDopa(getMultiplier(state.combo, fever))}</small>
            </span>
          )}
        </div>
      </header>

      {/* ---- ドパモル ---- */}
      <div className={styles.stage}>
        <div className={styles.bubble}>{bubble}</div>
        <Dopamoru expression={mascot.expression} motion={mascot.motion} motionKey={mascot.key} size={112} />
        <div className={styles.shelf} />
      </div>

      {/* ---- 筆算 ---- */}
      <section key={state.questionNumber} ref={cardRef} className={styles.card} aria-live="polite">
        {/* とても短い画面では、ドパモルはカードの中（左下）に小さく出る */}
        <div className={styles.cardMascot} aria-hidden="true">
          <Dopamoru expression={mascot.expression} motion={mascot.motion} motionKey={mascot.key} size={58} />
        </div>
        <div className={styles.cardHead}>
          <span className={styles.kind}>{problem.op === '+' ? 'たしざん' : 'ひきざん'}</span>
          <span className={styles.number}>第{state.questionNumber}問</span>
        </div>
        <div className={styles.column} aria-label={`${problem.top} ${problem.op === '+' ? 'たす' : 'ひく'} ${problem.bottom}`}>
          {/* くり上がり・くり下がりのメモ */}
          <div className={styles.row}>
            <span />
            <span />
            <span className={styles.memo}>
              {showCarryHint && problem.carry && <span className={styles.memoPop}>1</span>}
              {showCarryHint && problem.borrow && <span className={styles.memoPop}>{topTens - 1}</span>}
            </span>
            <span className={styles.memo}>{showCarryHint && problem.borrow && <span className={styles.memoPop}>10</span>}</span>
          </div>
          <div className={styles.row}>
            <span />
            <span />
            <span className={`${styles.digit} ${showCarryHint && problem.borrow ? styles.struck : ''}`}>{topTens}</span>
            <span className={styles.digit}>{problem.top % 10}</span>
          </div>
          <div className={styles.row}>
            <span className={styles.op}>{problem.op === '+' ? '+' : '−'}</span>
            <span />
            <span className={styles.digit}>{Math.floor(problem.bottom / 10)}</span>
            <span className={styles.digit}>{problem.bottom % 10}</span>
          </div>
          <div className={styles.line} />
          <div className={styles.row}>
            <span />
            {[2, 1, 0].map((place) => {
              const exists = place < problem.answerDigits.length;
              if (!exists) return <span key={place} />;
              const value = state.locked[place];
              const active = place === state.place && !state.busy;
              const wrong = place === state.wrongPlace;
              return (
                <div
                  key={place}
                  ref={(el) => {
                    boxRefs.current[place] = el;
                  }}
                  className={`${styles.box} ${value !== null ? styles.boxDone : ''} ${active ? styles.boxActive : ''} ${wrong ? styles.boxWrong : ''}`}
                >
                  {value ?? ''}
                </div>
              );
            })}
          </div>
          <div className={styles.row}>
            <span />
            {[2, 1, 0].map((place) => (
              <span key={place} className={styles.placeName}>
                {place === state.place && !state.busy && place < problem.answerDigits.length ? PLACE_NAMES[place] : ''}
              </span>
            ))}
          </div>
        </div>
        {state.busy && state.place >= problem.answerDigits.length && (
          <p className={styles.equation}>
            {problem.top} {problem.op === '+' ? '+' : '−'} {problem.bottom} = {problem.answer}
          </p>
        )}
      </section>

      {/* ---- 数字キー ---- */}
      <Keypad onPress={input} pressedKey={pressedKey} fever={fever} />
    </main>
  );
}

// ---- 正解の演出 ----
type CelebrateOptions = {
  level: number;
  points: number;
  combo: number;
  fever: boolean;
  card: HTMLElement | null;
  setMascot: Dispatch<SetStateAction<{ expression: Expression; motion: Motion; key: number }>>;
  setBubble: (text: string) => void;
};

function celebrate({ level: lv, points, combo, fever, card: cardElement, setMascot, setBubble }: CelebrateOptions) {
  const card = centerOf(cardElement);
  // 段階0（コンボなし）でもしっかり派手に。段階が上がるほどさらに増える
  const kinds: ParticleKind[] =
    lv >= 5
      ? ['coin', 'star', 'heart', 'moru', 'confetti', 'spark']
      : lv >= 3
        ? ['coin', 'star', 'confetti', 'spark', 'heart']
        : ['coin', 'star', 'confetti', 'spark'];
  fx.burst({ x: card.x, y: card.y, count: 60 + lv * 30, kinds, power: 1.15 + lv * 0.15 });
  fx.burst({ x: card.x, y: window.innerHeight, count: 30 + lv * 14, kinds: ['coin', 'star', 'confetti'], power: 1.3 + lv * 0.05, fountain: true });
  if (lv >= 2) {
    // 左右の端からもコインの噴水
    fx.burst({ x: 0, y: window.innerHeight, count: 12 + lv * 6, kinds: ['coin', 'star'], power: 1.2, fountain: true });
    fx.burst({ x: window.innerWidth, y: window.innerHeight, count: 12 + lv * 6, kinds: ['coin', 'star'], power: 1.2, fountain: true });
  }
  fx.rain(lv >= 5 ? ['coin', 'moru', 'star'] : lv >= 3 ? ['coin', 'star', 'moru'] : ['coin', 'star', 'confetti'], 24 + lv * 12, 1200);
  // 画面全体のフラッシュ（EffectsLayer が 0.5 秒に1回までに抑える）
  fx.flash(lv >= 4 ? '#ffd93b' : lv >= 2 ? '#ffffff' : '#fff6c8');
  fx.shake(0.6 + lv * 0.25);
  const words = CLEAR_WORDS[lv];
  fx.banner(words[combo % words.length], lv >= 3 ? 'rainbow' : 'gold', combo >= 2 ? `${combo}コンボ` : undefined);
  fx.floatText(card.x, card.y + 40, `+${formatDopa(points)}ドパ`, true);
  play('clear', { level: lv });
  setMascot((m) => ({
    expression: lv >= 5 ? 'fever' : lv >= 3 ? 'wow' : 'happy',
    motion: lv >= 3 ? 'dance' : lv >= 1 ? 'spin' : 'jump',
    key: m.key + 1,
  }));
  setBubble(combo >= 2 ? `${combo}コンボ！ ドパ×${formatDopa(getMultiplier(combo, fever))}` : 'その調子モル！');
}

/** 答えが 67 のときの特別演出（専用 BGM つき） */
function celebrateSixSeven(cardElement: HTMLElement | null, setBubble: (text: string) => void) {
  const card = centerOf(cardElement);
  playSixSeven();
  setBubble('シックスセブン!! 67だモル!!');
  window.setTimeout(() => {
    fx.cutIn('シックスセブン!!', '67 がでた!! ドパ大放出!!');
    fx.rain(['coin', 'moru', 'star', 'heart', 'confetti'], 140, 3500);
    fx.burst({ x: card.x, y: card.y, count: 160, kinds: ['coin', 'star', 'heart', 'moru', 'spark'], power: 1.8 });
  }, 250);
  // 「6」と「7」の数字が左右からドーン
  window.setTimeout(() => {
    fx.floatText(window.innerWidth * 0.3, window.innerHeight * 0.35, '6', true);
    fx.shake(1.4);
  }, 700);
  window.setTimeout(() => {
    fx.floatText(window.innerWidth * 0.7, window.innerHeight * 0.35, '7', true);
    fx.flash('#ff5fa2');
    fx.shake(1.6);
  }, 1100);
}

/** 段階が上がったときの「チャンス!!」演出 */
function announceLevelUp(lv: number) {
  window.setTimeout(() => {
    if (lv === 2) {
      fx.banner('チャンス到来!!', 'gold', 'ドパ倍率アップ');
      play('levelUp');
    } else if (lv === 3) {
      fx.cutIn('モルモルチャンス!!', 'コインが降ってくる!!');
      play('cutIn');
    } else if (lv === 4) {
      fx.cutIn('激アツ確定!!', 'ドパドパタイム突入!!');
      play('cutIn');
    }
  }, 650);
}
