import { NextResponse } from 'next/server';
import {
  enrichTyphoonTrackGeoJson,
  formatTyphoonDisplayName,
  PAR_BOUNDARY_GEOJSON,
} from '@/lib/map/typhoon';
import { fetchPanahonLiveCyclone } from '@/lib/map/panahon';
import type { TyphoonApiResponse } from '@/types/typhoon';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

const LIVE_CACHE_HEADERS = {
  'Cache-Control': 'public, max-age=0, s-maxage=30, stale-while-revalidate=60',
};

const HISTORICAL_CACHE_HEADERS = {
  'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
};

const NO_STORE_HEADERS = {
  'Cache-Control': 'no-store',
};

// Keep the last good live payload in memory so a transient backend/Panahon
// failure cannot make the UI drop a storm whose track is still valid.
const LAST_LIVE_TTL_MS = 30 * 60 * 1000;
let lastLivePayload: { payload: TyphoonApiResponse; storedAt: number } | null = null;

function rememberLivePayload(payload: TyphoonApiResponse): void {
  if (payload.hasActiveTyphoon && !payload.isHistorical) {
    lastLivePayload = { payload, storedAt: Date.now() };
  }
}

function recentLivePayload(): TyphoonApiResponse | null {
  if (!lastLivePayload) return null;
  if (Date.now() - lastLivePayload.storedAt > LAST_LIVE_TTL_MS) return null;
  return lastLivePayload.payload;
}

async function fetchServerTyphoonTrack(stormName?: string | null): Promise<TyphoonApiResponse> {
  const query = stormName ? `?stormName=${encodeURIComponent(stormName)}` : '';
  const endpoint = `${API_URL.replace(/\/+$/, '')}/api/v1/typhoon/track${query}`;
  try {
    const res = await fetch(endpoint, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'ProjectGakit-Client/1.0',
      },
      signal: AbortSignal.timeout(4000),
      ...(stormName
        ? { next: { revalidate: 3600 } }
        : { cache: 'no-store' as const }),
    });

    if (res.ok) {
      const data = await res.json();
      const isHistorical = Boolean(data.isHistorical || stormName);
      const enrichedTrack = enrichTyphoonTrackGeoJson(
        data.track || { type: 'FeatureCollection', features: [] },
        { isHistorical }
      );
      const cleanStormName = data.stormName
        ? formatTyphoonDisplayName(data.stormName)
        : (data.activeStorms?.[0]?.name ? formatTyphoonDisplayName(data.activeStorms[0].name) : null);

      const payload: TyphoonApiResponse = {
        track: enrichedTrack,
        par: data.par || PAR_BOUNDARY_GEOJSON,
        hasActiveTyphoon: Boolean(data.hasActiveTyphoon),
        isHistorical,
        stormName: cleanStormName,
        stormCategory: data.stormCategory || null,
        activeStorms: Array.isArray(data.activeStorms) ? data.activeStorms : [],
        latestPosition: data.latestPosition || null,
        fetchedAt: data.fetchedAt || null,
        source: data.source || 'DOST-PAGASA PANAHON',
      };
      rememberLivePayload(payload);
      if (!isHistorical && !payload.hasActiveTyphoon) {
        // A healthy backend is authoritative: the storm has ended.
        lastLivePayload = null;
      }
      return payload;
    }
  } catch {
    // Backend offline during standalone client dev
  }

  // Direct DOST-PAGASA Panahon fallback (used when FastAPI backend is offline during local client dev)
  if (!stormName) {
    try {
      const livePanahon = await fetchPanahonLiveCyclone();
      if (livePanahon && Array.isArray(livePanahon.features) && livePanahon.features.length > 0) {
        const enrichedTrack = enrichTyphoonTrackGeoJson(livePanahon);
        const pointFeatures = enrichedTrack.features.filter((f: any) => f.geometry?.type === 'Point');
        const hasActive = pointFeatures.length > 0;
        const latestFeature = hasActive ? pointFeatures[pointFeatures.length - 1] : null;
        const fallbackStormName = latestFeature?.properties?.typhoon_name
          ? formatTyphoonDisplayName(
              latestFeature.properties.typhoon_name,
              latestFeature.properties?.international_name
            )
          : 'Active Cyclone';
        const stormCategory = latestFeature?.properties?.typhoon_type || null;

        const payload: TyphoonApiResponse = {
          track: enrichedTrack,
          par: PAR_BOUNDARY_GEOJSON,
          hasActiveTyphoon: hasActive,
          isHistorical: false,
          stormName: fallbackStormName,
          stormCategory,
          activeStorms: [],
          latestPosition:
            latestFeature && latestFeature.geometry && 'coordinates' in latestFeature.geometry
              ? {
                  lng: (latestFeature.geometry as any).coordinates[0],
                  lat: (latestFeature.geometry as any).coordinates[1],
                  windspeed: latestFeature.properties?.windspeed,
                  pressure: latestFeature.properties?.pressure,
                  category: latestFeature.properties?.typhoon_type,
                  datetime: latestFeature.properties?.datetime,
                  isInsidePar: latestFeature.properties?.isInsidePar ?? latestFeature.properties?.is_inside_par,
                }
              : null,
          source: 'DOST-PAGASA PANAHON',
        };
        rememberLivePayload(payload);
        return payload;
      }
    } catch (err) {
      console.error('Direct Panahon fetch error:', err);
    }
  }

  return {
    track: { type: 'FeatureCollection', features: [] },
    par: PAR_BOUNDARY_GEOJSON,
    hasActiveTyphoon: false,
    isHistorical: Boolean(stormName),
    stormName: null,
    stormCategory: null,
    activeStorms: [],
    latestPosition: null,
    source: 'DOST-PAGASA PANAHON',
  };
}

