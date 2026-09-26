import { describe, expect, it } from 'vitest';
import { TIME } from './config';
import { mixColor, phaseAt, phaseBlend, PHASES } from './phase';

describe('phaseAt', () => {
  it('90〜61 秒は昼、60〜31 秒は夕方、30〜0 秒は夜', () => {
    expect(phaseAt(0)).toBe('day');
    expect(phaseAt(29.9)).toBe('day');
    expect(phaseAt(30)).toBe('dusk');
    expect(phaseAt(59.9)).toBe('dusk');
    expect(phaseAt(60)).toBe('night');
    expect(phaseAt(90)).toBe('night');
  });
});

describe('phaseBlend', () => {
  it('合計は常に 1', () => {
    for (let t = 0; t <= 90; t += 0.5) {
      const b = phaseBlend(t);
      expect(PHASES.reduce((s, p) => s + b[p], 0)).toBeCloseTo(1);
    }
  });

  it('切替は急変せず数秒かけて補間する', () => {
    expect(phaseBlend(TIME.duskStart).day).toBeCloseTo(1);
    const mid = phaseBlend(TIME.duskStart + TIME.transitionTime / 2);
    expect(mid.day).toBeGreaterThan(0.1);
    expect(mid.dusk).toBeGreaterThan(0.1);
    expect(phaseBlend(TIME.duskStart + TIME.transitionTime).dusk).toBeCloseTo(1);
    expect(phaseBlend(TIME.nightStart + TIME.transitionTime).night).toBeCloseTo(1);
  });
});

describe('mixColor', () => {
  it('2 色を補間する', () => {
    expect(mixColor('#000000', '#ffffff', 0)).toBe('#000000');
    expect(mixColor('#000000', '#ffffff', 1)).toBe('#ffffff');
    expect(mixColor('#000000', '#ff0080', 0.5)).toBe('#800040');
  });
});
