import { expect, gotoApp, openMarkets, test } from './fixtures';

test.describe('Watchlist', () => {
  test('a star from Markets shows up, switches view, and can be removed and undone', async ({
    page,
  }) => {
    await openMarkets(page);
    await page
      .getByRole('list', { name: 'Stocks' })
      .getByRole('button', { name: 'Add NVDA to watchlist' })
      .click();
    await expect(
      page.getByRole('button', { name: 'Remove NVDA from watchlist' }).first(),
    ).toBeVisible();

    await page
      .getByRole('navigation', { name: 'Main' })
      .getByRole('link', { name: 'Watchlist' })
      .click();
    await expect(page.getByRole('heading', { name: 'Watchlist', level: 1 })).toBeVisible();
    await expect(page.getByRole('table')).toContainText('NVDA');

    const grid = page.getByRole('radio', { name: 'Grid view' });
    await grid.click();
    await expect(grid).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByRole('table')).toHaveCount(0);
    await page.reload();
    await expect(page.getByRole('radio', { name: 'Grid view' })).toHaveAttribute(
      'aria-checked',
      'true',
    );

    await page.getByRole('button', { name: 'Remove NVDA from watchlist' }).click();
    await expect(page.getByText('NVDA removed from Watchlist')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Your watchlist is empty' })).toBeVisible();

    await page.getByRole('button', { name: 'Undo' }).click();
    await expect(page.getByRole('link', { name: /NVDA/ })).toBeVisible();
  });

  test('table headers sort the rows', async ({ page }) => {
    await openMarkets(page);
    const list = page.getByRole('list', { name: 'Stocks' });
    await list.getByRole('button', { name: 'Add NVDA to watchlist' }).click();
    await list.getByRole('button', { name: 'Add AAPL to watchlist' }).click();
    await expect(list.getByRole('button', { name: 'Remove AAPL from watchlist' })).toBeVisible();

    await page
      .getByRole('navigation', { name: 'Main' })
      .getByRole('link', { name: 'Watchlist' })
      .click();
    const stock = page.getByRole('columnheader', { name: /Stock/ });
    await stock.getByRole('button').click();
    await expect(stock).toHaveAttribute('aria-sort', 'ascending');
    await expect(page.getByRole('table').getByRole('row').nth(1)).toContainText('AAPL');

    await stock.getByRole('button').click();
    await expect(stock).toHaveAttribute('aria-sort', 'descending');
    await expect(page.getByRole('table').getByRole('row').nth(1)).toContainText('NVDA');
  });

  test('the empty state links back to Markets', async ({ page }) => {
    await gotoApp(page, '/watchlist');

    await page.getByRole('link', { name: 'Browse markets' }).click();

    await expect(page).toHaveURL('/');
  });
});

test.describe('Theme', () => {
  test('the toggle switches the html class and survives a reload', async ({ page }) => {
    await openMarkets(page);
    const html = page.locator('html');
    const startsDark = (await html.getAttribute('class'))?.includes('dark') ?? false;
    const next = startsDark ? 'light' : 'dark';

    await page.getByRole('button', { name: 'Switch theme' }).click();
    await expect(html).toHaveClass(new RegExp(`\\b${next}\\b`));

    await page.reload();
    await expect(html).toHaveClass(new RegExp(`\\b${next}\\b`));
  });
});
