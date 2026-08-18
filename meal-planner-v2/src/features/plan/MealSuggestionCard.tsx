import { Clock3, Flame } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { COOK_ATTENTION_LABELS } from '../../domain/recipeEffort';
import type { Recipe } from '../../domain/types';
import { CUISINE_LABELS } from '../../domain/types';

export function MealSuggestionCard({
  recipe,
  dayLabel,
  selected = false,
  reasons = [],
  onChoose,
}: {
  recipe: Recipe;
  dayLabel: string;
  selected?: boolean;
  reasons?: readonly string[];
  onChoose: () => void;
}) {
  return (
    <Card className="meal-suggestion-card">
      <div className="meal-suggestion-card__copy">
        <div>
          <span className="eyebrow">{CUISINE_LABELS[recipe.cuisine]}</span>
          <h3>{recipe.name}</h3>
          <p>{recipe.description || 'A dependable family dinner.'}</p>
        </div>
        <div className="meal-suggestion-card__meta">
          <span>
            <Clock3 aria-hidden="true" size={15} /> {recipe.prepMinutes} min prep
          </span>
          <span>
            <Flame aria-hidden="true" size={15} /> {recipe.cookMinutes} min cook
          </span>
          <span>{COOK_ATTENTION_LABELS[recipe.cookAttention]}</span>
        </div>
        {reasons.length ? (
          <ul className="meal-suggestion-card__reasons" aria-label="Why this meal">
            {reasons.slice(0, 3).map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        ) : null}
      </div>
      <Button variant={selected ? 'secondary' : 'primary'} onClick={onChoose} disabled={selected}>
        {selected ? 'Chosen' : `Choose for ${dayLabel}`}
      </Button>
    </Card>
  );
}
