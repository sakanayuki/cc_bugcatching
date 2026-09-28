import { TERRAIN } from './config';
import { createRng, range } from './rng';

export interface Trunk {
  /** 幹の中心 x */
  x: number;
  width: number;
  top: number;
  bottom: number;
}

export interface World {
  width: number;
  trunks: Trunk[];
  /** 背景の装飾に使うシード（幅ごとに固定） */
  seed: number;
}

/** 幹の間隔の目安 */
const TRUNK_SPACING = 120;

/**
 * 幅に応じて木の幹を並べる。主人公の真上（中央）に必ず 1 本置き、
 * 幹にとまる虫も網で狙えるようにする。
 */
export function createWorld(width: number): World {
  const seed = 0x5eed ^ width;
  const rng = createRng(seed);
  const cx = width / 2;
  const trunks: Trunk[] = [{ x: Math.round(cx), width: 30, top: TERRAIN.trunkTop, bottom: TERRAIN.groundTop + 6 }];
  for (let k = 1; ; k++) {
    let added = false;
    for (const dir of [-1, 1]) {
      const x = Math.round(cx + dir * k * TRUNK_SPACING + range(rng, -14, 14));
      if (x < 18 || x > width - 18) continue;
      trunks.push({
        x,
        width: Math.round(range(rng, 26, 32)),
        top: TERRAIN.trunkTop + Math.round(range(rng, -20, 20)),
        bottom: TERRAIN.groundTop + Math.round(range(rng, 0, 10)),
      });
      added = true;
    }
    if (!added) break;
  }
  trunks.sort((a, b) => a.x - b.x);
  return { width, trunks, seed };
}

/** 幹のうち虫がとまれる y の範囲 */
export function perchRange(trunk: Trunk): { top: number; bottom: number } {
  return { top: Math.max(trunk.top + 40, 190), bottom: trunk.bottom - 30 };
}
