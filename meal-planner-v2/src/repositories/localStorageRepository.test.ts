import { describe, expect, it } from 'vitest';
import { RepositoryError } from '../domain/errors';
import { createInitialState } from '../domain/seed';
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

  it('exports a readable round-trip backup', () => {
    const repository = new LocalStorageMealPlannerRepository(new MemoryStorage());
    const state = createInitialState();

    const restored = repository.importData(repository.exportData(state));

    expect(restored.recipes).toHaveLength(state.recipes.length);
    expect(restored.preferences).toEqual(state.preferences);
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

    expect(restored.schemaVersion).toBe(4);
    expect(restored.recipes[0].cookAttention).toBe('mostly-hands-off');
    expect(restored.recipes[0].makeAhead).toBe('prep-ahead');
    expect(restored.preferences.weatherLocation).toBeNull();
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
});
