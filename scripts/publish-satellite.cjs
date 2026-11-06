/* Standalone scheduled job; compiles only the renderer/publication modules.
 * Node >=22. No Next server, map UI or Python flood model is started.
 */
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');

async function main() {
  const envIndex = process.argv.indexOf('--env-file');
  if (envIndex >= 0) process.loadEnvFile(process.argv[envIndex + 1]);
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) throw new Error('Worker requires SUPABASE_URL and SUPABASE_SERVICE_KEY');
  if (process.env.NEXT_PUBLIC_SUPABASE_URL && new URL(url).origin !== new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).origin) {
    throw new Error('Worker and browser Supabase projects differ');
  }
  const root = path.resolve(__dirname, '..');
  const worker = path.join(root, 'infra/satellite-publisher');
  const runtime = fs.existsSync(path.join(worker, 'node_modules/typescript')) ? worker : root;
  const runtimeRequire = createRequire(path.join(runtime, 'package.json'));
  const ts = runtimeRequire('typescript');
  const directory = path.join(runtime, 'node_modules/.cache/satellite-publisher');
  fs.mkdirSync(directory, { recursive: true });
  const modules = {
    himawariSlider: 'lib/server/himawariSlider.ts',
    himawariFrameStore: 'lib/server/himawariFrameStore.ts',
    apiCache: 'lib/backend/apiCache.ts',
    himawariPublication: 'lib/map/himawariPublication.ts',
    himawariPublisher: 'lib/server/himawariPublisher.ts',
    himawariPublicationStore: 'lib/server/himawariPublicationStore.ts',
    himawariLegacyRetention: 'lib/server/himawariLegacyRetention.ts',
    himawariEncoding: 'lib/server/himawariEncoding.ts',
  };
  for (const [name, file] of Object.entries(modules)) {
    const source = fs.readFileSync(path.join(root, file), 'utf8')
      .replaceAll('@/lib/backend/apiCache', './apiCache')
      .replaceAll('@/lib/map/himawariPublication', './himawariPublication');
    fs.writeFileSync(path.join(directory, name + '.js'), ts.transpileModule(source, {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true },
    }).outputText);
  }
  const { createSatellitePublicationStore } = require(path.join(directory, 'himawariPublicationStore'));
  const { publishSatelliteFrames } = require(path.join(directory, 'himawariPublisher'));
  const { encodeSatelliteWebP } = require(path.join(directory, 'himawariEncoding'));
  const { scanEpoch, SATELLITE_RETENTION_MS } = require(path.join(directory, 'himawariPublication'));
  const { getHimawariAvailableStamps, getHimawariSliderPng } = require(path.join(directory, 'himawariSlider'));
  const store = createSatellitePublicationStore(url, key);
  console.log('Checking satellite bucket');
  await store.ensureBucket();
  console.log('Publishing completed satellite scans');
  const result = await publishSatelliteFrames(store,
    async () => (await getHimawariAvailableStamps()).map(String),
    async stamp => {
      console.log('Rendering scan ' + stamp);
      const frame = await getHimawariSliderPng(stamp);
      if (!frame || String(frame.stamp) !== stamp) throw new Error('Requested satellite scan unavailable');
      return encodeSatelliteWebP(frame.png);
    });
  const legacyDeleted = await store.cleanupLegacy();
  console.log(JSON.stringify({ ...result, legacyDeleted }));
  if (result.delayCause === 'source') console.log('::warning::The latest available CIRA scan is delayed; publication has caught up to the source.');
  if (result.delayCause === 'publication') console.log('::warning::Published imagery is behind the latest available CIRA scan.');
  if (result.upstreamUnavailable || result.failed.length || Date.now() - scanEpoch(result.latest) > SATELLITE_RETENTION_MS) process.exitCode = 1;
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
