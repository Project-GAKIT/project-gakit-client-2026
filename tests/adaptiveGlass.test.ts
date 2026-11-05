import { afterEach, describe, expect, it, vi } from 'vitest';
import { attachAdaptiveGlass, GLASS_SETTLE_MS, setMapGlassActivity } from '@/lib/map/adaptiveGlass';

function fixture() {
  const attributes = new Map<string, string>();
  const scope = {
    getAttribute: (key: string) => attributes.get(key) ?? null,
    setAttribute: (key: string, value: string) => attributes.set(key, value),
    removeAttribute: (key: string) => attributes.delete(key),
  } as unknown as HTMLElement;
  const handlers = new Map<string, () => void>();
  let moving = false;
  const map = {
    loaded: () => false,
    isMoving: () => moving,
    on: (name: string, handler: () => void) => handlers.set(name, handler),
    off: (name: string) => handlers.delete(name),
  };
  return { scope, handlers, map, move: (value: boolean) => { moving = value; }, state: () => scope.getAttribute('data-map-glass') };
}

afterEach(() => vi.useRealTimers());

describe('adaptive map glass', () => {
  it('removes blur immediately and restores it only after loading and movement settle', () => {
    vi.useFakeTimers();
    const f = fixture();
    attachAdaptiveGlass(f.map, f.scope);
    expect(f.state()).toBe('busy');
    f.handlers.get('idle')!();
    vi.advanceTimersByTime(GLASS_SETTLE_MS);
    expect(f.state()).toBe('settled');
    f.move(true);
    f.handlers.get('movestart')!();
    expect(f.state()).toBe('busy');
    f.handlers.get('dataloading')!();
    f.move(false);
    f.handlers.get('moveend')!();
    vi.advanceTimersByTime(1000);
    expect(f.state()).toBe('busy');
    f.handlers.get('idle')!();
    vi.advanceTimersByTime(GLASS_SETTLE_MS - 1);
    expect(f.state()).toBe('busy');
    vi.advanceTimersByTime(1);
    expect(f.state()).toBe('settled');
  });

  it('keeps playback opaque when the camera becomes idle or another playback ends', () => {
    vi.useFakeTimers();
    const f = fixture();
    attachAdaptiveGlass(f.map, f.scope);
    const flood = {};
    const satellite = {};
    setMapGlassActivity(f.scope, flood, true);
    setMapGlassActivity(f.scope, satellite, true);
    f.handlers.get('idle')!();
    setMapGlassActivity(f.scope, flood, false);
    vi.advanceTimersByTime(1000);
    expect(f.state()).toBe('busy');
    setMapGlassActivity(f.scope, satellite, false);
    vi.advanceTimersByTime(GLASS_SETTLE_MS);
    expect(f.state()).toBe('settled');
  });

  it('cancels a pending restore and removes listeners when the map is disposed', () => {
    vi.useFakeTimers();
    const f = fixture();
    const dispose = attachAdaptiveGlass(f.map, f.scope);
    f.handlers.get('idle')!();
    dispose();
    vi.advanceTimersByTime(1000);
    expect(f.state()).toBeNull();
    expect(f.handlers.size).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
  });
});
