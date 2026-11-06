import { describe, expect, it, vi } from 'vitest';
import type { Map } from 'maplibre-gl';
import { basemapSourceIds, layerSourcesReady, onBasemapFrame } from '@/lib/map/mapStartup';

function fixture() {
  const events = new globalThis.Map<string, Set<() => void>>();
  const map = {
    getStyle: () => ({ layers: [{ id: 'base', source: 'base', type: 'fill' }, { id: 'labels', source: 'base', type: 'symbol' },
      { id: 'hidden', type: 'fill', source: 'hidden', layout: { visibility: 'none' } }, { id: 'background' }] }),
    getLayer: vi.fn(() => ({})),
    getCenter: () => ({ lng: 124.24, lat: 8.23 }), project: vi.fn(() => ({ x: 250, y: 200 })),
    queryRenderedFeatures: vi.fn(() => []),
    getSource: vi.fn(() => ({})), isSourceLoaded: vi.fn((id: string) => id === 'base'),
    on: (event: string, fn: () => void) => { if (!events.has(event)) events.set(event, new Set()); events.get(event)!.add(fn); },
    off: (event: string, fn: () => void) => { events.get(event)?.delete(fn); }, triggerRepaint: vi.fn(),
  } as unknown as Map;
  const emit = (event: string) => [...events.get(event) ?? []].forEach(fn => fn());
  return { map, emit, events };
}

describe('first usable basemap frame', () => {
  it('ignores pending optional sources, fires after a render, and removes listeners', () => {
    const { map, emit, events } = fixture(); const ready = vi.fn();
    const sources = basemapSourceIds(map);
    expect(sources).toEqual(['base']);
    onBasemapFrame(map, sources, ready);
    expect(ready).not.toHaveBeenCalled();
    emit('render'); emit('render');
    expect(ready).toHaveBeenCalledOnce();
    expect(events.get('render')?.size).toBe(0);
    expect(events.get('remove')?.size).toBe(0);
  });
  it('keeps recovery available for a blocked basemap and cancels on style replacement', () => {
    const { map, emit } = fixture(); const ready = vi.fn();
    vi.mocked(map.isSourceLoaded).mockReturnValue(false);
    const cancel = onBasemapFrame(map, ['base'], ready);
    emit('render'); expect(ready).not.toHaveBeenCalled();
    cancel(); vi.mocked(map.isSourceLoaded).mockReturnValue(true);
    emit('render'); expect(ready).not.toHaveBeenCalled();
  });
  it('releases a painted map center while peripheral tiles are still pending', () => {
    const { map, emit, events } = fixture(); const ready = vi.fn();
    vi.mocked(map.isSourceLoaded).mockReturnValue(false);
    vi.mocked(map.queryRenderedFeatures).mockReturnValue([{ layer: { id: 'base' } }] as never);
    onBasemapFrame(map, ['base'], ready);
    emit('render');
    expect(ready).toHaveBeenCalledOnce();
    expect(map.queryRenderedFeatures).toHaveBeenCalledWith({ x: 250, y: 200 }, { layers: ['base', 'labels'] });
    expect(events.get('render')?.size).toBe(0);
  });
  it('does not accept optional overlay geometry as a usable basemap', () => {
    const { map, emit } = fixture(); const ready = vi.fn();
    vi.mocked(map.isSourceLoaded).mockReturnValue(false);
    onBasemapFrame(map, ['base'], ready);
    emit('render');
    expect(ready).not.toHaveBeenCalled();
    expect(map.queryRenderedFeatures).toHaveBeenCalledWith({ x: 250, y: 200 }, { layers: ['base', 'labels'] });
  });

  it('waits only for visible sources belonging to the selected layer', () => {
    const { map } = fixture();
    expect(layerSourcesReady(map, ['base'])).toBe(true);
    expect(layerSourcesReady(map, ['hidden'])).toBe(true);
    vi.mocked(map.isSourceLoaded).mockReturnValue(false);
    expect(layerSourcesReady(map, ['base'])).toBe(false);
    expect(layerSourcesReady(map, ['hidden'])).toBe(true);
  });

  it('does not count subsequently added overlays that reuse the basemap source', () => {
    const { map, emit } = fixture(); const ready = vi.fn();
    vi.mocked(map.isSourceLoaded).mockReturnValue(false);
    onBasemapFrame(map, ['base'], ready);
    const style = map.getStyle();
    vi.spyOn(map, 'getStyle').mockReturnValue({ ...style, layers: [...style.layers,
      { id: 'invisible-water-mask', source: 'base', type: 'fill', paint: { 'fill-opacity': 0 } }] });
    emit('render');
    expect(map.queryRenderedFeatures).toHaveBeenCalledWith({ x: 250, y: 200 }, { layers: ['base', 'labels'] });
    expect(ready).not.toHaveBeenCalled();
  });

});
