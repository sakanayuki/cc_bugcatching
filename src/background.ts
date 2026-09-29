// 夏の雑木林の背景。時間帯ごとに 1 枚ずつオフスクリーンに描いておき、切替時はクロスフェードする。
// 質感（葉のまだら模様・樹皮の筋・落ち葉など）はピクセル単位で描くため、画素バッファに描いてから Canvas へ転送する。
import { TERRAIN, VIEW } from './config';
import { mixColor, type Phase } from './phase';
import { createRng, pick, randInt, range, type Rng } from './rng';
import type { Trunk, World } from './world';

type Rgb = readonly [number, number, number];

interface Palette {
  skyTop: string;
  skyBottom: string;
  /** 遠景の木々（奥 → 手前） */
  farTree: string;
  nearTree: string;
  /** 奥に並ぶ幹のシルエット */
  bgTrunk: string;
  /** 枝葉の濃淡（暗 → 明）。0 は輪郭・最も深い影 */
  leaf: string[];
  /** 葉の間に見える枝 */
  twig: string;
  /** 低木の濃淡（暗 → 明） */
  shrub: string[];
  /** 樹皮の濃淡（暗 → 明） */
  bark: string[];
  /** 地面（林床）の濃淡 */
  floor: string[];
  grass: string[];
  litter: string[];
  moss: string[];
  stone: string[];
  soil: string;
  soilDark: string;
  flowers: string[];
}

export const PALETTES: Record<Phase, Palette> = {
  day: {
    skyTop: '#8cc4e8',
    skyBottom: '#d8ece6',
    farTree: '#9cb8a0',
    nearTree: '#7a9a80',
    bgTrunk: '#4a5c4c',
    leaf: ['#1c2a20', '#2c4230', '#405c42', '#5a7954', '#7c9870'],
    twig: '#6a6a60',
    shrub: ['#1c2a1e', '#2c4230', '#43604a', '#5d7b5e', '#81997b'],
    bark: ['#1a1614', '#2c2622', '#433c36', '#5e564d'],
    floor: ['#4c5634', '#5c683e', '#6c794a'],
    grass: ['#3a5630', '#557a3c', '#7c9c56'],
    litter: ['#b8743a', '#8e5c32', '#c8904a'],
    moss: ['#5e7a34', '#78944a'],
    stone: ['#6e7068', '#9c9e94'],
    soil: '#6a5236',
    soilDark: '#4a3824',
    flowers: ['#f4a0b8', '#ffffff', '#f0d860', '#b8a0f0'],
  },
  dusk: {
    skyTop: '#5a4a8c',
    skyBottom: '#f4a456',
    farTree: '#9a7478',
    nearTree: '#7a5a5e',
    bgTrunk: '#4a3a3c',
    leaf: ['#16140e', '#26261a', '#3c3c24', '#57532e', '#80743a'],
    twig: '#6a5448',
    shrub: ['#16140e', '#28281a', '#3e3e24', '#5a5630', '#827840'],
    bark: ['#140e0c', '#261a14', '#3e2a20', '#8a5230'],
    floor: ['#403424', '#50422c', '#605034'],
    grass: ['#40401e', '#5c5a2a', '#847838'],
    litter: ['#c8783a', '#8e4e2a', '#e09a4a'],
    moss: ['#80802e', '#a8a040'],
    stone: ['#5e524c', '#8a766a'],
    soil: '#5a3c26',
    soilDark: '#3c281a',
    flowers: ['#e88090', '#f8e0c0', '#f0b040', '#a07ad0'],
  },
  night: {
    skyTop: '#081030',
    skyBottom: '#23386a',
    farTree: '#1e2e4e',
    nearTree: '#16243c',
    bgTrunk: '#141e2a',
    leaf: ['#08100f', '#0f1c1c', '#18302c', '#244238', '#36584a'],
    twig: '#3a4450',
    shrub: ['#08100f', '#10201e', '#1a322e', '#26463c', '#385c4e'],
    bark: ['#0c0a10', '#18161c', '#26242c', '#4a485c'],
    floor: ['#161c1e', '#1e2628', '#263032'],
    grass: ['#162a26', '#223c36', '#325448'],
    litter: ['#4a3a38', '#3a2e2e', '#5a4a44'],
    moss: ['#264232', '#365a44'],
    stone: ['#343844', '#4c5266'],
    soil: '#221c20',
    soilDark: '#161216',
    flowers: ['#8a7aa0', '#c8c8e0', '#a8a070', '#6a6aa0'],
  },
};

