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
import { needsBackupReminder } from '../domain/backup';
import { RepositoryError } from '../domain/errors';
import { generateMealPlan, replaceMeal, setMealServings } from '../domain/planner';
import { createEmptyPlan, createInitialState } from '../domain/seed';
import {
  acceptReplenishmentSuggestion as addAcceptedReplenishmentToList,
  buildReplenishmentSuggestions,
  buildShoppingList,
} from '../domain/shopping';
import { generateStockOnlyMealPlan, type StockOnlyPlanResult } from '../domain/stockPlanning';
import type {
  AppState,
  DayKey,
  HomeStockItem,
  MealPlan,
  MealSlotKind,
  Preferences,
  Recipe,
  ReplenishmentSuggestion,
  ShoppingItem,
  ShoppingItemSource,
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
  replenishmentSuggestions: ReplenishmentSuggestion[];
  storageError: string | null;
  backupReminderNeeded: boolean;
  toasts: ToastMessage[];
  goToWeek: (weekStart: string) => void;
  setMeal: (day: DayKey, recipeId: string | null, kind?: MealSlotKind) => void;
  updateMealServings: (day: DayKey, servings: number) => void;
  toggleLock: (day: DayKey) => void;
  generateWeek: () => void;
  planFromStock: (constrainedStockItemIds?: string[]) => StockOnlyPlanResult;
  swapMeal: (day: DayKey) => void;
  markCooked: (day: DayKey) => void;
  markPlanReady: () => void;
  reopenPlan: () => void;
  clearMealPlan: () => void;
  upsertRecipe: (recipe: Recipe) => void;
  toggleRecipeFavourite: (recipeId: string) => void;
  deleteRecipe: (recipeId: string) => void;
  rebuildShopping: () => void;
  toggleShoppingItem: (itemId: string) => void;
  upsertHomeStockItem: (item: HomeStockItem) => void;
  adjustHomeStockQuantity: (itemId: string, adjustment: number) => void;
  markHomeStockUsedUp: (itemId: string) => void;
  toggleHomeStockUseSoon: (itemId: string) => void;
  archiveHomeStockItem: (itemId: string) => void;
  restoreHomeStockItem: (itemId: string) => void;
  addHomeStockItemToShopping: (itemId: string) => void;
  acceptReplenishmentSuggestion: (itemId: string) => void;
  dismissReplenishmentSuggestion: (itemId: string) => void;
  disableReplenishmentRule: (itemId: string) => void;
  addManualShoppingItem: (
    item: Pick<ShoppingItem, 'name' | 'remainingBuyQuantity' | 'unit' | 'category'>,
  ) => void;
  resolveShoppingReview: (itemId: string) => void;
  updatePreferences: (patch: Partial<Preferences>) => void;
  exportData: (lastBackupAt?: string) => string;
  recordBackup: (lastBackupAt: string) => void;
  importData: (serialized: string) => void;
  resetData: () => void;
  dismissBackupReminder: () => void;
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

function makeItemId(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`;
}

function resetReplenishmentCycle(
  previous: HomeStockItem | undefined,
  next: HomeStockItem,
): HomeStockItem {
  const ruleChanged = Boolean(
    previous &&
    (previous.reorderPoint !== next.reorderPoint ||
      previous.targetQuantity !== next.targetQuantity ||
      previous.replenishmentRuleEnabled !== next.replenishmentRuleEnabled),
  );
  const replenished =
    next.quantity !== null &&
    next.reorderPoint !== undefined &&
    next.reorderPoint !== null &&
    next.quantity > next.reorderPoint;
  if (!ruleChanged && !replenished) return next;
  return { ...next, replenishmentSuggestionStatus: undefined };
}

function retainIndependentShoppingItems(items: ShoppingItem[] | undefined): ShoppingItem[] {
  return (items ?? []).filter(
    (item) => item.sources.includes('manual') || item.sources.includes('stock-top-up'),
  );
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
  const [backupReminderDismissed, setBackupReminderDismissed] = useState(false);
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
  const replenishmentSuggestions = useMemo(
    () => buildReplenishmentSuggestions(state.homeStockItems),
    [state.homeStockItems],
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
        const retainedItems = retainIndependentShoppingItems(nextShopping[activeWeek]);
        if (retainedItems.length) nextShopping[activeWeek] = retainedItems;
        else delete nextShopping[activeWeek];
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

  const planFromStock = useCallback(
    (constrainedStockItemIds: string[] = []) => {
      const result = generateStockOnlyMealPlan(
        currentPlan,
        state.recipes,
        state.homeStockItems,
        constrainedStockItemIds,
        new Date().toISOString(),
      );
      if (!result.ok) {
        notify(result.failures.map((failure) => failure.message).join(' '), 'error');
        return result;
      }

      setState((current) => {
        const nextShopping = { ...current.shoppingLists };
        const retainedItems = retainIndependentShoppingItems(nextShopping[activeWeek]);
        if (retainedItems.length) nextShopping[activeWeek] = retainedItems;
        else delete nextShopping[activeWeek];
        return {
          ...current,
          plans: { ...current.plans, [activeWeek]: result.plan },
          shoppingLists: nextShopping,
        };
      });
      notify(
        `Planned ${result.suggestions.length} stock-only dinner${result.suggestions.length === 1 ? '' : 's'}. Home Stock was not adjusted.`,
        'success',
      );
      return result;
    },
    [activeWeek, currentPlan, notify, state.homeStockItems, state.recipes],
  );

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
            current.homeStockItems,
          ),
        },
      };
    });
    notify('Plan ready. Your shopping list is waiting.', 'success');
  }, [activeWeek, notify]);

  const reopenPlan = useCallback(() => {
    updateActivePlan((plan) => ({ ...plan, status: 'draft', updatedAt: new Date().toISOString() }));
  }, [updateActivePlan]);

  const clearMealPlan = useCallback(() => {
    setState((current) => {
      const nextShopping = { ...current.shoppingLists };
      delete nextShopping[activeWeek];
      return {
        ...current,
        plans: {
          ...current.plans,
          [activeWeek]: createEmptyPlan(activeWeek, current.preferences.defaultServings),
        },
        shoppingLists: nextShopping,
      };
    });
    notify('Meal plan cleared.', 'success');
  }, [activeWeek, notify]);

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

  const toggleRecipeFavourite = useCallback(
    (recipeId: string) => {
      const recipe = state.recipes.find((item) => item.id === recipeId);
      if (!recipe) return;
      const favourite = !recipe.favourite;
      setState((current) => ({
        ...current,
        recipes: current.recipes.map((item) =>
          item.id === recipeId ? { ...item, favourite, updatedAt: new Date().toISOString() } : item,
        ),
      }));
      notify(
        favourite
          ? `${recipe.name} is now a household favourite.`
          : `${recipe.name} is no longer a household favourite.`,
        'success',
      );
    },
    [notify, state.recipes],
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
          [activeWeek]: buildShoppingList(
            plan,
            current.recipes,
            current.shoppingLists[activeWeek],
            current.homeStockItems,
          ),
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

  const upsertHomeStockItem = useCallback(
    (item: HomeStockItem) => {
      setState((current) => {
        const previous = current.homeStockItems.find((candidate) => candidate.id === item.id);
        const nextItem = resetReplenishmentCycle(previous, item);
        return {
          ...current,
          homeStockItems: previous
            ? current.homeStockItems.map((candidate) =>
                candidate.id === item.id ? nextItem : candidate,
              )
            : [nextItem, ...current.homeStockItems],
        };
      });
      notify('Home Stock saved.', 'success');
    },
    [notify],
  );

  const updateHomeStock = useCallback(
    (itemId: string, updater: (item: HomeStockItem) => HomeStockItem, message: string) => {
      setState((current) => ({
        ...current,
        homeStockItems: current.homeStockItems.map((item) =>
          item.id === itemId ? resetReplenishmentCycle(item, updater(item)) : item,
        ),
      }));
      notify(message, 'success');
    },
    [notify],
  );

  const adjustHomeStockQuantity = useCallback(
    (itemId: string, adjustment: number) => {
      updateHomeStock(
        itemId,
        (item) => ({
          ...item,
          quantity: Math.max(0, (item.quantity ?? 0) + adjustment),
          updatedAt: new Date().toISOString(),
        }),
        'Home Stock quantity updated.',
      );
    },
    [updateHomeStock],
  );

  const markHomeStockUsedUp = useCallback(
    (itemId: string) => {
      updateHomeStock(
        itemId,
        (item) => ({ ...item, quantity: 0, updatedAt: new Date().toISOString() }),
        'Marked as used up. It remains in Home Stock.',
      );
    },
    [updateHomeStock],
  );

  const toggleHomeStockUseSoon = useCallback(
    (itemId: string) => {
      updateHomeStock(
        itemId,
        (item) => ({
          ...item,
          planningPriority: item.planningPriority === 'use-soon' ? 'normal' : 'use-soon',
          updatedAt: new Date().toISOString(),
        }),
        'Home Stock priority updated.',
      );
    },
    [updateHomeStock],
  );

  const archiveHomeStockItem = useCallback(
    (itemId: string) => {
      updateHomeStock(
        itemId,
        (item) => ({ ...item, archived: true, updatedAt: new Date().toISOString() }),
        'Home Stock item archived.',
      );
    },
    [updateHomeStock],
  );

  const restoreHomeStockItem = useCallback(
    (itemId: string) => {
      updateHomeStock(
        itemId,
        (item) => ({ ...item, archived: false, updatedAt: new Date().toISOString() }),
        'Home Stock item restored.',
      );
    },
    [updateHomeStock],
  );

  const addHomeStockItemToShopping = useCallback(
    (itemId: string) => {
      setState((current) => {
        const stockItem = current.homeStockItems.find((item) => item.id === itemId);
        if (!stockItem) return current;
        const derivedSuggestion = buildReplenishmentSuggestions([stockItem])[0];
        const quantity = stockItem.targetQuantity ?? 1;
        const suggestion: ReplenishmentSuggestion = derivedSuggestion ?? {
          id: `manual-top-up-${stockItem.id}`,
          homeStockItemId: stockItem.id,
          name: stockItem.name,
          currentQuantity: stockItem.quantity,
          reorderPoint: stockItem.reorderPoint ?? 0,
          targetQuantity: quantity,
          suggestedQuantity: quantity,
          unit: stockItem.unit,
          category: 'other',
          requiresReview: stockItem.quantity === null,
          reviewReason: stockItem.quantity === null ? 'unknown-quantity' : null,
        };
        return {
          ...current,
          homeStockItems: derivedSuggestion
            ? current.homeStockItems.map((item) =>
                item.id === itemId
                  ? { ...item, replenishmentSuggestionStatus: 'accepted' as const }
                  : item,
              )
            : current.homeStockItems,
          shoppingLists: {
            ...current.shoppingLists,
            [activeWeek]: addAcceptedReplenishmentToList(
              current.shoppingLists[activeWeek] ?? [],
              suggestion,
            ),
          },
        };
      });
      notify('Added to this week’s shopping list.', 'success');
    },
    [activeWeek, notify],
  );

  const acceptReplenishmentSuggestion = useCallback(
    (itemId: string) => {
      setState((current) => {
        const stockItem = current.homeStockItems.find((item) => item.id === itemId);
        if (!stockItem) return current;
        const suggestion = buildReplenishmentSuggestions([stockItem])[0];
        if (!suggestion) return current;
        return {
          ...current,
          homeStockItems: current.homeStockItems.map((item) =>
            item.id === itemId
              ? { ...item, replenishmentSuggestionStatus: 'accepted' as const }
              : item,
          ),
          shoppingLists: {
            ...current.shoppingLists,
            [activeWeek]: addAcceptedReplenishmentToList(
              current.shoppingLists[activeWeek] ?? [],
              suggestion,
            ),
          },
        };
      });
      notify('Top-up accepted and added to this week’s shopping list.', 'success');
    },
    [activeWeek, notify],
  );

  const dismissReplenishmentSuggestion = useCallback(
    (itemId: string) => {
      updateHomeStock(
        itemId,
        (item) => ({
          ...item,
          replenishmentSuggestionStatus: 'dismissed',
          updatedAt: new Date().toISOString(),
        }),
        'Top-up suggestion dismissed.',
      );
    },
    [updateHomeStock],
  );

  const disableReplenishmentRule = useCallback(
    (itemId: string) => {
      updateHomeStock(
        itemId,
        (item) => ({
          ...item,
          replenishmentRuleEnabled: false,
          updatedAt: new Date().toISOString(),
        }),
        'Replenishment rule disabled.',
      );
    },
    [updateHomeStock],
  );

  const addManualShoppingItem = useCallback(
    (item: Pick<ShoppingItem, 'name' | 'remainingBuyQuantity' | 'unit' | 'category'>) => {
      const source: ShoppingItemSource = 'manual';
      setState((current) => ({
        ...current,
        shoppingLists: {
          ...current.shoppingLists,
          [activeWeek]: [
            ...(current.shoppingLists[activeWeek] ?? []),
            {
              id: makeItemId('shop-manual'),
              name: item.name.trim(),
              grossRecipeNeed: null,
              confirmedStockApplied: 0,
              remainingBuyQuantity: item.remainingBuyQuantity,
              unit: item.unit.trim(),
              category: item.category,
              sources: [source],
              sourceRecipeIds: [],
              requiresReview: false,
              checked: false,
            },
          ],
        },
      }));
      notify('Added to this week’s shopping list.', 'success');
    },
    [activeWeek, notify],
  );

  const resolveShoppingReview = useCallback(
    (itemId: string) => {
      setState((current) => ({
        ...current,
        shoppingLists: {
          ...current.shoppingLists,
          [activeWeek]: (current.shoppingLists[activeWeek] ?? []).map((item) =>
            item.id === itemId
              ? { ...item, requiresReview: false, confirmedStockApplied: 0 }
              : item,
          ),
        },
      }));
      notify('Reviewed. The full recipe amount remains to buy.', 'success');
    },
    [activeWeek, notify],
  );

  const updatePreferences = useCallback((patch: Partial<Preferences>) => {
    setState((current) => ({
      ...current,
      preferences: { ...current.preferences, ...patch },
    }));
  }, []);

  const exportData = useCallback(
    (lastBackupAt?: string) =>
      activeRepository.exportData(
        lastBackupAt === undefined ? state : { ...state, lastBackupAt },
      ),
    [activeRepository, state],
  );

  const recordBackup = useCallback((lastBackupAt: string) => {
    setState((current) => ({ ...current, lastBackupAt }));
  }, []);

  const dismissBackupReminder = useCallback(() => {
    setBackupReminderDismissed(true);
  }, []);

  const backupReminderNeeded =
    !backupReminderDismissed && needsBackupReminder(state.lastBackupAt);

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
      replenishmentSuggestions,
      storageError,
      backupReminderNeeded,
      toasts,
      goToWeek,
      setMeal,
      updateMealServings,
      toggleLock,
      generateWeek,
      planFromStock,
      swapMeal,
      markCooked,
      markPlanReady,
      reopenPlan,
      clearMealPlan,
      upsertRecipe,
      toggleRecipeFavourite,
      deleteRecipe,
      rebuildShopping,
      toggleShoppingItem,
      upsertHomeStockItem,
      adjustHomeStockQuantity,
      markHomeStockUsedUp,
      toggleHomeStockUseSoon,
      archiveHomeStockItem,
      restoreHomeStockItem,
      addHomeStockItemToShopping,
      acceptReplenishmentSuggestion,
      dismissReplenishmentSuggestion,
      disableReplenishmentRule,
      addManualShoppingItem,
      resolveShoppingReview,
      updatePreferences,
      exportData,
      recordBackup,
      importData,
      resetData,
      dismissBackupReminder,
      notify,
      dismissToast,
    }),
    [
      activeWeek,
      acceptReplenishmentSuggestion,
      addHomeStockItemToShopping,
      addManualShoppingItem,
      adjustHomeStockQuantity,
      archiveHomeStockItem,
      backupReminderNeeded,
      clearMealPlan,
      currentPlan,
      deleteRecipe,
      disableReplenishmentRule,
      dismissReplenishmentSuggestion,
      dismissBackupReminder,
      dismissToast,
      exportData,
      generateWeek,
      goToWeek,
      importData,
      markCooked,
      markHomeStockUsedUp,
      markPlanReady,
      notify,
      planFromStock,
      recordBackup,
      rebuildShopping,
      replenishmentSuggestions,
      reopenPlan,
      resetData,
      resolveShoppingReview,
      restoreHomeStockItem,
      setMeal,
      updateMealServings,
      shoppingItems,
      state,
      storageError,
      swapMeal,
      toasts,
      toggleLock,
      toggleHomeStockUseSoon,
      toggleShoppingItem,
      updatePreferences,
      upsertRecipe,
      upsertHomeStockItem,
      toggleRecipeFavourite,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used inside AppProvider.');
  return context;
}
