import type { MealPlan, Recipe, ShoppingItem } from './types';
import { DAY_KEYS } from './types';

function shoppingKey(name: string, unit: string): string {
  return `${name.trim().toLocaleLowerCase()}::${unit.trim().toLocaleLowerCase()}`;
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

export function buildShoppingList(
  plan: MealPlan,
  recipes: Recipe[],
  existing: ShoppingItem[] = [],
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
        current.quantity =
          current.quantity === null || scaledQuantity === null
            ? null
            : rounded(current.quantity + scaledQuantity);
        if (!current.sourceRecipeIds.includes(recipe.id)) current.sourceRecipeIds.push(recipe.id);
      } else {
        aggregated.set(key, {
          id: itemId(key),
          name: ingredient.name,
          quantity: scaledQuantity,
          unit: ingredient.unit,
          category: ingredient.category,
          sourceRecipeIds: [recipe.id],
          checked: checkedByKey.get(key) ?? false,
        });
      }
    }
  }

  return [...aggregated.values()].sort((left, right) => left.name.localeCompare(right.name));
}

export function formatQuantity(item: ShoppingItem): string {
  if (item.quantity === null) return item.unit;
  return `${item.quantity}${item.unit ? ` ${item.unit}` : ''}`;
}
