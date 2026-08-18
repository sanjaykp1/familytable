import { describe, expect, it } from 'vitest';
import { generateMealPlan, replaceMeal, setMealServings } from './planner';
import { createEmptyPlan, SEED_RECIPES } from './seed';
import { DAY_KEYS } from './types';

describe('generateMealPlan', () => {
  it('fills the week without repeating recipes when the library is large enough', () => {
    const plan = createEmptyPlan('2026-08-03', 4);

    const generated = generateMealPlan(plan, SEED_RECIPES, () => 0);
    const recipeIds = DAY_KEYS.map((day) => generated.slots[day].recipeId);

    expect(recipeIds.every(Boolean)).toBe(true);
    expect(new Set(recipeIds).size).toBe(DAY_KEYS.length);
    expect(generated.status).toBe('draft');
  });

  it('preserves a locked meal while regenerating the remaining days', () => {
    const plan = createEmptyPlan('2026-08-03', 4);
    plan.slots.monday = { recipeId: SEED_RECIPES[2].id, locked: true, servings: 6 };

    const generated = generateMealPlan(plan, SEED_RECIPES, () => 0.25);

    expect(generated.slots.monday).toEqual(plan.slots.monday);
    expect(generated.slots.tuesday.recipeId).not.toBeNull();
  });

  it('preserves intentional non-recipe plans while filling the rest of the week', () => {
    const plan = createEmptyPlan('2026-08-03', 4);
    plan.slots.wednesday = {
      ...plan.slots.wednesday,
      kind: 'leftovers',
      recipeId: null,
    };
    plan.slots.friday = {
      ...plan.slots.friday,
      kind: 'eat-out',
      recipeId: null,
    };

    const generated = generateMealPlan(plan, SEED_RECIPES, () => 0.4);

    expect(generated.slots.wednesday.kind).toBe('leftovers');
    expect(generated.slots.friday.kind).toBe('eat-out');
    expect(generated.slots.monday.recipeId).not.toBeNull();
  });

  it('leaves an unresolved cuisine intention open instead of silently substituting a meal', () => {
    const plan = createEmptyPlan('2026-08-17', 4);
    plan.slots.tuesday = { ...plan.slots.tuesday, cuisineIntent: 'indian' };

    const generated = generateMealPlan(plan, SEED_RECIPES, () => 0);

    expect(generated.slots.tuesday).toEqual(plan.slots.tuesday);
    expect(generated.slots.monday.recipeId).not.toBeNull();
  });
});

describe('replaceMeal', () => {
  it('replaces one day without selecting a meal already used elsewhere', () => {
    const plan = createEmptyPlan('2026-08-03', 4);
    plan.slots.monday.recipeId = SEED_RECIPES[0].id;
    plan.slots.tuesday.recipeId = SEED_RECIPES[1].id;

    const replaced = replaceMeal(plan, 'monday', SEED_RECIPES, () => 0);

    expect(replaced.slots.monday.recipeId).not.toBe(SEED_RECIPES[0].id);
    expect(replaced.slots.monday.recipeId).not.toBe(SEED_RECIPES[1].id);
  });
});

describe('setMealServings', () => {
  it('updates one meal and returns the plan to draft for shopping-list recalculation', () => {
    const plan = createEmptyPlan('2026-08-03', 4);
    plan.status = 'ready';

    const updated = setMealServings(plan, 'thursday', 6);

    expect(updated.slots.thursday.servings).toBe(6);
    expect(updated.slots.monday.servings).toBe(4);
    expect(updated.status).toBe('draft');
  });

  it('rejects zero, fractional, and unreasonably large serving counts', () => {
    const plan = createEmptyPlan('2026-08-03', 4);

    expect(() => setMealServings(plan, 'monday', 0)).toThrow('whole number');
    expect(() => setMealServings(plan, 'monday', 1.5)).toThrow('whole number');
    expect(() => setMealServings(plan, 'monday', 100)).toThrow('whole number');
  });
});
