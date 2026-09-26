// 虫の種類と行動パラメータ。出現率・得点・動きの調整はここで行う。
import type { PhaseWeights } from './phase';

/** 画面上の高さの帯（ゲーム領域の y） */
export interface Band {
  top: number;
  bottom: number;
}

interface Common {
  /** 行動中の最大滞在時間（秒）。過ぎると画面外へ退場する */
  stay: [number, number];
  /** 退場するときの速さ（px/s） */
  leaveSpeed: number;
}

/** 歩行: 地面・枝・低木を左右にゆっくり進む。ときどき止まり、ときどき素早く動く */
export interface WalkParams extends Common {
  pattern: 'walk';
  lane: Band;
  speed: number;
  /** 1 秒あたりに立ち止まる確率 */
  pauseRate: number;
  pauseTime: [number, number];
  /** 1 秒あたりに素早く動く確率と、その速さ・時間 */
  burstRate: number;
  burstSpeed: number;
  burstTime: number;
  /** 1 秒あたりに向きを変える確率 */
  turnRate: number;
}

/** 跳躍: 静止・歩行の後、突然大きく跳ぶ */
export interface HopParams extends Common {
  pattern: 'hop';
  lane: Band;
  walkSpeed: number;
  idleTime: [number, number];
  jumpSpeedX: [number, number];
  jumpSpeedY: [number, number];
  gravity: number;
}

/** 静止→飛翔: 木の幹にとまり（ときどき這い）、突然飛び立って別の木へ移る */
export interface PerchParams extends Common {
  pattern: 'perch';
  perchTime: [number, number];
  /** 幹を這う速さ（0 なら動かない） */
  crawlSpeed: number;
  /** 這っている途中で止まる確率（1 秒あたり）と止まる時間 */
  crawlStopRate: number;
  crawlStopTime: [number, number];
  flySpeed: number;
  /** 飛び立ったとき別の木へ移る確率（残りは画面外へ飛び去る） */
  hopTreeChance: number;
}

/** 蛇行: 上下左右へ緩やかに方向を変えながら飛ぶ */
export interface MeanderParams extends Common {
  pattern: 'meander';
  band: Band;
  speed: number;
  /** 進行方向の揺らぎ（度/秒） */
  turnJitter: number;
  /** 上下の揺れ幅と周期（秒） */
  bobAmplitude: number;
  bobPeriod: number;
}

/** ホバリング: 一定位置付近に留まりながら細かく移動する。中心はゆっくり流れる */
export interface HoverParams extends Common {
  pattern: 'hover';
  band: Band;
  radius: number;
  moveInterval: [number, number];
  moveSpeed: number;
  driftSpeed: [number, number];
}

/** 高速直線: 画面を高速で横切る。途中で一瞬空中停止することがある */
export interface DashParams extends Common {
  pattern: 'dash';
  band: Band;
  speed: number;
  stopChance: number;
  stopTime: [number, number];
  waveAmplitude: number;
}

/** 急旋回: 高速移動しながら不規則に進行方向を変える */
export interface ZigzagParams extends Common {
  pattern: 'zigzag';
  band: Band;
  speed: number;
  turnInterval: [number, number];
  /** 1 回の旋回角（度） */
  turnAngle: [number, number];
}

export type Behavior = WalkParams | HopParams | PerchParams | MeanderParams | HoverParams | DashParams | ZigzagParams;
export type Pattern = Behavior['pattern'];

export interface Species {
  id: string;
  name: string;
  points: number;
  /** 見た目のサイズ（スプライトと一致させる） */
  width: number;
  height: number;
  /** 時間帯ごとの出現の重み（0 ならその時間帯には出ない） */
  weights: PhaseWeights;
  /** 画面内に同時に存在できる上限（未指定なら制限なし） */
  maxOnScreen?: number;
  behavior: Behavior;
}

const SKY: Band = { top: 90, bottom: 400 };
const GROUND: Band = { top: 456, bottom: 500 };

