'use client';

import { useId, type ReactNode } from 'react';
import { MapPin, X, type LucideIcon } from 'lucide-react';
import { Dialog } from '@/components/ui/Dialog';
import type { SelectedLocation } from '@/types/report';

export const LOCATION_DIALOG_PRIMARY_BUTTON = 'inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-accent px-5 py-2 text-sm font-semibold text-on-accent transition-colors hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground';
export const LOCATION_DIALOG_SECONDARY_BUTTON = 'inline-flex min-h-10 items-center justify-center rounded-lg border border-default bg-panel px-4 py-2 text-sm font-semibold text-secondary transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 disabled:opacity-50';

/** Shared presentation for the map's assessment and reporting flows. */
export function LocationDialog({ isOpen, onClose, title, subtitle, icon: Icon, closeLabel, busy = false, suspended = false, guide, tour, helpCta, children, footer }: {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle: string;
  icon: LucideIcon;
  closeLabel: string;
  busy?: boolean;
  suspended?: boolean;
  /** Compact first-run guidance rendered above the footer, outside the scroll area. */
  guide?: ReactNode;
  /** Modal-scoped guided overlay rendered above the dialog content. */
  tour?: ReactNode;
  /** Small contextual help action rendered alongside the primary footer action. */
  helpCta?: ReactNode;
  children: ReactNode;
  footer: ReactNode;
}) {
  const titleId = useId();
  const showTour = Boolean(tour);
  return <Dialog isOpen={isOpen} onClose={onClose} ariaLabelledBy={titleId} suspended={suspended}
    maxWidthClass="max-w-lg" panelClassName="relative flex max-h-[calc(100dvh-2rem)] flex-col overflow-hidden">
    <header className="flex shrink-0 items-center gap-3 border-b border-default bg-panel px-5 py-4">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-muted text-secondary">
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <h2 id={titleId} className="font-heading text-lg font-bold tracking-tight text-primary">{title}</h2>
        <p className="mt-0.5 text-xs text-secondary">{subtitle}</p>
      </div>
      <button type="button" onClick={onClose} disabled={busy} aria-label={closeLabel}
        inert={showTour || undefined}
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-secondary transition-colors hover:bg-muted hover:text-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-default disabled:opacity-50">
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
    </header>
    <div data-location-dialog-body inert={showTour || undefined}
      className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-4 py-4 selection:bg-muted selection:text-secondary sm:px-5">
      {children}
    </div>
    {guide && (
      <div inert={showTour || undefined} className="shrink-0 border-t border-warning-border bg-warning-bg/70 px-4 py-2.5 sm:px-5">
        {guide}
      </div>
    )}
    {tour}
    <footer inert={showTour || undefined} className="flex shrink-0 items-center justify-end gap-2 border-t border-default bg-page/60 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-5">
      {helpCta}
      {footer}
    </footer>
  </Dialog>;
}

export function LocationSummary({ location, address }: {
  location: Pick<SelectedLocation, 'lat' | 'lng' | 'address'> | null;
  address?: string;
}) {
  return <section data-tour="assessment-location" className="flex items-start gap-2 border-b border-default pb-3" aria-label="Selected location">
    <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-secondary" aria-hidden="true" />
    <div className="min-w-0 flex-1">
      <p className="break-words text-sm font-semibold leading-snug text-primary">{address || location?.address || 'Select a location on the map'}</p>
      {location && <p className="mt-1 text-[11px] tabular-nums text-muted-foreground">{location.lat.toFixed(5)}, {location.lng.toFixed(5)}</p>}
    </div>
  </section>;
}
