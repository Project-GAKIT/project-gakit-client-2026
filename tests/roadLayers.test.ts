import { describe, expect, it } from 'vitest';
import { applyRoadsVisibility, reorderRoadLayers, ROAD_LAYER_IDS, setRoadFocusActive } from '@/lib/map/roadLayers';

describe('road visibility during tile loading', () => {
  it('hides restored context roads after focus is disabled while sources are loading', () => {
    const visibility = new Map<string, string>(ROAD_LAYER_IDS.map(id => [id, 'visible']));
    const map = {
      isStyleLoaded: () => false,
      getLayer: (id: string) => visibility.has(id),
      getLayoutProperty: (id: string) => visibility.get(id),
      setLayoutProperty: (id: string, _property: string, value: string) => visibility.set(id, value),
    };
    applyRoadsVisibility(map, true);
    setRoadFocusActive(map, true);
    setRoadFocusActive(map, false);
    applyRoadsVisibility(map, false);
    expect([...visibility.values()]).toEqual(ROAD_LAYER_IDS.map(() => 'none'));
  });
});

describe('road stacking with weather overlays', () => {
  it('keeps roads below an active heat/drought surface block', () => {
    const layers = [
      'background',
      'highway-inner',
      'heat-index-layer',
      ...ROAD_LAYER_IDS,
      'road-label',
      'place-label',
    ].map(id => ({ id }));
    const map = {
      getStyle: () => ({ layers }),
      getLayer: (id: string) => layers.some(layer => layer.id === id),
      moveLayer: (id: string, before?: string) => {
        const from = layers.findIndex(layer => layer.id === id);
        const [layer] = layers.splice(from, 1);
        const to = before ? layers.findIndex(item => item.id === before) : layers.length;
        layers.splice(to, 0, layer);
      },
    };

    reorderRoadLayers(map);

    const ids = layers.map(layer => layer.id);
    const weatherIndex = ids.indexOf('heat-index-layer');
    const roadIds = new Set<string>(ROAD_LAYER_IDS);
    expect(ids.filter(id => roadIds.has(id))).toEqual([...ROAD_LAYER_IDS]);
    expect(Math.max(...ROAD_LAYER_IDS.map(id => ids.indexOf(id)))).toBeLessThan(weatherIndex);
  });
});
