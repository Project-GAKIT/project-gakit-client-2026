const { chromium } = require(process.env.GAKIT_PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const sharp = require('sharp');
const base = process.env.GAKIT_BASE_URL || 'http://localhost:3000';

(async () => {
  const browser = await chromium.launch({ channel: process.platform === 'win32' ? 'msedge' : undefined, headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const requests = [], errors = [];
    page.on('request', request => requests.push(request.url()));
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(() => {
      localStorage.setItem('gakit:first-visit-seen', 'true');
      localStorage.setItem('gakit:onboarding-v1', JSON.stringify({ version: 1, locationChoice: 'skipped', completedAt: new Date().toISOString() }));
    });
    const started = Date.now();
    await page.goto(base, { waitUntil: 'domcontentloaded' });
    await page.locator('canvas.maplibregl-canvas').waitFor();
    await page.locator('[role=status][aria-label="Loading page"][aria-hidden=false]').waitFor({ state: 'hidden', timeout: 14000 });
    const readyMs = Date.now() - started;
    assert(!requests.some(url => /\/(?:login|flood-scenarios)(?:\?|$)/.test(url)), 'Unopened portal routes never compete with map startup');
    assert(!requests.some(url => /lanao-del-norte-(?:flood-zones|landslide|storm-surge).*\.pmtiles|\/icons\/pagasa\//.test(url)), 'Disabled overlays never fetch during startup');
    const layerButton = label => page.getByRole('switch', { name: label, exact: true });
    await layerButton('Flood').waitFor();
    for (const [label, filename] of [['Flood', 'flood-zones'], ['Landslide', 'landslide'], ['Storm Surge', 'storm-surge-ssa4']]) {
      const fetched = page.waitForRequest(url => url.url().includes(`/data/lanao-del-norte-${filename}.pmtiles`));
      await layerButton(label).click(); await fetched;
      await layerButton(label).click();
    }
    assert(!requests.some(url => /storm-surge-ssa[123]\.pmtiles/.test(url)), 'Only the selected storm-surge archive loads');
    await page.route('**/api/v1/heat-index/grid?*', route => route.fulfill({ json: {
      source: 'fixture', unit: '°C', validAt: new Date().toISOString(), fetchedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 3600000).toISOString(), stale: false,
      bounds: { west: 116.5, east: 127, south: 4.5, north: 21.5 }, rows: 25, cols: 10,
      latitude: Array(25).fill(0), longitude: Array(10).fill(0), values: Array(250).fill(35), sampleCount: 250, refreshHours: 3,
    }, headers: { 'access-control-allow-origin': '*' } }));
    await page.evaluate(() => {
      const element = document.querySelector('.maplibregl-map');
      let fiber = element[Object.keys(element).find(key => key.startsWith('__reactFiber$'))];
      while (fiber && !window.weatherTestMap) {
        for (let hook = fiber.memoizedState; hook; hook = hook.next) {
          if (hook.memoizedState?.current?.getStyle) { window.weatherTestMap = hook.memoizedState.current; break; }
        }
        fiber = fiber.return;
      }
      window.weatherTestAlpha = async (lon, lat) => {
        const source = window.weatherTestMap.getSource('heat-index')?.serialize();
        if (!source?.url) return null;
        const [west, north] = source.coordinates[0], [east, south] = source.coordinates[2];
        if (lon < west || lon > east || lat < south || lat > north) return null;
        const image = new Image(); image.src = source.url; await image.decode();
        const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
        const ctx = canvas.getContext('2d'); ctx.drawImage(image, 0, 0);
        const my = y => Math.log(Math.tan(Math.PI / 4 + y * Math.PI / 360));
        return ctx.getImageData(Math.floor((lon - west) / (east - west) * canvas.width),
          Math.floor((my(north) - my(lat)) / (my(north) - my(south)) * canvas.height), 1, 1).data[3];
      };
    });
    await layerButton('Heat index').click();
    await page.waitForFunction(async () => await window.weatherTestAlpha(124.18, 8.25) === 0
      && await window.weatherTestAlpha(124.265, 8.24) === 255, {}, { timeout: 30000 });
    await page.getByRole('button', { name: 'Display settings', exact: true }).click();
    await page.getByRole('button', { name: 'Satellite', exact: true }).click();
    await page.keyboard.press('Escape');
    await page.evaluate(() => window.weatherTestMap.jumpTo({ center: [124.27, 7.96], zoom: 11 }));
    await page.waitForFunction(() => window.weatherTestMap.getSource('heat-index-water')
      && window.weatherTestMap.isSourceLoaded('heat-index-water'), {}, { timeout: 30000 });
    await page.waitForFunction(async () => await window.weatherTestAlpha(124.27, 7.96) === 0, {}, { timeout: 30000 });
    await layerButton('Heat index').click();
    await page.getByRole('button', { name: 'Display settings', exact: true }).click();
    await page.getByRole('button', { name: 'Light', exact: true }).click();
    await page.keyboard.press('Escape');
    await layerButton('Rainfall').click();
    const windows = page.getByRole('group', { name: 'Rainfall accumulation window' });
    await windows.waitFor();
    const time = windows.locator('..').locator('span').filter({ hasText: /^as of .*PHT$/ });
    for (const hours of [1, 4, 8, 12, 24]) {
      await windows.getByRole('button', { name: `${hours}h`, exact: true }).click();
      await page.locator('[aria-label="Loading Rainfall"]').first().waitFor({ state: 'hidden' });
      await time.waitFor();
      assert(!await page.getByText('as of unknown time', { exact: true }).count());
    }
    await layerButton('Rainfall').click();
    const image = await sharp({ create: { width: 1800, height: 1180, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).webp({ lossless: true }).toBuffer();
    const stamp = new Date(Date.now() - 40 * 60_000).toISOString().replace(/\D/g, '').slice(0, 14);
    await page.route('**/satellite-frames/himawari-v2/latest.json*', route => route.fulfill({ json: { schema: 'himawari-publication-v2', generated_at: new Date().toISOString(), frames: [{ stamp, bytes: image.length, sha256: 'a'.repeat(64) }] }, headers: { 'access-control-allow-origin': '*' } }));
    let releaseImage;
    const imageReady = new Promise(resolve => { releaseImage = resolve; });
    await page.route('**/satellite-frames/himawari-v2/frames/*.webp', async route => {
      await imageReady;
      await route.fulfill({ body: image, contentType: 'image/webp', headers: { 'access-control-allow-origin': '*' } });
    });
    await layerButton('Satellite imagery').click();
    const loader = page.locator('[aria-label="Loading page"][aria-hidden=false]');
    await loader.waitFor();
    assert.equal(await loader.count(), 1, 'Slow layer updates share the existing loading screen');
    assert.equal((await loader.locator('.flood-loader').boundingBox()).width, 80, 'Original water animation is preserved');
    const loadingText = loader.getByText('Updating satellite imagery…', { exact: true });
    await loadingText.waitFor();
    assert((await loadingText.boundingBox()).width > 20, 'The loading description is visible before any page navigation');
    assert.equal(await page.locator('[data-map-loading]').count(), 0, 'No loading text badge below the sidebar');
    releaseImage();
    await page.locator('[data-satellite-observed-at]').waitFor();
    assert.equal(await page.locator('[data-satellite-delayed]').count(), 0, 'Satellite controls show the timestamp without a delayed badge');
    await loader.waitFor({ state: 'hidden' });
    assert.deepEqual(errors, []);
    const proof = { passed: true, readyMs, noPortalPrefetch: true, lazyHazards: true, heatMask: { ocean: 0, land: 255, lake: 0 }, rainfallWindowsWithPhtTime: 5, satelliteTimestampOnly: true, originalWaterLoader: true, runtimeErrors: errors };
    console.log(JSON.stringify(proof));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
