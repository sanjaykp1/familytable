import { describe, expect, it } from 'vitest';
import { createEmptyPlan, SEED_RECIPES } from './seed';
import {
  acceptReplenishmentSuggestion,
  buildReplenishmentSuggestions,
  buildShoppingList,
  reconcileShoppingIngredient,
} from './shopping';
import { evaluateStockOnlyRecipe } from './stockPlanning';
import type { HomeStockItem, Recipe } from './types';

function stockItem(patch: Partial<HomeStockItem> = {}): HomeStockItem {
  return {
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
    ...patch,
  };
}

function bananaStock(patch: Partial<HomeStockItem> = {}): HomeStockItem {
  return stockItem({
    id: 'stock-bananas',
    name: 'bananas',
    category: 'produce',
    location: 'fruit bowl',
    quantity: 0,
    unit: '',
    reorderPoint: 2,
    targetQuantity: 6,
    replenishmentRuleEnabled: true,
    ...patch,
  });
}

const bananaRecipe: Recipe = {
  ...SEED_RECIPES[0],
  id: 'recipe-smoothie',
  name: 'Banana smoothie',
  servings: 4,
  ingredients: [
    { id: 'smoothie-bananas', name: 'bananas', quantity: 4, unit: '', category: 'produce' },
  ],
};

