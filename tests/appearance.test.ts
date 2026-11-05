import { afterEach, describe, expect, it, vi } from 'vitest';
import { runInNewContext } from 'node:vm';
import { APPEARANCE_KEY, appearanceBootstrap, parseAppearance, resolveAppearance } from '@/lib/theme/appearance';

afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });

function browser(saved: string | null = null, dark = false, blocked = false) {
  const values = new Map<string, string>();
  if (saved !== null) values.set(APPEARANCE_KEY, saved);
  const storage = {
    getItem: (key: string) => { if (blocked) throw new Error('blocked'); return values.get(key) ?? null; },
    setItem: (key: string, value: string) => { if (blocked) throw new Error('blocked'); values.set(key, value); },
  };
  const media = Object.assign(new EventTarget(), { matches: dark });
  const win = Object.assign(new EventTarget(), { localStorage: storage, matchMedia: (query: string) => query.includes('prefers-color-scheme') ? media : { matches: false } });
  const doc = { documentElement: { dataset: {} as Record<string, string> } };
  vi.stubGlobal('window', win);
  vi.stubGlobal('document', doc);
  return {
    doc, media, storage,
    system(value: boolean) { media.matches = value; media.dispatchEvent(new Event('change')); },
    tab(value: string | null, key: string | null = APPEARANCE_KEY) {
      win.dispatchEvent(Object.assign(new Event('storage'), { key, newValue: value, storageArea: storage }));
    },
  };
}

describe('appearance resolution and pre-paint bootstrap', () => {
  for (const saved of [null, 'light', 'dark', 'system', 'invalid', '{"theme":"dark"}']) {
    for (const systemDark of [false, true]) {
      it(`aligns bootstrap/runtime for ${saved}, system dark=${systemDark}`, () => {
        const root = { dataset: {} as Record<string, string> };
        runInNewContext(appearanceBootstrap, {
          document: { documentElement: root }, localStorage: { getItem: () => saved }, matchMedia: () => ({ matches: systemDark }),
        });
        expect(root.dataset.theme).toBe(resolveAppearance(parseAppearance(saved), systemDark));
      });
    }
  }
  it('bootstraps with device appearance when storage is blocked', () => {
    const root = { dataset: {} as Record<string, string> };
    runInNewContext(appearanceBootstrap, { document: { documentElement: root }, localStorage: { getItem: () => { throw new Error('blocked'); } }, matchMedia: () => ({ matches: true }) });
    expect(root.dataset.theme).toBe('dark');
  });
});

describe('browser-local appearance lifecycle', () => {
  it('updates the root before notifying and persists only the preference', async () => {
    const env = browser();
    const { themeStore } = await import('@/lib/theme/store');
    const stop = themeStore.start();
    const listener = vi.fn(() => expect(env.doc.documentElement.dataset.theme).toBe('dark'));
    const unsubscribe = themeStore.subscribe(listener);
    themeStore.setPreference('dark');
    expect(listener).toHaveBeenCalledOnce();
    expect(env.storage.getItem(APPEARANCE_KEY)).toBe('dark');
    expect(themeStore.getSnapshot()).toEqual({ preference: 'dark', resolved: 'dark' });
    unsubscribe(); stop();
  });
  it('reacts to device changes only in System, including after reset', async () => {
    const env = browser(null, true);
    const { themeStore } = await import('@/lib/theme/store');
    const stop = themeStore.start();
    expect(themeStore.getSnapshot().resolved).toBe('dark');
    themeStore.setPreference('light');
    env.system(false); env.system(true);
    expect(themeStore.getSnapshot().resolved).toBe('light');
    themeStore.setPreference('system');
    expect(themeStore.getSnapshot().resolved).toBe('dark');
    env.system(false);
    expect(themeStore.getSnapshot().resolved).toBe('light');
    stop(); env.system(true);
    expect(themeStore.getSnapshot().resolved).toBe('light');
  });
  it('accepts cross-tab changes and resets invalid, removed, and cleared storage to System', async () => {
    const env = browser('light', true);
    const { themeStore } = await import('@/lib/theme/store');
    const stop = themeStore.start();
    env.tab('dark');
    expect(themeStore.getSnapshot().preference).toBe('dark');
    env.tab('nonsense');
    expect(themeStore.getSnapshot()).toEqual({ preference: 'system', resolved: 'dark' });
    env.tab('light'); env.tab(null);
    expect(themeStore.getSnapshot().preference).toBe('system');
    env.tab('light'); env.tab(null, null);
    expect(themeStore.getSnapshot().preference).toBe('system');
    env.tab('light', 'unrelated');
    expect(themeStore.getSnapshot().preference).toBe('system');
    stop();
  });
  it('keeps in-memory selections when reads and writes throw', async () => {
    const env = browser(null, false, true);
    const { themeStore } = await import('@/lib/theme/store');
    const stop = themeStore.start();
    expect(() => themeStore.setPreference('dark')).not.toThrow();
    expect(env.doc.documentElement.dataset.theme).toBe('dark');
    expect(themeStore.getSnapshot().preference).toBe('dark');
    stop();
  });
  it('retains per-context manual styles across remounts and same-resolved choices, then replaces them on the next resolved change', async () => {
    const env = browser('dark', true);
    const { themeStore, getSessionBasemap, setSessionBasemap } = await import('@/lib/theme/store');
    const stop = themeStore.start();
    expect(getSessionBasemap('public')).toBe('dark');
    setSessionBasemap('public', 'satellite'); setSessionBasemap('reports', 'bright');
    themeStore.setPreference('system');
    expect(getSessionBasemap('public')).toBe('satellite');
    expect(getSessionBasemap('reports')).toBe('bright');
    expect(getSessionBasemap('scenario')).toBe('dark');
    env.system(false);
    expect(getSessionBasemap('public')).toBe('light');
    expect(getSessionBasemap('reports')).toBe('light');
    stop();
  });
  it('gives appearance precedence over stored scenario basemaps without resetting geometry or layers', async () => {
    const env = browser('dark', true);
    env.storage.setItem('gakit.scenario-display', JSON.stringify({ basemap: 'bright', mode: '3d', enableRoads: true, renderMode: 'nearest' }));
    const { themeStore } = await import('@/lib/theme/store');
    const { scenarioDisplayStore } = await import('@/lib/map/scenarioDisplayStore');
    const stop = themeStore.start();
    scenarioDisplayStore.hydrate();
    expect(scenarioDisplayStore.getSnapshot()).toMatchObject({ basemap: 'dark', mode: '3d', enableRoads: true, renderMode: 'nearest' });
    scenarioDisplayStore.setBasemap('satellite');
    scenarioDisplayStore.hydrate();
    expect(scenarioDisplayStore.getSnapshot().basemap).toBe('satellite');
    env.tab('light');
    expect(scenarioDisplayStore.getSnapshot()).toMatchObject({ basemap: 'light', mode: '3d', enableRoads: true });
    scenarioDisplayStore.reset();
    expect(scenarioDisplayStore.getSnapshot().basemap).toBe('light');
    stop();
  });
});
