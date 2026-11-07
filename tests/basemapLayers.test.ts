import { describe, expect, it } from 'vitest';

import {
  getBasemapOverlayAnchor,
  getBasemapRoadOverlayAnchor,
  getBuildingLayerAnchor,
  getFirstBasemapSymbolLayerId,
  getFirstWeatherSurfaceLayerId,
  placeWeatherSurfaceLayers,
} from '@/lib/map/basemapLayers';

const styleWith = (layers: Array<{ id: string; type: string }>) => ({
  getStyle: () => ({ layers }),
});

describe('getFirstBasemapSymbolLayerId', () => {
  it('returns the first basemap symbol layer', () => {
    const map = styleWith([
      { id: 'background', type: 'background' },
      { id: 'landuse', type: 'fill' },
      { id: 'road', type: 'line' },
      { id: 'road-label', type: 'symbol' },
      { id: 'place-label', type: 'symbol' },
    ]);

    expect(getFirstBasemapSymbolLayerId(map)).toBe('road-label');
  });

  it('skips project symbol layers so they never become the anchor', () => {
    const map = styleWith([
      { id: 'report-pins-point', type: 'symbol' },
      { id: 'report-cluster-count', type: 'symbol' },
      { id: 'road-label', type: 'symbol' },
      { id: 'place-label', type: 'symbol' },
    ]);

    expect(getFirstBasemapSymbolLayerId(map)).toBe('road-label');
  });

  it('skips the building layers this project inserts', () => {
    const map = styleWith([
      { id: 'iligan-buildings-2d', type: 'fill' },
      { id: 'iligan-buildings-3d', type: 'fill-extrusion' },
      { id: 'hillshade', type: 'hillshade' },
      { id: 'place-label', type: 'symbol' },
    ]);

    expect(getFirstBasemapSymbolLayerId(map)).toBe('place-label');
  });

  it('returns undefined when the style has no symbol layers', () => {
    const map = styleWith([{ id: 'background', type: 'background' }]);

    expect(getFirstBasemapSymbolLayerId(map)).toBeUndefined();
  });

  it('returns undefined when the style is not loaded yet', () => {
    expect(getFirstBasemapSymbolLayerId({})).toBeUndefined();
    expect(getFirstBasemapSymbolLayerId({ getStyle: () => undefined })).toBeUndefined();
  });
});

describe('getBasemapRoadOverlayAnchor', () => {
  it('places roads after native geometry even when an earlier label precedes it', () => {
    const map = { getStyle: () => ({ layers: [
      { id: 'water-label', type: 'symbol', source: 'openmaptiles' },
      { id: 'building', type: 'fill', source: 'openmaptiles' },
      { id: 'highway-inner', type: 'line', source: 'openmaptiles' },
      { id: 'road-label', type: 'symbol', source: 'openmaptiles' },
      { id: 'boundary-state', type: 'line', source: 'openmaptiles', 'source-layer': 'boundary' },
      { id: 'place-label', type: 'symbol', source: 'openmaptiles' },
      { id: 'flood-hazard-fill', type: 'fill', source: 'flood' },
      { id: 'report-pins-point', type: 'symbol', source: 'reports' },
    ] }) };
    expect(getBasemapRoadOverlayAnchor(map)).toBe('road-label');
  });

  it('places weather above the dark style roads and buildings, below its labels', () => {
    // The dark style interleaves a water label before buildings and roads.
    const map = { getStyle: () => ({ layers: [
      { id: 'water-label', type: 'symbol', source: 'openmaptiles' },
      { id: 'building', type: 'fill', source: 'openmaptiles' },
      { id: 'highway-inner', type: 'line', source: 'openmaptiles' },
      { id: 'road-label', type: 'symbol', source: 'openmaptiles' },
      { id: 'place-label', type: 'symbol', source: 'openmaptiles' },
    ] }) };

    expect(getFirstBasemapSymbolLayerId(map)).toBe('water-label');
    expect(getBasemapOverlayAnchor(map)).toBe('road-label');
  });
});

describe('weather surface ordering', () => {
  const createLayerMap = (layerIds: string[]) => {
    const layers = layerIds.map(id => ({ id, type: 'fill' }));
    return {
      layers,
      map: {
        getStyle: () => ({ layers }),
        getLayer: (id: string) => layers.some(layer => layer.id === id),
        moveLayer: (id: string, before?: string) => {
          const from = layers.findIndex(layer => layer.id === id);
          const [layer] = layers.splice(from, 1);
          const to = before ? layers.findIndex(item => item.id === before) : layers.length;
          layers.splice(to, 0, layer);
        },
      },
    };
  };

  it('ignores weather labels when finding the surface block anchor', () => {
    const map = styleWith([
      { id: 'drought-province-label', type: 'symbol' },
      { id: 'heat-index-layer', type: 'raster' },
      { id: 'drought-provinces-layer', type: 'fill' },
    ]);

    expect(getFirstWeatherSurfaceLayerId(map)).toBe('heat-index-layer');
  });

  it('moves weather surfaces into one block below the basemap labels', () => {
    const { layers, map } = createLayerMap([
      'background',
      'heat-index-layer',
      'drought-provinces-layer',
      'highway-inner',
      'road-label',
    ]);

    placeWeatherSurfaceLayers(map, 'road-label');

    expect(layers.map(layer => layer.id)).toEqual([
      'background',
      'highway-inner',
      'heat-index-layer',
      'drought-provinces-layer',
      'road-label',
    ]);
  });
});

describe('getBuildingLayerAnchor', () => {
  it('keeps light-basemap buildings below an active weather block', () => {
    const map = styleWith([
      { id: 'building', type: 'fill' },
      { id: 'highway', type: 'line' },
      { id: 'heat-index-layer', type: 'raster' },
      { id: 'road-label', type: 'symbol' },
    ]);

    expect(getFirstBasemapSymbolLayerId(map)).toBe('road-label');
    expect(getBuildingLayerAnchor(map)).toBe('heat-index-layer');
  });

  it('keeps dark-basemap buildings under the early water label', () => {
    const map = styleWith([
      { id: 'water-label', type: 'symbol' },
      { id: 'building', type: 'fill' },
      { id: 'highway', type: 'line' },
      { id: 'heat-index-layer', type: 'raster' },
      { id: 'road-label', type: 'symbol' },
    ]);

    expect(getBuildingLayerAnchor(map)).toBe('water-label');
  });
});
