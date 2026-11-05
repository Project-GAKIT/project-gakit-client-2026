import type { ScenarioData } from '@/types/scenario';

/** Keep compatibility with older deployments that only contain inline bundles. */
export async function fetchStaticScenario(url: string, signal: AbortSignal): Promise<ScenarioData> {
  const requestSignal = AbortSignal.any([signal, AbortSignal.timeout(20000)]);
  const manifest = url.replace('/data/scenarios/', '/data/scenario-assets/');
  let response = await fetch(manifest, { signal: requestSignal });
  if (response.status === 404 && manifest !== url) response = await fetch(url, { signal: requestSignal });
  if (!response.ok) throw new Error(`Scenario HTTP ${response.status}`);
  const data = await response.json() as ScenarioData;
  if (!Array.isArray(data.frames) || !Array.isArray(data.bounds) || data.bounds.length !== 4) {
    throw new Error('Scenario data is incomplete');
  }
  return data;
}
