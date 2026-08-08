import type { BrowserContext, Page } from '@playwright/test';
import { expect } from '@playwright/test';

export const IMPOSTOR_TEXT = 'أنت برا السالفة';

type TestView = {
  gamePhase?: string;
  isFreeQuestionActivePlayer?: boolean;
  hasVoted?: boolean;
  hasAcknowledgedRole?: boolean;
  isDirectedQuestionActiveAsker?: boolean;
  isHost?: boolean;
  canContinueFromRoundResults?: boolean;
  isImpostorGuessActivePlayer?: boolean;
  hasSubmittedImpostorGuess?: boolean;
  votablePlayers?: Array<{ id: string; name: string }>;
};

type TestActions = {
  getView: () => TestView | null;
  skipFreeQuestionTurn: () => Promise<void>;
  submitVote: (targetPlayerId: string) => Promise<void>;
  submitImpostorGuess: (word: string) => Promise<void>;
  submitRoleUnderstood: () => Promise<void>;
  advanceDirectedQuestion: () => Promise<void>;
  continueFromRoundResults: () => Promise<void>;
};

declare global {
  interface Window {
    __wanasatnaTest?: TestActions;
  }
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function getPages(contexts: BrowserContext[]): Page[] {
  return contexts.map((context) => context.pages()[0]).filter((page): page is Page => Boolean(page));
}

async function readTestView(page: Page): Promise<TestView | null> {
  return page.evaluate(() => window.__wanasatnaTest?.getView() ?? null);
}

async function invokeSkipViaTestHook(page: Page): Promise<boolean> {
  return page.evaluate(async () => {
    const actions = window.__wanasatnaTest;
    if (!actions?.getView()?.isFreeQuestionActivePlayer) {
      return false;
    }

    await actions.skipFreeQuestionTurn();
    return true;
  });
}

export async function enterLobbyCreate(page: Page, playerName: string): Promise<string> {
  await page.goto(`/lobby?action=create&name=${encodeURIComponent(playerName)}`);
  await page.waitForURL(/\/lobby\?code=\d+/, { timeout: 30_000 });
  const url = new URL(page.url());
  const code = url.searchParams.get('code');
  if (!code) {
    throw new Error('room code missing after create');
  }
  expect(url.searchParams.has('name')).toBe(false);
  expect(url.searchParams.has('action')).toBe(false);
  await expect(page.getByText(playerName).first()).toBeVisible({ timeout: 30_000 });
  return code;
}

export async function enterLobbyJoin(page: Page, roomCode: string, playerName: string): Promise<void> {
  await page.goto(
    `/lobby?code=${encodeURIComponent(roomCode)}&name=${encodeURIComponent(playerName)}`,
  );
  await page.waitForURL(new RegExp(`/lobby\\?code=${roomCode}$`), { timeout: 30_000 });
  await expect(page.getByText(playerName).first()).toBeVisible({ timeout: 30_000 });
}

export async function waitForRoster(page: Page, names: string[]): Promise<void> {
  for (const name of names) {
    await expect(page.getByText(name).first()).toBeVisible({ timeout: 30_000 });
  }
}

export async function selectBaraAlSalafaAndStart(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'برا السالفة' }).click();
  await expect(page.getByText('✓ مختارة')).toBeVisible();
  await page.getByRole('button', { name: 'بدء اللعبة' }).click();
  await page.waitForURL('**/game**', { timeout: 30_000 });
}

export async function assertNoPluginNotFound(page: Page): Promise<void> {
  await expect(page.getByText('لم يتم العثور على plugin')).toHaveCount(0);
}

export async function waitForGamePhase(page: Page, ariaLabel: string, timeoutMs = 60_000): Promise<void> {
  await expect(page.locator(`[aria-label="${ariaLabel}"]`)).toBeVisible({ timeout: timeoutMs });
  await assertNoPluginNotFound(page);
}

