/**
 * Visual runtime smoke for Guessing Challenge Real3D harness.
 * Requires web on PLAYWRIGHT_BASE_URL (default http://localhost:3000) OR starts nothing —
 * run against `pnpm --filter @wanasatna/web dev` for fast iteration.
 *
 *   cd apps/web && pnpm exec playwright test tests/e2e/gc-real3d-harness.spec.ts --config=playwright.harness.config.ts
 */
import { expect, test } from '@playwright/test';
import path from 'node:path';

const OUT = path.join(__dirname, '../../../test-results/gc-visual');

test.describe('GC Real3D harness visuals', () => {
  test('1v1 scene renders room, opponent, identity text, blank self card', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    await page.goto('/dev/guessing-challenge-scene?mode=1v1', { waitUntil: 'networkidle' });
    await page.getByTestId('harness-1v1').click();
    await expect(page.getByTestId('harness-mode')).toContainText('1v1');
    await expect(page.getByTestId('gc-real3d-scene')).toBeVisible({ timeout: 20_000 });
    await page.waitForTimeout(1500);

    // Identity text must exist in DOM (Html transform on card)
    await expect(page.getByTestId('gc-opponent-identity-text')).toHaveText('برجر', {
      timeout: 10_000,
    });
    // Local card is blank before reveal (no ؟؟؟).
    await expect(page.getByTestId('gc-self-identity-text')).toHaveText('');
    await expect(page.getByTestId('gc-opponent-name')).toHaveText('علي');

    await page.screenshot({
      path: path.join(OUT, '1v1.png'),
      fullPage: true,
    });

    const r3fDataErrors = errors.filter((e) =>
      /Cannot set "data-|R3F:|Real3D scene failed/i.test(e),
    );
    expect(r3fDataErrors, `R3F errors: ${r3fDataErrors.join(' | ')}`).toEqual([]);
  });

  test('2v2 scene is NOT an empty purple box', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    await page.goto('/dev/guessing-challenge-scene?mode=2v2', { waitUntil: 'networkidle' });
    await page.getByTestId('harness-2v2').click();
    await expect(page.getByTestId('harness-mode')).toContainText('2v2');
    await expect(page.getByTestId('gc-real3d-scene')).toBeVisible({ timeout: 20_000 });
    await page.waitForTimeout(2000);

    // Shared identity on card
    await expect(page.getByTestId('gc-opponent-identity-text')).toHaveText('برجر', {
      timeout: 10_000,
    });
    await expect(page.getByTestId('gc-self-identity-text')).toHaveText('');

    // Three name badges: 2 opponents + teammate
    await expect(page.getByTestId('gc-opponent-character-0')).toBeVisible();
    await expect(page.getByTestId('gc-opponent-character-1')).toBeVisible();
    await expect(page.getByTestId('gc-teammate-character')).toBeVisible();

    await page.screenshot({
      path: path.join(OUT, '2v2.png'),
      fullPage: true,
    });

    const r3fDataErrors = errors.filter((e) =>
      /Cannot set "data-|R3F:|Real3D scene failed|data-facing/i.test(e),
    );
    expect(r3fDataErrors, `R3F errors: ${r3fDataErrors.join(' | ')}`).toEqual([]);

    // Screenshot must not be a flat purple clear-color (preserveDrawingBuffer-safe check).
    const scene = page.getByTestId('gc-real3d-scene');
    const box = await scene.boundingBox();
    expect(box).toBeTruthy();
    const shot = await page.screenshot({
      clip: {
        x: box!.x + box!.width * 0.2,
        y: box!.y + box!.height * 0.15,
        width: box!.width * 0.6,
        height: box!.height * 0.55,
      },
    });
    // PNG with real geometry is much larger / more varied than flat clear color.
    expect(shot.byteLength).toBeGreaterThan(8_000);
  });

  test('maximum-size spectator view sees both teams without an avatar', async ({ page }) => {
    await page.goto('/dev/guessing-challenge-scene?panel=spectator&mode=2v2', {
      waitUntil: 'networkidle',
    });

    const scene = page.getByTestId('gc-real3d-scene');
    await expect(scene).toBeVisible({ timeout: 20_000 });
    await expect(scene).toHaveAttribute('data-view-mode', 'spectator');
    await expect(scene).toHaveAttribute('data-spectator-entity', 'false');
    await expect(page.getByTestId('gc-spectator-identity-hud')).toBeVisible();
    await expect(page.getByTestId('gc-spectator-blue-identity-hud')).toHaveAttribute(
      'data-side',
      'left',
    );
    await expect(page.getByTestId('gc-spectator-red-identity-hud')).toHaveAttribute(
      'data-side',
      'right',
    );
    await expect(page.getByTestId('gc-spectator-blue-identity-hud-label')).toHaveText(
      'هوية الأزرق',
    );
    await expect(page.getByTestId('gc-spectator-red-identity-hud-label')).toHaveText('هوية الأحمر');
    await expect(page.getByTestId('gc-spectator-blue-identity-hud-value')).toHaveText('بيتزا');
    await expect(page.getByTestId('gc-spectator-red-identity-hud-value')).toHaveText('برجر');
    await expect(page.getByTestId('gc-spectator-blue-identity-text')).toHaveCount(0);
    await expect(page.getByTestId('gc-spectator-red-identity-text')).toHaveCount(0);
    const names = [
      ['gc-spectator-blue-name-0', 'سارة'],
      ['gc-spectator-blue-name-1', 'محمد'],
      ['gc-spectator-red-name-0', 'علي'],
      ['gc-spectator-red-name-1', 'نورة'],
    ] as const;
    for (const [testId, name] of names) {
      const badge = page.getByTestId(testId);
      await expect(badge).toBeVisible();
      await expect(badge).toHaveText(name);
    }
    await expect(page.getByTestId('gc-fp-special-cards')).toHaveCount(0);

    await page.screenshot({
      path: path.join(OUT, 'spectator-2v2.png'),
      fullPage: true,
    });
  });

  test('spectator framing supports small teams and touch-sized maximum teams', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });

    await page.goto('/dev/guessing-challenge-scene?panel=spectator&mode=1v1', {
      waitUntil: 'networkidle',
    });
    await expect(page.getByTestId('gc-real3d-scene')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId('gc-spectator-blue-name-0')).toBeVisible();
    await expect(page.getByTestId('gc-spectator-red-name-0')).toBeVisible();
    await expect(page.getByTestId('gc-spectator-blue-name-1')).toHaveCount(0);
    await expect(page.getByTestId('gc-spectator-red-name-1')).toHaveCount(0);
    await page.screenshot({
      path: path.join(OUT, 'spectator-1v1.png'),
      fullPage: true,
    });

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/dev/guessing-challenge-scene?panel=spectator&mode=2v2&identity=image', {
      waitUntil: 'networkidle',
    });
    const scene = page.getByTestId('gc-real3d-scene');
    const canvas = scene.locator('canvas');
    await expect(scene).toBeVisible({ timeout: 20_000 });
    await expect(canvas).toBeVisible();
    await expect(page.getByTestId('gc-spectator-blue-name-0')).toBeVisible();
    await expect(page.getByTestId('gc-spectator-blue-name-1')).toBeVisible();
    await expect(page.getByTestId('gc-spectator-red-name-0')).toBeVisible();
    await expect(page.getByTestId('gc-spectator-red-name-1')).toBeVisible();
    await expect(page.getByTestId('gc-recenter-camera')).toBeVisible();
    await expect(page.getByTestId('gc-spectator-blue-identity-hud-value')).toHaveText('بيتزا');
    await expect(page.getByTestId('gc-spectator-red-identity-hud-value')).toHaveText(
      'شعار وناستنا',
    );
    await expect(page.getByTestId('gc-spectator-red-identity-hud-image')).toBeVisible();
    expect(await canvas.evaluate((element) => getComputedStyle(element).touchAction)).toBe('none');

    const beforeDrag = await canvas.screenshot();
    const box = await canvas.boundingBox();
    expect(box).toBeTruthy();
    const blueHudBox = await page.getByTestId('gc-spectator-blue-identity-hud').boundingBox();
    const redHudBox = await page.getByTestId('gc-spectator-red-identity-hud').boundingBox();
    expect(blueHudBox).toBeTruthy();
    expect(redHudBox).toBeTruthy();
    expect(blueHudBox!.x + blueHudBox!.width).toBeLessThan(redHudBox!.x);
    expect(Math.max(blueHudBox!.height, redHudBox!.height)).toBeLessThan(box!.height * 0.3);
    const badgeBoxes = new Map<string, { x: number; y: number; width: number; height: number }>();
    for (const testId of [
      'gc-spectator-blue-name-0',
      'gc-spectator-blue-name-1',
      'gc-spectator-red-name-0',
      'gc-spectator-red-name-1',
    ]) {
      const badgeBox = await page.getByTestId(testId).boundingBox();
      expect(badgeBox).toBeTruthy();
      badgeBoxes.set(testId, badgeBox!);
      expect(badgeBox!.x, `${testId} stays inside the left canvas edge`).toBeGreaterThanOrEqual(
        box!.x,
      );
      expect(
        badgeBox!.x + badgeBox!.width,
        `${testId} stays inside the right canvas edge`,
      ).toBeLessThanOrEqual(box!.x + box!.width);
    }
    const firstNameY = Math.min(...[...badgeBoxes.values()].map((badge) => badge.y));
    expect(
      Math.max(blueHudBox!.y + blueHudBox!.height, redHudBox!.y + redHudBox!.height),
    ).toBeLessThan(firstNameY);
    for (const teamId of ['blue', 'red']) {
      const rear = badgeBoxes.get(`gc-spectator-${teamId}-name-0`)!;
      const front = badgeBoxes.get(`gc-spectator-${teamId}-name-1`)!;
      const verticalOverlap =
        Math.min(rear.y + rear.height, front.y + front.height) - Math.max(rear.y, front.y);
      expect(verticalOverlap, `${teamId} player names do not cover each other`).toBeLessThanOrEqual(
        0,
      );
    }
    await canvas.dispatchEvent('pointerdown', {
      pointerId: 7,
      pointerType: 'touch',
      clientX: box!.x + box!.width * 0.7,
      clientY: box!.y + box!.height * 0.5,
    });
    await canvas.dispatchEvent('pointermove', {
      pointerId: 7,
      pointerType: 'touch',
      clientX: box!.x + box!.width * 0.3,
      clientY: box!.y + box!.height * 0.5,
    });
    await canvas.dispatchEvent('pointerup', {
      pointerId: 7,
      pointerType: 'touch',
      clientX: box!.x + box!.width * 0.3,
      clientY: box!.y + box!.height * 0.5,
    });
    await page.waitForTimeout(150);
    const afterDrag = await canvas.screenshot();
    expect(afterDrag.equals(beforeDrag), 'touch drag changes the local spectator look').toBe(false);

    await page.getByTestId('gc-recenter-camera').click();
    await expect(scene).toHaveAttribute('data-spectator-entity', 'false');
    await page.waitForTimeout(150);
    await page.screenshot({
      path: path.join(OUT, 'spectator-mobile-2v2.png'),
      fullPage: true,
    });
  });
});
