import { daysBetween, seasonForWeek, toISODateLocal } from './date';
import { canonicalIngredientKey } from './ingredientMatching';
import type {
  DayKey,
  HomeStockItem,
  MealPlan,
  MealSuggestionReasonCode,
  MealSuggestionUnavailableReasonCode,
  Recipe,
} from './types';
import { DAY_KEYS } from './types';

export interface RankedMealSuggestion {
  recipeId: string;
  score: number;
  reasonCodes: MealSuggestionReasonCode[];
}

export interface MealSuggestionResult {
  suggestions: RankedMealSuggestion[];
  manualOverrides: RankedMealSuggestion[];
  unavailableReason: MealSuggestionUnavailableReasonCode | null;
}

export interface MealInspirationRequest {
  plan: MealPlan;
  day: DayKey;
  recipes: readonly Recipe[];
  homeStockItems: readonly HomeStockItem[];
  /** ISO date or datetime, supplied by the caller so ranking is deterministic in tests. */
  now: string;
}

export interface UnresolvedMealIntention {
  day: DayKey;
  cuisine: NonNullable<MealPlan['slots'][DayKey]['cuisineIntent']>;
  reasonCode: MealSuggestionUnavailableReasonCode;
  manualOverrideRecipeIds: string[];
}

export interface InspiredMealPlanResult {
  plan: MealPlan;
  unresolvedIntentions: UnresolvedMealIntention[];
}

