# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: recovery.spec.ts >> recovers Home Stock, shopping, priority, and stock-only plan from a JSON backup
- Location: e2e/recovery.spec.ts:26:1

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByText('bananas')
Expected: visible
Error: strict mode violation: getByText('bananas') resolved to 2 elements:
    1) <span class="sr-only">Mark bananas as bought</span> aka getByText('Mark bananas as bought')
    2) <span class="shopping-line__name">bananas</span> aka getByText('bananas', { exact: true })

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for getByText('bananas')

```

# Page snapshot

```yaml
- generic [ref=f1e3]:
  - complementary [ref=f1e4]:
    - button "Open weekly plan" [ref=f1e5] [cursor=pointer]:
      - generic [ref=f1e11]:
        - strong [ref=f1e12]: The Family Table
        - generic [ref=f1e13]: Local meal planner
    - navigation "Primary navigation" [ref=f1e14]:
      - button "Plan" [ref=f1e15] [cursor=pointer]
      - button "Recipes" [ref=f1e28] [cursor=pointer]
      - button "Shop" [ref=f1e33] [cursor=pointer]
      - button "Settings" [ref=f1e43] [cursor=pointer]
    - generic [ref=f1e48]:
      - generic [ref=f1e49]:
        - generic [ref=f1e50]: Saved on this device
        - button "Use dark theme" [ref=f1e52] [cursor=pointer]
      - paragraph [ref=f1e55]: No account. No cloud. Your household data stays here.
  - main [ref=f1e57]:
    - generic [ref=f1e58]:
      - generic [ref=f1e59]:
        - generic [ref=f1e60]:
          - generic [ref=f1e61]: 10 Aug – 16 Aug
          - heading "Shop & Home Stock." [level=1] [ref=f1e62]
          - paragraph [ref=f1e63]: Check what is at home, then buy only what this week still needs.
        - generic [ref=f1e64]:
          - button "Add item" [ref=f1e65] [cursor=pointer]
          - button "Copy" [ref=f1e69] [cursor=pointer]
          - button "Refresh" [ref=f1e73] [cursor=pointer]
      - generic [ref=f1e79]:
        - group "Shop view" [ref=f1e80]:
          - button "To buy" [active] [pressed] [ref=f1e81] [cursor=pointer]
          - button "At home" [ref=f1e82] [cursor=pointer]
        - group "Shopping list display" [ref=f1e83]:
          - button "List" [pressed] [ref=f1e84] [cursor=pointer]
          - button "Cards" [ref=f1e85] [cursor=pointer]
      - region "Shopping list" [ref=f1e86]:
        - generic [ref=f1e87]:
          - generic [ref=f1e88]:
            - generic [ref=f1e89]: Shopping progress
            - strong [ref=f1e90]: 1 items left
          - generic [ref=f1e91]: 0%
        - generic [ref=f1e93]:
          - generic [ref=f1e94]:
            - heading "Other" [level=2] [ref=f1e95]
            - generic [ref=f1e96]: "1"
          - generic [ref=f1e98]:
            - generic [ref=f1e99] [cursor=pointer]:
              - checkbox "Mark bananas as bought" [ref=f1e100]
              - generic [ref=f1e104]: Mark bananas as bought
            - generic [ref=f1e105]:
              - text: bananas
              - generic [ref=f1e106]: Accepted top-up suggestion · Buy 1
            - generic [ref=f1e107]: "1"
