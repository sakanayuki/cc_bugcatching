import { BUG_SPRITES, HERO_SPRITE, MUTE_SPRITE, type SpriteDef } from './spriteData';

export interface BakedSprite {
  width: number;
  height: number;
  frames: HTMLCanvasElement[];
  /** 左右反転したフレーム（左向き） */
  flipped: HTMLCanvasElement[];
  /** 未捕獲表示用の影 */
  silhouette: HTMLCanvasElement;
}

function makeCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function paint(rows: string[], palette: Record<string, string>, override?: string): HTMLCanvasElement {
  const h = rows.length;
  const w = rows[0]!.length;
  const c = makeCanvas(w, h);
  const ctx = c.getContext('2d')!;
  for (let y = 0; y < h; y++) {
    const row = rows[y]!;
    for (let x = 0; x < w; x++) {
      const ch = row[x]!;
      if (ch === '.') continue;
      ctx.fillStyle = override ?? palette[ch]!;
      ctx.fillRect(x, y, 1, 1);
    }
  }
  return c;
}

function flip(src: HTMLCanvasElement): HTMLCanvasElement {
  const c = makeCanvas(src.width, src.height);
  const ctx = c.getContext('2d')!;
  ctx.translate(src.width, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(src, 0, 0);
  return c;
}

export function bake(def: SpriteDef): BakedSprite {
  const frames = def.frames.map((f) => paint(f, def.palette));
  return {
    width: frames[0]!.width,
    height: frames[0]!.height,
    frames,
    flipped: frames.map(flip),
    silhouette: paint(def.frames[0]!, def.palette, '#3c3c4e'),
  };
}

export interface Sprites {
  bugs: Record<string, BakedSprite>;
  hero: BakedSprite;
  mute: BakedSprite;
}

export function bakeAll(): Sprites {
  const bugs: Record<string, BakedSprite> = {};
  for (const [id, def] of Object.entries(BUG_SPRITES)) bugs[id] = bake(def);
  return { bugs, hero: bake(HERO_SPRITE), mute: bake(MUTE_SPRITE) };
}
