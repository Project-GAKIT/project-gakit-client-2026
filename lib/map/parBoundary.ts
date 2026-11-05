import { PAR_BOUNDARY_GEOJSON } from './typhoon';
import { PAR_LINE_COLOR, PAR_LABEL_COLOR, PAR_LABEL_HALO } from '@/constants/publicMap';

/** Geographic reference overlay, independent of cyclone feed loading/toggles. */
export function syncParBoundary(map: any, visible = true) {
  const visibility = visible ? 'visible' : 'none';
  if (!map.getSource('par-outline')) {
    map.addSource('par-outline', {
      type: 'geojson', data: PAR_BOUNDARY_GEOJSON,
      attribution: 'PAR boundary: <a href="https://panahon.gov.ph/" target="_blank" rel="noopener">DOST-PAGASA (PANaHON)</a>',
    });
  }
  if (!map.getLayer('par-boundary-line')) {
    map.addLayer({
      id: 'par-boundary-line', type: 'line', source: 'par-outline',
      layout: { visibility },
      paint: { 'line-color': PAR_LINE_COLOR, 'line-width': 1.2, 'line-dasharray': [5, 4], 'line-opacity': 0.7 },
    });
  }
  if (!map.getLayer('par-boundary-label')) {
    map.addLayer({
      id: 'par-boundary-label', type: 'symbol', source: 'par-outline',
      layout: {
        visibility, 'text-field': 'PAR Boundary', 'text-size': 10,
        'text-font': ['Noto Sans Bold'], 'symbol-placement': 'line',
        'text-offset': [0, -0.8], 'text-allow-overlap': false,
      },
      paint: { 'text-color': PAR_LABEL_COLOR, 'text-halo-color': PAR_LABEL_HALO, 'text-halo-width': 1.2 },
    });
  }
  for (const id of ['par-boundary-line', 'par-boundary-label']) {
    map.setLayoutProperty(id, 'visibility', visibility);
  }
}
