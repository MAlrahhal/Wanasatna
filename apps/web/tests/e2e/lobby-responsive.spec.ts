import { expect, test } from '@playwright/test';
import { enterLobbyCreate } from './helpers';

const mobileViewports = [
  { width: 320, height: 568 },
  { width: 360, height: 800 },
  { width: 375, height: 667 },
  { width: 390, height: 844 },
  { width: 393, height: 852 },
  { width: 393, height: 873 },
  { width: 430, height: 932 },
] as const;

type Box = { x: number; y: number; width: number; height: number };

function boxesOverlap(left: Box, right: Box): boolean {
  return !(
    left.x + left.width <= right.x ||
    right.x + right.width <= left.x ||
    left.y + left.height <= right.y ||
    right.y + right.height <= left.y
  );
}

test('lobby header keeps its room code and controls accessible on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  const playerName = 'ABCDEFGHIJKLMNOPQRST';
  const roomCode = await enterLobbyCreate(page, playerName);
  const code = page.getByText(roomCode, { exact: true }).first();
  const playerNameLabel = page.getByText(playerName, { exact: true }).first();

  for (const viewport of mobileViewports) {
    await page.setViewportSize(viewport);
    await expect(code).toBeVisible();

    const codeMetrics = await code.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      return {
        clientWidth: element.clientWidth,
        scrollWidth: element.scrollWidth,
        left: rect.left,
        right: rect.right,
      };
    });
    expect(codeMetrics.clientWidth, `${viewport.width}px room code width`).toBeGreaterThan(0);
    expect
      .soft(codeMetrics.scrollWidth, `${viewport.width}px room code must not be clipped`)
      .toBeLessThanOrEqual(codeMetrics.clientWidth + 1);
    expect(codeMetrics.left).toBeGreaterThanOrEqual(0);
    expect(codeMetrics.right).toBeLessThanOrEqual(viewport.width);

    const documentMetrics = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }));
    expect(
      documentMetrics.scrollWidth,
      `${viewport.width}px must not scroll horizontally`,
    ).toBeLessThanOrEqual(documentMetrics.clientWidth);

    const audio = page.getByTestId('game-audio-control');
    const menuToggle = page.getByRole('button', { name: 'فتح قائمة الغرفة' });
    const controlBoxes: Box[] = [];
    for (const control of [audio, menuToggle]) {
      await expect(control).toBeVisible();
      const box = await control.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.width).toBeGreaterThanOrEqual(44);
      expect(box!.height).toBeGreaterThanOrEqual(44);
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width);
      controlBoxes.push(box!);
    }
    const codeCardBox = await code.locator('..').boundingBox();
    expect(codeCardBox).not.toBeNull();
    for (const controlBox of controlBoxes) {
      expect(boxesOverlap(codeCardBox!, controlBox)).toBe(false);
    }

    await menuToggle.click();
    for (const label of ['تغيير الأيقونة', 'نسخ الرمز', 'مشاركة الغرفة']) {
      const control = page.getByRole('button', { name: label });
      await expect(control).toBeVisible();
      const box = await control.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.height).toBeGreaterThanOrEqual(44);
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width);
    }

    const openMenuDocumentMetrics = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }));
    expect(openMenuDocumentMetrics.scrollWidth).toBeLessThanOrEqual(
      openMenuDocumentMetrics.clientWidth,
    );
    await page.getByRole('button', { name: 'إغلاق قائمة الغرفة' }).click();

    await page.getByRole('button', { name: 'اللاعبون' }).click();
    await expect(playerNameLabel).toBeVisible();
    const playerNameBox = await playerNameLabel.boundingBox();
    expect(playerNameBox).not.toBeNull();
    expect(playerNameBox!.x).toBeGreaterThanOrEqual(0);
    expect(playerNameBox!.x + playerNameBox!.width).toBeLessThanOrEqual(viewport.width);
    const playerDocumentMetrics = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }));
    expect(playerDocumentMetrics.scrollWidth).toBeLessThanOrEqual(
      playerDocumentMetrics.clientWidth,
    );
    await page.getByRole('button', { name: 'الألعاب' }).click();
  }
});