```

# Test source

```ts
  1   | import { expect, test, type Page } from '@playwright/test';
  2   | 
  3   | type StockItem = {
  4   |   name: string;
  5   |   quantity: string;
  6   |   unit: string;
  7   |   category: string;
  8   | };
  9   | 
  10  | async function openHomeStock(page: Page) {
  11  |   await page.goto('/#/shopping');
  12  |   await page.getByRole('button', { name: 'At home' }).click();
  13  | }
  14  | 
  15  | async function addHomeStockItem(page: Page, item: StockItem) {
  16  |   await page.getByRole('button', { name: 'Add to Home Stock' }).first().click();
  17  |   const dialog = page.getByRole('dialog', { name: 'Add to Home Stock' });
  18  |   await dialog.getByLabel('Item name').fill(item.name);
  19  |   await dialog.getByLabel('Category').selectOption(item.category);
  20  |   await dialog.getByLabel('Quantity', { exact: true }).fill(item.quantity);
  21  |   await dialog.getByLabel('Unit', { exact: true }).fill(item.unit);
  22  |   await dialog.getByRole('button', { name: 'Save to Home Stock' }).click();
  23  |   await expect(page.getByRole('heading', { name: item.name })).toBeVisible();
  24  | }
  25  | 
  26  | test('recovers Home Stock, shopping, priority, and stock-only plan from a JSON backup', async ({
  27  |   page,
  28  | }, testInfo) => {
  29  |   await openHomeStock(page);
  30  | 
  31  |   await addHomeStockItem(page, {
  32  |     name: 'bananas',
  33  |     quantity: '0',
  34  |     unit: '',
  35  |     category: 'produce',
  36  |   });
  37  |   await page.getByRole('button', { name: 'Add to shop' }).click();
  38  | 
  39  |   for (const item of [
  40  |     { name: 'salmon fillet', quantity: '600', unit: 'g', category: 'protein' },
  41  |     { name: 'new potatoes', quantity: '800', unit: 'g', category: 'produce' },
  42  |     { name: 'lemon', quantity: '1', unit: '', category: 'produce' },
  43  |     { name: 'fresh dill', quantity: '1', unit: 'bunch', category: 'produce' },
  44  |     { name: 'green beans', quantity: '300', unit: 'g', category: 'produce' },
  45  |   ]) {
  46  |     await addHomeStockItem(page, item);
  47  |   }
  48  | 
  49  |   const salmonCard = page.locator('.stock-card, .stock-list__item', { hasText: 'salmon fillet' });
  50  |   await salmonCard.getByRole('button', { name: 'Use soon' }).click();
  51  |   await expect(salmonCard.getByRole('button', { name: 'Remove use soon' })).toBeVisible();
  52  | 
  53  |   await page.goto('/#/plan');
  54  |   await page.getByRole('button', { name: 'Cook from what I have' }).click();
  55  |   await expect(page.getByRole('heading', { name: 'Lemon salmon & new potatoes' })).toBeVisible();
  56  |   await page.getByRole('button', { name: 'Plan qualifying dinners' }).click();
  57  |   await expect(page.getByLabel('Dinner for Mon')).not.toHaveValue('');
  58  | 
  59  |   await page.reload();
  60  |   await expect(page.getByLabel('Dinner for Mon')).not.toHaveValue('');
  61  |   await openHomeStock(page);
  62  |   await expect(page.getByRole('heading', { name: 'bananas' })).toBeVisible();
  63  |   await expect(
  64  |     page
  65  |       .locator('.stock-card, .stock-list__item', { hasText: 'salmon fillet' })
  66  |       .getByRole('button', { name: 'Remove use soon' }),
  67  |   ).toBeVisible();
  68  |   await page.getByRole('button', { name: 'To buy' }).click();
> 69  |   await expect(page.getByText('bananas')).toBeVisible();
      |                                           ^ Error: expect(locator).toBeVisible() failed
  70  | 
  71  |   await page.goto('/#/settings');
  72  |   const downloadPromise = page.waitForEvent('download');
  73  |   await page.getByRole('button', { name: 'Export JSON' }).click();
  74  |   const download = await downloadPromise;
  75  |   const backupPath = testInfo.outputPath('family-table-backup.json');
  76  |   await download.saveAs(backupPath);
  77  |   await expect(page.getByText('Last successful backup:')).toBeVisible();
  78  | 
  79  |   await page.getByRole('button', { name: 'Reset data' }).click();
  80  |   await page.getByRole('button', { name: 'Reset everything' }).click();
  81  |   await openHomeStock(page);
  82  |   await expect(page.getByText('Start your Home Stock')).toBeVisible();
  83  |   await page.getByRole('button', { name: 'To buy' }).click();
  84  |   await expect(page.getByText('Add a shopping item or plan a dinner')).toBeVisible();
  85  | 
  86  |   await page.goto('/#/settings');
  87  |   await page.locator('input[type="file"]').setInputFiles(backupPath);
  88  |   await expect(page.getByText('Backup imported successfully.')).toBeVisible();
  89  |   await openHomeStock(page);
  90  |   await expect(page.getByRole('heading', { name: 'bananas' })).toBeVisible();
  91  |   await expect(
  92  |     page
  93  |       .locator('.stock-card, .stock-list__item', { hasText: 'salmon fillet' })
  94  |       .getByRole('button', { name: 'Remove use soon' }),
  95  |   ).toBeVisible();
  96  |   await page.getByRole('button', { name: 'To buy' }).click();
  97  |   await expect(page.getByText('bananas')).toBeVisible();
  98  |   await page.goto('/#/plan');
  99  |   await expect(page.getByLabel('Dinner for Mon')).not.toHaveValue('');
  100 | });
  101 | 
```