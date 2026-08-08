import { test, expect } from '@playwright/test';
import { enterLobbyCreate, enterLobbyJoin, waitForRoster } from './helpers';

test.describe('Scenario B — session stability', () => {
  test('URL normalizes, refresh reconnects, fresh join uses new identity', async ({ browser }) => {
    const hostContext = await browser.newContext();
    const hostPage = await hostContext.newPage();

    const roomCode = await enterLobbyCreate(hostPage, 'محمد');
    expect(hostPage.url()).toMatch(new RegExp(`/lobby\\?code=${roomCode}$`));

    await hostPage.reload();
    await hostPage.waitForURL(new RegExp(`/lobby\\?code=${roomCode}$`));
    await expect(hostPage.getByText('محمد').first()).toBeVisible();

    const joinerContext = await browser.newContext();
    const joinerPage = await joinerContext.newPage();
    await enterLobbyJoin(joinerPage, roomCode, 'خالد');
    await waitForRoster(joinerPage, ['محمد', 'خالد']);
    expect(joinerPage.url()).toMatch(new RegExp(`/lobby\\?code=${roomCode}$`));

    const thirdContext = await browser.newContext();
    const thirdPage = await thirdContext.newPage();
    await enterLobbyJoin(thirdPage, roomCode, 'علي');
    await waitForRoster(thirdPage, ['محمد', 'خالد', 'علي']);

    await hostContext.close();
    await joinerContext.close();
    await thirdContext.close();
  });
});
