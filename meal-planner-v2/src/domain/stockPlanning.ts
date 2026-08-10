import type { DayKey, HomeStockItem, MealPlan, Recipe } from './types';
import { DAY_KEYS } from './types';
import {
  createStockLedger,
  matchIngredientToStock,
  type IngredientMatchResult,
  type StockLedger,
} from './ingredientMatching';

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
  baseQuantity: number;
  matchKind: 'exact' | 'alias';
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
  ingredientMatches: IngredientMatchResult[];
  remainingStockLedger: StockLedger;
  useSoonItemIds: string[];
  reason: string;
}

export interface LockedStockReservationFailure extends StockEligibilityFailure {
  day: DayKey;
  recipeId: string;
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
      lockedReservationFailures: LockedStockReservationFailure[];
    }
  | {
      ok: false;
      plan: MealPlan;
      failures: StockPlanConstraintFailure[];
      constrainedStockItemIds: string[];
      lockedReservationFailures: LockedStockReservationFailure[];
    };

function quantityLabel(quantity: number | null, unit: string): string {
  if (quantity === null) return 'an unknown quantity';
  return `${quantity}${unit ? ` ${unit}` : ''}`;
}

function failureForMatch(
  ingredient: Recipe['ingredients'][number],
  match: IngredientMatchResult,
): StockEligibilityFailure | null {
  const common = {
    ingredientId: ingredient.id,
    ingredientName: ingredient.name,
    requiredQuantity: ingredient.quantity,
    unit: ingredient.unit,
    matchedStockItemIds: match.matchedStockItemIds,
  };

  switch (match.reasonCode) {
    case 'no-name-match':
      return {
        ...common,
        code: 'missing-stock',
        availableQuantity: 0,
        message: `${ingredient.name} is not in confirmed Home Stock.`,
      };
    case 'unknown-required-quantity':
      return {
        ...common,
        code: 'unknown-required-quantity',
        availableQuantity: null,
        message: `${ingredient.name} has no confirmed recipe quantity.`,
      };
    case 'unknown-stock-quantity':
      return {
        ...common,
        code: 'unknown-stock-quantity',
        availableQuantity: null,
        message: `${ingredient.name} has no confirmed Home Stock quantity.`,
      };
    case 'incompatible-unit':
      return {
        ...common,
        code: 'incompatible-unit',
        availableQuantity: null,
        message: `${ingredient.name} has matching Home Stock recorded in an incompatible unit.`,
      };
    case 'ambiguous-alias':
      return {
        ...common,
        code: 'ambiguous-match',
        availableQuantity: null,
        message: `${ingredient.name} has an ambiguous Home Stock alias that needs review.`,
      };
    case 'insufficient-stock':
      return {
        ...common,
        code: 'insufficient-stock',
        availableQuantity: match.totalConfirmedQuantity,
        message: `${ingredient.name} needs ${quantityLabel(ingredient.quantity, ingredient.unit)}, but only ${quantityLabel(match.totalConfirmedQuantity, ingredient.unit)} is available.`,
      };
    case null:
      return null;
  }
}

