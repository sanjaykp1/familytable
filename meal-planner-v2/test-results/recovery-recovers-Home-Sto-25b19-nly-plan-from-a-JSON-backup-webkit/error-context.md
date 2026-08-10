# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: recovery.spec.ts >> recovers Home Stock, shopping, priority, and stock-only plan from a JSON backup
- Location: e2e/recovery.spec.ts:26:1

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: locator.click: Test timeout of 30000ms exceeded.
Call log:
  - waiting for locator('.stock-card').filter({ hasText: 'bananas' }).getByRole('button', { name: 'Add to shop' })

```

# Page snapshot

```yaml
- generic [ref=e3]:
  - complementary [ref=e4]:
    - button "Open weekly plan" [ref=e5] [cursor=pointer]:
      - generic [ref=e10]:
        - strong [ref=e11]: The Family Table
        - generic [ref=e12]: Local meal planner
    - navigation "Primary navigation" [ref=e13]:
      - button "Plan" [ref=e14] [cursor=pointer]
      - button "Recipes" [ref=e18] [cursor=pointer]
      - button "Shop" [ref=e22] [cursor=pointer]
      - button "Settings" [ref=e30] [cursor=pointer]
    - generic [ref=e35]:
      - generic [ref=e36]:
        - generic [ref=e37]: Saved on this device
        - button "Use dark theme" [ref=e39] [cursor=pointer]
      - paragraph [ref=e42]: No account. No cloud. Your household data stays here.
  - main [ref=e44]:
    - generic [ref=e45]:
      - generic [ref=e46]:
        - generic [ref=e47]:
          - generic [ref=e48]: 10 Aug – 16 Aug
          - heading "Shop & Home Stock." [level=1] [ref=e49]
          - paragraph [ref=e50]: Check what is at home, then buy only what this week still needs.
        - button "Add to Home Stock" [ref=e52] [cursor=pointer]
      - generic [ref=e57]:
        - group "Shop view" [ref=e58]:
          - button "To buy" [ref=e59] [cursor=pointer]
          - button "At home" [pressed] [ref=e60] [cursor=pointer]
        - group "Home Stock display" [ref=e61]:
          - button "List" [pressed] [ref=e62] [cursor=pointer]
          - button "Cards" [ref=e63] [cursor=pointer]
      - region "Home Stock" [ref=e64]:
        - generic [ref=e65]:
          - generic [ref=e66]:
            - generic [ref=e70]: Search Home Stock
            - textbox "Search Home Stock" [ref=e71]
          - generic [ref=e72]:
            - generic "Filter Home Stock type" [ref=e73]:
              - button "All" [pressed] [ref=e74] [cursor=pointer]
              - button "Food" [ref=e75] [cursor=pointer]
              - button "Household" [ref=e76] [cursor=pointer]
              - button "Frozen" [ref=e77] [cursor=pointer]
            - generic [ref=e91]:
              - generic [ref=e92]: Location
              - combobox "Location" [ref=e93]:
                - option "All locations" [selected]
                - option "Cupboard"
        - generic [ref=e95]:
          - generic [ref=e97]:
            - generic [ref=e98]: Cupboard · food
            - heading "bananas" [level=2] [ref=e99]
          - paragraph [ref=e100]: produce
          - strong [ref=e101]: "0"
          - button "Add to shop" [ref=e103] [cursor=pointer]
          - generic [ref=e104]:
            - button "Edit bananas" [ref=e105] [cursor=pointer]: Edit
            - button "Use soon" [ref=e109] [cursor=pointer]
            - button "Use in next plan" [ref=e110] [cursor=pointer]
            - button "Archive" [ref=e111] [cursor=pointer]
