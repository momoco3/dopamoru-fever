// BGM 用の音声ファイル（WAV など）を AAC（.m4a）に変換して public/bgm/ に保存するスクリプト（開発用）。
//
// 使い方:
//   1. 別のターミナルで `npm run dev` を起動しておく
//   2. node scripts/convert-bgm.mjs 入力.wav 出力名 [入力2.wav 出力名2 ...]
//      例: node scripts/convert-bgm.mjs melodicedm.wav game
//
// iPhone でも確実に鳴るよう、BGM は AAC にしています。変換には Chrome だけを使います。
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const APP_URL = process.env.APP_URL ?? 'http://localhost:5173/';
const CHROME =
  process.env.CHROME ??
  ['C:/Program Files/Google/Chrome/Application/chrome.exe', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome'].find(
    (p) => existsSync(p),
  );
const ROOT = resolve(import.meta.dirname, '..');
const OUT_DIR = join(ROOT, 'public', 'bgm');
const PORT = 9343;

const args = process.argv.slice(2);
if (args.length < 2 || args.length % 2) throw new Error('使い方: node scripts/convert-bgm.mjs 入力.wav 出力名 [...]');
if (!CHROME) throw new Error('Chrome が見つかりません。環境変数 CHROME にパスを指定してください');
mkdirSync(OUT_DIR, { recursive: true });

const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${join(tmpdir(), `dopamoru-bgm-${Date.now()}`)}`, 'about:blank'], {
  stdio: 'ignore',
});
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let wsUrl;
for (let i = 0; i < 50 && !wsUrl; i++) {
  try {
    const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
    wsUrl = list.find((t) => t.type === 'page')?.webSocketDebuggerUrl;
  } catch {}
  if (!wsUrl) await sleep(200);
}
const ws = new WebSocket(wsUrl);
await new Promise((r) => ws.addEventListener('open', r, { once: true }));
let id = 0;
const pending = new Map();
ws.addEventListener('message', (e) => {
  const m = JSON.parse(e.data);
  if (!m.id || !pending.has(m.id)) return;
  const { resolve, reject } = pending.get(m.id);
  pending.delete(m.id);
  if (m.error) reject(new Error(JSON.stringify(m.error)));
  else resolve(m.result);
});
const send = (method, params = {}) =>
  new Promise((resolve, reject) => {
    const n = ++id;
    pending.set(n, { resolve, reject });
    ws.send(JSON.stringify({ id: n, method, params }));
  });
const evaluate = async (expression) => {
  const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? JSON.stringify(r.exceptionDetails));
  return r.result.value;
};

try {
  await send('Page.navigate', { url: `${APP_URL}record.html` });
  for (let i = 0; i < 50 && !(await evaluate('window.encoderReady === true').catch(() => false)); i++) await sleep(200);
  for (let i = 0; i < args.length; i += 2) {
    const input = args[i];
    const name = args[i + 1];
    const base64 = readFileSync(input).toString('base64');
    const result = await evaluate(`window.encodeAac(${JSON.stringify(base64)})`);
    const output = join(OUT_DIR, `${name}.m4a`);
    writeFileSync(output, Buffer.from(result.m4a, 'base64'));
    console.log(`${input} → ${output}（${result.seconds.toFixed(3)} 秒）`);
  }
} finally {
  ws.close();
  chrome.kill();
}