function stableTieBreak(weekStart: string, day: DayKey, recipeId: string): number {
  const value = `${weekStart}|${day}|${recipeId}`;
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function collectUseSoonIngredientKeys(homeStockItems: readonly HomeStockItem[]): Set<string> {
  return new Set(
    homeStockItems
      .filter(
        (item) =>
          item.kind === 'food' && !item.archived && item.planningPriority === 'use-soon',
      )
      .map((item) => canonicalIngredientKey(item.name))
      .filter((key): key is string => Boolean(key)),
  );
}

function scoreSuggestion(
  recipe: Recipe,
  request: MealInspirationRequest,
  recentlyCookedOnlyMatch: boolean,
  onlyCuisineMatch: boolean,
): RankedMealSuggestion {
  const reasonCodes: MealSuggestionReasonCode[] = [];
  let score = 0;
  const weekend = request.day === 'saturday' || request.day === 'sunday';
  const today = toISODateLocal(new Date(request.now));
  const daysSinceCooked = recipe.lastCookedAt
    ? daysBetween(recipe.lastCookedAt, today)
    : Number.POSITIVE_INFINITY;

  if (recipe.favourite) {
    score += 40;
    reasonCodes.push('favourite');
  }
  if (recipe.seasons.includes(seasonForWeek(request.plan.weekStart))) {
    score += 20;
    reasonCodes.push('in-season');
  }
  if (!weekend && (recipe.tags.includes('weeknight') || recipe.tags.includes('quick'))) {
    score += 18;
    reasonCodes.push('good-for-weeknight');
  }
  if (weekend && recipe.tags.includes('weekend')) {
    score += 18;
    reasonCodes.push('good-for-weekend');
  }

  const useSoonKeys = collectUseSoonIngredientKeys(request.homeStockItems);
  if (
    recipe.ingredients.some((ingredient) => {
      const key = canonicalIngredientKey(ingredient.name);
      return key ? useSoonKeys.has(key) : false;
    })
  ) {
    score += 24;
    reasonCodes.push('use-soon');
  }
  if (!recipe.lastCookedAt || daysSinceCooked >= 14) {
    score += 12;
    reasonCodes.push('not-cooked-recently');
  }
  if (onlyCuisineMatch) reasonCodes.push('only-cuisine-match');
  if (recentlyCookedOnlyMatch) reasonCodes.push('recently-cooked-only-match');

  return { recipeId: recipe.id, score, reasonCodes };
}

function sortSuggestions(
  suggestions: RankedMealSuggestion[],
  request: MealInspirationRequest,
  recipesById: ReadonlyMap<string, Recipe>,
): RankedMealSuggestion[] {
  return suggestions.sort((left, right) => {
    if (left.score !== right.score) return right.score - left.score;
    const stable =
      stableTieBreak(request.plan.weekStart, request.day, left.recipeId) -
      stableTieBreak(request.plan.weekStart, request.day, right.recipeId);
    if (stable) return stable;
    const leftRecipe = recipesById.get(left.recipeId);
    const rightRecipe = recipesById.get(right.recipeId);
    return (
      (leftRecipe?.name ?? '').localeCompare(rightRecipe?.name ?? '') ||
      left.recipeId.localeCompare(right.recipeId)
    );
  });
}

export function rankMealSuggestions(request: MealInspirationRequest): MealSuggestionResult {
  const slot = request.plan.slots[request.day];
  const recipesById = new Map(request.recipes.map((recipe) => [recipe.id, recipe]));
  if (!request.recipes.length) {
    return { suggestions: [], manualOverrides: [], unavailableReason: 'no-saved-recipes' };
  }

  const cuisineMatches = slot.cuisineIntent
    ? request.recipes.filter((recipe) => recipe.cuisine === slot.cuisineIntent)
    : [...request.recipes];
  if (!cuisineMatches.length) {
    return { suggestions: [], manualOverrides: [], unavailableReason: 'no-cuisine-match' };
  }

  const usedElsewhere = new Set(
    DAY_KEYS.filter((day) => day !== request.day)
      .map((day) => request.plan.slots[day].recipeId)
      .filter((recipeId): recipeId is string => Boolean(recipeId)),
  );
  const automaticMatches = cuisineMatches.filter((recipe) => !usedElsewhere.has(recipe.id));
  const manualOverrides = sortSuggestions(
    cuisineMatches
      .filter((recipe) => usedElsewhere.has(recipe.id))
      .map((recipe) => ({
        ...scoreSuggestion(recipe, request, false, cuisineMatches.length === 1),
        reasonCodes: ['already-planned-manual-option'],
      })),
    request,
    recipesById,
  );

  if (!automaticMatches.length) {
    return {
      suggestions: [],
      manualOverrides,
      unavailableReason: slot.cuisineIntent
        ? 'all-cuisine-matches-already-planned'
        : 'all-recipes-already-planned',
    };
  }

  const today = toISODateLocal(new Date(request.now));
  const notRecentlyCooked = automaticMatches.filter(
    (recipe) =>
      !recipe.lastCookedAt ||
      daysBetween(recipe.lastCookedAt, today) < 0 ||
      daysBetween(recipe.lastCookedAt, today) >= 7,
  );
  const rankedPool = notRecentlyCooked.length ? notRecentlyCooked : automaticMatches;
  const recentlyCookedOnlyMatch = !notRecentlyCooked.length && automaticMatches.length === 1;
  const onlyCuisineMatch = Boolean(slot.cuisineIntent && cuisineMatches.length === 1);
  const suggestions = sortSuggestions(
    rankedPool.map((recipe) =>
      scoreSuggestion(recipe, request, recentlyCookedOnlyMatch, onlyCuisineMatch),
    ),
    request,
    recipesById,
  );

  return { suggestions, manualOverrides, unavailableReason: null };
}

export function generateInspiredMealPlan(
  plan: MealPlan,
  recipes: readonly Recipe[],
  homeStockItems: readonly HomeStockItem[],
  now: string,
): InspiredMealPlanResult {
  const nextSlots = Object.fromEntries(
    DAY_KEYS.map((day) => [day, { ...plan.slots[day] }]),
  ) as MealPlan['slots'];
  let nextPlan: MealPlan = { ...plan, slots: nextSlots };
  const unresolvedIntentions: UnresolvedMealIntention[] = [];
  const openDays = DAY_KEYS.filter((day) => {
    const slot = nextPlan.slots[day];
    return (!slot.kind || slot.kind === 'recipe') && !slot.recipeId;
  });
  const orderedDays = [
    ...openDays.filter((day) => Boolean(nextPlan.slots[day].cuisineIntent)),
    ...openDays.filter((day) => !nextPlan.slots[day].cuisineIntent),
  ];

  for (const day of orderedDays) {
    const slot = nextPlan.slots[day];
    const result = rankMealSuggestions({ plan: nextPlan, day, recipes, homeStockItems, now });
    const chosen = result.suggestions[0];
    if (!chosen) {
      if (slot.cuisineIntent) {
        unresolvedIntentions.push({
          day,
          cuisine: slot.cuisineIntent,
          reasonCode: result.unavailableReason ?? 'no-cuisine-match',
          manualOverrideRecipeIds: result.manualOverrides.map((item) => item.recipeId),
        });
      }
      continue;
    }
    nextPlan = {
      ...nextPlan,
      slots: {
        ...nextPlan.slots,
        [day]: {
          ...slot,
          kind: 'recipe',
          recipeId: chosen.recipeId,
          cuisineIntent: undefined,
          cookedAt: undefined,
          lastCookedAtBeforeCooking: undefined,
        },
      },
    };
  }

  return {
    plan: { ...nextPlan, status: 'draft', updatedAt: now },
    unresolvedIntentions,
  };
}
