import { describe, expect, it, vi } from 'vitest';
import type { Map } from 'maplibre-gl';
import { basemapSourceIds, onBasemapFrame } from '@/lib/map/mapStartup';

function fixture() {
  const events = new globalThis.Map<string, Set<() => void>>();
  const map = {
    getStyle: () => ({ layers: [{ id: 'base', source: 'base' }, { id: 'labels', source: 'base' },
      { id: 'hidden', source: 'hidden', layout: { visibility: 'none' } }, { id: 'background' }] }),
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
});
