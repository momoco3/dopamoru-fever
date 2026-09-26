// マスコット「ドパモル」。表情（expression）と動き（motion）を切り替えられます。
import { useMemo } from 'react';
import { dopamoruDataUrl, type Expression } from '../lib/dopamoruArt';
import styles from './Dopamoru.module.css';

export type Motion = 'idle' | 'jump' | 'spin' | 'shake' | 'dance';

type Props = {
  expression?: Expression;
  motion?: Motion;
  /** 同じ motion をもう一度再生したいときに値を変える */
  motionKey?: number;
  size?: number;
  className?: string;
};

export function Dopamoru({ expression = 'normal', motion = 'idle', motionKey = 0, size = 120, className }: Props) {
  const src = useMemo(() => dopamoruDataUrl(expression), [expression]);
  return (
    <div className={`${styles.wrap} ${className ?? ''}`} style={{ width: size, height: size * 0.875 }}>
      <img key={`${motion}-${motionKey}`} src={src} alt="ドパモル" className={`${styles.img} ${styles[motion]}`} draggable={false} />
    </div>
  );
}
