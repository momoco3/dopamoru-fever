// 結果発表の画面。100点ならエクストラテスト（フィーバー）に挑戦できます。
import { useEffect, useState } from 'react';
import { fx } from '../lib/effects';
import { formatDopa, formatTime } from '../lib/score';
import { play, setBgm } from '../lib/sound';
import type { FeverResult, GameResult } from '../types';
import { Dopamoru } from './Dopamoru';
import styles from './ResultScreen.module.css';

type Props =
  | { kind: 'normal'; result: GameResult; isBestDopa: boolean; isBestTime: boolean; onExtra: () => void; onRetry: () => void; onTitle: () => void }
  | { kind: 'fever'; result: FeverResult; isBest: boolean; onRetry: () => void; onTitle: () => void };

export function ResultScreen(props: Props) {
  const [revealed, setRevealed] = useState(false);
  const score = props.kind === 'normal' ? Math.round((props.result.perfectCount / props.result.config.count) * 100) : 0;
  const perfect = props.kind === 'normal' && score === 100;

  useEffect(() => {
    setBgm(null);
    play('drumroll');
    const timer = window.setTimeout(() => {
      setRevealed(true);
      setBgm('menu');
      const w = window.innerWidth;
      const h = window.innerHeight;
      if (props.kind === 'fever' || perfect) {
        play('perfect');
        fx.burst({ x: w / 2, y: h * 0.32, count: 160, kinds: ['star', 'coin', 'confetti', 'heart', 'moru'], power: 1.6 });
        fx.rain(['coin', 'star', 'confetti', 'moru'], 140, 2500);
        fx.flash('#ffd93b');
        fx.shake(1.2);
      } else {
        play('result');
        fx.burst({ x: w / 2, y: h * 0.32, count: 60, kinds: ['star', 'confetti'], power: 1.1 });
      }
    }, 1400);
    return () => clearTimeout(timer);
    // 画面を開いたときに1回だけ
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (props.kind === 'fever') {
    const { result } = props;
    return (
      <main className={`${styles.screen} ${styles.feverScreen}`}>
        <h1 className={styles.heading}>フィーバー終了!!</h1>
        <Dopamoru expression={revealed ? 'fever' : 'wow'} motion={revealed ? 'dance' : 'idle'} size={150} />
        <div className={`${styles.card} ${revealed ? styles.revealed : ''}`}>
          <p className={styles.bigLabel}>獲得ドパ</p>
          <p className={styles.bigDopa}>{revealed ? formatDopa(result.dopa) : '？？？'}</p>
          <dl className={styles.stats}>
            <Stat label="解いた問題" value={`${result.solved}問`} />
            <Stat label="最大コンボ" value={`${result.maxCombo}`} />
          </dl>
          {revealed && props.isBest && <p className={styles.newRecord}>🏆 フィーバー新記録！</p>}
        </div>
        <div className={styles.buttons}>
          <button type="button" className={`push-button ${styles.primary}`} onClick={props.onRetry}>
            もう一回テスト
          </button>
          <button type="button" className={`push-button ${styles.secondary}`} onClick={props.onTitle}>
            タイトルへ
          </button>
        </div>
      </main>
    );
  }

  const { result } = props;
  const reachedTarget = result.timeMs <= result.targetMs;
  return (
    <main className={styles.screen}>
      <h1 className={styles.heading}>結果発表</h1>
      <Dopamoru expression={!revealed ? 'normal' : perfect ? 'wow' : score >= 70 ? 'happy' : 'sad'} motion={revealed ? (perfect ? 'dance' : 'jump') : 'idle'} size={140} />
      <div className={`${styles.card} ${revealed ? styles.revealed : ''}`}>
        <p className={`${styles.score} ${perfect ? styles.scorePerfect : ''}`}>
          {revealed ? (
            <>
              {score}
              <small>点</small>
            </>
          ) : (
            '…'
          )}
        </p>
        <dl className={styles.stats}>
          <Stat label="ミスなし正解" value={`${result.perfectCount} / ${result.config.count}`} />
          <Stat label="ミス" value={`${result.misses}`} />
          <Stat label="タイム" value={formatTime(result.timeMs)} note={reachedTarget ? '目標達成!' : `目標 ${formatTime(result.targetMs)}`} />
          <Stat label="獲得ドパ" value={formatDopa(result.dopa)} />
        </dl>
        {revealed && (props.isBestDopa || props.isBestTime) && (
          <p className={styles.newRecord}>🏆 {props.isBestDopa ? 'ドパ' : 'タイム'}の新記録！</p>
        )}
      </div>
      <div className={styles.buttons}>
        {revealed && perfect && (
          <button type="button" data-demo="extra" className={`push-button ${styles.extra}`} onClick={props.onExtra}>
            <span>エクストラテスト</span>
            <small>100点のごほうび！ フィーバーに挑戦!!</small>
          </button>
        )}
        {revealed && !perfect && <p className={styles.hint}>ミスなしで100点を取ると、エクストラテストに挑戦できるモル！</p>}
        <button type="button" className={`push-button ${styles.primary}`} onClick={props.onRetry}>
          もう一回
        </button>
        <button type="button" className={`push-button ${styles.secondary}`} onClick={props.onTitle}>
          タイトルへ
        </button>
      </div>
    </main>
  );
}

function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className={styles.stat}>
      <dt>{label}</dt>
      <dd>{value}</dd>
      {note && <span className={styles.statNote}>{note}</span>}
    </div>
  );
}
