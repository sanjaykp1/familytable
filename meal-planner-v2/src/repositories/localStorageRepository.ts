import { RepositoryError } from '../domain/errors';
import {
  BUNDLED_RECIPE_CUISINES,
  CATALOGUE_EXPANSION_RECIPES,
  createInitialState,
  SEED_RECIPES,
} from '../domain/seed';
import type {
  AppState,
  CookAttention,
  CuisineId,
  CuisineIntentId,
  DayKey,
  HomeStockItem,
  Ingredient,
  MakeAhead,
  MealPlan,
  MealSlot,
  Preferences,
  Recipe,
  ReplenishmentSuggestionStatus,
  Season,
  ShoppingItem,
  ShoppingItemSource,
  ThemePreference,
  WeatherLocation,
} from '../domain/types';
import {
  CATEGORY_ORDER,
  CUISINE_IDS,
  CUISINE_INTENT_IDS,
  DAY_KEYS,
} from '../domain/types';
import type { MealPlannerRepository } from './mealPlannerRepository';

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export const STORAGE_KEY = 'family-table:v2';

const COOK_ATTENTION_VALUES: CookAttention[] = [
  'mostly-hands-off',
  'check-occasionally',
  'hands-on',
];
const MAKE_AHEAD_VALUES: MakeAhead[] = ['none', 'prep-ahead', 'fully-ahead'];
const SEASON_VALUES: Season[] = ['winter', 'spring', 'summer', 'autumn'];
const THEME_VALUES: ThemePreference[] = ['system', 'light', 'dark'];
const MEAL_SLOT_KINDS = ['recipe', 'leftovers', 'eat-out', 'skip'] as const;
const HOME_STOCK_KINDS = ['food', 'household'] as const;
const HOME_STOCK_PRIORITIES = ['normal', 'use-soon'] as const;
const SHOPPING_ITEM_SOURCES: ShoppingItemSource[] = ['recipe', 'manual', 'stock-top-up'];
const REPLENISHMENT_SUGGESTION_STATUSES: ReplenishmentSuggestionStatus[] = [
  'dismissed',
  'accepted',
];

function invalid(message: string): never {
  throw new RepositoryError(`The backup contains invalid ${message}.`);
}

function isOneOf<T extends string>(value: unknown, values: readonly T[]): value is T {
  return typeof value === 'string' && values.includes(value as T);
}

function requireString(value: unknown, field: string): string {
  if (typeof value !== 'string') invalid(field);
  return value;
}

function requireTimestamp(value: unknown, field: string): string | null {
  if (value === null) return null;
  const timestamp = requireString(value, field);
  if (Number.isNaN(Date.parse(timestamp))) invalid(field);
  return timestamp;
}

function requireNumber(value: unknown, field: string, minimum = 0): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < minimum) invalid(field);
  return value;
}

function requireQuantity(value: unknown, field: string): number | null {
  return value === null ? null : requireNumber(value, field);
}

function optionalQuantity(value: unknown, field: string): number | null | undefined {
  return value === undefined ? undefined : requireQuantity(value, field);
}

function requireArray(value: unknown, field: string): unknown[] {
  if (!Array.isArray(value)) invalid(field);
  return value;
}

function cloneRecipe(recipe: Recipe): Recipe {
  return {
    ...recipe,
    ingredients: recipe.ingredients.map((ingredient) => ({ ...ingredient })),
    seasons: [...recipe.seasons],
    tags: [...recipe.tags],
  };
}

