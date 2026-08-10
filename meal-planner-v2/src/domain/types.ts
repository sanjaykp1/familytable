export const DAY_KEYS = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
] as const;

export type DayKey = (typeof DAY_KEYS)[number];
export type Season = 'winter' | 'spring' | 'summer' | 'autumn';
export type ThemePreference = 'system' | 'light' | 'dark';
export type PlanStatus = 'draft' | 'ready';
export type MealSlotKind = 'recipe' | 'leftovers' | 'eat-out' | 'skip';
export type CookAttention = 'mostly-hands-off' | 'check-occasionally' | 'hands-on';
export type MakeAhead = 'none' | 'prep-ahead' | 'fully-ahead';
export type HomeStockKind = 'food' | 'household';
export type HomeStockPlanningPriority = 'normal' | 'use-soon';
export type ShoppingItemSource = 'recipe' | 'manual' | 'stock-top-up';
export type ReplenishmentSuggestionStatus = 'dismissed' | 'accepted';
export type IngredientCategory =
  'produce' | 'protein' | 'dairy' | 'bakery' | 'pantry' | 'frozen' | 'other';

export interface Ingredient {
  id: string;
  name: string;
  quantity: number | null;
  unit: string;
  category: IngredientCategory;
}

export interface Recipe {
  id: string;
  name: string;
  description: string;
  servings: number;
  prepMinutes: number;
  cookMinutes: number;
  cookAttention: CookAttention;
  makeAhead: MakeAhead;
  seasons: Season[];
  tags: string[];
  ingredients: Ingredient[];
  notes: string;
  favourite: boolean;
  lastCookedAt: string | null;
  timesCooked: number;
  createdAt: string;
  updatedAt: string;
}

export interface MealSlot {
  recipeId: string | null;
  kind?: MealSlotKind;
  locked: boolean;
  servings: number;
}

export interface MealPlan {
  id: string;
  weekStart: string;
  slots: Record<DayKey, MealSlot>;
  status: PlanStatus;
  updatedAt: string;
}

export interface ShoppingItem {
  id: string;
  name: string;
  grossRecipeNeed: number | null;
  confirmedStockApplied: number;
  remainingBuyQuantity: number | null;
  unit: string;
  category: IngredientCategory;
  sources: ShoppingItemSource[];
  sourceRecipeIds: string[];
  sourceHomeStockItemIds?: string[];
  stockTopUpQuantity?: number | null;
  requiresReview: boolean;
  checked: boolean;
}

export interface HomeStockItem {
  id: string;
  name: string;
  kind: HomeStockKind;
  category: string;
  location: string;
  frozen: boolean;
  quantity: number | null;
  unit: string;
  planningPriority: HomeStockPlanningPriority;
  reorderPoint?: number | null;
  targetQuantity?: number | null;
  replenishmentRuleEnabled?: boolean;
  replenishmentSuggestionStatus?: ReplenishmentSuggestionStatus;
  archived: boolean;
  updatedAt: string;
}

export interface Preferences {
  householdName: string;
  defaultServings: number;
  theme: ThemePreference;
  weatherLocation: WeatherLocation | null;
}

export interface WeatherLocation {
  id: number;
  name: string;
  admin1: string;
  country: string;
  countryCode: string;
  latitude: number;
  longitude: number;
  timezone: string;
}

export interface AppState {
  schemaVersion: 8;
  recipes: Recipe[];
  plans: Record<string, MealPlan>;
  shoppingLists: Record<string, ShoppingItem[]>;
  homeStockItems: HomeStockItem[];
  preferences: Preferences;
  /** ISO timestamp of the last backup whose download was started, or null if none exists. */
  lastBackupAt: string | null;
}

export interface ReplenishmentSuggestion {
  id: string;
  homeStockItemId: string;
  name: string;
  currentQuantity: number | null;
  reorderPoint: number;
  targetQuantity: number;
  suggestedQuantity: number | null;
  unit: string;
  category: IngredientCategory;
  requiresReview: boolean;
  reviewReason: 'unknown-quantity' | 'invalid-target' | null;
}

export const CATEGORY_LABELS: Record<IngredientCategory, string> = {
  produce: 'Fruit & vegetables',
  protein: 'Meat, fish & proteins',
  dairy: 'Dairy & eggs',
  bakery: 'Bakery',
  pantry: 'Pantry',
  frozen: 'Frozen',
  other: 'Other',
};

export const CATEGORY_ORDER: IngredientCategory[] = [
  'produce',
  'protein',
  'dairy',
  'bakery',
  'pantry',
  'frozen',
  'other',
];
