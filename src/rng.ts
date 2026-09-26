/** 乱数生成器。テストで再現できるようシード付きの実装を使えるようにする */
export interface Rng {
  /** [0, 1) の一様乱数 */
  next(): number;
}

/** mulberry32: 32bit シード付き擬似乱数 */
export function createRng(seed: number): Rng {
  let a = seed >>> 0;
  return {
    next() {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
  };
}

export const mathRng: Rng = { next: () => Math.random() };

export function range(rng: Rng, min: number, max: number): number {
  return min + (max - min) * rng.next();
}

export function randInt(rng: Rng, min: number, maxInclusive: number): number {
  return Math.floor(range(rng, min, maxInclusive + 1));
}

export function chance(rng: Rng, p: number): boolean {
  return rng.next() < p;
}

export function pick<T>(rng: Rng, items: readonly T[]): T {
  return items[Math.floor(rng.next() * items.length)]!;
}

/** 重み付き抽選。重みの合計が 0 なら null */
export function weightedPick<T>(rng: Rng, items: readonly T[], weight: (item: T) => number): T | null {
  let total = 0;
  for (const item of items) total += Math.max(0, weight(item));
  if (total <= 0) return null;
  let r = rng.next() * total;
  for (const item of items) {
    const w = Math.max(0, weight(item));
    if (w <= 0) continue;
    if (r < w) return item;
    r -= w;
  }
  // 浮動小数誤差で末尾を超えた場合
  for (let i = items.length - 1; i >= 0; i--) if (weight(items[i]!) > 0) return items[i]!;
  return null;
}
