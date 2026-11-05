'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { BasemapStyleRequest } from '@/lib/map/basemapStyleRequest';
import type { BasemapId } from '@/constants/publicMap';
import type { StyleSpecification } from 'maplibre-gl';

export function useBasemapStyle() {
  const request = useRef(new BasemapStyleRequest());
  const retry = useRef<(() => void) | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => { const active = request.current; return () => active.cancel(); }, []);
  const changeStyle = useCallback((basemap: BasemapId, apply: (style: StyleSpecification) => void) => {
    setFailed(false);
    const run = () => {
      setFailed(false);
      void request.current.load(basemap, apply).catch(() => setFailed(true));
    };
    retry.current = run;
    run();
  }, []);
  const errorNotice = failed ? (
    <div role="status" className="absolute bottom-12 left-3 z-[1200] flex items-center gap-2 rounded-lg border border-error-border bg-panel px-3 py-2 text-xs text-primary shadow-md">
      Basemap unavailable. <button type="button" className="underline" onClick={() => retry.current?.()}>Retry</button>
    </div>
  ) : null;
  return { changeStyle, errorNotice };
}