describe('buildShoppingList', () => {
  it('scales and combines matching ingredients across planned dinners', () => {
    const plan = createEmptyPlan('2026-08-03', 4);
    plan.slots.monday = { recipeId: 'seed-salmon', locked: false, servings: 2 };
    plan.slots.tuesday = { recipeId: 'seed-salmon', locked: false, servings: 6 };

    const items = buildShoppingList(plan, SEED_RECIPES);
    const salmon = items.find((item) => item.name === 'salmon fillet');

    expect(salmon?.grossRecipeNeed).toBe(1200);
    expect(salmon?.confirmedStockApplied).toBe(0);
    expect(salmon?.remainingBuyQuantity).toBe(1200);
    expect(salmon?.unit).toBe('g');
    expect(salmon?.sources).toEqual(['recipe']);
    expect(salmon?.sourceRecipeIds).toEqual(['seed-salmon']);
  });

  it('applies confirmed partial stock while preserving the gross recipe need', () => {
    const plan = createEmptyPlan('2026-08-03', 4);
    plan.slots.monday.recipeId = 'seed-salmon';

    const salmon = buildShoppingList(plan, SEED_RECIPES, [], [stockItem()]).find(
      (item) => item.name === 'salmon fillet',
    );

    expect(salmon).toMatchObject({
      grossRecipeNeed: 600,
      confirmedStockApplied: 200,
      remainingBuyQuantity: 400,
      requiresReview: false,
    });
  });

  it('allocates shared stock once after combining multiple recipes', () => {
    const plan = createEmptyPlan('2026-08-03', 4);
    plan.slots.monday.recipeId = 'seed-pizza';
    plan.slots.tuesday.recipeId = 'seed-risotto';

    const mushrooms = buildShoppingList(plan, SEED_RECIPES, [], [
      stockItem({ id: 'stock-mushrooms', name: '  MUSHROOMS ', quantity: 300 }),
    ]).find((item) => item.name === 'mushrooms');

    expect(mushrooms).toMatchObject({
      grossRecipeNeed: 700,
      confirmedStockApplied: 300,
      remainingBuyQuantity: 400,
      sourceRecipeIds: ['seed-pizza', 'seed-risotto'],
    });
  });

  it('applies safe kg-to-g stock conversion', () => {
    const plan = createEmptyPlan('2026-08-03', 4);
    plan.slots.monday.recipeId = 'seed-salmon';

    const salmon = buildShoppingList(plan, SEED_RECIPES, [], [
      stockItem({ quantity: 1, unit: 'kg' }),
    ]).find((item) => item.name === 'salmon fillet');

    expect(salmon).toMatchObject({
      grossRecipeNeed: 600,
      confirmedStockApplied: 600,
      remainingBuyQuantity: 0,
      requiresReview: false,
    });
  });

  it('marks matching stock with an unsupported unit for review without subtracting it', () => {
    const plan = createEmptyPlan('2026-08-03', 4);
    plan.slots.monday.recipeId = 'seed-salmon';

    const salmon = buildShoppingList(plan, SEED_RECIPES, [], [
      stockItem({ quantity: 1, unit: 'bag' }),
    ]).find((item) => item.name === 'salmon fillet');

    expect(salmon).toMatchObject({
      grossRecipeNeed: 600,
      confirmedStockApplied: 0,
      remainingBuyQuantity: 600,
      requiresReview: true,
    });
  });

  it('uses the same alias classification and row allocation as strict stock planning', () => {
    const tomatoRecipe: Recipe = {
      ...SEED_RECIPES[0],
      id: 'tomato-recipe',
      ingredients: [
        { id: 'tomato', name: 'tomato', quantity: 600, unit: 'g', category: 'produce' },
      ],
    };
    const inventory = [
      stockItem({ id: 'tomatoes-a', name: 'tomatoes', quantity: 0.25, unit: 'kg' }),
      stockItem({ id: 'tomatoes-b', name: 'tomato', quantity: 350, unit: 'g' }),
    ];
    const shoppingMatch = reconcileShoppingIngredient(
      tomatoRecipe.ingredients[0],
      inventory,
    );
    const stockEvaluation = evaluateStockOnlyRecipe(tomatoRecipe, inventory);
    const stockMatch = stockEvaluation.ingredientMatches[0];

    expect(stockEvaluation.eligible).toBe(true);
    expect(shoppingMatch.classification).toBe('alias');
    expect(stockMatch.classification).toBe(shoppingMatch.classification);
    expect(stockMatch.canonicalIngredient).toEqual(shoppingMatch.canonicalIngredient);
    expect(stockMatch.allocations).toEqual(shoppingMatch.allocations);

    const plan = createEmptyPlan('2026-08-03', 4);
    plan.slots.monday.recipeId = tomatoRecipe.id;
    expect(buildShoppingList(plan, [tomatoRecipe], [], inventory)[0]).toMatchObject({
      confirmedStockApplied: 600,
      remainingBuyQuantity: 0,
      requiresReview: false,
    });
  });

  it('requires review when a compatible stock item has an unknown quantity', () => {
    const plan = createEmptyPlan('2026-08-03', 4);
    plan.slots.monday.recipeId = 'seed-salmon';

    const salmon = buildShoppingList(plan, SEED_RECIPES, [], [
      stockItem({ quantity: null }),
    ]).find((item) => item.name === 'salmon fillet');

    expect(salmon).toMatchObject({
      confirmedStockApplied: 0,
      remainingBuyQuantity: 600,
      requiresReview: true,
    });
  });

  it('does not mutate stock while calculating a shopping list', () => {
    const plan = createEmptyPlan('2026-08-03', 4);
    plan.slots.monday.recipeId = 'seed-salmon';
    const stock = [stockItem()];

    buildShoppingList(plan, SEED_RECIPES, [], stock);

    expect(stock[0].quantity).toBe(200);
  });

  it('keeps an item checked when the list is rebuilt', () => {
    const plan = createEmptyPlan('2026-08-03', 4);
    plan.slots.monday.recipeId = 'seed-pizza';
    const firstList = buildShoppingList(plan, SEED_RECIPES);
    const checkedList = firstList.map((item) =>
      item.name === 'mozzarella' ? { ...item, checked: true } : item,
    );

    const rebuilt = buildShoppingList(plan, SEED_RECIPES, checkedList);

    expect(rebuilt.find((item) => item.name === 'mozzarella')?.checked).toBe(true);
  });

  it('keeps explicit manual shopping items when recipe quantities are refreshed', () => {
    const plan = createEmptyPlan('2026-08-03', 4);
    plan.slots.monday.recipeId = 'seed-pizza';
    const manualItem = {
      id: 'shop-dishwasher-tablets',
      name: 'Dishwasher tablets',
      grossRecipeNeed: null,
      confirmedStockApplied: 0,
      remainingBuyQuantity: 1,
      unit: 'pack',
      category: 'other' as const,
      sources: ['manual' as const],
      sourceRecipeIds: [],
      requiresReview: false,
      checked: false,
    };

    const rebuilt = buildShoppingList(plan, SEED_RECIPES, [manualItem]);

    expect(rebuilt).toEqual(expect.arrayContaining([manualItem]));
  });

  it('does not add ingredients for leftovers, eating out, or skipped dinners', () => {
    const plan = createEmptyPlan('2026-08-03', 4);
    plan.slots.monday = { ...plan.slots.monday, kind: 'leftovers' };
    plan.slots.tuesday = { ...plan.slots.tuesday, kind: 'eat-out' };
    plan.slots.wednesday = { ...plan.slots.wednesday, kind: 'skip' };

    expect(buildShoppingList(plan, SEED_RECIPES)).toEqual([]);
  });
});

