import type { Feature, MultiPolygon, Polygon, Position } from 'geojson';

export const HEAT_WATER_SOURCE = 'heat-index-water';
export const HEAT_WATER_LAYER = 'heat-index-water-mask';
export const WATER_TILEJSON = 'https://tiles.openfreemap.org/planet';

export interface MaskPolygon {
  // Coordinates are longitude and Mercator y, preprojected once for cheap redraws.
  rings: Float64Array[];
  bounds: [number, number, number, number];
}

export const mercatorY = (lat: number) => Math.log(Math.tan(Math.PI / 4 + lat * Math.PI / 360));

export function prepareMaskPolygons(geometry: Polygon | MultiPolygon): MaskPolygon[] {
  const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
  return polygons.map((polygon) => {
    const bounds: [number, number, number, number] = [Infinity, Infinity, -Infinity, -Infinity];
    const rings = polygon.map((ring) => {
      const result = new Float64Array(ring.length * 2);
      ring.forEach(([lon, lat]: Position, i) => {
        const y = mercatorY(lat);
        result[i * 2] = lon;
        result[i * 2 + 1] = y;
        bounds[0] = Math.min(bounds[0], lon);
        bounds[1] = Math.min(bounds[1], y);
        bounds[2] = Math.max(bounds[2], lon);
        bounds[3] = Math.max(bounds[3], y);
      });
      return result;
    });
    return { rings, bounds };
  });
}

let pending: Promise<MaskPolygon[]> | null = null;

export function loadHeatLandMask(): Promise<MaskPolygon[]> {
  if (!pending) pending = fetch('/data/phl-heat-land.geojson').then(async (response) => {
    if (!response.ok) throw new Error('The land boundary is temporarily unavailable.');
    const feature: Feature<MultiPolygon | Polygon> = await response.json();
    if (!feature.geometry || !['Polygon', 'MultiPolygon'].includes(feature.geometry.type)) {
      throw new Error('The land boundary is temporarily unavailable.');
    }
    return prepareMaskPolygons(feature.geometry);
  }).catch((error) => { pending = null; throw error; });
  return pending;
}

/** Reuse the basemap's water tiles, including lakes and detailed coastal edges. */
export function heatWaterSource(map: any): string {
  if (map.getSource('openmaptiles')) return 'openmaptiles';
  // Satellite has no vector water data. Use the same existing basemap provider
  // for an invisible water-only layer, never another weather API request.
  if (!map.getSource(HEAT_WATER_SOURCE)) {
    map.addSource(HEAT_WATER_SOURCE, { type: 'vector', url: WATER_TILEJSON });
  }
  if (!map.getLayer(HEAT_WATER_LAYER)) {
    map.addLayer({
      id: HEAT_WATER_LAYER, source: HEAT_WATER_SOURCE, 'source-layer': 'water',
      type: 'fill', paint: { 'fill-opacity': 0 },
    });
  }
  map.setLayoutProperty(HEAT_WATER_LAYER, 'visibility', 'visible');
  return HEAT_WATER_SOURCE;
}

export function heatWaterPolygons(map: any, source: string): MaskPolygon[] {
  return map.querySourceFeatures(source, { sourceLayer: 'water' })
    .filter((feature: Feature) => feature.geometry?.type === 'Polygon' || feature.geometry?.type === 'MultiPolygon')
    .flatMap((feature: Feature<Polygon | MultiPolygon>) => prepareMaskPolygons(feature.geometry));
}

/** Bounding boxes reject most polygons before testing their rings. */
export function containsMaskPoint(polygons: MaskPolygon[], lng: number, lat: number): boolean {
  const y = mercatorY(lat);
  return polygons.some(({ bounds, rings }) => {
    if (lng < bounds[0] || lng > bounds[2] || y < bounds[1] || y > bounds[3]) return false;
    let inside = false;
    for (const ring of rings) {
      for (let i = 0, j = ring.length - 2; i < ring.length; j = i, i += 2) {
        if ((ring[i + 1] > y) !== (ring[j + 1] > y)
          && lng < (ring[j] - ring[i]) * (y - ring[i + 1]) / (ring[j + 1] - ring[i + 1]) + ring[i]) inside = !inside;
      }
    }
    return inside;
  });
}
