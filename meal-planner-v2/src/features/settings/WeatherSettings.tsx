import { CloudSun, MapPin, Search, X } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import type { WeatherLocation } from '../../domain/types';
import { searchWeatherLocations } from '../../integrations/weather/openMeteo';

export function WeatherSettings({
  location,
  onChange,
}: {
  location: WeatherLocation | null;
  onChange: (location: WeatherLocation | null) => void;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<WeatherLocation[]>([]);
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');

  const search = async (event: FormEvent) => {
    event.preventDefault();
    if (query.trim().length < 2) return;
    setStatus('loading');
    try {
      setResults(await searchWeatherLocations(query));
      setStatus('idle');
    } catch {
      setResults([]);
      setStatus('error');
    }
  };

  return (
    <Card className="settings-card settings-card--wide">
      <header>
        <span className="settings-card__icon">
          <CloudSun aria-hidden="true" size={20} />
        </span>
        <div>
          <h2>Planning weather</h2>
          <p>Optional forecast context for this device. No precise device location is requested.</p>
        </div>
      </header>

      {location ? (
        <div className="weather-location-current">
          <MapPin aria-hidden="true" size={19} />
          <div>
            <strong>{location.name}</strong>
            <span>{[location.admin1, location.country].filter(Boolean).join(', ')}</span>
          </div>
          <Button variant="ghost" size="sm" onClick={() => onChange(null)}>
            <X aria-hidden="true" size={16} /> Remove
          </Button>
        </div>
      ) : null}

      <form className="weather-location-search" onSubmit={(event) => void search(event)}>
        <label className="field">
          <span>{location ? 'Change location' : 'Town or city'}</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="e.g. Oslo or 0150"
          />
        </label>
        <Button type="submit" variant="secondary" disabled={status === 'loading'}>
          <Search aria-hidden="true" size={17} />
          {status === 'loading' ? 'Searching…' : 'Find location'}
        </Button>
      </form>

      {status === 'error' ? (
        <p className="form-error">Location search is unavailable. Try again when online.</p>
      ) : null}

      {results.length ? (
        <div className="weather-location-results" aria-label="Location results">
          {results.map((result) => (
            <button
              key={result.id}
              onClick={() => {
                onChange(result);
                setResults([]);
                setQuery('');
              }}
            >
              <MapPin aria-hidden="true" size={17} />
              <span>
                <strong>{result.name}</strong>
                <small>{[result.admin1, result.country].filter(Boolean).join(', ')}</small>
              </span>
            </button>
          ))}
        </div>
      ) : null}
    </Card>
  );
}
