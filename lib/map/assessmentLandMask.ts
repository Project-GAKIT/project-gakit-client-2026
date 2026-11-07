import {
  getHeatLandMaskIfReady, HEAT_WATER_SOURCE, WATER_TILEJSON, mercatorY, type MaskPolygon,
} from './heatLandMask';

export const ASSESSMENT_WATER_LAYER = 'assessment-water-mask';

/** An invisible hit-test layer that remains enabled independently of overlays. */
export function ensureAssessmentLandMask(map: any): void {
  const source = map.getSource('openmaptiles') ? 'openmaptiles' : HEAT_WATER_SOURCE;
  if (!map.getSource(source)) map.addSource(source, { type: 'vector', url: WATER_TILEJSON });
  if (!map.getLayer(ASSESSMENT_WATER_LAYER)) {
    map.addLayer({
      id: ASSESSMENT_WATER_LAYER, source, 'source-layer': 'water', type: 'fill',
      paint: { 'fill-opacity': 0 },
    });
  }
}

function pointInRing(lon: number, y: number, ring: Float64Array): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 2; i < ring.length; j = i, i += 2) {
    const ax = ring[j], ay = ring[j + 1], bx = ring[i], by = ring[i + 1];
    const cross = (lon - ax) * (by - ay) - (y - ay) * (bx - ax);
    if (Math.abs(cross) < 1e-12 && lon >= Math.min(ax, bx) && lon <= Math.max(ax, bx)
      && y >= Math.min(ay, by) && y <= Math.max(ay, by)) return true;
    if ((ay > y) !== (by > y) && lon < (bx - ax) * (y - ay) / (by - ay) + ax) inside = !inside;
  }
  return inside;
}

/** Test every island, preserving interior water holes and coastline boundaries. */
export function pointOnPhilippineLand(polygons: MaskPolygon[], lat: number, lon: number): boolean {
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) >= 90) return false;
  const y = mercatorY(lat);
  return polygons.some(({ bounds: [west, south, east, north], rings }) =>
    lon >= west && lon <= east && y >= south && y <= north && rings.length > 0
    && pointInRing(lon, y, rings[0]) && !rings.slice(1).some(ring => pointInRing(lon, y, ring)),
  );
}

/**
 * Synchronous, best-effort land check for the map click path.
 *
 * Placing the pin must never wait on the coastline download or on basemap
 * tiles, so an inconclusive check allows the click. Points positively
 * identified as ocean (once the cached coastline is warm) or as water from
 * already-rendered vector tiles are rejected; lakes and rivers start being
 * rejected as soon as their tiles render.
 */
export function canAssessMapLocation(map: any, lat: number, lng: number): boolean {
  const land = getHeatLandMaskIfReady();
  if (land && !pointOnPhilippineLand(land, lat, lng)) return false;
  if (!map.getLayer(ASSESSMENT_WATER_LAYER)) return true;
  try {
    const point = map.project([lng, lat]);
    return map.queryRenderedFeatures(point, { layers: [ASSESSMENT_WATER_LAYER] }).length === 0;
  } catch {
    // A style swap can remove the layer between the calls above. A dead click
    // is worse than a missed water rejection, so allow it.
    return true;
  }
}
