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
  quantity: number | null;
  unit: string;
  category: IngredientCategory;
  sourceRecipeIds: string[];
  checked: boolean;
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
  schemaVersion: 4;
  recipes: Recipe[];
  plans: Record<string, MealPlan>;
  shoppingLists: Record<string, ShoppingItem[]>;
  preferences: Preferences;
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
