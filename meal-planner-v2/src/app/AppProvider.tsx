import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { startOfWeek, toISODateLocal } from '../domain/date';
import { RepositoryError } from '../domain/errors';
import { generateMealPlan, replaceMeal, setMealServings } from '../domain/planner';
import { createEmptyPlan, createInitialState } from '../domain/seed';
import { buildShoppingList } from '../domain/shopping';
import type {
  AppState,
  DayKey,
  MealPlan,
  MealSlotKind,
  Preferences,
  Recipe,
  ShoppingItem,
} from '../domain/types';
import { DAY_KEYS } from '../domain/types';
import { LocalStorageMealPlannerRepository } from '../repositories/localStorageRepository';
import type { MealPlannerRepository } from '../repositories/mealPlannerRepository';

export interface ToastMessage {
  id: string;
  tone: 'success' | 'error' | 'info';
  message: string;
}

interface AppContextValue {
  state: AppState;
  activeWeek: string;
  currentPlan: MealPlan;
  shoppingItems: ShoppingItem[];
  storageError: string | null;
  toasts: ToastMessage[];
  goToWeek: (weekStart: string) => void;
  setMeal: (day: DayKey, recipeId: string | null, kind?: MealSlotKind) => void;
  updateMealServings: (day: DayKey, servings: number) => void;
  toggleLock: (day: DayKey) => void;
  generateWeek: () => void;
  swapMeal: (day: DayKey) => void;
  markCooked: (day: DayKey) => void;
  markPlanReady: () => void;
  reopenPlan: () => void;
  upsertRecipe: (recipe: Recipe) => void;
  deleteRecipe: (recipeId: string) => void;
  rebuildShopping: () => void;
  toggleShoppingItem: (itemId: string) => void;
  updatePreferences: (patch: Partial<Preferences>) => void;
  exportData: () => string;
  importData: (serialized: string) => void;
  resetData: () => void;
  notify: (message: string, tone?: ToastMessage['tone']) => void;
  dismissToast: (id: string) => void;
}

const AppContext = createContext<AppContextValue | null>(null);

function createBrowserRepository(): MealPlannerRepository {
  return new LocalStorageMealPlannerRepository(window.localStorage);
}

function boot(repository: MealPlannerRepository): { state: AppState; error: string | null } {
  try {
    return { state: repository.load(), error: null };
  } catch (error) {
    return {
      state: createInitialState(),
      error:
        error instanceof Error
          ? error.message
          : 'Saved data could not be loaded. A fresh in-memory copy is open.',
    };
  }
}

