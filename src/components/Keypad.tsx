// 数字キー。スマホの電話・数字入力と同じ並び（1 2 3 / 4 5 6 / 7 8 9 / 0）。
import { play } from '../lib/sound';
import styles from './Keypad.module.css';

type Props = {
  onPress: (digit: number) => void;
  /** キーボードで押されたキー（押した見た目にする） */
  pressedKey: number | null;
  fever: boolean;
};

const DIGITS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 0];

export function Keypad({ onPress, pressedKey, fever }: Props) {
  const press = (digit: number) => {
    play('tap');
    onPress(digit);
  };
  return (
    <div className={`${styles.pad} ${fever ? styles.fever : ''}`} role="group" aria-label="数字キー">
      {DIGITS.map((digit) => (
        <button
          key={digit}
          type="button"
          data-key={digit}
          className={`push-button ${styles.key} ${digit === 0 ? styles.zero : ''} ${pressedKey === digit ? 'is-pressed' : ''}`}
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
    </div>
  );
}
