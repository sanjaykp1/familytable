import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppProvider, useApp } from '../../app/AppProvider';
import { startOfWeek } from '../../domain/date';
import { createEmptyPlan, SEED_RECIPES } from '../../domain/seed';
import { buildShoppingList } from '../../domain/shopping';
import type { AppState, HomeStockItem, ShoppingItem } from '../../domain/types';
import type { MealPlannerRepository } from '../../repositories/mealPlannerRepository';
import { ShoppingPage } from './ShoppingPage';

type Snapshot = {
  homeStockItems: HomeStockItem[];
  shoppingItems: ShoppingItem[];
};

let mounted: { container: HTMLDivElement; root: Root } | null = null;

function stateWith(stock: HomeStockItem[] = []): AppState {
  const weekStart = startOfWeek();
  const plan = createEmptyPlan(weekStart, 4);
  plan.slots.monday = { ...plan.slots.monday, recipeId: 'seed-salmon' };
  return {
    schemaVersion: 8,
    recipes: SEED_RECIPES.map((recipe) => ({
      ...recipe,
      ingredients: recipe.ingredients.map((ingredient) => ({ ...ingredient })),
      seasons: [...recipe.seasons],
      tags: [...recipe.tags],
    })),
    plans: { [weekStart]: plan },
    shoppingLists: { [weekStart]: buildShoppingList(plan, SEED_RECIPES, [], stock) },
    homeStockItems: stock,
    lastBackupAt: null,
    preferences: {
      householdName: 'Test household',
      defaultServings: 4,
      theme: 'system',
      weatherLocation: null,
    },
  };
}

function repositoryFor(state: AppState): MealPlannerRepository {
  return {
    load: () => state,
    save: vi.fn(),
    importData: () => state,
    exportData: () => JSON.stringify(state),
    clear: vi.fn(),
  };
}

function SnapshotProbe({ onUpdate }: { onUpdate: (snapshot: Snapshot) => void }) {
  const { state, shoppingItems } = useApp();
  onUpdate({ homeStockItems: state.homeStockItems, shoppingItems });
  return null;
}

function stockItem(patch: Partial<HomeStockItem> = {}): HomeStockItem {
  return {
    id: 'stock-salmon',
    name: 'salmon fillet',
    kind: 'food',
    category: 'protein',
    location: 'Freezer',
    frozen: false,
    quantity: 200,
    unit: 'g',
    planningPriority: 'normal',
    archived: false,
    updatedAt: '2026-08-10T08:00:00.000Z',
    ...patch,
  };
}

function bananaStock(patch: Partial<HomeStockItem> = {}): HomeStockItem {
  return stockItem({
    id: 'stock-bananas',
    name: 'bananas',
    category: 'produce',
    location: 'Fruit bowl',
    quantity: 0,
    unit: '',
    reorderPoint: 2,
    targetQuantity: 6,
    replenishmentRuleEnabled: true,
    ...patch,
  });
}

async function renderShopping(initialState: AppState) {
  let snapshot: Snapshot | null = null;
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  mounted = { container, root };
  await act(async () => {
    root.render(
      <AppProvider repository={repositoryFor(initialState)}>
        <ShoppingPage onOpenPlan={vi.fn()} />
        <SnapshotProbe onUpdate={(next) => (snapshot = next)} />
      </AppProvider>,
    );
  });
  return { container, snapshot: () => snapshot };
}

async function click(container: Element, name: string) {
  const button = Array.from(container.querySelectorAll('button')).find(
    (candidate) => candidate.textContent?.replace(/\s+/g, ' ').trim() === name,
  );
  if (!button) throw new Error(`Could not find button named ${name}.`);
  await act(async () => button.dispatchEvent(new MouseEvent('click', { bubbles: true })));
}