/** Acknowledge role on every page that has not yet pressed "فهمت". */
export async function driveRoleAcknowledge(pages: Page[], timeoutMs = 30_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const directedVisible = await Promise.all(
      pages.map((page) => page.locator('[aria-label="مرحلة الأسئلة الموجّهة"]').isVisible().catch(() => false)),
    );
    if (directedVisible.every(Boolean)) {
      return;
    }

    let acted = false;

    for (const page of pages) {
      const hooked = await page.evaluate(async () => {
        const actions = window.__wanasatnaTest;
        const view = actions?.getView();
        if (!view || view.hasAcknowledgedRole || view.gamePhase !== 'description') {
          return false;
        }
        await actions!.submitRoleUnderstood();
        return true;
      });
      if (hooked) {
        acted = true;
      }
    }

    if (!acted) {
      for (const page of pages) {
        const ackButton = page.getByRole('button', { name: 'فهمت' });
        if (await ackButton.isVisible().catch(() => false)) {
          await ackButton.click({ force: true });
          acted = true;
        }
      }
    }

    await sleep(300);
  }

  throw new Error('role reveal did not reach directed questions within timeout');
}

/** Advance directed-question turns until free questions begin. */
export async function driveDirectedQuestions(pages: Page[], timeoutMs = 90_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const freeVisible = await Promise.all(
      pages.map((page) => page.locator('[aria-label="مرحلة الأسئلة الحرة"]').isVisible().catch(() => false)),
    );
    if (freeVisible.every(Boolean)) {
      return;
    }

    let acted = false;

    for (const page of pages) {
      const hooked = await page.evaluate(async () => {
        const actions = window.__wanasatnaTest;
        const view = actions?.getView();
        if (!view || view.gamePhase !== 'directed-questions' || !view.isDirectedQuestionActiveAsker) {
          return false;
        }
        await actions!.advanceDirectedQuestion();
        return true;
      });
      if (hooked) {
        acted = true;
      }
    }

    if (!acted) {
      for (const page of pages) {
        const nextButton = page.getByRole('button', { name: 'التالي' });
        if (await nextButton.isVisible().catch(() => false)) {
          await nextButton.click();
          acted = true;
        }
      }
    }

    await sleep(400);
  }

  throw new Error('directed questions did not reach free questions within timeout');
}

/** Host continues from round results when the phase appears. */
export async function driveRoundResultsContinue(hostPage: Page, timeoutMs = 60_000): Promise<void> {
  await waitForGamePhase(hostPage, 'نتائج الجولة', timeoutMs);

  const continuePattern = /^(بدء الجولة التالية|عرض النتائج النهائية)$/;
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const hostButton = hostPage.getByRole('button', { name: continuePattern });
    if (await hostButton.isVisible().catch(() => false)) {
      await hostButton.click();
      await sleep(500);
      return;
    }

    const hooked = await hostPage.evaluate(async () => {
      const actions = window.__wanasatnaTest;
      const view = actions?.getView();
      if (!view || view.gamePhase !== 'round-results' || !view.canContinueFromRoundResults) {
        return false;
      }
      await actions!.continueFromRoundResults();
      return true;
    });
    if (hooked) {
      await sleep(500);
      return;
    }

    await sleep(300);
  }

  throw new Error('host could not continue from round results');
}