/** 画面端の単色の行数（上下の余白へ延長する行） */
const EDGE_ROWS = 2;

function rgb(hex: string): Rgb {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
}

/** 画素バッファ。描き終えたら 1 回で Canvas へ転送する */
class Pix {
  readonly data: Uint8ClampedArray<ArrayBuffer>;
  private cache = new Map<string, Rgb>();

  constructor(
    readonly w: number,
    readonly h: number,
  ) {
    this.data = new Uint8ClampedArray(w * h * 4);
  }

  private color(hex: string): Rgb {
    let c = this.cache.get(hex);
    if (!c) {
      c = rgb(hex);
      this.cache.set(hex, c);
    }
    return c;
  }

  set(x: number, y: number, hex: string, alpha = 1): void {
    x = Math.round(x);
    y = Math.round(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = (y * this.w + x) * 4;
    const c = this.color(hex);
    const d = this.data;
    if (alpha >= 1) {
      d[i] = c[0];
      d[i + 1] = c[1];
      d[i + 2] = c[2];
    } else {
      d[i] = d[i]! + (c[0] - d[i]!) * alpha;
      d[i + 1] = d[i + 1]! + (c[1] - d[i + 1]!) * alpha;
      d[i + 2] = d[i + 2]! + (c[2] - d[i + 2]!) * alpha;
    }
    d[i + 3] = 255;
  }

  rect(x: number, y: number, w: number, h: number, hex: string, alpha = 1): void {
    const x0 = Math.max(0, Math.round(x));
    const y0 = Math.max(0, Math.round(y));
    const x1 = Math.min(this.w, Math.round(x + w));
    const y1 = Math.min(this.h, Math.round(y + h));
    for (let yy = y0; yy < y1; yy++) for (let xx = x0; xx < x1; xx++) this.set(xx, yy, hex, alpha);
  }

  circle(cx: number, cy: number, r: number, hex: string, alpha = 1): void {
    for (let dy = -Math.ceil(r); dy <= Math.ceil(r); dy++) {
      const half = Math.floor(Math.sqrt(Math.max(0, r * r - dy * dy)));
      for (let dx = -half; dx <= half; dx++) this.set(cx + dx, cy + dy, hex, alpha);
    }
  }

  /** 太さのある線（始点と終点で太さを変えられる） */
  line(x0: number, y0: number, x1: number, y1: number, w0: number, w1: number, hex: string): void {
    const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0)));
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const w = w0 + (w1 - w0) * t;
      const cx = x0 + (x1 - x0) * t;
      const cy = y0 + (y1 - y0) * t;
      if (w <= 1.2) this.set(cx, cy, hex);
      else this.circle(cx, cy, w / 2, hex);
    }
  }
}

