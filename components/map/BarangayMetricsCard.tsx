'use client';

import { useState } from 'react';
import { MapPinned, X } from 'lucide-react';
import type { HoveredBarangay } from '@/hooks/useMapPopups';
import {
  BARANGAY_BANNER_COPY,
  type BarangayBannerKind,
  type BarangayStats,
} from '@/lib/map/barangayStats';
import { DEPTH_BAR_COLOR, DEPTH_LABELS } from '@/lib/reports/reportFormatting';
// Banner hues track report validation state, not water level, so they never
// collide with the reported water-depth accent.
const BANNER_STYLE: Record<BarangayBannerKind, { badge: string; label: string }> = {
  none: { badge: 'bg-muted text-secondary ring-default', label: 'text-secondary' },
  pending: { badge: 'bg-page text-secondary ring-default', label: 'text-secondary' },
  flooded: { badge: 'bg-info-bg text-info-text ring-info-border', label: 'text-info-text' },
  critical: { badge: 'bg-notice-bg text-notice-text ring-notice-border', label: 'text-notice-text' },
};

interface BarangayMetricsCardProps {
  barangay: HoveredBarangay;
  stats: BarangayStats | null;
  banner: BarangayBannerKind;
  ageLabel: string | null;
  windowLabel: string;
  onClose: () => void;
  alignToTop?: boolean;
  alignToLeft?: boolean;
}

/** Compact summary of reports within the active map filters. */
export function BarangayMetricsCard({
  barangay,
  stats,
  banner,
  ageLabel,
  windowLabel,
  onClose,
  alignToTop = false,
  alignToLeft = false,
}: BarangayMetricsCardProps) {
  const [mobileExpanded, setMobileExpanded] = useState(false);

  const header = (
    <>
      <div className="flex min-w-0 items-center gap-1.5">
        <MapPinned className="h-3 w-3 shrink-0 text-secondary" />
        <span className="truncate" title={barangay.name}>
          Barangay {barangay.name}
        </span>
      </div>
      <button
        onClick={onClose}
        className="p-1 shrink-0 rounded-md text-muted-foreground hover:bg-page hover:text-secondary transition-colors"
        aria-label={`Close ${barangay.name} metrics`}
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </>
  );

  const bannerStyle = BANNER_STYLE[banner];
  const body = (
    <>
      <div className={`mt-1 rounded-md px-2 py-1 text-[10px] font-semibold ${bannerStyle.badge}`}>
        {BARANGAY_BANNER_COPY[banner]}
      </div>

      <dl className="mt-2 grid grid-cols-[0.7fr_1.3fr] gap-2 rounded-lg bg-page px-2 py-1.5">
        <div>
          <dt className="text-[9px] font-medium text-muted-foreground">Reports</dt>
          <dd className="mt-0.5 text-base font-bold leading-5 tabular-nums text-primary">{stats?.total ?? 0}</dd>
        </div>
        <div className="border-l border-default pl-2">
          <dt className="text-[9px] font-medium text-muted-foreground">Deepest reported</dt>
          <dd className="mt-0.5 text-[11px] font-bold leading-5" style={{ color: stats?.worstDepth ? DEPTH_BAR_COLOR[stats.worstDepth] : undefined }}>
            {stats?.worstDepth ? DEPTH_LABELS[stats.worstDepth] : '—'}
          </dd>
        </div>
      </dl>

      {Boolean(stats?.total) && (
        <div className="mt-1.5 flex flex-wrap gap-x-2 gap-y-0.5 text-[10px] text-secondary">
          {Boolean(stats?.verified) && <span>{stats?.verified} verified</span>}
          {Boolean(stats?.unverified) && <span>{stats?.unverified} pending</span>}
          {Boolean(stats?.flagged) && <span>{stats?.flagged} flagged</span>}
        </div>
      )}
      <div className="mt-1.5 border-t border-default pt-1.5 text-[9px] leading-4 text-muted-foreground">
        {ageLabel && <p>Latest report {ageLabel}</p>}
        <p>Visible reports · {windowLabel}</p>
      </div>
    </>
  );

  return (
    <>
      {!mobileExpanded && (
        <button
          data-barangay-telemetry
          type="button"
          onClick={() => setMobileExpanded(true)}
          className={`hud-pill absolute top-2 ${alignToLeft ? 'left-2' : 'right-2'} z-[910] flex max-w-[180px] items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-primary hover:bg-page active:scale-95 md:hidden`}
          aria-label={`Show ${barangay.name} metrics`}
        >
          <MapPinned className="h-3.5 w-3.5 shrink-0 text-secondary" />
          <span className="truncate" title={barangay.name}>
            Barangay {barangay.name}
          </span>
        </button>
      )}

      {mobileExpanded && (
        <div
          data-barangay-telemetry
          className={`hud-card absolute top-2 ${alignToLeft ? 'left-2' : 'right-2'} z-[910] w-52 overflow-hidden md:hidden`}
          role="status"
          aria-live="polite"
        >
          <div className="flex items-center justify-between gap-3 px-2.5 pt-1.5 pb-0.5 text-[11px] font-bold text-primary">
            {header}
          </div>
          <div className="px-2 pb-2 pt-1">{body}</div>
        </div>
      )}

      <div
        data-barangay-telemetry
        className={`hud-card absolute ${alignToLeft ? 'left-2 sm:left-3 md:left-4' : 'right-2 sm:right-3 md:right-6'} w-56 overflow-hidden max-md:hidden ${alignToTop ? 'top-4' : 'top-16 sm:top-20'}`}
        role="status"
        aria-live="polite"
      >
        <div className="flex items-center justify-between gap-3 px-2.5 pt-1.5 pb-0.5 text-[11px] font-bold text-primary">
          {header}
        </div>
        <div className="px-2.5 pb-2.5 pt-0.5">{body}</div>
      </div>
    </>
  );
}
