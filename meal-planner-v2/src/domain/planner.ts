import { daysBetween, seasonForWeek, toISODateLocal } from './date';
import { DomainError } from './errors';
import type { DayKey, MealPlan, Recipe } from './types';
import { DAY_KEYS } from './types';

export const MIN_MEAL_SERVINGS = 1;
export const MAX_MEAL_SERVINGS = 99;

type RandomSource = () => number;

function weightedPick(recipes: Recipe[], day: DayKey, weekStart: string, random: RandomSource) {
  const weekend = day === 'saturday' || day === 'sunday';
  const season = seasonForWeek(weekStart);
  const today = toISODateLocal(new Date());
  const weighted: Recipe[] = [];

  for (const recipe of recipes) {
    let weight = recipe.seasons.includes(season) ? 3 : 1;
    if (recipe.favourite) weight += 2;
    if (weekend && recipe.tags.includes('weekend')) weight += 2;
    if (!weekend && (recipe.tags.includes('weeknight') || recipe.tags.includes('quick')))
      weight += 2;
    if (recipe.lastCookedAt) {
      const ago = daysBetween(recipe.lastCookedAt, today);
      if (ago < 7) weight = 0;
      else if (ago < 14) weight = Math.max(1, Math.floor(weight / 2));
    }
    for (let index = 0; index < weight; index += 1) weighted.push(recipe);
  }

  const pool = weighted.length ? weighted : recipes;
  return pool[Math.floor(random() * pool.length)] ?? null;
}

export function generateMealPlan(
  plan: MealPlan,
  recipes: Recipe[],
  random: RandomSource = Math.random,
): MealPlan {
  if (!recipes.length) return plan;

  const used = new Set(
    DAY_KEYS.filter((day) => plan.slots[day].locked)
      .map((day) => plan.slots[day].recipeId)
      .filter((id): id is string => Boolean(id)),
  );
  const nextSlots = { ...plan.slots };

  for (const day of DAY_KEYS) {
    const slot = plan.slots[day];
    if (slot.kind && slot.kind !== 'recipe') continue;
    // Constrained generation resolves this later. For now, an explicit intention stays visible
    // instead of receiving a recipe from a different cuisine.
    if (slot.cuisineIntent && !slot.recipeId) continue;
    if (slot.locked && slot.recipeId) continue;
    const unused = recipes.filter((recipe) => !used.has(recipe.id));
    const candidates = unused.length ? unused : recipes;
    const picked = weightedPick(candidates, day, plan.weekStart, random);
    nextSlots[day] = {
      ...slot,
      kind: 'recipe',
      recipeId: picked?.id ?? null,
      cuisineIntent: undefined,
      cookedAt: undefined,
      lastCookedAtBeforeCooking: undefined,
    };
    if (picked) used.add(picked.id);
  }

  return {
    ...plan,
    slots: nextSlots,
    status: 'draft',
    updatedAt: new Date().toISOString(),
  };
}

export function replaceMeal(
  plan: MealPlan,
  day: DayKey,
  recipes: Recipe[],
  random: RandomSource = Math.random,
): MealPlan {
  const currentId = plan.slots[day].recipeId;
  const used = new Set(
    DAY_KEYS.filter((candidate) => candidate !== day)
      .map((candidate) => plan.slots[candidate].recipeId)
      .filter((id): id is string => Boolean(id)),
  );
  let candidates = recipes.filter((recipe) => recipe.id !== currentId && !used.has(recipe.id));
  if (!candidates.length) candidates = recipes.filter((recipe) => recipe.id !== currentId);
  if (!candidates.length) return plan;

  const picked = weightedPick(candidates, day, plan.weekStart, random);
  return {
    ...plan,
    slots: {
      ...plan.slots,
      [day]: {
        ...plan.slots[day],
        kind: 'recipe',
        recipeId: picked?.id ?? currentId,
        cuisineIntent: undefined,
        cookedAt: undefined,
        lastCookedAtBeforeCooking: undefined,
      },
    },
    status: 'draft',
    updatedAt: new Date().toISOString(),
  };
}

export function setMealServings(plan: MealPlan, day: DayKey, servings: number): MealPlan {
  if (!Number.isInteger(servings) || servings < MIN_MEAL_SERVINGS || servings > MAX_MEAL_SERVINGS) {
    throw new DomainError(
      `Servings must be a whole number between ${MIN_MEAL_SERVINGS} and ${MAX_MEAL_SERVINGS}.`,
    );
  }

  return {
    ...plan,
    slots: {
      ...plan.slots,
      [day]: { ...plan.slots[day], servings },
    },
    status: 'draft',
    updatedAt: new Date().toISOString(),
  };
}