/** 座標から決まる 0〜1 の乱数（同じ座標なら常に同じ値） */
function hash(x: number, y: number, seed: number): number {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(seed | 0, 982451653)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** なめらかなノイズ（まだら模様用） */
function noise(x: number, y: number, seed: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const fx = x - xi;
  const fy = y - yi;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const a = hash(xi, yi, seed);
  const b = hash(xi + 1, yi, seed);
  const c = hash(xi, yi + 1, seed);
  const d = hash(xi + 1, yi + 1, seed);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}

const clampIdx = (v: number, n: number) => Math.max(0, Math.min(n - 1, Math.floor(v)));

// ---- 空・遠景 ----

function drawSky(px: Pix, pal: Palette): void {
  const bottom = TERRAIN.groundTop;
  for (let y = 0; y < bottom; y++) {
    const t = y / bottom;
    for (let x = 0; x < px.w; x++) {
      // 縦方向のグラデーションを 12 段に量子化し、境目をディザでなじませる
      const q = t * 11 + (hash(x, y, 1) - 0.5) * 0.9;
      px.set(x, y, mixColor(pal.skyTop, pal.skyBottom, Math.max(0, Math.min(11, Math.round(q))) / 11));
    }
  }
}

function drawCelestial(px: Pix, phase: Phase, rng: Rng): void {
  const w = px.w;
  if (phase === 'day') {
    px.circle(w * 0.78, 60, 22, '#fffbe0', 0.6);
    px.circle(w * 0.78, 60, 15, '#fff8c8');
    px.circle(w * 0.78, 60, 10, '#ffffff');
  } else if (phase === 'dusk') {
    px.circle(w * 0.2, 300, 32, '#f8c070', 0.6);
    px.circle(w * 0.2, 300, 24, '#ffa850');
    px.circle(w * 0.2, 300, 16, '#ffd890');
  } else {
    for (let i = 0; i < Math.round(w / 5); i++) {
      px.set(range(rng, 0, w), range(rng, 0, 320), rng.next() < 0.7 ? '#ffffff' : '#a8b8f0');
    }
    px.circle(w * 0.74, 64, 19, '#3a4a78', 0.5);
    px.circle(w * 0.74, 64, 13, '#f4f0d0');
    px.circle(w * 0.74 + 6, 60, 11, '#23386a');
  }
}

/** 遠景の木々の輪郭（もこもこした横長のシルエット、ほのかなまだら） */
function drawTreeLine(px: Pix, color: string, baseY: number, minH: number, maxH: number, seed: number): void {
  const rng = createRng(seed);
  const shade = mixColor(color, '#000000', 0.12);
  let x = -20;
  while (x < px.w + 20) {
    const r = range(rng, 16, 30);
    const top = baseY - range(rng, minH, maxH);
    for (let yy = Math.floor(top); yy < baseY; yy++) {
      const dy = yy - (top + r);
      const half = dy < 0 ? Math.sqrt(Math.max(0, r * r - dy * dy)) : r;
      for (let xx = Math.floor(x - half); xx <= x + half; xx++) {
        px.set(xx, yy, noise(xx / 5, yy / 5, seed) > 0.62 ? shade : color);
      }
    }
    x += r * range(rng, 0.8, 1.3);
  }
}

/** 奥に並ぶ幹のシルエット（参考: 木々の間に見える平坦な暗い幹） */
function drawBackTrunks(px: Pix, pal: Palette, world: World, rng: Rng): void {
  const top = 0;
  const bottom = TERRAIN.groundTop + 2;
  for (let x = range(rng, 0, 30); x < px.w; x += range(rng, 34, 56)) {
    // 手前の幹と重なる場所は省く
    if (world.trunks.some((t) => Math.abs(t.x - x) < t.width)) continue;
    const w = range(rng, 8, 14);
    for (let y = top; y < bottom; y++) {
      const flare = y > bottom - 16 ? ((y - (bottom - 16)) / 16) ** 2 * 5 : 0;
      px.rect(x - w / 2 - flare, y, w + flare * 2, 1, pal.bgTrunk);
    }
  }
}

// ---- 地面 ----

function drawGround(px: Pix, pal: Palette, phase: Phase, world: World, seed: number): void {
  const top = TERRAIN.groundTop;
  const panel = TERRAIN.panelTop;
  const rng = createRng(seed);
  // 林床: まだらな濃淡
  for (let y = top; y < panel; y++) {
    for (let x = 0; x < px.w; x++) {
      const v = noise(x / 7, y / 3, seed) * 0.75 + hash(x, y, seed) * 0.35;
      px.set(x, y, pal.floor[clampIdx(v * 3 - 0.2, 3)]!);
    }
  }
  px.rect(0, top, px.w, 1, pal.floor[0]!);
  // 苔のかたまり
  for (let i = 0; i < px.w / 70; i++) {
    const cx = range(rng, 0, px.w);
    const cy = range(rng, top + 12, panel - 12);
    const r = range(rng, 2, 5);
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r * 1.6; dx <= r * 1.6; dx++) {
        if ((dx / 1.6) ** 2 + dy ** 2 > r * r * (0.7 + 0.3 * hash(dx, dy, seed + i))) continue;
        px.set(cx + dx, cy + dy, hash(cx + dx, cy + dy, seed) > 0.6 ? pal.moss[1]! : pal.moss[0]!);
      }
    }
  }
  // 夕方は幹から長い影、昼は木漏れ日
  if (phase === 'dusk') {
    for (const t of world.trunks) {
      for (let i = 0; i < 26; i++) px.rect(t.x - t.width / 2 + i * 6, top + 4 + i, t.width + 40, 1, '#1a0c10', 0.28);
    }
  } else if (phase === 'day') {
    const sun = createRng(seed + 1);
    for (let i = 0; i < px.w / 26; i++) {
      const x = range(sun, 0, px.w);
      const y = range(sun, top + 8, panel - 10);
      px.rect(x - 6, y, 12, 2, '#fff4c0', 0.2);
      px.rect(x - 4, y - 1, 8, 4, '#fff4c0', 0.2);
    }
  }
  // 落ち葉
  for (let i = 0; i < px.w * 0.35; i++) {
    const x = range(rng, 0, px.w);
    const y = range(rng, top + 4, panel - 3);
    const c = pick(rng, pal.litter);
    px.rect(x, y, 2, 1, c);
    if (rng.next() < 0.4) px.set(x + 1, y - 1, c);
  }
  // 小石
  for (let i = 0; i < px.w / 60; i++) {
    const x = range(rng, 0, px.w);
    const y = range(rng, top + 20, panel - 8);
    const w = randInt(rng, 3, 6);
    px.rect(x, y, w, 2, pal.stone[0]!);
    px.rect(x + 1, y - 1, w - 2, 1, pal.stone[1]!);
    px.rect(x, y + 2, w, 1, pal.floor[0]!);
  }
  // 草の房
  for (let i = 0; i < px.w * 0.5; i++) {
    const x = range(rng, 0, px.w);
    const y = range(rng, top + 3, panel - 2);
    const h = randInt(rng, 2, 5);
    const c = pal.grass[randInt(rng, 0, 2)]!;
    px.line(x, y, x - 1, y - h, 1, 1, c);
    px.line(x + 1, y, x + 2, y - h + 1, 1, 1, c);
  }
  // 小さな花
  for (let i = 0; i < px.w / 40; i++) {
    const c = pick(rng, pal.flowers);
    const x = range(rng, 0, px.w);
    const y = range(rng, top + 10, panel - 12);
    px.rect(x - 1, y, 3, 1, c);
    px.rect(x, y - 1, 1, 3, c);
  }
  // 手前の草むら（地面の縁）
  for (let x = 0; x < px.w; x += 2) {
    const h = randInt(rng, 3, 10);
    px.line(x, panel, x + range(rng, -2, 2), panel - h, 1, 1, pal.grass[0]!);
    if (rng.next() < 0.5) px.line(x + 1, panel, x + 1 + range(rng, -2, 2), panel - h + 2, 1, 1, pal.grass[1]!);
  }
  // 操作パネル（土）
  px.rect(0, panel, px.w, VIEW.height - panel, pal.soil);
  px.rect(0, panel, px.w, 2, pal.soilDark);
  for (let i = 0; i < px.w / 5; i++) {
    const x = range(rng, 0, px.w);
    const y = range(rng, panel + 4, VIEW.height);
    px.rect(x, y, randInt(rng, 1, 3), 1, rng.next() < 0.5 ? pal.soilDark : mixColor(pal.soil, '#ffffff', 0.15));
  }
}

