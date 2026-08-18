import { ChefHat, RefreshCw, Search, Sparkles, UtensilsCrossed } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Button } from '../../components/ui/Button';
import { CuisineChips, type CuisineChipValue } from '../../components/ui/CuisineChips';
import { EmptyState } from '../../components/ui/EmptyState';
import { Modal } from '../../components/ui/Modal';
import type { MealSuggestionResult } from '../../domain/mealInspiration';
import type {
  CuisineIntentId,
  MealSlotKind,
  MealSuggestionReasonCode,
  Recipe,
} from '../../domain/types';
import { CUISINE_INTENT_IDS, CUISINE_LABELS } from '../../domain/types';
import { DINNER_PLAN_OPTIONS } from './dinnerPlans';
import { MealSuggestionCard } from './MealSuggestionCard';

type PickerView = 'choose' | 'cuisine' | 'inspire';

const REASON_LABELS: Record<MealSuggestionReasonCode, string> = {
  favourite: 'Favourite',
  'good-for-weeknight': 'Good for a weeknight',
  'good-for-weekend': 'Good for the weekend',
  'in-season': 'In season',
  'use-soon': 'Use soon',
  'not-cooked-recently': 'Not cooked recently',
  'only-cuisine-match': 'Only saved cuisine match',
  'recently-cooked-only-match': 'Recently cooked · only match',
  'already-planned-manual-option': 'Already planned · choose again manually',
};

