import { describe, expect, it } from 'vitest';
import { createEmptyPlan, SEED_RECIPES } from './seed';
import {
  evaluateStockOnlyRecipe,
  generateStockOnlyMealPlan,
  rankStockOnlyRecipes,
} from './stockPlanning';
import type { HomeStockItem, Ingredient, Recipe } from './types';

function ingredient(id: string, name: string, quantity: number | null, unit = 'g'): Ingredient {
  return { id, name, quantity, unit, category: 'pantry' };
}

function recipe(id: string, name: string, ingredients: Ingredient[]): Recipe {
  return { ...SEED_RECIPES[0], id, name, ingredients };
}

function stock(
  id: string,
  name: string,
  quantity: number | null,
  unit = 'g',
  planningPriority: HomeStockItem['planningPriority'] = 'normal',
): HomeStockItem {
  return {
    id,
    name,
    kind: 'food',
    category: 'pantry',
    location: 'Cupboard',
    frozen: false,
    quantity,
    unit,
    planningPriority,
    archived: false,
    updatedAt: '2026-08-10T08:00:00.000Z',
  };
}

describe('strict stock-only recipe eligibility', () => {
  it('qualifies a fully covered recipe and explains the exact allocation', () => {
    const dinner = recipe('dinner', 'Covered dinner', [
      ingredient('rice', 'Rice', 300),
      ingredient('beans', 'Beans', 200),
    ]);

    const result = evaluateStockOnlyRecipe(dinner, [
      stock('stock-rice', ' rice ', 300),
      stock('stock-beans', 'BEANS', 250),
    ]);

    expect(result.eligible).toBe(true);
    expect(result.failures).toEqual([]);
    expect(result.allocations).toEqual([
      expect.objectContaining({
        ingredientId: 'rice',
        stockItemId: 'stock-rice',
        allocatedQuantity: 300,
      }),
      expect.objectContaining({
        ingredientId: 'beans',
        stockItemId: 'stock-beans',
        allocatedQuantity: 200,
      }),
    ]);
    expect(result.reason).toContain('Every required ingredient');
  });

  it('rejects a recipe with one missing ingredient', () => {
    const dinner = recipe('dinner', 'Needs two things', [
      ingredient('rice', 'Rice', 100),
      ingredient('beans', 'Beans', 100),
    ]);

    const result = evaluateStockOnlyRecipe(dinner, [stock('stock-rice', 'Rice', 100)]);

    expect(result.eligible).toBe(false);
    expect(result.failures).toEqual([
      expect.objectContaining({ code: 'missing-stock', ingredientId: 'beans' }),
    ]);
  });

  it('rejects insufficient quantity with confirmed required and available amounts', () => {
    const result = evaluateStockOnlyRecipe(
      recipe('dinner', 'Rice dinner', [ingredient('rice', 'Rice', 300)]),
      [stock('stock-rice', 'Rice', 299)],
    );

    expect(result.failures[0]).toMatchObject({
      code: 'insufficient-stock',
      requiredQuantity: 300,
      availableQuantity: 299,
    });
  });

  it('allocates shared stock only once across repeated ingredient lines', () => {
    const result = evaluateStockOnlyRecipe(
      recipe('dinner', 'Shared rice', [
        ingredient('rice-main', 'Rice', 300),
        ingredient('rice-side', 'Rice', 200),
      ]),
      [stock('stock-rice', 'Rice', 500)],
    );

    expect(result.eligible).toBe(true);
    expect(result.allocations.map((item) => item.allocatedQuantity)).toEqual([300, 200]);

    const short = evaluateStockOnlyRecipe(
      recipe('short', 'Too much rice', [
        ingredient('rice-main', 'Rice', 300),
        ingredient('rice-side', 'Rice', 201),
      ]),
      [stock('stock-rice', 'Rice', 500)],
    );
    expect(short.failures[0]).toMatchObject({ code: 'insufficient-stock', availableQuantity: 200 });
  });

  it('aggregates multiple compatible alias rows with safe unit conversion', () => {
    const result = evaluateStockOnlyRecipe(
      recipe('dinner', 'Tomato dinner', [ingredient('tomato', 'tomato', 600, 'g')]),
      [
        stock('tomatoes-a', 'tomatoes', 0.25, 'kg'),
        stock('tomatoes-b', 'tomato', 350, 'g'),
      ],
    );

    expect(result.eligible).toBe(true);
    expect(result.ingredientMatches[0]).toMatchObject({
      classification: 'alias',
      totalConfirmedQuantity: 600,
      remainingRequirement: 0,
    });
    expect(result.allocations).toEqual([
      expect.objectContaining({ stockItemId: 'tomatoes-a', allocatedQuantity: 250 }),
      expect.objectContaining({ stockItemId: 'tomatoes-b', allocatedQuantity: 350 }),
    ]);
  });

  it('rejects matching stock recorded in an incompatible unit', () => {
    const result = evaluateStockOnlyRecipe(
      recipe('dinner', 'Rice dinner', [ingredient('rice', 'Rice', 300, 'g')]),
      [stock('stock-rice', 'Rice', 1, 'bag')],
    );

    expect(result.failures[0]).toMatchObject({
      code: 'incompatible-unit',
      matchedStockItemIds: ['stock-rice'],
    });
  });

  it('ranks a recipe that consumes multiple use-soon items above one that consumes one', () => {
    const two = recipe('two', 'Two priorities', [
      ingredient('rice', 'Rice', 100),
      ingredient('beans', 'Beans', 100),
    ]);
    const one = recipe('one', 'One priority', [ingredient('rice-one', 'Rice', 100)]);
    const ranked = rankStockOnlyRecipes(
      [one, two],
      [
        stock('stock-rice', 'Rice', 500, 'g', 'use-soon'),
        stock('stock-beans', 'Beans', 500, 'g', 'use-soon'),
      ],
    );

    expect(ranked.map((item) => item.recipe.id)).toEqual(['two', 'one']);
    expect(ranked[0].useSoonItemIds).toEqual(['stock-rice', 'stock-beans']);
  });

  it('leaves the plan unchanged when a must-use constraint has no valid saved recipe', () => {
    const plan = createEmptyPlan('2026-08-10', 4);
    const result = generateStockOnlyMealPlan(
      plan,
      [recipe('rice', 'Rice dinner', [ingredient('rice', 'Rice', 100)])],
      [stock('stock-rice', 'Rice', 100), stock('stock-beans', 'Beans', 100)],
      ['stock-beans'],
      '2026-08-10T09:00:00.000Z',
    );

    expect(result.ok).toBe(false);
    expect(result.plan).toBe(plan);
    if (!result.ok) expect(result.failures[0].message).toContain('No fully covered saved recipe');
  });

  it('uses deterministic name and id tie-breakers for equally ranked recipes', () => {
    const alphaZ = recipe('z-id', 'Alpha', [ingredient('alpha-z-rice', 'Rice', 10)]);
    const alphaA = recipe('a-id', 'Alpha', [ingredient('alpha-a-rice', 'Rice', 10)]);
    const beta = recipe('b-id', 'Beta', [ingredient('beta-rice', 'Rice', 10)]);
    const inventory = [stock('stock-rice', 'Rice', 100)];

    const first = rankStockOnlyRecipes([beta, alphaZ, alphaA], inventory);
    const second = rankStockOnlyRecipes([alphaA, beta, alphaZ], inventory);

    expect(first.map((item) => item.recipe.id)).toEqual(['a-id', 'z-id', 'b-id']);
    expect(second.map((item) => item.recipe.id)).toEqual(['a-id', 'z-id', 'b-id']);
  });

  it('reserves stock for a locked meal before funding generated meals', () => {
    const locked = recipe('locked', 'Locked tomato dinner', [
      ingredient('locked-tomato', 'tomatoes', 100),
    ]);
    const generated = recipe('generated', 'Open tomato dinner', [
      ingredient('generated-tomato', 'tomato', 100),
    ]);
    const plan = createEmptyPlan('2026-08-10', 4);
    plan.slots.monday = { recipeId: locked.id, locked: true, servings: 4 };
    const inventory = [stock('stock-tomato', 'tomato', 100)];

    const result = generateStockOnlyMealPlan(
      plan,
      [locked, generated],
      inventory,
      [],
      '2026-08-10T09:00:00.000Z',
    );

    expect(result.ok).toBe(false);
    expect(result.plan).toBe(plan);
    expect(result.lockedReservationFailures).toEqual([]);
    expect(inventory[0].quantity).toBe(100);
  });

  it('reserves all confirmed stock for an insufficient locked meal and reports the shortage', () => {
    const locked = recipe('locked', 'Locked tomato dinner', [
      ingredient('locked-tomato', 'tomatoes', 150),
    ]);
    const generated = recipe('generated', 'Small tomato dinner', [
      ingredient('generated-tomato', 'tomato', 50),
    ]);
    const plan = createEmptyPlan('2026-08-10', 4);
    plan.slots.monday = { recipeId: locked.id, locked: true, servings: 4 };
    const inventory = [stock('stock-tomato', 'tomato', 100)];

    const result = generateStockOnlyMealPlan(
      plan,
      [locked, generated],
      inventory,
      [],
      '2026-08-10T09:00:00.000Z',
    );

    expect(result.ok).toBe(false);
    expect(result.lockedReservationFailures).toEqual([
      expect.objectContaining({
        day: 'monday',
        recipeId: 'locked',
        code: 'insufficient-stock',
        requiredQuantity: 150,
        availableQuantity: 100,
      }),
    ]);
    expect(inventory[0].quantity).toBe(100);
  });
});
