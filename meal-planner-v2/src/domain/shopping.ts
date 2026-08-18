import type {
  HomeStockItem,
  IngredientCategory,
  MealPlan,
  Recipe,
  ReplenishmentSuggestion,
  ShoppingItem,
} from './types';
import { CATEGORY_ORDER, DAY_KEYS } from './types';
import {
  createStockLedger,
  matchIngredientToStock,
  normalizeIngredientText,
  type IngredientMatchRequest,
  type IngredientMatchResult,
  type StockLedger,
} from './ingredientMatching';

function normalized(value: string): string {
  return normalizeIngredientText(value);
}

function shoppingKey(name: string, unit: string): string {
  return `${normalized(name)}::${normalized(unit)}`;
}

function itemId(key: string): string {
  const slug = key
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
  return `shop-${slug}`;
}

function rounded(value: number): number {
  return Number(value.toFixed(value < 10 ? 2 : 1));
}

function stockCategory(item: HomeStockItem): IngredientCategory {
  return CATEGORY_ORDER.includes(item.category as IngredientCategory)
    ? (item.category as IngredientCategory)
    : 'other';
}

/**
 * Removes generated recipe data while retaining shopping reasons that exist independently of a
 * meal plan. Passing recipe IDs limits invalidation to rows contributed to by those recipes;
 * omitting them invalidates every recipe-derived row.
 */
export function invalidateRecipeShoppingContributions(
  items: readonly ShoppingItem[] | undefined,
  recipeIds?: readonly string[],
): ShoppingItem[] {
  const invalidRecipeIds = recipeIds ? new Set(recipeIds) : null;

  return (items ?? []).flatMap((item) => {
    if (!item.sources.includes('recipe')) return [item];
    if (
      invalidRecipeIds &&
      !item.sourceRecipeIds.some((recipeId) => invalidRecipeIds.has(recipeId))
    ) {
      return [item];
    }

    const independentSources = item.sources.filter((source) => source !== 'recipe');
    if (!independentSources.length) return [];

    const remainingBuyQuantity = independentSources.includes('stock-top-up')
      ? (item.stockTopUpQuantity ?? item.remainingBuyQuantity)
      : item.remainingBuyQuantity;

    return [
      {
        ...item,
        grossRecipeNeed: null,
        confirmedStockApplied: 0,
        remainingBuyQuantity,
        sources: independentSources,
        sourceRecipeIds: [],
      },
    ];
  });
}

export function buildReplenishmentSuggestions(
  homeStockItems: HomeStockItem[],
): ReplenishmentSuggestion[] {
  return homeStockItems.flatMap((item) => {
    if (
      item.archived ||
      item.replenishmentRuleEnabled === false ||
      item.replenishmentSuggestionStatus ||
      item.reorderPoint === undefined ||
      item.reorderPoint === null ||
      item.targetQuantity === undefined ||
      item.targetQuantity === null
    ) {
      return [];
    }

    const currentQuantity = item.quantity;
    const unknownQuantity = currentQuantity === null;
    if (currentQuantity !== null && currentQuantity > item.reorderPoint) return [];
    const invalidTarget =
      currentQuantity !== null && item.targetQuantity <= currentQuantity;

    return [{
      id: `replenishment-${item.id}`,
      homeStockItemId: item.id,
      name: item.name,
      currentQuantity,
      reorderPoint: item.reorderPoint,
      targetQuantity: item.targetQuantity,
      suggestedQuantity:
        currentQuantity === null || invalidTarget
          ? null
          : rounded(item.targetQuantity - currentQuantity),
      unit: item.unit,
      category: stockCategory(item),
      requiresReview: unknownQuantity || invalidTarget,
      reviewReason: unknownQuantity
        ? 'unknown-quantity' as const
        : invalidTarget
          ? 'invalid-target' as const
          : null,
    }];
  });
}

