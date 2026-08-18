import { expect, test } from '@playwright/test';

test('keeps client navigation while missing assets receive a non-HTML 404', async ({
  page,
  request,
}) => {
  const missingAsset = await request.get('/assets/definitely-missing-guided-release.js');

  expect(missingAsset.status()).toBe(404);
  expect(missingAsset.headers()['content-type']).toMatch(/^text\/plain\b/i);
  expect(await missingAsset.text()).toBe('Not Found\n');

  await page.goto('/#/plan');
  await expect(page.getByRole('heading', { name: 'Dinner, decided.' })).toBeVisible();

  await page
    .getByRole('navigation', { name: 'Primary navigation' })
    .first()
    .getByRole('button', { name: 'Recipes' })
    .click();

  await expect(page).toHaveURL(/\/#\/recipes$/);
  await expect(page.getByRole('heading', { name: 'Meals worth repeating.' })).toBeVisible();
});
