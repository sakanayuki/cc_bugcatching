import { expect, test, type Page } from '@playwright/test';

interface DebugGame {
  scene: string;
  play: string;
  net: { kind: string };
  remaining: number;
  world: { width: number };
}

async function state(page: Page): Promise<DebugGame> {
  return page.evaluate(() => {
    const g = (window as unknown as { __mushitori: DebugGame }).__mushitori;
    return { scene: g.scene, play: g.play, net: { kind: g.net.kind }, remaining: g.remaining, world: { width: g.world.width } };
  });
}

test('タイトル → プレイ → 網を振る', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));

  await page.goto('./');
  await page.waitForFunction(() => '__mushitori' in window, undefined, { timeout: 10_000 });
  expect((await state(page)).scene).toBe('title');

  const canvas = page.locator('#game');
  const box = (await canvas.boundingBox())!;
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;

  // タイトルをタップしてスタート
  await page.mouse.click(cx, cy);
  await expect.poll(async () => (await state(page)).scene).toBe('play');

  // スタートのタップは網操作にならない
  expect((await state(page)).net.kind).toBe('ready');

  // 長押し → 離す で網を振る
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await expect.poll(async () => (await state(page)).net.kind).toBe('charging');
  await page.waitForTimeout(400);
  await page.mouse.up();
  await expect.poll(async () => (await state(page)).net.kind).not.toBe('charging');

  // 時間が進んでいる
  await page.waitForTimeout(1500);
  const s = await state(page);
  expect(s.remaining).toBeLessThan(90);

  expect(errors).toEqual([]);
});

test('スペースキーでも操作できる', async ({ page }) => {
  await page.goto('./');
  await page.waitForFunction(() => '__mushitori' in window);
  await page.keyboard.press('Space');
  await expect.poll(async () => (await state(page)).scene).toBe('play');
  await page.keyboard.down('Space');
  await expect.poll(async () => (await state(page)).net.kind).toBe('charging');
  await page.keyboard.up('Space');
  await expect.poll(async () => (await state(page)).net.kind).not.toBe('charging');
});

test('画面の縦横比に応じて森の幅が変わる', async ({ page }) => {
  await page.goto('./');
  await page.waitForFunction(() => '__mushitori' in window);
  const vp = page.viewportSize()!;
  const { world } = await state(page);
  const expected = Math.round(Math.min(1138, Math.max(360, (640 * vp.width) / vp.height)));
  expect(world.width).toBe(expected);
});
