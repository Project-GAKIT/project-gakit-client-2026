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
  'rainfall-grid',
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

/** Some styles place water labels before buildings and road geometry. Road
 * overlays belong above that geometry, before the remaining basemap labels. */
export const getBasemapRoadOverlayAnchor = (map: any): string | undefined => {
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
