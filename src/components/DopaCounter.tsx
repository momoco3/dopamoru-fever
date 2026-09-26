// 「ドパ」の表示。増えるときはスロットのようにぐんぐん数字が上がります。
import { useEffect, useRef, useState } from 'react';
import { formatDopa } from '../lib/score';
import styles from './DopaCounter.module.css';

type Props = { value: number; level: number };

export function DopaCounter({ value, level }: Props) {
  const [shown, setShown] = useState(value);
  const shownRef = useRef(value);
  const [bump, setBump] = useState(0);

  useEffect(() => {
    if (value === shownRef.current) return;
    setBump((n) => n + 1);
    let rafId = 0;
    const tick = () => {
      const current = shownRef.current;
      // 桁が大きく違っても一瞬で追いつきすぎないよう、対数で近づける
      const next = current <= 0 ? value * 0.2 : current * Math.pow(value / current, 0.18);
      shownRef.current = Math.abs(next - value) / Math.max(1, value) < 0.002 ? value : next;
      setShown(shownRef.current);
      if (shownRef.current !== value) rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [value]);

  return (
    <div className={`${styles.counter} ${level >= 4 ? styles.rainbow : level >= 2 ? styles.hot : ''}`}>
      <span className={styles.label}>ドパ</span>
      <strong key={bump} className={styles.value}>
        {formatDopa(shown)}
      </strong>
    </div>
  );
}
