import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { addWeeks, startOfWeek } from '../domain/date';
import { createEmptyPlan, SEED_RECIPES } from '../domain/seed';
import type { AppState, ShoppingItem } from '../domain/types';
import {
  LocalStorageMealPlannerRepository,
  type StorageLike,
} from '../repositories/localStorageRepository';
import type { MealPlannerRepository } from '../repositories/mealPlannerRepository';
import { AppProvider, useApp } from './AppProvider';

type AppApi = ReturnType<typeof useApp>;

let mounted: { container: HTMLDivElement; root: Root } | null = null;

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function mixedItem(recipeId = SEED_RECIPES[0].id): ShoppingItem {
  return {
    id: 'shop-mixed-salmon',
    name: 'salmon fillet',
    grossRecipeNeed: 600,
    confirmedStockApplied: 100,
    remainingBuyQuantity: 500,
    unit: 'g',
    category: 'protein',
    sources: ['recipe', 'stock-top-up'],
    sourceRecipeIds: [recipeId],
    sourceHomeStockItemIds: ['stock-salmon'],
    stockTopUpQuantity: 250,
    requiresReview: true,
    checked: true,
  };
}

const manualItem: ShoppingItem = {
  id: 'shop-manual-tablets',
  name: 'Dishwasher tablets',
  grossRecipeNeed: null,
  confirmedStockApplied: 0,
  remainingBuyQuantity: 1,
  unit: 'pack',
  category: 'other',
  sources: ['manual'],
  sourceRecipeIds: [],
  requiresReview: false,
  checked: true,
};

const topUpItem: ShoppingItem = {
  id: 'shop-top-up-milk',
  name: 'milk',
  grossRecipeNeed: null,
  confirmedStockApplied: 0,
  remainingBuyQuantity: 2,
  unit: 'l',
  category: 'dairy',
  sources: ['stock-top-up'],
  sourceRecipeIds: [],
  sourceHomeStockItemIds: ['stock-milk'],
  stockTopUpQuantity: 2,
  requiresReview: false,
  checked: false,
};

function recipeOnlyItem(recipeId = SEED_RECIPES[0].id): ShoppingItem {
  return {
    id: `shop-recipe-${recipeId}`,
    name: 'recipe-only ingredient',
    grossRecipeNeed: 3,
    confirmedStockApplied: 1,
    remainingBuyQuantity: 2,
    unit: 'pieces',
    category: 'other',
    sources: ['recipe'],
    sourceRecipeIds: [recipeId],
    requiresReview: false,
    checked: false,
  };
}

function stateWithShopping(): AppState {
  const weekStart = startOfWeek();
  const nextWeek = addWeeks(weekStart, 1);
  const currentPlan = createEmptyPlan(weekStart, 4);
  const laterPlan = createEmptyPlan(nextWeek, 4);
  currentPlan.slots.monday = {
    ...currentPlan.slots.monday,
    recipeId: SEED_RECIPES[0].id,
    locked: false,
  };
  laterPlan.slots.tuesday = {
    ...laterPlan.slots.tuesday,
    recipeId: SEED_RECIPES[0].id,
    locked: true,
  };
  return {
    schemaVersion: 9,
    recipes: clone(SEED_RECIPES),
    plans: { [weekStart]: currentPlan, [nextWeek]: laterPlan },
    shoppingLists: {
      [weekStart]: [mixedItem(), clone(manualItem), clone(topUpItem), recipeOnlyItem()],
      [nextWeek]: [mixedItem(), clone(manualItem), clone(topUpItem)],
    },
    homeStockItems: [],
    preferences: {
      householdName: 'Test household',
      defaultServings: 4,
      theme: 'system',
      weatherLocation: null,
    },
    lastBackupAt: null,
  };
}

function repositoryFor(state: AppState): MealPlannerRepository {
  return {
    load: () => clone(state),
    save: vi.fn(),
    importData: (serialized) => JSON.parse(serialized) as AppState,
    exportData: (current) => JSON.stringify(current),
    clear: vi.fn(),
  };
}

function Probe({ onUpdate }: { onUpdate: (api: AppApi) => void }) {
  onUpdate(useApp());
  return null;
}

async function renderProvider(repository: MealPlannerRepository) {
  let api: AppApi | null = null;
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  mounted = { container, root };
  await act(async () => {
    root.render(
      <AppProvider repository={repository}>
        <Probe onUpdate={(next) => (api = next)} />
      </AppProvider>,
    );
  });
  return () => {
    if (!api) throw new Error('AppProvider did not render.');
    return api;
  };
}

function expectIndependentRows(items: ShoppingItem[]) {
  expect(items).toEqual(
    expect.arrayContaining([
      {
        ...mixedItem(),
        grossRecipeNeed: null,
        confirmedStockApplied: 0,
        remainingBuyQuantity: 250,
        sources: ['stock-top-up'],
        sourceRecipeIds: [],
      },
      manualItem,
      topUpItem,
    ]),
  );
  expect(items.some((item) => item.sources.includes('recipe'))).toBe(false);
}

