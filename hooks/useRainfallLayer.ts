'use client';

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { MutableRefObject } from 'react';
import { applyRainfallPaint } from '@/lib/map/overlayLayers';
import { fetchRainfallImage, fetchRainfallAt, RAINFALL_COORDINATES, RAINFALL_PLACEHOLDER_DATA_URL, type RainfallAccumulationHours } from '@/lib/map/rainfall';
import { fetchForecastWeather, forecastCoordinates, forecastRasterUrl, type RainfallMode } from '@/lib/map/forecastWeather';
import { createWindTrails } from '@/lib/map/windTrails';
import type { ForecastWeather } from '@/types/forecastWeather';
import { invalidateApiCache } from '@/lib/backend/apiCache';

/** JAXA evidence and ECMWF visualization stay separate, sharing one map image. */
export function useRainfallLayer(mapRef: MutableRefObject<any>, showRainfall: boolean) {
  const [rainfallHours, setRainfallHours] = useState<RainfallAccumulationHours>(1);
  const [rainfallObservedAt, setRainfallObservedAt] = useState<string | null>(null);
  const [rainfallSource, setRainfallSource] = useState<string | null>(null);
  const [recentLoading, setRecentLoading] = useState(false);
  const [recentError, setRecentError] = useState<string | null>(null);
  const [mode, setMode] = useState<RainfallMode>('recent');
  const [wind, setWind] = useState(true);
  const [forecast, setForecast] = useState<ForecastWeather | null>(null);
  const [forecastLoading, setForecastLoading] = useState(false);
  const [forecastError, setForecastError] = useState<string | null>(null);
  const [selectedAt, setSelectedAt] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const [clock, setClock] = useState(0);
  const hoursRef = useRef(rainfallHours);
  const recentImage = useRef<{ url: string; hours: number; observed: number; expires: number } | null>(null);
  const appliedImage = useRef<{ source: unknown; url: string; coordinates: string } | null>(null);
  const recentRevision = useRef(0);
  const display = useRef({ show: showRainfall, mode, hours: rainfallHours, url: null as string | null, coordinates: RAINFALL_COORDINATES });

  const times = useMemo(() => {
    const anchor = Math.floor(clock / 3_600_000) * 3_600_000;
    return forecast?.times.filter(time => Date.parse(time) >= anchor && Date.parse(time) <= anchor + 72 * 3_600_000) ?? [];
  }, [forecast, clock]);
  const index = Math.max(0, times.indexOf(selectedAt ?? ''));
  const validAt = times[index] ?? null;
  const frame = forecast && validAt ? forecast.frames[forecast.times.indexOf(validAt)] : null;
  const forecastImage = useMemo(() => {
    if (mode !== 'forecast' || !forecast || !frame) return null;
    return forecastRasterUrl(forecast, frame);
  }, [mode, forecast, frame]);

  const applyPreloaded = useCallback((map: any) => {
    const current = display.current;
    const image = current.mode === 'recent'
      ? (recentImage.current?.hours === current.hours && recentImage.current.expires > Date.now() ? recentImage.current.url : null)
      : current.url;
    const source = map?.getSource?.('rainfall');
    const coordinates = current.mode === 'recent' ? RAINFALL_COORDINATES : current.coordinates;
    const url = image ?? RAINFALL_PLACEHOLDER_DATA_URL, key = JSON.stringify(coordinates);
    const applied = appliedImage.current;
    if (source?.updateImage && (!applied || applied.source !== source || applied.url !== url || applied.coordinates !== key)) {
      source.updateImage({ url, coordinates });
      appliedImage.current = { source, url, coordinates: key };
    }
    applyRainfallPaint(map, current.mode === 'recent' ? current.hours : 1);
    if (map?.getLayer?.('rainfall-grid')) map.setLayoutProperty('rainfall-grid', 'visibility', current.show ? 'visible' : 'none');
  }, []);

  useLayoutEffect(() => {
    hoursRef.current = rainfallHours;
    display.current = { show: showRainfall, mode, hours: rainfallHours, url: forecastImage, coordinates: forecast ? forecastCoordinates(forecast) : RAINFALL_COORDINATES };
    applyPreloaded(mapRef.current);
  }, [showRainfall, mode, rainfallHours, forecastImage, forecast, mapRef, applyPreloaded]);

  const loadRainfall = useCallback(async (hours?: RainfallAccumulationHours) => {
    const window = hours ?? hoursRef.current;
    const revision = ++recentRevision.current;
    setRecentLoading(true);
    try {
      const rainfall = await fetchRainfallImage(window);
      if (revision !== recentRevision.current || window !== hoursRef.current) return;
      const url = rainfall.url;
      const observed = Date.parse(rainfall.observedAt);
      recentImage.current = url ? { url, hours: window, observed, expires: observed + 6 * 3_600_000 } : null;
      setRainfallObservedAt(rainfall.observedAt);
      setRainfallSource(rainfall.source);
      setRecentError(null);
      if (display.current.mode === 'recent') applyPreloaded(mapRef.current);
    } catch {
      if (revision !== recentRevision.current) return;
      setRecentError('Recent rainfall is temporarily unavailable.');
      recentImage.current = null;
      if (display.current.mode === 'recent') applyPreloaded(mapRef.current);
    } finally {
      if (revision === recentRevision.current) setRecentLoading(false);
    }
  }, [mapRef, applyPreloaded]);

  useEffect(() => {
    if (!showRainfall || mode !== 'recent') return;
    let active = true;
    let inFlight = false;
    let timer: ReturnType<typeof setTimeout>;
    const refresh = async () => {
      if (!active || inFlight) return;
      clearTimeout(timer);
      if (document.hidden) { timer = setTimeout(refresh, 10 * 60_000); return; }
      inFlight = true;
      try { await loadRainfall(rainfallHours); } finally { inFlight = false; }
      if (!active) return;
      const image = recentImage.current;
      // A newly active visitor can see durable imagery while Render resumes.
      // Recheck old observations promptly without polling fresh data needlessly.
      const delay = !image || Date.now() - image.observed > 90 * 60_000 ? 60_000 : 10 * 60_000;
      timer = setTimeout(refresh, image ? Math.max(1000, Math.min(delay, image.expires - Date.now())) : delay);
    };
    void Promise.resolve().then(refresh);
    const resume = () => { if (!document.hidden) void refresh(); };
    document.addEventListener('visibilitychange', resume);
    return () => { active = false; clearTimeout(timer); document.removeEventListener('visibilitychange', resume); };
  }, [showRainfall, mode, rainfallHours, retry, loadRainfall]);

  useEffect(() => {
    if (!showRainfall || (mode !== 'forecast' && !wind)) return;
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    let inFlight = false;
    const load = async () => {
      if (inFlight) return;
      inFlight = true;
      clearTimeout(timer);
      let delay = 5 * 60_000;
      setForecastLoading(true);
      try {
        const next = await fetchForecastWeather();
        if (Date.parse(next.expiresAt) <= Date.now()) throw new Error('Forecast rainfall and wind have expired.');
        if (active) { setClock(Date.now()); setForecast(next); setForecastError(null); }
      } catch (error) {
        delay = 60_000;
        if (active) { setForecast(null); setForecastError(error instanceof Error ? error.message : 'Forecast is unavailable.'); }
      } finally {
        inFlight = false;
        if (active) { setForecastLoading(false); timer = setTimeout(refresh, delay); }
      }
    };
    void load();
    const refresh = () => { if (!document.hidden) void load(); };
    document.addEventListener('visibilitychange', refresh);
    return () => { active = false; clearTimeout(timer); document.removeEventListener('visibilitychange', refresh); };
  }, [showRainfall, mode, wind, retry]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !showRainfall || !wind || !forecast || Date.parse(forecast.expiresAt) <= Date.now()) return;
    const windIndex = mode === 'forecast' && validAt ? forecast.times.indexOf(validAt)
      : Math.max(0, forecast.times.findIndex(t => Date.parse(t) >= Math.floor(Date.now() / 3_600_000) * 3_600_000));
    const selected = forecast.frames[windIndex];
    if (!selected) return;
    return createWindTrails(map, forecast, selected);
  }, [mapRef, showRainfall, wind, forecast, mode, validAt]);

  const lookupPrecip = useCallback(async (lat: number, lng: number): Promise<number | null> => {
    // Hazard checks always use satellite evidence, never forecast display pixels.
    try { return await fetchRainfallAt(lat, lng, hoursRef.current); } catch { return null; }
  }, []);

  return {
    rainfallHours, setRainfallHours, rainfallObservedAt, rainfallSource, hoursRef,
    isLoading: mode === 'recent' ? recentLoading : forecastLoading,
    lookupPrecip, applyPreloaded,
    weather: {
      mode, setMode, wind, setWind, times, index,
      select: (next: number) => setSelectedAt(times[next] ?? null),
      validAt, fetchedAt: forecast?.fetchedAt ?? null,
      issuedAt: forecast?.issuedAt ?? null,
      intervalHours: forecast?.nativeIntervalHours ?? 1,
      rainWindowEndAt: frame?.rainWindowEndAt ?? null,
      stale: forecast?.stale ?? false,
      loading: forecastLoading,
      error: mode === 'forecast' ? forecastError : recentError,
      windError: wind ? forecastError : null,
      retry: () => { invalidateApiCache('/api/v1/weather/forecast-grid'); setRetry(value => value + 1); },
    },
  };
}

export type RainfallWeatherControlState = ReturnType<typeof useRainfallLayer>['weather'];
