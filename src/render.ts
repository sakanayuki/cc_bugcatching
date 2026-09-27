// 描画。ロジックの状態を読み取って 1 フレームを描く。
import type { Backgrounds } from './background';
import { fillCircle } from './background';
import type { Bug } from './behavior';
import { SPECIES } from './bugs';
import { BUG_SCALE, CATCH, NET, SPAWN, RESULT_INPUT_DELAY, TERRAIN, TIME, UI, VIEW } from './config';
import type { Game } from './game';
import type { Layout } from './layout';
import { netPose, reachFor, ringCenter } from './net';
import { PHASES } from './phase';
import { HERO_FEET_ROW } from './spriteData';
import type { BakedSprite, Sprites } from './sprites';

type Ctx = CanvasRenderingContext2D;

/** 左右反転して描く横向きの虫 */
const SIDE_VIEW = new Set([
  'dangomushi',
  'tentoumushi',
  'batta',
  'kamakiri',
  'oniyanma',
  'shiokara',
  'akiakane',
  'koorogi',
  'suzumushi',
]);

/** 画面端のセーフエリア（内部座標） */
export interface Insets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

interface TextOpts {
  size?: number;
  color?: string;
  align?: CanvasTextAlign;
  outline?: string | null;
  baseline?: CanvasTextBaseline;
}

export function text(ctx: Ctx, str: string, x: number, y: number, opts: TextOpts = {}): void {
  const size = opts.size ?? 16;
  ctx.font = `${size}px ${UI.font}`;
  ctx.textAlign = opts.align ?? 'left';
  ctx.textBaseline = opts.baseline ?? 'top';
  const outline = opts.outline === undefined ? '#16121c' : opts.outline;
  const rx = Math.round(x);
  const ry = Math.round(y);
  if (outline) {
    ctx.fillStyle = outline;
    const o = size >= 32 ? 2 : 1;
    for (const [dx, dy] of [
      [-o, 0],
      [o, 0],
      [0, -o],
      [0, o],
      [-o, -o],
      [o, o],
      [-o, o],
      [o, -o],
    ] as const) {
      ctx.fillText(str, rx + dx, ry + dy);
    }
  }
  ctx.fillStyle = opts.color ?? '#ffffff';
  ctx.fillText(str, rx, ry);
}

/** ピクセル単位の線（柄の描画用） */
function pixelLine(ctx: Ctx, x0: number, y0: number, x1: number, y1: number, thick: number): void {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const n = Math.max(Math.abs(dx), Math.abs(dy));
  for (let i = 0; i <= n; i++) {
    const t = n === 0 ? 0 : i / n;
    ctx.fillRect(Math.round(x0 + dx * t - thick / 2), Math.round(y0 + dy * t - thick / 2), thick, thick);
  }
}

/** ピクセル単位の円の輪郭 */
function ringOutline(ctx: Ctx, color: string, cx: number, cy: number, r: number, thick = 1, dashed = false): void {
  ctx.fillStyle = color;
  const steps = Math.ceil(2 * Math.PI * r);
  for (let i = 0; i < steps; i++) {
    if (dashed && Math.floor(i / 4) % 2 === 1) continue;
    const a = (i / steps) * Math.PI * 2;
    ctx.fillRect(Math.round(cx + Math.cos(a) * r - thick / 2), Math.round(cy + Math.sin(a) * r - thick / 2), thick, thick);
  }
}

export class Renderer {
  constructor(
    private ctx: Ctx,
    private sprites: Sprites,
  ) {}

  private frame(sprite: BakedSprite, bug: Bug): HTMLCanvasElement {
    let i = 0;
    if (bug.flying) i = Math.floor(bug.age * 14) % 2;
    else if (bug.moving) i = Math.floor(bug.age * 6) % 2;
    const flip = SIDE_VIEW.has(bug.species.id) && bug.facing < 0;
    return (flip ? sprite.flipped : sprite.frames)[i]!;
  }

