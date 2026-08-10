import {
  Cloud,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSnow,
  CloudSun,
  MapPin,
  RefreshCw,
  Sun,
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import type { WeatherLocation } from '../../domain/types';
import {
  weatherCodeLabel,
  type WeatherDay,
} from '../../integrations/weather/yr';
import type { ForecastState } from './useWeatherWeek';

export function WeatherPlanControl({
  location,
  forecastState,
  onConfigure,
  onRetry,
}: {
  location: WeatherLocation | null;
  forecastState: ForecastState;
  onConfigure: () => void;
  onRetry: () => void;
}) {
  if (!location) {
    return (
      <Button variant="secondary" size="sm" onClick={onConfigure}>
        <CloudSun aria-hidden="true" size={17} /> Add weather
      </Button>
    );
  }

  if (forecastState.status === 'error') {
    return (
      <div className="plan-weather-control plan-weather-control--error">
        <span>Weather unavailable</span>
        <button onClick={onRetry} aria-label="Retry weather forecast" title="Retry forecast">
          <RefreshCw aria-hidden="true" size={15} />
        </button>
      </div>
    );
  }

  return (
    <div className="plan-weather-control">
      <button onClick={onConfigure} title="Change weather location">
        <MapPin aria-hidden="true" size={15} />
        <span>{location.name}</span>
      </button>
      <a href="https://www.yr.no/" target="_blank" rel="noreferrer" title="Weather by Yr">
        Yr
      </a>
    </div>
  );
}

export function WeatherDayInline({
  forecast,
  status,
}: {
  forecast?: WeatherDay;
  status: ForecastState['status'];
}) {
  if (status === 'loading') {
    return (
      <div className="day-weather day-weather--loading" aria-label="Loading weather">
        <span />
        <span />
      </div>
    );
  }

  if (!forecast) {
    return (
      <div className="day-weather day-weather--unavailable" aria-label="Forecast not available">
        <Cloud aria-hidden="true" size={18} />
        <span>—</span>
      </div>
    );
  }

  const label = weatherCodeLabel(forecast.weatherCode);
  return (
    <div
      className="day-weather"
      aria-label={`${label}, ${Math.round(forecast.temperatureMax)} degrees, ${forecast.precipitationAmount.toFixed(1)} millimetres of rain`}
    >
      <WeatherIcon code={forecast.weatherCode} />
      <div>
        <strong>
          {Math.round(forecast.temperatureMax)}°
          <span> / {Math.round(forecast.temperatureMin)}°</span>
        </strong>
        <small>
          {label}
          {forecast.precipitationAmount > 0
            ? ` · ${forecast.precipitationAmount.toFixed(1)} mm rain`
            : ''}
        </small>
      </div>
    </div>
  );
}

function WeatherIcon({ code }: { code: number }) {
  const props = { 'aria-hidden': true as const, size: 21 };
  if (code === 0) return <Sun {...props} />;
  if (code <= 3) return <CloudSun {...props} />;
  if (code <= 48) return <CloudFog {...props} />;
  if (code <= 67 || (code >= 80 && code <= 82)) return <CloudRain {...props} />;
  if ((code >= 71 && code <= 77) || (code >= 85 && code <= 86)) {
    return <CloudSnow {...props} />;
  }
  if (code >= 95) return <CloudLightning {...props} />;
  return <Cloud {...props} />;
}
