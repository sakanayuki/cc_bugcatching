import { describe, expect, it } from 'vitest';
import { loadHighScore, loadMuted, saveHighScore, saveMuted, type KeyValueStore } from './storage';

function memory(): KeyValueStore & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) };
}

describe('ハイスコア', () => {
  it('未保存なら 0', () => {
    expect(loadHighScore(memory())).toBe(0);
  });

  it('更新したときだけ保存して true', () => {
    const s = memory();
    expect(saveHighScore(100, s)).toBe(true);
    expect(loadHighScore(s)).toBe(100);
    expect(saveHighScore(80, s)).toBe(false);
    expect(saveHighScore(100, s)).toBe(false);
    expect(loadHighScore(s)).toBe(100);
    expect(saveHighScore(150, s)).toBe(true);
    expect(loadHighScore(s)).toBe(150);
  });

  it('壊れた値や使えないストレージでも落ちない', () => {
    const s = memory();
    s.data.set('mushitori.highScore', 'abc');
    expect(loadHighScore(s)).toBe(0);
    const broken: KeyValueStore = {
      getItem: () => {
        throw new Error('denied');
      },
      setItem: () => {
        throw new Error('denied');
      },
    };
    expect(loadHighScore(broken)).toBe(0);
    expect(saveHighScore(10, broken)).toBe(true);
    expect(loadMuted(broken)).toBe(false);
    expect(() => saveMuted(true, broken)).not.toThrow();
    expect(loadHighScore(null)).toBe(0);
  });
});

describe('ミュート設定', () => {
  it('保存して読み戻せる', () => {
    const s = memory();
    expect(loadMuted(s)).toBe(false);
    saveMuted(true, s);
    expect(loadMuted(s)).toBe(true);
    saveMuted(false, s);
    expect(loadMuted(s)).toBe(false);
  });
});
