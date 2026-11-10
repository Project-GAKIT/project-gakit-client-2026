'use client';

import { useCallback, useEffect, useId, useRef, useState, useSyncExternalStore } from 'react';
import { AlertTriangle, ChevronRight, CloudRain, Droplets, Info, MountainSnow, RefreshCw, Shield, Waves } from 'lucide-react';
import { LocationDialog, LocationSummary, LOCATION_DIALOG_PRIMARY_BUTTON } from '@/components/map/LocationDialog';
import { HazardAssessmentTour } from '@/components/onboarding/HazardAssessmentTour';
import { Dialog } from '@/components/ui/Dialog';
import { Spinner } from '@/components/ui/Spinner';
import { HeatIndexAssessment } from '@/components/HeatIndexAssessment';
import { focusOnboardingTarget } from '@/lib/onboarding/focus';
import {
  getAssessmentTourSeen,
  getServerModalGuideSeen,
  markModalGuideSeen,
  subscribeToModalGuides,
} from '@/lib/onboarding/storage';
import type { LocationRiskInfo } from '@/components/PublicMap';
import { isRawCoordinateString, reverseGeocode } from '@/lib/map/geoUtils';

interface HazardAssessmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedLocation: {
    lat: number;
    lng: number;
    address: string;
  } | null;
  onCheckLocation?: (location: {
    lat: number;
    lng: number;
  }) => Promise<LocationRiskInfo>;
  rainfallHours?: number;
  /** Server-authoritative geofence result; indicates whether location is inside Iligan City. */
  withinCity?: boolean | null;
}

const HAZARD_GUIDANCE = {
  Flood: {
    steps: [
      'Move to higher ground when water rises; follow evacuation orders.',
      'Keep away from moving floodwater, bridges, and downed power lines.',
      'Do not walk or drive through floodwater; wait for an all-clear before returning.',
    ],
    source: 'PAGASA flood safety rules',
    href: 'https://www.pagasa.dost.gov.ph/learning-tools/floods',
  },
  Landslide: {
    steps: [
      'Watch for new ground cracks, leaning trees, or unusual rumbling.',
      'Leave slopes and drainage channels if movement is suspected; alert others nearby.',
      'Stay away from the slide area and follow local evacuation instructions.',
    ],
    source: 'PHIVOLCS landslide preparedness',
    href: 'https://test-wp.phivolcs.dost.gov.ph/landslide-preparedness/',
  },
  'Storm surge': {
    steps: [
      'Move inland or to higher ground when authorities issue a storm-surge warning.',
      'Leave beaches, river mouths, and low-lying coastal areas; do not watch the waves.',
      'Follow evacuation orders and wait for officials to say it is safe to return.',
    ],
    source: 'PAGASA storm-surge guidance',
    href: 'https://www.pagasa.dost.gov.ph/information/storm-surge',
  },
} as const;

