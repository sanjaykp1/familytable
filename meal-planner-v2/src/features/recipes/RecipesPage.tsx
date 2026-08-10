import { Clock3, Flame, Heart, Pencil, Plus, Search, Trash2, Users } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useApp } from '../../app/AppProvider';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { Modal } from '../../components/ui/Modal';
import { PageHeader } from '../../components/ui/PageHeader';
import { SegmentedControl } from '../../components/ui/SegmentedControl';
import {
  canMakeAhead,
  COOK_ATTENTION_LABELS,
  isLowAttention,
  MAKE_AHEAD_LABELS,
} from '../../domain/recipeEffort';
import type { Recipe } from '../../domain/types';
import { RecipeForm } from './RecipeForm';

type RecipeFilter = 'all' | 'make-ahead' | 'low-attention';
type RecipeLayout = 'cards' | 'list';

export function RecipesPage() {
  const { state, upsertRecipe, toggleRecipeFavourite, deleteRecipe } = useApp();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<RecipeFilter>('all');
  const [layout, setLayout] = useState<RecipeLayout>('cards');
  const [editing, setEditing] = useState<Recipe | 'new' | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Recipe | null>(null);

  const filtered = useMemo(() => {
    const term = query.trim().toLocaleLowerCase();
    return state.recipes.filter((recipe) => {
      const matchesQuery =
        !term ||
        recipe.name.toLocaleLowerCase().includes(term) ||
        recipe.tags.some((tag) => tag.toLocaleLowerCase().includes(term)) ||
        recipe.ingredients.some((item) => item.name.toLocaleLowerCase().includes(term));
      const matchesFilter =
        filter === 'all' ||
        (filter === 'make-ahead' && canMakeAhead(recipe.makeAhead)) ||
        (filter === 'low-attention' && isLowAttention(recipe.cookAttention));
      return matchesQuery && matchesFilter;
    });
  }, [filter, query, state.recipes]);

  return (
    <div className="page-stack page-stack--compact">
      <PageHeader
        eyebrow="Recipe library"
        title="Meals worth repeating."
        description="Keep the recipes your household actually cooks. Structured quantities make every shopping list more useful."
        persistent
        actions={
          <Button variant="primary" onClick={() => setEditing('new')}>
            <Plus aria-hidden="true" size={18} /> Add recipe
          </Button>
        }
      />

      <div className="library-toolbar library-toolbar--persistent">
        <label className="search-field">
          <Search aria-hidden="true" size={19} />
          <span className="sr-only">Search recipes</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search meals, tags or ingredients"
          />
        </label>
        <div className="library-toolbar__side">
          <div className="filter-pills" aria-label="Filter recipes">
            {(
              [
                ['all', 'All'],
                ['make-ahead', 'Make ahead'],
                ['low-attention', 'Low attention'],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                className={filter === value ? 'is-active' : ''}
                onClick={() => setFilter(value)}
                aria-pressed={filter === value}
              >
                {label}
              </button>
            ))}
          </div>
          <SegmentedControl
            label="Recipe display"
            value={layout}
            onChange={setLayout}
            options={[
              { value: 'cards', label: 'Cards' },
              { value: 'list', label: 'List' },
            ]}
          />
          <span>{filtered.length} recipes</span>
        </div>
      </div>

      {filtered.length ? (
        <section
          className={layout === 'cards' ? 'recipe-grid' : 'recipe-list'}
          aria-label="Recipes"
        >
          {filtered.map((recipe) => (
            <Card
              className={layout === 'cards' ? 'recipe-card' : 'recipe-list__item'}
              key={recipe.id}
            >
              {layout === 'cards' ? (
                <div className="recipe-card__accent" aria-hidden="true">
                  <span>{recipe.seasons[0]?.slice(0, 1).toUpperCase() ?? 'A'}</span>
                </div>
              ) : null}
              <div className={layout === 'cards' ? 'recipe-card__body' : 'recipe-list__body'}>
                <div className="recipe-card__title-row">
                  <div>
                    <h2>{recipe.name}</h2>
                    <p>{recipe.description || 'A dependable family dinner.'}</p>
                  </div>
                </div>
                <div className="recipe-card__meta">
                  <span>
                    <Clock3 aria-hidden="true" size={16} /> Prep {recipe.prepMinutes} min
                  </span>
                  <span>
                    <Flame aria-hidden="true" size={16} /> Cook {recipe.cookMinutes} min
                  </span>
                  <span>
                    <Users aria-hidden="true" size={16} /> {recipe.servings}
                  </span>
                </div>
                {layout === 'cards' ? (
                  <div className="tag-list">
                    <span className="tag-list__feature">
                      {COOK_ATTENTION_LABELS[recipe.cookAttention]}
                    </span>
                    {canMakeAhead(recipe.makeAhead) ? (
                      <span className="tag-list__feature">
                        {MAKE_AHEAD_LABELS[recipe.makeAhead]}
                      </span>
                    ) : null}
                    {recipe.tags.slice(0, 3).map((tag) => (
                      <span key={tag}>{tag}</span>
                    ))}
                  </div>
                ) : null}
              </div>
              <footer
                className={layout === 'cards' ? 'recipe-card__actions' : 'recipe-list__actions'}
              >
                <Button
                  variant="ghost"
                  size="icon"
                  className="recipe-card__favourite"
                  onClick={() => toggleRecipeFavourite(recipe.id)}
                  aria-label={
                    recipe.favourite
                      ? `Remove ${recipe.name} from household favourites`
                      : `Add ${recipe.name} to household favourites`
                  }
                  aria-pressed={recipe.favourite}
                  title={
                    recipe.favourite ? 'Remove household favourite' : 'Add household favourite'
                  }
                >
                  <Heart
                    aria-hidden="true"
                    size={18}
                    fill={recipe.favourite ? 'currentColor' : 'none'}
                  />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setEditing(recipe)}>
                  <Pencil aria-hidden="true" size={16} /> Edit
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setPendingDelete(recipe)}
                  aria-label={`Delete ${recipe.name}`}
                  title="Delete recipe"
                >
                  <Trash2 aria-hidden="true" size={17} />
                </Button>
              </footer>
            </Card>
          ))}
        </section>
      ) : (
        <EmptyState
          icon={Search}
          title="No recipes found"
          description="Try a different word, or add the meal you were looking for."
          action={<Button onClick={() => setEditing('new')}>Add recipe</Button>}
        />
      )}

      {editing ? (
        <Modal
          wide
          title={editing === 'new' ? 'Add a recipe' : 'Edit recipe'}
          description="Keep it practical. You can refine the details the next time you cook it."
          onClose={() => setEditing(null)}
        >
          <RecipeForm
            recipe={editing === 'new' ? undefined : editing}
            onSave={(recipe) => {
              upsertRecipe(recipe);
              setEditing(null);
            }}
            onCancel={() => setEditing(null)}
          />
        </Modal>
      ) : null}

      {pendingDelete ? (
        <Modal title="Delete this recipe?" onClose={() => setPendingDelete(null)}>
          <div className="confirm-copy">
            <p>
              <strong>{pendingDelete.name}</strong> will also be removed from any weeks where it is
              planned.
            </p>
          </div>
          <footer className="modal-actions">
            <Button variant="ghost" onClick={() => setPendingDelete(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                deleteRecipe(pendingDelete.id);
                setPendingDelete(null);
              }}
            >
              Delete recipe
            </Button>
          </footer>
        </Modal>
      ) : null}
    </div>
  );
}
