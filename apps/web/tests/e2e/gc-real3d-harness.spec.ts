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
  test('1v1 scene renders room, opponent, identity text, self ???', async ({ page }) => {
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
    await expect(page.getByTestId('gc-self-identity-text')).toHaveText('؟؟؟');
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
    await expect(page.getByTestId('gc-self-identity-text')).toHaveText('؟؟؟');

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
});
