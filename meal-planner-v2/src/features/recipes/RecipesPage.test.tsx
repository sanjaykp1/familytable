import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppProvider } from '../../app/AppProvider';
import { startOfWeek } from '../../domain/date';
import { createEmptyPlan, SEED_RECIPES } from '../../domain/seed';
import type { AppState, Recipe } from '../../domain/types';
import type { MealPlannerRepository } from '../../repositories/mealPlannerRepository';
import { RecipesPage } from './RecipesPage';

let mounted: { container: HTMLDivElement; root: Root } | null = null;

function repositoryFor(state: AppState): MealPlannerRepository {
  return {
    load: () => state,
    save: vi.fn(),
    importData: () => state,
    exportData: () => JSON.stringify(state),
    clear: vi.fn(),
  };
}

async function renderRecipes(recipes: Recipe[] = SEED_RECIPES) {
  const weekStart = startOfWeek();
  const state: AppState = {
    schemaVersion: 9,
    recipes: recipes.map((recipe) => ({
      ...recipe,
      ingredients: recipe.ingredients.map((ingredient) => ({ ...ingredient })),
      seasons: [...recipe.seasons],
      tags: [...recipe.tags],
    })),
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
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  mounted = { container, root };
  await act(async () => {
    root.render(
      <AppProvider repository={repositoryFor(state)}>
        <RecipesPage />
      </AppProvider>,
    );
  });
  return container;
}

async function click(container: Element, name: string) {
  const button = Array.from(container.querySelectorAll('button')).find(
    (candidate) => candidate.textContent?.replace(/\s+/g, ' ').trim() === name,
  );
  if (!button) throw new Error(`Could not find button named ${name}.`);
  await act(async () => button.dispatchEvent(new MouseEvent('click', { bubbles: true })));
}

afterEach(async () => {
  if (!mounted) return;
  await act(async () => mounted?.root.unmount());
  mounted.container.remove();
  mounted = null;
});

describe('RecipesPage', () => {
  it('switches recipes between card and list displays', async () => {
    const container = await renderRecipes();

    expect(container.querySelector('.recipe-grid')).not.toBeNull();
    await click(container, 'List');
    expect(container.querySelector('.recipe-list')).not.toBeNull();
    expect(container.querySelector('.recipe-list__item')).not.toBeNull();
    await click(container, 'Cards');
    expect(container.querySelector('.recipe-grid')).not.toBeNull();
  });

  it('toggles a recipe favourite directly from its card', async () => {
    const container = await renderRecipes();
    const favourite = Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find(
      (button) => button.getAttribute('aria-label')?.includes('Roast chicken & roots') ?? false,
    );

    expect(favourite).toBeDefined();
    await act(async () => favourite?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(favourite?.getAttribute('aria-pressed')).toBe('true');
  });

  it('groups general browsing by cuisine, includes Uncategorised, and omits empty groups', async () => {
    const recipes: Recipe[] = [
      { ...SEED_RECIPES[0], id: 'indian-dinner', name: 'Indian dinner', cuisine: 'indian' },
      { ...SEED_RECIPES[1], id: 'italian-dinner', name: 'Italian dinner', cuisine: 'italian' },
      {
        ...SEED_RECIPES[2],
        id: 'migrated-dinner',
        name: 'Migrated dinner',
        cuisine: 'uncategorised',
      },
    ];

    const container = await renderRecipes(recipes);
    const groups = Array.from(container.querySelectorAll<HTMLElement>('[data-cuisine-group]'));

    expect(groups.map((group) => group.dataset.cuisineGroup)).toEqual([
      'indian',
      'italian',
      'uncategorised',
    ]);
    expect(groups.map((group) => group.querySelector('h2')?.textContent)).toEqual([
      'Indian',
      'Italian',
      'Uncategorised',
    ]);
    expect(container.querySelector('[data-cuisine-group="japanese"]')).toBeNull();
    expect(container.textContent).toContain('Migrated dinner');
  });

  it('filters recipes by cuisine', async () => {
    const recipes: Recipe[] = [
      { ...SEED_RECIPES[0], id: 'indian-dinner', name: 'Indian dinner', cuisine: 'indian' },
      { ...SEED_RECIPES[1], id: 'italian-dinner', name: 'Italian dinner', cuisine: 'italian' },
      {
        ...SEED_RECIPES[2],
        id: 'migrated-dinner',
        name: 'Migrated dinner',
        cuisine: 'uncategorised',
      },
    ];
    const container = await renderRecipes(recipes);
    const cuisineFilter = Array.from(container.querySelectorAll('button')).find(
      (control) => control.textContent?.trim() === 'Italian',
    );
    if (!cuisineFilter) throw new Error('Could not find cuisine filter.');

    await act(async () =>
      cuisineFilter.dispatchEvent(new MouseEvent('click', { bubbles: true })),
    );

    expect(container.textContent).toContain('Italian dinner');
    expect(container.textContent).not.toContain('Indian dinner');
    expect(container.textContent).not.toContain('Migrated dinner');
    expect(container.textContent).toContain('1 recipe');
    expect(cuisineFilter.getAttribute('aria-pressed')).toBe('true');
  });
});
