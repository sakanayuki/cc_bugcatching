import { describe, expect, it } from 'vitest';
import { isGone, roamRange, spawnBug, updateBug } from './behavior';
import { SPECIES, speciesById } from './bugs';
import { VIEW } from './config';
import { chooseSpecies, Population, targetCount } from './population';
import { createRng } from './rng';
import { createWorld, perchRange } from './world';

describe('虫種表', () => {
  it('仕様どおりの 14 種と得点', () => {
    const table: Record<string, number> = {
      dangomushi: 10,
      tentoumushi: 15,
      monshirochou: 20,
      batta: 30,
      semi: 40,
      kamakiri: 50,
      ageha: 60,
      kabutomushi: 100,
      nokogiri: 120,
      miyama: 150,
      hotaru: 80,
      oniyanma: 180,
      tamamushi: 200,
      ookuwagata: 300,
    };
    expect(SPECIES).toHaveLength(14);
    for (const s of SPECIES) expect(s.points, s.id).toBe(table[s.id]);
    expect(new Set(SPECIES.map((s) => s.id)).size).toBe(14);
  });

  it('主な時間帯に合わせて出現する', () => {
    const only = (id: string) => speciesById(id).weights;
    expect(only('hotaru')).toMatchObject({ day: 0, dusk: 0 });
    expect(only('hotaru').night).toBeGreaterThan(0);
    expect(only('ookuwagata')).toMatchObject({ day: 0, dusk: 0 });
    expect(only('tamamushi')).toMatchObject({ day: 0, night: 0 });
    for (const id of ['kabutomushi', 'nokogiri', 'miyama']) expect(only(id).day, id).toBe(0);
    for (const id of ['dangomushi', 'tentoumushi', 'monshirochou', 'batta', 'semi', 'kamakiri', 'ageha', 'oniyanma']) {
      expect(only(id).night, id).toBe(0);
      expect(only(id).day, id).toBeGreaterThan(0);
    }
  });

  it('レアな虫ほど出現率が低い', () => {
    expect(speciesById('ookuwagata').weights.night).toBeLessThan(speciesById('miyama').weights.night);
    expect(speciesById('miyama').weights.night).toBeLessThan(speciesById('kabutomushi').weights.night);
  });
});

describe('出現', () => {
  it('幅 360 で約 6〜8 匹、横長では幅に比例して増やす', () => {
    const n360 = targetCount(360);
    expect(n360).toBeGreaterThanOrEqual(6);
    expect(n360).toBeLessThanOrEqual(8);
    expect(targetCount(720)).toBe(n360 * 2);
    expect(targetCount(1138) / 1138).toBeCloseTo(n360 / 360, 2);
  });

  it('時間帯外の虫は選ばれない', () => {
    const rng = createRng(1);
    for (let i = 0; i < 500; i++) {
      expect(chooseSpecies(rng, 'night', [])!.weights.night).toBeGreaterThan(0);
      expect(chooseSpecies(rng, 'day', [])!.weights.day).toBeGreaterThan(0);
    }
  });

  it('同時出現の上限を守る', () => {
    const rng = createRng(2);
    const world = createWorld(360);
    const ookuwa = spawnBug(speciesById('ookuwagata'), world, rng, true);
    const onlyOokuwa = [speciesById('ookuwagata'), speciesById('kabutomushi')];
    for (let i = 0; i < 100; i++) expect(chooseSpecies(rng, 'night', [ookuwa], onlyOokuwa)!.id).toBe('kabutomushi');
  });
});

describe('world', () => {
  it('主人公の真上（中央）に幹がある', () => {
    for (const w of [360, 480, 800, 1138]) {
      const world = createWorld(w);
      expect(world.trunks.some((t) => Math.abs(t.x - w / 2) <= 1), `width ${w}`).toBe(true);
      for (const t of world.trunks) {
        expect(t.x).toBeGreaterThan(0);
        expect(t.x).toBeLessThan(w);
      }
    }
  });
});

describe('虫の行動', () => {
  const DT = 1 / 60;

  it('どの虫も滞在中は画面の縦範囲にとどまり、いずれ画面外へ去る', () => {
    const world = createWorld(360);
    for (const sp of SPECIES) {
      for (const initial of [true, false]) {
        const rng = createRng(sp.points * 31 + (initial ? 1 : 0));
        const bug = spawnBug(sp, world, rng, initial);
        let gone = false;
        let wasInside = false;
        for (let t = 0; t < 90 && !gone; t += DT) {
          updateBug(bug, world, rng, DT);
          if (!bug.leaving) {
            expect(bug.y, `${sp.id} y`).toBeGreaterThan(-20);
            expect(bug.y, `${sp.id} y`).toBeLessThan(VIEW.height - 60);
          }
          if (bug.x > 0 && bug.x < world.width) wasInside = true;
          gone = isGone(bug, world, VIEW.height);
        }
        expect(wasInside, `${sp.id} entered`).toBe(true);
        expect(gone, `${sp.id} (initial=${initial}) should leave`).toBe(true);
      }
    }
  });

  it('幹にとまる虫は幹の上にいる', () => {
    const world = createWorld(360);
    const rng = createRng(5);
    const bug = spawnBug(speciesById('semi'), world, rng, true);
    expect(bug.trunk).not.toBeNull();
    const r = perchRange(bug.trunk!);
    expect(Math.abs(bug.x - bug.trunk!.x)).toBeLessThanOrEqual(3);
    expect(bug.y).toBeGreaterThanOrEqual(r.top);
    expect(bug.y).toBeLessThanOrEqual(r.bottom);
  });

  it('プレイヤーが狙える中央の列を虫が通る', () => {
    const world = createWorld(360);
    const rng = createRng(9);
    const pop = new Population(world, rng);
    pop.fill('day');
    let crossings = 0;
    for (let t = 0; t < 30; t += DT) {
      pop.update(DT, 'day');
      crossings += pop.bugs.filter((b) => Math.abs(b.x - 180) < 6 && b.y < 500).length;
    }
    expect(crossings).toBeGreaterThan(100);
  });
});

