import { useEffect, useMemo, useState } from 'react';
import type { WeatherLocation } from '../../domain/types';
import {
  fetchWeatherForecast,
  type WeatherForecast,
} from '../../integrations/weather/yr';

export type ForecastState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; forecast: WeatherForecast }
  | { status: 'error'; message: string };

export function useWeatherWeek(location: WeatherLocation | null) {
  const [retryKey, setRetryKey] = useState(0);
  const [forecastState, setForecastState] = useState<ForecastState>({ status: 'idle' });

  useEffect(() => {
    if (!location) {
      queueMicrotask(() => setForecastState({ status: 'idle' }));
      return;
    }
    const controller = new AbortController();
    queueMicrotask(() => setForecastState({ status: 'loading' }));
    void fetchWeatherForecast(location, controller.signal)
      .then((forecast) => setForecastState({ status: 'ready', forecast }))
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setForecastState({
          status: 'error',
          message: error instanceof Error ? error.message : 'Weather is unavailable right now.',
        });
      });
    return () => controller.abort();
  }, [location, retryKey]);

  const forecastByDate = useMemo(
    () =>
      new Map(
        forecastState.status === 'ready'
          ? forecastState.forecast.days.map((day) => [day.date, day] as const)
          : [],
      ),
    [forecastState],
  );

  return {
    forecastState,
    forecastByDate,
    retry: () => setRetryKey((value) => value + 1),
  };
}
