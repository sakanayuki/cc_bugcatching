import { describe, expect, it } from 'vitest';
import { SPECIES } from './bugs';
import { BUG_SPRITES, HERO_FEET_ROW, HERO_SPRITE, MUTE_SPRITE, type SpriteDef } from './spriteData';

function checkSprite(name: string, def: SpriteDef): void {
  const h = def.frames[0]!.length;
  const w = def.frames[0]![0]!.length;
  def.frames.forEach((frame, fi) => {
    expect(frame.length, `${name} frame ${fi} height`).toBe(h);
    frame.forEach((row, ri) => {
      expect(row.length, `${name} frame ${fi} row ${ri} width`).toBe(w);
      for (const ch of row) {
        if (ch !== '.') expect(def.palette[ch], `${name} frame ${fi} row ${ri} color '${ch}'`).toBeDefined();
      }
    });
  });
}

describe('ドット絵定義', () => {
  it('すべての虫にスプライトがあり、サイズが一致する', () => {
    for (const sp of SPECIES) {
      const def = BUG_SPRITES[sp.id];
      expect(def, sp.id).toBeDefined();
      checkSprite(sp.id, def!);
      expect(def!.frames[0]!.length, `${sp.id} height`).toBe(sp.height);
      expect(def!.frames[0]![0]!.length, `${sp.id} width`).toBe(sp.width);
      expect(def!.frames.length).toBeGreaterThanOrEqual(2);
    }
  });

  it('主人公と UI のスプライトが正しい形', () => {
    checkSprite('hero', HERO_SPRITE);
    expect(HERO_SPRITE.frames[0]!.length).toBe(32);
    expect(HERO_SPRITE.frames[0]![HERO_FEET_ROW]).toMatch(/k/);
    expect(HERO_SPRITE.frames[0]![HERO_FEET_ROW + 1]).toMatch(/^\.+$/);
    checkSprite('mute', MUTE_SPRITE);
  });

  it('透明でないピクセルがある', () => {
    for (const [id, def] of Object.entries(BUG_SPRITES)) {
      for (const frame of def.frames) expect(frame.join('').replace(/\./g, '').length, id).toBeGreaterThan(10);
    }
  });
});
