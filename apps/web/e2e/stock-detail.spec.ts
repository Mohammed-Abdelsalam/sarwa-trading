import { expect, gotoApp, test } from './fixtures';

test.describe('Stock detail', () => {
  test('each period tab selects and is kept in the URL', async ({ page }) => {
    await gotoApp(page, '/stocks/AAPL');
    const periods = page.getByRole('tablist', { name: 'Chart period' });

    for (const period of ['1W', '1M', '1Y', 'ALL', '1D']) {
      const tab = periods.getByRole('tab', { name: period });
      await tab.click();
      await expect(tab).toHaveAttribute('aria-selected', 'true');
      if (period === '1D') await expect(page).not.toHaveURL(/period=/);
      else await expect(page).toHaveURL(new RegExp(`period=${period}`));
    }
  });

  test('the chart type radio switches to candlesticks', async ({ page }) => {
    await gotoApp(page, '/stocks/AAPL');
    const candle = page.getByRole('radio', { name: 'Candlestick' });

    await candle.click();

    await expect(candle).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByRole('radio', { name: 'Area' })).toHaveAttribute(
      'aria-checked',
      'false',
    );
    await expect(page).toHaveURL(/type=candle/);
  });

  test('a shared link restores period and chart type after reload', async ({ page }) => {
    await gotoApp(page, '/stocks/AAPL?period=1M&type=candle');
    await page.reload();

    await expect(page.getByRole('tab', { name: '1M' })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('radio', { name: 'Candlestick' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
  });

  test('the chart scrubs with the arrow keys', async ({ page }) => {
    await gotoApp(page, '/stocks/AAPL');
    const chart = page.getByRole('slider', { name: 'AAPL price chart' });
    // Live ticks keep changing the numbers, so assert the shape: a point reads "date, $price".
    const summary = /^AAPL (up|down|flat)/;
    await expect(chart).toHaveAttribute('aria-valuetext', summary);

    await chart.focus();
    await page.keyboard.press('ArrowLeft');
    await expect(chart).toHaveAttribute('aria-valuetext', /^[^,]+, \$[\d,.]+$/);

    await page.keyboard.press('Escape');
    await expect(chart).toHaveAttribute('aria-valuetext', summary);
  });

  test('the watchlist button toggles with the symbol in its name', async ({ page }) => {
    await gotoApp(page, '/stocks/AAPL');

    await page.getByRole('button', { name: 'Add AAPL to watchlist' }).click();

    const remove = page.getByRole('button', { name: 'Remove AAPL from watchlist' });
    await expect(remove).toHaveAttribute('aria-pressed', 'true');
    await expect(remove).toHaveText('In watchlist');
  });

  test('similar stocks and breadcrumbs navigate', async ({ page }) => {
    await gotoApp(page, '/stocks/AAPL');
    const similar = page
      .getByRole('heading', { name: /^More in/ })
      .locator('..')
      .getByRole('link');

    await similar.first().click();
    await expect(page).toHaveURL(/\/stocks\/(?!AAPL)[A-Z]+$/);

    await page
      .getByRole('navigation', { name: 'Breadcrumb' })
      .getByRole('link', { name: 'Markets' })
      .click();
    await expect(page).toHaveURL('/');
  });

  test('a removed stock explains itself and links back', async ({ page }) => {
    await gotoApp(page, '/stocks/ZZZZ');

    await expect(
      page.getByRole('heading', { name: 'This stock is no longer available' }),
    ).toBeVisible();
    await page.getByRole('link', { name: 'Back to Markets' }).click();
    await expect(page).toHaveURL('/');
  });

  test('an unknown link shows the not-found page', async ({ page }) => {
    const response = await page.goto('/nope');

    expect(response?.status()).toBe(404);
    await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
  });
});
