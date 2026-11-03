import { describe, expect, it } from 'vitest';
import { rainfallProvider, rainfallSourceDetails, rainfallTime } from '@/lib/map/rainfallSource';
import type { ScenarioFrame } from '@/types/scenario';

function frame(overrides: Record<string, unknown> = {}): ScenarioFrame {
  return { hour_index: 0, raw_time: '2026-11-03T13:00:00Z', display_time: '9 PM', hourly_rain_mm: 2, cum_rain_mm: 30,
    inundated_km2: 1, narrative: '', raster_uri: '', live: {
      frame_id: 'selected', valid_at: '2026-11-03T13:00:00Z', kind: 'latest', horizon_hours: 0,
      window_start_at: '2026-11-02T13:00:00Z', window_end_at: '2026-11-03T13:00:00Z', window_hours: 24,
      valid_hours: 24, missing_intervals: [], availability: 'ready', reason: null, rainfall_24h_mm: 30,
      hourly_rain_mm: 2, inundated_km2: 1, max_depth_m: 1, raster_url: '', forecast_source: null,
      source_issues: [], coverage_fraction: 1, ...overrides,
    } };
}

describe('selected rainfall provenance', () => {
  it('names corrected and raw providers without exposing model hashes', () => {
    expect(rainfallProvider('gsmap_now_corrected:deadbeef1234')).toBe('JAXA NOW · corrected');
    expect(rainfallProvider('uncorrected_fallback:JAXA GSMaP_NRT v9')).toBe('JAXA NRT · raw fallback');
    expect(rainfallProvider('gsmap_rnc')).toBe('JAXA RNC');
    expect(rainfallProvider('gsmap_now')).toBe('JAXA NOW');
    expect(rainfallProvider('open_meteo')).toBe('Open-Meteo');
    expect(rainfallProvider('unknown')).toBe('Source not reported');
  });
  it('keeps the selected forecast hour separate from corrected observed history', () => {
    const source = rainfallSourceDetails(frame({ kind: 'forecast', hourly_rainfall_source: 'open_meteo',
      rainfall_sources: ['gsmap_now_corrected:1234', 'open_meteo'], forecast_retrieved_at: '2026-11-03T12:30:00Z' }));
    expect(source.hourly).toBe('Open-Meteo');
    expect(source.window).toEqual(['JAXA NOW · corrected', 'Open-Meteo']);
    expect(source.correction).toBe('corrected');
    expect(source.times).toEqual([{ label: 'Open-Meteo retrieved', value: '2026-11-03T12:30:00Z' }]);
  });
  it('reports RNC issue time from the actual selected provider', () => {
    const source = rainfallSourceDetails(frame({ kind: 'forecast', hourly_rainfall_source: 'gsmap_rnc',
      hourly_issue_at: '2026-11-03T06:00:00Z', rainfall_sources: ['gsmap_now_corrected:1234', 'gsmap_rnc'] }));
    expect(source.hourly).toBe('JAXA RNC');
    expect(source.times[0]).toEqual({ label: 'Forecast issued', value: '2026-11-03T06:00:00Z' });
    expect(rainfallTime(source.times[0].value)).toContain('PHT');
  });
  it('labels mixed correction and missing selected hours honestly', () => {
    const f = frame({ rainfall_sources: ['gsmap_now_corrected:1234','uncorrected_fallback:JAXA GSMaP_NOW'],
      hourly_rainfall_source: 'uncorrected_fallback:JAXA GSMaP_NOW' });
    expect(rainfallSourceDetails(f).correction).toBe('mixed');
    expect(rainfallSourceDetails(f).hourly).toBe('JAXA NOW · raw fallback');
    expect(rainfallSourceDetails({ ...f, hourly_rain_mm: null }).hourly).toBe('Unavailable');
  });
  it('does not guess an hourly provider or issue time from an ambiguous old snapshot', () => {
    const mixed = rainfallSourceDetails(frame({ rainfall_sources: ['gsmap_rnc','open_meteo'] }));
    expect(mixed.hourly).toBe('JAXA RNC + Open-Meteo');
    expect(mixed.attribution).toBe('window');
    const old = rainfallSourceDetails(frame({ kind: 'forecast', forecast_source: 'gsmap_rnc',
      rainfall_sources: ['gsmap_now_corrected:1234','gsmap_rnc'], source_issues: ['gsmap_rnc:2026-11-03T06:00:00+00:00'] }));
    expect(old.hourly).toBe('JAXA RNC');
    expect(old.times).toHaveLength(1);
    expect(rainfallSourceDetails(frame({ hourly_issue_at: 'invalid' })).times).toEqual([]);
  });
  it('shows the actual legacy live NOW/NRT metadata as known window sources', () => {
    const source = rainfallSourceDetails(frame({ hourly_rainfall_source: null,
      rainfall_sources: ['JAXA GSMaP_NOW','JAXA GSMaP_NRT v9'], forecast_source: null }));
    expect(source.hourly).toBe('JAXA NOW + JAXA NRT');
    expect(source.attribution).toBe('window');
    expect(source.correction).toBe('raw');
    expect(source.times).toEqual([]);
    expect(rainfallSourceDetails(frame({ rainfall_sources: ['gsmap_now'] })).hourly).toBe('JAXA NOW');
  });
  it('distinguishes corrected historical forcing from unverified and synthetic inputs', () => {
    expect(rainfallSourceDetails(undefined,'historical','Historical sequence',true).correction).toBe('corrected');
    expect(rainfallSourceDetails(undefined,'historical','Historical sequence').correction).toBe('unknown');
    expect(rainfallSourceDetails(undefined,'design_storm').hourly).toBe('Synthetic rainfall pattern');
    expect(rainfallSourceDetails(undefined,'pagasa_alert').correction).toBe('not_applied');
    expect(rainfallSourceDetails(frame({ kind: 'forecast', rainfall_sources: ['open_meteo'] })).correction).toBe('forecast_only');
  });
});
