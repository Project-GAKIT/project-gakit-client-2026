'use client';

import { useEffect, useRef, useState } from 'react';
import type { Map as LibreMap } from 'maplibre-gl';
import { BASEMAP_STYLES } from '@/constants/publicMap';
import { BasemapStyleRequest } from '@/lib/map/basemapStyleRequest';
import { themeStore } from '@/lib/theme/store';

/** Read-only previews are initialized on demand so offscreen report cards do
 * not allocate WebGL contexts or download tiles. Theme changes reuse the map. */
export function ThemedMapPreview({ latitude, longitude }: { latitude: number; longitude: number }) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<LibreMap | null>(null);
  const location = useRef({ latitude, longitude });
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    location.current = { latitude, longitude };
    map.current?.jumpTo({ center: [longitude, latitude] });
  }, [latitude, longitude]);

  useEffect(() => {
    const element = container.current;
    if (!element) return;
    let alive = true;
    let started = false;
    let unsubscribe = () => {};
    const request = new BasemapStyleRequest();
    const observer = new IntersectionObserver(entries => {
      if (started || !entries.some(entry => entry.isIntersecting)) return;
      started = true;
      observer.disconnect();
      void import('maplibre-gl').then(libre => {
        if (!alive) return;
        libre.setWorkerUrl('/vendor/maplibre-gl/maplibre-gl-worker.mjs');
        const instance = new libre.Map({
          container: element, style: BASEMAP_STYLES[themeStore.getSnapshot().resolved],
          center: [location.current.longitude, location.current.latitude], zoom: 15,
          interactive: false, attributionControl: false, renderWorldCopies: false,
        });
        map.current = instance;
        instance.on('style.load', () => { if (alive) setFailed(false); });
        instance.on('error', () => { if (alive && !instance.isStyleLoaded()) setFailed(true); });
        unsubscribe = themeStore.subscribe(() => {
          void request.load(themeStore.getSnapshot().resolved, style => {
            if (alive) instance.setStyle(style, { diff: false });
          }).catch(() => { if (alive) setFailed(true); });
        });
      }).catch(() => { if (alive) setFailed(true); });
    }, { rootMargin: '100px' });
    observer.observe(element);
    const resize = new ResizeObserver(() => map.current?.resize());
    resize.observe(element);
    return () => { alive = false; observer.disconnect(); resize.disconnect(); unsubscribe(); request.cancel(); map.current?.remove(); map.current = null; };
  }, []);

  return <>
    <div ref={container} aria-hidden="true" className="pointer-events-none absolute inset-0" />
    {failed && <span className="absolute inset-0 flex items-center justify-center bg-panel text-xs text-secondary">Map unavailable</span>}
  </>;
}
