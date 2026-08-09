import { useEffect, useState } from 'react';
import { AppShell, type AppScreen } from './app/AppShell';
import { ToastViewport } from './components/ui/ToastViewport';
import { PlanPage } from './features/plan/PlanPage';
import { RecipesPage } from './features/recipes/RecipesPage';
import { SettingsPage } from './features/settings/SettingsPage';
import { ShoppingPage } from './features/shopping/ShoppingPage';

const SCREENS: AppScreen[] = ['plan', 'recipes', 'shopping', 'settings'];

function screenFromHash(): AppScreen {
  const candidate = window.location.hash.replace('#/', '') as AppScreen;
  return SCREENS.includes(candidate) ? candidate : 'plan';
}

export default function App() {
  const [screen, setScreen] = useState<AppScreen>(screenFromHash);

  useEffect(() => {
    const onHashChange = () => setScreen(screenFromHash());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const navigate = (next: AppScreen) => {
    window.location.hash = `/${next}`;
    setScreen(next);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <AppShell activeScreen={screen} onNavigate={navigate}>
      {screen === 'plan' ? (
        <PlanPage
          onOpenShopping={() => navigate('shopping')}
          onOpenSettings={() => navigate('settings')}
        />
      ) : null}
      {screen === 'recipes' ? <RecipesPage /> : null}
      {screen === 'shopping' ? <ShoppingPage onOpenPlan={() => navigate('plan')} /> : null}
      {screen === 'settings' ? <SettingsPage /> : null}
      <ToastViewport />
    </AppShell>
  );
}
