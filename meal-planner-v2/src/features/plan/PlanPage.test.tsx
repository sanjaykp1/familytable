import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppProvider, useApp } from '../../app/AppProvider';
import { startOfWeek } from '../../domain/date';
import { createEmptyPlan, SEED_RECIPES } from '../../domain/seed';
import type { AppState, HomeStockItem, MealPlan, Recipe, ShoppingItem } from '../../domain/types';
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
    schemaVersion: 9,
    recipes: cloneRecipes(recipes),
    plans: { [weekStart]: createEmptyPlan(weekStart, 4) },
    shoppingLists: {},
    homeStockItems: [],
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

async function chooseRecipe(container: Element, day: string, recipe: Recipe) {
  const trigger = container.querySelector<HTMLButtonElement>(
    `button[aria-label$="dinner for ${day}"]`,
  );
  if (!trigger) throw new Error(`Could not find meal picker trigger for ${day}.`);
  await click(trigger);
  await click(pickerPathButton(container, 'Choose a meal'));
  const card = Array.from(container.querySelectorAll<HTMLElement>('.meal-suggestion-card')).find(
    (candidate) => candidate.querySelector('h3')?.textContent === recipe.name,
  );
  const choose = card?.querySelector<HTMLButtonElement>('button');
  if (!choose) throw new Error(`Could not find ${recipe.name} in the meal picker.`);
  await click(choose);
}

function pickerPathButton(container: Element, label: string) {
  const strong = Array.from(
    container.querySelectorAll<HTMLElement>('.meal-picker__paths strong'),
  ).find((candidate) => candidate.textContent === label);
  const button = strong?.closest('button');
  if (!button) throw new Error(`Could not find meal picker path ${label}.`);
  return button;
}

