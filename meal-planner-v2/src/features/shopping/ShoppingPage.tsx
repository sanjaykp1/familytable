import {
  Check,
  Clipboard,
  Minus,
  PackagePlus,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  ShoppingBasket,
  Snowflake,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { useMemo, useState, type CSSProperties, type FormEvent } from 'react';
import { useApp } from '../../app/AppProvider';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { Modal } from '../../components/ui/Modal';
import { PageHeader } from '../../components/ui/PageHeader';
import { SegmentedControl } from '../../components/ui/SegmentedControl';
import { formatWeekRange } from '../../domain/date';
import { formatQuantity } from '../../domain/shopping';
import {
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  type HomeStockItem,
  type HomeStockKind,
  type IngredientCategory,
  type ShoppingItem,
} from '../../domain/types';

type ShopView = 'to-buy' | 'at-home';

const CATEGORY_OPTIONS = CATEGORY_ORDER.map((value) => ({
  value,
  label: CATEGORY_LABELS[value],
}));
const FOOD_CATEGORY_OPTIONS = CATEGORY_OPTIONS.filter((option) => option.value !== 'frozen');

function itemId(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`;
}

function numberFrom(value: string): number | null {
  if (value.trim() === '') return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

function stockQuantity(item: HomeStockItem) {
  return item.quantity === null
    ? 'Quantity not tracked'
    : `${item.quantity}${item.unit ? ` ${item.unit}` : ''}`;
}

function reconciliation(item: ShoppingItem) {
  if (item.sources.includes('stock-top-up') && item.sources.includes('recipe')) {
    const recipeShortfall =
      item.grossRecipeNeed === null
        ? null
        : Math.max(0, item.grossRecipeNeed - item.confirmedStockApplied);
    const quantity = (value: number | null) =>
      value === null ? 'unknown' : `${value}${item.unit ? ` ${item.unit}` : ''}`;
    return `Recipe shortfall ${quantity(recipeShortfall)} · Top-up shortfall ${quantity(item.stockTopUpQuantity ?? null)} · Buy ${formatQuantity(item)} (larger requirement)`;
  }
  if (item.sources.includes('stock-top-up')) {
    return `Accepted top-up suggestion · Buy ${formatQuantity(item)}`;
  }
  if (item.grossRecipeNeed === null) return 'Added manually — not attached to a recipe.';
  if (item.requiresReview) {
    return `Recipe need ${item.grossRecipeNeed}${item.unit ? ` ${item.unit}` : ''} − stock needs review = buy ${formatQuantity(item)}`;
  }
  return `Recipe need ${item.grossRecipeNeed}${item.unit ? ` ${item.unit}` : ''} − at home ${item.confirmedStockApplied}${item.unit ? ` ${item.unit}` : ''} = buy ${formatQuantity(item)}`;
}

function HomeStockForm({
  item,
  onSave,
  onCancel,
}: {
  item?: HomeStockItem;
  onSave: (item: HomeStockItem) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(item?.name ?? '');
  const [kind, setKind] = useState<HomeStockKind>(item?.kind ?? 'food');
  const [category, setCategory] = useState<IngredientCategory>(
    item?.kind === 'food' &&
      item.category !== 'frozen' &&
      CATEGORY_ORDER.includes(item.category as IngredientCategory)
      ? (item.category as IngredientCategory)
      : 'pantry',
  );
  const [location, setLocation] = useState(item?.location ?? 'Cupboard');
  const [frozen, setFrozen] = useState(item?.kind === 'food' && item.frozen);
  const [quantity, setQuantity] = useState(item?.quantity?.toString() ?? '');
  const [unit, setUnit] = useState(item?.unit ?? '');
  const [replenishmentEnabled, setReplenishmentEnabled] = useState(
    item?.reorderPoint !== undefined &&
      item.reorderPoint !== null &&
      item?.targetQuantity !== undefined &&
      item.targetQuantity !== null &&
      item.replenishmentRuleEnabled !== false,
  );
  const [reorderPoint, setReorderPoint] = useState(item?.reorderPoint?.toString() ?? '');
  const [targetQuantity, setTargetQuantity] = useState(item?.targetQuantity?.toString() ?? '');
  const [error, setError] = useState('');

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim()) {
      setError('Give this item a name.');
      return;
    }
    if (!location.trim()) {
      setError('Choose where you keep it.');
      return;
    }
    const parsedQuantity = numberFrom(quantity);
    if (quantity.trim() && parsedQuantity === null) {
      setError('Quantity must be zero or more.');
      return;
    }
    const parsedReorderPoint = numberFrom(reorderPoint);
    const parsedTargetQuantity = numberFrom(targetQuantity);
    if (replenishmentEnabled && (parsedReorderPoint === null || parsedTargetQuantity === null)) {
      setError('Add both a reorder point and target quantity.');
      return;
    }
    if (
      replenishmentEnabled &&
      parsedReorderPoint !== null &&
      parsedTargetQuantity !== null &&
      parsedTargetQuantity <= parsedReorderPoint
    ) {
      setError('Target quantity must be greater than the reorder point.');
      return;
    }
    onSave({
      ...(item ?? {
        id: itemId('stock'),
        planningPriority: 'normal' as const,
        archived: false,
      }),
      name: name.trim(),
      kind,
      category: kind === 'household' ? 'Household' : category,
      location: location.trim(),
      frozen: kind === 'food' && frozen,
      quantity: parsedQuantity,
      unit: unit.trim(),
      ...(replenishmentEnabled
        ? {
            reorderPoint: parsedReorderPoint,
            targetQuantity: parsedTargetQuantity,
            replenishmentRuleEnabled: true,
          }
        : {
            reorderPoint: item?.reorderPoint,
            targetQuantity: item?.targetQuantity,
            replenishmentRuleEnabled: false,
          }),
      updatedAt: new Date().toISOString(),
    });
  };

  return (
    <form className="recipe-form" onSubmit={submit}>
      <div className="form-grid form-grid--two">
        <label className="field field--wide">
          <span>Item name</span>
          <input autoFocus value={name} onChange={(event) => setName(event.target.value)} />
        </label>
        <label className="field">
          <span>Type</span>
          <select
            value={kind}
            onChange={(event) => {
              const nextKind = event.target.value as HomeStockKind;
              setKind(nextKind);
              if (nextKind === 'household') setFrozen(false);
            }}
          >
            <option value="food">Food</option>
            <option value="household">Household</option>
          </select>
        </label>
        <label className="field">
          <span>Category</span>
          <select
            value={category}
            disabled={kind === 'household'}
            onChange={(event) => setCategory(event.target.value as IngredientCategory)}
          >
            {FOOD_CATEGORY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Location</span>
          <input value={location} onChange={(event) => setLocation(event.target.value)} />
        </label>
        <label className="field">
          <span>Quantity</span>
          <input
            type="number"
            min="0"
            step="any"
            value={quantity}
            onChange={(event) => setQuantity(event.target.value)}
            placeholder="Optional"
          />
        </label>
        <label className="field">
          <span>Unit</span>
          <input
            value={unit}
            onChange={(event) => setUnit(event.target.value)}
            placeholder="rolls, g"
          />
        </label>
        {kind === 'food' ? (
          <label className="field field--wide home-stock-form__frozen">
            <input
              type="checkbox"
              checked={frozen}
              onChange={(event) => setFrozen(event.target.checked)}
            />
            <span>
              <Snowflake aria-hidden="true" size={16} /> Frozen
            </span>
          </label>
        ) : null}
        <label className="field field--wide home-stock-form__frozen">
          <input
            type="checkbox"
            checked={replenishmentEnabled}
            onChange={(event) => setReplenishmentEnabled(event.target.checked)}
          />
          <span>Suggest a top-up when stock runs low</span>
        </label>
        {replenishmentEnabled ? (
          <>
            <label className="field">
              <span>Reorder point</span>
              <input
                type="number"
                min="0"
                step="any"
                value={reorderPoint}
                onChange={(event) => setReorderPoint(event.target.value)}
              />
            </label>
            <label className="field">
              <span>Target quantity</span>
              <input
                type="number"
                min="0"
                step="any"
                value={targetQuantity}
                onChange={(event) => setTargetQuantity(event.target.value)}
              />
            </label>
          </>
        ) : null}
      </div>
      {error ? <p className="form-error">{error}</p> : null}
      <footer className="modal-actions">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" variant="primary">
          {item ? 'Save changes' : 'Save to Home Stock'}
        </Button>
      </footer>
    </form>
  );
}

function ManualShoppingForm({
  onSave,
  onCancel,
}: {
  onSave: (item: Pick<ShoppingItem, 'name' | 'remainingBuyQuantity' | 'unit' | 'category'>) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [unit, setUnit] = useState('');
  const [category, setCategory] = useState<IngredientCategory>('other');
  const [error, setError] = useState('');

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim()) {
      setError('Give this shopping item a name.');
      return;
    }
    const parsedQuantity = numberFrom(quantity);
    if (parsedQuantity === null) {
      setError('Quantity must be zero or more.');
      return;
    }
    onSave({
      name: name.trim(),
      remainingBuyQuantity: parsedQuantity,
      unit: unit.trim(),
      category,
    });
  };

  return (
    <form className="recipe-form" onSubmit={submit}>
      <div className="form-grid form-grid--two">
        <label className="field field--wide">
          <span>Shopping item</span>
          <input autoFocus value={name} onChange={(event) => setName(event.target.value)} />
        </label>
        <label className="field">
          <span>Quantity</span>
          <input
            type="number"
            min="0"
            step="any"
            value={quantity}
            onChange={(event) => setQuantity(event.target.value)}
          />
        </label>
        <label className="field">
          <span>Unit</span>
          <input
            value={unit}
            onChange={(event) => setUnit(event.target.value)}
            placeholder="packs"
          />
        </label>
        <label className="field field--wide">
          <span>Shop area</span>
          <select
            value={category}
            onChange={(event) => setCategory(event.target.value as IngredientCategory)}
          >
            {CATEGORY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      {error ? <p className="form-error">{error}</p> : null}
      <footer className="modal-actions">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" variant="primary">
          Add to shop
        </Button>
      </footer>
    </form>
  );
}

export function ShoppingPage({ onOpenPlan }: { onOpenPlan: () => void }) {
  const {
    activeWeek,
    currentPlan,
    shoppingItems,
    replenishmentSuggestions,
    state,
    rebuildShopping,
    toggleShoppingItem,
    upsertHomeStockItem,
    adjustHomeStockQuantity,
    markHomeStockUsedUp,
    toggleHomeStockUseSoon,
    planFromStock,
    archiveHomeStockItem,
    restoreHomeStockItem,
    addHomeStockItemToShopping,
    acceptReplenishmentSuggestion,
    dismissReplenishmentSuggestion,
    disableReplenishmentRule,
    addManualShoppingItem,
    resolveShoppingReview,
    notify,
  } = useApp();
  const [view, setView] = useState<ShopView>('to-buy');
  const [stockSearch, setStockSearch] = useState('');
  const [stockKind, setStockKind] = useState<'all' | HomeStockKind>('all');
  const [stockFrozenOnly, setStockFrozenOnly] = useState(false);
  const [stockLocation, setStockLocation] = useState('all');
  const [showStockForm, setShowStockForm] = useState(false);
  const [editingStockItem, setEditingStockItem] = useState<HomeStockItem | null>(null);
  const [showManualForm, setShowManualForm] = useState(false);
  const [archiveTarget, setArchiveTarget] = useState<HomeStockItem | null>(null);
  const [nextPlanStockIds, setNextPlanStockIds] = useState<string[]>([]);
  const [nextPlanFailures, setNextPlanFailures] = useState<string[]>([]);

  const plannedRecipes = Object.values(currentPlan.slots).filter((slot) => slot.recipeId).length;
  const checked = shoppingItems.filter((item) => item.checked).length;
  const progress = shoppingItems.length ? Math.round((checked / shoppingItems.length) * 100) : 0;
  const groups = useMemo(() => {
    const grouped = new Map<IngredientCategory, ShoppingItem[]>();
    for (const category of CATEGORY_ORDER) {
      const items = shoppingItems.filter((item) => item.category === category);
      if (items.length) grouped.set(category, items);
    }
    return grouped;
  }, [shoppingItems]);
  const locations = useMemo(
    () =>
      [
        ...new Set(
          state.homeStockItems.filter((item) => !item.archived).map((item) => item.location),
        ),
      ].sort(),
    [state.homeStockItems],
  );
  const visibleStock = useMemo(() => {
    const query = stockSearch.trim().toLocaleLowerCase();
    return state.homeStockItems.filter(
      (item) =>
        !item.archived &&
        (stockKind === 'all' || item.kind === stockKind) &&
        (!stockFrozenOnly || (item.kind === 'food' && item.frozen)) &&
        (stockLocation === 'all' || item.location === stockLocation) &&
        (!query ||
          `${item.name} ${item.category} ${item.location}`.toLocaleLowerCase().includes(query)),
    );
  }, [state.homeStockItems, stockFrozenOnly, stockKind, stockLocation, stockSearch]);
  const archivedStock = state.homeStockItems.filter((item) => item.archived);

  const copyList = async () => {
    const lines = [...groups.entries()].flatMap(([category, items]) => [
      CATEGORY_LABELS[category].toUpperCase(),
      ...items
        .filter((item) => !item.checked)
        .map((item) => `• ${item.name} ${formatQuantity(item)}`.trim()),
      '',
    ]);
    try {
      await navigator.clipboard.writeText(lines.join('\n').trim());
      notify('Shopping list copied.', 'success');
    } catch {
      notify('This browser could not copy the list.', 'error');
    }
  };

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow={formatWeekRange(activeWeek)}
        title="Shop & Home Stock."
        description="Check what is at home, then buy only what this week still needs."
        persistent
        actions={
          view === 'to-buy' ? (
            <>
              <Button variant="secondary" onClick={() => setShowManualForm(true)}>
                <Plus aria-hidden="true" size={18} /> Add item
              </Button>
              {shoppingItems.length ? (
                <>
                  <Button variant="secondary" onClick={copyList}>
                    <Clipboard aria-hidden="true" size={18} /> Copy
                  </Button>
                  <Button variant="primary" onClick={rebuildShopping}>
                    <RefreshCw aria-hidden="true" size={18} /> Refresh
                  </Button>
                </>
              ) : null}
            </>
          ) : (
            <Button
              variant="primary"
              onClick={() => {
                setEditingStockItem(null);
                setShowStockForm(true);
              }}
            >
              <PackagePlus aria-hidden="true" size={18} /> Add to Home Stock
            </Button>
          )
        }
      />

      <SegmentedControl
        label="Shop view"
        value={view}
        onChange={setView}
        options={[
          { value: 'to-buy', label: 'To buy' },
          { value: 'at-home', label: 'At home' },
        ]}
      />

      {replenishmentSuggestions.length ? (
        <Card className="replenishment-suggestions">
          <header>
            <div>
              <span className="eyebrow">Review before adding</span>
              <h2>Replenishment suggestions</h2>
            </div>
            <span>{replenishmentSuggestions.length}</span>
          </header>
          <div className="replenishment-suggestions__list">
            {replenishmentSuggestions.map((suggestion) => (
              <div className="replenishment-suggestion" key={suggestion.id}>
                <div>
                  <strong>{suggestion.name}</strong>
                  <small>
                    {suggestion.currentQuantity === null
                      ? `Current quantity unknown; target ${suggestion.targetQuantity}${suggestion.unit ? ` ${suggestion.unit}` : ''}. Review required.`
                      : `At ${suggestion.currentQuantity}${suggestion.unit ? ` ${suggestion.unit}` : ''} (reorder at ${suggestion.reorderPoint}); top up ${suggestion.suggestedQuantity}${suggestion.unit ? ` ${suggestion.unit}` : ''} to reach ${suggestion.targetQuantity}.`}
                  </small>
                </div>
                <div className="replenishment-suggestion__actions">
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => acceptReplenishmentSuggestion(suggestion.homeStockItemId)}
                  >
                    Accept
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => dismissReplenishmentSuggestion(suggestion.homeStockItemId)}
                  >
                    Dismiss
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => disableReplenishmentRule(suggestion.homeStockItemId)}
                  >
                    Disable rule
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      ) : null}

      {view === 'to-buy' ? (
        shoppingItems.length ? (
          <section className="shopping-list" aria-label="Shopping list">
            <Card className="shopping-progress">
              <div>
                <span className="eyebrow">Shopping progress</span>
                <strong>
                  {checked === shoppingItems.length
                    ? 'All done'
                    : `${shoppingItems.length - checked} items left`}
                </strong>
              </div>
              <div
                className="progress-ring"
                style={{ '--progress': `${progress * 3.6}deg` } as CSSProperties}
              >
                <span>{progress}%</span>
              </div>
            </Card>
            {[...groups.entries()].map(([category, items]) => (
              <Card className="shopping-group" key={category}>
                <header>
                  <h2>{CATEGORY_LABELS[category]}</h2>
                  <span>{items.length}</span>
                </header>
                <div>
                  {items.map((item) => (
                    <div
                      className={`shopping-line shopping-line--detailed ${item.checked ? 'is-checked' : ''}`}
                      key={item.id}
                    >
                      <label className="shopping-line__toggle">
                        <input
                          type="checkbox"
                          checked={item.checked}
                          onChange={() => toggleShoppingItem(item.id)}
                        />
                        <span className="shopping-line__check">
                          <Check aria-hidden="true" size={16} />
                        </span>
                        <span className="sr-only">Mark {item.name} as bought</span>
                      </label>
                      <div>
                        <span className="shopping-line__name">{item.name}</span>
                        <small
                          className={
                            item.requiresReview
                              ? 'shopping-explanation shopping-explanation--review'
                              : 'shopping-explanation'
                          }
                        >
                          {reconciliation(item)}
                        </small>
                        {item.requiresReview ? (
                          <small className="shopping-review-note">
                            An unknown quantity, incompatible unit, or uncertain match needs review.
                          </small>
                        ) : null}
                      </div>
                      <div className="shopping-line__actions">
                        <span className="shopping-line__quantity">{formatQuantity(item)}</span>
                        {item.requiresReview ? (
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => resolveShoppingReview(item.id)}
                          >
                            Review: buy full amount
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            ))}
          </section>
        ) : plannedRecipes ? (
          <EmptyState
            icon={ShoppingBasket}
            title="Build the list for this week"
            description={`${plannedRecipes} planned dinner${plannedRecipes === 1 ? '' : 's'} can be reconciled with Home Stock.`}
            action={
              <Button variant="primary" onClick={rebuildShopping}>
                Build shopping list
              </Button>
            }
          />
        ) : (
          <EmptyState
            icon={ShoppingBasket}
            title="Add a shopping item or plan a dinner"
            description="Manual household items do not need a recipe. Planned recipes are added when you refresh the list."
            action={
              <Button variant="primary" onClick={() => setShowManualForm(true)}>
                Add shopping item
              </Button>
            }
          />
        )
      ) : (
        <section className="home-stock" aria-label="Home Stock">
          <Card className="home-stock__toolbar">
            <label className="search-field">
              <Search aria-hidden="true" size={18} />
              <span className="sr-only">Search Home Stock</span>
              <input
                value={stockSearch}
                onChange={(event) => setStockSearch(event.target.value)}
                placeholder="Search Home Stock"
              />
            </label>
            <div className="home-stock__filters">
              <div className="filter-pills" aria-label="Filter Home Stock type">
                {(['all', 'food', 'household'] as const).map((kind) => (
                  <button
                    key={kind}
                    type="button"
                    className={stockKind === kind ? 'is-active' : ''}
                    aria-pressed={stockKind === kind}
                    onClick={() => setStockKind(kind)}
                  >
                    {kind === 'all' ? 'All' : kind === 'food' ? 'Food' : 'Household'}
                  </button>
                ))}
                <button
                  type="button"
                  className={stockFrozenOnly ? 'is-active' : ''}
                  aria-pressed={stockFrozenOnly}
                  onClick={() => setStockFrozenOnly((current) => !current)}
                >
                  <Snowflake aria-hidden="true" size={14} /> Frozen
                </button>
              </div>
              <label className="home-stock__location">
                <span>Location</span>
                <select
                  value={stockLocation}
                  onChange={(event) => setStockLocation(event.target.value)}
                >
                  <option value="all">All locations</option>
                  {locations.map((location) => (
                    <option key={location} value={location}>
                      {location}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </Card>

          {nextPlanStockIds.length ? (
            <Card className="next-plan-constraints" aria-live="polite">
              <div>
                <span className="eyebrow">Must use</span>
                <strong>
                  {nextPlanStockIds.length} Home Stock item
                  {nextPlanStockIds.length === 1 ? '' : 's'} selected
                </strong>
                <small>
                  Only fully covered saved recipes qualify. Planning does not reserve or deduct
                  stock.
                </small>
                {nextPlanFailures.length ? (
                  <ul className="next-plan-constraints__failures">
                    {nextPlanFailures.map((failure) => (
                      <li key={failure}>{failure}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
              <div className="next-plan-constraints__actions">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setNextPlanStockIds([]);
                    setNextPlanFailures([]);
                  }}
                >
                  Clear
                </Button>
                <Button
                  variant="primary"
                  onClick={() => {
                    const result = planFromStock(nextPlanStockIds);
                    if (result.ok) {
                      setNextPlanStockIds([]);
                      setNextPlanFailures([]);
                      onOpenPlan();
                    } else {
                      setNextPlanFailures(result.failures.map((failure) => failure.message));
                    }
                  }}
                >
                  Use in next plan
                </Button>
              </div>
            </Card>
          ) : null}

          {visibleStock.length ? (
            <div className="home-stock__grid">
              {visibleStock.map((item) => (
                <Card
                  className={`stock-card ${item.quantity === 0 ? 'stock-card--empty' : ''}`}
                  key={item.id}
                >
                  <div className="stock-card__heading">
                    <div>
                      <span className="eyebrow">
                        {item.location} · {item.kind}
                      </span>
                      <h2>{item.name}</h2>
                    </div>
                    <div className="stock-card__badges">
                      {item.kind === 'food' && item.frozen ? (
                        <span className="stock-card__tag">
                          <Snowflake aria-hidden="true" size={14} /> Frozen
                        </span>
                      ) : null}
                      {item.planningPriority === 'use-soon' ? (
                        <span className="stock-card__priority">
                          <Sparkles aria-hidden="true" size={14} /> Use soon
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <p className="stock-card__meta">{item.category}</p>
                  <strong className="stock-card__quantity">{stockQuantity(item)}</strong>
                  {item.reorderPoint !== undefined &&
                  item.reorderPoint !== null &&
                  item.targetQuantity !== undefined &&
                  item.targetQuantity !== null ? (
                    <small className="stock-card__rule">
                      {item.replenishmentRuleEnabled === false
                        ? 'Replenishment rule disabled'
                        : `Suggest at ${item.reorderPoint}${item.unit ? ` ${item.unit}` : ''} · target ${item.targetQuantity}${item.unit ? ` ${item.unit}` : ''}${item.replenishmentSuggestionStatus === 'dismissed' ? ' · suggestion dismissed' : ''}`}
                    </small>
                  ) : null}
                  {item.quantity === 0 ? (
                    <Button variant="primary" onClick={() => addHomeStockItemToShopping(item.id)}>
                      Add to shop
                    </Button>
                  ) : (
                    <div
                      className="stock-card__quantity-controls"
                      aria-label={`Adjust ${item.name} quantity`}
                    >
                      <Button
                        variant="secondary"
                        size="icon"
                        onClick={() => adjustHomeStockQuantity(item.id, -1)}
                        aria-label={`Decrease ${item.name} quantity`}
                        title="Decrease quantity"
                      >
                        <Minus aria-hidden="true" size={18} />
                      </Button>
                      <Button
                        variant="secondary"
                        size="icon"
                        onClick={() => adjustHomeStockQuantity(item.id, 1)}
                        aria-label={`Increase ${item.name} quantity`}
                        title="Increase quantity"
                      >
                        <Plus aria-hidden="true" size={18} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => markHomeStockUsedUp(item.id)}
                      >
                        Mark used up
                      </Button>
                    </div>
                  )}
                  <div className="stock-card__footer">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setEditingStockItem(item);
                        setShowStockForm(true);
                      }}
                      aria-label={`Edit ${item.name}`}
                    >
                      <Pencil aria-hidden="true" size={16} /> Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleHomeStockUseSoon(item.id)}
                    >
                      {item.planningPriority === 'use-soon' ? 'Remove use soon' : 'Use soon'}
                    </Button>
                    <Button
                      variant={nextPlanStockIds.includes(item.id) ? 'secondary' : 'ghost'}
                      size="sm"
                      aria-pressed={nextPlanStockIds.includes(item.id)}
                      onClick={() => {
                        setNextPlanFailures([]);
                        setNextPlanStockIds((current) =>
                          current.includes(item.id)
                            ? current.filter((id) => id !== item.id)
                            : [...current, item.id],
                        );
                      }}
                    >
                      {nextPlanStockIds.includes(item.id) ? (
                        <Check aria-hidden="true" size={16} />
                      ) : null}
                      Use in next plan
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setArchiveTarget(item)}>
                      <Trash2 aria-hidden="true" size={16} /> Archive
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={PackagePlus}
              title={
                state.homeStockItems.some((item) => !item.archived)
                  ? 'No matching Home Stock'
                  : 'Start your Home Stock'
              }
              description="Add food and household supplies here. Zero quantities remain visible until you archive them."
              action={
                <Button
                  variant="primary"
                  onClick={() => {
                    setEditingStockItem(null);
                    setShowStockForm(true);
                  }}
                >
                  Add to Home Stock
                </Button>
              }
            />
          )}

          {archivedStock.length ? (
            <Card className="archived-stock">
              <header>
                <h2>Archived</h2>
                <span>{archivedStock.length}</span>
              </header>
              {archivedStock.map((item) => (
                <div className="archived-stock__item" key={item.id}>
                  <span>
                    {item.name} <small>{item.location}</small>
                  </span>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => restoreHomeStockItem(item.id)}
                  >
                    Restore
                  </Button>
                </div>
              ))}
            </Card>
          ) : null}
        </section>
      )}

      {showStockForm ? (
        <Modal
          title={editingStockItem ? `Edit ${editingStockItem.name}` : 'Add to Home Stock'}
          description="Keep food and household supplies together, even when they run out."
          onClose={() => {
            setShowStockForm(false);
            setEditingStockItem(null);
          }}
        >
          <HomeStockForm
            item={editingStockItem ?? undefined}
            onSave={(item) => {
              upsertHomeStockItem(item);
              setShowStockForm(false);
              setEditingStockItem(null);
            }}
            onCancel={() => {
              setShowStockForm(false);
              setEditingStockItem(null);
            }}
          />
        </Modal>
      ) : null}
      {showManualForm ? (
        <Modal
          title="Add shopping item"
          description="Manual items stay separate from recipe ingredients."
          onClose={() => setShowManualForm(false)}
        >
          <ManualShoppingForm
            onSave={(item) => {
              addManualShoppingItem(item);
              setShowManualForm(false);
            }}
            onCancel={() => setShowManualForm(false)}
          />
        </Modal>
      ) : null}
      {archiveTarget ? (
        <Modal
          title={`Archive ${archiveTarget.name}?`}
          description="Archived items are kept for your records and can be restored later."
          onClose={() => setArchiveTarget(null)}
        >
          <div className="confirm-copy">
            <p>This removes it from active Home Stock and recipe matching.</p>
          </div>
          <footer className="modal-actions">
            <Button variant="ghost" onClick={() => setArchiveTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                archiveHomeStockItem(archiveTarget.id);
                setArchiveTarget(null);
              }}
            >
              Archive item
            </Button>
          </footer>
        </Modal>
      ) : null}
    </div>
  );
}