/** Drive free-question turns until voting begins (UI click, then test-hook fallback). */
export async function driveFreeQuestions(contexts: BrowserContext[], timeoutMs = 90_000): Promise<void> {
  const pages = getPages(contexts);
  const deadline = Date.now() + timeoutMs;

  await Promise.all(pages.map((page) => waitForGamePhase(page, 'مرحلة الأسئلة الحرة', timeoutMs)));

  while (Date.now() < deadline) {
    const votingOnAll = await Promise.all(
      pages.map((page) => page.locator('[aria-label="مرحلة التصويت"]').isVisible().catch(() => false)),
    );
    if (votingOnAll.every(Boolean)) {
      return;
    }

    let acted = false;

    for (const page of pages) {
      const yourTurn = page.getByText('دورك الآن');
      if (await yourTurn.isVisible().catch(() => false)) {
        await page.getByRole('button', { name: 'تخطي الدور' }).click();
        acted = true;
        await sleep(400);
      }
    }

    if (!acted) {
      for (const page of pages) {
        if (await invokeSkipViaTestHook(page)) {
          acted = true;
          await sleep(400);
        }
      }
    }

    if (!acted) {
      const views = await Promise.all(pages.map((page) => readTestView(page)));
      if (views.some((view) => view?.gamePhase === 'voting')) {
        await Promise.all(pages.map((page) => waitForGamePhase(page, 'مرحلة التصويت', 10_000)));
        return;
      }
    }

    await sleep(300);
  }

  throw new Error('free-questions phase did not reach voting within timeout');
}

export async function driveVoting(contexts: BrowserContext[]): Promise<void> {
  const pages = getPages(contexts);
  const deadline = Date.now() + 120_000;

  while (Date.now() < deadline) {
    const pastVotingOnAll = await Promise.all(
      pages.map((page) =>
        page
          .locator(
            '[aria-label="كشف برا السالفة"], [aria-label="مرحلة تخمين الكلمة"], [aria-label="نتائج الجولة"]',
          )
          .isVisible()
          .catch(() => false),
      ),
    );
    if (pastVotingOnAll.every(Boolean)) {
      return;
    }

    for (const page of pages) {
      const view = await readTestView(page);
      if (view?.hasVoted || view?.gamePhase !== 'voting') {
        continue;
      }

      const hooked = await page.evaluate(async () => {
        const actions = window.__wanasatnaTest;
        const currentView = actions?.getView() as {
          hasVoted?: boolean;
          gamePhase?: string;
          votablePlayers?: Array<{ id: string }>;
        } | null;
        if (!currentView || currentView.hasVoted || currentView.gamePhase !== 'voting') {
          return false;
        }

        const targetId = currentView.votablePlayers?.[0]?.id;
        if (!targetId) {
          return false;
        }

        await actions!.submitVote(targetId);
        return true;
      });

      if (hooked) {
        await sleep(400);
        continue;
      }

      const confirm = page.getByRole('button', { name: 'تأكيد التصويت' });
      if (await confirm.isVisible().catch(() => false)) {
        continue;
      }

      const playerButtons = page.locator('[aria-label="مرحلة التصويت"] button[type="button"]');
      const count = await playerButtons.count();
      for (let index = 0; index < count; index += 1) {
        const candidate = playerButtons.nth(index);
        const label = (await candidate.innerText().catch(() => '')).trim();
        if (!label || label.includes('تأكيد')) {
          continue;
        }
        await candidate.click();
        await page.getByRole('button', { name: 'تأكيد التصويت' }).click();
        break;
      }
    }

    await sleep(500);
  }

  throw new Error('voting did not reach reveal-impostor within timeout');
}

export async function readRoleTexts(pages: Page[]): Promise<string[]> {
  const texts: string[] = [];
  for (const page of pages) {
    const roleSection = page.locator('[aria-label="كشف الدور"]');
    await expect(roleSection).toBeVisible({ timeout: 60_000 });
    const bodyText = await roleSection.innerText();
    texts.push(bodyText);
  }
  return texts;
}

export function assertRolePrivacy(texts: string[]): void {
  const impostorCount = texts.filter((t) => t.includes(IMPOSTOR_TEXT)).length;
  expect(impostorCount).toBe(1);
  const normalTexts = texts.filter((t) => !t.includes(IMPOSTOR_TEXT));
  expect(normalTexts.length).toBe(2);
  const wordMatch = normalTexts[0]?.match(/[\u0600-\u06FF]+/g)?.find((w) => w.length > 2);
  expect(wordMatch).toBeTruthy();
  for (const text of normalTexts) {
    expect(text).toContain(wordMatch!);
  }
}
