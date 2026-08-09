import { describe, expect, it } from 'vitest';
import { createEmptyPlan, SEED_RECIPES } from './seed';
import { buildShoppingList } from './shopping';

describe('buildShoppingList', () => {
  it('scales and combines matching ingredients across planned dinners', () => {
    const plan = createEmptyPlan('2026-08-03', 4);
    plan.slots.monday = { recipeId: 'seed-salmon', locked: false, servings: 2 };
    plan.slots.tuesday = { recipeId: 'seed-salmon', locked: false, servings: 6 };

    const items = buildShoppingList(plan, SEED_RECIPES);
    const salmon = items.find((item) => item.name === 'salmon fillet');

    expect(salmon?.quantity).toBe(1200);
    expect(salmon?.unit).toBe('g');
    expect(salmon?.sourceRecipeIds).toEqual(['seed-salmon']);
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

  it('does not add ingredients for leftovers, eating out, or skipped dinners', () => {
    const plan = createEmptyPlan('2026-08-03', 4);
    plan.slots.monday = { ...plan.slots.monday, kind: 'leftovers' };
    plan.slots.tuesday = { ...plan.slots.tuesday, kind: 'eat-out' };
    plan.slots.wednesday = { ...plan.slots.wednesday, kind: 'skip' };

    expect(buildShoppingList(plan, SEED_RECIPES)).toEqual([]);
  });
});
