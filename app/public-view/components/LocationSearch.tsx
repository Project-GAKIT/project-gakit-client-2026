import { useCallback, useEffect, useId, useRef, useState, useSyncExternalStore, type FormEvent } from 'react';
import { Clock3, Locate, MapPin, Search, X } from 'lucide-react';
import { Spinner } from '@/components/ui/Spinner';
import { searchLocations } from '@/lib/map/geoUtils';
import type { LocationSearchResult } from '@/lib/map/geoUtils';
import { validateSearchText } from '@/lib/validation/publicInputValidation';
import { clearRecentSearches, getRecentSearches, getServerRecentSearches, saveRecentSearch, subscribeRecentSearches } from '@/lib/map/recentSearches';

export interface SearchedLocation {
  lat: number;
  lng: number;
  address: string;
}

const mobileQuery = '(max-width: 767px)';
const subscribeMobile = (onChange: () => void) => {
  const query = window.matchMedia(mobileQuery);
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
};
const isMobileViewport = () => window.matchMedia(mobileQuery).matches;
const serverViewport = () => false;

export function LocationSearch({
  onSelect,
  onLocate,
  isLocating = false,
  variant = 'standalone',
  className = '',
  placeholder = 'Search street, barangay, or landmark in Iligan City...',
}: {
  onSelect: (location: SearchedLocation) => void;
  onLocate?: () => void | Promise<void>;
  isLocating?: boolean;
  variant?: 'standalone' | 'header-compact';
  className?: string;
  placeholder?: string;
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<LocationSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [validationAttempted, setValidationAttempted] = useState(false);
  const [activeResultIndex, setActiveResultIndex] = useState(-1);
  const [isInternalLocating, setIsInternalLocating] = useState(false);
  const searchAbortRef = useRef<AbortController | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const isMobile = useSyncExternalStore(subscribeMobile, isMobileViewport, serverViewport);
  const recentSearches = useSyncExternalStore(subscribeRecentSearches, getRecentSearches, getServerRecentSearches);
  const inputId = useId();
  const resultsId = `${inputId}-results`;
  const validationError = validationAttempted ? validateSearchText(searchQuery, { minLength: 2 }) : null;

  const activeLocating = isLocating || isInternalLocating;

  const handleLocateClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!onLocate || activeLocating) return;
    setIsInternalLocating(true);
    try {
      await onLocate();
      setIsFocused(false);
    } finally {
      setIsInternalLocating(false);
    }
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsFocused(false);
        setActiveResultIndex(-1);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside, { passive: true });
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, []);

  useEffect(() => {
    return () => searchAbortRef.current?.abort();
  }, []);

  const runSearch = useCallback(async (query: string) => {
    searchAbortRef.current?.abort();
    const controller = new AbortController();
    searchAbortRef.current = controller;
    setIsSearching(true);
    setSearchError(null);
    setSearchResults([]);

    try {
      const results = await searchLocations(query, controller.signal);
      if (controller.signal.aborted) return;

      setSearchResults(results);
      if (results.length === 0) {
        setSearchError('No matching locations found within Iligan City.');
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return;
      setSearchError(
        error instanceof Error
          ? error.message
          : 'Unable to search for that location.'
      );
    } finally {
      if (searchAbortRef.current === controller) {
        setIsSearching(false);
      }
    }
  }, []);

  // Debounced auto-search: fires 300ms after typing stops so the map search
  // feels live, without hitting the geocoder on every keystroke.
  useEffect(() => {
    const query = searchQuery.trim();
    if (validateSearchText(searchQuery, { minLength: 2 })) return;
    const timer = setTimeout(() => {
      void runSearch(query);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, runSearch]);

  // Auto-dismiss validation / search errors after 3 seconds
  useEffect(() => {
    if (!searchError) return;
    const timer = setTimeout(() => {
      setSearchError(null);
    }, 3000);
    return () => clearTimeout(timer);
  }, [searchError]);

  const handleSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    setValidationAttempted(true);
    const query = searchQuery.trim();
    if (validateSearchText(searchQuery, { minLength: 2 })) {
      return;
    }

    void runSearch(query);
  };

  const handleClear = () => {
    searchAbortRef.current?.abort();
    setSearchQuery('');
    setSearchResults([]);
    setSearchError(null);
    setValidationAttempted(false);
    setActiveResultIndex(-1);
  };

  const showRecents = searchQuery.trim().length < 2 && recentSearches.length > 0;
  const suggestionCount = searchResults.length > 0 ? searchResults.length : showRecents ? recentSearches.length : 0;
  const showDropdown =
    isFocused &&
    (Boolean(onLocate) || searchResults.length > 0 || Boolean(searchError) || Boolean(validationError) || showRecents);

  const selectLocation = (location: SearchedLocation) => {
    searchAbortRef.current?.abort();
    setSearchResults([]);
    setIsFocused(false);
    setActiveResultIndex(-1);
    containerRef.current?.querySelector('input')?.blur();
    saveRecentSearch(location);
    onSelect(location);
  };

  const isCompact = variant === 'header-compact';

  return (
    <div
      ref={containerRef}
      className={
        isCompact
          ? `relative flex h-8 md:h-9 items-center rounded-full bg-muted/90 md:[background-color:var(--hud-inner-bg-desktop)] ${
              onLocate ? 'pl-3 md:pl-1.5' : 'pl-3'
            } pr-1 py-1 ring-1 ring-default/90 transition-all duration-150 focus-within:!bg-panel focus-within:ring-2 focus-within:ring-focus/50 focus-within:shadow-md ${className}`
          : `relative flex h-[52px] items-center ${
              onLocate ? 'pl-1.5' : 'pl-4'
            } pr-1.5 py-1.5 hud-pill focus-within:ring-2 focus-within:ring-focus/40 ${className}`
      }
    >
      <form onSubmit={handleSearch} className="flex h-full w-full items-center gap-1 md:gap-2">
        {onLocate ? (
          <button
            type="button"
            onClick={handleLocateClick}
            disabled={activeLocating}
            title="Locate my position (GPS)"
            aria-label={activeLocating ? 'Locating your device…' : 'Locate my position'}
            className={`flex shrink-0 items-center justify-center rounded-full text-muted-foreground hover:text-primary hover:bg-muted/80 active:scale-95 transition-all ${
              isCompact ? 'hidden h-6 w-6 md:flex md:h-7 md:w-7' : 'h-8 w-8 md:h-9 md:w-9'
            } ${activeLocating ? 'text-secondary' : ''}`}
          >
            {activeLocating ? (
              <Spinner label="Locating your position" />
            ) : (
              <Locate className="h-3.5 w-3.5 md:h-4 md:w-4" strokeWidth={2.2} />
            )}
          </button>
        ) : null}
        <input
          id={inputId}
          value={searchQuery}
          onFocus={() => setIsFocused(true)}
          onChange={(event) => {
            setSearchQuery(event.target.value);
            setSearchResults([]);
            setSearchError(null);
            setActiveResultIndex(-1);
            if (validateSearchText(event.target.value)) {
              setValidationAttempted(true);
            }
            setIsFocused(true);
          }}
          onKeyDown={event => {
            if (event.key === 'Escape' && showDropdown) {
              event.preventDefault();
              setIsFocused(false);
              setActiveResultIndex(-1);
            } else if (event.key === 'ArrowDown' && suggestionCount > 0) {
              event.preventDefault();
              setActiveResultIndex(index => (index + 1) % suggestionCount);
            } else if (event.key === 'ArrowUp' && suggestionCount > 0) {
              event.preventDefault();
              setActiveResultIndex(index => index <= 0 ? suggestionCount - 1 : index - 1);
            } else if (event.key === 'Enter' && activeResultIndex >= 0 && activeResultIndex < suggestionCount) {
              event.preventDefault();
              if (searchResults.length > 0) {
                const result = searchResults[activeResultIndex];
                selectLocation({ lat: result.lat, lng: result.lng, address: result.displayName });
              } else {
                selectLocation(recentSearches[activeResultIndex]);
              }
            }
          }}
          placeholder={isMobile && isCompact ? 'Search address or barangay' : placeholder}
          aria-label="Search for a location in Iligan City"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={showDropdown && suggestionCount > 0}
          aria-controls={showDropdown && suggestionCount > 0 ? resultsId : undefined}
          aria-activedescendant={showDropdown && activeResultIndex >= 0 && activeResultIndex < suggestionCount ? `${resultsId}-${activeResultIndex}` : undefined}
          aria-invalid={Boolean(validationError)}
          aria-describedby={validationError ? `${inputId}-error` : undefined}
          className="min-w-0 flex-1 bg-transparent py-0.5 text-left text-xs font-medium text-primary outline-none placeholder:text-muted-foreground truncate"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={handleClear}
            aria-label="Clear search"
            className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-secondary active:scale-95"
          >
            <X className="h-3 w-3" />
          </button>
        )}
        <button
          type="submit"
          disabled={isSearching}
          aria-label="Submit search"
          className={`flex shrink-0 items-center justify-center rounded-full bg-accent text-on-accent shadow-xs transition-colors hover:bg-accent-hover active:scale-95 disabled:opacity-50 ${
            isCompact ? 'h-6 w-6 md:h-7 md:w-7' : 'h-8 w-8 md:h-9 md:w-9'
          }`}
        >
          {isSearching ? (
            <Spinner size="xs" label="Searching locations" />
          ) : (
            <Search className="h-3.5 w-3.5" strokeWidth={2.5} />
          )}
        </button>
      </form>

      {showDropdown && (
        <div data-header-dropdown={isCompact || undefined} className={`z-50 overflow-hidden hud-card ${isCompact ? 'map-header-dropdown' : ''} ${
          isCompact ? 'fixed inset-x-1.5 top-[calc(max(0.375rem,env(safe-area-inset-top,0px))+3.5rem)] mx-auto max-h-[calc(100dvh-11rem-env(safe-area-inset-bottom,0px))] max-w-[380px] overflow-y-auto overscroll-contain md:absolute md:inset-x-auto md:left-1/2 md:top-full md:mt-2 md:w-96 md:max-w-none md:-translate-x-1/2 md:max-h-[70dvh]' : 'absolute left-1/2 top-full mt-2 w-full -translate-x-1/2'
        }`}>
          {validationError && (
            <p id={`${inputId}-error`} className="border-b border-default px-3.5 py-2.5 text-xs text-error-text" role="alert">
              {validationError}
            </p>
          )}

          {searchError && !validationError && (
            <p
              className="px-3.5 py-2.5 text-xs text-error-text border-b border-default"
              role="status"
            >
              {searchError}
            </p>
          )}

          {onLocate && (
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={handleLocateClick}
              disabled={activeLocating}
              className={`flex w-full items-center gap-2.5 px-3.5 ${isCompact ? 'py-2 md:py-3' : 'py-3'} text-left font-medium transition-colors hover:bg-page border-b border-default/80 group`}
            >
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-muted text-secondary group-hover:bg-muted">
                {activeLocating ? (
                  <Spinner label="Locating your position" />
                ) : (
                  <Locate className="h-4 w-4 text-secondary" strokeWidth={2.5} />
                )}
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-semibold text-primary group-hover:text-primary">
                  {activeLocating ? 'Locating your device…' : 'Use your current location'}
                </span>
                <span className="text-[11px] text-muted-foreground">
                  Share GPS position on map
                </span>
              </div>
            </button>
          )}

          {showRecents && <div>
            <div className="flex items-center justify-between px-3.5 pt-2.5 pb-1">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Recent</p>
              <button type="button" onMouseDown={event => event.preventDefault()} onClick={() => { clearRecentSearches(); setActiveResultIndex(-1); }}
                className="min-h-8 rounded-lg px-2 text-[11px] font-medium text-muted-foreground hover:bg-muted hover:text-primary" aria-label="Clear recent searches">Clear</button>
            </div>
            <div id={resultsId} role="listbox" aria-label="Recent locations" className="divide-y divide-default">
            {recentSearches.map((location, index) => <button key={`${location.lat},${location.lng}`} id={`${resultsId}-${index}`} type="button"
              role="option" aria-selected={activeResultIndex === index} tabIndex={-1}
              onMouseDown={event => event.preventDefault()} onClick={() => selectLocation(location)}
              className={`flex min-h-11 w-full items-start gap-2.5 px-3.5 py-2.5 text-left transition-colors hover:bg-page ${activeResultIndex === index ? 'bg-page' : ''}`}>
              <Clock3 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
              <span className="min-w-0"><span className="block text-xs font-semibold text-primary">{location.address.split(',')[0]}</span>
                {location.address.includes(',') && <span className="block truncate text-[11px] text-muted-foreground">{location.address.substring(location.address.indexOf(',') + 1).trim()}</span>}
              </span>
            </button>)}
            </div>
          </div>}

          {searchResults.length > 0 && (
            <div id={resultsId} role="listbox" aria-label="Location search results" className="max-h-56 divide-y divide-default overflow-y-auto">
              {searchResults.map((result, index) => (
                <button
                  id={`${resultsId}-${index}`}
                  key={`${result.lat}-${result.lng}-${result.displayName}`}
                  type="button"
                  role="option"
                  aria-selected={activeResultIndex === index}
                  tabIndex={-1}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    selectLocation({
                      lat: result.lat,
                      lng: result.lng,
                      address: result.displayName,
                    });
                  }}
                  className={`flex w-full items-start gap-2.5 px-3.5 py-2.5 text-left transition-colors hover:bg-page ${activeResultIndex === index ? 'bg-page' : ''}`}
                >
                  <MapPin className="mt-1 h-3.5 w-3.5 shrink-0 text-secondary" />
                  <div className="flex flex-col min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs font-semibold text-primary">
                        {result.displayName.split(',')[0]}
                      </span>
                      {result.category && (
                        <span className="rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-semibold text-secondary">
                          {result.category}
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-muted-foreground truncate">
                      {result.displayName.includes(',')
                        ? result.displayName.substring(result.displayName.indexOf(',') + 2)
                        : 'Iligan City'}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
          {searchResults.length > 0 && <p className="border-t border-default px-3.5 py-2 text-[11px] text-muted-foreground">
            Streets © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">OpenStreetMap contributors</a>
            {' · '}Places: <a href="https://docs.overturemaps.org/attribution/" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">Overture Maps</a>
          </p>}
        </div>
      )}
    </div>
  );
}
