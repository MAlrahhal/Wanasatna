// Throwaway repro: drive the create-room flow and dump console/network info.
import { chromium } from '@playwright/test';

const main = async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ locale: 'ar-SA' });
  const page = await context.newPage();

  page.on('console', (msg) => console.log(`[console:${msg.type()}] ${msg.text()}`));
  page.on('pageerror', (error) => console.log(`[pageerror] ${error.message}`));
  page.on('request', (req) => {
    if (req.url().includes('4001')) console.log(`[request] ${req.method()} ${req.url()}`);
  });
  page.on('requestfailed', (req) =>
    console.log(`[requestfailed] ${req.url()} ${req.failure()?.errorText}`),
  );

  await page.goto('http://localhost:3002/lobby?action=create&name=%D9%85%D8%AD%D9%85%D8%AF');

  for (let i = 0; i < 10; i += 1) {
    await page.waitForTimeout(1000);
    if (/\/lobby\?code=\d+/.test(page.url())) break;
  }

  console.log(`[final url] ${page.url()}`);
  const storage = await page.evaluate(() => JSON.stringify(window.localStorage));
  console.log(`[localStorage] ${storage}`);
  const bodyText = await page.evaluate(() => document.body.innerText.slice(0, 600));
  console.log(`[body] ${bodyText.replace(/\n+/g, ' | ')}`);

  await browser.close();
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
