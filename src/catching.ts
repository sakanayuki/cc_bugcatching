import { BUG_HIT_SCALE, RARITY_THRESHOLDS } from './config';

export interface HitTarget {
  x: number;
  y: number;
  /** 当たり判定の半径 */
  hitRadius: number;
}

/** 見た目のサイズから当たり判定の半径を求める（見た目より少し小さく） */
export function hitRadiusFor(width: number, height: number): number {
  return (Math.min(width, height) / 2) * BUG_HIT_SCALE;
}

/**
 * 網の輪の内側と重なっている虫のうち、輪の中心に最も近いものの添字を返す。
 * 重なる虫がいなければ -1。
 */
export function pickCatch(ringX: number, ringY: number, ringRadius: number, targets: readonly HitTarget[]): number {
  let best = -1;
  let bestDist = Infinity;
  for (let i = 0; i < targets.length; i++) {
    const t = targets[i]!;
    const d = Math.hypot(t.x - ringX, t.y - ringY);
    if (d < ringRadius + t.hitRadius && d < bestDist) {
      best = i;
      bestDist = d;
    }
  }
  return best;
}

/** 得点からレア度（1〜4） */
export function rarityFor(points: number): number {
  let r = 1;
  for (let i = 0; i < RARITY_THRESHOLDS.length; i++) if (points >= RARITY_THRESHOLDS[i]!) r = i + 1;
  return r;
}

export interface ResultRow {
  id: string;
  count: number;
  subtotal: number;
}

/** 捕獲記録（虫 id の配列）をリザルトの行にまとめる。並びは species の順 */
export function summarize(
  caught: readonly string[],
  species: readonly { id: string; points: number }[],
): { rows: ResultRow[]; total: number } {
  const counts = new Map<string, number>();
  for (const id of caught) counts.set(id, (counts.get(id) ?? 0) + 1);
  let total = 0;
  const rows = species.map((s) => {
    const count = counts.get(s.id) ?? 0;
    const subtotal = count * s.points;
    total += subtotal;
    return { id: s.id, count, subtotal };
  });
  return { rows, total };
}
