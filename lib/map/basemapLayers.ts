import type { Map as MapLibreMap } from 'maplibre-gl';

// Finds the first symbol/label layer belonging to the underlying basemap style
// (e.g. street names, road labels, place names), ignoring custom overlay layers.
// MapLibre's translucent pass draws layers in strict style order, so any project
// layer inserted before this id renders beneath the basemap's text.
const CUSTOM_LAYER_IDS = [
  'himawari-ir-layer',
  'iligan-buildings-2d',
  'iligan-buildings-3d',
  'iligan-roads-casing',
  'iligan-roads-minor-casing',
  'iligan-roads-major',
  'iligan-roads-minor',
  'flood-hazard-fill',
  'landslide-fill',
  'storm-surge-ssa1-fill',
  'storm-surge-ssa2-fill',
  'storm-surge-ssa3-fill',
  'storm-surge-ssa4-fill',
  'assessment-water-mask',
  'simulation-flood-grid',
  'rainfall-grid',
  'heat-index-layer',
  'heat-index-water-mask',
  'drought-provinces-layer',
  'drought-provinces-outline',
  'drought-province-shadow',
  'drought-province-raised',
  'drought-province-raised-outline',
  'drought-province-label',
  'drought-province-selected-label',
  'barangay-severity-fill',
  'barangay-fill',
  'barangay-outline-casing',
  'barangay-outline',
  'barangay-label',
  'par-boundary-line',
  'par-boundary-label',
  'typhoon-forecast-cone-fill',
  'typhoon-forecast-cone-outline',
  'typhoon-track-line-glow',
  'typhoon-track-line',
  'typhoon-track-line-forecast',
  'typhoon-track-point-circle',
  'typhoon-track-point-label',
  'report-clusters',
  'report-cluster-count',
  'report-cluster-pulse',
  'report-point-glow',
  'report-depth-labels',
  'report-points',
  'live-report-observations-points',
  'live-report-observations-labels',
  'report-pins-point',
  'report-pins-unverified',
  'report-pins-verified',
  'report-pins-anomaly',
  'report-pins-rejected',
  'selected-report-pin',
  'demo-observation-points',
  'hillshade',
];

export const getFirstBasemapSymbolLayerId = (map: any): string | undefined => {
  const style = map.getStyle?.();
  if (!style?.layers) return undefined;
  const customLayerIds = new Set(CUSTOM_LAYER_IDS);

  for (const layer of style.layers) {
    if (layer.type === 'symbol' && !customLayerIds.has(layer.id)) {
      return layer.id;
    }
  }
  return undefined;
};

/** Some styles place water labels before buildings and road geometry. Project
 * overlays that cover the ground (roads, heat, drought) belong above that
 * geometry, before the remaining basemap labels. */
export const getBasemapOverlayAnchor = (map: any): string | undefined => {
  const layers = map.getStyle?.()?.layers ?? [];
  const custom = new Set(CUSTOM_LAYER_IDS);
  const nativeSymbols = layers.filter((layer: any) => layer.type === 'symbol' && !custom.has(layer.id));
  const nativeSources = new Set(nativeSymbols.map((layer: any) => layer.source).filter(Boolean));
  let lastGeometry = -1;
  layers.forEach((layer: any, index: number) => {
    // Administrative lines can follow street labels; they do not cover road
    // surfaces and must not push highlights above those labels.
    if (layer.type !== 'symbol' && layer['source-layer'] !== 'boundary' && nativeSources.has(layer.source) && !custom.has(layer.id)) lastGeometry = index;
  });
  return layers.find((layer: any, index: number) => index > lastGeometry && nativeSymbols.includes(layer))?.id;
};

// Kept for existing callers that only deal with the road overlay.
export const getBasemapRoadOverlayAnchor = getBasemapOverlayAnchor;

