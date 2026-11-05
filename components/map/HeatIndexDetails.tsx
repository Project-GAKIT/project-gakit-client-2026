import { HEAT_INDEX_BANDS, HEAT_INDEX_GRADIENT, HEAT_INDEX_HOURS, type HeatIndexGrid, type HeatIndexHour } from '@/lib/map/heatIndex';
import { RotateCwFadingClock } from 'lucide-react';

export interface HeatIndexControlState {
  visible: boolean;
  setVisible: (visible: boolean) => void;
  hour: HeatIndexHour;
  setHour: (hour: HeatIndexHour) => void;
  grid: HeatIndexGrid | null;
  loading: boolean;
  error: string | null;
  retry: () => void;
}

const formatTime = (stamp: string) => new Intl.DateTimeFormat('en-PH', {
  timeZone: 'Asia/Manila', month: 'short', day: 'numeric', hour: 'numeric',
}).format(new Date(stamp));

export function HeatIndexDetails({ state }: { state: HeatIndexControlState }) {
  return (
    <div className="pl-10 pt-0.5 pb-1 space-y-1.5">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold mb-1 flex items-center justify-between gap-2">
        <span className="shrink-0">Forecast time</span>
        {state.grid && <span aria-live="polite" className="normal-case tracking-normal font-medium text-right">
          Valid {formatTime(state.grid.validAt)} PHT
        </span>}
      </div>
      <div role="group" aria-label="Heat-index forecast hour" className="grid grid-cols-5 gap-1">
        {HEAT_INDEX_HOURS.map((hour) => (
          <button key={hour} type="button" aria-pressed={state.hour === hour}
            onClick={() => state.setHour(hour)}
            className={`rounded-lg py-1 text-xs font-bold tabular-nums transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 ${state.hour === hour ? 'bg-accent text-on-accent shadow-panel ring-1 ring-focus' : 'bg-panel text-secondary shadow-panel ring-1 ring-default/90 hover:bg-page hover:text-primary'}`}>
            {hour === 0 ? 'Now' : `+${hour}h`}
          </button>
        ))}
      </div>
      <div aria-live="polite" className="text-[10px] leading-4 text-secondary">
        {state.loading && !state.grid && <p>Loading heat-index forecast…</p>}
        {state.error && <div role="status" className="space-y-1">
          <p>{state.error}</p>
          <button type="button" onClick={state.retry} disabled={state.loading}
            className="rounded text-secondary underline underline-offset-2 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:opacity-50">Try again</button>
        </div>}
        {state.grid?.stale && <p className="text-warning-text">Using an earlier forecast. Update pending.</p>}
      </div>
      {state.grid && <div className="flex items-center gap-1 pt-1 text-[10px] leading-snug text-muted-foreground">
        <RotateCwFadingClock className="h-3 w-3 shrink-0 text-info-text" />
        <span>ECMWF IFS · 3-hour refresh</span>
      </div>}
      <div aria-label="Heat index in degrees Celsius" className="pt-1 w-full">
        <div className="flex items-center gap-1.5 w-full">
          <div className="h-2.5 flex-1 rounded-full" aria-hidden="true" style={{ background: HEAT_INDEX_GRADIENT }} />
          <span className="text-[10px] font-semibold text-muted-foreground shrink-0">°C</span>
        </div>
        <div className="flex w-full justify-between text-[9px] tabular-nums text-muted-foreground mt-1">
          {HEAT_INDEX_BANDS.map((band) => <span key={band.label} className="font-semibold text-secondary">{band.label.replace('°', '')}</span>)}
        </div>
      </div>
    </div>
  );
}
