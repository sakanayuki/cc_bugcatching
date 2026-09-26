import { describe, expect, it } from 'vitest';
import { SPECIES } from './bugs';
import { hitRadiusFor, pickCatch, rarityFor, summarize } from './catching';
import { BUG_HIT_SCALE } from './config';

describe('pickCatch', () => {
  it('輪と重なっていなければ捕まらない', () => {
    expect(pickCatch(0, 0, 14, [{ x: 30, y: 0, hitRadius: 5 }])).toBe(-1);
  });

  it('輪の内側と重なれば捕まる', () => {
    expect(pickCatch(0, 0, 14, [{ x: 18, y: 0, hitRadius: 5 }])).toBe(0);
  });

  it('複数入ったら輪の中心に最も近い 1 匹だけ', () => {
    const targets = [
      { x: 10, y: 0, hitRadius: 5 },
      { x: -2, y: 3, hitRadius: 5 },
      { x: 0, y: 12, hitRadius: 5 },
    ];
    expect(pickCatch(0, 0, 14, targets)).toBe(1);
  });

  it('当たり判定は見た目の大きさを基準にする（小さい子向けに見た目いっぱいまで）', () => {
    expect(hitRadiusFor(32, 32)).toBeCloseTo(16 * BUG_HIT_SCALE);
    expect(hitRadiusFor(48, 32)).toBeCloseTo(16 * BUG_HIT_SCALE);
  });
});

describe('rarityFor', () => {
  it('得点で ★1〜★4 に分かれる', () => {
    expect(rarityFor(10)).toBe(1);
    expect(rarityFor(40)).toBe(1);
    expect(rarityFor(50)).toBe(2);
    expect(rarityFor(100)).toBe(2);
    expect(rarityFor(120)).toBe(3);
    expect(rarityFor(200)).toBe(3);
    expect(rarityFor(300)).toBe(4);
  });
});

describe('summarize', () => {
  it('全種を図鑑順に並べ、匹数と小計と合計を出す', () => {
    const { rows, total } = summarize(['batta', 'semi', 'batta', 'ookuwagata'], SPECIES);
    expect(rows).toHaveLength(SPECIES.length);
    expect(rows.map((r) => r.id)).toEqual(SPECIES.map((s) => s.id));
    expect(rows.find((r) => r.id === 'batta')).toEqual({ id: 'batta', count: 2, subtotal: 60 });
    expect(rows.find((r) => r.id === 'kabutomushi')).toEqual({ id: 'kabutomushi', count: 0, subtotal: 0 });
    expect(total).toBe(30 * 2 + 40 + 300);
  });

  it('何も捕まえなければ 0 点', () => {
    expect(summarize([], SPECIES).total).toBe(0);
  });
});