afterEach(async () => {
  if (!mounted) return;
  await act(async () => mounted?.root.unmount());
  mounted.container.remove();
  mounted = null;
});

describe('AppProvider shopping invalidation', () => {
  it.each([
    ['setting cuisine intent', (api: AppApi) => api.setCuisineIntent('monday', 'indian')],
    ['choosing a replacement meal', (api: AppApi) => api.setMeal('monday', SEED_RECIPES[1].id)],
    ['clearing a chosen meal', (api: AppApi) => api.setMeal('monday', null)],
  ])('normalizes mixed shopping rows when %s', async (_description, mutate) => {
    const getApi = await renderProvider(repositoryFor(stateWithShopping()));

    await act(async () => mutate(getApi()));

    expectIndependentRows(getApi().shoppingItems);
    if (_description === 'setting cuisine intent') {
      expect(getApi().currentPlan.slots.monday).toMatchObject({
        recipeId: null,
        cuisineIntent: 'indian',
      });
    }
  });

  it('invalidates an edited recipe across weekly lists without touching unrelated rows', async () => {
    const state = stateWithShopping();
    const nextWeek = addWeeks(startOfWeek(), 1);
    const unrelatedRecipe = recipeOnlyItem(SEED_RECIPES[1].id);
    state.shoppingLists[nextWeek].push(unrelatedRecipe);
    const getApi = await renderProvider(repositoryFor(state));

    await act(async () =>
      getApi().upsertRecipe({ ...SEED_RECIPES[0], cuisine: 'indian', name: 'Edited salmon' }),
    );

    expectIndependentRows(getApi().state.shoppingLists[startOfWeek()]);
    expect(getApi().state.shoppingLists[nextWeek]).toEqual(
      expect.arrayContaining([manualItem, topUpItem, unrelatedRecipe]),
    );
    expect(
      getApi().state.shoppingLists[nextWeek].find((item) => item.id === mixedItem().id),
    ).toMatchObject({
      grossRecipeNeed: null,
      confirmedStockApplied: 0,
      remainingBuyQuantity: 250,
      sources: ['stock-top-up'],
      sourceRecipeIds: [],
      requiresReview: true,
      checked: true,
    });
  });

  it('keeps existing weekly shopping data when a new recipe is added', async () => {
    const state = stateWithShopping();
    const originalShoppingLists = clone(state.shoppingLists);
    const getApi = await renderProvider(repositoryFor(state));

    await act(async () =>
      getApi().upsertRecipe({
        ...SEED_RECIPES[0],
        id: 'new-household-recipe',
        name: 'New household recipe',
      }),
    );

    expect(getApi().state.shoppingLists).toEqual(originalShoppingLists);
  });
});

class MemoryStorage implements StorageLike {
  private readonly values = new Map<string, string>();

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }

  removeItem(key: string) {
    this.values.delete(key);
  }
}

describe('AppProvider recipe deletion', () => {
  it('clears cooked slot metadata and round-trips the valid unresolved state', async () => {
    const state = stateWithShopping();
    const weekStart = startOfWeek();
    const nextWeek = addWeeks(weekStart, 1);
    state.plans[weekStart].slots.monday = {
      ...state.plans[weekStart].slots.monday,
      servings: 6,
      cookedAt: '2026-08-16',
      lastCookedAtBeforeCooking: '2026-07-20',
    };
    state.plans[nextWeek].slots.tuesday = {
      ...state.plans[nextWeek].slots.tuesday,
      cookedAt: '2026-08-17',
      lastCookedAtBeforeCooking: null,
    };
    const repository = new LocalStorageMealPlannerRepository(
      new MemoryStorage(),
      'app-provider-delete-test',
    );
    repository.save(state);
    const getApi = await renderProvider(repository);

    await act(async () => getApi().deleteRecipe(SEED_RECIPES[0].id));

    const expectedSlot = {
      recipeId: null,
      kind: 'recipe' as const,
      locked: false,
      servings: 6,
    };
    expect(getApi().state.plans[weekStart].slots.monday).toEqual(expectedSlot);
    expect(getApi().state.plans[nextWeek].slots.tuesday).toEqual({
      ...expectedSlot,
      servings: 4,
    });
    expectIndependentRows(getApi().state.shoppingLists[weekStart]);
    expectIndependentRows(getApi().state.shoppingLists[nextWeek]);

    const reloaded = repository.load();
    expect(reloaded.plans[weekStart].slots.monday).toEqual(expectedSlot);
    expect(reloaded.plans[nextWeek].slots.tuesday).toEqual({
      ...expectedSlot,
      servings: 4,
    });

    const exported = getApi().exportData();
    const imported = repository.importData(exported);
    expect(imported.plans[weekStart].slots.monday).toEqual(expectedSlot);
    expect(imported.plans[nextWeek].slots.tuesday).toEqual({
      ...expectedSlot,
      servings: 4,
    });
    expect(imported.shoppingLists).toEqual(getApi().state.shoppingLists);
  });
});
