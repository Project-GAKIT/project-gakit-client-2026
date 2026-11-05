'use client';

import { useSyncExternalStore } from 'react';
import { APPEARANCE_KEY, SYSTEM_QUERY, parseAppearance, resolveAppearance, type Appearance, type ResolvedTheme } from './appearance';
import type { BasemapId } from '@/constants/publicMap';

export interface ThemeSnapshot { preference: Appearance; resolved: ResolvedTheme }
const serverSnapshot: ThemeSnapshot = { preference: 'system', resolved: 'light' };
let snapshot = serverSnapshot;
let initialized = false;
const listeners = new Set<() => void>();
const basemaps = new Map<string, BasemapId>();

function publish(preference: Appearance) {
  const resolved = resolveAppearance(preference, window.matchMedia(SYSTEM_QUERY).matches);
  // Existing hover/geometry transitions remain useful. Suppress them only for
  // the theme repaint so hundreds of color transitions cannot smear the switch.
  if (snapshot.resolved !== resolved && typeof requestAnimationFrame === 'function') {
    document.documentElement.dataset.themeChanging = '';
    requestAnimationFrame(() => requestAnimationFrame(() => { delete document.documentElement.dataset.themeChanging; }));
  }
  document.documentElement.dataset.theme = resolved;
  if (snapshot.preference === preference && snapshot.resolved === resolved) return;
  if (snapshot.resolved !== resolved) basemaps.clear();
  snapshot = { preference, resolved };
  listeners.forEach(listener => listener());
}

function readPreference(): Appearance {
  try { return parseAppearance(window.localStorage.getItem(APPEARANCE_KEY)); }
  catch { return 'system'; }
}

function initialize() {
  if (initialized || typeof window === 'undefined') return;
  initialized = true;
  publish(readPreference());
}

export const themeStore = {
  getSnapshot() { initialize(); return snapshot; },
  getServerSnapshot: () => serverSnapshot,
  subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
  setPreference(preference: Appearance) {
    initialize();
    publish(parseAppearance(preference)); // Root repaint is synchronous, including blocked storage.
    try { window.localStorage.setItem(APPEARANCE_KEY, parseAppearance(preference)); } catch { /* browser-local memory still works */ }
  },
  start() {
    initialize();
    const media = window.matchMedia(SYSTEM_QUERY);
    const systemChanged = () => { if (snapshot.preference === 'system') publish('system'); };
    const storageChanged = (event: StorageEvent) => {
      if (event.key === APPEARANCE_KEY || event.key === null) {
        // Ignore sessionStorage and unrelated storage areas without assuming
        // localStorage itself is accessible in restricted browser contexts.
        try { if (event.storageArea && event.storageArea !== window.localStorage) return; } catch { return; }
        publish(event.key === null ? 'system' : parseAppearance(event.newValue));
      }
    };
    media.addEventListener('change', systemChanged);
    window.addEventListener('storage', storageChanged);
    // A device preference can change between first render and subscription.
    systemChanged();
    return () => { media.removeEventListener('change', systemChanged); window.removeEventListener('storage', storageChanged); };
  },
};

export function useTheme() {
  return useSyncExternalStore(themeStore.subscribe, themeStore.getSnapshot, themeStore.getServerSnapshot);
}

/** Manual overrides are scoped to the map context and the resolved-theme epoch.
 * They survive route remounts, but never persist across a fresh document load. */
export function getSessionBasemap(context: string): BasemapId {
  initialize();
  return basemaps.get(context) ?? snapshot.resolved;
}
export function setSessionBasemap(context: string, basemap: BasemapId) {
  basemaps.set(context, basemap);
}
