import { describe, expect, it } from 'vitest';
import { mapForecastResponse, weatherCodeLabel } from './openMeteo';

describe('Open-Meteo mapping', () => {
  it('maps aligned daily forecast arrays into planner days', () => {
    const days = mapForecastResponse({
      daily: {
        time: ['2026-08-07'],
        weather_code: [61],
        temperature_2m_max: [18.4],
        temperature_2m_min: [11.2],
        precipitation_probability_max: [72],
      },
    });

    expect(days).toEqual([
      {
        date: '2026-08-07',
        weatherCode: 61,
        temperatureMax: 18.4,
        temperatureMin: 11.2,
        precipitationProbability: 72,
      },
    ]);
  });

  it('skips malformed days and provides useful WMO labels', () => {
    expect(mapForecastResponse({ daily: { time: ['2026-08-07'] } })).toEqual([]);
    expect(weatherCodeLabel(0)).toBe('Clear');
    expect(weatherCodeLabel(63)).toBe('Rain');
    expect(weatherCodeLabel(95)).toBe('Thunderstorms');
  });
});
