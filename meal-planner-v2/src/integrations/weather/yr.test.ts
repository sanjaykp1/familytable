import { describe, expect, it } from 'vitest';
import { mapForecastResponse, weatherCodeLabel } from './yr';

describe('Yr Locationforecast mapping', () => {
  it('groups hourly forecasts into local planner days', () => {
    const days = mapForecastResponse({
      properties: {
        timeseries: [
          { time: '2026-08-07T10:00:00Z', data: { instant: { details: { air_temperature: 11.2 } }, next_1_hours: { summary: { symbol_code: 'rain' }, details: { precipitation_amount: 0.4 } } } },
          { time: '2026-08-07T11:00:00Z', data: { instant: { details: { air_temperature: 18.4 } }, next_1_hours: { summary: { symbol_code: 'rain' }, details: { precipitation_amount: 0.6 } } } },
        ],
      },
    });

    expect(days).toEqual([{ date: '2026-08-07', weatherCode: 61, temperatureMax: 18.4, temperatureMin: 11.2, precipitationAmount: 1 }]);
  });

  it('skips malformed entries and provides useful weather labels', () => {
    expect(mapForecastResponse({ properties: { timeseries: [{ time: '2026-08-07T10:00:00Z' }] } })).toEqual([]);
    expect(weatherCodeLabel(0)).toBe('Clear');
    expect(weatherCodeLabel(61)).toBe('Rain');
    expect(weatherCodeLabel(95)).toBe('Thunderstorms');
  });
});
