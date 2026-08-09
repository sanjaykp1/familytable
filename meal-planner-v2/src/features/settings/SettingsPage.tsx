import {
  Database,
  Download,
  HardDrive,
  Moon,
  RotateCcw,
  Sun,
  Upload,
  type LucideIcon,
} from 'lucide-react';
import { useRef, useState } from 'react';
import { useApp } from '../../app/AppProvider';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Modal } from '../../components/ui/Modal';
import { PageHeader } from '../../components/ui/PageHeader';
import type { ThemePreference } from '../../domain/types';
import { WeatherSettings } from './WeatherSettings';

export function SettingsPage() {
  const { state, storageError, updatePreferences, exportData, importData, resetData, notify } =
    useApp();
  const inputRef = useRef<HTMLInputElement>(null);
  const [showReset, setShowReset] = useState(false);

  const downloadBackup = () => {
    const blob = new Blob([exportData()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `family-table-backup-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    notify('Backup downloaded.', 'success');
  };

  const readBackup = async (file: File) => {
    try {
      importData(await file.text());
    } catch {
      // The provider already reports the validation error through the toast system.
    } finally {
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const themes: { id: ThemePreference; label: string; icon: LucideIcon }[] = [
    { id: 'system', label: 'System', icon: Database },
    { id: 'light', label: 'Light', icon: Sun },
    { id: 'dark', label: 'Dark', icon: Moon },
  ];

  return (
    <div className="page-stack settings-page">
      <PageHeader
        eyebrow="Settings"
        title="Your table, your device."
        description="Set household defaults and keep a portable backup of everything you create."
      />

      {storageError ? (
        <div className="storage-warning" role="alert">
          {storageError}
        </div>
      ) : null}

      <section className="settings-grid">
        <Card className="settings-card">
          <header>
            <span className="settings-card__icon">
              <Database aria-hidden="true" size={20} />
            </span>
            <div>
              <h2>Household defaults</h2>
              <p>Used when creating future weeks and recipes.</p>
            </div>
          </header>
          <div className="settings-card__body">
            <label className="field">
              <span>Household name</span>
              <input
                value={state.preferences.householdName}
                onChange={(event) => updatePreferences({ householdName: event.target.value })}
              />
            </label>
            <label className="field">
              <span>Default servings</span>
              <input
                type="number"
                min="1"
                max="20"
                value={state.preferences.defaultServings}
                onChange={(event) =>
                  updatePreferences({ defaultServings: Math.max(1, Number(event.target.value)) })
                }
              />
            </label>
          </div>
        </Card>

        <Card className="settings-card">
          <header>
            <span className="settings-card__icon">
              <Sun aria-hidden="true" size={20} />
            </span>
            <div>
              <h2>Appearance</h2>
              <p>Comfortable in a bright kitchen or during a late shop.</p>
            </div>
          </header>
          <div className="theme-options" role="radiogroup" aria-label="Theme">
            {themes.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                role="radio"
                aria-checked={state.preferences.theme === id}
                className={state.preferences.theme === id ? 'is-active' : ''}
                onClick={() => updatePreferences({ theme: id })}
              >
                <Icon aria-hidden="true" size={19} />
                <span>{label}</span>
              </button>
            ))}
          </div>
        </Card>

        <WeatherSettings
          location={state.preferences.weatherLocation}
          onChange={(weatherLocation) => updatePreferences({ weatherLocation })}
        />

        <Card className="settings-card settings-card--wide">
          <header>
            <span className="settings-card__icon">
              <HardDrive aria-hidden="true" size={20} />
            </span>
            <div>
              <h2>Local data</h2>
              <p>Backups include recipes, every planned week, shopping ticks and preferences.</p>
            </div>
          </header>
          <div className="data-actions">
            <div>
              <strong>Download a backup</strong>
              <p>Keep a copy before clearing browser data or moving to another device.</p>
            </div>
            <Button onClick={downloadBackup}>
              <Download aria-hidden="true" size={18} /> Export JSON
            </Button>
          </div>
          <div className="data-actions">
            <div>
              <strong>Restore from a backup</strong>
              <p>The file is validated before it replaces the current local data.</p>
            </div>
            <input
              ref={inputRef}
              className="sr-only"
              type="file"
              accept="application/json,.json"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void readBackup(file);
              }}
            />
            <Button onClick={() => inputRef.current?.click()}>
              <Upload aria-hidden="true" size={18} /> Import JSON
            </Button>
          </div>
          <div className="data-actions data-actions--danger">
            <div>
              <strong>Start over</strong>
              <p>Remove local changes and restore the starter recipes.</p>
            </div>
            <Button variant="danger" onClick={() => setShowReset(true)}>
              <RotateCcw aria-hidden="true" size={18} /> Reset data
            </Button>
          </div>
        </Card>
      </section>

      {showReset ? (
        <Modal title="Reset all local data?" onClose={() => setShowReset(false)}>
          <div className="confirm-copy">
            <p>
              This removes your recipes, plans and shopping lists from this device. Export a backup
              first if you may want them again.
            </p>
          </div>
          <footer className="modal-actions">
            <Button variant="ghost" onClick={() => setShowReset(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                resetData();
                setShowReset(false);
              }}
            >
              Reset everything
            </Button>
          </footer>
        </Modal>
      ) : null}
    </div>
  );
}
