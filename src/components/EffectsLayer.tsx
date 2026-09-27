// 画面全体にかぶさる演出レイヤー。
// ・キャンバス: 星・紙吹雪・コイン・ハート・ミニドパモルのパーティクル
// ・文字の演出: 「すごい!!」などのバナー、獲得ドパの浮かぶ数字、カットイン
// ・画面のフラッシュと揺れ、背景の回転する光線（レベル3以上）
import { useEffect, useRef, useState } from 'react';
import { dopamoruDataUrl } from '../lib/dopamoruArt';
import { subscribeFx, type BannerStyle, type BurstOptions, type ParticleKind } from '../lib/effects';
import styles from './EffectsLayer.module.css';

type Props = {
  reduceMotion: boolean;
  /** 揺らす対象の要素の id */
  shakeTargetId: string;
};

type Particle = {
  kind: ParticleKind;
  /** front = 画面の一番手前 / back = カードや数字キーの後ろ（数字が読めるように） */
  layer: 'front' | 'back';
  x: number;
  y: number;
  vx: number;
  vy: number;
  rotation: number;
  spin: number;
  size: number;
  life: number;
  maxLife: number;
  color: string;
  gravity: number;
  sprite: HTMLCanvasElement | HTMLImageElement;
};

type Banner = { id: number; text: string; style: BannerStyle; sub?: string };
type FloatText = { id: number; x: number; y: number; text: string; big: boolean };
type CutIn = { id: number; text: string; sub: string };

const PALETTE = ['#ff5fa2', '#ffd93b', '#4fd8ff', '#8b6bff', '#6cf08a', '#ff8a3d', '#ffffff'];
const MAX_PARTICLES = 900;
/** 画面全体のフラッシュは 0.5 秒に1回まで（光の点滅で気分が悪くならないように） */
const FLASH_MIN_INTERVAL_MS = 500;