// Full-surface weather layers share one stable block above basemap geometry.
// Drought follows heat so a selected province stays readable when both are on.
export const WEATHER_SURFACE_LAYER_IDS = [
  'heat-index-layer',
  'drought-provinces-layer',
  'drought-provinces-outline',
  'drought-province-shadow',
  'drought-province-raised',
  'drought-province-raised-outline',
] as const;

const WEATHER_SURFACE_LAYER_SET = new Set<string>(WEATHER_SURFACE_LAYER_IDS);

/** First weather layer in style order. Roads and buildings anchor below it so
 * re-adding either layer cannot lift basemap geometry above the weather. */
export const getFirstWeatherSurfaceLayerId = (map: any): string | undefined => {
  const layers = map.getStyle?.()?.layers;
  if (!layers) return undefined;
  return layers.find((layer: any) => WEATHER_SURFACE_LAYER_SET.has(layer.id))?.id;
};

/** Buildings stay under the basemap labels, and under an active weather block
 * on styles where the first label comes after that block (Light/Bright). */
export const getBuildingLayerAnchor = (map: any): string | undefined => {
  const firstLabel = getFirstBasemapSymbolLayerId(map);
  const firstWeather = getFirstWeatherSurfaceLayerId(map);
  if (!firstLabel || !firstWeather) return firstLabel ?? firstWeather;
  const layers = map.getStyle?.()?.layers ?? [];
  const weatherIndex = layers.findIndex((layer: any) => layer.id === firstWeather);
  const labelIndex = layers.findIndex((layer: any) => layer.id === firstLabel);
  return weatherIndex >= 0 && weatherIndex < labelIndex ? firstWeather : firstLabel;
};

/** Moves every weather layer present into one deterministic block below
 * `before`, preserving their relative order. */
export const placeWeatherSurfaceLayers = (map: any, before?: string): void => {
  const layers = map?.getStyle?.()?.layers;
  if (!before || !layers || !map?.moveLayer) return;
  const anchorIndex = layers.findIndex((layer: any) => layer.id === before);
  if (anchorIndex < 0) return;

  const present = new Set(layers.map((layer: any) => layer.id));
  const ordered = WEATHER_SURFACE_LAYER_IDS.filter(id => present.has(id));
  const current = layers
    .slice(Math.max(0, anchorIndex - ordered.length), anchorIndex)
    .map((layer: any) => layer.id);
  if (current.length === ordered.length && current.every((id: string, index: number) => id === ordered[index])) return;

  let next = before;
  for (let index = ordered.length - 1; index >= 0; index--) {
    try {
      map.moveLayer(ordered[index], next);
      next = ordered[index];
    } catch {
      return;
    }
  }
};

/** Anchor for project overlays that must stay above basemap geometry. Styles
 * without labels (Satellite) fall back below the report pins. */
export const getProjectOverlayAnchor = (map: any): string | undefined =>
  getBasemapOverlayAnchor(map) ??
  (map.getLayer?.('report-clusters') ? 'report-clusters' : undefined);

/** OpenFreeMap's dark style references two images absent from its sprite.
 * Supply local pixels only when missing, including after a style switch. */
export const registerBasemapImageFallbacks = (map: MapLibreMap): void => {
  map.setMissingStyleImageResolver(id => {
    if (id !== 'wood-pattern' && id !== 'circle-11') return;
    if (map.hasImage(id)) return;
    if (id === 'wood-pattern') {
      // Keep forest fills visible using the layer's existing dark fill color.
      map.addImage(id, { width: 1, height: 1, data: new Uint8Array([32, 32, 32, 255]) });
      return;
    }
    const size = 11;
    const data = new Uint8Array(size * size * 4);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const offset = (y * size + x) * 4;
        data[offset] = data[offset + 1] = data[offset + 2] = 101;
        data[offset + 3] = Math.round(255 * Math.max(0, Math.min(1, 5.5 - Math.hypot(x - 5, y - 5))));
      }
    }
    map.addImage(id, { width: size, height: size, data });
  });
};
