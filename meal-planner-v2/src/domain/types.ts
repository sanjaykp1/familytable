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
export const CUISINE_INTENT_IDS = [
  'indian',
  'chinese',
  'japanese',
  'korean',
  'thai',
  'vietnamese',
  'italian',
  'mexican',
  'latin-american',
  'mediterranean',
  'middle-eastern',
  'nordic',
  'british-irish',
  'american',
  'other',
] as const;
export type CuisineIntentId = (typeof CUISINE_INTENT_IDS)[number];

export const CUISINE_IDS = [...CUISINE_INTENT_IDS, 'uncategorised'] as const;
export type CuisineId = (typeof CUISINE_IDS)[number];

export const CUISINE_LABELS: Record<CuisineId, string> = {
  indian: 'Indian',
  chinese: 'Chinese',
  japanese: 'Japanese',
  korean: 'Korean',
  thai: 'Thai',
  vietnamese: 'Vietnamese',
  italian: 'Italian',
  mexican: 'Mexican',
  'latin-american': 'Latin American',
  mediterranean: 'Mediterranean',
  'middle-eastern': 'Middle Eastern',
  nordic: 'Nordic',
  'british-irish': 'British & Irish',
  american: 'American',
  other: 'Other',
  uncategorised: 'Uncategorised',
};

export const MEAL_SUGGESTION_REASON_CODES = [
  'favourite',
  'good-for-weeknight',
  'good-for-weekend',
  'in-season',
  'use-soon',
  'not-cooked-recently',
  'only-cuisine-match',
  'recently-cooked-only-match',
  'already-planned-manual-option',
] as const;
export type MealSuggestionReasonCode = (typeof MEAL_SUGGESTION_REASON_CODES)[number];

export const MEAL_SUGGESTION_UNAVAILABLE_REASON_CODES = [
  'no-saved-recipes',
  'no-cuisine-match',
  'all-cuisine-matches-already-planned',
  'all-recipes-already-planned',
] as const;
export type MealSuggestionUnavailableReasonCode =
  (typeof MEAL_SUGGESTION_UNAVAILABLE_REASON_CODES)[number];
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
  /** Required in persisted schema 9; optional only until the Slice 1 recipe form lands. */
  cuisine: CuisineId;
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
  /** A still-unresolved cuisine choice for this day; never valid with a chosen or special meal. */
  cuisineIntent?: CuisineIntentId;
  locked: boolean;
  servings: number;
  /** A local record that this specific planned dinner was cooked. */
  cookedAt?: string;
  /** Lets “mark as not cooked” restore the recipe's previous history. */
  lastCookedAtBeforeCooking?: string | null;
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
  /** Repositories migrate supported older documents and always return version 9. */
  schemaVersion: 9;
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