describe('replenishment suggestions', () => {
  it('suggests target minus current for bananas without silently adding it to shopping', () => {
    const stock = bananaStock();
    const plan = createEmptyPlan('2026-08-03', 4);

    expect(buildReplenishmentSuggestions([stock])).toEqual([
      expect.objectContaining({
        homeStockItemId: 'stock-bananas',
        currentQuantity: 0,
        reorderPoint: 2,
        targetQuantity: 6,
        suggestedQuantity: 6,
        requiresReview: false,
      }),
    ]);
    expect(buildShoppingList(plan, [], [], [stock])).toEqual([]);
  });

  it('uses the larger of recipe and target shortfalls and retains both reasons', () => {
    const plan = createEmptyPlan('2026-08-03', 4);
    plan.slots.monday.recipeId = bananaRecipe.id;
    const stock = bananaStock();
    const recipeList = buildShoppingList(plan, [bananaRecipe], [], [stock]);
    const [suggestion] = buildReplenishmentSuggestions([stock]);

    const accepted = acceptReplenishmentSuggestion(recipeList, suggestion);

    expect(accepted).toHaveLength(1);
    expect(accepted[0]).toMatchObject({
      name: 'bananas',
      grossRecipeNeed: 4,
      confirmedStockApplied: 0,
      stockTopUpQuantity: 6,
      remainingBuyQuantity: 6,
      sources: ['recipe', 'stock-top-up'],
      sourceRecipeIds: ['recipe-smoothie'],
      sourceHomeStockItemIds: ['stock-bananas'],
    });

    expect(buildShoppingList(plan, [bananaRecipe], accepted, [stock])[0]).toMatchObject({
      remainingBuyQuantity: 6,
      stockTopUpQuantity: 6,
      sources: ['recipe', 'stock-top-up'],
    });

    const acceptedBeforeRecipe = acceptReplenishmentSuggestion([], suggestion);
    expect(buildShoppingList(plan, [bananaRecipe], acceptedBeforeRecipe, [stock])).toEqual([
      expect.objectContaining({
        name: 'bananas',
        remainingBuyQuantity: 6,
        stockTopUpQuantity: 6,
        sources: ['recipe', 'stock-top-up'],
      }),
    ]);
  });

  it('keeps a larger recipe shortfall instead of adding the top-up to it', () => {
    const plan = createEmptyPlan('2026-08-03', 4);
    plan.slots.monday = { recipeId: bananaRecipe.id, locked: false, servings: 8 };
    const stock = bananaStock();
    const recipeList = buildShoppingList(plan, [bananaRecipe], [], [stock]);
    const [suggestion] = buildReplenishmentSuggestions([stock]);

    expect(acceptReplenishmentSuggestion(recipeList, suggestion)[0].remainingBuyQuantity).toBe(8);
  });

  it('does not recreate dismissed suggestions or suggestions for disabled rules', () => {
    expect(
      buildReplenishmentSuggestions([
        bananaStock({ replenishmentSuggestionStatus: 'dismissed' }),
        bananaStock({ id: 'stock-disabled-bananas', replenishmentRuleEnabled: false }),
      ]),
    ).toEqual([]);
  });

  it('flags unknown quantities and incompatible units for review', () => {
    const unknown = buildReplenishmentSuggestions([bananaStock({ quantity: null })])[0];
    expect(unknown).toMatchObject({
      suggestedQuantity: null,
      requiresReview: true,
      reviewReason: 'unknown-quantity',
    });

    const incompatibleRecipeLine = buildShoppingList(
      { ...createEmptyPlan('2026-08-03', 4), slots: {
        ...createEmptyPlan('2026-08-03', 4).slots,
        monday: { recipeId: bananaRecipe.id, locked: false, servings: 4 },
      } },
      [{
        ...bananaRecipe,
        ingredients: [{ ...bananaRecipe.ingredients[0], unit: 'bunches' }],
      }],
    );
    const accepted = acceptReplenishmentSuggestion(
      incompatibleRecipeLine,
      buildReplenishmentSuggestions([bananaStock()])[0],
    );
    expect(accepted).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'bananas',
          unit: '',
          sources: ['stock-top-up'],
          requiresReview: true,
        }),
      ]),
    );
  });
});
