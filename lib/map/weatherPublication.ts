import { cachedGet } from '@/lib/backend/apiCache';

/** Public, credential-free map reads. Provider ingestion stays on the publisher. */
export function publicWeatherBase(bucket = 'weather-maps'): string | null {
  const configured = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!configured) return null;
  try {
    const url = new URL(configured);
    return url.protocol === 'https:' ? `${url.origin}/storage/v1/object/public/${bucket}` : null;
  } catch { return null; }
}

export async function publishedWeatherJSON<T>(path: string, bucket = 'weather-maps', maximum = 512_000): Promise<T> {
  const base = publicWeatherBase(bucket);
  if (!base) throw new Error('Weather publication is not configured');
  const result = await cachedGet<{ value: T } | { error: unknown }>(`weather-publication:${bucket}/${path}`, 60_000, async () => {
    try {
      const response = await fetch(`${base}/${path}`, { signal: AbortSignal.timeout(4_000) });
      if (!response.ok) throw new Error('Weather publication is unavailable');
      const text = await response.text();
      if (text.length > maximum) throw new Error('Weather publication exceeds size limit');
      return { value: JSON.parse(text) as T };
    } catch (error) { return { error }; }
  });
  if ('error' in result) throw result.error;
  return result.value;
}