export function acceptReplenishmentSuggestion(
  existing: ShoppingItem[],
  suggestion: ReplenishmentSuggestion,
): ShoppingItem[] {
  const exact = existing.find(
    (item) => shoppingKey(item.name, item.unit) === shoppingKey(suggestion.name, suggestion.unit),
  );
  const sameNameWithDifferentUnit = existing.some(
    (item) =>
      normalized(item.name) === normalized(suggestion.name) &&
      normalized(item.unit) !== normalized(suggestion.unit),
  );

  if (!exact) {
    const topUpItem: ShoppingItem = {
      id: itemId(shoppingKey(suggestion.name, suggestion.unit)),
      name: suggestion.name,
      grossRecipeNeed: null,
      confirmedStockApplied: 0,
      remainingBuyQuantity: suggestion.suggestedQuantity,
      unit: suggestion.unit,
      category: suggestion.category,
      sources: ['stock-top-up'],
      sourceRecipeIds: [],
      sourceHomeStockItemIds: [suggestion.homeStockItemId],
      stockTopUpQuantity: suggestion.suggestedQuantity,
      requiresReview: suggestion.requiresReview || sameNameWithDifferentUnit,
      checked: false,
    };
    return [
      ...existing,
      topUpItem,
    ].sort((left, right) => left.name.localeCompare(right.name));
  }

  const recipeShortfall = exact.sources.includes('recipe')
    ? exact.remainingBuyQuantity
    : null;
  const topUp = suggestion.suggestedQuantity;
  const hasDifferentTopUpSource = (exact.sourceHomeStockItemIds ?? []).some(
    (id) => id !== suggestion.homeStockItemId,
  );
  const previousTopUp = exact.stockTopUpQuantity;
  const combinedTopUp =
    previousTopUp === undefined
      ? topUp
      : previousTopUp === null || topUp === null
        ? previousTopUp ?? topUp
        : rounded(Math.max(previousTopUp, topUp));
  const remainingBuyQuantity =
    recipeShortfall === null || combinedTopUp === null
      ? recipeShortfall ?? combinedTopUp
      : rounded(Math.max(recipeShortfall, combinedTopUp));
  const sources = exact.sources.includes('stock-top-up')
    ? exact.sources
    : [...exact.sources, 'stock-top-up' as const];
  const sourceHomeStockItemIds = [
    ...new Set([...(exact.sourceHomeStockItemIds ?? []), suggestion.homeStockItemId]),
  ];

  return existing.map((item) =>
    item.id === exact.id
      ? {
          ...item,
          sources,
          sourceHomeStockItemIds,
          stockTopUpQuantity: combinedTopUp,
          remainingBuyQuantity,
          requiresReview:
            item.requiresReview || suggestion.requiresReview || hasDifferentTopUpSource,
          checked: false,
        }
      : item,
  );
}