// ---- 幹 ----

/** 幹と根。縦の樹皮の筋、光の当たる側の明るさ、根元の張り出しを描く */
function drawTrunk(px: Pix, pal: Palette, phase: Phase, t: Trunk, seed: number): void {
  const lightLeft = phase === 'dusk';
  const flareH = 34;
  const bark = pal.bark;
  // 幹は画面上端まで伸ばす（上の方は樹冠に隠れ、葉の隙間から見える）
  for (let y = 0; y < t.bottom; y++) {
    const f = y > t.bottom - flareH ? ((y - (t.bottom - flareH)) / flareH) ** 2.2 : 0;
    const half = t.width / 2 + f * t.width * 0.7;
    const left = t.x - half;
    for (let x = Math.floor(left); x <= t.x + half; x++) {
      let u = (x - left) / (half * 2); // 0 = 左端, 1 = 右端
      if (lightLeft) u = 1 - u;
      // 丸みの陰影（光は右から）
      let v = 0.25 + u * 0.9 - (u > 0.85 ? (u - 0.85) * 3 : 0);
      // 縦に伸びる樹皮の筋
      const streak = noise(x * 0.9, y * 0.06, seed);
      v += (streak - 0.5) * 0.9 + (hash(x, y, seed) - 0.5) * 0.25;
      if (x <= left + 1 || x >= t.x + half - 1) v = 0;
      px.set(x, y, bark[clampIdx(v * 3.2, bark.length)]!);
    }
  }
  // 地面に張る根
  const rng = createRng(seed + 7);
  for (const dir of [-1, 1]) {
    for (let k = 0; k < 2; k++) {
      const sx = t.x + dir * (t.width * 0.35 + k * 5);
      const sy = t.bottom - 10 - k * 4;
      const ex = sx + dir * range(rng, 14, 24);
      const ey = t.bottom + range(rng, 2, 8);
      px.line(sx, sy, ex, ey, 6 - k * 2, 1.5, bark[1]!);
      px.line(sx, sy - 1, ex, ey - 1, 3 - k, 1, bark[2]!);
    }
  }
  // 洞（樹液の出るところ）
  if (hash(t.x, 0, seed) < 0.7) {
    const y = t.top + 90 + hash(t.x, 1, seed) * 150;
    px.rect(t.x - 2, y, 4, 7, bark[0]!);
    px.rect(t.x - 1, y + 1, 2, 5, '#0a0806');
  }
}

