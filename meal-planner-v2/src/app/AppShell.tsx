import { CalendarDays, ChefHat, Moon, Settings, ShoppingBasket, Sun, Utensils } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from '../components/ui/Button';
import { useApp } from './AppProvider';

export type AppScreen = 'plan' | 'recipes' | 'shopping' | 'settings';

const NAV_ITEMS = [
  { id: 'plan' as const, label: 'Plan', icon: CalendarDays },
  { id: 'recipes' as const, label: 'Recipes', icon: ChefHat },
  { id: 'shopping' as const, label: 'Shop', icon: ShoppingBasket },
  { id: 'settings' as const, label: 'Settings', icon: Settings },
];

export function AppShell({
  activeScreen,
  onNavigate,
  children,
}: {
  activeScreen: AppScreen;
  onNavigate: (screen: AppScreen) => void;
  children: ReactNode;
}) {
  const { state, storageError, updatePreferences } = useApp();
  const dark = state.preferences.theme === 'dark';

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <button className="brand" onClick={() => onNavigate('plan')} aria-label="Open weekly plan">
          <span className="brand__mark">
            <Utensils aria-hidden="true" size={19} />
          </span>
          <span>
            <strong>The Family Table</strong>
            <small>Local meal planner</small>
          </span>
        </button>

        <nav className="side-nav" aria-label="Primary navigation">
          {NAV_ITEMS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              className={activeScreen === id ? 'is-active' : ''}
              aria-current={activeScreen === id ? 'page' : undefined}
              onClick={() => onNavigate(id)}
            >
              <Icon aria-hidden="true" size={20} />
              <span>{label}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar__footer">
          <span className={`save-state ${storageError ? 'save-state--error' : ''}`}>
            <span aria-hidden="true" />
            {storageError ? 'Not saved' : 'Saved on this device'}
          </span>
          <p>No account. No cloud. Your household data stays here.</p>
        </div>
      </aside>

      <div className="app-main">
        <header className="topbar">
          <div className="mobile-brand">
            <span className="brand__mark">
              <Utensils aria-hidden="true" size={18} />
            </span>
            <strong>The Family Table</strong>
          </div>
          <span className="topbar__context">{state.preferences.householdName}</span>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => updatePreferences({ theme: dark ? 'light' : 'dark' })}
            aria-label={dark ? 'Use light theme' : 'Use dark theme'}
            title={dark ? 'Use light theme' : 'Use dark theme'}
          >
            {dark ? <Sun aria-hidden="true" size={19} /> : <Moon aria-hidden="true" size={19} />}
          </Button>
        </header>

        <main className="page-content">{children}</main>
      </div>

      <nav className="bottom-nav" aria-label="Primary navigation">
        {NAV_ITEMS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            className={activeScreen === id ? 'is-active' : ''}
            aria-current={activeScreen === id ? 'page' : undefined}
            onClick={() => onNavigate(id)}
          >
            <Icon aria-hidden="true" size={21} />
            <span>{label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
