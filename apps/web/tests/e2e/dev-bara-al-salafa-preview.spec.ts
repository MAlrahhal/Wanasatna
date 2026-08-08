import { test, expect } from '@playwright/test';

const PHASES = [
  'Countdown',
  'Role Reveal',
  'Directed Questions',
  'Free Questions',
  'Voting',
  'Reveal Impostor',
  'Impostor Guess',
  'Round Results',
  'Match Results',
] as const;

const PHASE_ARIA: Record<(typeof PHASES)[number], string> = {
  Countdown: 'العد التنازلي قبل بدء الجولة',
  'Role Reveal': 'كشف الدور',
  'Directed Questions': 'مرحلة الأسئلة الموجّهة',
  'Free Questions': 'مرحلة الأسئلة الحرة',
  Voting: 'مرحلة التصويت',
  'Reveal Impostor': 'كشف برا السالفة',
  'Impostor Guess': 'مرحلة تخمين الكلمة',
  'Round Results': 'نتائج الجولة',
  'Match Results': 'النتائج النهائية',
};

test.describe('Dev preview — /dev/bara-al-salafa', () => {
  test('loads notice and renders every phase without sockets', async ({ page }) => {
    await page.goto('/dev/bara-al-salafa');
    await expect(page.getByText('هذه معاينة تطويرية ولا تستخدم بيانات غرفة حقيقية.')).toBeVisible();

    for (const phase of PHASES) {
      await page.getByRole('button', { name: phase, exact: true }).click();
      await expect(page.locator(`[aria-label="${PHASE_ARIA[phase]}"]`)).toBeVisible();
    }

    await page.getByRole('button', { name: 'برا السالفة', exact: true }).click();
    await page.getByRole('button', { name: 'Role Reveal', exact: true }).click();
    await expect(page.locator('[aria-label="كشف الدور"]')).toBeVisible();

    await page.getByRole('button', { name: 'لاعب عادي', exact: true }).click();
    await page.getByRole('button', { name: 'Role Reveal', exact: true }).click();
    await expect(page.getByRole('button', { name: 'فهمت' })).toBeVisible();

    await page.getByRole('button', { name: 'المضيف', exact: true }).click();
    await page.getByRole('button', { name: 'Round Results', exact: true }).click();
    await expect(page.getByRole('button', { name: 'بدء الجولة التالية' })).toBeVisible();
  });
});