async function fetchHistoricalStorms(): Promise<any[]> {
  const endpoint = `${API_URL.replace(/\/+$/, '')}/api/v1/typhoon/history`;
  const res = await fetch(endpoint, {
    headers: { Accept: 'application/json', 'User-Agent': 'ProjectGakit-Client/1.0' },
    signal: AbortSignal.timeout(12000),
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`Storm archive returned ${res.status}`);
  const history: unknown = await res.json();
  if (!Array.isArray(history)) throw new Error('Invalid storm archive response');
  return history;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    if (searchParams.get('history') === 'true') {
      try {
        const history = await fetchHistoricalStorms();
        return NextResponse.json(history, { headers: { 'Cache-Control': 'no-store' } });
      } catch (error) {
        console.error('Storm archive unavailable:', error);
        return NextResponse.json({ error: 'Storm archive temporarily unavailable' }, {
          status: 503, headers: { 'Cache-Control': 'no-store' },
        });
      }
    }

    const stormName = searchParams.get('stormName');
    const payload = await fetchServerTyphoonTrack(stormName);
    const resolved =
      !stormName && !payload.hasActiveTyphoon ? (recentLivePayload() ?? payload) : payload;
    const headers = stormName
      ? HISTORICAL_CACHE_HEADERS
      : resolved.hasActiveTyphoon
        ? LIVE_CACHE_HEADERS
        : NO_STORE_HEADERS;
    return NextResponse.json(resolved, {
      headers,
    });
  } catch (error) {
    console.error('Typhoon track route error:', error);
    const cached = recentLivePayload();
    if (cached) {
      return NextResponse.json(cached, {
        status: 200,
        headers: NO_STORE_HEADERS,
      });
    }
    return NextResponse.json(
      {
        track: { type: 'FeatureCollection', features: [] },
        par: PAR_BOUNDARY_GEOJSON,
        hasActiveTyphoon: false,
        isHistorical: false,
        stormName: null,
        stormCategory: null,
        activeStorms: [],
        latestPosition: null,
        source: 'DOST-PAGASA PANAHON',
      },
      {
        status: 200,
        headers: NO_STORE_HEADERS,
      }
    );
  }
}