/** 幹から樹冠へ伸びる太い枝 */
function drawBranches(px: Pix, pal: Palette, t: Trunk, rng: Rng): void {
  // 幹の上部から左右交互に、上端近くまで何段も枝を出す
  let side = rng.next() < 0.5 ? -1 : 1;
  for (let sy = t.top + range(rng, 30, 60); sy > 20; sy -= range(rng, 26, 40)) {
    for (const dir of [side, rng.next() < 0.5 ? -side : 0]) {
      if (dir === 0) continue;
      const ex = t.x + dir * range(rng, 36, 72);
      const ey = sy - range(rng, 20, 50);
      px.line(t.x + dir * t.width * 0.25, sy, ex, ey, 6, 2, pal.bark[1]!);
      px.line(t.x + dir * t.width * 0.25, sy - 1, ex, ey - 1, 3, 1, pal.bark[2]!);
      // 小枝
      const mx = (t.x + ex) / 2;
      const my = (sy + ey) / 2;
      px.line(mx, my, mx + dir * range(rng, 10, 20), my - range(rng, 8, 18), 2, 1, pal.bark[1]!);
    }
    side = -side;
  }
}

// ---- 枝葉 ----

/**
 * 葉の房: 暗い塊の上に、細かい葉を斜めに重ねて描く（参考: 針葉樹のような細かい枝葉）。
 * shade を下げると奥の房（暗め）になる。
 */
function leafClump(px: Pix, pal: Palette, cx: number, cy: number, s: number, shade: number, seed: number): void {
  const leaf = pal.leaf;
  const rx = s;
  const ry = s * 0.72;
  const inside = (x: number, y: number) => {
    const d = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2;
    return d < 0.75 + 0.45 * noise(x / 4, y / 4, seed);
  };
  // 暗い塊
  for (let y = Math.floor(cy - ry * 1.3); y <= cy + ry * 1.3; y++) {
    for (let x = Math.floor(cx - rx * 1.3); x <= cx + rx * 1.3; x++) {
      if (!inside(x, y)) continue;
      const low = (y - cy) / ry;
      px.set(x, y, low > 0.35 && hash(x, y, seed) < 0.6 ? leaf[0]! : leaf[1]!);
    }
  }
  // 葉の間に見える小枝
  const rng = createRng(seed);
  for (let i = 0; i < 3; i++) {
    const a = range(rng, Math.PI * 0.1, Math.PI * 0.9) * (rng.next() < 0.5 ? 1 : -1);
    px.line(cx, cy, cx + Math.cos(a) * s * 0.8, cy + Math.sin(a) * s * 0.5, 1, 1, pal.twig);
  }
  // 細かい葉（上ほど明るい）
  const count = Math.round(s * s * 0.5);
  for (let i = 0; i < count; i++) {
    const x = cx + range(rng, -rx, rx);
    const y = cy + range(rng, -ry, ry);
    if (!inside(x, y)) continue;
    const up = 1 - ((y - cy) / ry + 1) / 2; // 上端 1, 下端 0
    const v = up * 2.4 + shade + range(rng, -0.6, 0.6);
    const c = leaf[1 + clampIdx(v, leaf.length - 1)]!;
    const dir = x < cx ? -1 : 1;
    const len = randInt(rng, 2, 4);
    for (let k = 0; k < len; k++) px.set(x + dir * k * 0.8, y + k * 0.7, c);
  }
  // ふちからはみ出す葉先（とげとげした輪郭）
  const tips = Math.round(s * 2.2);
  for (let i = 0; i < tips; i++) {
    const a = range(rng, 0, Math.PI * 2);
    const ex = cx + Math.cos(a) * rx * range(rng, 0.85, 1.25);
    const ey = cy + Math.sin(a) * ry * range(rng, 0.85, 1.3);
    const sx = cx + Math.cos(a) * rx * 0.6;
    const sy = cy + Math.sin(a) * ry * 0.6;
    const up = Math.sin(a) < 0;
    px.line(sx, sy, ex, ey + 2, 1, 1, leaf[up ? 3 : 1]!);
    // 葉先から左右に小さく分かれる
    px.set(ex - 1, ey + 1, leaf[up ? 2 : 1]!);
    px.set(ex + 1, ey + 1, leaf[up ? 2 : 1]!);
  }
}