  private drawBug(bug: Bug, night: number, time: number): void {
    const ctx = this.ctx;
    const sp = this.sprites.bugs[bug.species.id]!;
    const w = sp.width * BUG_SCALE;
    const h = sp.height * BUG_SCALE;
    const x = Math.round(bug.x - w / 2);
    const y = Math.round(bug.y - h / 2);
    if (bug.species.id === 'hotaru') {
      const pulse = 0.5 + 0.5 * Math.sin(time * 4 + bug.uid);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = (0.25 + 0.45 * night) * (0.4 + 0.6 * pulse);
      fillCircle(ctx, '#6a7a10', bug.x, bug.y + 6, 24);
      fillCircle(ctx, '#a8b820', bug.x, bug.y + 6, 14);
      ctx.restore();
    }
    // 草むら・木の裏から現れる途中はフェードイン
    const alpha = bug.appear > 0 ? 1 - bug.appear / SPAWN.appearTime : 1;
    if (alpha < 1) {
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.drawImage(this.frame(sp, bug), x, y, w, h);
      ctx.restore();
    } else {
      ctx.drawImage(this.frame(sp, bug), x, y, w, h);
    }
  }

  private drawBugs(game: Game, time: number): void {
    const night = game.blend.night;
    const bugs = [...game.population.bugs].sort((a, b) => Number(a.flying) - Number(b.flying));
    for (const bug of bugs) this.drawBug(bug, night, time);
  }

  private drawNet(game: Game, time: number): { behind: boolean; draw: () => void } {
    const ctx = this.ctx;
    const pose = netPose(game.net);
    const pivot = game.pivot;
    const ring = ringCenter(pose, pivot.x, pivot.y);
    // 振りかぶって網が主人公の後ろ（下側）にあるときは主人公より先に描く
    const behind = pose.angle > 0;
    const draw = () => {
      const r = NET.ringRadius;
      const a = (pose.angle * Math.PI) / 180;
      const ex = ring.x - Math.cos(a) * (r + 1);
      const ey = ring.y - Math.sin(a) * (r + 1);
      ctx.fillStyle = '#3a2a14';
      pixelLine(ctx, pivot.x, pivot.y, ex, ey, 3);
      ctx.fillStyle = '#d8b068';
      pixelLine(ctx, pivot.x, pivot.y, ex, ey, 1);
      // 網の袋
      ctx.save();
      ctx.globalAlpha = 0.28;
      fillCircle(ctx, '#f0f4f8', ring.x, ring.y, r - 1);
      ctx.restore();
      if (game.caughtBug) {
        const sp = this.sprites.bugs[game.caughtBug.species.id]!;
        const wob = game.play === 'freeze' ? Math.round(Math.sin(time * 40)) : 0;
        const w = sp.width * BUG_SCALE;
        const h = sp.height * BUG_SCALE;
        ctx.drawImage(sp.frames[0]!, Math.round(ring.x - w / 2) + wob, Math.round(ring.y - h / 2), w, h);
      }
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      for (let i = -r + 3; i < r - 2; i += 4) {
        ctx.fillRect(Math.round(ring.x + i), Math.round(ring.y - r + 3), 1, r * 2 - 6);
      }
      ringOutline(ctx, '#2a2a30', ring.x, ring.y, r + 1, 2);
      const flash = game.play === 'freeze' && game.stateTime < 0.1;
      ringOutline(ctx, flash ? '#fff26a' : '#f4f4f0', ring.x, ring.y, r, 2);
    };
    return { behind, draw };
  }

  private drawHero(game: Game): void {
    const hero = this.sprites.hero;
    const n = game.net.kind;
    const swinging = n === 'swinging' || n === 'holding' || n === 'caught' || (n === 'recovering' && game.net.t < 0.1);
    const x = Math.round(game.world.width / 2 - hero.width / 2);
    const y = TERRAIN.heroFeetY - HERO_FEET_ROW;
    // 影
    this.ctx.save();
    this.ctx.globalAlpha = 0.25;
    this.ctx.fillStyle = '#000';
    this.ctx.fillRect(x + 3, TERRAIN.heroFeetY - 1, hero.width - 6, 3);
    this.ctx.restore();
    this.ctx.drawImage(hero.frames[swinging ? 1 : 0]!, x, y);
  }

  private drawAim(game: Game): void {
    if (game.net.kind !== 'charging') return;
    const ratio = game.charge;
    const pivot = game.pivot;
    const y = pivot.y - reachFor(ratio);
    const full = ratio >= 1;
    this.ctx.save();
    this.ctx.globalAlpha = full ? 0.85 : 0.55;
    ringOutline(this.ctx, full ? '#ffe040' : '#ffffff', pivot.x, y, NET.ringRadius, 1, true);
    this.ctx.fillStyle = full ? '#ffe040' : '#ffffff';
    this.ctx.fillRect(pivot.x - 1, y - 1, 3, 3);
    this.ctx.restore();
  }

