// 虫の移動パターン。描画には依存しない純粋なロジック。
import type {
  DashParams,
  HopParams,
  HoverParams,
  MeanderParams,
  PerchParams,
  Species,
  WalkParams,
  ZigzagParams,
} from './bugs';
import { BUG_SPEED_SCALE } from './config';
import { chance, pick, range, type Rng } from './rng';
import { perchRange, type Trunk, type World } from './world';

export interface Bug {
  uid: number;
  species: Species;
  /** 中心座標（ゲーム領域） */
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** 右向き 1 / 左向き -1 */
  facing: 1 | -1;
  age: number;
  /** この時間を過ぎると退場を始める */
  stayLimit: number;
  leaving: boolean;
  /** 一度でも画面内に完全に入ったか */
  entered: boolean;
  /** 飛んでいるか（描画フレームの切替用） */
  flying: boolean;
  /** 動いているか（歩行アニメ用） */
  moving: boolean;
  mode: string;
  timer: number;
  baseY: number;
  heading: number;
  bobPhase: number;
  anchorX: number;
  anchorY: number;
  anchorVx: number;
  targetX: number;
  targetY: number;
  trunk: Trunk | null;
  crawlDir: number;
  crawlStop: number;
  stopX: number | null;
}

let nextUid = 1;

function base(species: Species, rng: Rng): Bug {
  const b = species.behavior;
  return {
    uid: nextUid++,
    species,
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    facing: 1,
    age: 0,
    stayLimit: range(rng, b.stay[0], b.stay[1]),
    leaving: false,
    entered: false,
    flying: false,
    moving: false,
    mode: 'move',
    timer: 0,
    baseY: 0,
    heading: 0,
    bobPhase: range(rng, 0, Math.PI * 2),
    anchorX: 0,
    anchorY: 0,
    anchorVx: 0,
    targetX: 0,
    targetY: 0,
    trunk: null,
    crawlDir: 1,
    crawlStop: 0,
    stopX: null,
  };
}

/** 画面の左右どちらかの外側に置く。戻り値は内側へ向かう向き */
function enterFromSide(bug: Bug, world: World, rng: Rng): 1 | -1 {
  const fromLeft = chance(rng, 0.5);
  bug.x = fromLeft ? -bug.species.width / 2 - 2 : world.width + bug.species.width / 2 + 2;
  bug.facing = fromLeft ? 1 : -1;
  return bug.facing;
}

function pickPerch(bug: Bug, world: World, rng: Rng, exclude: Trunk | null): void {
  const candidates = world.trunks.filter((t) => t !== exclude);
  const trunk = pick(rng, candidates.length > 0 ? candidates : world.trunks);
  const r = perchRange(trunk);
  bug.trunk = trunk;
  bug.targetX = trunk.x + Math.round(range(rng, -3, 3));
  bug.targetY = Math.round(range(rng, r.top, r.bottom));
}

/**
 * 虫を 1 匹生成する。initial = true のときは画面内に直接置き（ゲーム開始時）、
 * false のときは画面外から入ってくる。
 */
