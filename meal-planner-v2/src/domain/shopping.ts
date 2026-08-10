import type {
  HomeStockItem,
  IngredientCategory,
  MealPlan,
  Recipe,
  ReplenishmentSuggestion,
  ShoppingItem,
} from './types';
import { CATEGORY_ORDER, DAY_KEYS } from './types';

function normalized(value: string): string {
  return value.trim().toLocaleLowerCase().replace(/\s+/g, ' ');
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
  for (const item of aggregated.values()) {
    const nameMatches = activeFoodStock.filter(
      (stockItem) => normalized(stockItem.name) === normalized(item.name),
    );
    if (!nameMatches.length) continue;

    const compatibleMatches = nameMatches.filter(
      (stockItem) => normalized(stockItem.unit) === normalized(item.unit),
    );
    const hasIncompatibleUnit = compatibleMatches.length !== nameMatches.length;
    const hasUnknownQuantity = compatibleMatches.some((stockItem) => stockItem.quantity === null);
    if (
      hasIncompatibleUnit ||
      hasUnknownQuantity ||
      item.grossRecipeNeed === null ||
      !compatibleMatches.length
    ) {
      // A household may explicitly review an ambiguous match and choose to buy the full
      // recipe amount. Preserve that decision across a refresh instead of silently
      // applying stock in a unit we cannot safely reconcile.
      const previous = existing.find(
        (candidate) => shoppingKey(candidate.name, candidate.unit) === shoppingKey(item.name, item.unit),
      );
      item.requiresReview = previous?.requiresReview !== false;
      continue;
    }

    const available = compatibleMatches.reduce(
      (total, stockItem) => total + (stockItem.quantity ?? 0),
      0,
    );
    item.confirmedStockApplied = rounded(Math.min(available, item.grossRecipeNeed));
    item.remainingBuyQuantity = rounded(item.grossRecipeNeed - item.confirmedStockApplied);
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

export function formatQuantity(item: ShoppingItem): string {
  if (item.remainingBuyQuantity === null) return item.unit;
  return `${item.remainingBuyQuantity}${item.unit ? ` ${item.unit}` : ''}`;
}
