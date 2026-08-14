import {
  Check,
  CheckCircle2,
  ChefHat,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Lock,
  Minus,
  Plus,
  RefreshCw,
  RotateCcw,
  ShoppingBasket,
  Sparkles,
  Timer,
  Unlock,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { useApp } from '../../app/AppProvider';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { Modal } from '../../components/ui/Modal';
import { PageHeader } from '../../components/ui/PageHeader';
import {
  addWeeks,
  dayDate,
  formatDayDate,
  formatWeekRange,
  isCurrentWeek,
  startOfWeek,
} from '../../domain/date';
import { canMakeAhead, COOK_ATTENTION_LABELS, MAKE_AHEAD_LABELS } from '../../domain/recipeEffort';
import { MAX_MEAL_SERVINGS, MIN_MEAL_SERVINGS } from '../../domain/planner';
import { evaluateStockOnlyPlan } from '../../domain/stockPlanning';
import type { DayKey, MealSlotKind } from '../../domain/types';
import { DAY_KEYS } from '../../domain/types';
import { WeatherDayInline, WeatherPlanControl } from '../weather/WeatherWeek';
import { useWeatherWeek } from '../weather/useWeatherWeek';

const DAY_LABELS: Record<DayKey, string> = {
  monday: 'Mon',
  tuesday: 'Tue',
  wednesday: 'Wed',
  thursday: 'Thu',
  friday: 'Fri',
  saturday: 'Sat',
  sunday: 'Sun',
};

const SPECIAL_OPTIONS: {
  value: Exclude<MealSlotKind, 'recipe'>;
  label: string;
  description: string;
}[] = [
  {
    value: 'leftovers',
    label: 'Leftovers',
    description: 'Use what is already cooked · no ingredients added',
  },
  {
    value: 'eat-out',
    label: 'Eat out / takeaway',
    description: 'Dinner is covered elsewhere · no ingredients added',
  },
  {
    value: 'skip',
    label: 'Skip dinner',
    description: 'No evening meal planned',
  },
];

export function PlanPage({
  onOpenRecipes,
  onOpenShopping,
  onOpenSettings,
}: {
  onOpenRecipes: () => void;
  onOpenShopping: () => void;
  onOpenSettings: () => void;
}) {
  const {
    state,
    activeWeek,
    currentPlan,
    shoppingItems,
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
  } = useApp();
  const [showStockOnly, setShowStockOnly] = useState(false);
  const [showClearPlan, setShowClearPlan] = useState(false);

  const recipesById = useMemo(
    () => new Map(state.recipes.map((recipe) => [recipe.id, recipe])),
    [state.recipes],
  );
  const stockOnlyPlan = useMemo(
    () => evaluateStockOnlyPlan(currentPlan, state.recipes, state.homeStockItems),
    [currentPlan, state.homeStockItems, state.recipes],
  );
  const stockOnlyRecipes = stockOnlyPlan.recipeEvaluations;
  const eligibleStockOnly = stockOnlyRecipes.filter((evaluation) => evaluation.eligible);
  const ineligibleStockOnly = stockOnlyRecipes.filter((evaluation) => !evaluation.eligible);
  const decidedCount = DAY_KEYS.filter((day) => {
    const slot = currentPlan.slots[day];
    return Boolean(slot.recipeId) || (slot.kind !== undefined && slot.kind !== 'recipe');
  }).length;
  const totalPrepMinutes = DAY_KEYS.reduce((sum, day) => {
    const recipe = recipesById.get(currentPlan.slots[day].recipeId ?? '');
    return sum + (recipe?.prepMinutes ?? 0);
  }, 0);
  const totalElapsedMinutes = DAY_KEYS.reduce((sum, day) => {
    const recipe = recipesById.get(currentPlan.slots[day].recipeId ?? '');
    return sum + (recipe ? recipe.prepMinutes + recipe.cookMinutes : 0);
  }, 0);
  const {
    forecastState,
    forecastByDate,
    retry: retryWeather,
  } = useWeatherWeek(state.preferences.weatherLocation);

  return (
    <div className="page-stack page-stack--plan">
      <PageHeader
        eyebrow={isCurrentWeek(activeWeek) ? 'This week' : 'Planning ahead'}
        title="Dinner, decided."
        description="Build a calm week, keep the meals everyone likes, and turn it into one useful shopping list."
        persistent
        actions={
          <>
            <Button
              variant="secondary"
              onClick={() => setShowStockOnly(true)}
              disabled={!state.recipes.length}
            >
              <ChefHat aria-hidden="true" size={18} />
              Cook from what I have
            </Button>
            <Button variant="primary" onClick={generateWeek} disabled={!state.recipes.length}>
              <Sparkles aria-hidden="true" size={18} />
              Plan my week
            </Button>
            <Button
              variant="danger"
              onClick={() => setShowClearPlan(true)}
              disabled={decidedCount === 0}
            >
              <RotateCcw aria-hidden="true" size={18} />
              Reset
            </Button>
          </>
        }
      />

      <section className="week-toolbar week-toolbar--persistent" aria-label="Choose week">
        <div className="week-switcher">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => goToWeek(addWeeks(activeWeek, -1))}
            aria-label="Previous week"
            title="Previous week"
          >
            <ChevronLeft aria-hidden="true" size={20} />
          </Button>
          <div>
            <strong>{formatWeekRange(activeWeek)}</strong>
            <span>{isCurrentWeek(activeWeek) ? 'Current week' : 'Dinner plan'}</span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => goToWeek(addWeeks(activeWeek, 1))}
            aria-label="Next week"
            title="Next week"
          >
            <ChevronRight aria-hidden="true" size={20} />
          </Button>
        </div>
        <section className="metric-grid metric-grid--inline" aria-label="Week summary">
          <Card className="metric-card">
            <span className="metric-card__icon metric-card__icon--berry">
              <CheckCircle2 aria-hidden="true" size={17} />
            </span>
            <div>
              <strong>{decidedCount}/7</strong>
              <span>Decided</span>
            </div>
          </Card>
          <Card className="metric-card">
            <span className="metric-card__icon metric-card__icon--sage">
              <Timer aria-hidden="true" size={17} />
            </span>
            <div>
              <strong>{totalPrepMinutes ? `${totalPrepMinutes}m` : '—'}</strong>
              <span>Prep</span>
            </div>
          </Card>
          <Card className="metric-card">
            <span className="metric-card__icon metric-card__icon--gold">
              <Clock3 aria-hidden="true" size={17} />
            </span>
            <div>
              <strong>
                {totalElapsedMinutes ? `${Math.round(totalElapsedMinutes / 60)}h` : '—'}
              </strong>
              <span>Total</span>
            </div>
          </Card>
        </section>
        <div className="week-toolbar__weather">
          <WeatherPlanControl
            location={state.preferences.weatherLocation}
            forecastState={forecastState}
            onConfigure={onOpenSettings}
            onRetry={retryWeather}
          />
        </div>
        {!isCurrentWeek(activeWeek) ? (
          <Button variant="ghost" size="sm" onClick={() => goToWeek(startOfWeek())}>
            Back to this week
          </Button>
        ) : null}
      </section>

      <Card
        className={`plan-card ${state.preferences.weatherLocation ? 'plan-card--with-weather' : ''}`}
      >
        {!state.recipes.length ? (
          <EmptyState
            icon={ChefHat}
            title="Start with a family favourite"
            description="Add a recipe to build a week, lock the keepers, and make a shopping list."
            action={
              <Button variant="primary" onClick={onOpenRecipes}>
                <ChefHat aria-hidden="true" size={18} />
                Add a recipe
              </Button>
            }
          />
        ) : (
          <div className="day-list">
            {DAY_KEYS.map((day) => {
              const slot = currentPlan.slots[day];
              const slotKind = slot.kind ?? 'recipe';
              const recipe = recipesById.get(slot.recipeId ?? '');
              const special = SPECIAL_OPTIONS.find((option) => option.value === slotKind);
              const date = dayDate(activeWeek, day);
              return (
                <article
                  className={`day-row ${recipe || special ? 'day-row--filled' : ''} ${slot.cookedAt ? 'day-row--cooked' : ''}`}
                  key={day}
                >
                  <div className="day-row__date">
                    <strong>{DAY_LABELS[day]}</strong>
                    <span>{formatDayDate(date)}</span>
                  </div>

                  {state.preferences.weatherLocation ? (
                    <WeatherDayInline
                      forecast={forecastByDate.get(date)}
                      status={forecastState.status}
                    />
                  ) : null}

                  <div className="day-row__meal">
                    <label className="sr-only" htmlFor={`meal-${day}`}>
                      Dinner for {DAY_LABELS[day]}
                    </label>
                    <select
                      id={`meal-${day}`}
                      className="meal-select"
                      value={special ? `special:${special.value}` : (slot.recipeId ?? '')}
                      onChange={(event) => {
                        const selected = event.target.value;
                        const specialChoice = SPECIAL_OPTIONS.find(
                          (option) => `special:${option.value}` === selected,
                        );
                        if (specialChoice) setMeal(day, null, specialChoice.value);
                        else setMeal(day, selected || null, 'recipe');
                      }}
                      disabled={slot.locked}
                    >
                      <option value="">Choose a dinner</option>
                      <optgroup label="Other plans">
                        {SPECIAL_OPTIONS.map((option) => (
                          <option key={option.value} value={`special:${option.value}`}>
                            {option.label}
                          </option>
                        ))}
                      </optgroup>
                      <optgroup label="Recipes">
                        {state.recipes
                          .slice()
                          .sort((left, right) => left.name.localeCompare(right.name))
                          .map((item) => (
                            <option key={item.id} value={item.id}>
                              {item.name}
                            </option>
                          ))}
                      </optgroup>
                    </select>
                    {recipe ? (
                      <div className="meal-support">
                        <div className="meal-meta">
                          <span>Prep {recipe.prepMinutes} min</span>
                          <span>Cook {recipe.cookMinutes} min</span>
                          <span>{COOK_ATTENTION_LABELS[recipe.cookAttention]}</span>
                          {canMakeAhead(recipe.makeAhead) ? (
                            <span>{MAKE_AHEAD_LABELS[recipe.makeAhead]}</span>
                          ) : null}
                        </div>
                        <div
                          className="serving-control"
                          role="group"
                          aria-label={`Servings for ${DAY_LABELS[day]}`}
                        >
                          <Button
                            variant="ghost"
                            size="icon"
                            className="serving-control__button"
                            onClick={() => updateMealServings(day, slot.servings - 1)}
                            disabled={slot.servings <= MIN_MEAL_SERVINGS}
                            aria-label={`Decrease ${DAY_LABELS[day]} servings`}
                            title="Decrease servings"
                          >
                            <Minus aria-hidden="true" size={16} />
                          </Button>
                          <label>
                            <span className="sr-only">Servings for {DAY_LABELS[day]}</span>
                            <input
                              type="number"
                              min={MIN_MEAL_SERVINGS}
                              max={MAX_MEAL_SERVINGS}
                              step="1"
                              value={slot.servings}
                              onChange={(event) => {
                                const servings = event.currentTarget.valueAsNumber;
                                if (
                                  Number.isInteger(servings) &&
                                  servings >= MIN_MEAL_SERVINGS &&
                                  servings <= MAX_MEAL_SERVINGS
                                ) {
                                  updateMealServings(day, servings);
                                }
                              }}
                            />
                          </label>
                          <span className="serving-control__label">
                            {slot.servings === 1 ? 'serving' : 'servings'}
                          </span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="serving-control__button"
                            onClick={() => updateMealServings(day, slot.servings + 1)}
                            disabled={slot.servings >= MAX_MEAL_SERVINGS}
                            aria-label={`Increase ${DAY_LABELS[day]} servings`}
                            title="Increase servings"
                          >
                            <Plus aria-hidden="true" size={16} />
                          </Button>
                        </div>
                      </div>
                    ) : special ? (
                      <span className="meal-special">{special.description}</span>
                    ) : (
                      <span className="meal-placeholder">
                        Leave open or choose from your recipes
                      </span>
                    )}
                  </div>

                  <div className="day-row__actions">
                    {recipe ? (
                      <>
                        <Button
                          variant={slot.locked ? 'primary' : 'ghost'}
                          size="icon"
                          onClick={() => toggleLock(day)}
                          aria-label={
                            slot.locked ? `Unlock ${DAY_LABELS[day]}` : `Lock ${DAY_LABELS[day]}`
                          }
                          title={slot.locked ? 'Unlock meal' : 'Keep when regenerating'}
                        >
                          {slot.locked ? (
                            <Lock aria-hidden="true" size={18} />
                          ) : (
                            <Unlock aria-hidden="true" size={18} />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => swapMeal(day)}
                          disabled={slot.locked}
                          aria-label={`Replace ${DAY_LABELS[day]} dinner`}
                          title="Try another meal"
                        >
                          <RefreshCw aria-hidden="true" size={18} />
                        </Button>
                        <Button
                          variant={slot.cookedAt ? 'secondary' : 'ghost'}
                          className="cooked-action"
                          onClick={() => markCooked(day)}
                          aria-label={`Mark ${DAY_LABELS[day]} dinner cooked`}
                          title={slot.cookedAt ? 'Mark as not cooked' : 'Mark cooked'}
                        >
                          {slot.cookedAt ? (
                            <CheckCircle2 aria-hidden="true" size={18} />
                          ) : (
                            <Check aria-hidden="true" size={19} />
                          )}
                          <span>{slot.cookedAt ? 'Cooked' : 'Mark cooked'}</span>
                        </Button>
                      </>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {state.recipes.length ? (
          <footer className="plan-card__footer">
            <div className="plan-progress">
              <div
                role="progressbar"
                aria-label="Week plan progress"
                aria-valuemin={0}
                aria-valuemax={7}
                aria-valuenow={decidedCount}
              >
                <span style={{ transform: `scaleX(${decidedCount / 7})` }} />
              </div>
              <small>
                {decidedCount === 7
                  ? 'A full week, ready when you are.'
                  : `${7 - decidedCount} open night${7 - decidedCount === 1 ? '' : 's'}.`}
              </small>
            </div>
            <div className="plan-card__footer-actions">
              {currentPlan.status === 'ready' ? (
                <>
                  <Button variant="ghost" onClick={reopenPlan}>
                    Reopen plan
                  </Button>
                  <Button variant="primary" onClick={onOpenShopping}>
                    <ShoppingBasket aria-hidden="true" size={18} />
                    Open list ({shoppingItems.length})
                  </Button>
                </>
              ) : (
                <Button variant="primary" onClick={markPlanReady} disabled={decidedCount === 0}>
                  <ShoppingBasket aria-hidden="true" size={18} />
                  Ready to shop
                </Button>
              )}
            </div>
          </footer>
        ) : null}
      </Card>

      {showStockOnly ? (
        <Modal
          wide
          title="Cook from what I have"
          description="Strict matches from saved recipes only. Locked meals are reserved in this draft; Home Stock is never deducted."
          onClose={() => setShowStockOnly(false)}
        >
          <div className="stock-only-results">
            {stockOnlyPlan.lockedReservationFailures.length ? (
              <section
                className="stock-only-results__section"
                aria-label="Locked meal stock review"
              >
                <div>
                  <span className="eyebrow">Locked meals need review</span>
                  <h3>Confirmed stock does not fully cover every locked dinner</h3>
                </div>
                <ul>
                  {stockOnlyPlan.lockedReservationFailures.map((failure) => (
                    <li key={`${failure.day}-${failure.ingredientId}`}>{failure.message}</li>
                  ))}
                </ul>
              </section>
            ) : null}
            {eligibleStockOnly.length ? (
              <section className="stock-only-results__section" aria-label="Stock-only suggestions">
                <div className="stock-only-results__heading">
                  <div>
                    <span className="eyebrow">Ready from Home Stock</span>
                    <h3>
                      {eligibleStockOnly.length} qualifying saved recipe
                      {eligibleStockOnly.length === 1 ? '' : 's'}
                    </h3>
                  </div>
                </div>
                <div className="stock-only-results__list">
                  {eligibleStockOnly.slice(0, 6).map((evaluation) => (
                    <Card className="stock-only-suggestion" key={evaluation.recipe.id}>
                      <div>
                        <h3>{evaluation.recipe.name}</h3>
                        <p>{evaluation.reason}</p>
                      </div>
                      <ul>
                        {evaluation.allocations.map((allocation) => (
                          <li key={`${allocation.ingredientId}-${allocation.stockItemId}`}>
                            <Check aria-hidden="true" size={15} />
                            <span>
                              {allocation.ingredientName}: {allocation.allocatedQuantity}
                              {allocation.unit ? ` ${allocation.unit}` : ''} from{' '}
                              {allocation.stockItemName}
                              {allocation.useSoon ? ' · use soon' : ''}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </Card>
                  ))}
                </div>
              </section>
            ) : (
              <EmptyState
                icon={ChefHat}
                title="No recipe is fully covered"
                description="The saved recipes below show exactly what prevents a strict Home Stock match."
              />
            )}

            {ineligibleStockOnly.length ? (
              <details className="stock-only-blocked" open={!eligibleStockOnly.length}>
                <summary>
                  {ineligibleStockOnly.length} saved recipe
                  {ineligibleStockOnly.length === 1 ? '' : 's'} not fully covered
                </summary>
                <div className="stock-only-blocked__list">
                  {ineligibleStockOnly.slice(0, 8).map((evaluation) => (
                    <div key={evaluation.recipe.id}>
                      <strong>{evaluation.recipe.name}</strong>
                      <ul>
                        {evaluation.failures.map((failure) => (
                          <li key={failure.ingredientId}>{failure.message}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </details>
            ) : null}
          </div>
          <footer className="modal-actions">
            <Button variant="ghost" onClick={() => setShowStockOnly(false)}>
              Close
            </Button>
            <Button
              variant="primary"
              disabled={!eligibleStockOnly.length}
              onClick={() => {
                const result = planFromStock();
                if (result.ok) setShowStockOnly(false);
              }}
            >
              Plan qualifying dinners
            </Button>
          </footer>
        </Modal>
      ) : null}

      {showClearPlan ? (
        <Modal title="Clear this meal plan?" onClose={() => setShowClearPlan(false)}>
          <div className="confirm-copy">
            <p>
              This removes every dinner from {formatWeekRange(activeWeek)} and clears its shopping
              list. Your saved recipes and Home Stock will stay unchanged.
            </p>
          </div>
          <footer className="modal-actions">
            <Button variant="ghost" onClick={() => setShowClearPlan(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                clearMealPlan();
                setShowClearPlan(false);
              }}
            >
              Clear meal plan
            </Button>
          </footer>
        </Modal>
      ) : null}
    </div>
  );
}
