'use client';

import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type CSSProperties } from 'react';
import { ChartNoAxesColumnIncreasing, Pause, Play, Radio, RotateCcw, SkipBack, SkipForward, X } from 'lucide-react';
import { Spinner } from '@/components/ui/Spinner';
import { SIMULATION_DEPTH_LEGEND } from '@/lib/map/colorScales';
import type { SimulatedFloodTelemetry } from '@/lib/map/surrogate';
import type { ScenarioFrame } from '@/types/scenario';
import { FloodSimulationOverview, type FloodOverviewContext, type FloodForecastControl } from './FloodSimulationOverview';

const timeFormat = new Intl.DateTimeFormat('en-PH', { timeZone: 'Asia/Manila', hour: 'numeric', minute: '2-digit' });
const dateFormat = new Intl.DateTimeFormat('en-PH', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric' });
const scenarioDepthLegend = SIMULATION_DEPTH_LEGEND.map((band, index) => ({ ...band, color: ['#EAB308', '#F97316', '#DC2626'][index] }));
const desktopSnapshot = () => window.matchMedia('(min-width: 768px)').matches;
const serverSnapshot = () => false;
function subscribeDesktop(update: () => void) {
  const query = window.matchMedia('(min-width: 768px)');
  query.addEventListener('change', update);
  return () => query.removeEventListener('change', update);
}
function timeLabel(frame?: ScenarioFrame) {
  if (frame && !frame.live) return `+${frame.hour_index}h`;
  return frame && Number.isFinite(Date.parse(frame.raw_time)) ? timeFormat.format(new Date(frame.raw_time)) : '—';
}

function compactDateTimeLabel(frame?: ScenarioFrame) {
  if (!frame || !/^\d{4}-\d{2}-\d{2}/.test(frame.raw_time) || !Number.isFinite(Date.parse(frame.raw_time))) return timeLabel(frame);
  const date = new Date(frame.raw_time);
  const time = timeFormat.format(date).replace(':00', '').replace(/\s/g, '');
  return `${dateFormat.format(date)} · ${time}`;
}

export function FloodSimulationTimeline({ frames, selectedIndex, onSelect, status, loading, hasBottomNav, fullScreen, telemetry, onRetry, onClose, context, forecastControl, playback, explorer = false }: {
  frames: ScenarioFrame[];
  selectedIndex: number | null;
  onSelect: (index: number | null) => void;
  status: string | null;
  loading: boolean;
  fullScreen: boolean;
  hasBottomNav: boolean;
  telemetry: SimulatedFloodTelemetry | null;
  onRetry: () => void;
  onClose?: () => void;
  context?: FloodOverviewContext;
  forecastControl?: FloodForecastControl;
  explorer?: boolean;
  playback?: { playing: boolean; toggle: () => void; pause: () => void; reset: () => void };
}) {
  const [localPlaying, setPlaying] = useState(false);
  const playing = playback?.playing ?? localPlaying;
  const externalPlayback = Boolean(playback);
  const [scrub, setScrub] = useState<number | null>(null);
  const [pageVisible, setPageVisible] = useState(true);
  const [desktopOverview, setDesktopOverview] = useState(true);
  const [mobileOverview, setMobileOverview] = useState(false);
  const desktop = useSyncExternalStore(subscribeDesktop, desktopSnapshot, serverSnapshot);
  const overviewId = useId();
  const overviewOpen = desktop ? desktopOverview : mobileOverview;
  const toggleOverview = () => desktop ? setDesktopOverview(value => !value) : setMobileOverview(value => !value);
  const closeOverview = () => desktop ? setDesktopOverview(false) : setMobileOverview(false);
  const playerRef = useRef<HTMLElement>(null);
  const live = !context || context.presetType === 'live';
  const latestIndex = frames.findIndex(frame => frame.live?.kind === 'latest');
  const currentIndex = latestIndex >= 0 ? latestIndex : frames.reduce((last, frame, index) => frame.is_forecast ? last : index, 0);
  const index = Math.max(0, Math.min(selectedIndex ?? currentIndex, frames.length - 1));
  const displayedIndex = scrub === null ? index : Math.min(scrub, Math.max(0, frames.length - 1));
  const displayedFrame = frames[displayedIndex];
  const forecastIndex = frames.findIndex(frame => frame.is_forecast);
  const maxIndex = Math.max(0, frames.length - 1);
  const followingLive = live && (selectedIndex === null || (explorer && index === latestIndex)) && !playing;
  const routineStatus = ['observed', 'forecast', 'corrected', 'partly corrected', 'uncorrected']
    .some(kind => status === `Estimated inundation · ${kind} rainfall`);
  const message = !routineStatus ? status : null;
  const peakIndex = useMemo(() => frames.reduce((best, frame, next) => typeof frame.inundated_km2 === 'number' && frame.inundated_km2 > (best < 0 ? 0 : frames[best].inundated_km2 ?? 0) ? next : best, -1), [frames]);
  const peakPosition = `calc(9px + (100% - 18px) * ${peakIndex / Math.max(1, maxIndex)})`;
  const liveFraction = latestIndex >= 0 ? latestIndex / Math.max(1, maxIndex) * 100 : 100;
  const track = `linear-gradient(to right, #94a3b8 ${liveFraction}%, #fbbf24 ${liveFraction}%)`;

  // Reserve the actual timeline height, including any loading/error message.
  useLayoutEffect(() => {
    const player = playerRef.current;
    const container = player?.parentElement;
    if (!player || !container) return;
    const measure = () => {
      const bottom = parseFloat(getComputedStyle(player).bottom) || 0;
      container.style.setProperty('--flood-player-clearance', `${Math.ceil(player.getBoundingClientRect().height + bottom + 12)}px`);
      container.style.setProperty('--scenario-player-height', `${Math.ceil(player.getBoundingClientRect().height)}px`);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(player);
    return () => { observer.disconnect(); container.style.removeProperty('--flood-player-clearance'); container.style.removeProperty('--scenario-player-height'); };
  }, []);

  useEffect(() => {
    const update = () => setPageVisible(document.visibilityState === 'visible');
    update();
    document.addEventListener('visibilitychange', update);
    return () => document.removeEventListener('visibilitychange', update);
  }, []);
  useEffect(() => {
    if (externalPlayback || !playing || loading || !pageVisible || frames.length < 2) return;
    const timer = setTimeout(() => onSelect((index + 1) % frames.length), 800);
    return () => clearTimeout(timer);
  }, [externalPlayback, playing, loading, pageVisible, frames.length, index, onSelect]);

  const choose = (next: number) => { if (playback) playback.pause(); else setPlaying(false); setScrub(null); onSelect(live && next === latestIndex ? null : next); };
  // Scrubbing previews the time locally; raster selection commits on release.
  const commitScrub = () => { if (scrub !== null) choose(displayedIndex); };
  const overview = <FloodSimulationOverview id={overviewId} frames={frames} index={index} telemetry={telemetry}
    mobile={!desktop} onSelect={choose} onClose={closeOverview} context={context} forecastControl={forecastControl} />;

  return <>
    <section ref={playerRef} aria-label="Flood simulation timeline" className={`pointer-events-auto absolute inset-x-3 z-[1010] md:left-1/2 md:right-auto md:-translate-x-1/2 ${explorer ? 'md:w-[min(960px,calc(100%-2rem))]' : 'md:w-[min(960px,calc(100%-380px))]'} ${hasBottomNav ? 'bottom-[calc(env(safe-area-inset-bottom,0px)+5rem)]' : 'bottom-[max(1.5rem,env(safe-area-inset-bottom,0px))]'} ${fullScreen ? 'md:bottom-5' : 'md:bottom-3'}`}>
      {!desktop && overviewOpen && overview}
      <div aria-label="Flood simulation depth legend" className="mb-1.5 flex items-center justify-center gap-1 text-[9px] font-bold md:gap-1.5">
        <span className="mr-1 hidden text-secondary md:inline">DEPTH</span>
        {(live ? SIMULATION_DEPTH_LEGEND : scenarioDepthLegend).map(band => <span key={band.key} className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md bg-panel/95 px-2 py-1 text-secondary shadow-sm"><span aria-hidden="true" className="h-2 w-2 rounded-sm" style={{ backgroundColor: band.color }} />{band.label}</span>)}
      </div>
      {message && <div role="status" className="mb-1.5 flex items-center justify-between gap-2 rounded-xl bg-panel/95 px-3 py-2 text-[10px] leading-4 text-secondary shadow-sm"><span>{message}</span>{!loading && <button type="button" onClick={() => { if (playback) playback.pause(); else setPlaying(false); onRetry(); }} className="shrink-0 font-bold text-accent-text">Retry</button>}</div>}
      <div className="flex h-[66px] items-center gap-1.5 rounded-2xl border border-default/80 bg-panel/95 px-2.5 shadow-lg backdrop-blur-md md:gap-3 md:px-3">
        <div role="group" aria-label="Playback controls" className="flex shrink-0 items-center gap-0.5">
          <button type="button" aria-label="Previous hour" title="Previous hour" disabled={frames.length < 2 || index <= 0}
            onClick={() => choose(index - 1)} className="flex h-9 w-6 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted disabled:cursor-default disabled:opacity-30 md:w-7">
            <SkipBack size={15} aria-hidden="true" />
          </button>
          <button type="button" aria-label={playing ? 'Pause simulation' : 'Play simulation'} aria-pressed={playing} disabled={frames.length < 2}
            onClick={() => { setScrub(null); if (playback) playback.toggle(); else { if (!playing && index === maxIndex) onSelect(0); setPlaying(value => !value); } }}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-on-accent disabled:opacity-30">
            {playing ? <Pause size={15} /> : <Play size={15} className="ml-0.5" />}
          </button>
          <button type="button" aria-label="Next hour" title="Next hour" disabled={frames.length < 2 || index >= maxIndex}
            onClick={() => choose(index + 1)} className="flex h-9 w-6 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted disabled:cursor-default disabled:opacity-30 md:w-7">
            <SkipForward size={15} aria-hidden="true" />
          </button>
        </div>
        <div className={`w-[66px] shrink-0 tabular-nums md:w-[78px] ${explorer ? 'hidden md:block' : ''}`}>
          <p className="whitespace-nowrap text-[11px] font-bold text-primary md:text-xs">{timeLabel(displayedFrame)}</p>
          <p className={`mt-0.5 text-[8px] text-muted-foreground ${explorer && !live ? 'hidden md:block' : ''}`}>{!live ? 'Elapsed time' : displayedFrame && Number.isFinite(Date.parse(displayedFrame.raw_time)) ? `${dateFormat.format(new Date(displayedFrame.raw_time))} · PHT` : 'Flood simulation'}</p>
        </div>
        <div className="min-w-0 flex-1">
          <div data-playback-labels className="flex justify-between gap-2 whitespace-nowrap text-[8px] font-bold leading-3 text-muted-foreground">
            <span className="min-w-0 truncate">{explorer ? <><span className="text-[10px] tabular-nums text-primary md:hidden" title={displayedFrame?.display_time}>{compactDateTimeLabel(displayedFrame)}</span><span className="hidden md:inline">{live ? 'Past' : 'Scenario playback'}</span></> : live ? 'Past' : 'Scenario playback'}</span>
            {live && forecastIndex >= 0 && <span className="shrink-0 text-warning-text">Forecast</span>}
          </div>
          <div className="relative h-8">
          <input type="range" min={0} max={maxIndex} step={1} value={displayedIndex} disabled={frames.length < 2}
            aria-label={live ? 'Select past, live, or forecast flood estimate' : 'Simulation time'} aria-valuetext={displayedFrame ? `${displayedFrame.display_time} PHT${displayedFrame.is_forecast ? ', forecast' : ''}` : 'No estimates available'}
            onChange={event => setScrub(Number(event.target.value))} onPointerUp={commitScrub} onPointerCancel={() => setScrub(null)} onKeyUp={commitScrub} onBlur={commitScrub}
            title={displayedFrame?.display_time}
            style={{ '--flood-timeline-track': track } as CSSProperties}
            className="flood-timeline-slider absolute inset-x-0 top-0 z-20 h-5 w-full disabled:cursor-default disabled:opacity-40" />
          {peakIndex >= 0 && <>
            <span aria-hidden="true" className="pointer-events-none absolute top-[5px] z-30 h-2.5 w-2.5 -translate-x-1/2 rounded-full bg-accent" style={{ left: peakPosition }} />
            <button type="button" onClick={() => choose(peakIndex)} aria-label={`Jump to peak estimate: ${frames[peakIndex].display_time}`} title={`${frames[peakIndex].display_time} · peak estimated flooded area`}
              className="absolute top-5 -translate-x-1/2 whitespace-nowrap rounded px-1 text-[8px] font-bold leading-3 text-accent-text hover:bg-accent-subtle"
              style={{ left: `clamp(14px, ${peakPosition}, calc(100% - 14px))` }}>Peak</button>
          </>}
          </div>
        </div>
        <button type="button" onClick={() => { setScrub(null); if (playback) playback.reset(); else { setPlaying(false); onSelect(live ? null : 0); } }} aria-label={live ? 'Return to live and follow updates' : 'Restart simulation'} title={live ? followingLive ? 'Following live' : 'Go live' : 'Restart simulation'} disabled={!frames.length}
          className={`flex h-8 w-7 shrink-0 items-center justify-center rounded-lg hover:bg-muted disabled:opacity-30 lg:w-auto lg:gap-1 lg:px-2 ${followingLive ? 'bg-success-bg text-success-text' : 'text-muted-foreground'}`}>
          {loading ? <Spinner size="xs" label="Loading simulation" /> : live ? <Radio size={15} /> : <RotateCcw size={15} />}
          {live && <span className="hidden text-[10px] font-bold lg:inline">Live</span>}
        </button>
        <button type="button" aria-label="Toggle flood overview" aria-expanded={overviewOpen} aria-controls={overviewId} onClick={toggleOverview} className={`flex h-8 w-7 shrink-0 items-center justify-center rounded-lg hover:bg-muted lg:w-auto lg:gap-1.5 lg:px-2 ${overviewOpen ? 'bg-muted text-primary' : 'text-muted-foreground'}`}><ChartNoAxesColumnIncreasing size={14} /><span className="hidden text-[10px] lg:inline">Overview</span></button>
        {onClose && <button type="button" aria-label="Close flood simulation" onClick={onClose} className="hidden shrink-0 p-1 text-muted-foreground hover:text-secondary md:block"><X size={12} /></button>}
      </div>
    </section>
    {desktop && overviewOpen && overview}
  </>;
}