describe('Population', () => {
  it('90 秒の間、滞在中の虫は目標数を超えず、時間帯外の虫はやがて退場する', () => {
    const world = createWorld(360);
    const rng = createRng(11);
    const pop = new Population(world, rng);
    pop.fill('day');
    const DT = 1 / 60;
    const target = targetCount(360);
    let minCount = Infinity;
    for (let t = 0; t < 90; t += DT) {
      const phase = t < 30 ? 'day' : t < 60 ? 'dusk' : 'night';
      pop.update(DT, phase);
      // 退場中の虫を除けば目標数以内。退場中を含めても 1.5 倍まで
      expect(pop.bugs.filter((b) => !b.leaving).length).toBeLessThanOrEqual(target);
      expect(pop.bugs.length).toBeLessThanOrEqual(Math.ceil(target * 1.5));
      if (t > 5) minCount = Math.min(minCount, pop.bugs.length);
      if (t > 75) {
        for (const b of pop.bugs) expect(b.species.weights.night > 0 || b.leaving, b.species.id).toBe(true);
      }
    }
    expect(minCount).toBeGreaterThanOrEqual(3);
  });

  it('捕獲で取り除いた虫は後で補充される', () => {
    const world = createWorld(360);
    const rng = createRng(12);
    const pop = new Population(world, rng);
    pop.fill('day');
    const n = pop.bugs.length;
    pop.remove(pop.bugs[0]!);
    expect(pop.bugs.length).toBe(n - 1);
    for (let t = 0; t < 3; t += 1 / 60) pop.update(1 / 60, 'day');
    expect(pop.bugs.length).toBeGreaterThanOrEqual(n - 1);
  });

  it('幅が変わっても幹の虫は幹の上に移る', () => {
    const rng = createRng(13);
    const pop = new Population(createWorld(360), rng);
    pop.fill('night');
    const wide = createWorld(800);
    pop.setWorld(wide);
    for (const b of pop.bugs) if (b.trunk) expect(wide.trunks).toContain(b.trunk);
  });
});

describe('草むら・木の裏からの登場', () => {
  it('画面端以外から現れる虫がいて、現れた位置は画面内で中央寄り', () => {
    const world = createWorld(360);
    const rng = createRng(21);
    let hidden = 0;
    const n = 400;
    for (let i = 0; i < n; i++) {
      const sp = SPECIES[i % SPECIES.length]!;
      const bug = spawnBug(sp, world, rng, false);
      if (bug.appear > 0) {
        hidden++;
        expect(bug.x, sp.id).toBeGreaterThan(0);
        expect(bug.x, sp.id).toBeLessThan(world.width);
        expect(bug.entered).toBe(true);
      }
    }
    expect(hidden / n).toBeGreaterThan(0.5);
  });

  it('オニヤンマは常に画面端から横切る', () => {
    const world = createWorld(360);
    const rng = createRng(22);
    for (let i = 0; i < 50; i++) {
      const bug = spawnBug(speciesById('oniyanma'), world, rng, false);
      expect(bug.appear).toBe(0);
      expect(bug.x < 0 || bug.x > world.width).toBe(true);
    }
  });

  it('動き回る範囲は画面幅に比例し、中央を含む', () => {
    for (const w of [360, 1138]) {
      const world = createWorld(w);
      const r = roamRange(world, 10);
      expect(r.min).toBeLessThan(w / 2);
      expect(r.max).toBeGreaterThan(w / 2);
      expect(r.max - r.min).toBeLessThan(w);
    }
  });

  it('中央レーンに虫がいない時間が長く続かない', () => {
    for (const w of [360, 1138]) {
      for (let seed = 1; seed <= 3; seed++) {
        const world = createWorld(w);
        const pop = new Population(world, createRng(seed));
        pop.fill('day');
        const DT = 1 / 60;
        let empty = 0;
        let longest = 0;
        for (let t = 0; t < 90; t += DT) {
          pop.update(DT, t < 30 ? 'day' : t < 60 ? 'dusk' : 'night');
          const inLane = pop.bugs.some((b) => Math.abs(b.x - w / 2) < 30 && b.y > 60 && b.y < 500);
          empty = inLane ? 0 : empty + DT;
          longest = Math.max(longest, empty);
        }
        expect(longest, `width ${w} seed ${seed}`).toBeLessThan(6);
      }
    }
  });
});