export function spawnBug(species: Species, world: World, rng: Rng, initial: boolean): Bug {
  const bug = base(species, rng);
  const b = species.behavior;
  const w = world.width;
  const inside = () => range(rng, 24, w - 24);
  switch (b.pattern) {
    case 'walk':
    case 'hop': {
      bug.y = bug.baseY = Math.round(range(rng, b.lane.top, b.lane.bottom));
      if (initial) {
        bug.x = inside();
        bug.facing = chance(rng, 0.5) ? 1 : -1;
      } else {
        enterFromSide(bug, world, rng);
      }
      bug.mode = b.pattern === 'hop' ? 'idle' : 'move';
      bug.timer = b.pattern === 'hop' ? range(rng, b.idleTime[0], b.idleTime[1]) : 0;
      break;
    }
    case 'perch': {
      pickPerch(bug, world, rng, null);
      if (initial) {
        bug.x = bug.targetX;
        bug.y = bug.targetY;
        bug.mode = 'perch';
        bug.timer = range(rng, b.perchTime[0], b.perchTime[1]);
      } else {
        enterFromSide(bug, world, rng);
        bug.y = range(rng, 90, 260);
        bug.mode = 'fly';
        bug.flying = true;
      }
      bug.crawlDir = chance(rng, 0.5) ? 1 : -1;
      break;
    }
    case 'meander': {
      if (initial) {
        bug.x = inside();
        bug.heading = range(rng, 0, Math.PI * 2);
      } else {
        const dir = enterFromSide(bug, world, rng);
        bug.heading = (dir > 0 ? 0 : Math.PI) + range(rng, -0.5, 0.5);
      }
      bug.baseY = range(rng, b.band.top, b.band.bottom);
      bug.y = bug.baseY;
      bug.flying = true;
      break;
    }
    case 'hover': {
      bug.anchorY = range(rng, b.band.top + b.radius, b.band.bottom - b.radius);
      const drift = range(rng, b.driftSpeed[0], b.driftSpeed[1]);
      if (initial) {
        bug.anchorX = inside();
        bug.anchorVx = chance(rng, 0.5) ? drift : -drift;
      } else {
        const dir = enterFromSide(bug, world, rng);
        bug.anchorX = bug.x;
        bug.anchorVx = dir * drift;
      }
      bug.x = bug.targetX = bug.anchorX;
      bug.y = bug.targetY = bug.anchorY;
      bug.flying = true;
      break;
    }
    case 'dash': {
      const dir = enterFromSide(bug, world, rng);
      bug.x += -dir * range(rng, 0, 120); // 入ってくるまでに少し間を置く
      bug.baseY = bug.y = range(rng, b.band.top, b.band.bottom);
      bug.vx = dir * b.speed;
      bug.mode = 'dash';
      bug.stopX = chance(rng, b.stopChance) ? range(rng, w * 0.25, w * 0.75) : null;
      bug.flying = true;
      break;
    }
    case 'zigzag': {
      const dir = enterFromSide(bug, world, rng);
      bug.y = range(rng, b.band.top, b.band.bottom);
      bug.heading = (dir > 0 ? 0 : Math.PI) + range(rng, -0.6, 0.6);
      bug.timer = range(rng, b.turnInterval[0], b.turnInterval[1]);
      bug.flying = true;
      break;
    }
  }
  return bug;
}

/** 最寄りの左右端の方向 */
function nearestSide(bug: Bug, world: World): 1 | -1 {
  return bug.x < world.width / 2 ? -1 : 1;
}

/** 退場を始める。以後は画面外へ向かう */
export function startLeaving(bug: Bug, world: World): void {
  if (bug.leaving) return;
  bug.leaving = true;
  const b = bug.species.behavior;
  const dir = nearestSide(bug, world);
  switch (b.pattern) {
    case 'walk':
      bug.facing = dir;
      bug.mode = 'move';
      break;
    case 'hop':
      bug.facing = dir;
      if (bug.mode === 'idle') bug.timer = Math.min(bug.timer, 0.3);
      break;
    case 'dash':
      break; // そのまま駆け抜ける
    default:
      bug.mode = 'leave';
      bug.flying = true;
      bug.facing = dir;
      bug.vx = dir * b.leaveSpeed;
      bug.vy = -b.leaveSpeed * 0.35;
      bug.trunk = null;
      break;
  }
}

const TAU = Math.PI * 2;

/** 角度 a を b へ最大 maxStep だけ近づける */
function turnToward(a: number, b: number, maxStep: number): number {
  let d = ((b - a + Math.PI) % TAU + TAU) % TAU - Math.PI;
  if (d > maxStep) d = maxStep;
  if (d < -maxStep) d = -maxStep;
  return a + d;
}

