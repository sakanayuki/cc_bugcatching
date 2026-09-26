import { VIEW } from './config';

export interface Layout {
  /** キャンバスの内部解像度（画面全体） */
  canvasWidth: number;
  canvasHeight: number;
  /** ゲーム領域の幅（高さは常に VIEW.height） */
  viewWidth: number;
  /** キャンバス内でのゲーム領域の左上 */
  offsetX: number;
  offsetY: number;
  /** 内部 1px あたりの CSS px */
  scale: number;
}

/**
 * 画面サイズ（CSS px）から内部解像度を決める。
 * - 9:16 より縦長: 幅 360 固定、上下に余白（端の色を延長）
 * - 9:16〜16:9: 縦 640 に合わせて幅を広げる
 * - 16:9 より横長: 幅 1138 固定、左右に帯
 */
export function computeLayout(screenWidth: number, screenHeight: number): Layout {
  const w = Math.max(1, screenWidth);
  const h = Math.max(1, screenHeight);
  const viewWidth = Math.round(Math.min(VIEW.maxWidth, Math.max(VIEW.minWidth, (VIEW.height * w) / h)));
  const scale = Math.min(w / viewWidth, h / VIEW.height);
  const canvasWidth = Math.max(viewWidth, Math.round(w / scale));
  const canvasHeight = Math.max(VIEW.height, Math.round(h / scale));
  return {
    canvasWidth,
    canvasHeight,
    viewWidth,
    offsetX: Math.floor((canvasWidth - viewWidth) / 2),
    offsetY: Math.floor((canvasHeight - VIEW.height) / 2),
    scale,
  };
}
