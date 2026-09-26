// タイトル画面。問題数と種類を選んで「はじめる」。
import { formatDopa, formatTime } from '../lib/score';
import { useEffect } from 'react';
import { play, setBgm } from '../lib/sound';
import type { Preferences, Records } from '../lib/storage';
import type { Operation, QuestionCount } from '../types';
import { Dopamoru } from './Dopamoru';
import styles from './TitleScreen.module.css';

type Props = {
  prefs: Preferences;
  records: Records;
  onChangePrefs: (patch: Partial<Preferences>) => void;
  onStart: () => void;
};

const COUNTS: QuestionCount[] = [5, 10, 20];
const OPERATIONS: { value: Operation; label: string }[] = [
  { value: 'add', label: 'たしざん' },
  { value: 'sub', label: 'ひきざん' },
  { value: 'mix', label: 'ミックス' },
];

export function TitleScreen({ prefs, records, onChangePrefs, onStart }: Props) {
  // メニューの BGM（音は最初にタップしたときから鳴ります）
  useEffect(() => setBgm('menu'), []);
  const bestTime = records.bestTime[String(prefs.count)];
  return (
    <main className={styles.screen}>
      <h1 className={styles.logo}>
        <span className={styles.logoMain}>
          {'ドパモル'.split('').map((c, i) => (
            <span key={i} style={{ animationDelay: `${i * 0.08}s` }}>
              {c}
            </span>
          ))}
        </span>
        <span className={styles.logoSub}>
          {'フィーバー'.split('').map((c, i) => (
            <span key={i} style={{ animationDelay: `${0.32 + i * 0.06}s` }}>
              {c}
            </span>
          ))}
        </span>
      </h1>

      <div className={styles.mascot}>
        <Dopamoru expression="happy" motion="idle" size={170} />
        <p className={styles.bubble}>ぜんぶ正解で フィーバーだモル！</p>
      </div>

      <section className={styles.options} aria-label="設定">
        <div className={styles.row} role="group" aria-label="問題数">
          {COUNTS.map((count) => (
            <button
              key={count}
              type="button"
              data-demo={`count-${count}`}
              className={`push-button ${styles.choice} ${prefs.count === count ? styles.selected : ''}`}
              aria-pressed={prefs.count === count}
              onClick={() => {
                play('tap');
                onChangePrefs({ count });
              }}
            >
              <span className={styles.choiceNumber}>{count}</span>問
            </button>
          ))}
        </div>
        <div className={styles.row} role="group" aria-label="問題の種類">
          {OPERATIONS.map((o) => (
            <button
              key={o.value}
              type="button"
              data-demo={`op-${o.value}`}
              className={`push-button ${styles.choice} ${styles.small} ${prefs.operation === o.value ? styles.selected : ''}`}
              aria-pressed={prefs.operation === o.value}
              onClick={() => {
                play('tap');
                onChangePrefs({ operation: o.value });
              }}
            >
              {o.label}
            </button>
          ))}
        </div>
      </section>

      <button type="button" data-demo="start" className={`push-button ${styles.start}`} onClick={onStart}>
        はじめる
      </button>

      <div className={styles.toggles}>
        <button
          type="button"
          className={`push-button ${styles.toggle}`}
          aria-pressed={prefs.sound}
          onClick={() => onChangePrefs({ sound: !prefs.sound })}
        >
          ♪ 音 <b>{prefs.sound ? 'オン' : 'オフ'}</b>
        </button>
        <button
          type="button"
          className={`push-button ${styles.toggle}`}
          aria-pressed={prefs.reduceMotion}
          onClick={() => onChangePrefs({ reduceMotion: !prefs.reduceMotion })}
        >
          ≋ 動きを弱める <b>{prefs.reduceMotion ? 'オン' : 'オフ'}</b>
        </button>
      </div>

      <dl className={styles.records}>
        <div>
          <dt>ベストドパ</dt>
          <dd>{records.bestDopa > 0 ? formatDopa(records.bestDopa) : '—'}</dd>
        </div>
        <div>
          <dt>{prefs.count}問ベスト</dt>
          <dd>{bestTime ? formatTime(bestTime) : '—'}</dd>
        </div>
        <div>
          <dt>フィーバー最高</dt>
          <dd>{records.bestFeverSolved > 0 ? `${records.bestFeverSolved}問` : '—'}</dd>
        </div>
      </dl>
      <p className={styles.hint}>数字キーでも操作できます</p>
    </main>
  );
}
