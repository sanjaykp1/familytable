import type { WeatherLocation } from '../../domain/types';

const GEOCODING_URL = 'https://geocoding-api.open-meteo.com/v1/search';
const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';

export interface WeatherDay {
  date: string;
  weatherCode: number;
  temperatureMax: number;
  temperatureMin: number;
  precipitationProbability: number;
}

export interface WeatherForecast {
  days: WeatherDay[];
  fetchedAt: string;
}

interface GeocodingResponse {
  results?: Array<{
    id?: number;
    name?: string;
    admin1?: string;
    country?: string;
    country_code?: string;
    latitude?: number;
    longitude?: number;
    timezone?: string;
  }>;
}

interface ForecastResponse {
  daily?: {
    time?: string[];
    weather_code?: number[];
    temperature_2m_max?: number[];
    temperature_2m_min?: number[];
    precipitation_probability_max?: number[];
  };
}

export async function searchWeatherLocations(
  query: string,
  signal?: AbortSignal,
): Promise<WeatherLocation[]> {
  const term = query.trim();
  if (term.length < 2) return [];
  const params = new URLSearchParams({ name: term, count: '5', language: 'en', format: 'json' });
  const response = await fetch(`${GEOCODING_URL}?${params}`, { signal });
  if (!response.ok) throw new Error('Location search is unavailable right now.');
  const payload = (await response.json()) as GeocodingResponse;
  return (payload.results ?? []).flatMap((item) => {
    if (
      typeof item.id !== 'number' ||
      typeof item.name !== 'string' ||
      typeof item.latitude !== 'number' ||
      typeof item.longitude !== 'number' ||
      typeof item.timezone !== 'string'
    ) {
      return [];
    }
    return [
      {
        id: item.id,
        name: item.name,
        admin1: item.admin1 ?? '',
        country: item.country ?? '',
        countryCode: item.country_code ?? '',
        latitude: item.latitude,
        longitude: item.longitude,
        timezone: item.timezone,
      },
    ];
  });
}

export function mapForecastResponse(payload: ForecastResponse): WeatherDay[] {
  const daily = payload.daily;
  if (!daily?.time) return [];
  return daily.time.flatMap((date, index) => {
    const weatherCode = daily.weather_code?.[index];
    const temperatureMax = daily.temperature_2m_max?.[index];
    const temperatureMin = daily.temperature_2m_min?.[index];
    const precipitationProbability = daily.precipitation_probability_max?.[index];
    if (
      typeof weatherCode !== 'number' ||
      typeof temperatureMax !== 'number' ||
      typeof temperatureMin !== 'number'
    ) {
      return [];
    }
    return [
      {
        date,
        weatherCode,
        temperatureMax,
        temperatureMin,
        precipitationProbability:
          typeof precipitationProbability === 'number' ? precipitationProbability : 0,
      },
    ];
  });
}

export async function fetchWeatherForecast(
  location: WeatherLocation,
  signal?: AbortSignal,
): Promise<WeatherForecast> {
  const params = new URLSearchParams({
    latitude: String(location.latitude),
    longitude: String(location.longitude),
    daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max',
    timezone: location.timezone || 'auto',
    forecast_days: '16',
  });
  const response = await fetch(`${FORECAST_URL}?${params}`, { signal });
  if (!response.ok) throw new Error('The weather forecast is unavailable right now.');
  const payload = (await response.json()) as ForecastResponse;
  return { days: mapForecastResponse(payload), fetchedAt: new Date().toISOString() };
}

export function weatherCodeLabel(code: number): string {
  if (code === 0) return 'Clear';
  if (code <= 3) return 'Partly cloudy';
  if (code <= 48) return 'Foggy';
  if (code <= 67) return 'Rain';
  if (code <= 77) return 'Snow';
  if (code <= 82) return 'Showers';
  if (code <= 86) return 'Snow showers';
  return 'Thunderstorms';
}
