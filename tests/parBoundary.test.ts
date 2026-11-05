import { describe, expect, it } from 'vitest';
import { syncParBoundary } from '@/lib/map/parBoundary';

describe('PAR reference overlay', () => {
  it('starts visible without cyclone data and independently toggles both boundary layers', () => {
    const sources = new Map<string, unknown>();
    const layers = new Map<string, { layout: { visibility: string } }>();
    const map = {
      getSource: (id: string) => sources.get(id),
      addSource: (id: string, source: unknown) => sources.set(id, source),
      getLayer: (id: string) => layers.get(id),
      addLayer: (layer: { id: string; layout: { visibility: string } }) => layers.set(layer.id, layer),
      setLayoutProperty: (id: string, property: 'visibility', value: string) => { layers.get(id)!.layout[property] = value; },
    };
    syncParBoundary(map);
    expect(sources.size).toBe(1);
    expect(layers.get('par-boundary-line')?.layout.visibility).toBe('visible');
    expect(layers.get('par-boundary-label')?.layout.visibility).toBe('visible');
    syncParBoundary(map, false);
    expect(layers.get('par-boundary-line')?.layout.visibility).toBe('none');
    expect(layers.get('par-boundary-label')?.layout.visibility).toBe('none');
    syncParBoundary(map, true);
    expect(layers.size).toBe(2);
    expect(sources.size).toBe(1);
    expect(layers.get('par-boundary-line')?.layout.visibility).toBe('visible');
  });
});
