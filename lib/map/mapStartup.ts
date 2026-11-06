import type { Map as MapLibreMap } from 'maplibre-gl';

/** Capture the visible basemap sources before project overlays are registered. */
export function basemapSourceIds(map: MapLibreMap): string[] {
  return [...new Set(map.getStyle().layers
    .filter(layer => layer.layout?.visibility !== 'none' && 'source' in layer)
    .map(layer => (layer as { source: string }).source))];
}

/** A painted basemap is usable even while optional overlays are still loading. */
export function onBasemapFrame(map: MapLibreMap, sources: string[], ready: () => void): () => void {
  const basemapLayers = map.getStyle().layers.filter(layer => 'source' in layer
    && sources.includes(layer.source as string) && layer.layout?.visibility !== 'none'
    && ['fill', 'line', 'symbol', 'circle', 'fill-extrusion'].includes(layer.type)).map(layer => layer.id);
  const check = () => {
    if (!sources.every(id => map.getSource(id) && map.isSourceLoaded(id))) {
      // One slow peripheral tile or label must not block a center that already
      // has basemap geometry. Keep a blank/blocked map gated for recovery.
      const layers = basemapLayers.filter(id => !!map.getLayer(id));
      if (!layers.length || !map.queryRenderedFeatures(map.project(map.getCenter()), { layers }).length) return;
    }
    cleanup();
    ready();
  };
  const cleanup = () => { map.off('render', check); map.off('remove', cleanup); };
  map.on('render', check);
  map.on('remove', cleanup);
  map.triggerRepaint();
  return cleanup;
}

/** A layer toggle waits for its visible sources, independent of other overlays. */
export function layerSourcesReady(map: MapLibreMap, sources: readonly string[]): boolean {
  const layers = map.getStyle()?.layers ?? [];
  return sources.every(source => !layers.some(layer => 'source' in layer && layer.source === source
    && layer.layout?.visibility !== 'none') || !!map.getSource(source) && map.isSourceLoaded(source));
}
