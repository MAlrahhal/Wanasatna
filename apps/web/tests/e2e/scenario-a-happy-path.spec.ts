import { test, expect } from '@playwright/test';
import {
  assertNoPluginNotFound,
  assertRolePrivacy,
  driveDirectedQuestions,
  driveFreeQuestions,
  driveRoleAcknowledge,
  driveRoundResultsContinue,
  driveVoting,
  enterLobbyCreate,
  enterLobbyJoin,
  readRoleTexts,
  selectBaraAlSalafaAndStart,
  waitForGamePhase,
  waitForRoster,
} from './helpers';

test.describe('Scenario A — main happy path', () => {
  test('three contexts: lobby → game → phases → no plugin error', async ({ browser }) => {
    test.setTimeout(360_000);

    const context1 = await browser.newContext();
    const context2 = await browser.newContext();
    const context3 = await browser.newContext();
    const page1 = await context1.newPage();
    const page2 = await context2.newPage();
    const page3 = await context3.newPage();
    const contexts = [context1, context2, context3];
    const pages = [page1, page2, page3];

    const roomCode = await enterLobbyCreate(page1, 'محمد');
    await enterLobbyJoin(page2, roomCode, 'خالد');
    await enterLobbyJoin(page3, roomCode, 'علي');

    await waitForRoster(page1, ['محمد', 'خالد', 'علي']);
    await waitForRoster(page2, ['محمد', 'خالد', 'علي']);
    await waitForRoster(page3, ['محمد', 'خالد', 'علي']);

    await page2.reload();
    await page2.waitForURL(new RegExp(`/lobby\\?code=${roomCode}$`));
    await expect(page2.getByText('خالد').first()).toBeVisible();
    await expect(page2.getByText('A player with this name already exists')).toHaveCount(0);

    await selectBaraAlSalafaAndStart(page1);
    await Promise.all(pages.map((p) => p.waitForURL('**/game**')));

    await waitForGamePhase(page1, 'العد التنازلي قبل بدء الجولة', 30_000);
    await Promise.all(pages.map((p) => waitForGamePhase(p, 'كشف الدور', 60_000)));

    const roleTexts = await readRoleTexts(pages);
    assertRolePrivacy(roleTexts);

    await driveRoleAcknowledge(pages);
    await driveDirectedQuestions(pages);
    await Promise.all(pages.map((p) => waitForGamePhase(p, 'مرحلة الأسئلة الحرة', 90_000)));

    await driveFreeQuestions(contexts);
    await Promise.all(pages.map((p) => waitForGamePhase(p, 'مرحلة التصويت', 90_000)));

    await driveVoting(contexts);

    await Promise.all(
      pages.map((p) => waitForGamePhase(p, 'مرحلة تخمين الكلمة', 90_000)),
    );
    await Promise.all(pages.map((p) => waitForGamePhase(p, 'نتائج الجولة', 90_000)));
    await driveRoundResultsContinue(page1);

    for (const page of pages) {
      await assertNoPluginNotFound(page);
      expect(page.url()).toContain('/game');
    }

    await context1.close();
    await context2.close();
    await context3.close();
  });
});
