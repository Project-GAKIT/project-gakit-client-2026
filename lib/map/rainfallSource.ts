import type { ScenarioFrame, ScenarioPresetType } from '@/types/scenario';

export interface RainfallSourceDetails {
  hourly: string;
  attribution: 'hour' | 'window';
  window: string[];
  correction: 'corrected' | 'mixed' | 'raw' | 'forecast_only' | 'not_applied' | 'unknown';
  times: { label: string; value: string }[];
}

export function rainfallProvider(source: string): string {
  if (source.startsWith('uncorrected_fallback:')) return `${rainfallProvider(source.slice('uncorrected_fallback:'.length))} · raw fallback`;
  if (source.startsWith('gsmap_now_corrected:')) return 'JAXA NOW · corrected';
  if (/gsmap[ _-]?rnc/i.test(source)) return 'JAXA RNC';
  if (source === 'open_meteo') return 'Open-Meteo';
  if (source === 'ecmwf_ifs') return 'ECMWF IFS';
  if (/gsmap[ _-]?nrt/i.test(source)) return 'JAXA NRT';
  if (/gsmap[ _-]?now/i.test(source)) return 'JAXA NOW';
  return 'Source not reported';
}

const validTime = (value?: string | null): value is string => Boolean(value && Number.isFinite(Date.parse(value)));

export function rainfallSourceDetails(frame?: ScenarioFrame, presetType: ScenarioPresetType = 'live', historicalSource?: string, historicalCorrected = false): RainfallSourceDetails {
  if (presetType !== 'live') {
    const synthetic = presetType === 'design_storm' || presetType === 'pagasa_alert';
    return { hourly: historicalCorrected ? 'JAXA NOW · corrected' : synthetic ? 'Synthetic rainfall pattern' : historicalSource || 'Historical source not reported', attribution: 'hour',
      window: [], correction: historicalCorrected ? 'corrected' : synthetic ? 'not_applied' : 'unknown', times: [] };
  }
  const live = frame?.live;
  const sources = live?.rainfall_sources ?? [];
  const corrected = sources.some(s => s.startsWith('gsmap_now_corrected:'));
  const raw = sources.some(s => s.startsWith('uncorrected_fallback:') || (!s.startsWith('gsmap_now_corrected:') && /gsmap[ _-]?(?:now|nrt)/i.test(s)));
  const forecastOnly = sources.length > 0 && sources.every(s => s === 'open_meteo' || /gsmap[ _-]?rnc/i.test(s));
  const correction = corrected ? raw ? 'mixed' : 'corrected' : raw ? 'raw' : forecastOnly ? 'forecast_only' : 'unknown';
  // Older snapshots do not identify the selected hour separately from the window.
  const singleForecast = live?.kind === 'forecast' && live.forecast_source && !live.forecast_source.includes('+') ? live.forecast_source : undefined;
  const selected = live?.hourly_rainfall_source || (sources.length === 1 ? sources[0] : singleForecast);
  const window = [...new Set(sources.map(rainfallProvider))];
  const attribution = !selected && window.length > 0 && frame?.hourly_rain_mm != null ? 'window' : 'hour';
  const hourly = frame?.hourly_rain_mm == null ? 'Unavailable' : selected ? rainfallProvider(selected) : window.length > 0 ? window.join(' + ') : 'Source not reported';
  const times: RainfallSourceDetails['times'] = [];
  if (validTime(live?.hourly_issue_at)) times.push({ label: 'Forecast issued', value: live.hourly_issue_at });
  else if (selected) {
    const issues = (live?.source_issues ?? []).filter(value => value.startsWith(selected + ':')).map(value => value.slice(selected.length + 1)).filter(validTime);
    if (issues.length === 1) times.push({ label: 'Forecast issued', value: issues[0] });
  }
  if (validTime(live?.forecast_retrieved_at)) times.push({ label: 'Open-Meteo retrieved', value: live.forecast_retrieved_at });
  return { hourly, attribution, window, correction, times };
}

export function rainfallTime(value: string): string {
  return new Intl.DateTimeFormat('en-PH', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(value)) + ' PHT';
}
