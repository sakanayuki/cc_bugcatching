import { NET } from './config';

/** 網の姿勢。支点からの角度（度, 0 = 右, -90 = 真上）と柄の長さ */
export interface Pose {
  angle: number;
  length: number;
}

export type NetState =
  | { kind: 'ready' }
  | { kind: 'charging'; t: number }
  | { kind: 'swinging'; t: number; reach: number; duration: number; startAngle: number }
  | { kind: 'holding'; t: number; reach: number }
  | { kind: 'caught'; pose: Pose }
  | { kind: 'recovering'; t: number; from: Pose };

export type NetEvent = 'charge' | 'swing' | 'ready' | null;

export const READY_POSE: Pose = { angle: NET.readyAngle, length: NET.restLength };

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp01 = (t: number) => Math.min(1, Math.max(0, t));
const easeOutQuad = (t: number) => 1 - (1 - t) * (1 - t);
const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

/** 押していた時間 → 振りかぶり量 [0, 1]。最大に達したらそれ以上増えない */
export function chargeRatio(heldTime: number): number {
  return clamp01(heldTime / NET.chargeTime);
}

/** 振りかぶり量 → 到達距離 */
export function reachFor(ratio: number): number {
  return lerp(NET.minReach, NET.maxReach, clamp01(ratio));
}

/** 到達距離 → 到達までの時間。遠いほど少し長い */
export function swingDuration(reach: number): number {
  const t = clamp01((reach - NET.minReach) / (NET.maxReach - NET.minReach));
  return lerp(NET.minSwingTime, NET.maxSwingTime, t);
}

/** 振りかぶり中の網の角度 */
export function windupAngle(ratio: number): number {
  return lerp(NET.readyAngle, NET.windupAngle, easeOutQuad(clamp01(ratio)));
}

/** 状態から網の姿勢を求める */
export function netPose(state: NetState): Pose {
  switch (state.kind) {
    case 'ready':
      return READY_POSE;
    case 'charging':
      return { angle: windupAngle(chargeRatio(state.t)), length: NET.restLength - 4 * chargeRatio(state.t) };
    case 'swinging': {
      const p = clamp01(state.t / state.duration);
      // 最初の 4 割で真上へ向き直り、長さは減速しながら到達点まで伸びる
      const turn = easeOutQuad(clamp01(p / 0.4));
      return {
        angle: lerp(state.startAngle, -90, turn),
        length: lerp(NET.restLength, state.reach, easeOutQuad(p)),
      };
    }
    case 'holding':
      return { angle: -90, length: state.reach };
    case 'caught':
      return state.pose;
    case 'recovering': {
      const p = easeInOut(clamp01(state.t / NET.recoverTime));
      return {
        angle: lerp(state.from.angle, READY_POSE.angle, p),
        length: lerp(state.from.length, READY_POSE.length, p),
      };
    }
  }
}

/** 網の輪の中心 */
export function ringCenter(pose: Pose, pivotX: number, pivotY: number): { x: number; y: number } {
  const rad = (pose.angle * Math.PI) / 180;
  return { x: pivotX + Math.cos(rad) * pose.length, y: pivotY + Math.sin(rad) * pose.length };
}

/** 捕獲判定を行う状態か（振り下ろしの後半〜到達点での静止） */
export function isHitActive(state: NetState): boolean {
  if (state.kind === 'swinging') return state.t / state.duration >= NET.hitWindowStart;
  return state.kind === 'holding';
}

/** 新しい入力（溜め開始）を受け付けられるか */
export function acceptsInput(state: NetState): boolean {
  return state.kind === 'ready' || state.kind === 'charging';
}

/**
 * 1 ステップ進める。held は「網操作として有効な押下が続いているか」。
 * 硬直明けに押し続けていれば、その時点から溜めを始める。
 */
export function stepNet(state: NetState, dt: number, held: boolean): { state: NetState; event: NetEvent } {
  switch (state.kind) {
    case 'ready':
      return held ? { state: { kind: 'charging', t: 0 }, event: 'charge' } : { state, event: null };
    case 'charging': {
      if (held) return { state: { kind: 'charging', t: state.t + dt }, event: null };
      const reach = reachFor(chargeRatio(state.t));
      return {
        state: {
          kind: 'swinging',
          t: 0,
          reach,
          duration: swingDuration(reach),
          startAngle: windupAngle(chargeRatio(state.t)),
        },
        event: 'swing',
      };
    }
    case 'swinging': {
      const t = state.t + dt;
      if (t < state.duration) return { state: { ...state, t }, event: null };
      return { state: { kind: 'holding', t: t - state.duration, reach: state.reach }, event: null };
    }
    case 'holding': {
      const t = state.t + dt;
      if (t < NET.holdTime) return { state: { ...state, t }, event: null };
      return { state: { kind: 'recovering', t: t - NET.holdTime, from: { angle: -90, length: state.reach } }, event: null };
    }
    case 'caught':
      return { state, event: null };
    case 'recovering': {
      const t = state.t + dt;
      if (t < NET.recoverTime) return { state: { ...state, t }, event: null };
      if (held) return { state: { kind: 'charging', t: 0 }, event: 'charge' };
      return { state: { kind: 'ready' }, event: 'ready' };
    }
  }
}

/** 捕獲した瞬間の姿勢で網を止める */
export function catchAt(state: NetState): NetState {
  return { kind: 'caught', pose: netPose(state) };
}

/** 捕獲演出が終わったら網を戻し始める */
export function releaseCatch(state: NetState): NetState {
  if (state.kind !== 'caught') return state;
  return { kind: 'recovering', t: 0, from: state.pose };
}