async function clickWithLabel(container: Element, label: string) {
  const button = container.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`);
  if (!button) throw new Error(`Could not find button labelled ${label}.`);
  await act(async () => button.dispatchEvent(new MouseEvent('click', { bubbles: true })));
}

async function setInputValue(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  setter?.call(input, value);
  await act(async () => input.dispatchEvent(new Event('input', { bubbles: true })));
}

async function toggleCheckbox(input: HTMLInputElement) {
  await act(async () => input.click());
}

afterEach(async () => {
  if (!mounted) return;
  await act(async () => mounted?.root.unmount());
  mounted.container.remove();
  mounted = null;
});

describe('ShoppingPage Home Stock', () => {
  it('switches the shopping list and Home Stock between list and card displays', async () => {
    const page = await renderShopping(stateWith([stockItem()]));

    expect(page.container.querySelector('.shopping-group')).not.toBeNull();
    await click(page.container, 'Cards');
    expect(page.container.querySelector('.shopping-card-grid')).not.toBeNull();

    await click(page.container, 'At home');
    expect(page.container.querySelector('.home-stock__list')).not.toBeNull();
    await click(page.container, 'Cards');
    expect(page.container.querySelector('.home-stock__grid')).not.toBeNull();
    await click(page.container, 'List');
    expect(page.container.querySelector('.home-stock__list')).not.toBeNull();
  });

  it('shows the reconciled happy-path equation for recipe needs', async () => {
    const page = await renderShopping(stateWith([stockItem()]));

    expect(page.container.textContent).toContain('Recipe need 600 g − at home 200 g = buy 400 g');
  });

  it('keeps a zero-stock item visible and adds it to the shop in one action', async () => {
    const page = await renderShopping(
      stateWith([
        stockItem({
          quantity: 0,
          name: 'toilet paper',
          kind: 'household',
          category: 'Household',
          unit: 'rolls',
        }),
      ]),
    );

    await click(page.container, 'At home');
    expect(page.container.textContent).toContain('toilet paper');
    await click(page.container, 'Add to shop');

    expect(page.snapshot()?.shoppingItems).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'toilet paper',
          sources: ['stock-top-up'],
          remainingBuyQuantity: 1,
        }),
      ]),
    );
  });

  it('toggles Use soon without changing the quantity', async () => {
    const page = await renderShopping(stateWith([stockItem()]));

    await click(page.container, 'At home');
    await click(page.container, 'Use soon');

    expect(page.snapshot()?.homeStockItems[0]).toMatchObject({
      planningPriority: 'use-soon',
      quantity: 200,
    });
  });

  it('filters Home Stock to frozen food and labels matching items', async () => {
    const page = await renderShopping(
      stateWith([
        stockItem(),
        stockItem({
          id: 'stock-peas',
          name: 'peas',
          category: 'produce',
          location: 'Freezer',
          frozen: true,
          quantity: 500,
          unit: 'g',
        }),
      ]),
    );

    await click(page.container, 'At home');
    await click(page.container, 'Frozen');

    expect(page.container.textContent).toContain('peas');
    expect(page.container.textContent).toContain('Frozen');
    expect(page.container.textContent).not.toContain('salmon fillet');
  });

  it('stores Frozen as a food-item tag rather than its grocery category', async () => {
    const item = stockItem({ category: 'produce' });
    const page = await renderShopping(stateWith([item]));

    await click(page.container, 'At home');
    await clickWithLabel(page.container, 'Edit salmon fillet');
    const frozen = page.container.querySelector<HTMLInputElement>(
      '.modal-panel input[type="checkbox"]',
    );
    expect(frozen).not.toBeNull();
    await toggleCheckbox(frozen!);
    await click(page.container, 'Save changes');

    expect(page.snapshot()?.homeStockItems[0]).toMatchObject({
      category: 'produce',
      frozen: true,
    });
    expect(page.container.textContent).toContain('Frozen');
  });

  it('edits an existing Home Stock item without replacing its identity', async () => {
    const item = stockItem();
    const page = await renderShopping(stateWith([item]));

    await click(page.container, 'At home');
    await clickWithLabel(page.container, 'Edit salmon fillet');
    const inputs = page.container.querySelectorAll<HTMLInputElement>('.modal-panel input');
    await setInputValue(inputs[1], 'Fridge');
    await setInputValue(inputs[2], '350');
    await click(page.container, 'Save changes');

    expect(page.snapshot()?.homeStockItems).toEqual([
      expect.objectContaining({
        id: item.id,
        name: 'salmon fillet',
        location: 'Fridge',
        quantity: 350,
        planningPriority: 'normal',
        archived: false,
      }),
    ]);
  });

  it('adds a manual household item without a recipe source', async () => {
    const page = await renderShopping(stateWith());

    await click(page.container, 'Add item');
    const inputs = page.container.querySelectorAll<HTMLInputElement>('.modal-panel input');
    await setInputValue(inputs[0], 'dishwasher tablets');
    await click(page.container, 'Add to shop');

    expect(page.snapshot()?.shoppingItems).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'dishwasher tablets',
          sources: ['manual'],
          sourceRecipeIds: [],
        }),
      ]),
    );
  });

  it('keeps an uncertain match explainable and lets the household review it', async () => {
    const page = await renderShopping(stateWith([stockItem({ quantity: 1, unit: 'kg' })]));

    expect(page.container.textContent).toContain('stock needs review');
    await click(page.container, 'Review: buy full amount');

    expect(
      page.snapshot()?.shoppingItems.find((item) => item.name === 'salmon fillet'),
    ).toMatchObject({
      requiresReview: false,
      confirmedStockApplied: 0,
      remainingBuyQuantity: 600,
    });
  });

  it('shows a banana top-up for review and only adds it after acceptance', async () => {
    const page = await renderShopping(stateWith([bananaStock()]));

    expect(page.container.textContent).toContain('top up 6 to reach 6');
    expect(page.snapshot()?.shoppingItems.some((item) => item.name === 'bananas')).toBe(false);

    await click(page.container, 'Accept');

    expect(page.snapshot()?.shoppingItems).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'bananas',
          remainingBuyQuantity: 6,
          stockTopUpQuantity: 6,
          sources: ['stock-top-up'],
        }),
      ]),
    );
    expect(page.snapshot()?.homeStockItems[0].replenishmentSuggestionStatus).toBe('accepted');
  });

  it('persists a dismissed suggestion without adding bananas to shopping', async () => {
    const page = await renderShopping(stateWith([bananaStock()]));

    await click(page.container, 'Dismiss');

    expect(page.snapshot()?.homeStockItems[0].replenishmentSuggestionStatus).toBe('dismissed');
    expect(page.snapshot()?.shoppingItems.some((item) => item.name === 'bananas')).toBe(false);
    expect(page.container.textContent).not.toContain('Replenishment suggestions');
  });

  it('disables a replenishment rule without removing its saved thresholds', async () => {
    const page = await renderShopping(stateWith([bananaStock()]));

    await click(page.container, 'Disable rule');

    expect(page.snapshot()?.homeStockItems[0]).toMatchObject({
      reorderPoint: 2,
      targetQuantity: 6,
      replenishmentRuleEnabled: false,
    });
    expect(page.snapshot()?.shoppingItems.some((item) => item.name === 'bananas')).toBe(false);
  });
});