function updateWalk(bug: Bug, b: WalkParams, world: World, rng: Rng, dt: number): void {
  const w = world.width;
  if (bug.leaving) {
    bug.x += bug.facing * b.leaveSpeed * dt;
    bug.moving = true;
    return;
  }
  switch (bug.mode) {
    case 'pause':
      bug.moving = false;
      bug.timer -= dt;
      if (bug.timer <= 0) bug.mode = 'move';
      return;
    case 'burst':
      bug.moving = true;
      bug.x += bug.facing * b.burstSpeed * dt;
      bug.timer -= dt;
      if (bug.timer <= 0) bug.mode = 'move';
      break;
    default:
      bug.moving = true;
      bug.x += bug.facing * b.speed * dt;
      if (bug.entered && chance(rng, b.pauseRate * dt)) {
        bug.mode = 'pause';
        bug.timer = range(rng, b.pauseTime[0], b.pauseTime[1]);
      } else if (bug.entered && chance(rng, b.burstRate * dt)) {
        bug.mode = 'burst';
        bug.timer = b.burstTime;
      } else if (bug.entered && chance(rng, b.turnRate * dt)) {
        bug.facing = bug.facing === 1 ? -1 : 1;
      }
  }
  if (bug.entered) {
    const half = bug.species.width / 2;
    if (bug.x < half && bug.facing < 0) bug.facing = 1;
    if (bug.x > w - half && bug.facing > 0) bug.facing = -1;
  }
}

function updateHop(bug: Bug, b: HopParams, world: World, rng: Rng, dt: number): void {
  const w = world.width;
  if (bug.mode === 'jump') {
    bug.vy += b.gravity * dt;
    bug.x += bug.vx * dt;
    bug.y += bug.vy * dt;
    if (bug.vy > 0 && bug.y >= bug.baseY) {
      bug.y = bug.baseY;
      bug.mode = 'idle';
      bug.flying = false;
      bug.timer = bug.leaving ? 0.25 : range(rng, b.idleTime[0], b.idleTime[1]);
    }
    return;
  }
  // idle: ときどきゆっくり歩く
  bug.timer -= dt;
  bug.moving = !bug.leaving && Math.sin(bug.age * 1.7 + bug.bobPhase) > 0.4;
  if (bug.moving) bug.x += bug.facing * b.walkSpeed * dt;
  if (bug.timer > 0) return;
  if (!bug.leaving) {
    if (bug.x < 70) bug.facing = 1;
    else if (bug.x > w - 70) bug.facing = -1;
    else if (chance(rng, 0.35)) bug.facing = bug.facing === 1 ? -1 : 1;
  }
  const sx = bug.leaving ? b.leaveSpeed : range(rng, b.jumpSpeedX[0], b.jumpSpeedX[1]);
  bug.vx = bug.facing * sx;
  bug.vy = -range(rng, b.jumpSpeedY[0], b.jumpSpeedY[1]);
  bug.mode = 'jump';
  bug.flying = true;
}

function updatePerch(bug: Bug, b: PerchParams, world: World, rng: Rng, dt: number): void {
  if (bug.mode === 'fly') {
    const dx = bug.targetX - bug.x;
    const dy = bug.targetY - bug.y;
    const d = Math.hypot(dx, dy);
    const step = b.flySpeed * dt;
    if (d <= step) {
      bug.x = bug.targetX;
      bug.y = bug.targetY;
      bug.mode = 'perch';
      bug.flying = false;
      bug.timer = range(rng, b.perchTime[0], b.perchTime[1]);
      return;
    }
    bug.x += (dx / d) * step;
    bug.y += (dy / d) * step + Math.sin(bug.age * 9) * 12 * dt;
    bug.facing = dx >= 0 ? 1 : -1;
    return;
  }
  if (bug.mode === 'leave') {
    bug.x += bug.vx * dt;
    bug.y += bug.vy * dt;
    return;
  }
  // perch: 幹を這う（止まりながら）
  bug.moving = false;
  if (b.crawlSpeed > 0 && bug.trunk) {
    if (bug.crawlStop > 0) {
      bug.crawlStop -= dt;
    } else {
      bug.moving = true;
      bug.y += bug.crawlDir * b.crawlSpeed * dt;
      const r = perchRange(bug.trunk);
      if (bug.y < r.top) {
        bug.y = r.top;
        bug.crawlDir = 1;
      } else if (bug.y > r.bottom) {
        bug.y = r.bottom;
        bug.crawlDir = -1;
      }
      if (chance(rng, b.crawlStopRate * dt)) {
        bug.crawlStop = range(rng, b.crawlStopTime[0], b.crawlStopTime[1]);
        if (chance(rng, 0.4)) bug.crawlDir = -bug.crawlDir;
      }
    }
  }
  bug.timer -= dt;
  if (bug.timer > 0) return;
  // 飛び立つ
  if (world.trunks.length > 1 && chance(rng, b.hopTreeChance)) {
    pickPerch(bug, world, rng, bug.trunk);
    bug.mode = 'fly';
    bug.flying = true;
  } else {
    startLeaving(bug, world);
  }
}

