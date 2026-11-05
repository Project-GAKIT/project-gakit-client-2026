import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_SCENARIO_DISPLAY,
  SCENARIO_DISPLAY_STORAGE_KEY,
  parseScenarioDisplay,
  scenarioDisplayStore,
  serializeScenarioDisplay,
  setScenarioRenderMode,
  setScenarioEnableBuildings,
  setScenarioEnableRoads,
} from '@/lib/map/scenarioDisplayStore';

/** Minimal in-memory stand-in for `window.localStorage`. */
function makeStorage(seed: Record<string, string> = {}) {
  const map = new Map(Object.entries(seed));
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => {
      map.set(key, value);
    },
    removeItem: (key: string) => {
      map.delete(key);
    },
    clear: () => map.clear(),
  };
}

describe('scenarioDisplayStore', () => {
  beforeEach(() => {
    scenarioDisplayStore.reset();
  });

  afterEach(() => {
    scenarioDisplayStore.reset();
  });

  it('provides default initial values', () => {
    const snapshot = scenarioDisplayStore.getSnapshot();
    expect(snapshot.renderMode).toBe('linear');
    expect(snapshot.mode).toBe('2d');
    expect(snapshot.basemap).toBe('light');
    expect(snapshot.enableBuildings).toBe(true);
    expect(snapshot.enableRoads).toBe(false);
    expect(snapshot.focusRoads).toBe(false);
  });

  it('updates renderMode and notifies subscribers', () => {
    const listener = vi.fn();
    const unsubscribe = scenarioDisplayStore.subscribe(listener);

    setScenarioRenderMode('nearest');
    expect(scenarioDisplayStore.getSnapshot().renderMode).toBe('nearest');
    expect(listener).toHaveBeenCalledTimes(1);

    // No-op if same value
    setScenarioRenderMode('nearest');
    expect(listener).toHaveBeenCalledTimes(1);

    setScenarioRenderMode('linear');
    expect(scenarioDisplayStore.getSnapshot().renderMode).toBe('linear');
    expect(listener).toHaveBeenCalledTimes(2);

    unsubscribe();
    setScenarioRenderMode('linear');
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('defaults PAR on and retains its independent choice through map changes', () => {
    expect(scenarioDisplayStore.getSnapshot().showParBoundary).toBe(true);
    scenarioDisplayStore.setShowParBoundary(false);
    scenarioDisplayStore.setBasemap('dark');
    scenarioDisplayStore.setMode('3d');
    expect(scenarioDisplayStore.getSnapshot().showParBoundary).toBe(false);
    expect(parseScenarioDisplay(serializeScenarioDisplay(scenarioDisplayStore.getSnapshot())).showParBoundary).toBe(false);
    expect(parseScenarioDisplay('{"showParBoundary":"false"}')).toEqual({});
    scenarioDisplayStore.reset();
    expect(scenarioDisplayStore.getSnapshot().showParBoundary).toBe(true);
  });

  it('persists road focus separately from the highlighted road overlay', () => {
    const listener = vi.fn();
    const unsubscribe = scenarioDisplayStore.subscribe(listener);
    scenarioDisplayStore.setFocusRoads(true);
    scenarioDisplayStore.setFocusRoads(true);
    expect(listener).toHaveBeenCalledOnce();
    expect(scenarioDisplayStore.getSnapshot().focusRoads).toBe(true);
    expect(scenarioDisplayStore.getSnapshot().enableRoads).toBe(false);
    expect(parseScenarioDisplay(serializeScenarioDisplay(scenarioDisplayStore.getSnapshot())).focusRoads).toBe(true);
    expect(parseScenarioDisplay('{"focusRoads":"yes"}')).toEqual({});
    unsubscribe();
  });

  it('changes 2D/3D view and notifies subscribers', () => {
    const listener = vi.fn();
    const unsubscribe = scenarioDisplayStore.subscribe(listener);

    scenarioDisplayStore.setMode('3d');
    expect(scenarioDisplayStore.getSnapshot().mode).toBe('3d');
    expect(listener).toHaveBeenCalledTimes(1);

    scenarioDisplayStore.setMode('2d');
    expect(scenarioDisplayStore.getSnapshot().mode).toBe('2d');
    expect(listener).toHaveBeenCalledTimes(2);

    unsubscribe();
  });

  it('toggles enableBuildings and notifies subscribers', () => {
    const listener = vi.fn();
    const unsubscribe = scenarioDisplayStore.subscribe(listener);

    setScenarioEnableBuildings(false);
    expect(scenarioDisplayStore.getSnapshot().enableBuildings).toBe(false);
    expect(listener).toHaveBeenCalledTimes(1);

    setScenarioEnableBuildings((prev) => !prev);
    expect(scenarioDisplayStore.getSnapshot().enableBuildings).toBe(true);
    expect(listener).toHaveBeenCalledTimes(2);

    unsubscribe();
  });

  it('toggles enableRoads and notifies subscribers', () => {
    const listener = vi.fn();
    const unsubscribe = scenarioDisplayStore.subscribe(listener);

    setScenarioEnableRoads(true);
    expect(scenarioDisplayStore.getSnapshot().enableRoads).toBe(true);
    expect(listener).toHaveBeenCalledTimes(1);

    // No-op if same value
    setScenarioEnableRoads(true);
    expect(listener).toHaveBeenCalledTimes(1);

    setScenarioEnableRoads(false);
    expect(scenarioDisplayStore.getSnapshot().enableRoads).toBe(false);
    expect(listener).toHaveBeenCalledTimes(2);

    unsubscribe();
  });

  it('leaves the roads preference untouched across basemap switches', () => {
    setScenarioEnableRoads(true);

    scenarioDisplayStore.setBasemap('satellite');
    expect(scenarioDisplayStore.getSnapshot().enableRoads).toBe(true);

    scenarioDisplayStore.setBasemap('light');
    expect(scenarioDisplayStore.getSnapshot().enableRoads).toBe(true);
  });

  it('disables buildings by default when switching to satellite and restores them on return', () => {
    scenarioDisplayStore.setBasemap('satellite');
    expect(scenarioDisplayStore.getSnapshot().enableBuildings).toBe(false);

    scenarioDisplayStore.setBasemap('light');
    expect(scenarioDisplayStore.getSnapshot().enableBuildings).toBe(true);
  });

  it('restores the base buildings preference even when it was off before satellite', () => {
    setScenarioEnableBuildings(false);

    scenarioDisplayStore.setBasemap('satellite');
    expect(scenarioDisplayStore.getSnapshot().enableBuildings).toBe(false);

    scenarioDisplayStore.setBasemap('light');
    expect(scenarioDisplayStore.getSnapshot().enableBuildings).toBe(false);
  });

  it('lets an explicit buildings choice on satellite win when switching back to base', () => {
    scenarioDisplayStore.setBasemap('satellite');
    setScenarioEnableBuildings(true);

    scenarioDisplayStore.setBasemap('light');
    expect(scenarioDisplayStore.getSnapshot().enableBuildings).toBe(true);

    // Turning them back off on satellite keeps them off on base too.
    scenarioDisplayStore.setBasemap('satellite');
    setScenarioEnableBuildings(true);
    setScenarioEnableBuildings(false);

    scenarioDisplayStore.setBasemap('light');
    expect(scenarioDisplayStore.getSnapshot().enableBuildings).toBe(false);
  });

  it('resets to defaults cleanly', () => {
    setScenarioRenderMode('linear');
    scenarioDisplayStore.setMode('3d');
    scenarioDisplayStore.setBasemap('satellite');
    setScenarioEnableBuildings(false);
    setScenarioEnableRoads(true);

    scenarioDisplayStore.reset();

    const snapshot = scenarioDisplayStore.getSnapshot();
    expect(snapshot.renderMode).toBe('linear');
    expect(snapshot.mode).toBe('2d');
    expect(snapshot.basemap).toBe('light');
    expect(snapshot.enableBuildings).toBe(true);
    expect(snapshot.enableRoads).toBe(false);
  });
});

describe('parseScenarioDisplay', () => {
  it('returns an empty object for absent or non-JSON input', () => {
    expect(parseScenarioDisplay(null)).toEqual({});
    expect(parseScenarioDisplay('')).toEqual({});
    expect(parseScenarioDisplay('not json')).toEqual({});
    expect(parseScenarioDisplay('42')).toEqual({});
  });

  it('keeps only recognised, correctly typed fields', () => {
    expect(
      parseScenarioDisplay(
        JSON.stringify({ renderMode: 'nearest', enableTerrain: false, junk: 1 })
      )
    ).toEqual({ renderMode: 'nearest', mode: '2d' });
  });

  it('drops invalid enum and type values', () => {
    expect(
      parseScenarioDisplay(
        JSON.stringify({ renderMode: 'bilinear', enableBuildings: 'yes', enableRoads: 'yes' })
      )
    ).toEqual({});
  });

  it('keeps every known basemap id and drops unknown ones', () => {
    expect(parseScenarioDisplay(JSON.stringify({ basemap: 'bright' }))).toEqual({
      basemap: 'bright',
    });
    expect(parseScenarioDisplay(JSON.stringify({ basemap: 'dark' }))).toEqual({ basemap: 'dark' });
    expect(parseScenarioDisplay(JSON.stringify({ basemap: 'fiord' }))).toEqual({});
  });
});

describe('serializeScenarioDisplay', () => {
  it('round-trips through parse', () => {
    const settings = {
      renderMode: 'nearest' as const,
      mode: '2d' as const,
      basemap: 'light' as const,
      enableBuildings: true,
      enableRoads: false,
      focusRoads: false,
      showParBoundary: true,
    };
    expect(parseScenarioDisplay(serializeScenarioDisplay(settings))).toEqual(settings);
  });
});

describe('scenarioDisplayStore persistence', () => {
  beforeEach(() => {
    scenarioDisplayStore.reset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    scenarioDisplayStore.reset();
  });

  it('is a no-op when there is no browser storage', () => {
    scenarioDisplayStore.reset();
    scenarioDisplayStore.hydrate();
    expect(scenarioDisplayStore.getSnapshot()).toEqual(DEFAULT_SCENARIO_DISPLAY);
  });

  it('hydrates recognised persisted values over the defaults', () => {
    vi.stubGlobal('window', {
      matchMedia: () => ({ matches: false }),
      localStorage: makeStorage({
        [SCENARIO_DISPLAY_STORAGE_KEY]: JSON.stringify({
          renderMode: 'nearest',
          enableBuildings: false,
          enableRoads: true,
        }),
      }),
    });
    vi.stubGlobal('document', { documentElement: { dataset: {} } });

    // `beforeEach` already restored defaults with no storage present, so this
    // reads the seeded payload rather than overwriting it.
    scenarioDisplayStore.hydrate();

    const snapshot = scenarioDisplayStore.getSnapshot();
    expect(snapshot.renderMode).toBe('nearest');
    expect(snapshot.enableBuildings).toBe(false);
    expect(snapshot.enableRoads).toBe(true);
    // A field absent from storage keeps its default.
    expect(snapshot.mode).toBe('2d');
  });

  it('writes changes back to storage', () => {
    const storage = makeStorage();
    vi.stubGlobal('window', { localStorage: storage });

    setScenarioRenderMode('nearest');

    const raw = storage.getItem(SCENARIO_DISPLAY_STORAGE_KEY);
    expect(raw).not.toBeNull();
    expect(JSON.parse(raw as string)).toMatchObject({ renderMode: 'nearest' });
  });

  it.each([false, true])('restores a saved 3D view only on desktop (mobile=%s)', mobile => {
    const storage = makeStorage({
      [SCENARIO_DISPLAY_STORAGE_KEY]: JSON.stringify({ mode: '3d', enableRoads: true }),
    });
    vi.stubGlobal('window', {
      localStorage: storage,
      matchMedia: (query: string) => ({ matches: mobile && query === '(max-width: 767px)' }),
    });
    vi.stubGlobal('document', { documentElement: { dataset: {} } });
    scenarioDisplayStore.hydrate();
    expect(scenarioDisplayStore.getSnapshot().mode).toBe(mobile ? '2d' : '3d');
    expect(scenarioDisplayStore.getSnapshot().enableRoads).toBe(true);
    expect(JSON.parse(storage.getItem(SCENARIO_DISPLAY_STORAGE_KEY)!)).toMatchObject({ mode: '3d' });

    // Mobile viewers can opt into 3D; late preference hydration must not undo it.
    scenarioDisplayStore.setMode('3d');
    scenarioDisplayStore.hydrate();
    expect(scenarioDisplayStore.getSnapshot().mode).toBe('3d');
  });
});