  /** 1 フレーム描画 */
  draw(game: Game, layout: Layout, backgrounds: Backgrounds, insets: Insets, time: number): void {
    const ctx = this.ctx;
    const { canvasWidth: cw, canvasHeight: ch, offsetX: ox, offsetY: oy, viewWidth: vw } = layout;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#0c0a10';
    ctx.fillRect(0, 0, cw, ch);

    // 背景（時間帯のクロスフェード）
    const blend = game.blend;
    let first = true;
    for (const p of PHASES) {
      const w = blend[p];
      if (w <= 0.001) continue;
      ctx.globalAlpha = first ? 1 : w;
      ctx.drawImage(backgrounds[p], ox, oy);
      first = false;
    }
    ctx.globalAlpha = 1;
    // 上下の余白は端の色を延長
    if (oy > 0) {
      ctx.drawImage(ctx.canvas, ox, oy, vw, 1, ox, 0, vw, oy);
      const below = ch - oy - VIEW.height;
      if (below > 0) ctx.drawImage(ctx.canvas, ox, oy + VIEW.height - 1, vw, 1, ox, oy + VIEW.height, vw, below);
    }

    // ゲーム領域
    ctx.save();
    ctx.beginPath();
    ctx.rect(ox, 0, vw, ch);
    ctx.clip();
    const shake = game.scene === 'play' && game.play === 'freeze' && game.stateTime < 0.12 ? (Math.floor(time * 60) % 2 ? 1 : -1) : 0;
    ctx.translate(ox + shake, oy);
    this.drawBugs(game, time);
    if (game.scene !== 'result') {
      this.drawAim(game);
      const net = this.drawNet(game, time);
      if (net.behind) net.draw();
      this.drawHero(game);
      if (!net.behind) net.draw();
    }
    ctx.restore();

    // HUD
    const m = UI.margin;
    const top = Math.max(0, insets.top) + m;
    const left = ox + Math.max(0, insets.left - ox) + m;
    const right = ox + vw - Math.max(0, insets.right - (cw - ox - vw)) - m;
    const bottom = ch - Math.max(0, insets.bottom) - m;

    const ms = UI.muteSize;
    game.muteRect = { x: right - ms, y: top, w: ms, h: ms };
    ctx.save();
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = '#16121c';
    ctx.fillRect(right - ms, top, ms, ms);
    ctx.restore();
    const icon = this.sprites.mute;
    ctx.drawImage(icon.frames[game.muted ? 1 : 0]!, right - ms + (ms - icon.width) / 2 + 1, top + (ms - icon.height) / 2 + 1);

    switch (game.scene) {
      case 'title':
        this.drawTitle(game, layout, time);
        break;
      case 'play':
        this.drawPlayHud(game, left, right - ms - 8, top, time);
        this.drawButton(game, ox + vw / 2, bottom - UI.buttonRadius);
        if (game.play === 'get') this.drawGet(game, layout, time);
        if (game.play === 'paused') this.drawPaused(layout, time);
        break;
      case 'result':
        this.drawResult(game, layout, time);
        break;
    }
  }

  private drawPlayHud(game: Game, left: number, right: number, top: number, time: number): void {
    const sec = Math.ceil(game.remaining);
    const warn = sec <= TIME.warningTime;
    const blink = warn && Math.floor(time * 4) % 2 === 0;
    text(this.ctx, `のこり ${String(sec).padStart(2, ' ')}`, left, top + 4, { color: warn ? (blink ? '#ff5050' : '#ffd0d0') : '#ffffff' });
    const label = { day: 'ひる', dusk: 'ゆうがた', night: 'よる' }[game.phase];
    text(this.ctx, label, left, top + 24, { size: 12, color: '#f0f0c0' });
    text(this.ctx, `${game.score}pt`, right, top + 4, { align: 'right', color: '#fff6a0' });
  }

