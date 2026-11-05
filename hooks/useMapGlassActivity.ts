'use client';

import { useEffect, type RefObject } from 'react';
import { mapGlassScope, setMapGlassActivity } from '@/lib/map/adaptiveGlass';

/** Playback keeps cards opaque even when the camera is stationary. */
export function useMapGlassActivity(ref: RefObject<HTMLElement | null>, active: boolean) {
  useEffect(() => {
    if (!active) return;
    const scope = mapGlassScope(ref.current);
    if (!scope) return;
    const owner = {};
    setMapGlassActivity(scope, owner, true);
    return () => setMapGlassActivity(scope, owner, false);
  }, [ref, active]);
}
