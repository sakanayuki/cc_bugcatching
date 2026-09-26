// 夏の雑木林の背景。時間帯ごとに 1 枚ずつオフスクリーンに描いておき、切替時はクロスフェードする。
import { TERRAIN, VIEW } from './config';
import { mixColor, type Phase } from './phase';
import { createRng, range, randInt, pick, type Rng } from './rng';
import type { World } from './world';

interface Palette {
  skyTop: string;
  skyBottom: string;
  farTree: string;
  nearTree: string;
  canopy: string;
  canopyLight: string;
  canopyDark: string;
  trunk: string;
  trunkDark: string;
  trunkLight: string;
  shrub: string;
  shrubLight: string;
  grass: string;
  grassDark: string;
  grassLight: string;
  soil: string;
  soilDark: string;
  flowers: string[];
}

export const PALETTES: Record<Phase, Palette> = {
  day: {
    skyTop: '#4fa8ec',
    skyBottom: '#bfe8f8',
    farTree: '#8cc49a',
    nearTree: '#5f9e6a',
    canopy: '#3f8f3c',
    canopyLight: '#74c850',
    canopyDark: '#2a6a2e',
    trunk: '#6b4a2e',
    trunkDark: '#47301c',
    trunkLight: '#94704a',
    shrub: '#3a8a3a',
    shrubLight: '#62b448',
    grass: '#78c448',
    grassDark: '#57a236',
    grassLight: '#a8e070',
    soil: '#7a5a36',
    soilDark: '#5a4026',
    flowers: ['#f47aa0', '#ffffff', '#f8d840', '#b08cf0'],
  },
  dusk: {
    skyTop: '#5a4a8c',
    skyBottom: '#f8a452',
    farTree: '#9a6a6a',
    nearTree: '#6e4a4a',
    canopy: '#4e5a2a',
    canopyLight: '#8a8638',
    canopyDark: '#303618',
    trunk: '#553624',
    trunkDark: '#321e14',
    trunkLight: '#b0683a',
    shrub: '#4a5426',
    shrubLight: '#7e7a30',
    grass: '#8e8a38',
    grassDark: '#666226',
    grassLight: '#c0a848',
    soil: '#6a4428',
    soilDark: '#48301c',
    flowers: ['#e87080', '#f8e0c0', '#f0b040', '#a07ad0'],
  },
  night: {
    skyTop: '#081030',
    skyBottom: '#23386a',
    farTree: '#1e2e4e',
    nearTree: '#16243c',
    canopy: '#1a3a3a',
    canopyLight: '#2e5a52',
    canopyDark: '#0e2226',
    trunk: '#302a32',
    trunkDark: '#1a181e',
    trunkLight: '#57506a',
    shrub: '#1a3a36',
    shrubLight: '#2a5448',
    grass: '#2a4a3e',
    grassDark: '#1c3430',
    grassLight: '#3e6a56',
    soil: '#2a2428',
    soilDark: '#1a161a',
    flowers: ['#8a7aa0', '#c8c8e0', '#a8a070', '#6a6aa0'],
  },
};

type Ctx = CanvasRenderingContext2D;

/** 画面端の単色の行数 */
const EDGE_ROWS = 2;

