import { describe, expect, it } from 'vitest';
import { computeLayout } from './layout';

describe('computeLayout', () => {
  it('9:16 ちょうどなら 360×640 がぴったり収まる', () => {
    const l = computeLayout(360, 640);
    expect(l).toMatchObject({ viewWidth: 360, canvasWidth: 360, canvasHeight: 640, offsetX: 0, offsetY: 0, scale: 1 });
  });

  it('縦長スマホは幅 360 固定で上下に余白ができる', () => {
    const l = computeLayout(390, 844); // iPhone 14 相当
    expect(l.viewWidth).toBe(360);
    expect(l.canvasWidth).toBe(360);
    expect(l.canvasHeight).toBeGreaterThan(640);
    expect(l.offsetX).toBe(0);
    expect(l.offsetY).toBe(Math.floor((l.canvasHeight - 640) / 2));
  });

  it('9:16 と 16:9 の間は縦 640 に合わせて横に広げる', () => {
    const l = computeLayout(768, 1024); // iPad 縦
    expect(l.viewWidth).toBe(480);
    expect(l.canvasHeight).toBe(640);
    expect(l.offsetX).toBe(0);
    expect(l.offsetY).toBe(0);
  });

  it('16:9 は最大幅', () => {
    const l = computeLayout(1920, 1080);
    expect(l.viewWidth).toBe(1138);
    expect(l.canvasHeight).toBe(640);
  });

  it('16:9 より横長なら左右に帯ができる', () => {
    const l = computeLayout(2560, 1080);
    expect(l.viewWidth).toBe(1138);
    expect(l.canvasWidth).toBeGreaterThan(1138);
    expect(l.offsetX).toBeGreaterThan(0);
    expect(l.offsetY).toBe(0);
  });

  it('不正なサイズでも落ちない', () => {
    const l = computeLayout(0, 0);
    expect(l.viewWidth).toBeGreaterThanOrEqual(360);
    expect(Number.isFinite(l.scale)).toBe(true);
  });
});
