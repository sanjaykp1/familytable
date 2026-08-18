import { Plus, Trash2 } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { Button } from '../../components/ui/Button';
import { COOK_ATTENTION_LABELS, MAKE_AHEAD_LABELS } from '../../domain/recipeEffort';
import type {
  CookAttention,
  CuisineId,
  Ingredient,
  IngredientCategory,
  MakeAhead,
  Recipe,
  Season,
} from '../../domain/types';
import { CUISINE_IDS, CUISINE_LABELS } from '../../domain/types';

const SEASONS: Season[] = ['winter', 'spring', 'summer', 'autumn'];
const CATEGORIES: { value: IngredientCategory; label: string }[] = [
  { value: 'produce', label: 'Fruit & vegetables' },
  { value: 'protein', label: 'Meat, fish & proteins' },
  { value: 'dairy', label: 'Dairy & eggs' },
  { value: 'bakery', label: 'Bakery' },
  { value: 'pantry', label: 'Pantry' },
  { value: 'frozen', label: 'Frozen' },
  { value: 'other', label: 'Other' },
];

function id(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`;
}

function emptyIngredient(): Ingredient {
  return { id: id('ingredient'), name: '', quantity: null, unit: '', category: 'produce' };
}

export function RecipeForm({
  recipe,
  onSave,
  onCancel,
}: {
  recipe?: Recipe;
  onSave: (recipe: Recipe) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(recipe?.name ?? '');
  const [description, setDescription] = useState(recipe?.description ?? '');
  const [cuisine, setCuisine] = useState<CuisineId | ''>(recipe?.cuisine ?? '');
  const [servings, setServings] = useState(recipe?.servings ?? 4);
  const [prepMinutes, setPrepMinutes] = useState(recipe?.prepMinutes ?? 15);
  const [cookMinutes, setCookMinutes] = useState(recipe?.cookMinutes ?? 30);
  const [cookAttention, setCookAttention] = useState<CookAttention>(
    recipe?.cookAttention ?? 'check-occasionally',
  );
  const [makeAhead, setMakeAhead] = useState<MakeAhead>(recipe?.makeAhead ?? 'none');
  const [seasons, setSeasons] = useState<Season[]>(recipe?.seasons ?? [...SEASONS]);
  const [tags, setTags] = useState(recipe?.tags.join(', ') ?? 'weeknight');
  const [ingredients, setIngredients] = useState<Ingredient[]>(
    recipe?.ingredients.map((item) => ({ ...item })) ?? [emptyIngredient()],
  );
  const [notes, setNotes] = useState(recipe?.notes ?? '');
  const [favourite, setFavourite] = useState(recipe?.favourite ?? false);
  const [error, setError] = useState('');

  const updateIngredient = (ingredientId: string, patch: Partial<Ingredient>) => {
    setIngredients((current) =>
      current.map((item) => (item.id === ingredientId ? { ...item, ...patch } : item)),
    );
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const cleanIngredients = ingredients.filter((item) => item.name.trim());
    if (!name.trim()) {
      setError('Give this recipe a name.');
      return;
    }
    if (!cuisine) {
      setError('Choose a cuisine.');
      return;
    }
    if (!cleanIngredients.length) {
      setError('Add at least one ingredient.');
      return;
    }
    const timestamp = new Date().toISOString();
    onSave({
      id: recipe?.id ?? id('recipe'),
      name: name.trim(),
      description: description.trim(),
      cuisine,
      servings: Math.max(1, servings),
      prepMinutes: Math.max(0, prepMinutes),
      cookMinutes: Math.max(0, cookMinutes),
      cookAttention,
      makeAhead,
      seasons: seasons.length ? seasons : [...SEASONS],
      tags: [
        ...new Set(
          tags
            .split(',')
            .map((tag) => tag.trim())
            .filter(Boolean),
        ),
      ],
      ingredients: cleanIngredients.map((item) => ({ ...item, name: item.name.trim() })),
      notes: notes.trim(),
      favourite,
      lastCookedAt: recipe?.lastCookedAt ?? null,
      timesCooked: recipe?.timesCooked ?? 0,
      createdAt: recipe?.createdAt ?? timestamp,
      updatedAt: timestamp,
    });
  };

  return (
    <form className="recipe-form" onSubmit={submit}>
      <div className="form-grid form-grid--two">
        <label className="field field--wide">
          <span>Recipe name</span>
          <input value={name} onChange={(event) => setName(event.target.value)} autoFocus />
        </label>
        <label className="field field--wide">
          <span>Short description</span>
          <input
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Why this meal earns a place in the week"
          />
        </label>
        <label className="field field--wide">
          <span>Cuisine</span>
          <select
            required
            value={cuisine}
            onChange={(event) => setCuisine(event.target.value as CuisineId | '')}
          >
            <option value="" disabled>
              Choose a cuisine
            </option>
            {CUISINE_IDS.filter(
              (cuisineId) => cuisineId !== 'uncategorised' || recipe?.cuisine === 'uncategorised',
            ).map((cuisineId) => (
              <option key={cuisineId} value={cuisineId}>
                {CUISINE_LABELS[cuisineId]}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Servings</span>
          <input
            type="number"
            min="1"
            value={servings}
            onChange={(event) => setServings(Number(event.target.value))}
          />
        </label>
        <label className="field">
          <span>Prep time</span>
          <div className="input-with-suffix">
            <input
              type="number"
              min="0"
              value={prepMinutes}
              onChange={(event) => setPrepMinutes(Number(event.target.value))}
            />
            <span>min</span>
          </div>
        </label>
        <label className="field">
          <span>Cook time</span>
          <div className="input-with-suffix">
            <input
              type="number"
              min="0"
              value={cookMinutes}
              onChange={(event) => setCookMinutes(Number(event.target.value))}
            />
            <span>min</span>
          </div>
        </label>
        <label className="field">
          <span>Cooking attention</span>
          <select
            value={cookAttention}
            onChange={(event) => setCookAttention(event.target.value as CookAttention)}
          >
            {Object.entries(COOK_ATTENTION_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Make-ahead option</span>
          <select
            value={makeAhead}
            onChange={(event) => setMakeAhead(event.target.value as MakeAhead)}
          >
            {Object.entries(MAKE_AHEAD_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Tags</span>
          <input
            value={tags}
            onChange={(event) => setTags(event.target.value)}
            placeholder="quick, kid-friendly"
          />
        </label>
      </div>

      <fieldset className="choice-field">
        <legend>Best seasons</legend>
        <div className="choice-pills">
          {SEASONS.map((season) => (
            <label key={season}>
              <input
                type="checkbox"
                checked={seasons.includes(season)}
                onChange={() =>
                  setSeasons((current) =>
                    current.includes(season)
                      ? current.filter((item) => item !== season)
                      : [...current, season],
                  )
                }
              />
              <span>{season}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <section className="ingredient-editor">
        <div className="ingredient-editor__header">
          <div>
            <h3>Ingredients</h3>
            <p>Quantities are scaled to the serving count in each weekly plan.</p>
          </div>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => setIngredients((current) => [...current, emptyIngredient()])}
          >
            <Plus aria-hidden="true" size={17} /> Add ingredient
          </Button>
        </div>
        <div className="ingredient-rows">
          {ingredients.map((item, index) => (
            <div className="ingredient-row" key={item.id}>
              <label className="field ingredient-row__name">
                <span className="sr-only">Ingredient {index + 1}</span>
                <input
                  value={item.name}
                  onChange={(event) => updateIngredient(item.id, { name: event.target.value })}
                  placeholder="Ingredient"
                />
              </label>
              <label className="field">
                <span className="sr-only">Quantity</span>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={item.quantity ?? ''}
                  onChange={(event) =>
                    updateIngredient(item.id, {
                      quantity: event.target.value === '' ? null : Number(event.target.value),
                    })
                  }
                  placeholder="Qty"
                />
              </label>
              <label className="field">
                <span className="sr-only">Unit</span>
                <input
                  value={item.unit}
                  onChange={(event) => updateIngredient(item.id, { unit: event.target.value })}
                  placeholder="Unit"
                />
              </label>
              <label className="field">
                <span className="sr-only">Category</span>
                <select
                  value={item.category}
                  onChange={(event) =>
                    updateIngredient(item.id, {
                      category: event.target.value as IngredientCategory,
                    })
                  }
                >
                  {CATEGORIES.map((category) => (
                    <option key={category.value} value={category.value}>
                      {category.label}
                    </option>
                  ))}
                </select>
              </label>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() =>
                  setIngredients((current) =>
                    current.filter((candidate) => candidate.id !== item.id),
                  )
                }
                disabled={ingredients.length === 1}
                aria-label={`Remove ${item.name || `ingredient ${index + 1}`}`}
                title="Remove ingredient"
              >
                <Trash2 aria-hidden="true" size={18} />
              </Button>
            </div>
          ))}
        </div>
      </section>

      <label className="field">
        <span>Notes</span>
        <textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={3} />
      </label>

      <label className="check-field">
        <input
          type="checkbox"
          checked={favourite}
          onChange={(event) => setFavourite(event.target.checked)}
        />
        <span>Mark as a household favourite</span>
      </label>

      {error ? <p className="form-error">{error}</p> : null}

      <footer className="modal-actions">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" variant="primary">
          Save recipe
        </Button>
      </footer>
    </form>
  );
}