function rect(ctx: Ctx, color: string, x: number, y: number, w: number, h: number): void {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

/** ピクセル単位の塗りつぶし円 */
export function fillCircle(ctx: Ctx, color: string, cx: number, cy: number, r: number): void {
  ctx.fillStyle = color;
  const ri = Math.round(r);
  for (let dy = -ri; dy <= ri; dy++) {
    const half = Math.floor(Math.sqrt(r * r - dy * dy));
    ctx.fillRect(Math.round(cx) - half, Math.round(cy) + dy, half * 2 + 1, 1);
  }
}

function drawSky(ctx: Ctx, pal: Palette, w: number): void {
  const bands = 12;
  const bottom = TERRAIN.groundTop;
  const bh = bottom / bands;
  for (let i = 0; i < bands; i++) {
    const c = mixColor(pal.skyTop, pal.skyBottom, i / (bands - 1));
    rect(ctx, c, 0, i * bh, w, bh + 1);
    // 境界をディザで馴染ませる
    if (i > 0) {
      const prev = mixColor(pal.skyTop, pal.skyBottom, (i - 1) / (bands - 1));
      ctx.fillStyle = prev;
      const y = Math.round(i * bh);
      for (let x = 0; x < w; x += 2) ctx.fillRect(x, y, 1, 1);
    }
  }
}

function drawCelestial(ctx: Ctx, phase: Phase, w: number, rng: Rng): void {
  if (phase === 'day') {
    const x = w * 0.78;
    fillCircle(ctx, '#fffbe0', x, 60, 22);
    fillCircle(ctx, '#fff6b0', x, 60, 17);
    fillCircle(ctx, '#ffffff', x, 60, 12);
  } else if (phase === 'dusk') {
    const x = w * 0.2;
    fillCircle(ctx, '#f8c070', x, 300, 30);
    fillCircle(ctx, '#ffa850', x, 300, 24);
    fillCircle(ctx, '#ffd890', x, 300, 16);
  } else {
    for (let i = 0; i < Math.round(w / 5); i++) {
      const c = rng.next() < 0.7 ? '#ffffff' : '#a8b8f0';
      rect(ctx, c, range(rng, 0, w), range(rng, 0, 320), 1, 1);
    }
    const x = w * 0.74;
    fillCircle(ctx, '#3a4a78', x, 64, 19);
    fillCircle(ctx, '#f4f0d0', x, 64, 13);
    fillCircle(ctx, '#23386a', x + 6, 60, 11);
  }
}

function drawTreeLine(ctx: Ctx, color: string, w: number, baseY: number, minH: number, maxH: number, rng: Rng): void {
  let x = -20;
  while (x < w + 20) {
    const r = range(rng, 18, 34);
    const top = baseY - range(rng, minH, maxH);
    fillCircle(ctx, color, x, top + r, r);
    rect(ctx, color, x - r, top + r, r * 2, baseY - top - r + 2);
    x += r * range(rng, 0.9, 1.4);
  }
}

function drawTrunk(ctx: Ctx, pal: Palette, phase: Phase, t: World['trunks'][number], rng: Rng): void {
  const left = Math.round(t.x - t.width / 2);
  rect(ctx, pal.trunk, left, t.top, t.width, t.bottom - t.top);
  // 光の当たる側（昼は右上から、夕方は左から）
  const lightLeft = phase === 'dusk';
  rect(ctx, pal.trunkDark, lightLeft ? left + t.width - 4 : left, t.top, 4, t.bottom - t.top);
  rect(ctx, pal.trunkLight, lightLeft ? left + 1 : left + t.width - 3, t.top, 2, t.bottom - t.top);
  // 樹皮の模様
  for (let i = 0; i < (t.bottom - t.top) / 7; i++) {
    const x = left + randInt(rng, 4, t.width - 5);
    const y = range(rng, t.top, t.bottom - 6);
    rect(ctx, pal.trunkDark, x, y, 1, randInt(rng, 3, 7));
  }
  // 樹液の出る洞
  if (rng.next() < 0.7) {
    const y = range(rng, t.top + 90, t.bottom - 80);
    rect(ctx, pal.trunkDark, left + t.width / 2 - 2, y, 4, 6);
  }
  // 根元
  rect(ctx, pal.trunk, left - 3, t.bottom - 6, t.width + 6, 6);
  rect(ctx, pal.trunkDark, left - 3, t.bottom - 2, t.width + 6, 2);
  // 枝
  for (const dir of [-1, 1]) {
    if (rng.next() < 0.35) continue;
    let bx = dir < 0 ? left : left + t.width;
    let by = t.top + range(rng, 20, 60);
    const len = randInt(rng, 16, 34);
    for (let i = 0; i < len; i++) {
      rect(ctx, pal.trunk, bx, by, 3, 3);
      bx += dir;
      if (i % 3 === 0) by -= 1;
    }
  }
}

function leafCluster(ctx: Ctx, pal: Palette, cx: number, cy: number, r: number, rng: Rng): void {
  fillCircle(ctx, pal.canopyDark, cx, cy + 2, r);
  fillCircle(ctx, pal.canopy, cx, cy, r - 1);
  // ハイライトと陰の点描
  for (let i = 0; i < r * 1.6; i++) {
    const a = range(rng, 0, Math.PI * 2);
    const d = range(rng, 0, r - 3);
    const x = cx + Math.cos(a) * d;
    const y = cy + Math.sin(a) * d;
    const upper = y < cy - r * 0.1;
    rect(ctx, upper ? pal.canopyLight : pal.canopyDark, x, y, 2, 2);
  }
}

function drawCanopy(ctx: Ctx, pal: Palette, world: World, rng: Rng): void {
  const w = world.width;
  // 上端の葉のつながり
  let x = -10;
  while (x < w + 20) {
    const r = range(rng, 16, 28);
    leafCluster(ctx, pal, x, range(rng, -8, 14), r, rng);
    x += r * range(rng, 1.2, 2.2);
  }
  for (const t of world.trunks) {
    const n = randInt(rng, 5, 7);
    for (let i = 0; i < n; i++) {
      const r = range(rng, 22, 38);
      leafCluster(ctx, pal, t.x + range(rng, -62, 62), t.top - range(rng, -18, 80), r, rng);
    }
  }
}

function drawShrubs(ctx: Ctx, pal: Palette, w: number, rng: Rng): void {
  let x = range(rng, -10, 20);
  const base = TERRAIN.groundTop + 10;
  while (x < w + 20) {
    const r = range(rng, 14, 26);
    fillCircle(ctx, pal.shrub, x, base - r * 0.6, r);
    for (let i = 0; i < r; i++) {
      const a = range(rng, Math.PI, Math.PI * 2);
      const d = range(rng, 2, r - 2);
      rect(ctx, pal.shrubLight, x + Math.cos(a) * d, base - r * 0.6 + Math.sin(a) * d, 2, 2);
    }
    // 花
    if (rng.next() < 0.6) {
      const c = pick(rng, pal.flowers);
      for (let i = 0; i < randInt(rng, 1, 3); i++) {
        const fx = x + range(rng, -r * 0.6, r * 0.6);
        const fy = base - r * range(rng, 0.6, 1.3);
        rect(ctx, c, fx - 1, fy, 3, 1);
        rect(ctx, c, fx, fy - 1, 1, 3);
        rect(ctx, '#f8e060', fx, fy, 1, 1);
      }
    }
    x += r * range(rng, 1.6, 3.2);
  }
}

function drawGround(ctx: Ctx, pal: Palette, phase: Phase, world: World, rng: Rng): void {
  const w = world.width;
  const top = TERRAIN.groundTop;
  const panel = TERRAIN.panelTop;
  rect(ctx, pal.grass, 0, top, w, panel - top);
  rect(ctx, pal.grassDark, 0, top, w, 2);
  // 夕方は幹から長い影
  if (phase === 'dusk') {
    ctx.globalAlpha = 0.28;
    for (const t of world.trunks) {
      for (let i = 0; i < 26; i++) {
        const y = top + 4 + i;
        rect(ctx, '#1a0c10', t.x - t.width / 2 + i * 6, y, t.width + 40, 1);
      }
    }
    ctx.globalAlpha = 1;
  } else if (phase === 'day') {
    // 木漏れ日（草の配置が時間帯で変わらないよう別の乱数を使う）
    const sun = createRng(world.seed + 6);
    ctx.globalAlpha = 0.22;
    for (let i = 0; i < w / 28; i++) {
      const x = range(sun, 0, w);
      const y = range(sun, top + 8, panel - 10);
      rect(ctx, '#fff8c0', x - 5, y, 10, 2);
      rect(ctx, '#fff8c0', x - 3, y - 1, 6, 4);
    }
    ctx.globalAlpha = 1;
  }
  // 草
  for (let i = 0; i < w * 0.9; i++) {
    const x = range(rng, 0, w);
    const y = range(rng, top + 2, panel - 4);
    const light = rng.next() < 0.5;
    rect(ctx, light ? pal.grassLight : pal.grassDark, x, y, 1, randInt(rng, 2, 4));
  }
  // 花
  for (let i = 0; i < w / 30; i++) {
    const c = pick(rng, pal.flowers);
    const x = range(rng, 0, w);
    const y = range(rng, top + 10, panel - 12);
    rect(ctx, c, x - 1, y, 3, 1);
    rect(ctx, c, x, y - 1, 1, 3);
  }
  // 手前の草むら（地面の縁）
  for (let x = 0; x < w; x += 3) {
    const h = randInt(rng, 3, 9);
    rect(ctx, pal.grassDark, x, panel - h, 2, h);
    rect(ctx, pal.grass, x + 1, panel - h + 2, 1, h - 2);
  }
  // 操作パネル（土）
  rect(ctx, pal.soil, 0, panel, w, VIEW.height - panel);
  rect(ctx, pal.soilDark, 0, panel, w, 2);
  for (let i = 0; i < w / 6; i++) {
    const x = range(rng, 0, w);
    const y = range(rng, panel + 4, VIEW.height);
    rect(ctx, rng.next() < 0.5 ? pal.soilDark : mixColor(pal.soil, '#ffffff', 0.15), x, y, randInt(rng, 1, 3), 1);
  }
}

/** 1 つの時間帯の背景を描く（幅ごと・時間帯ごとに同じ配置になる） */
export function renderBackground(ctx: Ctx, world: World, phase: Phase): void {
  const pal = PALETTES[phase];
  const w = world.width;
  // 配置は時間帯によらず同じになるよう、要素ごとに同じシードの乱数を使う
  drawSky(ctx, pal, w);
  drawCelestial(ctx, phase, w, createRng(world.seed + 7));
  drawTreeLine(ctx, pal.farTree, w, TERRAIN.groundTop, 150, 220, createRng(world.seed));
  drawTreeLine(ctx, pal.nearTree, w, TERRAIN.groundTop, 70, 140, createRng(world.seed + 1));
  drawGround(ctx, pal, phase, world, createRng(world.seed + 5));
  const trunkRng = createRng(world.seed + 3);
  for (const t of world.trunks) drawTrunk(ctx, pal, phase, t, trunkRng);
  drawCanopy(ctx, pal, world, createRng(world.seed + 2));
  drawShrubs(ctx, pal, w, createRng(world.seed + 4));
  // 上下の余白へ延長する端の行は単色にしておく
  rect(ctx, pal.canopyDark, 0, 0, w, EDGE_ROWS);
  rect(ctx, pal.soil, 0, VIEW.height - EDGE_ROWS, w, EDGE_ROWS);
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
