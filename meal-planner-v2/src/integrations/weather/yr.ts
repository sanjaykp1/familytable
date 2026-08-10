import type { WeatherLocation } from '../../domain/types';

const GEOCODING_URL = 'https://nominatim.openstreetmap.org/search';
const FORECAST_URL = 'https://api.met.no/weatherapi/locationforecast/2.0/compact';

export interface WeatherDay {
  date: string;
  weatherCode: number;
  temperatureMax: number;
  temperatureMin: number;
  precipitationAmount: number;
}

export interface WeatherForecast {
  days: WeatherDay[];
  fetchedAt: string;
}

interface GeocodingResponse {
  place_id?: number;
  display_name?: string;
  lat?: string;
  lon?: string;
  address?: {
    city?: string;
    town?: string;
    village?: string;
    municipality?: string;
    state?: string;
    country?: string;
    country_code?: string;
  };
}

interface PeriodForecast {
  summary?: { symbol_code?: string };
  details?: { precipitation_amount?: number };
}

interface ForecastResponse {
  properties?: {
    timeseries?: Array<{
      time?: string;
      data?: {
        instant?: { details?: { air_temperature?: number } };
        next_1_hours?: PeriodForecast;
        next_6_hours?: PeriodForecast;
        next_12_hours?: PeriodForecast;
      };
    }>;
  };
}

export async function searchWeatherLocations(
  query: string,
  signal?: AbortSignal,
): Promise<WeatherLocation[]> {
  const term = query.trim();
  if (term.length < 2) return [];
  const params = new URLSearchParams({
    q: term,
    format: 'jsonv2',
    limit: '5',
    addressdetails: '1',
    'accept-language': 'en',
  });
  const response = await fetch(`${GEOCODING_URL}?${params}`, { signal });
  if (!response.ok) throw new Error('Location search is unavailable right now.');
  const payload = (await response.json()) as unknown;
  if (!Array.isArray(payload)) return [];
  return (payload as GeocodingResponse[]).flatMap((item) => {
    const name =
      item.address?.city ??
      item.address?.town ??
      item.address?.village ??
      item.address?.municipality ??
      item.display_name?.split(',')[0];
    const latitude = Number(item.lat);
    const longitude = Number(item.lon);
    if (
      typeof item.place_id !== 'number' ||
      typeof name !== 'string' ||
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude)
    ) {
      return [];
    }
    return [{
      id: item.place_id,
      name,
      admin1: item.address?.state ?? '',
      country: item.address?.country ?? '',
      countryCode: item.address?.country_code?.toUpperCase() ?? '',
      latitude,
      longitude,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
    }];
  });
}

export function mapForecastResponse(payload: ForecastResponse, timezone = 'UTC'): WeatherDay[] {
  const dayEntries = new Map<string, Array<{ temperature: number; symbol: string; precipitation: number }>>();
  for (const entry of payload.properties?.timeseries ?? []) {
    if (typeof entry.time !== 'string') continue;
    const temperature = entry.data?.instant?.details?.air_temperature;
    if (typeof temperature !== 'number') continue;
    const date = dateInTimezone(entry.time, timezone);
    const period = entry.data?.next_1_hours;
    const symbol = period?.summary?.symbol_code ?? entry.data?.next_6_hours?.summary?.symbol_code ?? entry.data?.next_12_hours?.summary?.symbol_code ?? 'cloudy';
    const precipitation = period?.details?.precipitation_amount;
    const weatherEntry = {
      temperature,
      symbol,
      precipitation: typeof precipitation === 'number' ? precipitation : 0,
    };
    const entries = dayEntries.get(date);
    if (entries) {
      entries.push(weatherEntry);
    } else {
      dayEntries.set(date, [weatherEntry]);
    }
  }

  return [...dayEntries].map(([date, entries]) => {
    const representative = entries[Math.floor(entries.length / 2)];
    return {
      date,
      weatherCode: symbolCodeToWeatherCode(representative.symbol),
      temperatureMax: Math.max(...entries.map((entry) => entry.temperature)),
      temperatureMin: Math.min(...entries.map((entry) => entry.temperature)),
      precipitationAmount: entries.reduce((sum, entry) => sum + entry.precipitation, 0),
    };
  });
}

export async function fetchWeatherForecast(
  location: WeatherLocation,
  signal?: AbortSignal,
): Promise<WeatherForecast> {
  const params = new URLSearchParams({
    lat: location.latitude.toFixed(4),
    lon: location.longitude.toFixed(4),
  });
  const response = await fetch(`${FORECAST_URL}?${params}`, {
    signal,
    headers: { Accept: 'application/geo+json' },
  });
  if (!response.ok) throw new Error('The weather forecast is unavailable right now.');
  const payload = (await response.json()) as ForecastResponse;
  return { days: mapForecastResponse(payload, location.timezone), fetchedAt: new Date().toISOString() };
}

function dateInTimezone(timestamp: string, timezone: string): string {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(new Date(timestamp));
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return `${values.year}-${values.month}-${values.day}`;
  } catch {
    return timestamp.slice(0, 10);
  }
}

function symbolCodeToWeatherCode(symbolCode: string): number {
  if (symbolCode.includes('thunder')) return 95;
  if (symbolCode.includes('snow') || symbolCode.includes('sleet')) return 71;
  if (symbolCode.includes('rain') || symbolCode.includes('drizzle')) return 61;
  if (symbolCode.includes('fog')) return 45;
  if (symbolCode.includes('clearsky')) return 0;
  if (symbolCode.includes('fair') || symbolCode.includes('partlycloudy')) return 2;
  return 3;
}

export function weatherCodeLabel(code: number): string {
  if (code === 0) return 'Clear';
  if (code <= 3) return 'Partly cloudy';
  if (code <= 48) return 'Foggy';
  if (code <= 67) return 'Rain';
  if (code <= 77) return 'Snow';
  return 'Thunderstorms';
}
