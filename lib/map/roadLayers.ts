import {
  ROAD_CASING_COLOR,
  ROAD_CASING_OPACITY,
  ROAD_MAJOR_OPACITY,
  ROAD_MINOR_COLOR,
  ROAD_MINOR_COLOR_DARK,
  ROAD_MINOR_OPACITY,
  ROAD_PRIMARY_COLOR,
  ROAD_PRIMARY_COLOR_DARK,
  ROAD_SECONDARY_COLOR,
  ROAD_SECONDARY_COLOR_DARK,
  isDarkBasemap,
  type BasemapId,
  ROADS_MAJOR_MIN_ZOOM,
  ROADS_MINOR_MIN_ZOOM,
} from '@/constants/publicMap';
import { getBasemapRoadOverlayAnchor } from '@/lib/map/basemapLayers';

export const ROAD_CASING_LAYER_ID = 'iligan-roads-casing';
export const ROAD_MINOR_CASING_LAYER_ID = 'iligan-roads-minor-casing';
export const ROAD_MAJOR_LAYER_ID = 'iligan-roads-major';
export const ROAD_MINOR_LAYER_ID = 'iligan-roads-minor';

export const ROAD_LAYER_IDS = [
  ROAD_CASING_LAYER_ID,
  ROAD_MINOR_CASING_LAYER_ID,
  ROAD_MAJOR_LAYER_ID,
  ROAD_MINOR_LAYER_ID,
] as const;

const roadFocusActive = new WeakSet<object>();
const requestedRoadVisibility = new WeakMap<object, boolean>();

export function setRoadFocusActive(map: any, active: boolean) {
  const visible = requestedRoadVisibility.get(map) ?? ROAD_LAYER_IDS.some(
    id => map.getLayer(id) && map.getLayoutProperty(id, 'visibility') !== 'none'
  );
  if (active) roadFocusActive.add(map);
  else roadFocusActive.delete(map);
  applyRoadsVisibility(map, visible);
}

// All variants read the same source-layer of the same PMTiles source.
const SOURCE_LAYER = { 'source-layer': 'roads' } as const;

// Walkways (footway/path/steps/pedestrian) are deliberately excluded: at city
// zoom they add clutter without helping road context.
const MAJOR_CLASSES = ['trunk', 'primary', 'secondary', 'tertiary'];
const MINOR_CLASSES = ['residential', 'unclassified', 'service', 'track'];

const classFilter = (classes: string[]) => [
  'match',
  ['get', 'class'],
  classes,
  true,
  false,
];

// Shared by context roads and flood-depth highlights on every map surface.
export const ROAD_STROKE_WIDTH = ['interpolate', ['linear'], ['zoom'], 11, 1.5, 15, 4, 18, 9];
export const ROAD_OUTLINE_WIDTH = ['interpolate', ['linear'], ['zoom'], 11, 3, 15, 7, 18, 13];

// Neutral road context; flood focus supplies the depth colors when active.
export const addRoadLayers = (
  map: any,
  sourceId: string,
  before?: string,
  visible = true,
  basemap?: BasemapId
) => {
  requestedRoadVisibility.set(map, visible);
  const visibility = visible && !roadFocusActive.has(map) ? 'visible' : 'none';
  const dark = isDarkBasemap(basemap);

  for (const { id, classes, minzoom } of [
    { id: ROAD_CASING_LAYER_ID, classes: MAJOR_CLASSES, minzoom: ROADS_MAJOR_MIN_ZOOM },
    { id: ROAD_MINOR_CASING_LAYER_ID, classes: MINOR_CLASSES, minzoom: ROADS_MINOR_MIN_ZOOM },
  ]) map.addLayer(
    {
      id,
      type: 'line',
      source: sourceId,
      ...SOURCE_LAYER,
      minzoom,
      filter: classFilter(classes),
      layout: { visibility, 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': ROAD_CASING_COLOR,
        'line-opacity': ROAD_CASING_OPACITY,
        'line-width': ROAD_OUTLINE_WIDTH,
      },
    },
    before
  );

  map.addLayer(
    {
      id: ROAD_MAJOR_LAYER_ID,
      type: 'line',
      source: sourceId,
      ...SOURCE_LAYER,
      minzoom: ROADS_MAJOR_MIN_ZOOM,
      filter: classFilter(MAJOR_CLASSES),
      layout: { visibility, 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': [
          'match',
          ['get', 'class'],
          ['trunk', 'primary'],
          dark ? ROAD_PRIMARY_COLOR_DARK : ROAD_PRIMARY_COLOR,
          dark ? ROAD_SECONDARY_COLOR_DARK : ROAD_SECONDARY_COLOR,
        ],
        'line-opacity': ROAD_MAJOR_OPACITY,
        'line-width': ROAD_STROKE_WIDTH,
      },
    },
    before
  );

  map.addLayer(
    {
      id: ROAD_MINOR_LAYER_ID,
      type: 'line',
      source: sourceId,
      ...SOURCE_LAYER,
      minzoom: ROADS_MINOR_MIN_ZOOM,
      filter: classFilter(MINOR_CLASSES),
      layout: { visibility, 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': dark ? ROAD_MINOR_COLOR_DARK : ROAD_MINOR_COLOR,
        'line-opacity': ROAD_MINOR_OPACITY,
        'line-width': ROAD_STROKE_WIDTH,
      },
    },
    before
  );
  reorderRoadLayers(map);
};

// Keep road casings, centers, and minor roads above footprint fills and below
// native labels after either layer family gets reinserted.
export const reorderRoadLayers = (map: any) => {
  if (!map) return;
  try {
    const labelLayer = getBasemapRoadOverlayAnchor(map);
    const anchor = labelLayer ?? (map.getLayer?.('report-clusters') ? 'report-clusters' : undefined);
    if (anchor) {
      let before = anchor;
      for (const id of [...ROAD_LAYER_IDS].reverse()) {
        if (!map.getLayer?.(id)) continue;
        map.moveLayer(id, before);
        before = id;
      }
    }
  } catch {
    /* style not loaded yet */
  }
};

// Toggles visibility for all road layers and restores their stacking order.
export const applyRoadsVisibility = (map: any, visible: boolean) => {
  if (!map) return;
  requestedRoadVisibility.set(map, visible);
  try {
    // Existing layers can be updated while source tiles are still loading.
    // Waiting for isStyleLoaded() can leave restored context roads visible
    // after flood focus is detached and the Roads switch has been turned off.
    const visibility = visible && !roadFocusActive.has(map) ? 'visible' : 'none';
    ROAD_LAYER_IDS.forEach((id) => {
      if (map?.getLayer?.(id)) map.setLayoutProperty(id, 'visibility', visibility);
    });
    reorderRoadLayers(map);
  } catch {
    /* style not loaded yet */
  }
};