/** Strictly checks one saved recipe against confirmed stock through the shared matcher. */
export function evaluateStockOnlyRecipe(
  recipe: Recipe,
  homeStockItems: HomeStockItem[],
  initialLedger: StockLedger = createStockLedger(homeStockItems),
): StockOnlyRecipeEvaluation {
  const stockById = new Map(homeStockItems.map((item) => [item.id, item]));
  let remainingLedger = initialLedger;
  const allocations: StockIngredientAllocation[] = [];
  const failures: StockEligibilityFailure[] = [];
  const ingredientMatches: IngredientMatchResult[] = [];

  for (const ingredient of recipe.ingredients) {
    const match = matchIngredientToStock(ingredient, homeStockItems, remainingLedger);
    ingredientMatches.push(match);
    remainingLedger = match.remainingStockLedger;

    allocations.push(...match.allocations.map((allocation) => ({
      ingredientId: ingredient.id,
      ingredientName: ingredient.name,
      requiredQuantity: ingredient.quantity ?? 0,
      unit: ingredient.unit,
      stockItemId: allocation.stockItemId,
      stockItemName: allocation.stockItemName,
      allocatedQuantity: allocation.allocatedQuantity,
      baseQuantity: allocation.baseQuantity,
      matchKind: allocation.matchKind,
      useSoon: stockById.get(allocation.stockItemId)?.planningPriority === 'use-soon',
    })));

    const failure = failureForMatch(ingredient, match);
    if (failure) failures.push(failure);
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

  return {
    recipe,
    eligible,
    allocations,
    failures,
    ingredientMatches,
    remainingStockLedger: remainingLedger,
    useSoonItemIds,
    reason,
  };
}

/** Eligible recipes first, prioritising the number of distinct use-soon items. */
export function rankStockOnlyRecipes(
  recipes: Recipe[],
  homeStockItems: HomeStockItem[],
  initialLedger: StockLedger = createStockLedger(homeStockItems),
): StockOnlyRecipeEvaluation[] {
  return recipes
    .map((recipe) => evaluateStockOnlyRecipe(recipe, homeStockItems, initialLedger))
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

export interface LockedStockReservationResult {
  remainingStockLedger: StockLedger;
  failures: LockedStockReservationFailure[];
}

/** Reserves locked recipe requirements in deterministic plan-day order. */
export function reserveLockedMealStock(
  plan: MealPlan,
  recipes: Recipe[],
  homeStockItems: HomeStockItem[],
  initialLedger: StockLedger = createStockLedger(homeStockItems),
): LockedStockReservationResult {
  const recipesById = new Map(recipes.map((recipe) => [recipe.id, recipe]));
  let remainingStockLedger = initialLedger;
  const failures: LockedStockReservationFailure[] = [];

  for (const day of DAY_KEYS) {
    const slot = plan.slots[day];
    if (!slot.locked || !slot.recipeId || (slot.kind && slot.kind !== 'recipe')) continue;
    const lockedRecipe = recipesById.get(slot.recipeId);
    if (!lockedRecipe) continue;
    const scale = slot.servings / Math.max(lockedRecipe.servings, 1);

    for (const ingredient of lockedRecipe.ingredients) {
      const scaledIngredient = {
        ...ingredient,
        quantity: ingredient.quantity === null
          ? null
          : Number((ingredient.quantity * scale).toFixed(6)),
      };
      const match = matchIngredientToStock(
        scaledIngredient,
        homeStockItems,
        remainingStockLedger,
      );
      remainingStockLedger = match.remainingStockLedger;
      const failure = failureForMatch(scaledIngredient, match);
      if (failure) failures.push({ ...failure, day, recipeId: lockedRecipe.id });
    }
  }

  return { remainingStockLedger, failures };
}

export interface StockOnlyPlanEvaluation {
  recipeEvaluations: StockOnlyRecipeEvaluation[];
  lockedReservationFailures: LockedStockReservationFailure[];
  remainingStockLedger: StockLedger;
}

/** Evaluates suggestions against the balance left after all locked meals are reserved. */
export function evaluateStockOnlyPlan(
  plan: MealPlan,
  recipes: Recipe[],
  homeStockItems: HomeStockItem[],
): StockOnlyPlanEvaluation {
  const lockedReservations = reserveLockedMealStock(plan, recipes, homeStockItems);
  return {
    recipeEvaluations: rankStockOnlyRecipes(
      recipes,
      homeStockItems,
      lockedReservations.remainingStockLedger,
    ),
    lockedReservationFailures: lockedReservations.failures,
    remainingStockLedger: lockedReservations.remainingStockLedger,
  };
}

function quantitiesFor(evaluation: StockOnlyRecipeEvaluation): Map<string, number> {
  const quantities = new Map<string, number>();
  for (const allocation of evaluation.allocations) {
    quantities.set(
      allocation.stockItemId,
      (quantities.get(allocation.stockItemId) ?? 0) + allocation.baseQuantity,
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
  const planEvaluation = evaluateStockOnlyPlan(plan, recipes, homeStockItems);
  const lockedReservations = {
    failures: planEvaluation.lockedReservationFailures,
    remainingStockLedger: planEvaluation.remainingStockLedger,
  };
  const ranked = planEvaluation.recipeEvaluations;
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
    return {
      ok: false,
      plan,
      failures,
      constrainedStockItemIds: [...constraintIds],
      lockedReservationFailures: lockedReservations.failures,
    };
  }

  const available = new Map(
    [...lockedReservations.remainingStockLedger].flatMap(([id, quantity]) =>
      quantity === null ? [] : [[id, quantity] as const],
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
      lockedReservationFailures: lockedReservations.failures,
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
      lockedReservationFailures: lockedReservations.failures,
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
    lockedReservationFailures: lockedReservations.failures,
  };
}
