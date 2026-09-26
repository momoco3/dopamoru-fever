// 数字キー（大きめで押しやすく）。
import { play } from '../lib/sound';
import styles from './Keypad.module.css';

type Props = {
  onPress: (digit: number) => void;
  /** キーボードで押されたキー（押した見た目にする） */
  pressedKey: number | null;
  fever: boolean;
};

const ROWS = [
  [7, 8, 9],
  [4, 5, 6],
  [1, 2, 3],
];

export function Keypad({ onPress, pressedKey, fever }: Props) {
  const press = (digit: number) => {
    play('tap');
    onPress(digit);
  };
  return (
    <div className={`${styles.pad} ${fever ? styles.fever : ''}`} role="group" aria-label="数字キー">
      {ROWS.flat().map((digit) => (
        <button
          key={digit}
          type="button"
          data-key={digit}
          className={`push-button ${styles.key} ${pressedKey === digit ? 'is-pressed' : ''}`}
          onPointerDown={(event) => {
            // タップの反応を速くするため、pointerdown で入力する
            event.preventDefault();
            press(digit);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              press(digit);
            }
          }}
        >
          {digit}
        </button>
      ))}
      <button
        type="button"
        data-key={0}
        className={`push-button ${styles.key} ${styles.zero} ${pressedKey === 0 ? 'is-pressed' : ''}`}
        onPointerDown={(event) => {
          event.preventDefault();
          press(0);
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            press(0);
          }
        }}
      >
        0
      </button>
    </div>
  );
}
