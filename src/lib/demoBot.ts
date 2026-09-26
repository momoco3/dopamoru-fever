// プレイ動画の撮影用: URL に ?demo を付けると、指マークを出しながら自動でプレイします。
// 実際のボタンを押して操作するので、ふつうに遊んだときと同じ画面・音になります。

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const jitter = (min: number, max: number) => min + Math.random() * (max - min);

declare global {
  interface Window {
    __demoDone?: boolean;
  }
}

export function startDemoBot(): () => void {
  window.__soundLog = window.__soundLog ?? [];
  let stopped = false;

  const finger = document.createElement('div');
  finger.setAttribute('aria-hidden', 'true');
  Object.assign(finger.style, {
    position: 'fixed',
    zIndex: '100',
    left: '50%',
    top: '110%',
    width: '46px',
    height: '46px',
    marginLeft: '-23px',
    marginTop: '-23px',
    borderRadius: '50%',
    background: 'rgba(255,255,255,0.55)',
    border: '4px solid rgba(43,33,64,0.85)',
    boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
    pointerEvents: 'none',
    transition: 'left 0.16s ease-out, top 0.16s ease-out, transform 0.08s',
  } satisfies Partial<CSSStyleDeclaration>);
  document.body.appendChild(finger);

  const find = (selector: string) => document.querySelector<HTMLElement>(selector);
  const waitFor = async (selector: string, timeoutMs = 20000) => {
    const until = Date.now() + timeoutMs;
    while (!stopped && Date.now() < until) {
      const el = find(selector);
      if (el) return el;
      await wait(80);
    }
    return null;
  };

  const tap = async (el: HTMLElement | null, pointer = false) => {
    if (!el || stopped) return;
    const rect = el.getBoundingClientRect();
    finger.style.left = `${rect.left + rect.width / 2}px`;
    finger.style.top = `${rect.top + rect.height / 2}px`;
    await wait(170);
    finger.style.transform = 'scale(0.8)';
    el.classList.add('is-pressed');
    if (pointer) el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    else el.click();
    await wait(90);
    finger.style.transform = 'scale(1)';
    el.classList.remove('is-pressed');
  };

  /** 画面の筆算を読んで答えの数字（上の位から）を返す */
  const readAnswer = (): number[] | null => {
    const label = find('[aria-label*="たす"], [aria-label*="ひく"]')?.getAttribute('aria-label');
    const match = label?.match(/(\d+) (たす|ひく) (\d+)/);
    if (!match) return null;
    const answer = match[2] === 'たす' ? Number(match[1]) + Number(match[3]) : Number(match[1]) - Number(match[3]);
    return String(answer).split('').map(Number);
  };

  const solveLoop = async (fast: boolean, isOver: () => boolean) => {
    let solved = 0;
    while (!stopped && !isOver()) {
      const heading = find('[class*="number"]')?.textContent;
      const digits = readAnswer();
      if (!digits) {
        await wait(60);
        continue;
      }
      await wait(fast ? jitter(120, 220) : solved === 0 ? 900 : jitter(420, 650));
      // 一の位から入力
      for (const digit of [...digits].reverse()) {
        if (stopped || isOver()) return;
        await tap(find(`[data-key="${digit}"]`), true);
        await wait(fast ? jitter(60, 120) : jitter(200, 330));
      }
      solved += 1;
      // 次の問題に切り替わるまで待つ
      const until = Date.now() + 3000;
      while (!stopped && !isOver() && find('[class*="number"]')?.textContent === heading && Date.now() < until) await wait(50);
    }
  };

  void (async () => {
    await waitFor('[data-demo="start"]');
    await wait(1600);
    await tap(find('[data-demo="count-10"]'));
    await wait(450);
    await tap(find('[data-demo="op-mix"]'));
    await wait(700);
    await tap(find('[data-demo="start"]'));

    await solveLoop(false, () => !!find('[data-demo="extra"]') || document.body.textContent?.includes('結果発表') === true);
    const extra = await waitFor('[data-demo="extra"]', 12000);
    await wait(1800);
    await tap(extra);

    await wait(1500);
    await solveLoop(true, () => document.body.textContent?.includes('フィーバー終了') === true);
    await wait(4500);
    finger.style.top = '110%';
    // 途中で止められたロボット（開発モードで2回起動したとき等）は「終わった」ことにしない
    if (!stopped) window.__demoDone = true;
  })();

  return () => {
    stopped = true;
    finger.remove();
  };
}
