type GlassState = { activities: Set<object>; timer?: ReturnType<typeof setTimeout> };
const states = new WeakMap<HTMLElement, GlassState>();
export const GLASS_SETTLE_MS = 180;

export function mapGlassScope(element: HTMLElement | null): HTMLElement | null {
  return element?.closest<HTMLElement>('[data-map-shell], [data-map-workspace]') ?? element?.parentElement ?? null;
}

/** Separate owners cannot restore glass while another owner is still busy. */
export function setMapGlassActivity(scope: HTMLElement, owner: object, active: boolean) {
  let state = states.get(scope);
  if (!state) { state = { activities: new Set() }; states.set(scope, state); }
  if (state.timer) clearTimeout(state.timer);
  state.timer = undefined;
  if (active) state.activities.add(owner);
  else state.activities.delete(owner);
  if (state.activities.size) {
    if (scope.getAttribute('data-map-glass') !== 'busy') scope.setAttribute('data-map-glass', 'busy');
  } else {
    state.timer = setTimeout(() => {
      state.timer = undefined;
      scope.setAttribute('data-map-glass', 'settled');
    }, GLASS_SETTLE_MS);
  }
}

/** Event-driven: no frame polling, screenshots, or additional map instances. */
export function attachAdaptiveGlass(map: any, scope: HTMLElement | null): () => void {
  if (!scope) return () => {};
  const movement = {};
  const loading = {};
  const moveStart = () => setMapGlassActivity(scope, movement, true);
  const moveEnd = () => setMapGlassActivity(scope, movement, false);
  const loadStart = () => setMapGlassActivity(scope, loading, true);
  const idle = () => {
    setMapGlassActivity(scope, loading, false);
    if (!map.isMoving()) moveEnd();
  };
  setMapGlassActivity(scope, loading, !map.loaded());
  map.on('movestart', moveStart);
  map.on('moveend', moveEnd);
  map.on('dataloading', loadStart);
  map.on('idle', idle);
  return () => {
    map.off('movestart', moveStart);
    map.off('moveend', moveEnd);
    map.off('dataloading', loadStart);
    map.off('idle', idle);
    const state = states.get(scope);
    if (!state) return;
    state.activities.delete(movement);
    state.activities.delete(loading);
    if (!state.activities.size) {
      if (state.timer) clearTimeout(state.timer);
      states.delete(scope);
      scope.removeAttribute('data-map-glass');
    }
  };
}
