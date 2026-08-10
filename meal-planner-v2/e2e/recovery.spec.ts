import { expect, test, type Page } from '@playwright/test';

type StockItem = {
  name: string;
  quantity: string;
  unit: string;
  category: string;
};

async function openHomeStock(page: Page) {
  await page.goto('/#/shopping');
  await page.getByRole('button', { name: 'At home' }).click();
}

async function addHomeStockItem(page: Page, item: StockItem) {
  await page.getByRole('button', { name: 'Add to Home Stock' }).first().click();
  const dialog = page.getByRole('dialog', { name: 'Add to Home Stock' });
  await dialog.getByLabel('Item name').fill(item.name);
  await dialog.getByLabel('Category').selectOption(item.category);
  await dialog.getByLabel('Quantity', { exact: true }).fill(item.quantity);
  await dialog.getByLabel('Unit', { exact: true }).fill(item.unit);
  await dialog.getByRole('button', { name: 'Save to Home Stock' }).click();
  await expect(page.getByRole('heading', { name: item.name })).toBeVisible();
}

async function dismissToasts(page: Page) {
  const dismissButtons = page.getByRole('button', { name: 'Dismiss message' });
  while (await dismissButtons.count()) {
    await dismissButtons.first().click();
  }
}

test('recovers Home Stock, shopping, priority, and stock-only plan from a JSON backup', async ({
  page,
}, testInfo) => {
  await openHomeStock(page);

  await addHomeStockItem(page, {
    name: 'bananas',
    quantity: '0',
    unit: '',
    category: 'produce',
  });
  await page.getByRole('button', { name: 'Add to shop' }).click();

  for (const item of [
    { name: 'salmon fillet', quantity: '600', unit: 'g', category: 'protein' },
    { name: 'new potatoes', quantity: '800', unit: 'g', category: 'produce' },
    { name: 'lemon', quantity: '1', unit: '', category: 'produce' },
    { name: 'fresh dill', quantity: '1', unit: 'bunch', category: 'produce' },
    { name: 'green beans', quantity: '300', unit: 'g', category: 'produce' },
  ]) {
    await addHomeStockItem(page, item);
  }

  const salmonCard = page.locator('.stock-card, .stock-list__item', { hasText: 'salmon fillet' });
  await salmonCard.getByRole('button', { name: 'Use soon' }).click();
  await expect(salmonCard.getByRole('button', { name: 'Remove use soon' })).toBeVisible();

  await page.goto('/#/plan');
  await page.getByRole('button', { name: 'Cook from what I have' }).click();
  await expect(page.getByRole('heading', { name: 'Lemon salmon & new potatoes' })).toBeVisible();
  await dismissToasts(page);
  await page.getByRole('button', { name: 'Plan qualifying dinners' }).click();
  await expect(page.getByLabel('Dinner for Mon')).not.toHaveValue('');

  await page.reload();
  await expect(page.getByLabel('Dinner for Mon')).not.toHaveValue('');
  await openHomeStock(page);
  await expect(page.getByRole('heading', { name: 'bananas' })).toBeVisible();
  await expect(
    page
      .locator('.stock-card, .stock-list__item', { hasText: 'salmon fillet' })
      .getByRole('button', { name: 'Remove use soon' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'To buy' }).click();
  await expect(page.getByText('bananas', { exact: true })).toBeVisible();

  await page.goto('/#/settings');
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export JSON' }).click();
  const download = await downloadPromise;
  const backupPath = testInfo.outputPath('family-table-backup.json');
  await download.saveAs(backupPath);
  await expect(page.getByText('Last successful backup:')).toBeVisible();

  await page.getByRole('button', { name: 'Reset data' }).click();
  await page.getByRole('button', { name: 'Reset everything' }).click();
  await openHomeStock(page);
  await expect(page.getByText('Start your Home Stock')).toBeVisible();
  await page.getByRole('button', { name: 'To buy' }).click();
  await expect(page.getByText('Add a shopping item or plan a dinner')).toBeVisible();

  await page.goto('/#/settings');
  await page.locator('input[type="file"]').setInputFiles(backupPath);
  await expect(page.getByText('Backup imported successfully.')).toBeVisible();
  await openHomeStock(page);
  await expect(page.getByRole('heading', { name: 'bananas' })).toBeVisible();
  await expect(
    page
      .locator('.stock-card, .stock-list__item', { hasText: 'salmon fillet' })
      .getByRole('button', { name: 'Remove use soon' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'To buy' }).click();
  await expect(page.getByText('bananas', { exact: true })).toBeVisible();
  await page.goto('/#/plan');
  await expect(page.getByLabel('Dinner for Mon')).not.toHaveValue('');
});
