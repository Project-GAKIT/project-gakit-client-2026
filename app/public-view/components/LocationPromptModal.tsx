'use client';

import Image from 'next/image';
import { useId } from 'react';
import { MapPin, Locate, X } from 'lucide-react';
import { Spinner } from '@/components/ui/Spinner';
import { Dialog } from '@/components/ui/Dialog';
import { LocationSearch, type SearchedLocation } from './LocationSearch';

export type { SelectedLocation } from '@/types/report';

export function LocationPromptModal({
  isOpen,
  onClose,
  onUseCurrentLocation,
  onChooseLocation,
  onSearchLocationSelect,
  mode = 'assessment',
  isLocating = false,
}: {
  isOpen: boolean;
  onClose: () => void;
  onUseCurrentLocation: () => void;
  onChooseLocation: () => void;
  onSearchLocationSelect: (location: SearchedLocation) => void;
  mode?: 'assessment' | 'report';
  isLocating?: boolean;
}) {
  const titleId = useId();
  const isReport = mode === 'report';

  return (
    <Dialog isOpen={isOpen} onClose={isLocating ? () => {} : onClose} ariaLabelledBy={titleId}
      maxWidthClass="max-w-md" panelClassName="overflow-hidden rounded-2xl border border-default p-0">
      <div className="bg-panel">
        <div className="flex items-center justify-between px-5 pt-4 pb-1">
          <div className="flex items-center gap-2">
            {isReport && (
              <Image
                src="/assets/report-logo.svg"
                alt="Report flooded location"
                width={32}
                height={32}
                className="h-8 w-8 shrink-0 object-contain"
              />
            )}
            <div>
              <h2 id={titleId} className="text-base font-bold text-primary font-heading">
                {isReport ? 'Report Flooded Location' : 'Select Location to Assess'}
              </h2>
              <p className="text-xs text-muted-foreground">
                {isReport
                  ? 'Choose where the flood is occurring to file a report.'
                  : 'Check geohazard risk, rainfall, and elevation.'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close location picker"
            disabled={isLocating}
            className="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-secondary transition-colors disabled:opacity-40 disabled:hover:bg-transparent"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5 pt-3 space-y-3">
          <div className={isLocating ? 'pointer-events-none opacity-50' : ''}>
            <div className="mb-2 text-xs font-semibold text-secondary">
              {isReport ? 'Search flooded area or barangay' : 'Search for an address or barangay'}
            </div>
            <LocationSearch onSelect={onSearchLocationSelect} />
          </div>

          <div className="flex items-center gap-3 py-1">
            <div className="h-px flex-1 bg-muted" />
            <span className="text-xs font-medium text-muted-foreground">
              or choose another way
            </span>
            <div className="h-px flex-1 bg-muted" />
          </div>

          <button
            onClick={onUseCurrentLocation}
            disabled={isLocating}
            aria-busy={isLocating}
            className="w-full p-4 rounded-xl border-2 border-strong bg-muted/60 text-left hover:bg-muted/70 transition-colors group disabled:cursor-wait disabled:hover:bg-muted/60"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-panel shadow-xs text-secondary">
                {isLocating ? (
                  <Spinner size="sm" />
                ) : (
                  <Locate className="w-5 h-5 text-secondary" />
                )}
              </div>
              <div>
                <div className="font-semibold text-primary text-sm">
                  {isLocating ? 'Getting your location…' : 'Use my current location'}
                </div>
                <div className="text-xs text-secondary">
                  {isReport ? 'Report flood at your GPS position.' : 'Assess hazards at your current GPS spot.'}
                </div>
              </div>
            </div>
          </button>

          <button
            onClick={onChooseLocation}
            disabled={isLocating}
            className="w-full p-4 rounded-xl border-2 border-default text-left hover:border-strong hover:bg-page transition-colors group disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-default disabled:hover:bg-transparent"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-secondary group-hover:bg-muted group-hover:text-primary transition-colors">
                <MapPin className="w-5 h-5" />
              </div>
              <div>
                <div className="font-semibold text-primary text-sm">
                  Choose on the map
                </div>
                <div className="text-xs text-secondary">
                  {isReport ? 'Tap the flooded spot manually.' : 'Tap any point on the map to evaluate risk.'}
                </div>
              </div>
            </div>
          </button>
        </div>
      </div>
    </Dialog>
  );
}