function updateMeander(bug: Bug, b: MeanderParams, world: World, rng: Rng, dt: number): void {
  const w = world.width;
  const speed = bug.leaving ? b.leaveSpeed : b.speed;
  if (bug.leaving) {
    const goal = bug.facing > 0 ? -0.35 : Math.PI + 0.35;
    bug.heading = turnToward(bug.heading, goal, 2.5 * dt);
  } else {
    bug.heading += (rng.next() - 0.5) * 2 * ((b.turnJitter * Math.PI) / 180) * dt * 3;
    if (bug.baseY < b.band.top) bug.heading = turnToward(bug.heading, Math.PI / 2, 2 * dt);
    if (bug.baseY > b.band.bottom) bug.heading = turnToward(bug.heading, -Math.PI / 2, 2 * dt);
    if (bug.entered && bug.x < 20) bug.heading = turnToward(bug.heading, 0, 3 * dt);
    if (bug.entered && bug.x > w - 20) bug.heading = turnToward(bug.heading, Math.PI, 3 * dt);
  }
  bug.x += Math.cos(bug.heading) * speed * dt;
  bug.baseY += Math.sin(bug.heading) * speed * dt;
  bug.bobPhase += (TAU / b.bobPeriod) * dt;
  bug.y = bug.baseY + Math.sin(bug.bobPhase) * b.bobAmplitude;
  bug.facing = Math.cos(bug.heading) >= 0 ? 1 : -1;
}

function updateHover(bug: Bug, b: HoverParams, world: World, rng: Rng, dt: number): void {
  const w = world.width;
  if (bug.leaving) {
    bug.anchorVx = bug.facing * b.leaveSpeed;
    bug.anchorY -= 12 * dt;
  } else if (bug.entered) {
    if (bug.anchorX < 30 && bug.anchorVx < 0) bug.anchorVx = -bug.anchorVx;
    if (bug.anchorX > w - 30 && bug.anchorVx > 0) bug.anchorVx = -bug.anchorVx;
  }
  bug.anchorX += bug.anchorVx * dt;
  bug.timer -= dt;
  if (bug.timer <= 0) {
    const a = range(rng, 0, TAU);
    const r = range(rng, 0, b.radius);
    bug.targetX = bug.anchorX + Math.cos(a) * r;
    bug.targetY = Math.min(b.band.bottom, Math.max(b.band.top, bug.anchorY + Math.sin(a) * r));
    bug.timer = range(rng, b.moveInterval[0], b.moveInterval[1]);
  }
  const dx = bug.targetX - bug.x;
  const dy = bug.targetY - bug.y;
  const d = Math.hypot(dx, dy);
  const step = (b.moveSpeed + Math.abs(bug.anchorVx)) * dt;
  if (d > step) {
    bug.x += (dx / d) * step;
    bug.y += (dy / d) * step;
  } else {
    bug.x = bug.targetX;
    bug.y = bug.targetY;
  }
  bug.facing = bug.anchorVx >= 0 ? 1 : -1;
}