export function HazardAssessmentModal({
  isOpen,
  onClose,
  selectedLocation,
  onCheckLocation,
  rainfallHours,
  withinCity,
}: HazardAssessmentModalProps) {
  const titleId = useId();
  const [checkFailed, setCheckFailed] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [isCheckingLocation, setIsCheckingLocation] = useState(false);
  const [locationRisk, setLocationRisk] = useState<LocationRiskInfo | null>(null);
  const [resolvedLocation, setResolvedLocation] = useState<{ lat: number; lng: number; address: string } | null>(null);
  const [selectedGuidance, setSelectedGuidance] = useState<keyof typeof HAZARD_GUIDANCE | null>(null);
  const guidanceTriggerRef = useRef<HTMLButtonElement | null>(null);
  const guidanceWasOpenRef = useRef(false);
  const [tourActive, setTourActive] = useState(false);
  const [tourStepIndex, setTourStepIndex] = useState(0);
  const tourAutoStartedRef = useRef(false);
  const hazardsHeadingRef = useRef<HTMLHeadingElement>(null);
  const tourSeen = useSyncExternalStore(
    subscribeToModalGuides,
    getAssessmentTourSeen,
    getServerModalGuideSeen
  );
  const displayAddress = selectedLocation && isRawCoordinateString(selectedLocation.address)
    && resolvedLocation?.lat === selectedLocation.lat && resolvedLocation.lng === selectedLocation.lng
    ? resolvedLocation.address : selectedLocation?.address;

  useEffect(() => {
    if (selectedGuidance) {
      guidanceWasOpenRef.current = true;
      return;
    }
    if (!guidanceWasOpenRef.current) return;
    guidanceWasOpenRef.current = false;
    const firstFrame = window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => guidanceTriggerRef.current?.focus());
    });
    return () => window.cancelAnimationFrame(firstFrame);
  }, [selectedGuidance]);

  useEffect(() => {
    if (!isOpen || !selectedLocation) {
      tourAutoStartedRef.current = false;
      return;
    }
    if (tourSeen || tourAutoStartedRef.current) return;
    tourAutoStartedRef.current = true;
    setTourStepIndex(0);
    setTourActive(true);
  }, [isOpen, selectedLocation, tourSeen]);

  useEffect(() => {
    if (isOpen && selectedLocation && isRawCoordinateString(selectedLocation.address)) {
      let cancelled = false;
      void reverseGeocode(selectedLocation.lat, selectedLocation.lng).then((resolved) => {
        if (!cancelled && resolved && !isRawCoordinateString(resolved)) {
          setResolvedLocation({ ...selectedLocation, address: resolved });
        }
      });
      return () => {
        cancelled = true;
      };
    }
  }, [isOpen, selectedLocation]);

  useEffect(() => {
    if (!isOpen || !selectedLocation || !onCheckLocation) {
      return;
    }

    let cancelled = false;
    void (async () => {
      setIsCheckingLocation(true);
      setLocationRisk(null);
      setCheckFailed(false);
      try {
        const risk = await onCheckLocation(selectedLocation);
        if (!cancelled) setLocationRisk(risk);
      } catch {
        if (!cancelled) {
          setCheckFailed(true);
        }
      } finally {
        if (!cancelled) setIsCheckingLocation(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isOpen, selectedLocation, rainfallHours, onCheckLocation, retryCount]);

  const handleTourEnd = useCallback(() => {
    markModalGuideSeen('assessmentTour');
    setTourActive(false);
    setTourStepIndex(0);
    window.requestAnimationFrame(() => focusOnboardingTarget(hazardsHeadingRef.current));
  }, []);

  const startTour = useCallback(() => {
    setTourStepIndex(0);
    setTourActive(true);
  }, []);

  const handleClose = useCallback(() => {
    if (tourActive) {
      markModalGuideSeen('assessmentTour');
      setTourActive(false);
      setTourStepIndex(0);
    }
    setSelectedGuidance(null);
    onClose();
  }, [onClose, tourActive]);

  const hazards = [
    { name: 'Flood', icon: Droplets, level: locationRisk?.floodHazard, detail: 'Mapped flood susceptibility', color: 'bg-info-bg text-info-text' },
    { name: 'Landslide', icon: MountainSnow, level: locationRisk?.landslide, detail: 'Mapped slope susceptibility', color: 'bg-warning-bg text-warning-text' },
    { name: 'Storm surge', icon: Waves, level: locationRisk?.stormSurge?.level,
      detail: locationRisk?.stormSurge ? `SSA #${locationRisk.stormSurge.advisory} map scenario` : 'Coastal inundation scenario', color: 'bg-info-bg text-info-text' },
  ];
  const levelStyles = {
    high: { label: 'High', classes: 'border-error-border bg-error-bg text-error-text', dots: 3 },
    medium: { label: 'Medium', classes: 'border-caution-border bg-caution-bg text-caution-text', dots: 2 },
    low: { label: 'Low', classes: 'border-warning-border bg-warning-bg text-warning-text', dots: 1 },
  };
  const hasResult = Boolean(locationRisk) && !checkFailed;
  const rainfallPeriod = rainfallHours && rainfallHours > 1 ? rainfallHours : 1;
  const rainfall = locationRisk?.precipMm;
  const hasRainfall = hasResult && rainfall != null && Number.isFinite(rainfall) && rainfall >= 0;

  return (
    <>
    <LocationDialog isOpen={isOpen} onClose={handleClose} title="Hazard assessment" suspended={Boolean(selectedGuidance)}
      subtitle="Mapped hazards & weather outlook" icon={Shield} closeLabel="Close hazard assessment"
      tour={tourActive ? (
        <HazardAssessmentTour
          isActive
          stepIndex={tourStepIndex}
          onStepChange={setTourStepIndex}
          onClose={handleTourEnd}
          onFinish={handleTourEnd}
        />
      ) : undefined}
      helpCta={
        selectedLocation ? (
          <button type="button" onClick={startTour} className="rounded px-2 py-1 text-[11px] font-semibold text-muted-foreground underline-offset-2 transition-colors hover:text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2">
            Need a help?
          </button>
        ) : undefined
      }
      footer={<button type="button" onClick={handleClose} className={LOCATION_DIALOG_PRIMARY_BUTTON}>Back to map</button>}>
      <LocationSummary location={selectedLocation} address={displayAddress} />

      {withinCity === false && (
        <div className="flex items-start gap-2 rounded-lg bg-warning-bg px-3 py-2.5 text-xs leading-relaxed text-warning-text">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <p><span className="font-semibold">Outside Iligan City.</span> Results are available only where map data provides coverage.</p>
        </div>
      )}

      {selectedLocation && <>
        <section data-tour="assessment-hazards" aria-labelledby={`${titleId}-hazards`} aria-busy={isCheckingLocation}>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
            <h3 ref={hazardsHeadingRef} id={`${titleId}-hazards`} tabIndex={-1}
              className="rounded text-sm font-semibold text-primary outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2">
              Mapped hazards
            </h3>
            <div className="flex shrink-0 items-center gap-2">
              {isCheckingLocation && <span role="status" className="flex items-center gap-1.5 text-xs text-muted-foreground"><Spinner size="xs" />Checking…</span>}
            </div>
          </div>
          <div className="divide-y divide-default">
            {hazards.map(({ name, icon: Icon, level, detail, color }) => {
              const meta = level ? levelStyles[level] : null;
              return <button key={name} type="button" onClick={event => {
                guidanceTriggerRef.current = event.currentTarget;
                setSelectedGuidance(name as keyof typeof HAZARD_GUIDANCE);
              }}
                aria-label={`${name}: ${isCheckingLocation ? 'Checking' : meta && hasResult ? meta.label : hasResult ? 'None mapped' : 'Unavailable'}. What to do`}
                className="group flex w-full items-center justify-between gap-2 rounded-lg py-2 text-left transition-colors hover:bg-page focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2">
                <span className="flex min-w-0 items-center gap-2.5">
                  <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${color}`}><Icon className="h-4 w-4" aria-hidden="true" /></span>
                  <span className="min-w-0"><span className="block text-sm font-semibold text-primary">{name}</span><span className="mt-0.5 block text-[11px] leading-snug text-muted-foreground">{detail}</span></span>
                </span>
                <span className="flex shrink-0 items-center gap-1.5">
                  {isCheckingLocation ? <span className="h-6 w-20 animate-pulse rounded-full bg-muted motion-reduce:animate-none" aria-hidden="true" />
                  : meta && hasResult ? <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-1 text-xs font-semibold ${meta.classes}`}>
                    <span className="flex gap-0.5" aria-hidden="true">{[1, 2, 3].map(dot => <span key={dot} className={`h-1 w-1 rounded-full bg-current ${dot > meta.dots ? 'opacity-20' : ''}`} />)}</span>{meta.label}
                  </span>
                  : <span className="shrink-0 text-[11px] font-medium text-muted-foreground">{hasResult ? 'None mapped' : 'Unavailable'}</span>}
                  <span className="hidden items-center gap-0.5 text-[10px] font-semibold text-secondary sm:inline-flex">What to do<ChevronRight className="h-3.5 w-3.5" aria-hidden="true" /></span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground sm:hidden" aria-hidden="true" />
                </span>
              </button>;
            })}
          </div>
        </section>

        <section data-tour="assessment-weather" aria-labelledby={`${titleId}-weather`}>
          <h3 id={`${titleId}-weather`} className="mb-2 text-sm font-semibold text-primary">Weather outlook</h3>
          <div className="grid grid-cols-2 overflow-hidden rounded-xl">
            <section className="min-w-0 bg-info-bg p-3" aria-label="Rainfall">
              <div className="mb-2 flex items-center gap-2 text-info-text">
                <CloudRain className="h-4 w-4 shrink-0" aria-hidden="true" />
                <h3 className="text-sm font-semibold">Rainfall</h3>
              </div>
              {isCheckingLocation ? <div className="flex h-9 items-center"><Spinner size="sm" /></div> : hasRainfall
                ? <p className="text-2xl font-bold tabular-nums tracking-tight text-info-text">{rainfall.toFixed(1)} <span className="text-xs font-medium text-info-text">{rainfallPeriod === 1 ? 'mm/hr' : 'mm'}</span></p>
                : <p className="flex h-9 items-center text-sm font-medium text-info-text">Unavailable</p>}
              <p className="mt-1 text-xs text-info-text">{rainfallPeriod === 1 ? '1-hour rate' : `${rainfallPeriod}-hour total`}</p>
            </section>
            {isOpen && <HeatIndexAssessment key={`${selectedLocation.lat},${selectedLocation.lng}`} lat={selectedLocation.lat} lng={selectedLocation.lng} />}
          </div>
        </section>

        {checkFailed && <div role="alert" className="flex items-center justify-between gap-3 rounded-lg bg-warning-bg px-3 py-2.5 text-xs text-warning-text">
          <p>Unable to load the assessment.</p>
          <button type="button" onClick={() => setRetryCount(count => count + 1)} className="inline-flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1 font-semibold hover:bg-warning-bg"><RefreshCw className="h-3.5 w-3.5" />Retry</button>
        </div>}
        {!checkFailed && (
          <div className="flex items-start gap-2 text-[11px] leading-relaxed text-muted-foreground">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <p>Hazard maps show susceptibility, not current conditions. <strong className="font-semibold text-secondary">“None mapped” does not guarantee safety.</strong> Follow official advisories for current warnings.</p>
          </div>
        )}
      </>}
    </LocationDialog>
    {isOpen && selectedGuidance && <Dialog isOpen onClose={() => setSelectedGuidance(null)} ariaLabelledBy={`${titleId}-guidance-title`}
      maxWidthClass="max-w-md" panelClassName="max-h-[calc(100dvh-2rem)] overflow-y-auto p-5 sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{selectedGuidance} preparedness</p>
          <h2 id={`${titleId}-guidance-title`} className="mt-1 font-heading text-xl font-bold text-primary">What to do</h2>
        </div>
        <button type="button" onClick={() => setSelectedGuidance(null)} aria-label="Close precaution guidance"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-secondary hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus">
          <span aria-hidden="true">×</span>
        </button>
      </div>
      <ol className="mt-4 list-decimal space-y-2.5 pl-5 text-sm leading-6 text-secondary">
        {HAZARD_GUIDANCE[selectedGuidance].steps.map(step => <li key={step}>{step}</li>)}
      </ol>
      <p className="mt-4 rounded-lg bg-warning-bg px-3 py-2.5 text-xs leading-5 text-warning-text">
        These precautions apply regardless of the mapped result. Susceptibility maps are not live warnings; follow current official advisories and local instructions.
      </p>
      <a href={HAZARD_GUIDANCE[selectedGuidance].href} target="_blank" rel="noopener noreferrer"
        className="mt-4 inline-flex min-h-10 items-center rounded-lg px-2 text-sm font-semibold text-secondary underline underline-offset-2 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus">
        {HAZARD_GUIDANCE[selectedGuidance].source}
      </a>
    </Dialog>}
    </>
  );
}
