import type { DayKey, HomeStockItem, MealPlan, Recipe } from './types';
import { DAY_KEYS } from './types';

export type StockEligibilityFailureCode =
  | 'missing-stock'
  | 'unknown-required-quantity'
  | 'unknown-stock-quantity'
  | 'insufficient-stock'
  | 'incompatible-unit'
  | 'ambiguous-match';

export interface StockIngredientAllocation {
  ingredientId: string;
  ingredientName: string;
  requiredQuantity: number;
  unit: string;
  stockItemId: string;
  stockItemName: string;
  allocatedQuantity: number;
  useSoon: boolean;
}

export interface StockEligibilityFailure {
  code: StockEligibilityFailureCode;
  ingredientId: string;
  ingredientName: string;
  requiredQuantity: number | null;
  unit: string;
  matchedStockItemIds: string[];
  availableQuantity: number | null;
  message: string;
}

export interface StockOnlyRecipeEvaluation {
  recipe: Recipe;
  eligible: boolean;
  allocations: StockIngredientAllocation[];
  failures: StockEligibilityFailure[];
  useSoonItemIds: string[];
  reason: string;
}

export interface StockPlanConstraintFailure {
  stockItemId: string;
  stockItemName: string;
  message: string;
}

export type StockOnlyPlanResult =
  | {
      ok: true;
      plan: MealPlan;
      suggestions: StockOnlyRecipeEvaluation[];
      constrainedStockItemIds: string[];
    }
  | {
      ok: false;
      plan: MealPlan;
      failures: StockPlanConstraintFailure[];
      constrainedStockItemIds: string[];
    };

function normalized(value: string): string {
  return value.trim().toLocaleLowerCase().replace(/\s+/g, ' ');
}

function quantityLabel(quantity: number | null, unit: string): string {
  if (quantity === null) return 'an unknown quantity';
  return `${quantity}${unit ? ` ${unit}` : ''}`;
}

function activeFoodStock(homeStockItems: HomeStockItem[]): HomeStockItem[] {
  return homeStockItems.filter((item) => item.kind === 'food' && !item.archived);
}

/**
 * Strictly checks one saved recipe against confirmed stock. Matching is deliberately
 * conservative: names and units must match after whitespace/case normalisation, and
 * more than one same-name stock record needs human review before it can qualify.
 */
export function evaluateStockOnlyRecipe(
  recipe: Recipe,
  homeStockItems: HomeStockItem[],
): StockOnlyRecipeEvaluation {
  const stock = activeFoodStock(homeStockItems);
  const remaining = new Map(stock.map((item) => [item.id, item.quantity]));
  const allocations: StockIngredientAllocation[] = [];
  const failures: StockEligibilityFailure[] = [];

  for (const ingredient of recipe.ingredients) {
    const required = ingredient.quantity;
    const nameMatches = stock.filter(
      (item) => normalized(item.name) === normalized(ingredient.name),
    );
    const matchedStockItemIds = nameMatches.map((item) => item.id);

    if (required === null) {
      failures.push({
        code: 'unknown-required-quantity',
        ingredientId: ingredient.id,
        ingredientName: ingredient.name,
        requiredQuantity: null,
        unit: ingredient.unit,
        matchedStockItemIds,
        availableQuantity: null,
        message: `${ingredient.name} has no confirmed recipe quantity.`,
      });
      continue;
    }

    if (!nameMatches.length) {
      failures.push({
        code: 'missing-stock',
        ingredientId: ingredient.id,
        ingredientName: ingredient.name,
        requiredQuantity: required,
        unit: ingredient.unit,
        matchedStockItemIds: [],
        availableQuantity: 0,
        message: `${ingredient.name} is not in confirmed Home Stock.`,
      });
      continue;
    }

    if (nameMatches.length > 1) {
      failures.push({
        code: 'ambiguous-match',
        ingredientId: ingredient.id,
        ingredientName: ingredient.name,
        requiredQuantity: required,
        unit: ingredient.unit,
        matchedStockItemIds,
        availableQuantity: null,
        message: `${ingredient.name} matches more than one Home Stock item.`,
      });
      continue;
    }

    const [match] = nameMatches;
    if (normalized(match.unit) !== normalized(ingredient.unit)) {
      failures.push({
        code: 'incompatible-unit',
        ingredientId: ingredient.id,
        ingredientName: ingredient.name,
        requiredQuantity: required,
        unit: ingredient.unit,
        matchedStockItemIds,
        availableQuantity: match.quantity,
        message: `${ingredient.name} needs ${ingredient.unit || 'a unit count'}, but Home Stock is recorded in ${match.unit || 'unit counts'}.`,
      });
      continue;
    }

    const available = remaining.get(match.id) ?? null;
    if (available === null) {
      failures.push({
        code: 'unknown-stock-quantity',
        ingredientId: ingredient.id,
        ingredientName: ingredient.name,
        requiredQuantity: required,
        unit: ingredient.unit,
        matchedStockItemIds,
        availableQuantity: null,
        message: `${ingredient.name} has no confirmed Home Stock quantity.`,
      });
      continue;
    }

    if (available < required) {
      failures.push({
        code: 'insufficient-stock',
        ingredientId: ingredient.id,
        ingredientName: ingredient.name,
        requiredQuantity: required,
        unit: ingredient.unit,
        matchedStockItemIds,
        availableQuantity: available,
        message: `${ingredient.name} needs ${quantityLabel(required, ingredient.unit)}, but only ${quantityLabel(available, ingredient.unit)} is available.`,
      });
      continue;
    }

    remaining.set(match.id, available - required);
    allocations.push({
      ingredientId: ingredient.id,
      ingredientName: ingredient.name,
      requiredQuantity: required,
      unit: ingredient.unit,
      stockItemId: match.id,
      stockItemName: match.name,
      allocatedQuantity: required,
      useSoon: match.planningPriority === 'use-soon',
    });
  }

  const useSoonItemIds = [
    ...new Set(allocations.filter((item) => item.useSoon).map((item) => item.stockItemId)),
  ];
  const eligible = failures.length === 0;
  const useSoonNames = [
    ...new Set(allocations.filter((item) => item.useSoon).map((item) => item.stockItemName)),
  ];
  const reason = eligible
    ? useSoonNames.length
      ? `Fully covered by Home Stock and uses soon: ${useSoonNames.join(', ')}.`
      : 'Every required ingredient is covered by confirmed Home Stock.'
    : failures.map((failure) => failure.message).join(' ');

  return { recipe, eligible, allocations, failures, useSoonItemIds, reason };
}