function updateDash(bug: Bug, b: DashParams, rng: Rng, dt: number): void {
  if (bug.mode === 'stop') {
    bug.timer -= dt;
    bug.y = bug.baseY + Math.sin(bug.age * 20) * 1.5;
    if (bug.timer <= 0) bug.mode = 'dash';
    return;
  }
  const prevX = bug.x;
  bug.x += bug.vx * dt;
  bug.y = bug.baseY + Math.sin(bug.age * 5) * b.waveAmplitude;
  bug.facing = bug.vx >= 0 ? 1 : -1;
  if (bug.stopX !== null && (prevX - bug.stopX) * (bug.x - bug.stopX) <= 0) {
    bug.stopX = null;
    bug.mode = 'stop';
    bug.timer = range(rng, b.stopTime[0], b.stopTime[1]);
  }
}

function updateZigzag(bug: Bug, b: ZigzagParams, world: World, rng: Rng, dt: number): void {
  const w = world.width;
  if (bug.leaving) {
    const goal = bug.facing > 0 ? -0.3 : Math.PI + 0.3;
    bug.heading = turnToward(bug.heading, goal, 6 * dt);
  } else {
    bug.timer -= dt;
    const outside = bug.y < b.band.top || bug.y > b.band.bottom || (bug.entered && (bug.x < 24 || bug.x > w - 24));
    if (bug.timer <= 0 || (outside && bug.timer < 0.15)) {
      if (outside) {
        const toCenter = Math.atan2((b.band.top + b.band.bottom) / 2 - bug.y, w / 2 - bug.x);
        bug.heading = toCenter + range(rng, -0.7, 0.7);
      } else {
        const turn = (range(rng, b.turnAngle[0], b.turnAngle[1]) * Math.PI) / 180;
        bug.heading += chance(rng, 0.5) ? turn : -turn;
      }
      bug.timer = range(rng, b.turnInterval[0], b.turnInterval[1]);
    }
  }
  const speed = bug.leaving ? b.leaveSpeed : b.speed;
  bug.x += Math.cos(bug.heading) * speed * dt;
  bug.y += Math.sin(bug.heading) * speed * dt;
  bug.facing = Math.cos(bug.heading) >= 0 ? 1 : -1;
}

/** 1 ステップ分、虫を動かす */
export function updateBug(bug: Bug, world: World, rng: Rng, realDt: number): void {
  // 虫の時間だけゆっくり流す
  const dt = realDt * BUG_SPEED_SCALE;
  bug.age += dt;
  if (!bug.leaving && bug.age >= bug.stayLimit) startLeaving(bug, world);
  const b = bug.species.behavior;
  switch (b.pattern) {
    case 'walk':
      updateWalk(bug, b, world, rng, dt);
      break;
    case 'hop':
      updateHop(bug, b, world, rng, dt);
      break;
    case 'perch':
      updatePerch(bug, b, world, rng, dt);
      break;
    case 'meander':
      if (bug.mode === 'leave') {
        bug.mode = 'move';
        bug.heading = Math.atan2(bug.vy, bug.vx);
      }
      updateMeander(bug, b, world, rng, dt);
      break;
    case 'hover':
      if (bug.mode === 'leave') bug.mode = 'move';
      updateHover(bug, b, world, rng, dt);
      break;
    case 'dash':
      updateDash(bug, b, rng, dt);
      break;
    case 'zigzag':
      if (bug.mode === 'leave') {
        bug.mode = 'move';
        bug.heading = Math.atan2(bug.vy, bug.vx);
      }
      updateZigzag(bug, b, world, rng, dt);
      break;
  }
  const hw = bug.species.width / 2;
  const hh = bug.species.height / 2;
  if (!bug.entered && bug.x >= hw && bug.x <= world.width - hw && bug.y >= hh) bug.entered = true;
}

/** 画面外へ完全に出たか（入ってくる途中の虫は除く） */
export function isGone(bug: Bug, world: World, viewHeight: number): boolean {
  const m = Math.max(bug.species.width, bug.species.height) / 2 + 2;
  const out = bug.x < -m || bug.x > world.width + m || bug.y < -m - 40 || bug.y > viewHeight + m;
  if (!out) return false;
  if (bug.entered) return true;
  // 入ってこないまま長く経った虫も片付ける
  return bug.age > 10;
}
