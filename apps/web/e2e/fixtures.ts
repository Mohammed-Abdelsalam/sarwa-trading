import { test as base, expect, type Locator, type Page } from '@playwright/test';

// Browser noise that is not an app error. Keep it short and say why each entry is safe.
const ALLOWED_CONSOLE_ERRORS: RegExp[] = [
  // Chrome logs the 404 status of a not-found document; the page itself renders fine.
  /Failed to load resource: the server responded with a status of 404/,
];

// Every test fails if the page throws or logs console.error, so a broken interaction can't pass silently.
export const test = base.extend<{ browserErrors: string[] }>({
  browserErrors: [
    async ({ page }, use) => {
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
      page.on('console', (message) => {
        const text = message.text();
        if (message.type() === 'error' && !ALLOWED_CONSOLE_ERRORS.some((r) => r.test(text))) {
          errors.push(`console.error: ${text}`);
        }
      });
      await use(errors);
      expect(errors, 'the browser logged errors').toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };

export function stockRows(page: Page): Locator {
  return page.getByRole('list', { name: 'Stocks' }).locator('[data-row]');
}

export async function rowSymbols(page: Page): Promise<string[]> {
  return stockRows(page).evaluateAll((rows) =>
    rows.map((row) => row.getAttribute('data-row') ?? ''),
  );
}

// The badge reads "Live" only after hydration and the socket connecting, so controls are interactive.
export async function gotoApp(page: Page, path: string): Promise<void> {
  await page.goto(path);
  await expect(page.getByRole('status').filter({ hasText: 'Live' })).toBeVisible();
}

export async function openMarkets(page: Page, path = '/'): Promise<void> {
  await gotoApp(page, path);
  await expect(stockRows(page).first()).toBeVisible();
}
