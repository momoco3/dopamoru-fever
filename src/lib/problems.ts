// 問題を作るファイルです。2桁のたし算・ひき算（筆算）。
import type { Operation, Problem } from '../types';

/** くり上がり・くり下がりのある問題の割合（多めにして筆算らしく） */
const CARRY_RATE = 0.7;

/** 答えが「67」になる問題（シックスセブン問題）が出る割合 */
export const SIX_SEVEN_RATE = 0.15;
export const SIX_SEVEN = 67;

/** previous: 1つ前の問題（67問題が2回続けて出ないようにする） */
export function createProblem(operation: Operation, random: () => number = Math.random, previous?: Problem): Problem {
  const op = operation === 'mix' ? (random() < 0.5 ? '+' : '-') : operation === 'add' ? '+' : '-';
  if (previous?.answer !== SIX_SEVEN && random() < SIX_SEVEN_RATE) return createSixSeven(op, random);
  return op === '+' ? createAddition(random) : createSubtraction(random);
}

/** 答えが 67 になる筆算。くり上がり・くり下がりの割合はふつうの問題と同じ */
function createSixSeven(op: '+' | '-', random: () => number): Problem {
  const withCarry = random() < CARRY_RATE;
  let top: number;
  let bottom: number;
  if (op === '+') {
    do {
      top = randomInt(random, 10, SIX_SEVEN - 10);
      bottom = SIX_SEVEN - top;
    } while (((top % 10) + (bottom % 10) >= 10) !== withCarry);
  } else {
    do {
      top = randomInt(random, SIX_SEVEN + 10, 99);
      bottom = top - SIX_SEVEN;
    } while (top % 10 < bottom % 10 !== withCarry);
  }
  return build(top, bottom, op);
}

function createAddition(random: () => number): Problem {
  const withCarry = random() < CARRY_RATE;
  let top: number;
  let bottom: number;
  do {
    top = randomInt(random, 10, 99);
    bottom = randomInt(random, 10, 99);
  } while (((top % 10) + (bottom % 10) >= 10) !== withCarry);
  return build(top, bottom, '+');
}

function createSubtraction(random: () => number): Problem {
  const withBorrow = random() < CARRY_RATE;
  let top: number;
  let bottom: number;
  do {
    top = randomInt(random, 21, 99);
    bottom = randomInt(random, 10, top - 1);
  } while (top % 10 < bottom % 10 !== withBorrow || top - bottom < 1);
  return build(top, bottom, '-');
}

function build(top: number, bottom: number, op: '+' | '-'): Problem {
  const answer = op === '+' ? top + bottom : top - bottom;
  const answerDigits = String(answer).split('').reverse().map(Number);
  return {
    top,
    bottom,
    op,
    answer,
    answerDigits,
    carry: op === '+' && (top % 10) + (bottom % 10) >= 10,
    borrow: op === '-' && top % 10 < bottom % 10,
  };
}

function randomInt(random: () => number, min: number, max: number) {
  return min + Math.floor(random() * (max - min + 1));
}

/** 位の名前（ヒント表示用） */
export const PLACE_NAMES = ['一の位', '十の位', '百の位'];