function addCatalogueExpansion(recipes: Recipe[], sourceVersion: number): Recipe[] {
  if (sourceVersion >= 4) return recipes;
  const existingIds = new Set(recipes.map((recipe) => recipe.id));
  return [
    ...recipes,
    ...CATALOGUE_EXPANSION_RECIPES.filter((recipe) => !existingIds.has(recipe.id)).map(cloneRecipe),
  ];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeIngredient(value: unknown): Ingredient {
  if (!isRecord(value)) invalid('an ingredient');
  if (!isOneOf(value.category, CATEGORY_ORDER)) invalid('an ingredient category');
  return {
    id: requireString(value.id, 'an ingredient ID'),
    name: requireString(value.name, 'an ingredient name'),
    quantity: requireQuantity(value.quantity, 'an ingredient quantity'),
    unit: requireString(value.unit, 'an ingredient unit'),
    category: value.category,
  };
}

function normalizeRecipe(value: unknown, sourceVersion: number): Recipe {
  if (!isRecord(value)) throw new RepositoryError('A recipe in this backup is not valid.');
  const id = requireString(value.id, 'a recipe ID');
  const seedRecipe =
    sourceVersion < 3 && typeof value.id === 'string'
      ? SEED_RECIPES.find((recipe) => recipe.id === value.id)
      : undefined;
  const cookAttention = seedRecipe
    ? seedRecipe.cookAttention
    : COOK_ATTENTION_VALUES.includes(value.cookAttention as CookAttention)
      ? (value.cookAttention as CookAttention)
      : 'check-occasionally';
  const makeAhead = seedRecipe
    ? seedRecipe.makeAhead
    : MAKE_AHEAD_VALUES.includes(value.makeAhead as MakeAhead)
      ? (value.makeAhead as MakeAhead)
      : 'none';
  if (!isOneOf(cookAttention, COOK_ATTENTION_VALUES) || !isOneOf(makeAhead, MAKE_AHEAD_VALUES)) {
    invalid('a recipe effort setting');
  }
  const servings = requireNumber(value.servings, 'a recipe serving count', 1);
  if (!Number.isInteger(servings)) invalid('a recipe serving count');
  const timesCooked = requireNumber(value.timesCooked, 'a recipe cooking count');
  if (!Number.isInteger(timesCooked)) invalid('a recipe cooking count');
  const seasons = requireArray(value.seasons, 'recipe seasons').map((season) => {
    if (!isOneOf(season, SEASON_VALUES)) invalid('a recipe season');
    return season;
  });
  const tags = requireArray(value.tags, 'recipe tags').map((tag) =>
    requireString(tag, 'a recipe tag'),
  );
  const cuisine: CuisineId =
    sourceVersion < 9
      ? (BUNDLED_RECIPE_CUISINES[id] ?? 'uncategorised')
      : isOneOf(value.cuisine, CUISINE_IDS)
        ? value.cuisine
        : invalid('a recipe cuisine');

  return {
    id,
    name: requireString(value.name, 'a recipe name'),
    description: requireString(value.description, 'a recipe description'),
    cuisine,
    servings,
    prepMinutes: requireNumber(value.prepMinutes, 'recipe preparation minutes'),
    cookMinutes: requireNumber(value.cookMinutes, 'recipe cooking minutes'),
    cookAttention,
    makeAhead,
    seasons,
    tags,
    ingredients: requireArray(value.ingredients, 'recipe ingredients').map(normalizeIngredient),
    notes: requireString(value.notes, 'recipe notes'),
    favourite: (() => {
      if (typeof value.favourite !== 'boolean') invalid('a recipe favourite flag');
      return value.favourite;
    })(),
    lastCookedAt:
      value.lastCookedAt === null
        ? null
        : requireString(value.lastCookedAt, 'a recipe last-cooked date'),
    timesCooked,
    createdAt: requireString(value.createdAt, 'a recipe creation timestamp'),
    updatedAt: requireString(value.updatedAt, 'a recipe update timestamp'),
  };
}

function normalizeWeatherLocation(value: unknown): WeatherLocation | null {
  if (value === null || value === undefined) return null;
  if (!isRecord(value)) invalid('a weather location');
  if (
    typeof value.id !== 'number' ||
    typeof value.name !== 'string' ||
    typeof value.latitude !== 'number' ||
    typeof value.longitude !== 'number' ||
    typeof value.timezone !== 'string'
  ) {
    invalid('a weather location');
  }
  return {
    id: value.id,
    name: value.name,
    admin1: typeof value.admin1 === 'string' ? value.admin1 : '',
    country: typeof value.country === 'string' ? value.country : '',
    countryCode: typeof value.countryCode === 'string' ? value.countryCode : '',
    latitude: value.latitude,
    longitude: value.longitude,
    timezone: value.timezone,
  };
}

function normalizeMealSlot(value: unknown, sourceVersion: number): MealSlot {
  if (!isRecord(value)) invalid('a meal slot');
  const recipeId = value.recipeId;
  if (recipeId !== null && typeof recipeId !== 'string') invalid('a meal slot recipe ID');
  if (typeof value.locked !== 'boolean') invalid('a meal slot lock');
  const servings = requireNumber(value.servings, 'a meal slot serving count', 1);
  if (!Number.isInteger(servings)) invalid('a meal slot serving count');
  const cookedAt =
    value.cookedAt === undefined ? undefined : requireString(value.cookedAt, 'a meal cooked date');
  const lastCookedAtBeforeCooking =
    value.lastCookedAtBeforeCooking === undefined
      ? undefined
      : value.lastCookedAtBeforeCooking === null
        ? null
        : requireString(value.lastCookedAtBeforeCooking, 'a previous recipe cooked date');
  const kind = isOneOf(value.kind, MEAL_SLOT_KINDS) ? value.kind : 'recipe';
  const cuisineIntent: CuisineIntentId | undefined =
    sourceVersion < 9 || value.cuisineIntent === undefined
      ? undefined
      : isOneOf(value.cuisineIntent, CUISINE_INTENT_IDS)
        ? value.cuisineIntent
        : invalid('a meal slot cuisine intention');
  const hasUnresolvedRecipe = kind === 'recipe' && recipeId === null;
  const hasChosenRecipe = kind === 'recipe' && recipeId !== null;
  return {
    recipeId: kind === 'recipe' ? recipeId : null,
    kind,
    ...(hasUnresolvedRecipe && cuisineIntent ? { cuisineIntent } : {}),
    locked: hasChosenRecipe ? value.locked : false,
    servings,
    ...(hasChosenRecipe && cookedAt !== undefined ? { cookedAt } : {}),
    ...(hasChosenRecipe && lastCookedAtBeforeCooking !== undefined
      ? { lastCookedAtBeforeCooking }
      : {}),
  };
}

function normalizePlan(value: unknown, sourceVersion: number): MealPlan {
  if (!isRecord(value)) invalid('a meal plan');
  if (!isRecord(value.slots)) invalid('a meal plan');
  const slots = value.slots;
  if (value.status !== 'draft' && value.status !== 'ready') invalid('a meal plan status');
  const normalizedSlots = Object.fromEntries(
    DAY_KEYS.map((day) => [day, normalizeMealSlot(slots[day], sourceVersion)]),
  ) as Record<DayKey, MealSlot>;
  return {
    id: requireString(value.id, 'a meal plan ID'),
    weekStart: requireString(value.weekStart, 'a meal plan week start'),
    slots: normalizedSlots,
    status: value.status,
    updatedAt: requireString(value.updatedAt, 'a meal plan update timestamp'),
  };
}

function normalizeShoppingItem(value: unknown, sourceVersion: number): ShoppingItem {
  if (!isRecord(value)) invalid('a shopping item');
  if (!isOneOf(value.category, CATEGORY_ORDER)) invalid('a shopping item category');
  if (typeof value.checked !== 'boolean') invalid('a shopping item checked flag');
  const sourceRecipeIds = requireArray(
    value.sourceRecipeIds,
    'shopping item recipe sources',
  ).map((id) => requireString(id, 'a shopping item recipe source'));

  if (sourceVersion < 5) {
    const quantity = requireQuantity(value.quantity, 'a shopping item quantity');
    return {
      id: requireString(value.id, 'a shopping item ID'),
      name: requireString(value.name, 'a shopping item name'),
      grossRecipeNeed: quantity,
      confirmedStockApplied: 0,
      remainingBuyQuantity: quantity,
      unit: requireString(value.unit, 'a shopping item unit'),
      category: value.category,
      sources: ['recipe'],
      sourceRecipeIds,
      requiresReview: false,
      checked: value.checked,
    };
  }

  const sources = requireArray(value.sources, 'shopping item sources').map((source) => {
    if (!isOneOf(source, SHOPPING_ITEM_SOURCES)) invalid('a shopping item source');
    return source;
  });
  if (!sources.length) invalid('shopping item sources');
  if (typeof value.requiresReview !== 'boolean') invalid('a shopping item review flag');
  const sourceHomeStockItemIds =
    value.sourceHomeStockItemIds === undefined
      ? undefined
      : requireArray(value.sourceHomeStockItemIds, 'shopping item Home Stock sources').map((id) =>
          requireString(id, 'a shopping item Home Stock source'),
        );
  const stockTopUpQuantity = optionalQuantity(
    value.stockTopUpQuantity,
    'a shopping item stock top-up quantity',
  );
  return {
    id: requireString(value.id, 'a shopping item ID'),
    name: requireString(value.name, 'a shopping item name'),
    grossRecipeNeed: requireQuantity(value.grossRecipeNeed, 'a gross recipe need'),
    confirmedStockApplied: requireNumber(
      value.confirmedStockApplied,
      'a confirmed stock quantity',
    ),
    remainingBuyQuantity: requireQuantity(
      value.remainingBuyQuantity,
      'a remaining buy quantity',
    ),
    unit: requireString(value.unit, 'a shopping item unit'),
    category: value.category,
    sources,
    sourceRecipeIds,
    ...(sourceHomeStockItemIds === undefined ? {} : { sourceHomeStockItemIds }),
    ...(stockTopUpQuantity === undefined ? {} : { stockTopUpQuantity }),
    requiresReview: value.requiresReview,
    checked: value.checked,
  };
}

function normalizeHomeStockItem(value: unknown, sourceVersion: number): HomeStockItem {
  if (!isRecord(value)) invalid('a Home Stock item');
  if (!isOneOf(value.kind, HOME_STOCK_KINDS)) invalid('a Home Stock item kind');
  if (!isOneOf(value.planningPriority, HOME_STOCK_PRIORITIES)) {
    invalid('a Home Stock planning priority');
  }
  if (typeof value.archived !== 'boolean') invalid('a Home Stock archive state');
  const frozen =
    sourceVersion < 6
      ? value.kind === 'food' && value.category === 'frozen'
      : (() => {
          if (typeof value.frozen !== 'boolean') invalid('a Home Stock frozen flag');
          return value.frozen;
        })();

  const reorderPoint = optionalQuantity(value.reorderPoint, 'a Home Stock reorder point');
  const targetQuantity = optionalQuantity(value.targetQuantity, 'a Home Stock target quantity');
  const replenishmentRuleEnabled = (() => {
    if (value.replenishmentRuleEnabled === undefined) return undefined;
    if (typeof value.replenishmentRuleEnabled !== 'boolean') {
      invalid('a Home Stock replenishment rule state');
    }
    return value.replenishmentRuleEnabled;
  })();
  const replenishmentSuggestionStatus = (() => {
    if (value.replenishmentSuggestionStatus === undefined) return undefined;
    if (!isOneOf(value.replenishmentSuggestionStatus, REPLENISHMENT_SUGGESTION_STATUSES)) {
      invalid('a Home Stock replenishment suggestion status');
    }
    return value.replenishmentSuggestionStatus;
  })();
  return {
    id: requireString(value.id, 'a Home Stock item ID'),
    name: requireString(value.name, 'a Home Stock item name'),
    kind: value.kind,
    category: requireString(value.category, 'a Home Stock item category'),
    location: requireString(value.location, 'a Home Stock item location'),
    frozen,
    quantity: requireQuantity(value.quantity, 'a Home Stock item quantity'),
    unit: requireString(value.unit, 'a Home Stock item unit'),
    planningPriority: value.planningPriority,
    ...(reorderPoint === undefined ? {} : { reorderPoint }),
    ...(targetQuantity === undefined ? {} : { targetQuantity }),
    ...(replenishmentRuleEnabled === undefined ? {} : { replenishmentRuleEnabled }),
    ...(replenishmentSuggestionStatus === undefined ? {} : { replenishmentSuggestionStatus }),
    archived: value.archived,
    updatedAt: requireString(value.updatedAt, 'a Home Stock item update timestamp'),
  };
}

function normalizePreferences(value: Record<string, unknown>): Preferences {
  const defaultServings = requireNumber(value.defaultServings, 'a default serving count', 1);
  if (!Number.isInteger(defaultServings)) invalid('a default serving count');
  if (!isOneOf(value.theme, THEME_VALUES)) invalid('a theme preference');
  return {
    householdName: requireString(value.householdName, 'a household name'),
    defaultServings,
    theme: value.theme,
    weatherLocation: normalizeWeatherLocation(value.weatherLocation),
  };
}

export function validateAndMigrate(value: unknown): AppState {
  if (!isRecord(value)) throw new RepositoryError('The backup is not a Family Table data file.');
  if (
    value.schemaVersion !== 1 &&
    value.schemaVersion !== 2 &&
    value.schemaVersion !== 3 &&
    value.schemaVersion !== 4 &&
    value.schemaVersion !== 5 &&
    value.schemaVersion !== 6 &&
    value.schemaVersion !== 7 &&
    value.schemaVersion !== 8 &&
    value.schemaVersion !== 9
  ) {
    throw new RepositoryError('This backup uses an unsupported data version.');
  }
  if (!Array.isArray(value.recipes) || !isRecord(value.plans) || !isRecord(value.shoppingLists)) {
    throw new RepositoryError('The backup is missing recipes, plans, or shopping lists.');
  }
  if (!isRecord(value.preferences)) {
    throw new RepositoryError('The backup is missing household preferences.');
  }
  const sourceVersion = value.schemaVersion;
  if (sourceVersion >= 5 && !Array.isArray(value.homeStockItems)) {
    throw new RepositoryError('The backup is missing Home Stock items.');
  }
  return {
    schemaVersion: 9,
    recipes: addCatalogueExpansion(
      value.recipes.map((recipe) => normalizeRecipe(recipe, sourceVersion)),
      sourceVersion,
    ),
    plans: Object.fromEntries(
      Object.entries(value.plans).map(([weekStart, plan]) => [
        weekStart,
        normalizePlan(plan, sourceVersion),
      ]),
    ),
    shoppingLists: Object.fromEntries(
      Object.entries(value.shoppingLists).map(([weekStart, items]) => [
        weekStart,
        requireArray(items, 'a shopping list').map((item) =>
          normalizeShoppingItem(item, sourceVersion),
        ),
      ]),
    ),
    homeStockItems:
      sourceVersion < 5
        ? []
        : requireArray(value.homeStockItems, 'Home Stock items').map((item) =>
            normalizeHomeStockItem(item, sourceVersion),
          ),
    lastBackupAt:
      sourceVersion < 8 ? null : requireTimestamp(value.lastBackupAt, 'a last backup timestamp'),
    preferences: normalizePreferences(value.preferences),
  };
}

export class LocalStorageMealPlannerRepository implements MealPlannerRepository {
  constructor(
    private readonly storage: StorageLike,
    private readonly key = STORAGE_KEY,
  ) {}

  load(): AppState {
    const serialized = this.storage.getItem(this.key);
    if (!serialized) return createInitialState();
    return this.parse(serialized);
  }

  save(state: AppState): void {
    try {
      this.storage.setItem(this.key, JSON.stringify(state));
    } catch (error) {
      throw new RepositoryError('This device could not save your latest changes.', {
        cause: error,
      });
    }
  }

  importData(serialized: string): AppState {
    const state = this.parse(serialized);
    this.save(state);
    return state;
  }

  exportData(state: AppState): string {
    return JSON.stringify(validateAndMigrate(state), null, 2);
  }

  clear(): void {
    this.storage.removeItem(this.key);
  }

  private parse(serialized: string): AppState {
    try {
      return validateAndMigrate(JSON.parse(serialized) as unknown);
    } catch (error) {
      if (error instanceof RepositoryError) throw error;
      throw new RepositoryError('The saved Family Table data is not valid JSON.', { cause: error });
    }
  }
}