/** 1 本の木の樹冠。奥の房から手前の房へ重ねる */
function drawCrown(px: Pix, pal: Palette, t: Trunk, seed: number): void {
  const rng = createRng(seed);
  const clumps: { x: number; y: number; s: number; shade: number }[] = [];
  // 樹冠は幹の上端付近から画面上端まで。上ほど横に広がる
  const bottom = t.top + 40;
  for (let layer = 0; layer < 3; layer++) {
    const n = randInt(rng, 9, 11);
    for (let i = 0; i < n; i++) {
      const y = range(rng, -8, bottom) + layer * 10;
      const spread = 50 + 45 * (1 - y / bottom);
      clumps.push({
        x: t.x + range(rng, -spread, spread) * (1 - layer * 0.12),
        y,
        s: range(rng, 20, 34),
        shade: layer * 0.45 - 0.5,
      });
    }
  }
  clumps.forEach((c, i) => leafClump(px, pal, c.x, c.y, c.s, c.shade, seed + i * 31));
}

/** 奥のかすんだ樹冠（奥の幹の上を覆い、空の抜けを減らす） */
function drawBackCanopy(px: Pix, pal: Palette, seed: number): void {
  const haze: Palette = {
    ...pal,
    leaf: pal.leaf.map((c) => mixColor(c, pal.skyBottom, 0.42)),
    twig: mixColor(pal.twig, pal.skyBottom, 0.42),
  };
  const rng = createRng(seed);
  let x = -20;
  let i = 0;
  while (x < px.w + 30) {
    const s = range(rng, 22, 34);
    leafClump(px, haze, x, range(rng, 0, 150), s, -0.3, seed + i++ * 23);
    x += s * range(rng, 0.9, 1.5);
  }
}

// ---- 低木 ----

/**
 * 丸い塊（参考: 輪郭線のある丸い葉の塊が重なった低木）。
 * 左上から光が当たり、細かいまだら模様がある。
 */
function mound(px: Pix, tones: string[], cx: number, cy: number, r: number, seed: number): void {
  for (let y = Math.floor(cy - r - 1); y <= cy + r + 1; y++) {
    for (let x = Math.floor(cx - r - 1); x <= cx + r + 1; x++) {
      const nx = (x - cx) / r;
      const ny = (y - cy) / r;
      const d = Math.hypot(nx, ny);
      const edge = 1 - 0.07 * hash(x >> 1, y >> 1, seed);
      if (d > edge) continue;
      if (d > edge - 1.4 / r) {
        px.set(x, y, tones[0]!);
        continue;
      }
      const lit = -(nx * 0.55 + ny * 0.85);
      const v =
        0.55 + 0.34 * lit - 0.28 * d * d + (noise(x / 2.5, y / 2.5, seed) - 0.5) * 0.55 + (hash(x, y, seed) - 0.5) * 0.2;
      px.set(x, y, tones[1 + clampIdx(v * 4, tones.length - 1)]!);
    }
  }
}