/** Eligible recipes first, prioritising the number of distinct use-soon items. */
export function rankStockOnlyRecipes(
  recipes: Recipe[],
  homeStockItems: HomeStockItem[],
): StockOnlyRecipeEvaluation[] {
  return recipes
    .map((recipe) => evaluateStockOnlyRecipe(recipe, homeStockItems))
    .sort((left, right) => {
      if (left.eligible !== right.eligible) return left.eligible ? -1 : 1;
      if (left.eligible && right.eligible) {
        const useSoonDifference = right.useSoonItemIds.length - left.useSoonItemIds.length;
        if (useSoonDifference) return useSoonDifference;
      }
      const nameDifference = left.recipe.name.localeCompare(right.recipe.name);
      return nameDifference || left.recipe.id.localeCompare(right.recipe.id);
    });
}

function quantitiesFor(evaluation: StockOnlyRecipeEvaluation): Map<string, number> {
  const quantities = new Map<string, number>();
  for (const allocation of evaluation.allocations) {
    quantities.set(
      allocation.stockItemId,
      (quantities.get(allocation.stockItemId) ?? 0) + allocation.allocatedQuantity,
    );
  }
  return quantities;
}

function canAdd(
  evaluation: StockOnlyRecipeEvaluation,
  used: Map<string, number>,
  available: Map<string, number>,
): boolean {
  for (const [stockItemId, quantity] of quantitiesFor(evaluation)) {
    if ((used.get(stockItemId) ?? 0) + quantity > (available.get(stockItemId) ?? 0)) return false;
  }
  return true;
}

function addQuantities(evaluation: StockOnlyRecipeEvaluation, used: Map<string, number>): void {
  for (const [stockItemId, quantity] of quantitiesFor(evaluation)) {
    used.set(stockItemId, (used.get(stockItemId) ?? 0) + quantity);
  }
}

function removeQuantities(evaluation: StockOnlyRecipeEvaluation, used: Map<string, number>): void {
  for (const [stockItemId, quantity] of quantitiesFor(evaluation)) {
    const next = (used.get(stockItemId) ?? 0) - quantity;
    if (next) used.set(stockItemId, next);
    else used.delete(stockItemId);
  }
}

function coversConstraints(
  evaluations: StockOnlyRecipeEvaluation[],
  constraintIds: Set<string>,
): boolean {
  const covered = new Set(
    evaluations.flatMap((evaluation) =>
      evaluation.allocations.map((allocation) => allocation.stockItemId),
    ),
  );
  return [...constraintIds].every((id) => covered.has(id));
}