export const SPECIES: readonly Species[] = [
  {
    id: 'dangomushi',
    name: 'ダンゴムシ',
    points: 10,
    width: 16,
    height: 16,
    weights: { day: 26, dusk: 8, night: 0 },
    behavior: {
      pattern: 'walk',
      lane: GROUND,
      speed: 11,
      pauseRate: 0.15,
      pauseTime: [0.8, 2.0],
      burstRate: 0,
      burstSpeed: 0,
      burstTime: 0,
      turnRate: 0.03,
      stay: [22, 34],
      leaveSpeed: 22,
    },
  },
  {
    id: 'tentoumushi',
    name: 'テントウムシ',
    points: 15,
    width: 16,
    height: 16,
    weights: { day: 22, dusk: 8, night: 0 },
    behavior: {
      pattern: 'walk',
      lane: { top: 392, bottom: 488 },
      speed: 15,
      pauseRate: 0.25,
      pauseTime: [0.5, 1.4],
      burstRate: 0,
      burstSpeed: 0,
      burstTime: 0,
      turnRate: 0.08,
      stay: [16, 26],
      leaveSpeed: 40,
    },
  },
  {
    id: 'monshirochou',
    name: 'モンシロチョウ',
    points: 20,
    width: 16,
    height: 16,
    weights: { day: 22, dusk: 6, night: 0 },
    behavior: {
      pattern: 'meander',
      band: { top: 150, bottom: 430 },
      speed: 34,
      turnJitter: 70,
      bobAmplitude: 6,
      bobPeriod: 0.5,
      stay: [14, 22],
      leaveSpeed: 45,
    },
  },
  {
    id: 'batta',
    name: 'バッタ',
    points: 30,
    width: 16,
    height: 16,
    weights: { day: 16, dusk: 6, night: 0 },
    behavior: {
      pattern: 'hop',
      lane: GROUND,
      walkSpeed: 8,
      idleTime: [0.8, 2.4],
      jumpSpeedX: [80, 130],
      jumpSpeedY: [170, 230],
      gravity: 420,
      stay: [14, 22],
      leaveSpeed: 120,
    },
  },
  {
    id: 'semi',
    name: 'セミ',
    points: 40,
    width: 16,
    height: 16,
    weights: { day: 14, dusk: 5, night: 0 },
    behavior: {
      pattern: 'perch',
      perchTime: [2.5, 5.5],
      crawlSpeed: 0,
      crawlStopRate: 0,
      crawlStopTime: [0, 0],
      flySpeed: 130,
      hopTreeChance: 0.75,
      stay: [14, 22],
      leaveSpeed: 150,
    },
  },
  {
    id: 'kamakiri',
    name: 'カマキリ',
    points: 50,
    width: 16,
    height: 16,
    weights: { day: 8, dusk: 9, night: 0 },
    behavior: {
      pattern: 'walk',
      lane: { top: 380, bottom: 470 },
      speed: 9,
      pauseRate: 0.35,
      pauseTime: [0.6, 1.8],
      burstRate: 0.3,
      burstSpeed: 90,
      burstTime: 0.3,
      turnRate: 0.1,
      stay: [16, 24],
      leaveSpeed: 45,
    },
  },
  {
    id: 'ageha',
    name: 'アゲハ',
    points: 60,
    width: 16,
    height: 16,
    weights: { day: 8, dusk: 7, night: 0 },
    behavior: {
      pattern: 'meander',
      band: { top: 110, bottom: 400 },
      speed: 46,
      turnJitter: 90,
      bobAmplitude: 28,
      bobPeriod: 1.3,
      stay: [12, 18],
      leaveSpeed: 60,
    },
  },
  {
    id: 'kabutomushi',
    name: 'カブトムシ',
    points: 100,
    width: 16,
    height: 16,
    weights: { day: 0, dusk: 10, night: 18 },
    behavior: {
      pattern: 'perch',
      perchTime: [3, 6],
      crawlSpeed: 7,
      crawlStopRate: 0.4,
      crawlStopTime: [0.8, 2],
      flySpeed: 60,
      hopTreeChance: 0.7,
      stay: [16, 24],
      leaveSpeed: 70,
    },
  },
  {
    id: 'nokogiri',
    name: 'ノコギリクワガタ',
    points: 120,
    width: 16,
    height: 16,
    weights: { day: 0, dusk: 8, night: 14 },
    behavior: {
      pattern: 'perch',
      perchTime: [2.5, 5],
      crawlSpeed: 14,
      crawlStopRate: 0.5,
      crawlStopTime: [0.6, 1.6],
      flySpeed: 70,
      hopTreeChance: 0.6,
      stay: [14, 20],
      leaveSpeed: 80,
    },
  },
  {
    id: 'miyama',
    name: 'ミヤマクワガタ',
    points: 150,
    width: 16,
    height: 16,
    weights: { day: 0, dusk: 3, night: 5 },
    maxOnScreen: 1,
    behavior: {
      pattern: 'perch',
      perchTime: [1.5, 3],
      crawlSpeed: 18,
      crawlStopRate: 0.6,
      crawlStopTime: [0.4, 1.2],
      flySpeed: 80,
      hopTreeChance: 0.85,
      stay: [10, 15],
      leaveSpeed: 90,
    },
  },
  {
    id: 'hotaru',
    name: 'ホタル',
    points: 80,
    width: 16,
    height: 16,
    weights: { day: 0, dusk: 0, night: 20 },
    behavior: {
      pattern: 'hover',
      band: { top: 160, bottom: 470 },
      radius: 22,
      moveInterval: [0.25, 0.7],
      moveSpeed: 45,
      driftSpeed: [6, 16],
      stay: [14, 22],
      leaveSpeed: 35,
    },
  },
  {
    id: 'oniyanma',
    name: 'オニヤンマ',
    points: 180,
    width: 24,
    height: 16,
    weights: { day: 4, dusk: 5, night: 0 },
    maxOnScreen: 1,
    behavior: {
      pattern: 'dash',
      band: SKY,
      speed: 260,
      stopChance: 0.7,
      stopTime: [0.35, 0.75],
      waveAmplitude: 6,
      stay: [8, 8],
      leaveSpeed: 260,
    },
  },
  {
    id: 'tamamushi',
    name: 'タマムシ',
    points: 200,
    width: 16,
    height: 16,
    weights: { day: 0, dusk: 3, night: 0 },
    maxOnScreen: 1,
    behavior: {
      pattern: 'zigzag',
      band: { top: 110, bottom: 420 },
      speed: 150,
      turnInterval: [0.25, 0.6],
      turnAngle: [60, 140],
      stay: [4.5, 6.5],
      leaveSpeed: 170,
    },
  },
  {
    id: 'ookuwagata',
    name: 'オオクワガタ',
    points: 300,
    width: 16,
    height: 16,
    weights: { day: 0, dusk: 0, night: 1.6 },
    maxOnScreen: 1,
    behavior: {
      pattern: 'perch',
      perchTime: [0.8, 1.6],
      crawlSpeed: 34,
      crawlStopRate: 0.7,
      crawlStopTime: [0.3, 0.8],
      flySpeed: 110,
      hopTreeChance: 0.5,
      stay: [5, 7],
      leaveSpeed: 110,
    },
  },
];

export function speciesById(id: string): Species {
  const s = SPECIES.find((sp) => sp.id === id);
  if (!s) throw new Error(`unknown species: ${id}`);
  return s;
}
