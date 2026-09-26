// プレイ動画を自動で撮影して docs/demo.mp4 に保存するスクリプト（開発用）。
//
// 使い方:
//   1. 別のターミナルで `npm run dev` を起動しておく
//   2. `node scripts/record-demo.mjs` を実行
//
// しくみ: Chrome を画面なしで起動 → ?demo 付きで開いて自動プレイ → 画面を連番で録画
//        → record.html で音をつけて MP4 にまとめる。追加のソフトは不要です（Chrome のみ）。
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { mkdirSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';

const APP_URL = process.env.APP_URL ?? 'http://localhost:5173/';
const CHROME =
  process.env.CHROME ??
  ['C:/Program Files/Google/Chrome/Application/chrome.exe', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome'].find(
    (p) => existsSync(p),
  );
const ROOT = resolve(import.meta.dirname, '..');
// 開発サーバーが見張っているフォルダに置くとページが再読み込みされるので、一時フォルダに置く
const FRAMES_DIR = join(tmpdir(), `dopamoru-frames-${Date.now()}`);
const FRAME_PORT = 9342;
const OUTPUT = join(ROOT, 'docs', 'demo.mp4');
const PORT = 9341;
const WIDTH = 390;
const HEIGHT = 844;

if (!CHROME) throw new Error('Chrome が見つかりません。環境変数 CHROME にパスを指定してください');
rmSync(FRAMES_DIR, { recursive: true, force: true });
mkdirSync(FRAMES_DIR, { recursive: true });

const profile = join(tmpdir(), `dopamoru-record-${Date.now()}`);
const chrome = spawn(
  CHROME,
  ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, '--no-first-run', '--hide-scrollbars', '--force-color-profile=srgb', '--autoplay-policy=no-user-gesture-required', 'about:blank'],
  { stdio: 'ignore' },
);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 録画した画像をエンコード用ページに渡すための小さなサーバー
const frameServer = createServer((req, res) => {
  const name = (req.url ?? '').replace(/^\/frames\//, '').replace(/[^0-9a-z.]/gi, '');
  try {
    res.writeHead(200, { 'Content-Type': 'image/jpeg', 'Access-Control-Allow-Origin': '*' });
    res.end(readFileSync(join(FRAMES_DIR, name)));
  } catch {
    res.writeHead(404, { 'Access-Control-Allow-Origin': '*' });
    res.end();
  }
}).listen(FRAME_PORT);

async function connect() {
  for (let i = 0; i < 50; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
      const page = list.find((t) => t.type === 'page');
      if (page) return page.webSocketDebuggerUrl;
    } catch {}
    await sleep(200);
  }
  throw new Error('Chrome に接続できませんでした');
}

const ws = new WebSocket(await connect());
await new Promise((r) => ws.addEventListener('open', r, { once: true }));
let id = 0;
const pending = new Map();
const handlers = new Map();
ws.addEventListener('message', (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) {
    const { resolve, reject } = pending.get(m.id);
    pending.delete(m.id);
    if (m.error) reject(new Error(JSON.stringify(m.error)));
    else resolve(m.result);
  } else if (m.method && handlers.has(m.method)) handlers.get(m.method)(m.params);
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
  await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: WIDTH, height: HEIGHT, deviceScaleFactor: 2, mobile: true });
  await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });

  // ---- 撮影 ----
  const frames = [];
  handlers.set('Page.screencastFrame', ({ data, metadata, sessionId }) => {
    const name = `${String(frames.length).padStart(5, '0')}.jpg`;
    writeFileSync(join(FRAMES_DIR, name), Buffer.from(data, 'base64'));
    frames.push({ url: `http://127.0.0.1:${FRAME_PORT}/frames/${name}`, time: metadata.timestamp * 1000 });
    void send('Page.screencastFrameAck', { sessionId });
  });

  await send('Page.navigate', { url: `${APP_URL}?demo` });
  await sleep(1500);
  await send('Page.startScreencast', { format: 'jpeg', quality: 88, maxWidth: WIDTH * 2, maxHeight: HEIGHT * 2, everyNthFrame: 1 });
  console.log('撮影中… (約1分)');
  const until = Date.now() + 150_000;
  while (Date.now() < until && !(await evaluate('window.__demoDone === true'))) await sleep(500);
  await send('Page.stopScreencast');
  const sounds = await evaluate('JSON.stringify(window.__soundLog ?? [])');
  console.log(`フレーム ${frames.length} 枚、効果音 ${JSON.parse(sounds).length} 件`);

  // ---- MP4 にまとめる ----
  await send('Page.navigate', { url: `${APP_URL}record.html` });
  for (let i = 0; i < 50 && !(await evaluate('window.encoderReady === true').catch(() => false)); i++) await sleep(200);
  console.log('エンコード中…');
  const base64 = await evaluate(`window.encodeDemo({ frames: ${JSON.stringify(frames)}, sounds: ${sounds}, fps: 30 })`);
  mkdirSync(join(ROOT, 'docs'), { recursive: true });
  writeFileSync(OUTPUT, Buffer.from(base64, 'base64'));
  console.log(`保存しました: ${OUTPUT}`);
} finally {
  ws.close();
  chrome.kill();
  frameServer.close();
  // KEEP_FRAMES=1 のときは確認用に連番画像を残す
  if (process.env.KEEP_FRAMES) console.log(`連番画像: ${FRAMES_DIR}`);
  else rmSync(FRAMES_DIR, { recursive: true, force: true });
}