function chooseConstraintRecipes(
  candidates: StockOnlyRecipeEvaluation[],
  constraintIds: Set<string>,
  slotCount: number,
  available: Map<string, number>,
): StockOnlyRecipeEvaluation[] | null {
  if (!constraintIds.size) return [];
  const chosen: StockOnlyRecipeEvaluation[] = [];
  const used = new Map<string, number>();

  const visit = (start: number): StockOnlyRecipeEvaluation[] | null => {
    if (coversConstraints(chosen, constraintIds)) return [...chosen];
    if (chosen.length >= slotCount) return null;

    for (let index = start; index < candidates.length; index += 1) {
      const candidate = candidates[index];
      if (!canAdd(candidate, used, available)) continue;
      chosen.push(candidate);
      addQuantities(candidate, used);
      const result = visit(index + 1);
      if (result) return result;
      removeQuantities(candidate, used);
      chosen.pop();
    }
    return null;
  };

  return visit(0);
}

/**
 * Creates a deterministic stock-only draft using saved recipes. Selected stock IDs
 * are hard constraints. A failed constraint returns the original plan reference.
 */
export function generateStockOnlyMealPlan(
  plan: MealPlan,
  recipes: Recipe[],
  homeStockItems: HomeStockItem[],
  constrainedStockItemIds: string[],
  updatedAt: string,
): StockOnlyPlanResult {
  const constraintIds = new Set(constrainedStockItemIds);
  const ranked = rankStockOnlyRecipes(recipes, homeStockItems);
  const eligible = ranked.filter((evaluation) => evaluation.eligible);
  const stockById = new Map(homeStockItems.map((item) => [item.id, item]));
  const failures: StockPlanConstraintFailure[] = [];

  for (const stockItemId of constraintIds) {
    const item = stockById.get(stockItemId);
    const matching = eligible.some((evaluation) =>
      evaluation.allocations.some((allocation) => allocation.stockItemId === stockItemId),
    );
    if (!item || item.archived || item.kind !== 'food') {
      failures.push({
        stockItemId,
        stockItemName: item?.name ?? 'Unknown Home Stock item',
        message: `${item?.name ?? 'The selected item'} is not active food in Home Stock.`,
      });
    } else if (!matching) {
      failures.push({
        stockItemId,
        stockItemName: item.name,
        message: `No fully covered saved recipe can use ${item.name}.`,
      });
    }
  }

  const openDays = DAY_KEYS.filter((day) => {
    const slot = plan.slots[day];
    return !slot.locked && (!slot.kind || slot.kind === 'recipe');
  });
  if (constraintIds.size && !openDays.length) {
    failures.push({
      stockItemId: '',
      stockItemName: 'Weekly plan',
      message: 'There is no unlocked recipe night available for the selected Home Stock.',
    });
  }
  if (failures.length) {
    return { ok: false, plan, failures, constrainedStockItemIds: [...constraintIds] };
  }

  const available = new Map(
    activeFoodStock(homeStockItems).flatMap((item) =>
      item.quantity === null ? [] : [[item.id, item.quantity] as const],
    ),
  );
  const constrained = chooseConstraintRecipes(eligible, constraintIds, openDays.length, available);
  if (constrained === null) {
    return {
      ok: false,
      plan,
      failures: [...constraintIds].map((id) => ({
        stockItemId: id,
        stockItemName: stockById.get(id)?.name ?? 'Selected Home Stock item',
        message: `The selected must-use items cannot fit together in a fully covered saved-recipe plan.`,
      })),
      constrainedStockItemIds: [...constraintIds],
    };
  }

  const selected = [...constrained];
  const used = new Map<string, number>();
  selected.forEach((evaluation) => addQuantities(evaluation, used));
  for (const candidate of eligible) {
    if (selected.length >= openDays.length) break;
    if (selected.some((item) => item.recipe.id === candidate.recipe.id)) continue;
    if (!canAdd(candidate, used, available)) continue;
    selected.push(candidate);
    addQuantities(candidate, used);
  }

  if (!selected.length) {
    return {
      ok: false,
      plan,
      failures: [
        {
          stockItemId: '',
          stockItemName: 'Home Stock',
          message: 'No saved recipe is fully covered by confirmed Home Stock.',
        },
      ],
      constrainedStockItemIds: [],
    };
  }

  const nextSlots = { ...plan.slots };
  selected.forEach((evaluation, index) => {
    const day: DayKey | undefined = openDays[index];
    if (!day) return;
    nextSlots[day] = {
      ...nextSlots[day],
      kind: 'recipe',
      recipeId: evaluation.recipe.id,
      servings: evaluation.recipe.servings,
    };
  });

  return {
    ok: true,
    plan: { ...plan, slots: nextSlots, status: 'draft', updatedAt },
    suggestions: selected,
    constrainedStockItemIds: [...constraintIds],
  };
}