/** 低木の茂み: 奥の小さな塊 → 手前の大きな塊の順に重ね、根元に草と土を描く */
function drawShrubs(px: Pix, pal: Palette, seed: number): void {
  const rng = createRng(seed);
  const base = TERRAIN.groundTop + 14;
  let x = range(rng, -20, 10);
  let i = 0;
  while (x < px.w + 30) {
    const width = range(rng, 40, 80);
    const mounds: { x: number; y: number; r: number }[] = [];
    // 上段（奥）
    for (let k = 0; k < randInt(rng, 1, 3); k++) {
      const r = range(rng, 11, 15);
      mounds.push({ x: x + range(rng, 0.15, 0.85) * width, y: base - r * 1.9 - range(rng, 0, 6), r });
    }
    // 下段（手前）
    for (let bx = x; bx < x + width; ) {
      const r = range(rng, 13, 19);
      mounds.push({ x: bx + r * 0.6, y: base - r * 0.75, r });
      bx += r * range(rng, 1.1, 1.5);
    }
    mounds.sort((a, b) => a.y + a.r - (b.y + b.r));
    for (const m of mounds) mound(px, pal.shrub, m.x, m.y, m.r, seed + i++ * 13);
    // 根元の土と草
    for (let gx = x; gx < x + width + 10; gx++) {
      if (rng.next() < 0.6) px.set(gx, base + 1, pal.floor[0]!);
      if (rng.next() < 0.08) {
        const h = randInt(rng, 2, 4);
        px.line(gx, base + 1, gx - 1, base + 1 - h, 1, 1, pal.grass[1]!);
        px.line(gx + 1, base + 1, gx + 2, base + 2 - h, 1, 1, pal.grass[2]!);
      }
    }
    x += width + range(rng, 20, 70);
  }
}

/** 1 つの時間帯の背景を描く（幅ごと・時間帯ごとに同じ配置になる） */
export function renderBackground(ctx: CanvasRenderingContext2D, world: World, phase: Phase): void {
  const pal = PALETTES[phase];
  const px = new Pix(world.width, VIEW.height);
  const s = world.seed;
  drawSky(px, pal);
  drawCelestial(px, phase, createRng(s + 7));
  drawTreeLine(px, pal.farTree, TERRAIN.groundTop, 150, 220, s);
  drawTreeLine(px, pal.nearTree, TERRAIN.groundTop, 70, 140, s + 1);
  drawBackTrunks(px, pal, world, createRng(s + 8));
  drawBackCanopy(px, pal, s + 12);
  drawGround(px, pal, phase, world, s + 5);
  const branchRng = createRng(s + 9);
  world.trunks.forEach((t, i) => {
    drawTrunk(px, pal, phase, t, s + 3 + i * 101);
    drawBranches(px, pal, t, branchRng);
  });
  world.trunks.forEach((t, i) => drawCrown(px, pal, t, s + 2 + i * 211));
  drawShrubs(px, pal, s + 4);
  // 上下の余白へ延長する端の行は単色にしておく
  px.rect(0, 0, px.w, EDGE_ROWS, pal.leaf[1]!);
  px.rect(0, VIEW.height - EDGE_ROWS, px.w, EDGE_ROWS, pal.soil);
  ctx.putImageData(new ImageData(px.data, px.w, px.h), 0, 0);
}

export type Backgrounds = Record<Phase, HTMLCanvasElement>;

export function buildBackgrounds(world: World): Backgrounds {
  const make = (phase: Phase) => {
    const c = document.createElement('canvas');
    c.width = world.width;
    c.height = VIEW.height;
    renderBackground(c.getContext('2d')!, world, phase);
    return c;
  };
  return { day: make('day'), dusk: make('dusk'), night: make('night') };
}

/** ピクセル単位の塗りつぶし円（描画用） */
export function fillCircle(ctx: CanvasRenderingContext2D, color: string, cx: number, cy: number, r: number): void {
  ctx.fillStyle = color;
  const ri = Math.round(r);
  for (let dy = -ri; dy <= ri; dy++) {
    const half = Math.floor(Math.sqrt(r * r - dy * dy));
    ctx.fillRect(Math.round(cx) - half, Math.round(cy) + dy, half * 2 + 1, 1);
  }
}
