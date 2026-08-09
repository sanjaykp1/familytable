import type { AppState } from '../domain/types';

export interface MealPlannerRepository {
  load(): AppState;
  save(state: AppState): void;
  importData(serialized: string): AppState;
  exportData(state: AppState): string;
  clear(): void;
}
