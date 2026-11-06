import type { Map as MapLibreMap } from 'maplibre-gl';

/** Capture the visible basemap sources before project overlays are registered. */
export function basemapSourceIds(map: MapLibreMap): string[] {
  return [...new Set(map.getStyle().layers
    .filter(layer => layer.layout?.visibility !== 'none' && 'source' in layer)
    .map(layer => (layer as { source: string }).source))];
}

/** A painted basemap is usable even while optional overlays are still loading. */
export function onBasemapFrame(map: MapLibreMap, sources: string[], ready: () => void): () => void {
  const check = () => {
    if (!sources.every(id => map.getSource(id) && map.isSourceLoaded(id))) return;
    cleanup();
    ready();
  };
  const cleanup = () => { map.off('render', check); map.off('remove', cleanup); };
  map.on('render', check);
  map.on('remove', cleanup);
  map.triggerRepaint();
  return cleanup;
}