```

# Test source

```ts
  1  | import { expect, test, type Page } from '@playwright/test';
  2  | 
  3  | type StockItem = {
  4  |   name: string;
  5  |   quantity: string;
  6  |   unit: string;
  7  |   category: string;
  8  | };
  9  | 
  10 | async function openHomeStock(page: Page) {
  11 |   await page.goto('/#/shopping');
  12 |   await page.getByRole('button', { name: 'At home' }).click();
  13 | }
  14 | 
  15 | async function addHomeStockItem(page: Page, item: StockItem) {
  16 |   await page.getByRole('button', { name: 'Add to Home Stock' }).first().click();
  17 |   const dialog = page.getByRole('dialog', { name: 'Add to Home Stock' });
  18 |   await dialog.getByLabel('Item name').fill(item.name);
  19 |   await dialog.getByLabel('Category').selectOption(item.category);
  20 |   await dialog.getByLabel('Quantity', { exact: true }).fill(item.quantity);
  21 |   await dialog.getByLabel('Unit', { exact: true }).fill(item.unit);
  22 |   await dialog.getByRole('button', { name: 'Save to Home Stock' }).click();
  23 |   await expect(page.getByRole('heading', { name: item.name })).toBeVisible();
  24 | }
  25 | 
  26 | test('recovers Home Stock, shopping, priority, and stock-only plan from a JSON backup', async ({
  27 |   page,
  28 | }, testInfo) => {
  29 |   await openHomeStock(page);
  30 | 
  31 |   await addHomeStockItem(page, {
  32 |     name: 'bananas',
  33 |     quantity: '0',
  34 |     unit: '',
  35 |     category: 'produce',
  36 |   });
> 37 |   await page.locator('.stock-card', { hasText: 'bananas' }).getByRole('button', { name: 'Add to shop' }).click();
     |                                                                                                          ^ Error: locator.click: Test timeout of 30000ms exceeded.
  38 | 
  39 |   for (const item of [
  40 |     { name: 'salmon fillet', quantity: '600', unit: 'g', category: 'protein' },
  41 |     { name: 'new potatoes', quantity: '800', unit: 'g', category: 'produce' },
  42 |     { name: 'lemon', quantity: '1', unit: '', category: 'produce' },
  43 |     { name: 'fresh dill', quantity: '1', unit: 'bunch', category: 'produce' },
  44 |     { name: 'green beans', quantity: '300', unit: 'g', category: 'produce' },
  45 |   ]) {
  46 |     await addHomeStockItem(page, item);
  47 |   }
  48 | 
  49 |   const salmonCard = page.locator('.stock-card', { hasText: 'salmon fillet' });
  50 |   await salmonCard.getByRole('button', { name: 'Use soon' }).click();
  51 |   await expect(salmonCard.getByRole('button', { name: 'Remove use soon' })).toBeVisible();
  52 | 
  53 |   await page.goto('/#/plan');
  54 |   await page.getByRole('button', { name: 'Cook from what I have' }).click();
  55 |   await expect(page.getByRole('heading', { name: 'Lemon salmon & new potatoes' })).toBeVisible();
  56 |   await page.getByRole('button', { name: 'Plan qualifying dinners' }).click();
  57 |   await expect(page.getByLabel('Dinner for Mon')).not.toHaveValue('');
  58 | 
  59 |   await page.reload();
  60 |   await expect(page.getByLabel('Dinner for Mon')).not.toHaveValue('');
  61 |   await openHomeStock(page);
  62 |   await expect(page.getByRole('heading', { name: 'bananas' })).toBeVisible();
  63 |   await expect(
  64 |     page.locator('.stock-card', { hasText: 'salmon fillet' }).getByRole('button', { name: 'Remove use soon' }),
  65 |   ).toBeVisible();
  66 |   await page.getByRole('button', { name: 'To buy' }).click();
  67 |   await expect(page.getByText('bananas')).toBeVisible();
  68 | 
  69 |   await page.goto('/#/settings');
  70 |   const downloadPromise = page.waitForEvent('download');
  71 |   await page.getByRole('button', { name: 'Export JSON' }).click();
  72 |   const download = await downloadPromise;
  73 |   const backupPath = testInfo.outputPath('family-table-backup.json');
  74 |   await download.saveAs(backupPath);
  75 |   await expect(page.getByText('Last successful backup:')).toBeVisible();
  76 | 
  77 |   await page.getByRole('button', { name: 'Reset data' }).click();
  78 |   await page.getByRole('button', { name: 'Reset everything' }).click();
  79 |   await openHomeStock(page);
  80 |   await expect(page.getByText('Start your Home Stock')).toBeVisible();
  81 |   await page.getByRole('button', { name: 'To buy' }).click();
  82 |   await expect(page.getByText('Add a shopping item or plan a dinner')).toBeVisible();
  83 | 
  84 |   await page.goto('/#/settings');
  85 |   await page.locator('input[type="file"]').setInputFiles(backupPath);
  86 |   await expect(page.getByText('Backup imported successfully.')).toBeVisible();
  87 |   await openHomeStock(page);
  88 |   await expect(page.getByRole('heading', { name: 'bananas' })).toBeVisible();
  89 |   await expect(
  90 |     page.locator('.stock-card', { hasText: 'salmon fillet' }).getByRole('button', { name: 'Remove use soon' }),
  91 |   ).toBeVisible();
  92 |   await page.getByRole('button', { name: 'To buy' }).click();
  93 |   await expect(page.getByText('bananas')).toBeVisible();
  94 |   await page.goto('/#/plan');
  95 |   await expect(page.getByLabel('Dinner for Mon')).not.toHaveValue('');
  96 | });
  97 | 
```