  private drawButton(game: Game, cx: number, cy: number): void {
    const ctx = this.ctx;
    const r = UI.buttonRadius;
    const pressed = game.net.kind === 'charging';
    const ready = game.net.kind === 'ready' || pressed;
    ctx.save();
    ctx.globalAlpha = 0.85;
    fillCircle(ctx, '#16121c', cx, cy + 2, r + 2);
    fillCircle(ctx, pressed ? '#c84a3a' : ready ? '#e8604a' : '#7a5a50', cx, cy, r);
    fillCircle(ctx, pressed ? '#a83a2e' : ready ? '#f88a6a' : '#8a6a60', cx, cy - 3, r - 6);
    ctx.restore();
    if (pressed) {
      // 溜め量のリング
      const ratio = game.charge;
      ctx.fillStyle = ratio >= 1 ? '#ffe040' : '#ffffff';
      const steps = Math.ceil(2 * Math.PI * (r + 5) * ratio);
      for (let i = 0; i < steps; i++) {
        const a = -Math.PI / 2 + (i / (2 * Math.PI * (r + 5))) * Math.PI * 2;
        ctx.fillRect(Math.round(cx + Math.cos(a) * (r + 5)) - 1, Math.round(cy + Math.sin(a) * (r + 5)) - 1, 3, 3);
      }
    }
    text(ctx, 'あみ', cx, cy - 8, { align: 'center', color: '#ffffff' });
  }

  private drawTitle(game: Game, layout: Layout, time: number): void {
    const ctx = this.ctx;
    const cx = layout.offsetX + layout.viewWidth / 2;
    const oy = layout.offsetY;
    ctx.save();
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = '#10141c';
    ctx.fillRect(layout.offsetX, oy + 150, layout.viewWidth, 110);
    ctx.restore();
    text(ctx, 'むしとり', cx, oy + 168, { size: 48, align: 'center', color: '#ffe46a', outline: '#3a2410' });
    text(ctx, 'なつの ぞうきばやし で むしを つかまえよう', cx, oy + 228, { size: 12, align: 'center' });
    if (Math.floor(time * 2) % 2 === 0) text(ctx, 'TAP TO START', cx, oy + 380, { align: 'center', size: 16 });
    text(ctx, `HI-SCORE ${game.highScore}pt`, cx, oy + 410, { align: 'center', color: '#fff6a0' });
    text(ctx, 'ながおしで ふりかぶり、はなして あみを ふる', cx, oy + 596, { size: 12, align: 'center' });
    text(ctx, 'ながく ためるほど とおくまで とどく', cx, oy + 614, { size: 12, align: 'center' });
  }

  private drawGet(game: Game, layout: Layout, time: number): void {
    const info = game.getInfo;
    if (!info) return;
    const ctx = this.ctx;
    const t = game.stateTime;
    const { offsetX: ox, offsetY: oy, viewWidth: vw, canvasHeight: ch } = layout;
    const cx = ox + vw / 2;
    const cy = oy + 260;
    ctx.save();
    ctx.globalAlpha = 0.45;
    ctx.fillStyle = '#0a0810';
    ctx.fillRect(ox, 0, vw, ch);
    ctx.restore();

    // 集中線（★3 以上）
    if (info.rarity >= 3) {
      const seed = Math.floor(time * 20);
      ctx.save();
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = info.rarity >= 4 ? '#fff0a0' : '#ffffff';
      for (let i = 0; i < 36; i++) {
        const a = (i / 36) * Math.PI * 2 + ((seed * 7 + i * 13) % 10) * 0.01;
        const r0 = 90 + ((seed + i * 5) % 7) * 6;
        const r1 = Math.max(vw, 640);
        const steps = 40;
        for (let s = 0; s < steps; s++) {
          const rr = r0 + ((r1 - r0) * s) / steps;
          ctx.fillRect(Math.round(cx + Math.cos(a) * rr), Math.round(cy + Math.sin(a) * rr), 2, 2);
        }
      }
      ctx.restore();
    }

    // 拡大表示（ポップイン）
    const sp = this.sprites.bugs[info.species.id]!;
    const scale = t < 0.05 ? 2 : t < 0.1 ? 4 : CATCH.getScale;
    const w = sp.width * scale;
    const h = sp.height * scale;
    ctx.save();
    ctx.globalAlpha = 0.6;
    fillCircle(ctx, info.rarity >= 4 ? '#ffe860' : info.rarity >= 2 ? '#fff4c0' : '#e8f0f8', cx, cy, 58);
    ctx.restore();
    ctx.drawImage(sp.frames[0]!, Math.round(cx - w / 2), Math.round(cy - h / 2), w, h);

    const stars = '★'.repeat(info.rarity) + '☆'.repeat(4 - info.rarity);
    text(ctx, stars, cx, cy - 96, { align: 'center', color: '#ffe040' });
    text(ctx, `${info.species.name} GET!!`, cx, cy + 70, { size: 24, align: 'center', color: '#ffffff' });
    text(ctx, `+${info.points}pt`, cx, cy + 102, { size: 24, align: 'center', color: '#fff06a' });
    if (info.rarity >= 4) {
      const colors = ['#ff6a6a', '#ffd84a', '#6aff8a', '#6ad8ff', '#d88aff'];
      text(ctx, '超レア!!', cx, cy - 130, { size: 32, align: 'center', color: colors[Math.floor(time * 12) % colors.length] });
    } else if (info.rarity === 3) {
      text(ctx, 'レア!', cx, cy - 124, { size: 24, align: 'center', color: '#ffb84a' });
    }
    text(ctx, 'TAP TO SKIP', cx, oy + 470, { size: 12, align: 'center', color: '#c0c0c0' });

    // 画面フラッシュ（★2 以上）
    if (info.rarity >= 2 && t < 0.2) {
      ctx.save();
      ctx.globalAlpha = (1 - t / 0.2) * (info.rarity >= 3 ? 0.8 : 0.45);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(ox, 0, vw, ch);
      ctx.restore();
    }
  }

