import { describe, expect, it } from 'vitest';
import { CATALOGUE_EXPANSION_RECIPES, createEmptyPlan, SEED_RECIPES } from './seed';
import { generateInspiredMealPlan, rankMealSuggestions } from './mealInspiration';
import type { HomeStockItem, Recipe } from './types';

const NOW = '2026-08-17T09:00:00.000Z';

function recipe(id: string, name: string, cuisine: Recipe['cuisine'], patch: Partial<Recipe> = {}) {
  return {
    ...SEED_RECIPES[0],
    id,
    name,
    cuisine,
    favourite: false,
    lastCookedAt: null,
    tags: [],
    ...patch,
  };
}

function useSoonTomatoes(): HomeStockItem[] {
  return [
    {
      id: 'stock-tomatoes',
      name: 'tomatoes',
      kind: 'food',
      category: 'produce',
      location: 'Fridge',
      frozen: false,
      quantity: 4,
      unit: 'pieces',
      planningPriority: 'use-soon',
      archived: false,
      updatedAt: NOW,
    },
  ];
}

describe('rankMealSuggestions', () => {
  it('requires the explicit cuisine and returns stable explainable ordering', () => {
    const plan = createEmptyPlan('2026-08-17', 4);
    plan.slots.tuesday = { ...plan.slots.tuesday, cuisineIntent: 'indian' };
    const favourite = recipe('favourite', 'Favourite curry', 'indian', { favourite: true });
    const seasonal = recipe('seasonal', 'Seasonal curry', 'indian', { seasons: ['summer'] });
    const italian = recipe('italian', 'Italian favourite', 'italian', { favourite: true });
    const request = {
      plan,
      day: 'tuesday' as const,
      recipes: [seasonal, italian, favourite],
      homeStockItems: [],
      now: NOW,
    };

    const first = rankMealSuggestions(request);
    const second = rankMealSuggestions(request);

    expect(first).toEqual(second);
    expect(first.suggestions.map((item) => item.recipeId)).toEqual(['favourite', 'seasonal']);
    expect(first.suggestions[0].reasonCodes).toContain('favourite');
    expect(first.suggestions.every((item) => item.recipeId !== italian.id)).toBe(true);
  });

  it('excludes a recently cooked meal while an alternative exists', () => {
    const plan = createEmptyPlan('2026-08-17', 4);
    const recent = recipe('recent', 'Recent meal', 'nordic', { lastCookedAt: '2026-08-15' });
    const older = recipe('older', 'Older meal', 'nordic', { lastCookedAt: '2026-07-01' });

    const ranked = rankMealSuggestions({
      plan,
      day: 'monday',
      recipes: [recent, older],
      homeStockItems: [],
      now: NOW,
    });

    expect(ranked.suggestions.map((item) => item.recipeId)).toEqual(['older']);
    expect(ranked.suggestions[0].reasonCodes).toContain('not-cooked-recently');
  });

  it('keeps the only recently cooked cuisine match with an explicit reason', () => {
    const plan = createEmptyPlan('2026-08-17', 4);
    plan.slots.tuesday = { ...plan.slots.tuesday, cuisineIntent: 'thai' };
    const recent = recipe('recent', 'Recent Thai meal', 'thai', {
      lastCookedAt: '2026-08-15',
    });

    const ranked = rankMealSuggestions({
      plan,
      day: 'tuesday',
      recipes: [recent],
      homeStockItems: [],
      now: NOW,
    });

    expect(ranked.suggestions[0]).toMatchObject({ recipeId: 'recent' });
    expect(ranked.suggestions[0].reasonCodes).toEqual(
      expect.arrayContaining(['only-cuisine-match', 'recently-cooked-only-match']),
    );
  });

  it('offers an already planned cuisine match only as a manual override', () => {
    const plan = createEmptyPlan('2026-08-17', 4);
    const only = recipe('only-indian', 'Only Indian meal', 'indian');
    plan.slots.monday = { ...plan.slots.monday, recipeId: only.id };
    plan.slots.tuesday = { ...plan.slots.tuesday, cuisineIntent: 'indian' };

    const ranked = rankMealSuggestions({
      plan,
      day: 'tuesday',
      recipes: [only],
      homeStockItems: [],
      now: NOW,
    });

    expect(ranked.suggestions).toEqual([]);
    expect(ranked.unavailableReason).toBe('all-cuisine-matches-already-planned');
    expect(ranked.manualOverrides).toEqual([
      expect.objectContaining({
        recipeId: only.id,
        reasonCodes: ['already-planned-manual-option'],
      }),
    ]);
  });

  it('uses the canonical alias registry for the Use soon reason', () => {
    const plan = createEmptyPlan('2026-08-17', 4);
    const tomatoDinner = recipe('tomato', 'Tomato dinner', 'italian', {
      ingredients: [
        { id: 'tomato', name: 'tomato', quantity: 2, unit: 'pieces', category: 'produce' },
      ],
    });

    const ranked = rankMealSuggestions({
      plan,
      day: 'monday',
      recipes: [tomatoDinner],
      homeStockItems: useSoonTomatoes(),
      now: NOW,
    });

    expect(ranked.suggestions[0].reasonCodes).toContain('use-soon');
  });
});

