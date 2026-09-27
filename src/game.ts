// シーン（タイトル → プレイ → リザルト）とプレイ中の状態遷移
import { Sound, vibrate } from './audio';
import type { Bug } from './behavior';
import { SPECIES, type Species } from './bugs';
import { hitRadiusFor, pickCatch, rarityFor, summarize, type ResultRow } from './catching';
import { CATCH, NET, RESULT_INPUT_DELAY, TERRAIN, TIME, VIBRATION } from './config';
import type { Input, PressInfo } from './input';
import {
  aimRatio,
  catchAt,
  isHitActive,
  netPose,
  releaseCatch,
  ringCenter,
  stepNet,
  type NetState,
} from './net';
import { phaseAt, phaseBlend, type Phase, type PhaseWeights } from './phase';
import { Population } from './population';
import { mathRng, type Rng } from './rng';
import { loadHighScore, loadMuted, saveHighScore, saveMuted } from './storage';
import { createWorld, type World } from './world';

export type Scene = 'title' | 'play' | 'result';
export type PlayState = 'run' | 'freeze' | 'get' | 'paused';

export interface GetInfo {
  species: Species;
  points: number;
  rarity: number;
}

export interface ResultInfo {
  rows: ResultRow[];
  total: number;
  isRecord: boolean;
}

/** 画面上のボタン領域（キャンバス座標）。描画側が毎フレーム更新する */
export interface HitRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export class Game {
  scene: Scene = 'title';
  play: PlayState = 'run';
  /** 現在のシーン（またはプレイ中の小状態）に入ってからの時間 */
  sceneTime = 0;
  stateTime = 0;

  world: World;
  population: Population;
  net: NetState = { kind: 'ready' };

  remaining: number = TIME.playTime;
  score = 0;
  caught: string[] = [];
  caughtBug: Bug | null = null;
  getInfo: GetInfo | null = null;
  result: ResultInfo | null = null;
  highScore: number;
  muted: boolean;
  /** 一時停止前の状態 */
  private pausedFrom: PlayState = 'run';
  private fullNotified = false;
  private lastTick = Infinity;

  /** 描画側が設定するミュートボタンの位置 */
  muteRect: HitRect = { x: 0, y: 0, w: 0, h: 0 };

  readonly sound: Sound;

  constructor(
    width: number,
    private input: Input,
    rng: Rng = mathRng,
  ) {
    this.world = createWorld(width);
    this.population = new Population(this.world, rng);
    this.population.fill('day');
    this.highScore = loadHighScore();
    this.muted = loadMuted();
    this.sound = new Sound(this.muted);
  }

  get elapsed(): number {
    return TIME.playTime - this.remaining;
  }

  /** タイトルは昼、プレイ中とリザルトは経過時間に応じた時間帯 */
  get phase(): Phase {
    return this.scene === 'title' ? 'day' : phaseAt(this.elapsed);
  }

  get blend(): PhaseWeights {
    return this.scene === 'title' ? { day: 1, dusk: 0, night: 0 } : phaseBlend(this.elapsed);
  }

  /** 網の支点（主人公の手元）。ゲーム領域の座標 */
  get pivot(): { x: number; y: number } {
    return { x: Math.round(this.world.width / 2), y: TERRAIN.heroFeetY - 20 };
  }

  /** 振りかぶり量（ゲージ量）。ゲージ表示中以外は 0 */
  get charge(): number {
    return aimRatio(this.net);
  }

  resize(width: number): void {
    if (width === this.world.width) return;
    this.world = createWorld(width);
    this.population.setWorld(this.world);
  }

  toggleMute(): void {
    this.muted = !this.muted;
    this.sound.setMuted(this.muted);
    saveMuted(this.muted);
    if (!this.muted) this.sound.ui();
  }

  onKey(code: string): void {
    if (code === 'KeyM') {
      this.sound.unlock();
      this.toggleMute();
    }
  }

  /** ページが非表示になったらプレイを一時停止 */
  pause(): void {
    this.input.reset();
    this.sound.stopCharge();
    if (this.scene !== 'play' || this.play === 'paused') return;
    this.pausedFrom = this.play;
    this.setPlay('paused');
    // 押した直後・ゲージ表示中は構えに戻す（再開時に勝手に振らないように）
    if (this.net.kind === 'pressing' || this.net.kind === 'aiming') this.net = { kind: 'ready' };
  }

  private setScene(scene: Scene): void {
    this.scene = scene;
    this.sceneTime = 0;
  }

  private setPlay(state: PlayState): void {
    this.play = state;
    this.stateTime = 0;
  }

  private hitsMute(p: PressInfo): boolean {
    const r = this.muteRect;
    return p.x !== null && p.y !== null && p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;
  }

  startPlay(): void {
    this.setScene('play');
    this.setPlay('run');
    this.remaining = TIME.playTime;
    this.score = 0;
    this.caught = [];
    this.caughtBug = null;
    this.getInfo = null;
    this.result = null;
    this.net = { kind: 'ready' };
    this.fullNotified = false;
    this.lastTick = Infinity;
    this.population.fill('day');
  }