  private drawPaused(layout: Layout, time: number): void {
    const ctx = this.ctx;
    const { offsetX: ox, offsetY: oy, viewWidth: vw, canvasHeight: ch } = layout;
    ctx.save();
    ctx.globalAlpha = 0.6;
    ctx.fillStyle = '#0a0810';
    ctx.fillRect(ox, 0, vw, ch);
    ctx.restore();
    text(ctx, 'PAUSE', ox + vw / 2, oy + 260, { size: 32, align: 'center' });
    if (Math.floor(time * 2) % 2 === 0) text(ctx, 'TAP TO RESUME', ox + vw / 2, oy + 320, { align: 'center' });
  }

  private drawResult(game: Game, layout: Layout, time: number): void {
    const res = game.result;
    if (!res) return;
    const ctx = this.ctx;
    const { offsetX: ox, offsetY: oy, viewWidth: vw, canvasHeight: ch } = layout;
    ctx.save();
    ctx.globalAlpha = 0.72;
    ctx.fillStyle = '#0c0a14';
    ctx.fillRect(ox, 0, vw, ch);
    ctx.restore();
    const cx = ox + vw / 2;
    text(ctx, 'けっか', cx, oy + 36, { size: 24, align: 'center' });
    text(ctx, `${res.total}pt`, cx, oy + 70, { size: 32, align: 'center', color: '#fff06a' });
    if (res.isRecord) {
      const c = Math.floor(time * 6) % 2 ? '#ff7a5a' : '#ffe04a';
      text(ctx, 'NEW RECORD!!', cx, oy + 112, { align: 'center', color: c });
    } else {
      text(ctx, `HI-SCORE ${game.highScore}pt`, cx, oy + 112, { align: 'center', color: '#c8c8d0' });
    }

    const pw = Math.min(vw - 16, 400);
    const left = cx - pw / 2;
    // 種類が増えても画面内に収まるよう行の高さを詰める
    const rowH = Math.min(26, Math.floor(440 / res.rows.length));
    let y = oy + 150;
    for (const row of res.rows) {
      const sp = SPECIES.find((s) => s.id === row.id)!;
      const baked = this.sprites.bugs[row.id]!;
      const got = row.count > 0;
      const iconX = Math.round(left + 8 + (16 - Math.min(16, baked.width)) / 2);
      if (baked.width > 16) {
        ctx.drawImage(got ? baked.frames[0]! : baked.silhouette, iconX, y + 4, 16, Math.round((baked.height * 16) / baked.width));
      } else {
        ctx.drawImage(got ? baked.frames[0]! : baked.silhouette, iconX, y);
      }
      const color = got ? '#ffffff' : '#70707a';
      text(ctx, got ? sp.name : '？？？', left + 34, y, { color });
      text(ctx, `×${row.count}`, left + pw - 100, y, { align: 'right', color });
      text(ctx, got ? `${row.subtotal}pt` : '-', left + pw - 8, y, { align: 'right', color: got ? '#fff6a0' : color });
      y += rowH;
    }
    if (game.sceneTime >= RESULT_INPUT_DELAY && Math.floor(time * 2) % 2 === 0) {
      text(ctx, 'TAP TO TITLE', cx, Math.min(ch - 28, oy + 520 + 90), { align: 'center' });
    }
  }
}
