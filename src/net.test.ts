import { describe, expect, it } from 'vitest';
import { NET } from './config';
import {
  acceptsInput,
  catchAt,
  gaugeRatio,
  isHitActive,
  netPose,
  reachFor,
  releaseCatch,
  ringCenter,
  stepNet,
  swingDuration,
  type NetInput,
  type NetState,
} from './net';

const DT = 1 / 120;
const IDLE = { pressed: false, held: false };
const HOLD = { pressed: false, held: true };
const PRESS = { pressed: true, held: true };

function run(state: NetState, seconds: number, input: NetInput): { state: NetState; events: string[] } {
  const events: string[] = [];
  let s = state;
  for (let t = 0; t < seconds - 1e-9; t += DT) {
    const r = stepNet(s, DT, input);
    s = r.state;
    if (r.event) events.push(r.event);
  }
  return { state: s, events };
}

describe('ゲージと到達距離', () => {
  it('ゲージは 空 → 満タン → 空 と往復する', () => {
    expect(gaugeRatio(0)).toBe(0);
    expect(gaugeRatio(NET.gaugePeriod / 4)).toBeCloseTo(0.5);
    expect(gaugeRatio(NET.gaugePeriod / 2)).toBeCloseTo(1);
    expect(gaugeRatio((NET.gaugePeriod * 3) / 4)).toBeCloseTo(0.5);
    expect(gaugeRatio(NET.gaugePeriod)).toBeCloseTo(0);
    expect(gaugeRatio(NET.gaugePeriod * 1.5)).toBeCloseTo(1);
  });

  it('ゲージが少ないと近く、多いと遠くまで届く', () => {
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
  it('タップ（tapTime 以内に離す）ならすぐ最小距離へ振る', () => {
    let s = stepNet({ kind: 'ready' }, DT, PRESS);
    expect(s.event).toBe('press');
    s = stepNet(s.state, DT, HOLD);
    s = stepNet(s.state, DT, IDLE);
    expect(s.event).toBe('swing');
    expect(s.state.kind).toBe('swinging');
    if (s.state.kind === 'swinging') expect(s.state.reach).toBe(NET.minReach);
    const done = run(s.state, NET.maxSwingTime + NET.holdTime + NET.recoverTime + 0.05, IDLE);
    expect(done.state.kind).toBe('ready');
  });

  it('tapTime を過ぎて押していればゲージ表示になり、離しても振らない', () => {
    let { state } = run(stepNet({ kind: 'ready' }, DT, PRESS).state, NET.tapTime + 0.05, HOLD);
    expect(state.kind).toBe('aiming');
    // 離してもゲージのまま待つ
    ({ state } = run(state, 1.5, IDLE));
    expect(state.kind).toBe('aiming');
  });

  it('長押しが途中で途切れても（tapTime 後）ゲージ表示のまま待つ', () => {
    let { state } = run(stepNet({ kind: 'ready' }, DT, PRESS).state, NET.tapTime + 0.02, HOLD);
    expect(state.kind).toBe('aiming');
    ({ state } = run(state, 0.1, IDLE));
    expect(state.kind).toBe('aiming');
  });

  it('ゲージ表示中にもう一度押すと、その時点のゲージ量で振る', () => {
    const aiming: NetState = { kind: 'aiming', t: NET.gaugePeriod / 2 };
    const r = stepNet(aiming, DT, PRESS);
    expect(r.event).toBe('swing');
    expect(r.state.kind).toBe('swinging');
    if (r.state.kind === 'swinging') expect(r.state.reach).toBeCloseTo(NET.maxReach);
    const half = stepNet({ kind: 'aiming', t: NET.gaugePeriod / 4 }, DT, PRESS).state;
    if (half.kind === 'swinging') expect(half.reach).toBeCloseTo(reachFor(0.5));
  });

  it('振っている最中と硬直中は入力を受け付けない', () => {
    const swing = stepNet({ kind: 'aiming', t: 0.3 }, DT, PRESS).state;
    expect(acceptsInput(swing)).toBe(false);
    let s = swing;
    const events: string[] = [];
    for (let t = 0; t < 0.3; t += DT) {
      const r = stepNet(s, DT, PRESS);
      s = r.state;
      if (r.event) events.push(r.event);
    }
    expect(events).not.toContain('press');
    expect(s.kind).not.toBe('pressing');
  });

  it('振り終わったら押しっぱなしでは次の操作にならず、新しく押す必要がある', () => {
    const swing = stepNet({ kind: 'aiming', t: 0.3 }, DT, PRESS).state;
    const { state } = run(swing, 1.0, HOLD);
    expect(state.kind).toBe('ready');
    expect(stepNet(state, DT, PRESS).state.kind).toBe('pressing');
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
    expect(stepNet(caught, 1, PRESS).state).toBe(caught);
    const back = releaseCatch(caught);
    expect(back.kind).toBe('recovering');
    expect(netPose(back)).toEqual(netPose(s));
  });
});

describe('小さい子向けのやさしさ', () => {
  it('網の輪は虫（32px）がすっぽり入る大きさ', () => {
    expect(NET.ringRadius * 2).toBeGreaterThanOrEqual(56);
  });

  it('ゲージを押すタイミングが 0.1 秒ずれても、到達点のずれは輪と虫の判定の範囲内', () => {
    const drift = reachFor(gaugeRatio(0.6)) - reachFor(gaugeRatio(0.5));
    expect(drift).toBeLessThanOrEqual(NET.ringRadius + 16);
  });

  it('タップの判定時間は 0.2 秒', () => {
    expect(NET.tapTime).toBe(0.2);
  });

  it('到達点でしばらく網が止まり、その間も捕まえられる', () => {
    expect(NET.holdTime).toBeGreaterThanOrEqual(0.25);
  });
});
