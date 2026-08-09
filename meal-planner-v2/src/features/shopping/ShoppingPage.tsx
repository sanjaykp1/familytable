import { Check, Clipboard, RefreshCw, ShoppingBasket, Sparkles } from 'lucide-react';
import { useMemo, type CSSProperties } from 'react';
import { useApp } from '../../app/AppProvider';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { PageHeader } from '../../components/ui/PageHeader';
import { formatWeekRange } from '../../domain/date';
import { formatQuantity } from '../../domain/shopping';
import {
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  DAY_KEYS,
  type IngredientCategory,
} from '../../domain/types';

export function ShoppingPage({ onOpenPlan }: { onOpenPlan: () => void }) {
  const { activeWeek, currentPlan, shoppingItems, rebuildShopping, toggleShoppingItem, notify } =
    useApp();
  const plannedRecipes = DAY_KEYS.filter((day) => currentPlan.slots[day].recipeId).length;
  const decided = DAY_KEYS.filter((day) => {
    const slot = currentPlan.slots[day];
    return Boolean(slot.recipeId) || (slot.kind !== undefined && slot.kind !== 'recipe');
  }).length;
  const checked = shoppingItems.filter((item) => item.checked).length;
  const progress = shoppingItems.length ? Math.round((checked / shoppingItems.length) * 100) : 0;

  const groups = useMemo(() => {
    const grouped = new Map<IngredientCategory, typeof shoppingItems>();
    for (const category of CATEGORY_ORDER) {
      const items = shoppingItems.filter((item) => item.category === category);
      if (items.length) grouped.set(category, items);
    }
    return grouped;
  }, [shoppingItems]);

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
        title="One list for the week."
        description="Quantities are combined across planned dinners, grouped roughly by where you will find them."
        persistent
        actions={
          shoppingItems.length ? (
            <>
              <Button variant="secondary" onClick={copyList}>
                <Clipboard aria-hidden="true" size={18} /> Copy
              </Button>
              <Button variant="primary" onClick={rebuildShopping}>
                <RefreshCw aria-hidden="true" size={18} /> Refresh
              </Button>
            </>
          ) : undefined
        }
      />

      {shoppingItems.length ? (
        <div className="shopping-layout">
          <section className="shopping-list" aria-label="Shopping list">
            <Card className="shopping-progress shopping-progress--persistent">
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
                    <label
                      className={`shopping-line ${item.checked ? 'is-checked' : ''}`}
                      key={item.id}
                    >
                      <input
                        type="checkbox"
                        checked={item.checked}
                        onChange={() => toggleShoppingItem(item.id)}
                      />
                      <span className="shopping-line__check">
                        <Check aria-hidden="true" size={16} />
                      </span>
                      <span className="shopping-line__name">{item.name}</span>
                      <span className="shopping-line__quantity">{formatQuantity(item)}</span>
                    </label>
                  ))}
                </div>
              </Card>
            ))}
          </section>

          <aside className="shopping-aside">
            <Card className="integration-card">
              <span className="integration-card__icon">
                <Sparkles aria-hidden="true" size={21} />
              </span>
              <span className="eyebrow">Built for the next step</span>
              <h2>Send this list to Oda</h2>
              <p>
                Product matching and a confirmed cart preview fit here when the connector is ready.
                Your core planning data will not need to change.
              </p>
              <span className="coming-chip">Planned integration</span>
            </Card>
            <Card className="shopping-note">
              <ShoppingBasket aria-hidden="true" size={20} />
              <div>
                <strong>Stored on this device</strong>
                <p>Your ticks remain after closing the app and are included in backups.</p>
              </div>
            </Card>
          </aside>
        </div>
      ) : plannedRecipes ? (
        <EmptyState
          icon={ShoppingBasket}
          title="Build the list for this week"
          description={`${plannedRecipes} planned dinner${plannedRecipes === 1 ? '' : 's'} can be combined into one checklist.`}
          action={
            <Button variant="primary" onClick={rebuildShopping}>
              Build shopping list
            </Button>
          }
        />
      ) : decided ? (
        <EmptyState
          icon={ShoppingBasket}
          title="Nothing to buy for these plans"
          description="Leftovers, eating out and skipped dinners do not add ingredients to the shopping list."
          action={
            <Button variant="primary" onClick={onOpenPlan}>
              Review weekly plan
            </Button>
          }
        />
      ) : (
        <EmptyState
          icon={ShoppingBasket}
          title="Plan a dinner first"
          description="The shopping list is generated from the recipes assigned to this week."
          action={
            <Button variant="primary" onClick={onOpenPlan}>
              Open weekly plan
            </Button>
          }
        />
      )}
    </div>
  );
}
