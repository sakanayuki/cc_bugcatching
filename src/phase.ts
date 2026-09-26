import { TIME } from './config';

export type Phase = 'day' | 'dusk' | 'night';
export const PHASES: readonly Phase[] = ['day', 'dusk', 'night'];

export type PhaseWeights = Record<Phase, number>;

/** 経過時間から現在の時間帯（出現テーブル用, 境界で即切替） */
export function phaseAt(elapsed: number): Phase {
  if (elapsed >= TIME.nightStart) return 'night';
  if (elapsed >= TIME.duskStart) return 'dusk';
  return 'day';
}

function smoothstep(t: number): number {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
}

/**
 * 見た目用の時間帯ブレンド。境界から transitionTime 秒かけて次の時間帯へ補間する。
 * 戻り値の合計は常に 1。
 */
export function phaseBlend(elapsed: number): PhaseWeights {
  const toDusk = smoothstep((elapsed - TIME.duskStart) / TIME.transitionTime);
  const toNight = smoothstep((elapsed - TIME.nightStart) / TIME.transitionTime);
  return {
    day: 1 - toDusk,
    dusk: toDusk - toNight,
    night: toNight,
  };
}

/** 色の補間（#rrggbb） */
export function mixColor(a: string, b: string, t: number): string {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ch = (p: number, s: number) => (p >> s) & 0xff;
  const lerp = (x: number, y: number) => Math.round(x + (y - x) * t);
  const r = lerp(ch(pa, 16), ch(pb, 16));
  const g = lerp(ch(pa, 8), ch(pb, 8));
  const bl = lerp(ch(pa, 0), ch(pb, 0));
  return '#' + ((r << 16) | (g << 8) | bl).toString(16).padStart(6, '0');
}
