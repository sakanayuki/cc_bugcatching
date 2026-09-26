import { buildBackgrounds, type Backgrounds } from './background';
import { FIXED_DT, MAX_FRAME_DT, UI } from './config';
import { Game } from './game';
import { Input } from './input';
import { computeLayout, type Layout } from './layout';
import { Renderer, type Insets } from './render';
import { bakeAll } from './sprites';
import type { World } from './world';

async function waitForFont(): Promise<void> {
  if (!('fonts' in document)) return;
  const timeout = new Promise<void>((resolve) => setTimeout(resolve, UI.fontTimeout));
  // 読み込めなくてもシステムフォントで続行する
  const load = document.fonts.load(`16px "DotGothic16"`).then(
    () => undefined,
    () => undefined,
  );
  await Promise.race([load, timeout]);
}

function readInsets(el: HTMLElement): { top: number; right: number; bottom: number; left: number } {
  const s = getComputedStyle(el);
  return {
    top: parseFloat(s.paddingTop) || 0,
    right: parseFloat(s.paddingRight) || 0,
    bottom: parseFloat(s.paddingBottom) || 0,
    left: parseFloat(s.paddingLeft) || 0,
  };
}

async function main(): Promise<void> {
  const canvas = document.getElementById('game') as HTMLCanvasElement;
  const safeArea = document.getElementById('safe-area') as HTMLElement;
  const ctx = canvas.getContext('2d', { alpha: false })!;

  await waitForFont();
  document.getElementById('loading')?.remove();

  const sprites = bakeAll();
  const renderer = new Renderer(ctx, sprites);

  let layout: Layout = computeLayout(window.innerWidth, window.innerHeight);
  let insets: Insets = { top: 0, right: 0, bottom: 0, left: 0 };
  let backgrounds: Backgrounds;
  let bgWorld: World | null = null;

  const toCanvas = (clientX: number, clientY: number) => {
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((clientX - rect.left) / rect.width) * canvas.width,
      y: ((clientY - rect.top) / rect.height) * canvas.height,
    };
  };

  let game: Game | null = null;
  const input = new Input(canvas, toCanvas, (code) => game?.onKey(code));
  game = new Game(layout.viewWidth, input);
  const g = game;

  const applyLayout = () => {
    layout = computeLayout(window.innerWidth, window.innerHeight);
    canvas.width = layout.canvasWidth;
    canvas.height = layout.canvasHeight;
    const raw = readInsets(safeArea);
    insets = {
      top: raw.top / layout.scale,
      right: raw.right / layout.scale,
      bottom: raw.bottom / layout.scale,
      left: raw.left / layout.scale,
    };
    g.resize(layout.viewWidth);
    if (bgWorld !== g.world) {
      backgrounds = buildBackgrounds(g.world);
      bgWorld = g.world;
    }
  };
  applyLayout();
  window.addEventListener('resize', applyLayout);
  window.visualViewport?.addEventListener('resize', applyLayout);

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) g.pause();
  });
  window.addEventListener('blur', () => g.pause());

  // e2e テスト用に状態を読めるようにする（読み取り専用の用途）
  (window as unknown as { __mushitori?: Game }).__mushitori = g;

  let last = performance.now();
  let acc = 0;
  const frame = (now: number) => {
    const dt = Math.min(MAX_FRAME_DT, Math.max(0, (now - last) / 1000));
    last = now;
    acc += dt;
    while (acc >= FIXED_DT) {
      g.update(FIXED_DT);
      acc -= FIXED_DT;
    }
    renderer.draw(g, layout, backgrounds, insets, now / 1000);
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

void main();
