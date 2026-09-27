import { describe, expect, it } from 'vitest';
import { NET } from './config';
import {
  acceptsInput,
  catchAt,
  chargeRatio,
  isHitActive,
  netPose,
  reachFor,
  releaseCatch,
  ringCenter,
  stepNet,
  swingDuration,
  type NetState,
} from './net';

const DT = 1 / 120;

function run(state: NetState, seconds: number, held: boolean): { state: NetState; events: string[] } {
  const events: string[] = [];
  let s = state;
  for (let t = 0; t < seconds - 1e-9; t += DT) {
    const r = stepNet(s, DT, held);
    s = r.state;
    if (r.event) events.push(r.event);
  }
  return { state: s, events };
}

describe('振りかぶりと到達距離', () => {
  it('押している時間に比例して振りかぶり量が増え、最大で頭打ち', () => {
    expect(chargeRatio(0)).toBe(0);
    expect(chargeRatio(NET.chargeTime / 2)).toBeCloseTo(0.5);
    expect(chargeRatio(NET.chargeTime)).toBe(1);
    expect(chargeRatio(NET.chargeTime * 5)).toBe(1);
  });

  it('短い長押しは近く、長い長押しは遠くまで届く', () => {
    expect(reachFor(0)).toBe(NET.minReach);
    expect(reachFor(1)).toBe(NET.maxReach);
    expect(reachFor(0.5)).toBeGreaterThan(reachFor(0.2));
  });

  it('遠いほどスイングに時間がかかる', () => {
    expect(swingDuration(NET.minReach)).toBeCloseTo(NET.minSwingTime);
    expect(swingDuration(NET.maxReach)).toBeCloseTo(NET.maxSwingTime);
    expect(swingDuration(300)).toBeGreaterThan(swingDuration(100));
  });
});

describe('stepNet', () => {
  it('長押し → 離す で振り、到達点で止まってから構えに戻る', () => {
    let { state, events } = run({ kind: 'ready' }, 0.5, true);
    expect(state.kind).toBe('charging');
    expect(events).toEqual(['charge']);
    const heldFor = state.kind === 'charging' ? state.t : NaN;
    expect(heldFor).toBeCloseTo(0.5, 1);
    const r = stepNet(state, DT, false);
    expect(r.event).toBe('swing');
    state = r.state;
    expect(state.kind).toBe('swinging');
    if (state.kind === 'swinging') expect(state.reach).toBeCloseTo(reachFor(chargeRatio(heldFor)));
    ({ state } = run(state, NET.maxSwingTime + NET.holdTime + NET.recoverTime + 0.05, false));
    expect(state.kind).toBe('ready');
  });

  it('振っている最中と硬直中は入力を受け付けない', () => {
    let { state } = run({ kind: 'ready' }, 0.3, true);
    state = stepNet(state, DT, false).state;
    expect(acceptsInput(state)).toBe(false);
    // スイング中に押しても溜めに移らない
    const r = run(state, 0.1, true);
    expect(r.state.kind).not.toBe('charging');
    expect(r.events).not.toContain('charge');
  });

  it('硬直明けに押し続けていれば、その時点から溜め始める', () => {
    let { state } = run({ kind: 'ready' }, 0.2, true);
    state = stepNet(state, DT, false).state;
    const r = run(state, 1.0, true);
    expect(r.state.kind).toBe('charging');
    // 溜めは準備が整ってから数えるので、押していた時間より短い
    if (r.state.kind === 'charging') expect(r.state.t).toBeLessThan(0.6);
  });

  it('判定は振り下ろしの後半と到達点での静止中のみ', () => {
    const swing: NetState = { kind: 'swinging', t: 0, reach: 200, duration: 0.2, startAngle: 30 };
    expect(isHitActive(swing)).toBe(false);
    expect(isHitActive({ ...swing, t: 0.2 * NET.hitWindowStart - 0.001 })).toBe(false);
    expect(isHitActive({ ...swing, t: 0.2 * NET.hitWindowStart + 0.001 })).toBe(true);
    expect(isHitActive({ kind: 'holding', t: 0, reach: 200 })).toBe(true);
    expect(isHitActive({ kind: 'ready' })).toBe(false);
    expect(isHitActive({ kind: 'recovering', t: 0, from: { angle: -90, length: 200 } })).toBe(false);
  });

  it('到達点は支点の真上、振りかぶり量に応じた距離', () => {
    const pose = netPose({ kind: 'holding', t: 0, reach: 250 });
    const c = ringCenter(pose, 180, 528);
    expect(c.x).toBeCloseTo(180);
    expect(c.y).toBeCloseTo(528 - 250);
  });

  it('スイングの判定区間ではほぼ真上の列にいる', () => {
    const s: NetState = { kind: 'swinging', t: 0, reach: 460, duration: 0.35, startAngle: 35 };
    for (let p = NET.hitWindowStart; p <= 1; p += 0.05) {
      const c = ringCenter(netPose({ ...s, t: 0.35 * p }), 0, 0);
      expect(Math.abs(c.x)).toBeLessThan(1);
      expect(c.y).toBeLessThan(0);
    }
  });

  it('捕獲したら網はその位置で止まり、演出後に戻り始める', () => {
    const s: NetState = { kind: 'holding', t: 0, reach: 300 };
    const caught = catchAt(s);
    expect(caught.kind).toBe('caught');
    expect(stepNet(caught, 1, true).state).toBe(caught);
    const back = releaseCatch(caught);
    expect(back.kind).toBe('recovering');
    expect(netPose(back)).toEqual(netPose(s));
  });
});

describe('小さい子向けのやさしさ', () => {
  it('網の輪は虫（32px）がすっぽり入る大きさ', () => {
    expect(NET.ringRadius * 2).toBeGreaterThanOrEqual(56);
  });

  it('離すタイミングが 0.2 秒ずれても、到達点のずれは輪の半径以内', () => {
    const drift = reachFor(chargeRatio(0.9)) - reachFor(chargeRatio(0.7));
    expect(drift).toBeLessThanOrEqual(NET.ringRadius + 16);
  });

  it('到達点でしばらく網が止まり、その間も捕まえられる', () => {
    expect(NET.holdTime).toBeGreaterThanOrEqual(0.25);
  });
});
