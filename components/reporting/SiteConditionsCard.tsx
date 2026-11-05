'use client';

import {
  AlertTriangle,
  CloudRain,
  Droplets,
  MountainSnow,
  Waves,
} from 'lucide-react';
import { Spinner } from '@/components/ui/Spinner';
import type { LocationRiskInfo } from '@/components/PublicMap';
import type { HazardLevel } from '@/lib/map/geohazardQuery';

const HAZARD_META: Record<
  'high' | 'medium' | 'low' | 'none',
  { label: string; color: string; bg: string; dot: string }
> = {
  high: {
    label: 'High Hazard',
    color: 'text-error-text',
    bg: 'bg-error-bg border-error-border',
    dot: 'bg-rose-600',
  },
  medium: {
    label: 'Medium Hazard',
    color: 'text-caution-text',
    bg: 'bg-caution-bg border-caution-border',
    dot: 'bg-orange-500',
  },
  low: {
    label: 'Low Hazard',
    color: 'text-warning-text',
    bg: 'bg-warning-bg border-warning-border',
    dot: 'bg-amber-500',
  },
  none: {
    label: 'None Mapped',
    color: 'text-secondary',
    bg: 'bg-muted border-default',
    dot: 'bg-hover',
  },
};

const hazardMeta = (level: HazardLevel | null) => HAZARD_META[level ?? 'none'];

function HazardBadge({ level, badge }: { level: HazardLevel | null; badge?: string }) {
  const meta = hazardMeta(level);
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${meta.bg} ${meta.color} whitespace-nowrap`}
    >
      <span className={`inline-block h-2 w-2 rounded-full shrink-0 ${meta.dot}`} aria-hidden />
      <span className="font-bold">{meta.label}</span>
      {badge && <span className="font-medium opacity-75">· {badge}</span>}
    </span>
  );
}

interface SiteConditionsCardProps {
  locationRisk: LocationRiskInfo | null;
  isCheckingLocation: boolean;
  rainfallHours?: number;
}

export function SiteConditionsCard({
  locationRisk,
  isCheckingLocation,
  rainfallHours,
}: SiteConditionsCardProps) {
  const stormSurge = locationRisk?.stormSurge;
  const precipMm = locationRisk?.precipMm;

  const rainfallLabel =
    rainfallHours === 1 || !rainfallHours
      ? 'Rainfall (1-Hour Rate)'
      : `Rainfall (${rainfallHours}-Hour Total)`;

  const rainfallUnit = rainfallHours === 1 || !rainfallHours ? 'mm/hr' : 'mm';

  return (
    <div className="flex flex-col gap-2.5">
      {/* Header */}
      <div className="flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-0.5">
        <AlertTriangle className="w-3.5 h-3.5 text-secondary" />
        <span>Site Conditions</span>
      </div>

      {/* 1. Dynamic Rainfall Weather Bar */}
      <div className="flex items-center justify-between rounded-xl border border-default bg-panel p-3 shadow-2xs">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-info-bg text-info-text border border-info-border shrink-0">
            <CloudRain className="h-4 w-4" />
          </div>
          <span className="text-xs font-bold text-primary">
            {rainfallLabel}
          </span>
        </div>

        <div className="text-right">
          {isCheckingLocation ? (
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
              <Spinner size="xs" />
              <span>Checking…</span>
            </span>
          ) : (
            <div className="flex items-baseline gap-1">
              <span className="text-base font-black tracking-tight text-primary font-mono">
                {precipMm != null ? precipMm.toFixed(1) : '0.0'}
              </span>
              <span className="text-xs font-semibold text-muted-foreground">
                {rainfallUnit}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* 2. Geohazard Susceptibility Card (Flood, Landslide, Storm Surge) */}
      <div className="rounded-xl border border-default bg-panel p-3 shadow-2xs">
        <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider border-b border-default pb-2 mb-1">
          Geohazard Susceptibility
        </div>

        <div className="divide-y divide-default">
          {/* Flood */}
          <div className="flex items-center justify-between py-2">
            <div className="flex items-center gap-2.5">
              <div className="flex h-6 w-6 items-center justify-center rounded-md bg-info-bg text-info-text border border-info-border shrink-0">
                <Droplets className="h-3.5 w-3.5" />
              </div>
              <span className="text-xs font-bold text-primary">Flood</span>
            </div>
            {isCheckingLocation ? (
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
                <Spinner size="xs" />
              </span>
            ) : (
              <HazardBadge level={locationRisk?.floodHazard ?? null} />
            )}
          </div>

          {/* Landslide */}
          <div className="flex items-center justify-between py-2">
            <div className="flex items-center gap-2.5">
              <div className="flex h-6 w-6 items-center justify-center rounded-md bg-warning-bg text-warning-text border border-warning-border shrink-0">
                <MountainSnow className="h-3.5 w-3.5" />
              </div>
              <span className="text-xs font-bold text-primary">Landslide</span>
            </div>
            {isCheckingLocation ? (
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
                <Spinner size="xs" />
              </span>
            ) : (
              <HazardBadge level={locationRisk?.landslide ?? null} />
            )}
          </div>

          {/* Storm Surge */}
          <div className="flex items-center justify-between py-2">
            <div className="flex items-center gap-2.5">
              <div className="flex h-6 w-6 items-center justify-center rounded-md bg-info-bg text-info-text border border-info-border shrink-0">
                <Waves className="h-3.5 w-3.5" />
              </div>
              <span className="text-xs font-bold text-primary">Storm Surge</span>
            </div>
            {isCheckingLocation ? (
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
                <Spinner size="xs" />
              </span>
            ) : (
              <HazardBadge
                level={stormSurge?.level ?? null}
                badge={stormSurge?.advisory ? `SSA #${stormSurge.advisory}` : undefined}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}