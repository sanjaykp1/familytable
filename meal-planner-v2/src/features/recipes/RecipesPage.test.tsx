import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppProvider } from '../../app/AppProvider';
import { startOfWeek } from '../../domain/date';
import { createEmptyPlan, SEED_RECIPES } from '../../domain/seed';
import type { AppState } from '../../domain/types';
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

async function renderRecipes() {
  const weekStart = startOfWeek();
  const state: AppState = {
    schemaVersion: 8,
    recipes: SEED_RECIPES.map((recipe) => ({
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
});