export function MealPicker({
  dayLabel,
  recipes,
  selectedRecipeId,
  cuisineIntent,
  inspiration,
  onChooseRecipe,
  onSetCuisineIntent,
  onChooseSpecial,
  onClear,
  onAddRecipe,
  onClose,
}: {
  dayLabel: string;
  recipes: Recipe[];
  selectedRecipeId: string | null;
  cuisineIntent?: CuisineIntentId;
  inspiration: MealSuggestionResult;
  onChooseRecipe: (recipeId: string) => void;
  onSetCuisineIntent: (cuisine: CuisineIntentId | null) => void;
  onChooseSpecial: (kind: Exclude<MealSlotKind, 'recipe'>) => void;
  onClear: () => void;
  onAddRecipe: () => void;
  onClose: () => void;
}) {
  const [view, setView] = useState<PickerView>(cuisineIntent ? 'cuisine' : 'choose');
  const [query, setQuery] = useState('');
  const selectedRecipe = recipes.find((recipe) => recipe.id === selectedRecipeId);
  const selectedRecipeCuisine =
    selectedRecipe?.cuisine === 'uncategorised' ? undefined : selectedRecipe?.cuisine;
  const [selectedCuisine, setSelectedCuisine] = useState<CuisineChipValue>(
    cuisineIntent ?? selectedRecipeCuisine ?? 'all',
  );
  const [inspirationIndex, setInspirationIndex] = useState(0);

  const filteredRecipes = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    return recipes
      .filter((recipe) => {
        if (view === 'cuisine' && selectedCuisine !== 'all') {
          return recipe.cuisine === selectedCuisine;
        }
        if (!normalizedQuery) return true;
        return [
          recipe.name,
          recipe.description,
          CUISINE_LABELS[recipe.cuisine],
          ...recipe.tags,
          ...recipe.ingredients.map((ingredient) => ingredient.name),
        ].some((value) => value.toLocaleLowerCase().includes(normalizedQuery));
      })
      .sort((left, right) => left.name.localeCompare(right.name));
  }, [query, recipes, selectedCuisine, view]);

  const recipesById = useMemo(
    () => new Map(recipes.map((recipe) => [recipe.id, recipe])),
    [recipes],
  );
  const reasonLabelsByRecipe = useMemo(
    () =>
      new Map(
        [...inspiration.suggestions, ...inspiration.manualOverrides].map((suggestion) => [
          suggestion.recipeId,
          suggestion.reasonCodes.map((code) => REASON_LABELS[code]),
        ]),
      ),
    [inspiration],
  );
  const cuisineRecipes = useMemo(() => {
    if (selectedCuisine === 'all') return [];
    if (cuisineIntent !== selectedCuisine) return filteredRecipes;
    return [...inspiration.suggestions, ...inspiration.manualOverrides]
      .map((suggestion) => recipesById.get(suggestion.recipeId))
      .filter((recipe): recipe is Recipe => Boolean(recipe));
  }, [cuisineIntent, filteredRecipes, inspiration, recipesById, selectedCuisine]);
  const inspiredSuggestions = inspiration.suggestions.filter(
    (suggestion) => suggestion.recipeId !== selectedRecipeId,
  );
  const inspiredSuggestion = inspiredSuggestions.length
    ? inspiredSuggestions[inspirationIndex % inspiredSuggestions.length]
    : inspiration.suggestions[0];
  const inspiredRecipe = inspiredSuggestion
    ? recipesById.get(inspiredSuggestion.recipeId)
    : undefined;

  const chooseRecipe = (recipeId: string) => {
    onChooseRecipe(recipeId);
    onClose();
  };

  return (
    <Modal
      wide
      title={`Dinner for ${dayLabel}`}
      description="Choose a saved meal, leave a cuisine preference, or record another dinner plan."
      onClose={onClose}
    >
      <div className="meal-picker">
        <div className="meal-picker__paths" role="group" aria-label="How would you like to plan?">
          <button
            type="button"
            className={view === 'choose' ? 'is-active' : ''}
            aria-pressed={view === 'choose'}
            onClick={() => setView('choose')}
          >
            <ChefHat aria-hidden="true" size={19} />
            <span>
              <strong>Choose a meal</strong>
              <small>Search all saved recipes</small>
            </span>
          </button>
          <button
            type="button"
            className={view === 'cuisine' ? 'is-active' : ''}
            aria-pressed={view === 'cuisine'}
            onClick={() => setView('cuisine')}
          >
            <UtensilsCrossed aria-hidden="true" size={19} />
            <span>
              <strong>I feel like…</strong>
              <small>Start with a cuisine</small>
            </span>
          </button>
          <button
            type="button"
            className={view === 'inspire' ? 'is-active' : ''}
            aria-pressed={view === 'inspire'}
            onClick={() => setView('inspire')}
          >
            <Sparkles aria-hidden="true" size={19} />
            <span>
              <strong>Inspire me</strong>
              <small>See an explainable idea</small>
            </span>
          </button>
        </div>

        {view === 'choose' ? (
          <label className="search-field meal-picker__search">
            <Search aria-hidden="true" size={19} />
            <span className="sr-only">Search saved meals</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search meals, cuisines or ingredients"
            />
          </label>
        ) : view === 'cuisine' ? (
          <section className="meal-picker__cuisine" aria-labelledby="meal-picker-cuisine-heading">
            <div>
              <h3 id="meal-picker-cuisine-heading">What sounds good?</h3>
              <p>Your choice can stay on the day even if you do not pick a recipe yet.</p>
            </div>
            <CuisineChips
              value={selectedCuisine}
              cuisines={CUISINE_INTENT_IDS}
              allLabel="Any cuisine"
              label="Choose a cuisine preference"
              onChange={(value) => {
                setSelectedCuisine(value);
                if (!selectedRecipeId) {
                  onSetCuisineIntent(value === 'all' || value === 'uncategorised' ? null : value);
                }
              }}
            />
            {selectedRecipe && selectedCuisine !== 'all' && selectedCuisine !== 'uncategorised' ? (
              <div className="meal-picker__intent-action">
                <p>
                  Browsing does not change {selectedRecipe.name}. Replacing it with a cuisine
                  preference will leave {dayLabel} unresolved until another meal is chosen.
                </p>
                <Button
                  variant="secondary"
                  onClick={() => {
                    onSetCuisineIntent(selectedCuisine);
                    onClose();
                  }}
                >
                  Replace with {CUISINE_LABELS[selectedCuisine]} preference
                </Button>
              </div>
            ) : null}
          </section>
        ) : null}

        {view === 'inspire' ? (
          inspiredRecipe && inspiredSuggestion ? (
            <section className="meal-picker__inspiration" aria-label="Inspired meal suggestion">
              <MealSuggestionCard
                recipe={inspiredRecipe}
                dayLabel={dayLabel}
                selected={inspiredRecipe.id === selectedRecipeId}
                reasons={inspiredSuggestion.reasonCodes.map((code) => REASON_LABELS[code])}
                onChoose={() => chooseRecipe(inspiredRecipe.id)}
              />
              {inspiredSuggestions.length > 1 ? (
                <Button
                  variant="secondary"
                  onClick={() => setInspirationIndex((current) => current + 1)}
                >
                  <RefreshCw aria-hidden="true" size={17} /> Show me another
                </Button>
              ) : null}
            </section>
          ) : (
            <EmptyState
              icon={Sparkles}
              title="No automatic suggestion fits"
              description={
                inspiration.unavailableReason === 'no-cuisine-match'
                  ? 'No saved recipe matches this cuisine yet. The preference will stay visible.'
                  : 'Add another saved recipe or choose an already planned meal manually.'
              }
              action={<Button onClick={onAddRecipe}>Add recipe</Button>}
            />
          )
        ) : view === 'cuisine' && selectedCuisine === 'all' ? (
          <EmptyState
            icon={UtensilsCrossed}
            title="Choose a cuisine"
            description="We will show the saved meals that match, or keep the preference visible if none do."
          />
        ) : (view === 'cuisine' ? cuisineRecipes : filteredRecipes).length ? (
          <div className="meal-picker__results" role="list" aria-label="Saved meal choices">
            {(view === 'cuisine' ? cuisineRecipes : filteredRecipes).map((recipe) => (
              <div key={recipe.id} role="listitem">
                <MealSuggestionCard
                  recipe={recipe}
                  dayLabel={dayLabel}
                  selected={recipe.id === selectedRecipeId}
                  reasons={reasonLabelsByRecipe.get(recipe.id)}
                  onChoose={() => chooseRecipe(recipe.id)}
                />
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={Search}
            title={
              view === 'cuisine' && selectedCuisine !== 'all'
                ? `No saved ${CUISINE_LABELS[selectedCuisine]} meals`
                : 'No saved meals found'
            }
            description={
              view === 'cuisine'
                ? 'The preference will stay visible on this day. Add a matching recipe whenever you are ready.'
                : 'Try another search or add the meal you had in mind.'
            }
            action={<Button onClick={onAddRecipe}>Add recipe</Button>}
          />
        )}

        <section className="meal-picker__other" aria-labelledby="other-dinner-plans">
          <div>
            <h3 id="other-dinner-plans">Other dinner plans</h3>
            <p>These choices never add ingredients to the shopping list.</p>
          </div>
          <div className="meal-picker__other-options">
            {DINNER_PLAN_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  onChooseSpecial(option.value);
                  onClose();
                }}
              >
                <strong>{option.label}</strong>
                <span>{option.description}</span>
              </button>
            ))}
          </div>
        </section>
      </div>
      <footer className="modal-actions">
        <Button
          variant="ghost"
          onClick={() => {
            onClear();
            onClose();
          }}
        >
          Clear day
        </Button>
        <Button variant="secondary" onClick={onClose}>
          Done
        </Button>
      </footer>
    </Modal>
  );
}