function makeToastId() {
  return `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function AppProvider({
  children,
  repository,
}: {
  children: ReactNode;
  repository?: MealPlannerRepository;
}) {
  const [activeRepository] = useState<MealPlannerRepository>(
    () => repository ?? createBrowserRepository(),
  );
  const [initial] = useState(() => boot(activeRepository));
  const [state, setState] = useState<AppState>(initial.state);
  const [activeWeek, setActiveWeek] = useState(startOfWeek());
  const [storageError, setStorageError] = useState<string | null>(initial.error);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const skipInitialPersist = useRef(true);

  const notify = useCallback((message: string, tone: ToastMessage['tone'] = 'info') => {
    const toast = { id: makeToastId(), message, tone };
    setToasts((current) => [...current, toast]);
    window.setTimeout(() => {
      setToasts((current) => current.filter((item) => item.id !== toast.id));
    }, 4200);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((current) => current.filter((item) => item.id !== id));
  }, []);

  useEffect(() => {
    if (skipInitialPersist.current) {
      skipInitialPersist.current = false;
      return;
    }
    try {
      activeRepository.save(state);
      queueMicrotask(() => setStorageError(null));
    } catch (error) {
      const message =
        error instanceof RepositoryError
          ? error.message
          : 'Changes are in memory but could not be saved on this device.';
      queueMicrotask(() => {
        setStorageError(message);
        notify(message, 'error');
      });
    }
  }, [activeRepository, notify, state]);

  useEffect(() => {
    const root = document.documentElement;
    const theme = state.preferences.theme;
    if (theme === 'system') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', theme);
  }, [state.preferences.theme]);

  const currentPlan = useMemo(
    () => state.plans[activeWeek] ?? createEmptyPlan(activeWeek, state.preferences.defaultServings),
    [activeWeek, state.plans, state.preferences.defaultServings],
  );
  const shoppingItems = useMemo(
    () => state.shoppingLists[activeWeek] ?? [],
    [activeWeek, state.shoppingLists],
  );

  const goToWeek = useCallback(
    (weekStart: string) => {
      setActiveWeek(weekStart);
      setState((current) => {
        if (current.plans[weekStart]) return current;
        return {
          ...current,
          plans: {
            ...current.plans,
            [weekStart]: createEmptyPlan(weekStart, current.preferences.defaultServings),
          },
        };
      });
    },
    [setActiveWeek],
  );

  const updateActivePlan = useCallback(
    (updater: (plan: MealPlan, current: AppState) => MealPlan) => {
      setState((current) => {
        const plan =
          current.plans[activeWeek] ??
          createEmptyPlan(activeWeek, current.preferences.defaultServings);
        const nextPlan = updater(plan, current);
        const nextShopping = { ...current.shoppingLists };
        delete nextShopping[activeWeek];
        return {
          ...current,
          plans: { ...current.plans, [activeWeek]: nextPlan },
          shoppingLists: nextShopping,
        };
      });
    },
    [activeWeek],
  );

  const setMeal = useCallback(
    (day: DayKey, recipeId: string | null, kind: MealSlotKind = 'recipe') => {
      updateActivePlan((plan) => ({
        ...plan,
        slots: {
          ...plan.slots,
          [day]: {
            ...plan.slots[day],
            kind,
            recipeId: kind === 'recipe' ? recipeId : null,
            locked: kind === 'recipe' && recipeId ? plan.slots[day].locked : false,
          },
        },
        status: 'draft',
        updatedAt: new Date().toISOString(),
      }));
    },
    [updateActivePlan],
  );

  const toggleLock = useCallback(
    (day: DayKey) => {
      updateActivePlan((plan) => ({
        ...plan,
        slots: {
          ...plan.slots,
          [day]: { ...plan.slots[day], locked: !plan.slots[day].locked },
        },
        updatedAt: new Date().toISOString(),
      }));
    },
    [updateActivePlan],
  );

  const updateMealServings = useCallback(
    (day: DayKey, servings: number) => {
      updateActivePlan((plan) => setMealServings(plan, day, servings));
    },
    [updateActivePlan],
  );

  const generateWeek = useCallback(() => {
    if (!state.recipes.length) {
      notify('Add a recipe before generating a week.', 'error');
      return;
    }
    updateActivePlan((plan, current) => generateMealPlan(plan, current.recipes));
    notify('Your week has been planned.', 'success');
  }, [notify, state.recipes.length, updateActivePlan]);

  const swapMeal = useCallback(
    (day: DayKey) => {
      updateActivePlan((plan, current) => replaceMeal(plan, day, current.recipes));
    },
    [updateActivePlan],
  );

  const markCooked = useCallback(
    (day: DayKey) => {
      const recipeId = currentPlan.slots[day].recipeId;
      if (!recipeId) return;
      setState((current) => ({
        ...current,
        recipes: current.recipes.map((recipe) =>
          recipe.id === recipeId
            ? {
                ...recipe,
                lastCookedAt: toISODateLocal(new Date()),
                timesCooked: recipe.timesCooked + 1,
                updatedAt: new Date().toISOString(),
              }
            : recipe,
        ),
      }));
      notify('Dinner logged. It will be deprioritised next week.', 'success');
    },
    [currentPlan.slots, notify],
  );

  const markPlanReady = useCallback(() => {
    setState((current) => {
      const plan =
        current.plans[activeWeek] ??
        createEmptyPlan(activeWeek, current.preferences.defaultServings);
      const nextPlan = { ...plan, status: 'ready' as const, updatedAt: new Date().toISOString() };
      return {
        ...current,
        plans: { ...current.plans, [activeWeek]: nextPlan },
        shoppingLists: {
          ...current.shoppingLists,
          [activeWeek]: buildShoppingList(
            nextPlan,
            current.recipes,
            current.shoppingLists[activeWeek],
          ),
        },
      };
    });
    notify('Plan ready. Your shopping list is waiting.', 'success');
  }, [activeWeek, notify]);

  const reopenPlan = useCallback(() => {
    updateActivePlan((plan) => ({ ...plan, status: 'draft', updatedAt: new Date().toISOString() }));
  }, [updateActivePlan]);

  const upsertRecipe = useCallback(
    (recipe: Recipe) => {
      setState((current) => {
        const exists = current.recipes.some((item) => item.id === recipe.id);
        return {
          ...current,
          recipes: exists
            ? current.recipes.map((item) => (item.id === recipe.id ? recipe : item))
            : [recipe, ...current.recipes],
          shoppingLists: {},
        };
      });
      notify('Recipe saved.', 'success');
    },
    [notify],
  );

  const deleteRecipe = useCallback(
    (recipeId: string) => {
      setState((current) => {
        const plans = Object.fromEntries(
          Object.entries(current.plans).map(([week, plan]) => [
            week,
            {
              ...plan,
              status: 'draft',
              slots: Object.fromEntries(
                DAY_KEYS.map((day) => [
                  day,
                  plan.slots[day].recipeId === recipeId
                    ? {
                        ...plan.slots[day],
                        kind: 'recipe' as const,
                        recipeId: null,
                        locked: false,
                      }
                    : plan.slots[day],
                ]),
              ) as MealPlan['slots'],
            },
          ]),
        ) as Record<string, MealPlan>;
        return {
          ...current,
          recipes: current.recipes.filter((recipe) => recipe.id !== recipeId),
          plans,
          shoppingLists: {},
        };
      });
      notify('Recipe deleted.', 'info');
    },
    [notify],
  );

  const rebuildShopping = useCallback(() => {
    setState((current) => {
      const plan =
        current.plans[activeWeek] ??
        createEmptyPlan(activeWeek, current.preferences.defaultServings);
      return {
        ...current,
        shoppingLists: {
          ...current.shoppingLists,
          [activeWeek]: buildShoppingList(plan, current.recipes, current.shoppingLists[activeWeek]),
        },
      };
    });
    notify('Shopping list refreshed.', 'success');
  }, [activeWeek, notify]);

  const toggleShoppingItem = useCallback(
    (itemId: string) => {
      setState((current) => ({
        ...current,
        shoppingLists: {
          ...current.shoppingLists,
          [activeWeek]: (current.shoppingLists[activeWeek] ?? []).map((item) =>
            item.id === itemId ? { ...item, checked: !item.checked } : item,
          ),
        },
      }));
    },
    [activeWeek],
  );

  const updatePreferences = useCallback((patch: Partial<Preferences>) => {
    setState((current) => ({
      ...current,
      preferences: { ...current.preferences, ...patch },
    }));
  }, []);

  const exportData = useCallback(
    () => activeRepository.exportData(state),
    [activeRepository, state],
  );

  const importData = useCallback(
    (serialized: string) => {
      try {
        const imported = activeRepository.importData(serialized);
        setState(imported);
        const week = Object.keys(imported.plans).sort().at(-1) ?? startOfWeek();
        setActiveWeek(week);
        notify('Backup imported successfully.', 'success');
      } catch (error) {
        notify(
          error instanceof Error ? error.message : 'The backup could not be imported.',
          'error',
        );
        throw error;
      }
    },
    [activeRepository, notify],
  );

  const resetData = useCallback(() => {
    activeRepository.clear();
    const fresh = createInitialState();
    setState(fresh);
    setActiveWeek(startOfWeek());
    notify('Local data reset to the starter set.', 'success');
  }, [activeRepository, notify]);

  const value = useMemo<AppContextValue>(
    () => ({
      state,
      activeWeek,
      currentPlan,
      shoppingItems,
      storageError,
      toasts,
      goToWeek,
      setMeal,
      updateMealServings,
      toggleLock,
      generateWeek,
      swapMeal,
      markCooked,
      markPlanReady,
      reopenPlan,
      upsertRecipe,
      deleteRecipe,
      rebuildShopping,
      toggleShoppingItem,
      updatePreferences,
      exportData,
      importData,
      resetData,
      notify,
      dismissToast,
    }),
    [
      activeWeek,
      currentPlan,
      deleteRecipe,
      dismissToast,
      exportData,
      generateWeek,
      goToWeek,
      importData,
      markCooked,
      markPlanReady,
      notify,
      rebuildShopping,
      reopenPlan,
      resetData,
      setMeal,
      updateMealServings,
      shoppingItems,
      state,
      storageError,
      swapMeal,
      toasts,
      toggleLock,
      toggleShoppingItem,
      updatePreferences,
      upsertRecipe,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used inside AppProvider.');
  return context;
}
