'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  Waves,
  Calendar,
  Clock,
  Info,
  AlertTriangle,
  ShieldCheck,
  ChevronDown,
  Check,
} from 'lucide-react';
import { SCENARIO_PRESETS, type ScenarioPreset, type ScenarioFrame } from '@/types/scenario';
import { formatFloodMetric } from '@/lib/map/liveFloodState';
import { FloodSimulationInfoModal } from '@/components/map/FloodSimulationInfoModal';

interface ScenarioSelectorProps {
  activePreset: ScenarioPreset;
  onSelectPreset: (preset: ScenarioPreset) => void;
  isLoading?: boolean;
  header?: boolean;
  rainfallMm?: number | null;
  frames?: ScenarioFrame[];
}

export const SCENARIO_GROUPS = [
  {
    type: 'live' as const,
    title: 'Live estimates · 24h',
    description: 'Observed rainfall with available forecasts.',
    badge: 'LIVE',
    badgeClass: 'bg-success-bg text-success-text border-success-border/80',
  },
  {
    type: 'historical' as const,
    title: 'Historical rainfall · 24h',
    description: 'Past storms replayed with estimated flooding.',
    badge: 'Example',
    badgeClass: 'bg-muted text-secondary border-default/80',
  },
  {
    type: 'pagasa_alert' as const,
    title: 'PAGASA rainfall thresholds · 24h',
    description: 'Hypothetical rainfall, not issued advisories.',
    badge: 'Example',
    badgeClass: 'bg-warning-bg text-warning-text border-warning-border/80',
  },
  {
    type: 'design_storm' as const,
    title: 'Design storms · 24h',
    description: 'Synthetic storms from rainfall intensity, duration and frequency (RIDF).',
    badge: 'RIDF',
    badgeClass: 'bg-info-bg text-info-text border-info-border/80',
  },
];

function getAlertBadgeClass(
  alertLevel?: 'yellow' | 'orange' | 'red',
  isTrigger: boolean = false
) {
  if (alertLevel === 'yellow') {
    return 'bg-warning-bg border-warning-border text-warning-text';
  }
  if (alertLevel === 'orange') {
    return 'bg-caution-bg border-caution-border text-caution-text';
  }
  if (alertLevel === 'red') {
    return 'bg-error-bg border-error-border text-error-text';
  }
  if (isTrigger) {
    return 'bg-muted border-default/80 text-secondary';
  }
  return 'bg-muted border-default text-secondary';
}

