import { describe, expect, it } from 'vitest';
import { createRng, weightedPick } from './rng';

describe('createRng', () => {
  it('同じシードなら同じ列', () => {
    const a = createRng(42);
    const b = createRng(42);
    for (let i = 0; i < 10; i++) expect(a.next()).toBe(b.next());
  });

  it('[0, 1) の範囲', () => {
    const r = createRng(1);
    for (let i = 0; i < 1000; i++) {
      const v = r.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe('weightedPick', () => {
  it('重み 0 は選ばれない', () => {
    const r = createRng(7);
    for (let i = 0; i < 200; i++) {
      expect(weightedPick(r, ['a', 'b', 'c'], (x) => (x === 'b' ? 0 : 1))).not.toBe('b');
    }
  });

  it('重みの比に従う', () => {
    const r = createRng(3);
    let a = 0;
    const n = 5000;
    for (let i = 0; i < n; i++) if (weightedPick(r, ['a', 'b'], (x) => (x === 'a' ? 3 : 1)) === 'a') a++;
    expect(a / n).toBeGreaterThan(0.7);
    expect(a / n).toBeLessThan(0.8);
  });

  it('全部 0 なら null', () => {
    expect(weightedPick(createRng(1), ['a'], () => 0)).toBeNull();
  });
});