function optionButton(container: Element, label: string) {
  const strong = Array.from(
    container.querySelectorAll<HTMLElement>('.meal-picker__other-options strong'),
  ).find((candidate) => candidate.textContent === label);
  const button = strong?.closest('button');
  if (!button) throw new Error(`Could not find dinner plan ${label}.`);
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
    await chooseRecipe(page.container, 'Monday', SEED_RECIPES[0]);
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
    expect(page.container.querySelector('.day-row--cooked')).not.toBeNull();
    expect(page.container.textContent).toContain('Cooked');

    await click(buttonWithLabel(page.container, 'Mark Mon dinner cooked'));
    expect(
      page.snapshot()!.recipes.find((recipe) => recipe.id === mondayRecipeId)?.timesCooked,
    ).toBe(cookedBefore);
    expect(page.container.querySelector('.day-row--cooked')).toBeNull();
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

    expect(page.container.querySelector<HTMLButtonElement>('#meal-monday')?.disabled).toBe(true);
    await click(buttonNamed(page.container, 'Plan my week'));

    expect(page.snapshot()!.plan.slots.monday).toMatchObject({
      recipeId: SEED_RECIPES[0].id,
      locked: true,
      servings: 6,
    });
    expect(page.snapshot()!.plan.slots.tuesday.recipeId).not.toBeNull();
  });

  it('preserves an unlocked chosen meal and special plan while satisfying a cuisine intention', async () => {
    const indianRecipe: Recipe = {
      ...SEED_RECIPES[2],
      id: 'indian-dinner',
      name: 'Indian dinner',
      cuisine: 'indian',
    };
    const initialState = stateWith([...SEED_RECIPES, indianRecipe]);
    const plan = initialState.plans[startOfWeek()];
    plan.slots.monday = {
      ...plan.slots.monday,
      recipeId: SEED_RECIPES[0].id,
      locked: false,
      servings: 6,
    };
    plan.slots.tuesday = { ...plan.slots.tuesday, cuisineIntent: 'indian' };
    plan.slots.wednesday = { ...plan.slots.wednesday, kind: 'leftovers' };
    const page = await renderPlan(initialState);

    await click(buttonNamed(page.container, 'Plan my week'));

    expect(page.snapshot()!.plan.slots.monday).toMatchObject({
      recipeId: SEED_RECIPES[0].id,
      locked: false,
      servings: 6,
    });
    expect(page.snapshot()!.plan.slots.tuesday).toMatchObject({
      recipeId: indianRecipe.id,
      cuisineIntent: undefined,
    });
    expect(page.snapshot()!.plan.slots.wednesday.kind).toBe('leftovers');
  });

  it('keeps an unsatisfied cuisine visible and out of the shopping list', async () => {
    const italianRecipe: Recipe = {
      ...SEED_RECIPES[0],
      id: 'italian-dinner',
      cuisine: 'italian',
    };
    const initialState = stateWith([italianRecipe]);
    const plan = initialState.plans[startOfWeek()];
    plan.slots.tuesday = { ...plan.slots.tuesday, cuisineIntent: 'korean' };
    for (const day of [
      'monday',
      'wednesday',
      'thursday',
      'friday',
      'saturday',
      'sunday',
    ] as const) {
      plan.slots[day] = { ...plan.slots[day], kind: 'skip' };
    }
    const page = await renderPlan(initialState);

    await click(buttonNamed(page.container, 'Plan my week'));

    expect(page.snapshot()!.plan.slots.tuesday).toMatchObject({
      recipeId: null,
      cuisineIntent: 'korean',
    });
    expect(page.container.textContent).toContain('No saved Korean meal matches yet.');

    await click(buttonNamed(page.container, 'Ready to shop'));
    expect(page.snapshot()!.shoppingItems).toEqual([]);
  });

  it('clears the current plan and its shopping list after confirmation', async () => {
    const initialState = stateWith();
    const plan = initialState.plans[startOfWeek()];
    initialState.plans[startOfWeek()] = {
      ...plan,
      status: 'ready',
      slots: {
        ...plan.slots,
        monday: { ...plan.slots.monday, recipeId: SEED_RECIPES[0].id, locked: true },
        tuesday: { ...plan.slots.tuesday, kind: 'leftovers' },
      },
    };
    initialState.shoppingLists[startOfWeek()] = [
      {
        id: 'shopping-salmon',
        name: 'salmon fillet',
        grossRecipeNeed: 600,
        confirmedStockApplied: 0,
        remainingBuyQuantity: 600,
        unit: 'g',
        category: 'protein',
        sources: ['recipe'],
        sourceRecipeIds: [SEED_RECIPES[0].id],
        requiresReview: false,
        checked: false,
      },
    ];
    const page = await renderPlan(initialState);

    await click(buttonNamed(page.container, 'Reset'));
    expect(page.container.textContent).toContain('Clear this meal plan?');
    await click(buttonNamed(page.container, 'Clear meal plan'));

    expect(page.snapshot()?.plan.status).toBe('draft');
    expect(
      Object.values(page.snapshot()!.plan.slots).every(
        (slot) =>
          slot.recipeId === null && slot.kind === 'recipe' && !slot.locked && slot.servings === 4,
      ),
    ).toBe(true);
    expect(page.snapshot()?.shoppingItems).toEqual([]);
  });

  it('renders plan progress with a transform that reflects decided dinners', async () => {
    const page = await renderPlan(stateWith());
    const progress = page.container.querySelector<HTMLElement>(
      '.plan-progress [role="progressbar"]',
    );
    const fill = progress?.querySelector<HTMLElement>('span');

    expect(progress?.getAttribute('aria-valuenow')).toBe('0');
    expect(fill?.style.transform).toBe('scaleX(0)');

    await chooseRecipe(page.container, 'Monday', SEED_RECIPES[0]);

    expect(progress?.getAttribute('aria-valuenow')).toBe('1');
    expect(fill?.style.transform).toBe(`scaleX(${1 / 7})`);
  });

  it('does not count an intention as decided and clears it when a recipe is chosen', async () => {
    const initialState = stateWith();
    initialState.plans[startOfWeek()].slots.monday = {
      ...initialState.plans[startOfWeek()].slots.monday,
      cuisineIntent: 'indian',
    };
    const page = await renderPlan(initialState);
    const progress = page.container.querySelector<HTMLElement>(
      '.plan-progress [role="progressbar"]',
    );

    expect(progress?.getAttribute('aria-valuenow')).toBe('0');

    await chooseRecipe(page.container, 'Monday', SEED_RECIPES[0]);

    expect(page.snapshot()?.plan.slots.monday.recipeId).toBe(SEED_RECIPES[0].id);
    expect(page.snapshot()?.plan.slots.monday.cuisineIntent).toBeUndefined();
    expect(progress?.getAttribute('aria-valuenow')).toBe('1');
  });

  it('persists an unresolved cuisine, restores focus, and clears it for a special plan', async () => {
    const page = await renderPlan(stateWith());
    const trigger = buttonWithLabel(page.container, 'Choose dinner for Monday');
    trigger.focus();

    await click(trigger);
    await click(pickerPathButton(page.container, 'I feel like…'));
    await click(buttonNamed(page.container, 'Indian'));

    expect(page.snapshot()?.plan.slots.monday).toMatchObject({
      kind: 'recipe',
      recipeId: null,
      cuisineIntent: 'indian',
      locked: false,
    });
    expect(page.container.textContent).toContain('Indian · meal not chosen');

    await click(buttonNamed(page.container, 'Done'));
    expect(document.activeElement).toBe(trigger);

    await click(trigger);
    await click(optionButton(page.container, 'Leftovers'));

    expect(page.snapshot()?.plan.slots.monday).toMatchObject({
      kind: 'leftovers',
      recipeId: null,
    });
    expect(page.snapshot()?.plan.slots.monday.cuisineIntent).toBeUndefined();
  });

  it('browses cuisines for a chosen meal without replacing it', async () => {
    const initialState = stateWith();
    const monday = initialState.plans[startOfWeek()].slots.monday;
    initialState.plans[startOfWeek()].slots.monday = {
      ...monday,
      recipeId: SEED_RECIPES[0].id,
      servings: 6,
    };
    const page = await renderPlan(initialState);
    const trigger = buttonWithLabel(page.container, 'Change dinner for Monday');
    trigger.focus();

    await click(trigger);
    await click(pickerPathButton(page.container, 'I feel like…'));
    await click(buttonNamed(page.container, 'Thai'));
    expect(page.container.textContent).toContain('Browsing does not change');
    await click(buttonNamed(page.container, 'Done'));

    expect(page.snapshot()?.plan.slots.monday).toEqual({
      ...monday,
      recipeId: SEED_RECIPES[0].id,
      servings: 6,
    });
    expect(document.activeElement).toBe(trigger);
  });

  it('does nothing when the active cuisine for a chosen meal is clicked again', async () => {
    const indianRecipe: Recipe = {
      ...SEED_RECIPES[0],
      id: 'indian-dinner',
      name: 'Indian dinner',
      cuisine: 'indian',
    };
    const initialState = stateWith([indianRecipe]);
    const plan = initialState.plans[startOfWeek()];
    plan.slots.monday = { ...plan.slots.monday, recipeId: indianRecipe.id };
    const originalUpdatedAt = plan.updatedAt;
    const page = await renderPlan(initialState);

    await click(buttonWithLabel(page.container, 'Change dinner for Monday'));
    await click(pickerPathButton(page.container, 'I feel like…'));
    const activeCuisine = buttonNamed(page.container, 'Indian');
    expect(activeCuisine.getAttribute('aria-pressed')).toBe('true');
    await click(activeCuisine);
    await click(buttonNamed(page.container, 'Done'));

    expect(page.snapshot()?.plan.slots.monday.recipeId).toBe(indianRecipe.id);
    expect(page.snapshot()?.plan.slots.monday.cuisineIntent).toBeUndefined();
    expect(page.snapshot()?.plan.updatedAt).toBe(originalUpdatedAt);
  });

  it('explicitly replaces a chosen meal with an unresolved cuisine preference', async () => {
    const initialState = stateWith();
    initialState.plans[startOfWeek()].slots.monday.recipeId = SEED_RECIPES[0].id;
    const page = await renderPlan(initialState);
    const trigger = buttonWithLabel(page.container, 'Change dinner for Monday');
    trigger.focus();

    await click(trigger);
    await click(pickerPathButton(page.container, 'I feel like…'));
    await click(buttonNamed(page.container, 'Thai'));
    await click(buttonNamed(page.container, 'Replace with Thai preference'));

    expect(page.snapshot()?.plan.slots.monday).toMatchObject({
      kind: 'recipe',
      recipeId: null,
      cuisineIntent: 'thai',
      locked: false,
    });
    expect(page.container.textContent).toContain('Thai · meal not chosen');
    expect(document.activeElement).toBe(trigger);
  });

  it('cycles through explainable inspiration without random reshuffling', async () => {
    const recipes: Recipe[] = [
      { ...SEED_RECIPES[0], id: 'alpha', name: 'Alpha dinner', favourite: true },
      { ...SEED_RECIPES[1], id: 'beta', name: 'Beta dinner', favourite: false },
      { ...SEED_RECIPES[2], id: 'gamma', name: 'Gamma dinner', favourite: false },
    ];
    const page = await renderPlan(stateWith(recipes));

    await click(buttonWithLabel(page.container, 'Choose dinner for Monday'));
    await click(pickerPathButton(page.container, 'Inspire me'));
    const firstName = page.container.querySelector(
      '.meal-picker__inspiration .meal-suggestion-card h3',
    )?.textContent;

    expect(firstName).toBeTruthy();
    expect(
      page.container.querySelector('.meal-suggestion-card__reasons')?.textContent,
    ).toBeTruthy();

    await click(buttonNamed(page.container, 'Show me another'));
    const secondName = page.container.querySelector(
      '.meal-picker__inspiration .meal-suggestion-card h3',
    )?.textContent;

    expect(secondName).not.toBe(firstName);
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
