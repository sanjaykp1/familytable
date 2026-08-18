import { expect, test, type Locator } from '@playwright/test';

async function expectMinimumTarget(locator: Locator) {
  const box = await locator.boundingBox();
  expect(box, 'control should have a rendered bounding box').not.toBeNull();
  expect(box!.width).toBeGreaterThanOrEqual(44);
  expect(box!.height).toBeGreaterThanOrEqual(44);
}

async function expectNoHorizontalOverflow(locator: Locator) {
  const dimensions = await locator.evaluate((element) => {
    const bounds = element.getBoundingClientRect();
    const offenders = Array.from(element.querySelectorAll<HTMLElement>('*'))
      .map((candidate) => ({
        element: `${candidate.tagName.toLowerCase()}.${candidate.className}`,
        bounds: candidate.getBoundingClientRect(),
      }))
      .filter(({ bounds: candidateBounds }) => candidateBounds.right > bounds.right + 1)
      .slice(0, 5)
      .map(({ element: name, bounds: candidateBounds }) => ({
        element: name,
        left: candidateBounds.left,
        right: candidateBounds.right,
        width: candidateBounds.width,
      }));
    return {
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
      offenders,
    };
  });
  expect(
    dimensions.scrollWidth,
    `expected ${await locator.evaluate((element) => element.className || element.tagName)} not to scroll horizontally; offenders: ${JSON.stringify(dimensions.offenders)}`,
  ).toBeLessThanOrEqual(dimensions.clientWidth);
}

test('guides a mixed-certainty week at 320 px and preserves keyboard focus', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await page.goto('/#/plan');
  await expectNoHorizontalOverflow(page.locator('html'));
  await expectNoHorizontalOverflow(page.locator('.page-content'));

  const mondayTrigger = page.locator('#meal-monday');
  await expectMinimumTarget(mondayTrigger);
  await mondayTrigger.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog', { name: 'Dinner for Monday' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(mondayTrigger).toBeFocused();

  await mondayTrigger.click();
  const mondayDialog = page.getByRole('dialog', { name: 'Dinner for Monday' });
  const choosePath = mondayDialog.getByRole('button', { name: /^Choose a meal/ });
  const cuisinePath = mondayDialog.getByRole('button', { name: /^I feel like/ });
  const inspirePath = mondayDialog.getByRole('button', { name: /^Inspire me/ });
  await expectMinimumTarget(choosePath);
  await expectMinimumTarget(cuisinePath);
  await expectMinimumTarget(inspirePath);
  await choosePath.click();
  const mondayRecipe = mondayDialog
    .locator('.meal-suggestion-card')
    .filter({ hasText: 'Lemon salmon & new potatoes' });
  const chooseMonday = mondayRecipe.getByRole('button', { name: 'Choose for Monday' });
  await expectMinimumTarget(chooseMonday);
  await chooseMonday.click();
  await expect(mondayTrigger).toContainText('Lemon salmon & new potatoes');

  await mondayTrigger.click();
  const chosenMondayDialog = page.getByRole('dialog', { name: 'Dinner for Monday' });
  await chosenMondayDialog.getByRole('button', { name: /^I feel like/ }).click();
  await chosenMondayDialog.getByRole('button', { name: 'Indian', exact: true }).click();
  await expect(mondayTrigger).toContainText('Lemon salmon & new potatoes');
  await chosenMondayDialog.getByRole('button', { name: 'Done' }).click();
  await expect(mondayTrigger).toContainText('Lemon salmon & new potatoes');

  await page.locator('#meal-tuesday').click();
  const tuesdayDialog = page.getByRole('dialog', { name: 'Dinner for Tuesday' });
  await tuesdayDialog.getByRole('button', { name: /^I feel like/ }).click();
  const indianCuisine = tuesdayDialog.getByRole('button', { name: 'Indian', exact: true });
  const done = tuesdayDialog.getByRole('button', { name: 'Done' });
  await expectMinimumTarget(indianCuisine);
  await expectMinimumTarget(done);
  await indianCuisine.click();
  await done.click();
  await expect(page.locator('#meal-tuesday')).toContainText('Indian · meal not chosen');

  await page.locator('#meal-wednesday').click();
  const wednesdayDialog = page.getByRole('dialog', { name: 'Dinner for Wednesday' });
  await wednesdayDialog.getByRole('button', { name: /^Leftovers/ }).click();
  await expect(page.locator('#meal-wednesday')).toContainText('Leftovers');

  await page.getByRole('button', { name: 'Plan my week' }).click();

  await expect(mondayTrigger).toContainText('Lemon salmon & new potatoes');
  await expect(page.locator('#meal-tuesday')).not.toContainText('meal not chosen');
  await expect(page.locator('#meal-wednesday')).toContainText('Leftovers');
  await expectNoHorizontalOverflow(page.locator('html'));
  await expectNoHorizontalOverflow(page.locator('.page-content'));

  await page.locator('#meal-tuesday').click();
  const reopenedTuesday = page.getByRole('dialog', { name: 'Dinner for Tuesday' });
  await reopenedTuesday.getByRole('button', { name: /^I feel like/ }).click();
  await expect(
    reopenedTuesday.getByRole('button', { name: 'Indian', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  const chosenTuesdayRecipe = reopenedTuesday
    .locator('.meal-suggestion-card')
    .filter({ hasText: 'Chosen' });
  await expect(chosenTuesdayRecipe.locator('.eyebrow')).toHaveText('Indian');
  await expect(reopenedTuesday.locator('.meal-suggestion-card__reasons').first()).toBeVisible();
  await expectNoHorizontalOverflow(reopenedTuesday);
});
