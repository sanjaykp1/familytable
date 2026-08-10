import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppProvider, useApp } from '../../app/AppProvider';
import { startOfWeek } from '../../domain/date';
import { createEmptyPlan, SEED_RECIPES } from '../../domain/seed';
import type {
  AppState,
  HomeStockItem,
  MealPlan,
  Recipe,
  ShoppingItem,
} from '../../domain/types';
import type { MealPlannerRepository } from '../../repositories/mealPlannerRepository';
import { PlanPage } from './PlanPage';

type Snapshot = {
  plan: MealPlan;
  recipes: Recipe[];
  shoppingItems: ShoppingItem[];
  homeStockItems: HomeStockItem[];
};

let mounted: { container: HTMLDivElement; root: Root } | null = null;

function cloneRecipes(recipes: Recipe[]) {
  return recipes.map((recipe) => ({
    ...recipe,
    ingredients: recipe.ingredients.map((ingredient) => ({ ...ingredient })),
    seasons: [...recipe.seasons],
    tags: [...recipe.tags],
  }));
}

function stateWith(recipes: Recipe[] = SEED_RECIPES): AppState {
  const weekStart = startOfWeek();
  return {
    schemaVersion: 7,
    recipes: cloneRecipes(recipes),
    plans: { [weekStart]: createEmptyPlan(weekStart, 4) },
    shoppingLists: {},
    homeStockItems: [],
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
  const { currentPlan, shoppingItems, state } = useApp();
  onUpdate({
    plan: currentPlan,
    recipes: state.recipes,
    shoppingItems,
    homeStockItems: state.homeStockItems,
  });
  return null;
}

async function renderPlan(
  initialState: AppState,
  callbacks: {
    onOpenRecipes?: () => void;
    onOpenShopping?: () => void;
    onOpenSettings?: () => void;
  } = {},
) {
  let snapshot: Snapshot | null = null;
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  mounted = { container, root };

  await act(async () => {
    root.render(
      <AppProvider repository={repositoryFor(initialState)}>
        <PlanPage
          onOpenRecipes={callbacks.onOpenRecipes ?? vi.fn()}
          onOpenShopping={callbacks.onOpenShopping ?? vi.fn()}
          onOpenSettings={callbacks.onOpenSettings ?? vi.fn()}
        />
        <SnapshotProbe onUpdate={(next) => (snapshot = next)} />
      </AppProvider>,
    );
  });

  return {
    container,
    snapshot: () => snapshot,
  };
}

async function click(button: HTMLButtonElement) {
  await act(async () => {
    button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
}

function buttonNamed(container: Element, name: string) {
  const button = Array.from(container.querySelectorAll('button')).find(
    (candidate) => candidate.textContent?.replace(/\s+/g, ' ').trim() === name,
  );
  if (!button) throw new Error(`Could not find button named ${name}.`);
  return button;
}

function buttonWithLabel(container: Element, label: string) {
  const button = container.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`);
  if (!button) throw new Error(`Could not find button labelled ${label}.`);
  return button;
}

afterEach(async () => {
  if (!mounted) return;
  await act(async () => mounted?.root.unmount());
  mounted.container.remove();
  mounted = null;
});

describe('PlanPage', () => {
  it('assigns a recipe, generates the open week, records cooked meals, and prepares shopping', async () => {
    const onOpenShopping = vi.fn();
    const initialState = stateWith();
    initialState.homeStockItems = [
      {
        id: 'stock-salmon',
        name: 'salmon fillet',
        kind: 'food',
        category: 'protein',
        location: 'freezer',
        frozen: false,
        quantity: 200,
        unit: 'g',
        planningPriority: 'normal',
        archived: false,
        updatedAt: '2026-08-10T08:00:00.000Z',
      },
    ];
    const page = await renderPlan(initialState, { onOpenShopping });
    const monday = page.container.querySelector<HTMLSelectElement>('#meal-monday');
    expect(monday).not.toBeNull();

    await act(async () => {
      monday!.value = SEED_RECIPES[0].id;
      monday!.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(page.snapshot()?.plan.slots.monday.recipeId).toBe(SEED_RECIPES[0].id);

    await click(buttonNamed(page.container, 'Plan my week'));
    expect(Object.values(page.snapshot()!.plan.slots).every((slot) => slot.recipeId)).toBe(true);

    const mondayRecipeId = page.snapshot()!.plan.slots.monday.recipeId!;
    const cookedBefore = page
      .snapshot()!
      .recipes.find((recipe) => recipe.id === mondayRecipeId)!.timesCooked;
    await click(buttonWithLabel(page.container, 'Mark Mon dinner cooked'));
    expect(
      page.snapshot()!.recipes.find((recipe) => recipe.id === mondayRecipeId)?.timesCooked,
    ).toBe(cookedBefore + 1);
    expect(page.snapshot()!.homeStockItems[0].quantity).toBe(200);

    await click(buttonNamed(page.container, 'Ready to shop'));
    expect(page.snapshot()!.plan.status).toBe('ready');
    expect(page.snapshot()!.shoppingItems.length).toBeGreaterThan(0);
    expect(page.snapshot()!.homeStockItems[0].quantity).toBe(200);
    await click(
      buttonNamed(page.container, `Open list (${page.snapshot()!.shoppingItems.length})`),
    );
    expect(onOpenShopping).toHaveBeenCalledOnce();
  });

  it('keeps a locked meal unchanged when generating the rest of the week', async () => {
    const initialState = stateWith();
    const monday = initialState.plans[startOfWeek()].slots.monday;
    initialState.plans[startOfWeek()].slots.monday = {
      ...monday,
      recipeId: SEED_RECIPES[0].id,
      locked: true,
      servings: 6,
    };
    const page = await renderPlan(initialState);

    expect(page.container.querySelector<HTMLSelectElement>('#meal-monday')?.disabled).toBe(true);
    await click(buttonNamed(page.container, 'Plan my week'));

    expect(page.snapshot()!.plan.slots.monday).toMatchObject({
      recipeId: SEED_RECIPES[0].id,
      locked: true,
      servings: 6,
    });
    expect(page.snapshot()!.plan.slots.tuesday.recipeId).not.toBeNull();
  });

  it('guides an empty library to Recipes without attempting generation', async () => {
    const onOpenRecipes = vi.fn();
    const page = await renderPlan(stateWith([]), { onOpenRecipes });

    expect(buttonNamed(page.container, 'Plan my week').disabled).toBe(true);
    expect(page.container.textContent).toContain('Start with a family favourite');

    await click(buttonNamed(page.container, 'Add a recipe'));
    expect(onOpenRecipes).toHaveBeenCalledOnce();
    expect(page.snapshot()!.plan.status).toBe('draft');
  });
});
