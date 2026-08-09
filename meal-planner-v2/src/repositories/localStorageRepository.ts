import { RepositoryError } from '../domain/errors';
import { CATALOGUE_EXPANSION_RECIPES, createInitialState, SEED_RECIPES } from '../domain/seed';
import type { AppState, CookAttention, MakeAhead, Recipe, WeatherLocation } from '../domain/types';
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

function normalizeRecipe(value: unknown, sourceVersion: number): Recipe {
  if (!isRecord(value)) throw new RepositoryError('A recipe in this backup is not valid.');
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
  return { ...value, cookAttention, makeAhead } as unknown as Recipe;
}

function normalizeWeatherLocation(value: unknown): WeatherLocation | null {
  if (!isRecord(value)) return null;
  if (
    typeof value.id !== 'number' ||
    typeof value.name !== 'string' ||
    typeof value.latitude !== 'number' ||
    typeof value.longitude !== 'number' ||
    typeof value.timezone !== 'string'
  ) {
    return null;
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

export function validateAndMigrate(value: unknown): AppState {
  if (!isRecord(value)) throw new RepositoryError('The backup is not a Family Table data file.');
  if (
    value.schemaVersion !== 1 &&
    value.schemaVersion !== 2 &&
    value.schemaVersion !== 3 &&
    value.schemaVersion !== 4
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
  return {
    ...value,
    schemaVersion: 4,
    recipes: addCatalogueExpansion(
      value.recipes.map((recipe) => normalizeRecipe(recipe, sourceVersion)),
      sourceVersion,
    ),
    preferences: {
      ...value.preferences,
      weatherLocation: normalizeWeatherLocation(value.preferences.weatherLocation),
    },
  } as unknown as AppState;
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
    return JSON.stringify(state, null, 2);
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
