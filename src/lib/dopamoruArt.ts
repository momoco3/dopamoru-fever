// マスコット「ドパモル」（モルモット）の絵です。SVG で描いています。
// 表情を変えたいときや色を変えたいときはここを編集してください。

export type Expression = 'normal' | 'happy' | 'wow' | 'sad' | 'fever';

const INK = '#2b2140';
const COLORS = {
  body: '#fff6ea',
  orange: '#ffa54a',
  brown: '#8a5a3c',
  pink: '#ff8fb8',
  cheek: 'rgba(255,110,160,0.55)',
};

function eyes(expression: Expression): string {
  switch (expression) {
    case 'happy':
      // ^ ^
      return `<path d="M60 96 Q72 82 84 96" fill="none" stroke="${INK}" stroke-width="6" stroke-linecap="round"/>
              <path d="M116 96 Q128 82 140 96" fill="none" stroke="${INK}" stroke-width="6" stroke-linecap="round"/>`;
    case 'wow':
      // キラキラの星の目
      return [72, 128]
        .map((x) => `<path d="${starPath(x, 92, 15, 6.5)}" fill="#ffd93b" stroke="${INK}" stroke-width="3.5" stroke-linejoin="round"/>`)
        .join('');
    case 'fever':
      // ハートの目
      return [72, 128]
        .map(
          (x) =>
            `<path d="M${x} 102 C${x - 18} 90 ${x - 12} 76 ${x} 86 C${x + 12} 76 ${x + 18} 90 ${x} 102 Z" fill="#ff4f8b" stroke="${INK}" stroke-width="3.5" stroke-linejoin="round"/>`,
        )
        .join('');
    case 'sad':
      return `<path d="M62 88 L82 96 L62 104" fill="none" stroke="${INK}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M138 88 L118 96 L138 104" fill="none" stroke="${INK}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>`;
    default:
      return [72, 128]
        .map(
          (x) =>
            `<ellipse cx="${x}" cy="93" rx="10" ry="12" fill="${INK}"/><circle cx="${x - 3}" cy="88" r="4" fill="#fff"/><circle cx="${x + 4}" cy="98" r="2" fill="#fff"/>`,
        )
        .join('');
  }
}

function mouth(expression: Expression): string {
  if (expression === 'wow' || expression === 'fever') {
    return `<path d="M88 114 Q100 138 112 114 Z" fill="#e0445f" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>`;
  }
  if (expression === 'sad') {
    return `<path d="M90 122 Q100 114 110 122" fill="none" stroke="${INK}" stroke-width="4.5" stroke-linecap="round"/>`;
  }
  if (expression === 'happy') {
    return `<path d="M88 113 Q94 124 100 115 Q106 124 112 113" fill="#ff9fb3" stroke="${INK}" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/>`;
  }
  // ω
  return `<path d="M88 114 Q94 122 100 115 Q106 122 112 114" fill="none" stroke="${INK}" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/>`;
}

export function dopamoruSvg(expression: Expression = 'normal'): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 175">
  <defs>
    <clipPath id="dg-body"><path d="M18 108 C14 58 58 30 100 30 C142 30 186 58 182 108 C180 146 146 164 100 164 C54 164 20 146 18 108 Z"/></clipPath>
  </defs>
  <!-- 耳 -->
  <ellipse cx="46" cy="46" rx="18" ry="14" fill="${COLORS.orange}" stroke="${INK}" stroke-width="5"/>
  <ellipse cx="47" cy="47" rx="9" ry="6.5" fill="${COLORS.pink}"/>
  <ellipse cx="154" cy="46" rx="18" ry="14" fill="${COLORS.brown}" stroke="${INK}" stroke-width="5"/>
  <ellipse cx="153" cy="47" rx="9" ry="6.5" fill="${COLORS.pink}"/>
  <!-- 足 -->
  <ellipse cx="66" cy="164" rx="16" ry="9" fill="${COLORS.pink}" stroke="${INK}" stroke-width="4.5"/>
  <ellipse cx="134" cy="164" rx="16" ry="9" fill="${COLORS.pink}" stroke="${INK}" stroke-width="4.5"/>
  <!-- 体とぶち模様 -->
  <g clip-path="url(#dg-body)">
    <rect x="0" y="0" width="200" height="175" fill="${COLORS.body}"/>
    <ellipse cx="44" cy="62" rx="58" ry="44" fill="${COLORS.orange}"/>
    <ellipse cx="160" cy="58" rx="44" ry="36" fill="${COLORS.brown}"/>
    <ellipse cx="150" cy="150" rx="40" ry="22" fill="${COLORS.orange}" opacity="0.9"/>
    <ellipse cx="100" cy="36" rx="18" ry="12" fill="${COLORS.body}"/>
  </g>
  <path d="M18 108 C14 58 58 30 100 30 C142 30 186 58 182 108 C180 146 146 164 100 164 C54 164 20 146 18 108 Z" fill="none" stroke="${INK}" stroke-width="5.5"/>
  <!-- ほっぺ -->
  <ellipse cx="54" cy="116" rx="14" ry="9" fill="${COLORS.cheek}"/>
  <ellipse cx="146" cy="116" rx="14" ry="9" fill="${COLORS.cheek}"/>
  ${eyes(expression)}
  <!-- 鼻と口 -->
  <path d="M94 105 L106 105 L100 112 Z" fill="${COLORS.pink}" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>
  ${mouth(expression)}
  <!-- ひげ -->
  <path d="M40 104 L22 100 M40 110 L22 113 M160 104 L178 100 M160 110 L178 113" stroke="${INK}" stroke-width="2.5" stroke-linecap="round"/>
</svg>`;
}

export function dopamoruDataUrl(expression: Expression = 'normal'): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(dopamoruSvg(expression))}`;
}

function starPath(cx: number, cy: number, outer: number, inner: number): string {
  let d = '';
  for (let i = 0; i < 10; i++) {
    const r = i % 2 ? inner : outer;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    d += `${i ? 'L' : 'M'}${(cx + Math.cos(a) * r).toFixed(1)} ${(cy + Math.sin(a) * r).toFixed(1)} `;
  }
  return d + 'Z';
}
