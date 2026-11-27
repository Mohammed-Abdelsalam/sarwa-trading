import { expect, gotoApp, openMarkets, rowSymbols, stockRows, test } from './fixtures';

test.describe('Markets · desktop two-pane', () => {
  test.beforeEach(async ({ page }) => {
    await openMarkets(page);
  });

  test('a sector chip filters the rows', async ({ page }) => {
    const all = await stockRows(page).count();
    const energy = page.getByRole('tab', { name: 'Energy' });

    await energy.click();

    await expect(energy).toHaveAttribute('aria-selected', 'true');
    await expect.poll(() => stockRows(page).count()).toBeLessThan(all);
    await expect(stockRows(page).first()).toBeVisible();
  });

  test('the sort button cycles and reorders the list', async ({ page }) => {
    const sort = page.getByRole('button', { name: /^Sort by/ });
    await expect(sort).toHaveAccessibleName(/% Change, descending/);

    await sort.click();
    await expect(sort).toHaveAccessibleName(/% Change, ascending/);
    await sort.click();
    await expect(sort).toHaveAccessibleName(/Name, ascending/);

    const symbols = await rowSymbols(page);
    expect(symbols).toEqual([...symbols].sort());
  });

  test('search filters as you type, shows an empty state and clears', async ({ page }) => {
    const all = await stockRows(page).count();
    const search = page.getByRole('textbox', { name: 'Search' });

    await search.pressSequentially('apple');
    await expect(search).toHaveValue('apple');
    await expect(stockRows(page)).toHaveCount(1);
    await expect(page.locator('[data-row="AAPL"]')).toBeVisible();

    await search.fill('');
    await search.pressSequentially('zzqx');
    await expect(page.getByText('No matches for “zzqx”')).toBeVisible();

    await page.getByRole('button', { name: 'Clear search' }).click();
    await expect(search).toHaveValue('');
    await expect(stockRows(page)).toHaveCount(all);
  });

  test('"/" focuses search from anywhere', async ({ page }) => {
    await page.locator('body').click({ position: { x: 5, y: 300 } });
    await page.keyboard.press('/');

    await expect(page.getByRole('textbox', { name: 'Search' })).toBeFocused();
  });

  test('clicking a row selects it into the preview', async ({ page }) => {
    const [first, second] = await rowSymbols(page);
    if (!first || !second) throw new Error('expected at least two stocks');
    await expect(page.locator(`[data-row="${first}"]`)).toHaveAttribute('aria-current', 'true');

    await page.locator(`[data-row="${second}"]`).click();

    await expect(page).toHaveURL(new RegExp(`symbol=${second}`));
    await expect(page.locator(`[data-row="${second}"]`)).toHaveAttribute('aria-current', 'true');
    await expect(page.locator(`[data-row="${first}"]`)).not.toHaveAttribute('aria-current');
    await expect(
      page.getByRole('region', { name: `${second} detail` }).getByRole('heading', { level: 2 }),
    ).toHaveText(second);
  });

  test('arrow keys move the selection and Enter opens the full page', async ({ page }) => {
    const [first, second] = await rowSymbols(page);
    if (!first || !second) throw new Error('expected at least two stocks');

    await page.locator(`[data-row="${first}"]`).focus();
    await page.keyboard.press('ArrowDown');
    await expect(page.locator(`[data-row="${second}"]`)).toBeFocused();
    await expect(page.getByRole('region', { name: `${second} detail` })).toBeVisible();

    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(`/stocks/${second}`);
  });

  test('S and the star button toggle the watchlist label', async ({ page }) => {
    const list = page.getByRole('list', { name: 'Stocks' });
    const [first] = await rowSymbols(page);
    if (!first) throw new Error('expected a stock');

    await list.getByRole('button', { name: `Add ${first} to watchlist` }).click();
    await expect(
      list.getByRole('button', { name: `Remove ${first} from watchlist` }),
    ).toBeVisible();

    await page.locator(`[data-row="${first}"]`).focus();
    await page.keyboard.press('s');
    await expect(list.getByRole('button', { name: `Add ${first} to watchlist` })).toBeVisible();
  });

  test('"Open full page" navigates to the stock', async ({ page }) => {
    const [first] = await rowSymbols(page);
    if (!first) throw new Error('expected a stock');

    await page.getByRole('link', { name: 'Open full page' }).click();

    await expect(page).toHaveURL(`/stocks/${first}`);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });
});

test('search from another page opens Markets filtered', async ({ page }) => {
  await gotoApp(page, '/watchlist');

  await page.getByRole('textbox', { name: 'Search' }).fill('apple');
  await page.keyboard.press('Enter');

  await expect(page).toHaveURL('/?q=apple');
  await expect(page.getByRole('textbox', { name: 'Search' })).toHaveValue('apple');
  await expect(stockRows(page)).toHaveCount(1);
});

test('the preview period tabs switch the preview chart', async ({ page }) => {
  await openMarkets(page);
  const tabs = page.getByRole('region', { name: / detail$/ }).getByRole('tablist', {
    name: 'Chart period',
  });

  await tabs.getByRole('tab', { name: '1Y' }).click();

  await expect(tabs.getByRole('tab', { name: '1Y' })).toHaveAttribute('aria-selected', 'true');
});

test.describe('Markets · mobile', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('a row opens the stock page', async ({ page }) => {
    await openMarkets(page);
    const [first] = await rowSymbols(page);
    if (!first) throw new Error('expected a stock');

    await page.locator(`[data-row="${first}"]`).click();

    await expect(page).toHaveURL(`/stocks/${first}`);
  });

  test('the search toggle opens a search box that filters', async ({ page }) => {
    await openMarkets(page);

    await page.getByRole('button', { name: 'Search' }).click();
    await page.getByRole('textbox', { name: 'Search' }).pressSequentially('nvidia');

    await expect(stockRows(page)).toHaveCount(1);
    await expect(page.locator('[data-row="NVDA"]')).toBeVisible();
  });
});
