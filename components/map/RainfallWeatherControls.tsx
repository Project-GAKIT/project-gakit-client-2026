'use client';

import type { RainfallWeatherControlState } from '@/hooks/useRainfallLayer';
import { forecastTime } from '@/lib/map/forecastWeather';
import { PillSlider } from '@/components/ui/PillSlider';

const button = 'rounded-md px-2 py-1.5 text-[11px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus';

export function RainfallWeatherControls({ weather, position }: { weather: RainfallWeatherControlState; position: 'mode' | 'details' }) {
  if (position === 'mode') return (
    <div role="group" aria-label="Rainfall source" className="grid grid-cols-2 gap-0.5 rounded-lg bg-page p-0.5 ring-1 ring-inset ring-default">
      {(['recent', 'forecast'] as const).map(mode => <button key={mode} type="button" aria-pressed={weather.mode === mode} onClick={() => weather.setMode(mode)}
        className={`${button} ${weather.mode === mode ? 'bg-panel text-primary shadow-xs' : 'text-muted-foreground hover:text-primary'}`}>
        {mode === 'recent' ? 'Recent' : 'Forecast'}
      </button>)}
    </div>
  );
  const details = [
    'ECMWF IFS model forecast',
    weather.issuedAt && `Issued ${forecastTime(weather.issuedAt)}`,
    weather.fetchedAt && `Retrieved ${forecastTime(weather.fetchedAt)}`,
    weather.rainWindowEndAt && `${weather.intervalHours}-hour rain window ending ${forecastTime(weather.rainWindowEndAt)}`,
  ].filter(Boolean).join('\n');
  return <div className="space-y-1.5">
    {weather.mode === 'forecast' && <>
      <div className="flex items-center justify-between gap-2 text-[10px] text-muted-foreground">
        <span className="shrink-0 font-semibold uppercase tracking-wide">Forecast time</span>
        {weather.validAt && <span className="text-right font-medium" data-forecast-valid-at={weather.validAt}>{forecastTime(weather.validAt)}</span>}
      </div>
      {weather.times.length > 0 && <>
        <PillSlider value={weather.index} min={0} max={weather.times.length - 1} step={1} onChange={weather.select} ariaLabel="Rainfall forecast time" />
        <div role="group" aria-label="Forecast day" className="grid grid-cols-4 gap-1">
          {[0, 24, 48, 72].map(hour => <button key={hour} type="button" disabled={hour >= weather.times.length}
            aria-pressed={weather.index === hour} onClick={() => weather.select(hour)}
            className={`${button} px-1 ${weather.index === hour ? 'bg-muted text-primary' : 'text-muted-foreground hover:bg-page hover:text-primary'} disabled:opacity-30`}>
            {hour === 0 ? 'Now' : `+${hour / 24}d`}
          </button>)}
        </div>
      </>}
      {weather.loading && !weather.validAt && <p role="status" className="text-[10px] text-muted-foreground">Loading rain and wind…</p>}
      {weather.validAt && <p title={details} aria-label={details} className="text-[10px] leading-snug text-muted-foreground">
        {weather.resolution === .1 ? `0.1° · ${weather.intervalHours}h mean` : 'Sampled preview'}{weather.stale ? ' · Update pending' : ''}
      </p>}
    </>}
    <button type="button" role="switch" aria-label="Wind trails" aria-checked={weather.wind} onClick={() => weather.setWind(!weather.wind)} title={`ECMWF IFS · 10 m wind · ${weather.mode === 'recent' ? 'Current model estimate' : 'Selected forecast hour'}`}
      className="flex w-full items-center justify-between gap-2 rounded-md py-1 text-[11px] text-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus">
      <span>Wind trails</span><span aria-hidden="true" className={`relative h-4 w-7 rounded-full ring-1 ring-inset ring-switch-edge ${weather.wind ? 'bg-contrast' : 'bg-switch-off'}`}>
        <span className={`absolute left-0.5 top-0.5 h-3 w-3 rounded-full bg-on-accent transition-transform ${weather.wind ? 'translate-x-3' : 'translate-x-0'}`} />
      </span>
    </button>
    {weather.wind && weather.mode === 'recent' && weather.loading && !weather.fetchedAt && <p role="status" className="text-[10px] text-muted-foreground">Loading wind…</p>}
    {(weather.error || weather.windError) && <div role="status" className="text-[10px] leading-relaxed text-muted-foreground">
      <p>{weather.error || weather.windError}</p><button type="button" onClick={weather.retry} className="mt-1 rounded text-secondary underline underline-offset-2 focus-visible:outline-focus">Retry</button>
    </div>}
  </div>;
}