export function buildShoppingList(
  plan: MealPlan,
  recipes: Recipe[],
  existing: ShoppingItem[] = [],
  homeStockItems: HomeStockItem[] = [],
): ShoppingItem[] {
  const recipesById = new Map(recipes.map((recipe) => [recipe.id, recipe]));
  const checkedByKey = new Map(
    existing.map((item) => [shoppingKey(item.name, item.unit), item.checked]),
  );
  const aggregated = new Map<string, ShoppingItem>();

  for (const day of DAY_KEYS) {
    const slot = plan.slots[day];
    if (!slot.recipeId) continue;
    const recipe = recipesById.get(slot.recipeId);
    if (!recipe) continue;
    const scale = slot.servings / Math.max(recipe.servings, 1);

    for (const ingredient of recipe.ingredients) {
      const key = shoppingKey(ingredient.name, ingredient.unit);
      const current = aggregated.get(key);
      const scaledQuantity =
        ingredient.quantity === null ? null : rounded(ingredient.quantity * scale);

      if (current) {
        current.grossRecipeNeed =
          current.grossRecipeNeed === null || scaledQuantity === null
            ? null
            : rounded(current.grossRecipeNeed + scaledQuantity);
        current.remainingBuyQuantity = current.grossRecipeNeed;
        if (!current.sourceRecipeIds.includes(recipe.id)) current.sourceRecipeIds.push(recipe.id);
      } else {
        aggregated.set(key, {
          id: itemId(key),
          name: ingredient.name,
          grossRecipeNeed: scaledQuantity,
          confirmedStockApplied: 0,
          remainingBuyQuantity: scaledQuantity,
          unit: ingredient.unit,
          category: ingredient.category,
          sources: ['recipe'],
          sourceRecipeIds: [recipe.id],
          requiresReview: false,
          checked: checkedByKey.get(key) ?? false,
        });
      }
    }
  }

  const activeFoodStock = homeStockItems.filter((item) => item.kind === 'food' && !item.archived);
  let stockLedger = createStockLedger(activeFoodStock);
  for (const item of aggregated.values()) {
    const match = reconcileShoppingIngredient(
      { name: item.name, quantity: item.grossRecipeNeed, unit: item.unit },
      activeFoodStock,
      stockLedger,
    );
    stockLedger = match.remainingStockLedger;

    if (match.classification === 'review') {
      // A household may explicitly review an ambiguous match and choose to buy the full
      // recipe amount. Preserve that decision across a refresh instead of silently
      // applying stock in a unit we cannot safely reconcile.
      const previous = existing.find(
        (candidate) => shoppingKey(candidate.name, candidate.unit) === shoppingKey(item.name, item.unit),
      );
      item.requiresReview = previous?.requiresReview !== false;
      continue;
    }
    if (match.classification === 'unmatched') continue;

    item.confirmedStockApplied = rounded(match.totalConfirmedQuantity);
    item.remainingBuyQuantity = match.remainingRequirement === null
      ? null
      : rounded(match.remainingRequirement);
  }

  const retainedItems: ShoppingItem[] = [];
  for (const previous of existing) {
    if (!previous.sources.includes('stock-top-up')) {
      if (!previous.sources.includes('recipe')) retainedItems.push(previous);
      continue;
    }

    const current = aggregated.get(shoppingKey(previous.name, previous.unit));
    if (!current) {
      retainedItems.push(
        previous.sources.includes('recipe')
          ? {
              ...previous,
              grossRecipeNeed: null,
              confirmedStockApplied: 0,
              remainingBuyQuantity: previous.stockTopUpQuantity ?? null,
              sources: previous.sources.includes('manual')
                ? ['manual', 'stock-top-up']
                : ['stock-top-up'],
              sourceRecipeIds: [],
            }
          : previous,
      );
      continue;
    }

    current.sources = previous.sources.includes('manual')
      ? ['recipe', 'manual', 'stock-top-up']
      : ['recipe', 'stock-top-up'];
    current.sourceHomeStockItemIds = previous.sourceHomeStockItemIds;
    current.stockTopUpQuantity = previous.stockTopUpQuantity ?? null;
    current.requiresReview = current.requiresReview || previous.requiresReview;
    current.remainingBuyQuantity =
      current.remainingBuyQuantity === null || current.stockTopUpQuantity === null
        ? current.remainingBuyQuantity ?? current.stockTopUpQuantity
        : rounded(Math.max(current.remainingBuyQuantity, current.stockTopUpQuantity));
  }
  return [...aggregated.values(), ...retainedItems].sort((left, right) =>
    left.name.localeCompare(right.name),
  );
}

/** Shared shopping reconciliation entry point used by parity tests and buildShoppingList. */
export function reconcileShoppingIngredient(
  request: IngredientMatchRequest,
  homeStockItems: readonly HomeStockItem[],
  ledger?: StockLedger,
): IngredientMatchResult {
  return matchIngredientToStock(request, homeStockItems, ledger);
}

export function formatQuantity(item: ShoppingItem): string {
  if (item.remainingBuyQuantity === null) return item.unit;
  return `${item.remainingBuyQuantity}${item.unit ? ` ${item.unit}` : ''}`;
}
