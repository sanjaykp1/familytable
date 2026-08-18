import { describe, expect, it } from 'vitest';
import { RepositoryError } from '../domain/errors';
import {
  BUNDLED_RECIPE_CUISINES,
  CATALOGUE_EXPANSION_RECIPES,
  createInitialState,
  SEED_RECIPES,
} from '../domain/seed';
import type { AppState } from '../domain/types';
import {
  LocalStorageMealPlannerRepository,
  STORAGE_KEY,
  type StorageLike,
} from './localStorageRepository';

class MemoryStorage implements StorageLike {
  private readonly values = new Map<string, string>();

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }

  removeItem(key: string) {
    this.values.delete(key);
  }
}

describe('LocalStorageMealPlannerRepository', () => {
  it('creates seed data on first use and persists later changes', () => {
    const storage = new MemoryStorage();
    const repository = new LocalStorageMealPlannerRepository(storage);
    const initial = repository.load();
    const updated = {
      ...initial,
      preferences: { ...initial.preferences, householdName: 'Patel family' },
    };

    repository.save(updated);

    expect(storage.getItem(STORAGE_KEY)).not.toBeNull();
    expect(repository.load().preferences.householdName).toBe('Patel family');
  });

  it('rejects invalid and unsupported backups with a useful domain error', () => {
    const repository = new LocalStorageMealPlannerRepository(new MemoryStorage());

    expect(() => repository.importData('{broken')).toThrow(RepositoryError);
    expect(() =>
      repository.importData(JSON.stringify({ ...createInitialState(), schemaVersion: 99 })),
    ).toThrow('unsupported data version');
  });

  it('rejects malformed nested records instead of accepting an invalid persisted state', () => {
    const repository = new LocalStorageMealPlannerRepository(new MemoryStorage());
    const invalidRecipe = {
      ...createInitialState(),
      recipes: [{ ...createInitialState().recipes[0], ingredients: [{ id: 'bad' }] }],
    };

    expect(() => repository.importData(JSON.stringify(invalidRecipe))).toThrow('invalid an ingredient');
  });

  it('exports a readable round-trip backup', () => {
    const repository = new LocalStorageMealPlannerRepository(new MemoryStorage());
    const initial = createInitialState();
    const weekStart = Object.keys(initial.plans)[0];
    const state: AppState = {
      ...initial,
      shoppingLists: {
        [weekStart]: [
          {
            id: 'shop-oats-g',
            name: 'Oats',
            grossRecipeNeed: 500,
            confirmedStockApplied: 100,
            remainingBuyQuantity: 400,
            unit: 'g',
            category: 'pantry',
            sources: ['recipe', 'manual'],
            sourceRecipeIds: ['recipe-porridge'],
            requiresReview: false,
            checked: true,
          },
        ],
      },
      homeStockItems: [
        {
          id: 'stock-oats',
          name: 'Oats',
          kind: 'food' as const,
          category: 'pantry',
          location: 'cupboard',
          frozen: false,
          quantity: 1.5,
          unit: 'kg',
          planningPriority: 'use-soon' as const,
          reorderPoint: 0.5,
          targetQuantity: 2,
          archived: false,
          updatedAt: '2026-08-10T08:00:00.000Z',
        },
      ],
    };

    const restored = repository.importData(repository.exportData(state));

    expect(restored.recipes).toHaveLength(state.recipes.length);
    expect(restored.preferences).toEqual(state.preferences);
    expect(restored.homeStockItems).toEqual(state.homeStockItems);
    expect(restored.shoppingLists).toEqual(state.shoppingLists);
  });

  it('round-trips replenishment decisions and accepted top-up reasons', () => {
    const repository = new LocalStorageMealPlannerRepository(new MemoryStorage());
    const initial = createInitialState();
    const weekStart = Object.keys(initial.plans)[0];
    const state: AppState = {
      ...initial,
      homeStockItems: [
        {
          id: 'stock-bananas',
          name: 'Bananas',
          kind: 'food',
          category: 'produce',
          location: 'Fruit bowl',
          frozen: false,
          quantity: 0,
          unit: '',
          planningPriority: 'normal',
          reorderPoint: 2,
          targetQuantity: 6,
          replenishmentRuleEnabled: true,
          replenishmentSuggestionStatus: 'dismissed',
          archived: false,
          updatedAt: '2026-08-10T08:00:00.000Z',
        },
        {
          id: 'stock-oats-disabled',
          name: 'Oats',
          kind: 'food',
          category: 'pantry',
          location: 'Cupboard',
          frozen: false,
          quantity: 0,
          unit: 'g',
          planningPriority: 'normal',
          reorderPoint: 100,
          targetQuantity: 500,
          replenishmentRuleEnabled: false,
          archived: false,
          updatedAt: '2026-08-10T08:00:00.000Z',
        },
      ],
      shoppingLists: {
        [weekStart]: [
          {
            id: 'shop-bananas',
            name: 'Bananas',
            grossRecipeNeed: 4,
            confirmedStockApplied: 0,
            remainingBuyQuantity: 6,
            unit: '',
            category: 'produce',
            sources: ['recipe', 'stock-top-up'],
            sourceRecipeIds: ['recipe-smoothie'],
            sourceHomeStockItemIds: ['stock-bananas'],
            stockTopUpQuantity: 6,
            requiresReview: false,
            checked: false,
          },
        ],
      },
    };

    const restored = repository.importData(repository.exportData(state));

    expect(restored.homeStockItems).toEqual(state.homeStockItems);
    expect(restored.shoppingLists).toEqual(state.shoppingLists);
  });

  it('persists a Home Stock item when its quantity is zero', () => {
    const repository = new LocalStorageMealPlannerRepository(new MemoryStorage());
    const state = {
      ...createInitialState(),
      homeStockItems: [
        {
          id: 'stock-dishwasher-tablets',
          name: 'Dishwasher tablets',
          kind: 'household' as const,
          category: 'cleaning',
          location: 'utility cupboard',
          frozen: false,
          quantity: 0,
          unit: 'tablets',
          planningPriority: 'normal' as const,
          archived: false,
          updatedAt: '2026-08-10T08:00:00.000Z',
        },
      ],
    };

    repository.save(state);

    expect(repository.load().homeStockItems).toEqual(state.homeStockItems);
  });

  it('restores Home Stock and manual shopping after an offline reload', () => {
    const storage = new MemoryStorage();
    const firstSession = new LocalStorageMealPlannerRepository(storage);
    const initial = createInitialState();
    const weekStart = Object.keys(initial.plans)[0];
    firstSession.save({
      ...initial,
      homeStockItems: [
        {
          id: 'stock-toilet-paper',
          name: 'Toilet paper',
          kind: 'household',
          category: 'Household',
          location: 'Bathroom cupboard',
          frozen: false,
          quantity: 0,
          unit: 'rolls',
          planningPriority: 'use-soon',
          archived: false,
          updatedAt: '2026-08-10T08:00:00.000Z',
        },
      ],
      shoppingLists: {
        [weekStart]: [
          {
            id: 'shop-toilet-paper',
            name: 'Toilet paper',
            grossRecipeNeed: null,
            confirmedStockApplied: 0,
            remainingBuyQuantity: 1,
            unit: 'rolls',
            category: 'other',
            sources: ['manual'],
            sourceRecipeIds: [],
            requiresReview: false,
            checked: false,
          },
        ],
      },
    });

    const reloaded = new LocalStorageMealPlannerRepository(storage).load();

    expect(reloaded.homeStockItems[0]).toMatchObject({
      name: 'Toilet paper',
      quantity: 0,
      planningPriority: 'use-soon',
    });
    expect(reloaded.shoppingLists[weekStart][0]).toMatchObject({
      name: 'Toilet paper',
      sources: ['manual'],
    });
  });

  it('migrates version one recipes and preferences to the current effort model', () => {
    const repository = new LocalStorageMealPlannerRepository(new MemoryStorage());
    const current = createInitialState();
    const legacy = {
      ...current,
      schemaVersion: 1,
      recipes: current.recipes.map((recipe) => {
        const legacyRecipe: Record<string, unknown> = { ...recipe };
        delete legacyRecipe.cookAttention;
        delete legacyRecipe.makeAhead;
        return legacyRecipe;
      }),
      preferences: {
        householdName: current.preferences.householdName,
        defaultServings: current.preferences.defaultServings,
        theme: current.preferences.theme,
      },
    };

    const restored = repository.importData(JSON.stringify(legacy));

    expect(restored.schemaVersion).toBe(9);
    expect(restored.recipes[0].cookAttention).toBe('mostly-hands-off');
    expect(restored.recipes[0].makeAhead).toBe('prep-ahead');
    expect(restored.preferences.weatherLocation).toBeNull();
  });

  it('migrates version four data without losing household data or shopping ticks', () => {
    const repository = new LocalStorageMealPlannerRepository(new MemoryStorage());
    const current = createInitialState();
    const weekStart = Object.keys(current.plans)[0];
    const legacy = {
      schemaVersion: 4,
      recipes: current.recipes,
      plans: current.plans,
      shoppingLists: {
        [weekStart]: [
          {
            id: 'shop-oats-g',
            name: 'Oats',
            quantity: 500,
            unit: 'g',
            category: 'pantry',
            sourceRecipeIds: ['seed-porridge'],
            checked: true,
          },
        ],
      },
      preferences: { ...current.preferences, householdName: 'Migration household' },
    };

    const restored = repository.importData(JSON.stringify(legacy));

    expect(restored.schemaVersion).toBe(9);
    expect(restored.recipes).toEqual(current.recipes);
    expect(restored.plans).toEqual(current.plans);
    expect(restored.preferences).toEqual(legacy.preferences);
    expect(restored.homeStockItems).toEqual([]);
    expect(restored.shoppingLists[weekStart]).toEqual([
      {
        id: 'shop-oats-g',
        name: 'Oats',
        grossRecipeNeed: 500,
        confirmedStockApplied: 0,
        remainingBuyQuantity: 500,
        unit: 'g',
        category: 'pantry',
        sources: ['recipe'],
        sourceRecipeIds: ['seed-porridge'],
        requiresReview: false,
        checked: true,
      },
    ]);
  });

  it('migrates version five frozen categories to the explicit Home Stock flag', () => {
    const repository = new LocalStorageMealPlannerRepository(new MemoryStorage());
    const current = createInitialState();
    const legacyItem = {
      id: 'stock-frozen-peas',
      name: 'Peas',
      kind: 'food',
      category: 'frozen',
      location: 'Freezer',
      quantity: 500,
      unit: 'g',
      planningPriority: 'normal',
      archived: false,
      updatedAt: '2026-08-10T08:00:00.000Z',
    };
    const legacy = { ...current, schemaVersion: 5, homeStockItems: [legacyItem] };

    const restored = repository.importData(JSON.stringify(legacy));

    expect(restored.schemaVersion).toBe(9);
    expect(restored.homeStockItems).toEqual([
      expect.objectContaining({
        id: 'stock-frozen-peas',
        category: 'frozen',
        frozen: true,
      }),
    ]);
  });

  it('adds the requested catalogue expansion once when migrating an existing household', () => {
    const repository = new LocalStorageMealPlannerRepository(new MemoryStorage());
    const current = createInitialState();
    const legacy = {
      ...current,
      schemaVersion: 3,
      recipes: current.recipes.filter((recipe) => recipe.id !== 'catalogue-miso-salmon'),
    };

    const restored = repository.importData(JSON.stringify(legacy));

    expect(restored.recipes.some((recipe) => recipe.id === 'catalogue-miso-salmon')).toBe(true);
    expect(restored.recipes.some((recipe) => recipe.id === 'catalogue-indian-dahl')).toBe(true);

    const reloaded = repository.importData(repository.exportData(restored));
    expect(reloaded.recipes.filter((recipe) => recipe.id === 'catalogue-miso-salmon')).toHaveLength(1);
  });

  it('migrates only explicitly mapped bundled recipe IDs to their controlled cuisines', () => {
    const repository = new LocalStorageMealPlannerRepository(new MemoryStorage());
    const current = createInitialState();
    const householdRecipe: Record<string, unknown> = {
      ...current.recipes.find((recipe) => recipe.id === 'catalogue-indian-dahl'),
      id: 'household-indian-dahl',
      name: 'Household Indian dahl',
    };
    const bundledRecipe: Record<string, unknown> = {
      ...current.recipes.find((recipe) => recipe.id === 'catalogue-indian-dahl'),
    };
    delete householdRecipe.cuisine;
    delete bundledRecipe.cuisine;
    const legacy = {
      ...current,
      schemaVersion: 8,
      recipes: [householdRecipe, bundledRecipe],
    };

    const restored = repository.importData(JSON.stringify(legacy));

    expect(restored.schemaVersion).toBe(9);
    expect(restored.recipes.find((recipe) => recipe.id === 'household-indian-dahl')?.cuisine).toBe(
      'uncategorised',
    );
    expect(restored.recipes.find((recipe) => recipe.id === 'catalogue-indian-dahl')?.cuisine).toBe(
      'indian',
    );
  });

  it('keeps the explicit bundled cuisine map exhaustive for the shipped catalogue', () => {
    const bundledIds = [...SEED_RECIPES, ...CATALOGUE_EXPANSION_RECIPES]
      .map((recipe) => recipe.id)
      .sort();

    expect(Object.keys(BUNDLED_RECIPE_CUISINES).sort()).toEqual(bundledIds);
    expect(createInitialState().recipes).toEqual(
      expect.arrayContaining(
        bundledIds.map((id) =>
          expect.objectContaining({ id, cuisine: BUNDLED_RECIPE_CUISINES[id] }),
        ),
      ),
    );
  });

  it('rejects current-schema recipes with a missing or unknown cuisine', () => {
    const repository = new LocalStorageMealPlannerRepository(new MemoryStorage());
    const missingCuisine = createInitialState();
    const missingRecipe: Record<string, unknown> = { ...missingCuisine.recipes[0] };
    delete missingRecipe.cuisine;
    const unknownCuisine = createInitialState();

    expect(() =>
      repository.importData(
        JSON.stringify({
          ...missingCuisine,
          recipes: [missingRecipe, ...missingCuisine.recipes.slice(1)],
        }),
      ),
    ).toThrow('invalid a recipe cuisine');
    expect(() =>
      repository.importData(
        JSON.stringify({
          ...unknownCuisine,
          recipes: [
            { ...unknownCuisine.recipes[0], cuisine: 'asian' },
            ...unknownCuisine.recipes.slice(1),
          ],
        }),
      ),
    ).toThrow('invalid a recipe cuisine');
  });

  it('round-trips an edited household recipe after migration to Uncategorised', () => {
    const repository = new LocalStorageMealPlannerRepository(new MemoryStorage());
    const current = createInitialState();
    const householdRecipe: Record<string, unknown> = {
      ...current.recipes[0],
      id: 'household-supper',
      name: 'Household supper',
    };
    delete householdRecipe.cuisine;
    const migrated = repository.importData(
      JSON.stringify({ ...current, schemaVersion: 8, recipes: [householdRecipe] }),
    );
    const edited = {
      ...migrated,
      recipes: migrated.recipes.map((recipe) =>
        recipe.id === 'household-supper' ? { ...recipe, name: 'Edited household supper' } : recipe,
      ),
    };

    const restored = repository.importData(repository.exportData(edited));

    expect(restored.recipes).toContainEqual(
      expect.objectContaining({
        id: 'household-supper',
        name: 'Edited household supper',
        cuisine: 'uncategorised',
      }),
    );
  });

  it('round-trips a valid unresolved cuisine intention', () => {
    const repository = new LocalStorageMealPlannerRepository(new MemoryStorage());
    const state = createInitialState();
    const weekStart = Object.keys(state.plans)[0];
    state.plans[weekStart].slots.tuesday = {
      ...state.plans[weekStart].slots.tuesday,
      cuisineIntent: 'indian',
    };

    const restored = repository.importData(repository.exportData(state));

    expect(restored.plans[weekStart].slots.tuesday).toMatchObject({
      recipeId: null,
      kind: 'recipe',
      cuisineIntent: 'indian',
      locked: false,
    });
  });

  it('rejects unknown and Uncategorised day intentions in the current schema', () => {
    const repository = new LocalStorageMealPlannerRepository(new MemoryStorage());
    const state = createInitialState();
    const weekStart = Object.keys(state.plans)[0];

    for (const cuisineIntent of ['asian', 'uncategorised']) {
      const invalidState = structuredClone(state) as unknown as Record<string, unknown>;
      const plans = invalidState.plans as Record<string, { slots: Record<string, unknown> }>;
      plans[weekStart].slots.tuesday = {
        ...(plans[weekStart].slots.tuesday as Record<string, unknown>),
        cuisineIntent,
      };

      expect(() => repository.importData(JSON.stringify(invalidState))).toThrow(
        'invalid a meal slot cuisine intention',
      );
    }
  });

  it('normalizes cuisine intentions away from chosen and special meals', () => {
    const repository = new LocalStorageMealPlannerRepository(new MemoryStorage());
    const state = createInitialState();
    const weekStart = Object.keys(state.plans)[0];
    state.plans[weekStart].slots.monday = {
      ...state.plans[weekStart].slots.monday,
      recipeId: state.recipes[0].id,
      cuisineIntent: 'nordic',
    };
    state.plans[weekStart].slots.tuesday = {
      ...state.plans[weekStart].slots.tuesday,
      kind: 'leftovers',
      cuisineIntent: 'indian',
      locked: true,
      cookedAt: '2026-08-17',
    };

    const restored = repository.importData(JSON.stringify(state));

    expect(restored.plans[weekStart].slots.monday).not.toHaveProperty('cuisineIntent');
    expect(restored.plans[weekStart].slots.tuesday).toMatchObject({
      kind: 'leftovers',
      recipeId: null,
      locked: false,
    });
    expect(restored.plans[weekStart].slots.tuesday).not.toHaveProperty('cuisineIntent');
    expect(restored.plans[weekStart].slots.tuesday).not.toHaveProperty('cookedAt');
  });

  it('migrates earlier data with no backup timestamp without losing saved household data', () => {
    const repository = new LocalStorageMealPlannerRepository(new MemoryStorage());
    const current = createInitialState();
    const legacy = { ...current, schemaVersion: 7 };
    delete (legacy as { lastBackupAt?: string | null }).lastBackupAt;

    const restored = repository.importData(JSON.stringify(legacy));

    expect(restored.schemaVersion).toBe(9);
    expect(restored.lastBackupAt).toBeNull();
    expect(restored.homeStockItems).toEqual(current.homeStockItems);
    expect(restored.recipes).toEqual(current.recipes);
  });

  it('persists a valid backup timestamp in exported and restored data', () => {
    const repository = new LocalStorageMealPlannerRepository(new MemoryStorage());
    const state = { ...createInitialState(), lastBackupAt: '2026-08-10T10:15:00.000Z' };

    const restored = repository.importData(repository.exportData(state));

    expect(restored.lastBackupAt).toBe('2026-08-10T10:15:00.000Z');
  });
});
