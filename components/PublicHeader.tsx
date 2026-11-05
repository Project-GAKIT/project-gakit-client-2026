'use client';

import { useRouter } from 'next/navigation';
import { cloneElement, isValidElement, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import { ChevronLeft, Info, MapPinPlus, MapPinned } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { getDisplayName, getStaffRole, homePathForRole, type AuthSnapshot, type StaffRole } from '@/lib/auth/roles';
import { useActiveAlerts } from '@/lib/weather/weatherStore';
import { alertDescription, alertTitle } from '@/lib/weather/weatherCodes';
import { isPagasaAlert, pagasaSubtitle, shortTitle } from '@/lib/weather/pagasa';
import type { WeatherAlert } from '@/types/weather';
import { useRouteLoader } from './RouteLoader';
import { usePrefetchRoute } from '@/hooks/usePrefetchRoute';
import { SignOutConfirmDialog } from './SideBar';
import { NotificationBell } from './NotificationBell';
import type { NotificationItem } from './NotificationBell';
import { WeatherAlertModal } from './WeatherAlertModal';
import { LocationSearch, type SearchedLocation } from '@/app/public-view/components/LocationSearch';
import { HowToReportPopover } from '@/components/header/HowToReportPopover';
import { BentoMenu } from './BentoMenu';
import { getBentoTilesForRole } from '@/lib/navigation/bentoMenu';

export function PublicHeader({
  activeSection,
  initialAuth,
  onNavigateSection,
  onSearchSelect,
  onLocate,
  showBentoMenu = false,
  hideMobileAlertsAndMenu = false,
  showAlerts = true,
  guideVariant = 'map',
  showSectionNav = true,
  showBottomNav = true,
  onStartReport,
  hideReportButton = false,
  extraAction,
  onStartTour,
}: {
  activeSection?: 'hazard-map' | 'about';
  initialAuth?: AuthSnapshot;
  onNavigateSection?: (id: 'hazard-map' | 'about') => void;
  onSearchSelect?: (location: SearchedLocation) => void;
  onLocate?: () => void | Promise<void>;
  /** Starts reporting from the mobile navigation bar. */
  onStartReport?: () => void;
  hideReportButton?: boolean;
  showBottomNav?: boolean;
  /** Replays the guided map tour from the Platform Guide. */
  onStartTour?: () => void;
  /** Adds the bento portals launcher left of the bell. */
  showBentoMenu?: boolean;
  hideMobileAlertsAndMenu?: boolean;
  showAlerts?: boolean;
  guideVariant?: 'map' | 'scenarios';
  /** Hides the About button and the account pill. For pages with no About
   *  section, where the bento home row is the way back to the portal. */
  showSectionNav?: boolean;
  /** Extra action slot rendered in the actions cluster (e.g. Map Display Settings). */
  extraAction?: React.ReactNode;
}) {
  const router = useRouter();
  const { navigate, loadingOverlay } = useRouteLoader();
  const [role, setRole] = useState<StaffRole | null>(initialAuth?.role ?? null);
  const [isChecking, setIsChecking] = useState(initialAuth === undefined);
  const [name, setName] = useState<string | null>(initialAuth?.name ?? null);
  const [email, setEmail] = useState<string | null>(initialAuth?.email ?? null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isInfoOpen, setIsInfoOpen] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);
  const activeAlerts = useActiveAlerts();
  const [readAlertIds, setReadAlertIds] = useState<string[]>([]);

  const infoRef = useRef<HTMLDivElement>(null);
  const mobileInfoRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLElement>(null);
  const brandRef = useRef<HTMLDivElement>(null);
  const actionsRef = useRef<HTMLDivElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const header = headerRef.current;
    const brand = brandRef.current;
    const actions = actionsRef.current;
    const row = header?.firstElementChild as HTMLElement | null;
    if (!onSearchSelect || !header || !brand || !actions || !row) return;
    const measure = () => {
      const style = getComputedStyle(row);
      const available = row.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
      const sideWidth = Math.max(brand.getBoundingClientRect().width, actions.getBoundingClientRect().width);
      row.style.setProperty('--map-header-search-width', `${Math.max(0, Math.min(512, available - 2 * sideWidth))}px`);
    };
    const observer = new ResizeObserver(measure);
    [header, brand, actions].forEach(element => observer.observe(element));
    measure();
    return () => observer.disconnect();
  }, [onSearchSelect]);
  useEffect(() => {
    if (!isMenuOpen && !isInfoOpen) return;
    const handleClick = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node;
      if (
        infoRef.current &&
        !infoRef.current.contains(target) &&
        mobileInfoRef.current &&
        !mobileInfoRef.current.contains(target)
      ) {
        setIsInfoOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('touchstart', handleClick, { passive: true });
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || !isInfoOpen) return;
      event.stopPropagation();
      setIsInfoOpen(false);
      const visibleGuide = infoRef.current?.getBoundingClientRect().width ? infoRef.current : mobileInfoRef.current;
      visibleGuide?.querySelector('button')?.focus();
    };
    window.addEventListener('keydown', handleEscape, true);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('touchstart', handleClick);
      window.removeEventListener('keydown', handleEscape, true);
    };
  }, [isMenuOpen, isInfoOpen]);

  useEffect(() => {
    let cancelled = false;
    void Promise.resolve().then(() => {
      if (cancelled) return;
      try {
        const stored = localStorage.getItem('gakit:read-alerts');
        if (stored) setReadAlertIds(JSON.parse(stored));
      } catch {
        /* ignore malformed storage */
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const markAlertRead = useCallback((id: string) => {
    setReadAlertIds((current) => {
      if (current.includes(id)) return current;
      const next = [...current, id];
      try {
        localStorage.setItem('gakit:read-alerts', JSON.stringify(next));
      } catch {
        /* ignore quota errors */
      }
      return next;
    });
  }, []);
  const weatherNotifications = useMemo<NotificationItem[]>(
    () =>
       (activeAlerts ?? [])
        .filter((a) => a.alertType !== 'daily_digest')
        .map((a) => ({
        id: a.id,
        title: isPagasaAlert(a) ? shortTitle(a) || alertTitle(a) : alertTitle(a),
        subtitle: isPagasaAlert(a) ? pagasaSubtitle(a) : alertDescription(a),
        severity: a.severity,
        alertType: a.alertType,
        sentAt: a.createdAt,
        validFrom: a.validFrom,
        validTo: a.validTo,
        data: a.data ?? null,
        read: readAlertIds.includes(a.id),
      })),
    [activeAlerts, readAlertIds]
  );
  const [selectedAlert, setSelectedAlert] = useState<WeatherAlert | null>(null);

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();
    const hydratedFromServer = initialAuth !== undefined;

    const resolveRole = (userId: string) =>
      getStaffRole(supabase, userId).then((staffRole) => {
        if (!cancelled) {
          setRole(staffRole);
          setIsChecking(false);
        }
      });

    if (!hydratedFromServer) {
      supabase.auth.getUser().then(({ data }) => {
        if (cancelled) return;
        if (data.user) {
          if (!cancelled) {
            setEmail(data.user.email ?? null);
            setName(getDisplayName(data.user.user_metadata, data.user.email ?? null));
          }
          void resolveRole(data.user.id);
        } else {
          setRole(null);
          setIsChecking(false);
        }
      });
    }

    let sawInitialEvent = false;
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      // onAuthStateChange replays the current session as INITIAL_SESSION; when
      // the server already hydrated us, that replay is redundant work.
      if (event === 'INITIAL_SESSION') {
        sawInitialEvent = true;
        if (hydratedFromServer) return;
      } else if (!sawInitialEvent && hydratedFromServer) {
        sawInitialEvent = true;
      }
      if (cancelled) return;
      if (session?.user) {
        if (!cancelled) {
          setEmail(session.user.email ?? null);
          setName(getDisplayName(session.user.user_metadata, session.user.email ?? null));
        }
        void resolveRole(session.user.id);
      } else {
        setRole(null);
        setEmail(null);
        setName(null);
        setIsChecking(false);
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [initialAuth]);

  async function handleSignOut() {
    setIsSigningOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    setIsMenuOpen(false);
    router.push('/login');
    router.refresh();
  }

  const home = role ? homePathForRole(role) : null;
  const bentoTiles = useMemo(() => getBentoTilesForRole(role)
    .filter(tile => !showSectionNav || tile.id !== 'public-hazard-map'), [role, showSectionNav]);
  usePrefetchRoute(home ?? '/login');

  // Prefetch all portal routes during idle time for fast switching
  useEffect(() => {
    bentoTiles.forEach((tile) => {
      router.prefetch(tile.href);
    });
  }, [bentoTiles, router]);
  const requestSignOut = !isChecking && (name || email || role) ? () => {
    setIsInfoOpen(false);
    setShowSignOutConfirm(true);
  } : undefined;

  useLayoutEffect(() => {
    const header = headerRef.current;
    const toolbar = toolbarRef.current;
    const shell = header?.closest<HTMLElement>('[data-map-shell]');
    if (!header || !toolbar || !shell) return;
    const measure = () => {
      const gap = parseFloat(getComputedStyle(shell).getPropertyValue('--map-edge-gap')) || 6;
      const top = Math.ceil(header.getBoundingClientRect().bottom + gap);
      toolbar.style.top = `${top}px`;
      shell.style.setProperty('--map-header-bottom', `${Math.ceil(header.getBoundingClientRect().bottom)}px`);
      shell.style.setProperty('--map-mobile-controls-top', `${top + toolbar.offsetHeight + gap}px`);
      header.style.setProperty('--map-header-menu-gap', `${(header.getBoundingClientRect().height - 36) / 2 + 8}px`);
    };
    const observer = new ResizeObserver(measure);
    observer.observe(header);
    observer.observe(toolbar);
    window.addEventListener('resize', measure);
    measure();
    return () => { observer.disconnect(); window.removeEventListener('resize', measure); shell.style.removeProperty('--map-mobile-controls-top'); shell.style.removeProperty('--map-header-bottom'); header.style.removeProperty('--map-header-menu-gap'); };
  }, []);

  const scrollToSection = (id: 'hazard-map' | 'about') => {
    if (onNavigateSection) {
      onNavigateSection(id);
    } else {
      navigate('/');
    }
  };

  // Escape shortcut to go back when on subpages (like /flood-scenarios)
  useEffect(() => {
    if (showSectionNav) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        const activeTag = document.activeElement?.tagName.toLowerCase();
        if (activeTag === 'input' || activeTag === 'textarea' || activeTag === 'select') return;
        if (!isMenuOpen && !isInfoOpen && !showSignOutConfirm) {
          navigate('/');
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showSectionNav, isMenuOpen, isInfoOpen, showSignOutConfirm, navigate]);

  const mobileExtraAction = isValidElement<{ compact?: boolean; className?: string }>(extraAction)
    ? cloneElement(extraAction, {
        compact: true,
        className: `${extraAction.props.className ?? ''} h-8 w-12 shrink-0 rounded-full border border-default bg-panel/95 shadow-sm [&>button]:h-full [&>button]:w-full`,
      })
    : extraAction;

  return (
    <>
    <header ref={headerRef} data-map-header data-scenario-header={guideVariant === 'scenarios' || undefined} className={`fixed top-[max(0.375rem,env(safe-area-inset-top,0px))] inset-x-1.5 md:top-4 md:left-1/2 md:-translate-x-1/2 md:inset-x-auto md:w-[calc(100%-3rem)] md:max-w-7xl z-[1200] isolate rounded-full bg-panel shadow-panel border border-default/90 ring-1 ring-strong/5 md:[background-color:var(--hud-bg-desktop)] md:[backdrop-filter:blur(var(--hud-blur-desktop))] md:border-default/80 md:shadow-panel`}>
      <div className={`flex h-12 md:h-14 items-center justify-between px-2 md:px-5 ${onSearchSelect ? 'md:grid md:grid-cols-[minmax(0,1fr)_var(--map-header-search-width,0px)_minmax(0,1fr)]' : ''}`}>
        {/* Left: Brand Logo & Title */}
        <div ref={brandRef} className={`flex items-center min-w-0 md:justify-self-start md:gap-3 ${showSectionNav ? 'shrink-0 gap-2' : 'flex-1 gap-1 md:flex-none md:shrink-0'}`}>
          {!showSectionNav && (
            <button
              type="button"
              onClick={() => navigate('/')}
              aria-label="Back to Hazard Map"
              title="Back to Hazard Map"
              className="flex h-10 min-w-10 shrink-0 flex-col items-center justify-center gap-0.5 rounded-full px-1 text-[9px] font-semibold text-secondary transition-colors hover:bg-muted hover:text-primary md:h-9 md:flex-row md:gap-1.5 md:px-2.5 md:text-[11px]"
            >
              <ChevronLeft className="h-4 w-4 stroke-[2.5]" />
              <span>Back</span>
            </button>
          )}



          <button
            type="button"
            onClick={() => (showSectionNav ? scrollToSection('hazard-map') : navigate('/'))}
            className={`group shrink-0 items-center rounded-lg transition-transform duration-200 hover:scale-[1.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 ${
              !showSectionNav && guideVariant !== 'scenarios' ? 'hidden md:flex' : 'flex'
            }`}
            aria-label="Go to the GAKIT hazard map"
            title={showSectionNav ? undefined : 'Return to public map'}
          >
            <div className="relative flex h-8 w-8 items-center justify-center overflow-hidden md:h-9 md:w-auto md:overflow-visible">
              <Image
                  src="/favicon.svg"
                alt="GAKIT logo"
                  width={32}
                  height={32}
                  sizes="32px"
                priority
                  className="h-8 w-8 object-contain md:hidden"
              />
              <Image
                src="/images/gakit_logo_adobe.svg"
                alt="GAKIT logo"
                width={140}
                height={40}
                priority
                className="hidden h-8 w-auto object-contain md:block"
              />
            </div>
            <div className={`hidden h-9 pl-2 flex-col justify-center text-left font-heading text-[11px] font-bold uppercase tracking-wide leading-[14px] text-secondary ${guideVariant === 'scenarios' ? '' : 'xl:flex'}`}>
              <div>Geohazard Assessment &amp;</div>
              <div>Knowledge Integration Tool</div>
            </div>
          </button>
          {guideVariant === 'scenarios' && (
            <div className="flex min-w-0 items-center gap-1 whitespace-nowrap">
              <span className="max-w-[8rem] whitespace-normal font-heading text-[10px] font-bold uppercase leading-3 tracking-wide text-secondary md:max-w-none md:whitespace-nowrap">Flood Scenario Explorer</span>
              <sup className="relative -top-1 shrink-0 select-none rounded bg-warning-bg px-1 py-0.5 text-[8px] font-semibold leading-none text-warning-text">BETA</sup>
            </div>
          )}
        </div>

        {/* Location search or flexible spacing between brand and actions. */}
        <div className={`${!showSectionNav && !onSearchSelect ? 'hidden md:flex' : 'flex'} min-w-0 flex-1 items-center justify-center px-2`}>
          {onSearchSelect && (
            <div data-tour="search" className="w-full min-w-0 max-w-md lg:max-w-lg">
              <LocationSearch
                variant="header-compact"
                onSelect={onSearchSelect}
                onLocate={onLocate}
                className="w-full min-w-0"
              />
            </div>
          )}
        </div>

        {/* Desktop Navigation & Actions */}
        <div ref={actionsRef} className="hidden items-center justify-end gap-1.5 md:flex md:justify-self-end shrink-0">
          {/* Right cluster: info, notifications, account */}
          <div className="flex items-center gap-0 xl:gap-1 [&>button]:px-1 [&>div>button]:px-1 xl:[&>button]:px-1.5 xl:[&>div>button]:px-1.5">
            {showSectionNav && <button type="button"
              onClick={() => scrollToSection(activeSection === 'about' ? 'hazard-map' : 'about')}
              title={activeSection === 'about' ? 'Back to hazard map' : 'About GAKIT'}
              className="flex h-9 items-center justify-center gap-1.5 rounded-full px-2.5 text-[11px] font-semibold text-secondary transition-colors hover:bg-muted hover:text-primary">
              {activeSection === 'about' ? 'Map' : 'About'}
            </button>}
            {showSectionNav && <span aria-hidden="true" className="mx-1 h-4 shrink-0 border-l border-default" />}
            <HowToReportPopover
              variant={guideVariant}
              isOpen={isInfoOpen}
              onToggle={() => {
                setIsInfoOpen((open) => !open);
                setIsMenuOpen(false);
              }}
              onNavigateAbout={() => scrollToSection('about')}
              onStartTour={onStartTour}
              containerRef={infoRef}
            />
            {showAlerts && <NotificationBell
              notifications={weatherNotifications}
              onSelectAlert={setSelectedAlert}
              onMarkRead={markAlertRead}
              variant="header"
            />}
            {extraAction}
            {showBentoMenu && guideVariant !== 'scenarios' && (
              <BentoMenu
                items={bentoTiles}
                onOpenChange={setIsMenuOpen}
                onSignOut={requestSignOut}
                isSigningOut={isSigningOut}
                onNavigateSection={scrollToSection}
                activeSection={activeSection}
              />
            )}
          </div>
        </div>

        {/* Mobile top-right cluster */}
        <div className="flex shrink-0 items-center gap-0.5 sm:gap-1 md:hidden [&>button]:h-8 [&>button]:min-w-8 [&>div>button]:h-8 [&>div>button]:min-w-8">
          {activeSection === 'about' && guideVariant !== 'scenarios' && mobileExtraAction}
          {showBentoMenu && guideVariant !== 'scenarios' && !showBottomNav && !hideMobileAlertsAndMenu && (
            <BentoMenu
              items={bentoTiles}
              onOpenChange={setIsMenuOpen}
              onSignOut={requestSignOut}
              isSigningOut={isSigningOut}
              onNavigateSection={scrollToSection}
              activeSection={activeSection}
            />
          )}
          <HowToReportPopover
              variant={guideVariant}
            isOpen={isInfoOpen}
            onToggle={() => {
              setIsInfoOpen((v) => !v);
              setIsMenuOpen(false);
            }}
            onNavigateAbout={() => scrollToSection('about')}
            onStartTour={onStartTour}
            containerRef={mobileInfoRef}
          />
          {guideVariant === 'scenarios' && mobileExtraAction}
        </div>
      </div>
    </header>

    <div ref={toolbarRef} data-map-mobile-toolbar aria-label="Map toolbar"
      className={`fixed inset-x-1.5 top-[calc(max(0.375rem,env(safe-area-inset-top,0px))+3.5rem)] z-[1150] ${activeSection === 'about' || (hideMobileAlertsAndMenu && guideVariant !== 'scenarios') ? 'hidden' : 'flex'} min-h-8 items-start gap-1.5 md:hidden`}>
      <div data-map-mobile-controls-slot className="min-w-0 flex-1 empty:hidden" />
      {showAlerts && <NotificationBell notifications={weatherNotifications} onSelectAlert={setSelectedAlert}
        onMarkRead={markAlertRead} variant="toolbar" className="shrink-0" />}
      {guideVariant !== 'scenarios' && mobileExtraAction}
    </div>
    {showBottomNav && <nav aria-label="Map navigation" className="pointer-events-none fixed bottom-0 inset-x-0 z-[1200] px-1.5 pb-[max(0.375rem,env(safe-area-inset-bottom,0px))] md:hidden">
      <div className={`pointer-events-auto mx-auto grid ${hideReportButton ? 'max-w-[160px] grid-cols-2' : 'max-w-[240px] grid-cols-3'} items-center gap-1.5 rounded-full border border-default/80 bg-panel/95 p-1 shadow-lg backdrop-blur-md`}>
        <button type="button" onClick={() => scrollToSection(activeSection === 'about' ? 'hazard-map' : 'about')}
          className="flex h-10 flex-col items-center justify-center gap-0.5 rounded-full text-secondary transition-colors hover:bg-muted hover:text-primary">
          {activeSection === 'about' ? <MapPinned className="h-4 w-4" aria-hidden="true" /> : <Info className="h-4 w-4" aria-hidden="true" />}
          <span className="text-[10px] font-semibold">{activeSection === 'about' ? 'Map' : 'About'}</span>
        </button>
        {!hideReportButton && <button type="button" onClick={onStartReport} data-tour="report" aria-label="Report flooding"
          className="group relative flex h-10 items-end justify-center rounded-full text-accent-text transition-transform active:scale-95 motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus">
          <span className="absolute -top-5 left-1/2 flex h-12 w-12 -translate-x-1/2 items-center justify-center rounded-full border border-default/80 bg-panel shadow-panel transition-colors group-hover:bg-muted">
            <MapPinPlus className="h-6 w-6" strokeWidth={1.8} aria-hidden="true" />
          </span>
          <span className="whitespace-nowrap pb-0.5 text-[10px] font-semibold leading-3">Report flood</span>
        </button>}
        {showBentoMenu && <BentoMenu items={bentoTiles} variant="mobile-nav"
          onOpenChange={setIsMenuOpen} onSignOut={requestSignOut} isSigningOut={isSigningOut}
          onNavigateSection={scrollToSection} activeSection={activeSection} />}
      </div>
    </nav>}
    <SignOutConfirmDialog
      isOpen={showSignOutConfirm}
      isSigningOut={isSigningOut}
      onConfirm={handleSignOut}
      onCancel={() => setShowSignOutConfirm(false)}
    />
    {selectedAlert && (
      <WeatherAlertModal
        alert={selectedAlert}
        onClose={() => setSelectedAlert(null)}
      />
    )}
    {loadingOverlay}
    </>
  );
}