  private finish(): void {
    const { rows, total } = summarize(this.caught, SPECIES);
    const isRecord = total > 0 && saveHighScore(total);
    if (isRecord) this.highScore = total;
    this.result = { rows, total, isRecord };
    this.net = { kind: 'ready' };
    this.caughtBug = null;
    this.sound.end();
    if (isRecord) this.sound.record();
    this.setScene('result');
  }

  /** 固定ステップで呼ばれる */
  update(dt: number): void {
    this.sceneTime += dt;
    this.stateTime += dt;
    const presses = this.input.takePresses();
    const actions: PressInfo[] = [];
    for (const p of presses) {
      this.sound.unlock();
      if (this.hitsMute(p)) {
        this.toggleMute();
        this.input.consume();
      } else {
        actions.push(p);
      }
    }
    switch (this.scene) {
      case 'title':
        this.population.update(dt, 'day');
        if (actions.length > 0) {
          this.input.consume();
          this.sound.ui();
          this.startPlay();
        }
        break;
      case 'play':
        this.updatePlay(dt, actions.length > 0);
        break;
      case 'result':
        if (actions.length > 0 && this.sceneTime >= RESULT_INPUT_DELAY) {
          this.input.consume();
          this.sound.ui();
          this.population.fill('day');
          this.setScene('title');
        }
        break;
    }
  }

  private updatePlay(dt: number, pressed: boolean): void {
    switch (this.play) {
      case 'paused':
        if (pressed) {
          this.input.consume();
          this.setPlay(this.pausedFrom);
        }
        return;
      case 'freeze':
        // 捕獲直後: 世界もタイマーも止める
        this.input.consume();
        if (this.stateTime >= CATCH.freezeTime) {
          this.setPlay('get');
          this.sound.get(this.getInfo?.rarity ?? 1);
        }
        return;
      case 'get':
        // スキップ操作は網操作として扱わない（押し続けても溜めにならない）
        this.input.consume();
        if (this.stateTime >= CATCH.getTime || (pressed && this.stateTime >= CATCH.getSkipDelay)) {
          this.net = releaseCatch(this.net);
          this.caughtBug = null;
          this.getInfo = null;
          this.setPlay('run');
        }
        return;
      case 'run':
        this.updateRun(dt, pressed);
        return;
    }
  }

  private updateRun(dt: number, pressed: boolean): void {
    this.remaining = Math.max(0, this.remaining - dt);
    const phase = phaseAt(this.elapsed);
    this.population.update(dt, phase);

    // 網
    const before = this.net;
    const { state, event } = stepNet(this.net, dt, { pressed, held: this.input.held });
    this.net = state;
    if (event === 'swing') {
      this.sound.swing();
      vibrate(VIBRATION.swing);
    }
    if (this.net.kind === 'aiming') {
      // ゲージの上下に合わせて音程を変え、満タンで合図
      const ratio = aimRatio(this.net);
      this.sound.charge(ratio);
      if (ratio >= 0.98 && !this.fullNotified) {
        this.fullNotified = true;
        this.sound.full();
      } else if (ratio < 0.9) {
        this.fullNotified = false;
      }
    } else if (before.kind === 'aiming') {
      this.sound.stopCharge();
    }
    this.checkCatch(before);

    // 残り時間のカウント音
    const sec = Math.ceil(this.remaining);
    if (sec < this.lastTick && sec <= TIME.warningTime && sec > 0) this.sound.tick(sec <= 3);
    this.lastTick = sec;

    if (this.remaining <= 0) this.finish();
  }

  /** 前ステップから今ステップまでを細かく分けて判定し、高速スイングのすり抜けを防ぐ */
  private checkCatch(before: NetState): void {
    const now = this.net;
    if (!isHitActive(now) && !isHitActive(before)) return;
    const bugs = this.population.bugs;
    if (bugs.length === 0) return;
    const targets = bugs.map((b) => ({
      x: b.x,
      y: b.y,
      hitRadius: hitRadiusFor(b.species.width, b.species.height),
    }));
    const pivot = this.pivot;
    const samples: NetState[] = [];
    if (before.kind === 'swinging') {
      const end = now.kind === 'swinging' ? now.t : before.duration;
      for (let k = 1; k <= NET.hitSubsteps; k++) {
        samples.push({ ...before, t: before.t + ((end - before.t) * k) / NET.hitSubsteps });
      }
    }
    if (now.kind !== 'swinging') samples.push(now);
    for (const s of samples) {
      if (!isHitActive(s)) continue;
      const ring = ringCenter(netPose(s), pivot.x, pivot.y);
      const i = pickCatch(ring.x, ring.y, NET.ringRadius, targets);
      if (i < 0) continue;
      this.onCatch(bugs[i]!, s);
      return;
    }
  }

  private onCatch(bug: Bug, at: NetState): void {
    this.net = catchAt(at);
    this.population.remove(bug);
    const sp = bug.species;
    this.caughtBug = bug;
    this.caught.push(sp.id);
    this.score += sp.points;
    const rarity = rarityFor(sp.points);
    this.getInfo = { species: sp, points: sp.points, rarity };
    this.sound.catch(rarity);
    vibrate(VIBRATION.catch);
    this.input.consume();
    this.setPlay('freeze');
  }
}
