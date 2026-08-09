import {
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Lock,
  Minus,
  Plus,
  RefreshCw,
  ShoppingBasket,
  Sparkles,
  Timer,
  Unlock,
} from 'lucide-react';
import { useMemo } from 'react';
import { useApp } from '../../app/AppProvider';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
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
  onOpenShopping,
  onOpenSettings,
}: {
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
    swapMeal,
    markCooked,
    markPlanReady,
    reopenPlan,
  } = useApp();

  const recipesById = useMemo(
    () => new Map(state.recipes.map((recipe) => [recipe.id, recipe])),
    [state.recipes],
  );
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
    <div className="page-stack">
      <PageHeader
        eyebrow={isCurrentWeek(activeWeek) ? 'This week' : 'Planning ahead'}
        title="Dinner, decided."
        description="Build a calm week, keep the meals everyone likes, and turn it into one useful shopping list."
        persistent
        actions={
          <Button variant="primary" onClick={generateWeek}>
            <Sparkles aria-hidden="true" size={18} />
            Plan my week
          </Button>
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
        {!isCurrentWeek(activeWeek) ? (
          <Button variant="ghost" size="sm" onClick={() => goToWeek(startOfWeek())}>
            Back to this week
          </Button>
        ) : null}
      </section>

      <Card
        className={`plan-card ${state.preferences.weatherLocation ? 'plan-card--with-weather' : ''}`}
      >
        <div className="plan-card__header">
          <div>
            <h2>Evening plan</h2>
            <p>Lock recipes you want to keep. Other plans stay put automatically.</p>
          </div>
          <div className="plan-card__header-tools">
            <WeatherPlanControl
              location={state.preferences.weatherLocation}
              forecastState={forecastState}
              onConfigure={onOpenSettings}
              onRetry={retryWeather}
            />
            <span className={`status-chip status-chip--${currentPlan.status}`}>
              {currentPlan.status === 'ready' ? 'Ready to shop' : 'Draft'}
            </span>
          </div>
        </div>

        <div className="day-list">
          {DAY_KEYS.map((day) => {
            const slot = currentPlan.slots[day];
            const slotKind = slot.kind ?? 'recipe';
            const recipe = recipesById.get(slot.recipeId ?? '');
            const special = SPECIAL_OPTIONS.find((option) => option.value === slotKind);
            const date = dayDate(activeWeek, day);
            return (
              <article
                className={`day-row ${recipe || special ? 'day-row--filled' : ''}`}
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
                    <span className="meal-placeholder">Leave open or choose from your recipes</span>
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
                        variant="ghost"
                        size="icon"
                        onClick={() => markCooked(day)}
                        aria-label={`Mark ${DAY_LABELS[day]} dinner cooked`}
                        title="Mark cooked"
                      >
                        <Check aria-hidden="true" size={19} />
                      </Button>
                    </>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>

        <footer className="plan-card__footer">
          <div className="plan-progress">
            <div>
              <span style={{ width: `${(decidedCount / 7) * 100}%` }} />
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
      </Card>
    </div>
  );
}
