import { isGone, spawnBug, updateBug, type Bug } from './behavior';
import { SPECIES, type Species } from './bugs';
import { SPAWN, VIEW } from './config';
import type { Phase } from './phase';
import { range, weightedPick, type Rng } from './rng';
import type { World } from './world';

/** 表示幅から常時の虫の数（上限）を求める。幅 360 で SPAWN.maxPer360 */
export function targetCount(width: number): number {
  return Math.max(SPAWN.minPer360, Math.round((SPAWN.maxPer360 * width) / VIEW.minWidth));
}

/** 時間帯と画面内の状況から次に出す虫を抽選する */
export function chooseSpecies(
  rng: Rng,
  phase: Phase,
  onScreen: readonly Bug[],
  species: readonly Species[] = SPECIES,
): Species | null {
  return weightedPick(rng, species, (s) => {
    if (s.maxOnScreen !== undefined) {
      const n = onScreen.filter((b) => b.species.id === s.id).length;
      if (n >= s.maxOnScreen) return 0;
    }
    return s.weights[phase];
  });
}

/** 画面内の虫の管理（出現・補充・時間帯外の退場） */
export class Population {
  bugs: Bug[] = [];
  /** 補充待ちのタイマー（秒） */
  private pending: number[] = [];

  constructor(
    private world: World,
    private rng: Rng,
  ) {}

  setWorld(world: World): void {
    this.world = world;
    // 幅が変わったら、幹にとまっている虫を最寄りの幹へ移す
    for (const bug of this.bugs) {
      if (!bug.trunk) continue;
      const trunk = world.trunks.reduce((a, t) => (Math.abs(t.x - bug.x) < Math.abs(a.x - bug.x) ? t : a));
      bug.trunk = trunk;
      if (bug.mode === 'perch') bug.x = trunk.x;
      else bug.targetX = trunk.x;
    }
  }

  /** ゲーム開始時: 画面内に虫を並べる */
  fill(phase: Phase): void {
    this.bugs = [];
    this.pending = [];
    const n = targetCount(this.world.width);
    for (let i = 0; i < n; i++) {
      const sp = chooseSpecies(this.rng, phase, this.bugs);
      if (!sp) break;
      this.bugs.push(spawnBug(sp, this.world, this.rng, true));
    }
  }

  private scheduleRespawn(): void {
    this.pending.push(range(this.rng, SPAWN.minRespawnDelay, SPAWN.maxRespawnDelay));
  }

  /** 捕獲などで虫を取り除く */
  remove(bug: Bug): void {
    const i = this.bugs.indexOf(bug);
    if (i >= 0) {
      this.bugs.splice(i, 1);
      this.scheduleRespawn();
    }
  }

  update(dt: number, phase: Phase): void {
    const world = this.world;
    for (const bug of this.bugs) {
      // 時間帯外になった虫は少し待ってから退場
      if (!bug.leaving && bug.species.weights[phase] <= 0) {
        const limit = bug.age + range(this.rng, SPAWN.minLeaveDelay, SPAWN.maxLeaveDelay);
        if (limit < bug.stayLimit) bug.stayLimit = limit;
      }
      updateBug(bug, world, this.rng, dt);
    }
    for (let i = this.bugs.length - 1; i >= 0; i--) {
      if (isGone(this.bugs[i]!, world, VIEW.height)) {
        this.bugs.splice(i, 1);
        this.scheduleRespawn();
      }
    }
    // 幅が変わった場合も含め、目標数に合わせて補充予定を調整
    const target = targetCount(world.width);
    while (this.bugs.length + this.pending.length < target) this.scheduleRespawn();
    while (this.pending.length > 0 && this.bugs.length + this.pending.length > target) this.pending.pop();

    for (let i = this.pending.length - 1; i >= 0; i--) {
      this.pending[i]! -= dt;
      if (this.pending[i]! > 0) continue;
      this.pending.splice(i, 1);
      const sp = chooseSpecies(this.rng, phase, this.bugs);
      if (sp) this.bugs.push(spawnBug(sp, world, this.rng, false));
      else this.scheduleRespawn();
    }
  }
}