export function ScenarioSelector({
  activePreset,
  onSelectPreset,
  isLoading,
  header = false,
  rainfallMm,
  frames,
}: ScenarioSelectorProps) {
  const [showDetails, setShowDetails] = useState(false);
  const [showModelInfo, setShowModelInfo] = useState(false);
  const [showModelModal, setShowModelModal] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const detailsId = React.useId();
  const rainfall = rainfallMm != null ? `${Number(rainfallMm.toFixed(1))} mm` : activePreset.type === 'live' ? '—' : activePreset.totalRain;
  const peaks = useMemo(() => {
    let area: number | null = null;
    let depth: number | null = null;
    for (const frame of frames ?? []) {
      if (typeof frame.inundated_km2 === 'number' && Number.isFinite(frame.inundated_km2)) area = Math.max(area ?? 0, frame.inundated_km2);
      if (typeof frame.max_depth_m === 'number' && Number.isFinite(frame.max_depth_m)) depth = Math.max(depth ?? 0, frame.max_depth_m);
    }
    return { area, depth };
  }, [frames]);
  const eventName = header ? activePreset.name.replace(/\s*\([^)]*\)\s*$/, '') : activePreset.name;
  const categoryLabel = { live: 'Live', historical: 'Historical', design_storm: 'Design storm', pagasa_alert: 'Rainfall example' }[activePreset.type];
  const categoryClass = activePreset.type === 'live' ? 'bg-success-bg text-success-text border-success-border/40'
    : activePreset.type === 'historical' ? 'bg-info-bg text-info-text border-info-border/40'
    : activePreset.type === 'design_storm' ? 'bg-notice-bg text-notice-text border-notice-border/40'
    : getAlertBadgeClass(activePreset.alertLevel);
  const forecastHours = activePreset.type === 'live' ? (frames ?? []).reduce((hours, frame) => {
    if (!frame.is_forecast) return hours;
    const horizon = frame.forecast_horizon_hours ?? frame.live?.horizon_hours;
    return typeof horizon === 'number' && Number.isFinite(horizon) ? Math.max(hours, horizon) : hours;
  }, 0) : 0;
  const windowLabel = `24h${forecastHours > 0 ? ` + ${forecastHours}h` : ''}`;

  const closeDropdown = () => {
    setIsDropdownOpen(false);
    triggerRef.current?.focus();
  };
  const openModelInfo = () => {
    closeDropdown();
    setShowModelModal(true);
  };

  const handleOptionsKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const options = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="option"]'));
    const current = options.indexOf(document.activeElement as HTMLButtonElement);
    let next: number;
    if (event.key === 'ArrowDown') next = (current + 1) % options.length;
    else if (event.key === 'ArrowUp') next = (current - 1 + options.length) % options.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = options.length - 1;
    else return;
    event.preventDefault();
    options[next]?.focus();
  };

  // Close dropdown on outside click or Escape key
  useEffect(() => {
    if (!isDropdownOpen) return;
    dropdownRef.current?.querySelector<HTMLButtonElement>('[aria-selected="true"]')?.focus();

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsDropdownOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopImmediatePropagation();
        setIsDropdownOpen(false);
        triggerRef.current?.focus();
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown, true);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [isDropdownOpen]);

  return (
    <div className="flex flex-col gap-2 w-full text-xs leading-4 pointer-events-auto">
      {/* Dropdown Container */}
      <div className={header ? 'scenario-header-picker' : 'relative'} ref={dropdownRef}>
        <div className={header ? 'scenario-header-summary flex min-w-0 items-center' : 'hud-card flex items-center gap-1.5 px-2.5 py-1.5 md:gap-2 md:p-3'}>
          {/* Custom Dropdown Trigger Button */}
          <button
            ref={triggerRef}
            type="button"
            onClick={() => setIsDropdownOpen((prev) => !prev)}
            onKeyDown={event => {
              if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                event.preventDefault();
                setIsDropdownOpen(true);
              }
            }}
            className={`flex-1 min-w-0 flex items-center gap-2 min-h-11 text-left rounded-xl hover:bg-muted/70 active:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus group cursor-pointer ${header ? 'px-2 md:pl-2 md:pr-3' : 'p-1 -m-1'}`}
            aria-haspopup="listbox"
            aria-expanded={isDropdownOpen}
            aria-label={`Change scenario: ${activePreset.name}`}
          >
            {!header && <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-muted text-secondary shrink-0 group-hover:scale-105 transition-transform">
              <Waves className="h-3.5 w-3.5" />
            </div>}

            <div className={header ? 'min-w-0' : 'flex-1 min-w-0'}>
              {header ? <div className="hidden truncate text-[9px] font-semibold uppercase leading-4 tracking-[0.08em] text-muted-foreground md:block">Iligan City</div> : <div className="flex items-center gap-1.5 text-[10px] font-medium leading-4 text-muted-foreground md:mb-0.5 md:gap-2 md:text-xs">
                <span>Scenario</span>
                <span className={`rounded px-1 py-0 text-[10px] leading-4 md:px-1.5 md:py-0.5 md:text-xs ${getAlertBadgeClass(activePreset.alertLevel, true)}`}>{activePreset.badge}</span>
              </div>}
              <div className="flex min-w-0 items-center gap-1.5">
                <span title={activePreset.name} className={`truncate text-xs leading-5 text-primary group-hover:text-primary transition-colors ${header ? 'font-bold md:text-sm' : 'font-semibold md:whitespace-normal md:text-sm md:leading-5'}`}>{eventName}</span>
                {header && <span className={`hidden shrink-0 rounded-md border px-1.5 py-0.5 text-[9px] font-bold leading-3 md:inline-flex ${categoryClass}`}>{categoryLabel}</span>}
              </div>
              {header && <div className="flex flex-wrap items-center gap-x-1 text-[9px] font-semibold leading-3 text-muted-foreground md:hidden">
                <span className="whitespace-nowrap">{rainfall} · {windowLabel}</span>
                <span className="whitespace-nowrap">· {categoryLabel}</span>
              </div>}
            </div>

            <ChevronDown
              className={`${header ? 'h-6 w-6 rounded-lg bg-muted/70 p-1' : 'h-4 w-4'} text-muted-foreground shrink-0 transition-transform duration-200 group-hover:text-secondary ${
                isDropdownOpen ? 'rotate-180 text-secondary' : ''
              }`}
            />
          </button>

          {header && <button type="button" onClick={openModelInfo} title="About the flood model" aria-label="About the flood model" aria-haspopup="dialog" className="hidden h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus md:flex"><Info className="h-3.5 w-3.5" /></button>}

          {/* Alert Badge and Mobile Details Toggle */}
          {header ? <dl aria-label="Scenario statistics" className="scenario-header-statistics hidden shrink-0 items-center text-left md:flex">
            <div title="Total rainfall input for this scenario"><dt>Rainfall</dt><dd>{rainfall.replace(/\s*mm$/, '')}<span> mm</span></dd></div>
            <div className="hidden min-[1024px]:block" title="Largest estimated flooded area across the scenario timeline"><dt>Peak area</dt><dd>{formatFloodMetric(peaks.area, 2)}<span> km²</span></dd></div>
            <div className="hidden min-[1024px]:block" title="Maximum estimated water depth across the scenario timeline"><dt>Max. depth</dt><dd>{formatFloodMetric(peaks.depth, 2)}<span> m</span></dd></div>
            <div title={forecastHours > 0 ? `24-hour replay plus ${forecastHours} forecast hours` : '24-hour replay'}><dt>Window</dt><dd>24<span> h</span>{forecastHours > 0 && <> + {forecastHours}<span> h</span></>}</dd></div>
          </dl> : <div className="flex items-center pl-1 shrink-0">
            <button
              type="button"
              onClick={() => setShowDetails(value => !value)}
              title="Scenario details"
              aria-label="Toggle scenario details"
              aria-expanded={showDetails}
              aria-controls={detailsId}
              className="flex min-h-11 min-w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus transition-colors"
            >
              <Info className="h-3.5 w-3.5" />
            </button>
          </div>}
        </div>

        {/* Custom Popover Dropdown Menu */}
        {isDropdownOpen && (
          <>
            {/* Mobile backdrop */}
            {!header && <div
              className="fixed inset-0 z-[1290] bg-scrim/20 backdrop-blur-xs md:hidden"
              onClick={() => setIsDropdownOpen(false)}
              aria-hidden="true"
            />}

            {/* Menu Dropdown Container */}
            <div
              role="listbox"
              aria-label="Choose scenario"
              onKeyDown={handleOptionsKeyDown}
              className={`${header ? 'scenario-header-options' : 'absolute left-0 right-0 top-full mt-1.5'} z-[1300] max-h-[min(60dvh,26rem)] overflow-y-auto rounded-2xl border border-default/90 bg-panel/95 p-1 md:p-1.5 shadow-2xl map-glass backdrop-blur-xl ring-1 ring-strong/10 animate-in fade-in zoom-in-95 duration-100`}
            >
              {header && <div className="mb-1 flex items-center justify-between gap-2 border-b border-default px-3 py-2.5">
                <div><p className="text-xs font-semibold text-primary">Choose scenario</p>
                <p className="mt-0.5 text-[10px] text-muted-foreground">Iligan City · Rainfall-driven flood estimates</p></div>
                <button type="button" onClick={openModelInfo} aria-label="About the flood model" aria-haspopup="dialog" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-secondary hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus md:hidden"><Info className="h-4 w-4" /></button>
              </div>}
              {SCENARIO_GROUPS.map((group, groupIdx) => {
                const presetsInGroup = SCENARIO_PRESETS.filter(
                  (p) => p.type === group.type
                );
                if (presetsInGroup.length === 0) return null;

                return (
                  <div
                    key={group.type}
                    className={
                      groupIdx > 0 ? 'mt-1.5 pt-1.5 border-t border-default md:mt-2 md:pt-2' : ''
                    }
                  >
                    {/* Group Header */}
                    <div className="px-2 pt-1 pb-1 flex items-center justify-between">
                      <span className={header ? 'text-[9px] font-semibold uppercase tracking-wide text-muted-foreground' : 'text-[10px] font-semibold text-secondary md:text-xs'}>
                        {group.title}
                      </span>
                      <span
                        className={header ? 'text-[9px] tabular-nums text-muted-foreground' : `text-[9px] font-semibold px-1 py-0 rounded border md:px-1.5 md:py-0.5 md:text-xs ${group.badgeClass}`}
                      >
                        {header ? presetsInGroup.length : group.badge}
                      </span>
                    </div>
                    {!header && <p className="hidden px-2 pb-1 text-xs leading-4 text-secondary md:block">{group.description}</p>}

                    {/* Group Preset Options */}
                    <div className="space-y-0.5 mt-0.5">
                      {presetsInGroup.map((preset) => {
                        const isSelected = preset.id === activePreset.id;
                        return (
                          <button
                            key={preset.id}
                            type="button"
                            role="option"
                            aria-selected={isSelected}
                            onClick={() => {
                              onSelectPreset(preset);
                              closeDropdown();
                            }}
                            className={`w-full flex items-center justify-between gap-1.5 min-h-11 rounded-lg px-2 py-1 text-left md:gap-2.5 md:rounded-xl md:px-2.5 md:py-2 transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-inset group cursor-pointer ${
                              isSelected
                                ? `bg-muted/90 text-secondary ring-1 ${header ? 'ring-default' : 'ring-focus/90 shadow-xs'}`
                                : 'text-secondary hover:bg-muted/70 hover:text-primary'
                            }`}
                          >
                            <div className="flex items-center gap-1.5 min-w-0 flex-1 md:gap-2.5">
                              <div
                                className={`flex h-4 w-4 md:h-5 md:w-5 shrink-0 items-center justify-center rounded-full transition-colors ${
                                  isSelected
                                    ? 'bg-accent text-on-accent'
                                    : 'bg-muted text-muted-foreground group-hover:bg-muted group-hover:text-secondary'
                                }`}
                              >
                                {isSelected ? (
                                  <Check className="h-3 w-3 stroke-[2.5]" />
                                ) : (
                                  <Waves className="h-2.5 w-2.5" />
                                )}
                              </div>

                              <div className="min-w-0 flex-1">
                                <div
                                  title={preset.name}
                                  className={`truncate text-[11px] leading-4 md:whitespace-normal ${header ? 'md:text-xs' : 'md:text-sm'} md:leading-5 md:[text-wrap:pretty] ${
                                    header ? 'font-bold text-primary' : isSelected
                                      ? 'font-semibold text-secondary'
                                      : 'font-semibold text-primary group-hover:text-primary'
                                  }`}
                                >
                                  {preset.name}
                                </div>
                                <div className={`flex items-center gap-1 text-[10px] leading-3 text-muted-foreground mt-0.5 truncate md:gap-1.5 ${header ? 'font-medium md:text-[10px]' : 'md:text-xs'} md:leading-4`}>
                                  <span className="truncate">{preset.dates}</span>
                                  {preset.type === 'live' && <>
                                    <span>•</span>
                                    <span className="shrink-0 font-medium">Updates hourly</span>
                                  </>}
                                </div>
                              </div>
                            </div>

                            <span
                              className={header ? 'shrink-0 text-[10px] font-medium tabular-nums text-muted-foreground' : `shrink-0 rounded px-1 py-0.5 text-[10px] leading-3 font-semibold whitespace-nowrap border md:rounded-md md:px-1.5 md:text-xs md:leading-4 ${
                                preset.alertLevel
                                  ? getAlertBadgeClass(preset.alertLevel)
                                  : isSelected
                                  ? 'bg-panel border-default/80 text-secondary'
                                  : 'bg-muted border-default text-secondary'
                              }`}
                            >
                              {preset.badge}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Scenario details are available on demand at every screen size. */}
      <div
        id={detailsId}
        className={`${
          showDetails ? 'flex' : 'hidden'
        } hud-card max-h-[min(45dvh,24rem)] md:max-h-[max(2rem,calc((100dvh-var(--scenario-player-height,100px)-22rem)/2))] overflow-y-auto overscroll-contain p-3 flex-col gap-2`}
      >
        {/* Date and Time Header */}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs leading-4">
          <div className="flex items-center gap-1 font-semibold text-primary">
            <Calendar className="h-3 w-3 text-secondary shrink-0" />
            <span>{activePreset.dates}</span>
          </div>

          <span className="text-muted-foreground">•</span>

          <div className="flex items-center gap-1 font-medium text-secondary">
            <Clock className="h-3 w-3 text-secondary shrink-0" />
            <span>{activePreset.timeWindow}</span>
          </div>

          {activePreset.peakTime && (
            <span className="rounded-md bg-warning-bg px-1.5 py-0.5 text-xs font-semibold text-warning-text border border-warning-border/80">
              Peak rain: {activePreset.peakTime}
            </span>
          )}
        </div>

        {/* Event Impact Narrative */}
        <p className="text-xs text-secondary leading-4 [text-wrap:pretty] border-t border-default pt-2">
          {activePreset.description}
        </p>

        {/* Beta / Model Information or Benchmark Provenance (collapsible) */}
        {activePreset.type !== 'design_storm' ? (
          <div className="mt-0.5 rounded-lg bg-warning-bg/60 border border-warning-border/60 p-1.5 flex flex-col gap-1 transition-all">
            <button
              type="button"
              onClick={() => setShowModelInfo((prev) => !prev)}
              className="flex min-h-9 w-full items-center justify-between gap-1 rounded text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus group cursor-pointer"
              aria-expanded={showModelInfo}
            >
              <div className="flex items-center gap-1 text-xs font-semibold text-warning-text min-w-0">
                <AlertTriangle className="h-3 w-3 text-warning-text shrink-0" />
                <span className="truncate">
                  Experimental flood model
                </span>
              </div>
              <ChevronDown
                className={`h-3 w-3 text-warning-text/80 shrink-0 transition-transform duration-200 ${
                  showModelInfo ? 'rotate-180' : ''
                }`}
              />
            </button>
            {showModelInfo && (
              <p className="text-xs text-warning-text leading-4 [text-wrap:pretty] pt-1 border-t border-warning-border/50">
                {activePreset.type === 'live'
                  ? 'Independent spatial estimates from rolling 24-hour rainfall windows, using satellite observations and available forecast rainfall. The model has no previous water state and does not simulate flood arrival or drainage. Wet training cases use 110.4, 148.2 and 179.4 mm.'
                  : activePreset.type === 'pagasa_alert'
                  ? 'Hypothetical rainfall patterns with warning-color themes. These are not issued PAGASA advisories. Flood progression uses a simplified model trained on NOAH flood maps with illustrative timing, not routed river flow.'
                  : 'Historical rainfall sequences drive a simplified model trained on three NOAH flood maps. Station adjustments have not been independently verified; flood timing, discharge and exact depths are unvalidated.'}
              </p>
            )}
          </div>
        ) : (
          <div className="mt-0.5 rounded-lg bg-info-bg/60 border border-info-border/70 p-1.5 flex flex-col gap-1 transition-all">
            <button
              type="button"
              onClick={() => setShowModelInfo((prev) => !prev)}
              className="w-full flex items-center justify-between text-left gap-1 group cursor-pointer"
              aria-expanded={showModelInfo}
            >
              <div className="flex items-center gap-1 text-xs font-semibold text-info-text min-w-0">
                <ShieldCheck className="h-3 w-3 text-info-text shrink-0" />
                <span className="truncate">
                  Design storm model
                </span>
              </div>
              <ChevronDown
                className={`h-3 w-3 text-info-text/80 shrink-0 transition-transform duration-200 ${
                  showModelInfo ? 'rotate-180' : ''
                }`}
              />
            </button>
            {showModelInfo && (
              <p className="text-xs text-info-text leading-4 [text-wrap:pretty] pt-1 border-t border-info-border/50">
                RIDF means rainfall intensity, duration and frequency. These synthetic storms use a simplified model trained on NOAH flood maps, not the original water-flow simulation. Flood arrival, recession and exact depths have not been independently validated.
              </p>
            )}
          </div>
        )}
      </div>
      <FloodSimulationInfoModal isOpen={showModelModal} onClose={() => setShowModelModal(false)} />
    </div>
  );
}
