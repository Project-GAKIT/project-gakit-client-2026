'use client';

import { DisplayPopover } from './DisplayPopover';
import { BASEMAP_LABELS, type BasemapId } from '@/constants/publicMap';

export interface MapDisplaySettings { basemap: BasemapId; mode: '2d' | '3d'; showBuildings: boolean; smoothPolygons?: boolean; showRoads?: boolean; focusRoads?: boolean; showParBoundary?: boolean }

// Static thumbnails captured from the real basemaps (scripts/generate-basemap-previews.cjs)
// around Iligan City. They are only fetched when this popover opens and cost
// nothing on page load — no extra map instances or tile requests.
const BASEMAP_PREVIEWS: Array<{ value: BasemapId; src: string }> = [
  { value: 'light', src: '/images/basemap-previews/light.webp' },
  { value: 'bright', src: '/images/basemap-previews/bright.webp' },
  { value: 'dark', src: '/images/basemap-previews/dark.webp' },
  { value: 'satellite', src: '/images/basemap-previews/satellite.webp' },
];

type DisplaySetting = { label: string; description: string; checked: boolean; change: (checked: boolean) => void };

function DisplaySettingRow({ label, description, checked, change }: DisplaySetting) {
  return (
    <div className="flex items-center justify-between gap-3 border-t border-default pt-2">
      <div>
        <p className="text-xs font-semibold leading-4">{label}</p>
        <p className="text-[10px] leading-3.5 text-muted-foreground">{description}</p>
      </div>
      <button type="button" role="switch" aria-label={label} aria-checked={checked} onClick={() => change(!checked)}
        className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full ring-1 ring-inset transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 ${checked ? 'bg-accent ring-accent' : 'bg-switch-off ring-switch-edge'}`}>
        <span className={`h-4 w-4 rounded-full bg-on-accent shadow-sm transition-transform ${checked ? 'translate-x-[18px]' : 'translate-x-0.5'}`} />
      </button>
    </div>
  );
}

export function MapDisplayPopover({ basemap, mode, showBuildings, onBasemapChange, onModeChange, onBuildingsChange, smoothPolygons = true, onSmoothingChange, showBarangayBoundaries = false, onBarangayBoundariesChange, showRoads = false, onRoadsChange, focusRoads = false, onFocusRoadsChange, showParBoundary = true, onParBoundaryChange, disabled = false, className = '', placement = 'below', compact = false, align = 'end', mobileLabel = false, showAppearance = true }: MapDisplaySettings & {
  onParBoundaryChange?: (visible: boolean) => void;
  onBasemapChange: (basemap: BasemapId) => void;
  onModeChange: (mode: '2d' | '3d') => void;
  onBuildingsChange: (visible: boolean) => void;
  onSmoothingChange?: (smooth: boolean) => void;
  showBarangayBoundaries?: boolean;
  onBarangayBoundariesChange?: (visible: boolean) => void;
  showRoads?: boolean;
  onRoadsChange?: (visible: boolean) => void;
  onFocusRoadsChange?: (enabled: boolean) => void;
  disabled?: boolean;
  className?: string;
  placement?: 'above' | 'below';
  align?: 'start' | 'end';
  compact?: boolean;
  mobileLabel?: boolean;
  showAppearance?: boolean;
}) {
  return (
    <DisplayPopover className={className} placement={placement} compact={compact} align={align} mobileLabel={mobileLabel} showAppearance={showAppearance}>
          <fieldset disabled={disabled} className="space-y-2 disabled:opacity-50">
            <legend className="mb-2 text-sm font-semibold text-primary">Map</legend>
            <div>
              <div className="grid grid-cols-4 gap-1.5">
                {BASEMAP_PREVIEWS.map(({ value, src }) => (
                  <button key={value} type="button" aria-pressed={basemap === value} onClick={() => onBasemapChange(value)}
                    className={`group min-w-0 overflow-hidden rounded-md border text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-1 ${basemap === value ? 'border-strong shadow-sm ring-1 ring-focus' : 'border-default hover:border-default'}`}>
                    {/* Decorative: the label below already names the button. */}
                    {/* eslint-disable-next-line @next/next/no-img-element -- tiny static WebP served directly; no optimizer roundtrip needed */}
                    <img src={src} alt="" width={256} height={160} loading="lazy" decoding="async"
                      className="block aspect-[3/2] w-full object-cover" />
                    <span className={`block truncate px-0.5 py-1 text-center text-[9px] font-semibold leading-3 ${basemap === value ? 'text-secondary' : 'text-muted-foreground group-hover:text-primary'}`}>{BASEMAP_LABELS[value]}</span>
                  </button>
                ))}
              </div>
            </div>
            {[
              ...(onParBoundaryChange ? [{ label: 'PAR outline', description: 'Show the Philippine Area of Responsibility boundary', checked: showParBoundary, change: onParBoundaryChange }] : []),
              { label: '3D view', description: 'Tilt the map and show terrain relief', checked: mode === '3d', change: (checked: boolean) => onModeChange(checked ? '3d' : '2d') },
              ...(onSmoothingChange ? [{ label: 'Polygon smoothing', description: 'Round hazard edges and blend simulation colors; visual only', checked: smoothPolygons, change: onSmoothingChange }] : []),
              { label: 'Buildings', description: 'Show building footprints or 3D structures', checked: showBuildings, change: onBuildingsChange },
              ...(onRoadsChange || onFocusRoadsChange ? [{
                label: 'Roads',
                description: 'Highlight roads and show flood colors along them; hover for names and depths',
                checked: showRoads || focusRoads,
                change: (enabled: boolean) => {
                  onRoadsChange?.(enabled);
                  onFocusRoadsChange?.(enabled);
                },
              }] : []),
              ...(onBarangayBoundariesChange ? [{ label: 'Barangay boundaries', description: 'Show barangay borders and report summaries', checked: showBarangayBoundaries, change: onBarangayBoundariesChange }] : []),
            ].map(setting => <DisplaySettingRow key={setting.label} {...setting} />)}
          </fieldset>
          {disabled && <p className="mt-2 text-[10px] text-muted-foreground">Loading map…</p>}
    </DisplayPopover>
  );
}
