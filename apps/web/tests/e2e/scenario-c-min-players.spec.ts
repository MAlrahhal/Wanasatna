import { test, expect } from '@playwright/test';
import { enterLobbyCreate, enterLobbyJoin } from './helpers';

test.describe('Scenario C — minimum players', () => {
  test('1 or 2 players cannot start Bara AlSalafa; 3 can', async ({ browser }) => {
    const hostContext = await browser.newContext();
    const hostPage = await hostContext.newPage();
    await enterLobbyCreate(hostPage, 'محمد');
    await hostPage.getByRole('button', { name: 'برا السالفة' }).click();

    const startButton = hostPage.getByRole('button', { name: 'بدء اللعبة' });
    await expect(startButton).toBeDisabled();
    await expect(hostPage.getByText('تحتاج لعبة برا السالفة إلى 3 لاعبين على الأقل')).toBeVisible();

    const url = new URL(hostPage.url());
    const roomCode = url.searchParams.get('code')!;

    const p2Context = await browser.newContext();
    const p2Page = await p2Context.newPage();
    await enterLobbyJoin(p2Page, roomCode, 'خالد');
    await hostPage.reload();
    await hostPage.waitForURL(new RegExp(`/lobby\\?code=${roomCode}$`));
    await hostPage.getByRole('button', { name: 'برا السالفة' }).click();
    await expect(hostPage.getByRole('button', { name: 'بدء اللعبة' })).toBeDisabled();

    const p3Context = await browser.newContext();
    const p3Page = await p3Context.newPage();
    await enterLobbyJoin(p3Page, roomCode, 'علي');
    await hostPage.reload();
    await hostPage.waitForURL(new RegExp(`/lobby\\?code=${roomCode}$`));
    await hostPage.getByRole('button', { name: 'برا السالفة' }).click();
    await expect(hostPage.getByRole('button', { name: 'بدء اللعبة' })).toBeEnabled();

    await hostContext.close();
    await p2Context.close();
    await p3Context.close();
  });
});