describe('generateInspiredMealPlan', () => {
  it('preserves decided meals and special plans while satisfying an intention first', () => {
    const plan = createEmptyPlan('2026-08-17', 4);
    plan.slots.monday = {
      ...plan.slots.monday,
      recipeId: SEED_RECIPES[0].id,
      locked: false,
      servings: 6,
    };
    plan.slots.tuesday = { ...plan.slots.tuesday, cuisineIntent: 'indian' };
    plan.slots.wednesday = { ...plan.slots.wednesday, kind: 'leftovers' };

    const recipes = [...SEED_RECIPES, ...CATALOGUE_EXPANSION_RECIPES];
    const result = generateInspiredMealPlan(plan, recipes, [], NOW);

    expect(result.plan.slots.monday).toEqual(plan.slots.monday);
    expect(result.plan.slots.wednesday).toEqual(plan.slots.wednesday);
    expect(
      recipes.find((item) => item.id === result.plan.slots.tuesday.recipeId)?.cuisine,
    ).toBe('indian');
    expect(result.plan.slots.tuesday.cuisineIntent).toBeUndefined();
    expect(result.unresolvedIntentions).toEqual([]);
  });

  it('fills only one of two same-cuisine intentions when there is one matching recipe', () => {
    const plan = createEmptyPlan('2026-08-17', 4);
    plan.slots.tuesday = { ...plan.slots.tuesday, cuisineIntent: 'indian' };
    plan.slots.thursday = { ...plan.slots.thursday, cuisineIntent: 'indian' };
    const only = recipe('only-indian', 'Only Indian meal', 'indian');

    const result = generateInspiredMealPlan(plan, [only], [], NOW);

    expect(result.plan.slots.tuesday.recipeId).toBe(only.id);
    expect(result.plan.slots.thursday).toEqual(plan.slots.thursday);
    expect(result.unresolvedIntentions).toEqual([
      {
        day: 'thursday',
        cuisine: 'indian',
        reasonCode: 'all-cuisine-matches-already-planned',
        manualOverrideRecipeIds: [only.id],
      },
    ]);
  });

  it('leaves a no-match cuisine visible and never substitutes another cuisine', () => {
    const plan = createEmptyPlan('2026-08-17', 4);
    plan.slots.friday = { ...plan.slots.friday, cuisineIntent: 'korean' };
    const italian = recipe('italian', 'Italian meal', 'italian');

    const result = generateInspiredMealPlan(plan, [italian], [], NOW);

    expect(result.plan.slots.friday).toEqual(plan.slots.friday);
    expect(result.unresolvedIntentions[0]).toMatchObject({
      day: 'friday',
      cuisine: 'korean',
      reasonCode: 'no-cuisine-match',
    });
  });
});