export function EffectsLayer({ reduceMotion, shakeTargetId }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const backCanvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const ambientRef = useRef(-1);
  const reduceRef = useRef(reduceMotion);
  const lastFlashRef = useRef(0);
  const [banners, setBanners] = useState<Banner[]>([]);
  const [floats, setFloats] = useState<FloatText[]>([]);
  const [cutIn, setCutIn] = useState<CutIn | null>(null);
  const [flash, setFlash] = useState<{ id: number; color: string } | null>(null);
  const [ambient, setAmbient] = useState(-1);

  useEffect(() => {
    reduceRef.current = reduceMotion;
  }, [reduceMotion]);

  // ---- パーティクルの描画ループ ----
  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    const backCanvas = backCanvasRef.current!;
    const backCtx = backCanvas.getContext('2d')!;
    const sprites = createSprites();
    let rafId = 0;
    let last = performance.now();
    let rainCarry = 0;
    const rains: { kinds: ParticleKind[]; perSecond: number; until: number; carry: number }[] = [];

    const resize = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      for (const [c, g] of [
        [canvas, ctx],
        [backCanvas, backCtx],
      ] as const) {
        c.width = Math.round(window.innerWidth * dpr);
        c.height = Math.round(window.innerHeight * dpr);
        g.setTransform(dpr, 0, 0, dpr, 0, 0);
      }
    };
    resize();
    window.addEventListener('resize', resize);

    const spawn = (kind: ParticleKind, x: number, y: number, vx: number, vy: number, layer: 'front' | 'back' = 'back') => {
      const particles = particlesRef.current;
      if (particles.length >= MAX_PARTICLES) particles.shift();
      const color = PALETTE[Math.floor(Math.random() * PALETTE.length)];
      const size =
        kind === 'moru' ? 34 + Math.random() * 26 : kind === 'coin' ? 16 + Math.random() * 8 : kind === 'spark' ? 3 : 12 + Math.random() * 12;
      const maxLife = kind === 'spark' ? 0.45 + Math.random() * 0.3 : 1.1 + Math.random() * 0.9;
      particles.push({
        kind,
        // ミニドパモルは大きくて数字を隠してしまうので、いつも後ろ側
        layer: kind === 'moru' ? 'back' : layer,
        x,
        y,
        vx,
        vy,
        rotation: Math.random() * Math.PI * 2,
        spin: (Math.random() - 0.5) * (kind === 'moru' ? 6 : 14),
        size,
        life: maxLife,
        maxLife,
        color,
        gravity: kind === 'spark' ? 300 : kind === 'confetti' ? 420 : 900,
        sprite: sprites.get(kind, color),
      });
    };

    const burst = (o: BurstOptions) => {
      const count = Math.round(o.count * (reduceRef.current ? 0.3 : 1));
      const power = o.power ?? 1;
      for (let i = 0; i < count; i++) {
        const kind = o.kinds[i % o.kinds.length];
        const angle = o.fountain ? -Math.PI / 2 + (Math.random() - 0.5) * 1.3 : Math.random() * Math.PI * 2;
        const speed = (250 + Math.random() * 550) * power * (kind === 'spark' ? 1.4 : 1);
        spawn(kind, o.x, o.y, Math.cos(angle) * speed, Math.sin(angle) * speed - (o.fountain ? 200 : 120), o.fountain ? 'back' : 'front');
      }
    };

    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const width = window.innerWidth;
      const height = window.innerHeight;

      // 背景演出のレベルに応じて、上からコインや星が降り続ける
      const level = ambientRef.current;
      const ambientRate = reduceRef.current || level < 0 ? 0 : [1.5, 3, 6, 10, 16, 28][Math.min(5, level)];
      rainCarry += ambientRate * dt;
      while (rainCarry >= 1) {
        rainCarry -= 1;
        const kinds: ParticleKind[] =
          level >= 5 ? ['coin', 'star', 'moru', 'heart', 'confetti'] : level >= 3 ? ['coin', 'star', 'confetti', 'moru'] : ['coin', 'star', 'confetti'];
        spawn(kinds[Math.floor(Math.random() * kinds.length)], Math.random() * width, -40, (Math.random() - 0.5) * 80, 120 + Math.random() * 200);
      }
      for (let i = rains.length - 1; i >= 0; i--) {
        const rain = rains[i];
        rain.carry += rain.perSecond * dt;
        while (rain.carry >= 1) {
          rain.carry -= 1;
          spawn(rain.kinds[Math.floor(Math.random() * rain.kinds.length)], Math.random() * width, -50, (Math.random() - 0.5) * 120, 150 + Math.random() * 250);
        }
        if (now > rain.until) rains.splice(i, 1);
      }

      ctx.clearRect(0, 0, width, height);
      backCtx.clearRect(0, 0, width, height);
      const particles = particlesRef.current;
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.life -= dt;
        if (p.life <= 0 || p.y > height + 80) {
          particles.splice(i, 1);
          continue;
        }
        const drag = p.kind === 'confetti' ? 0.965 : 0.985;
        p.vx *= Math.pow(drag, dt * 60);
        p.vy = p.vy * Math.pow(drag, dt * 60) + p.gravity * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.rotation += p.spin * dt;
        const fade = Math.min(1, p.life / (p.maxLife * 0.35));
        const g = p.layer === 'front' ? ctx : backCtx;
        g.globalAlpha = fade;
        if (p.kind === 'spark') {
          g.globalCompositeOperation = 'lighter';
          g.strokeStyle = p.color;
          g.lineWidth = 3;
          g.beginPath();
          g.moveTo(p.x, p.y);
          g.lineTo(p.x - p.vx * 0.04, p.y - p.vy * 0.04);
          g.stroke();
          g.globalCompositeOperation = 'source-over';
          continue;
        }
        g.save();
        g.translate(p.x, p.y);
        g.rotate(p.rotation);
        if (p.kind === 'confetti') g.scale(1, Math.cos(p.rotation * 2.3));
        g.drawImage(p.sprite, -p.size / 2, -p.size / 2, p.size, p.size);
        g.restore();
      }
      ctx.globalAlpha = 1;
      backCtx.globalAlpha = 1;
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);

    // ---- 演出の命令を受け取る ----
    let nextId = 1;
    const unsubscribe = subscribeFx((event) => {
      switch (event.type) {
        case 'burst':
          burst(event.options);
          break;
        case 'rain':
          rains.push({
            kinds: event.kinds,
            perSecond: (event.count * (reduceRef.current ? 0.3 : 1)) / (event.durationMs / 1000),
            until: performance.now() + event.durationMs,
            carry: 0,
          });
          break;
        case 'banner': {
          const banner = { id: nextId++, text: event.text, style: event.style, sub: event.sub };
          setBanners((list) => [...list.slice(-1), banner]);
          window.setTimeout(() => setBanners((list) => list.filter((b) => b.id !== banner.id)), 1200);
          break;
        }
        case 'floatText': {
          const item = { id: nextId++, x: event.x, y: event.y, text: event.text, big: !!event.big };
          setFloats((list) => [...list.slice(-6), item]);
          window.setTimeout(() => setFloats((list) => list.filter((f) => f.id !== item.id)), 1100);
          break;
        }
        case 'flash': {
          if (reduceRef.current) break;
          const now = performance.now();
          if (now - lastFlashRef.current < FLASH_MIN_INTERVAL_MS) break;
          lastFlashRef.current = now;
          setFlash({ id: nextId++, color: event.color });
          break;
        }
        case 'shake': {
          if (reduceRef.current) break;
          const target = document.getElementById(shakeTargetId);
          const s = event.strength * 7;
          target?.animate(
            [
              { transform: 'translate(0, 0)' },
              { transform: `translate(${-s}px, ${s * 0.6}px) rotate(-0.6deg)` },
              { transform: `translate(${s}px, ${-s * 0.4}px) rotate(0.6deg)` },
              { transform: `translate(${-s * 0.6}px, ${-s * 0.5}px)` },
              { transform: `translate(${s * 0.4}px, ${s * 0.3}px)` },
              { transform: 'translate(0, 0)' },
            ],
            { duration: 320, easing: 'ease-out' },
          );
          break;
        }
        case 'cutIn': {
          const item = { id: nextId++, text: event.text, sub: event.sub };
          setCutIn(item);
          window.setTimeout(() => setCutIn((current) => (current?.id === item.id ? null : current)), 1500);
          break;
        }
        case 'ambient':
          ambientRef.current = event.level;
          setAmbient(event.level);
          break;
      }
    });

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', resize);
      unsubscribe();
    };
  }, [shakeTargetId]);

  return (
    <>
      {/* 背景の光線（コンテンツより後ろ） */}
      <div
        className={`${styles.rays} ${ambient >= 0 ? styles.raysSoft : ''} ${ambient >= 2 ? styles.raysOn : ''} ${ambient >= 3 ? styles.raysRainbow : ''} ${ambient >= 5 ? styles.raysFever : ''}`}
        aria-hidden="true"
      />
      {/* カードや数字キーの後ろを流れるパーティクル */}
      <canvas ref={backCanvasRef} className={styles.backCanvas} aria-hidden="true" />
      <div className={styles.overlay} aria-hidden="true">
        <canvas ref={canvasRef} className={styles.canvas} />
        {flash && <div key={flash.id} className={styles.flash} style={{ background: flash.color }} />}
        {floats.map((f) => (
          <span key={f.id} className={`${styles.float} ${f.big ? styles.floatBig : ''}`} style={{ left: f.x, top: f.y }}>
            {f.text}
          </span>
        ))}
        {banners.map((b) => (
          <div key={b.id} className={`${styles.banner} ${styles[b.style]}`}>
            <span className={styles.bannerText}>{b.text}</span>
            {b.sub && <span className={styles.bannerSub}>{b.sub}</span>}
          </div>
        ))}
        {cutIn && (
          <div key={cutIn.id} className={styles.cutIn}>
            <div className={styles.cutInBand}>
              <img src={dopamoruDataUrl('wow')} alt="" className={styles.cutInMoru} />
              <div className={styles.cutInTexts}>
                <span className={styles.cutInText}>{cutIn.text}</span>
                <span className={styles.cutInSub}>{cutIn.sub}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

// ---- パーティクルの絵（毎回描くと重いので、先に小さな画像にしておく） ----
function createSprites() {
  const cache = new Map<string, HTMLCanvasElement | HTMLImageElement>();
  const moru = new Image();
  moru.src = dopamoruDataUrl('happy');
  const moruFever = new Image();
  moruFever.src = dopamoruDataUrl('fever');

  const make = (draw: (g: CanvasRenderingContext2D) => void) => {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d')!;
    g.lineJoin = 'round';
    g.lineCap = 'round';
    draw(g);
    return c;
  };

  return {
    get(kind: ParticleKind, color: string): HTMLCanvasElement | HTMLImageElement {
      if (kind === 'moru') return Math.random() < 0.5 ? moru : moruFever;
      const key = `${kind}-${kind === 'coin' ? '' : color}`;
      const cached = cache.get(key);
      if (cached) return cached;
      let sprite: HTMLCanvasElement;
      if (kind === 'star') {
        sprite = make((g) => {
          g.beginPath();
          for (let i = 0; i < 10; i++) {
            const r = i % 2 ? 12 : 28;
            const a = -Math.PI / 2 + (i * Math.PI) / 5;
            g.lineTo(32 + Math.cos(a) * r, 33 + Math.sin(a) * r);
          }
          g.closePath();
          g.fillStyle = color;
          g.fill();
          g.lineWidth = 4;
          g.strokeStyle = '#2b2140';
          g.stroke();
        });
      } else if (kind === 'coin') {
        sprite = make((g) => {
          g.beginPath();
          g.arc(32, 32, 27, 0, Math.PI * 2);
          g.fillStyle = '#ffc93b';
          g.fill();
          g.lineWidth = 4;
          g.strokeStyle = '#2b2140';
          g.stroke();
          g.beginPath();
          g.arc(32, 32, 18, 0, Math.PI * 2);
          g.strokeStyle = '#e59a12';
          g.lineWidth = 4;
          g.stroke();
          g.fillStyle = '#fff6b0';
          g.beginPath();
          g.ellipse(24, 22, 6, 4, -0.6, 0, Math.PI * 2);
          g.fill();
        });
      } else if (kind === 'heart') {
        sprite = make((g) => {
          g.beginPath();
          g.moveTo(32, 54);
          g.bezierCurveTo(4, 36, 10, 8, 32, 22);
          g.bezierCurveTo(54, 8, 60, 36, 32, 54);
          g.fillStyle = color === '#ffffff' ? '#ff5fa2' : color;
          g.fill();
          g.lineWidth = 4;
          g.strokeStyle = '#2b2140';
          g.stroke();
        });
      } else {
        // 紙吹雪
        sprite = make((g) => {
          g.fillStyle = color;
          g.fillRect(18, 8, 28, 48);
        });
      }
      cache.set(key, sprite);
      return sprite;
    },
  };
}
