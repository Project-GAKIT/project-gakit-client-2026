const { chromium } = require(process.env.GAKIT_PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const sharp = require('sharp');
const base = process.env.GAKIT_BASE_URL || 'http://localhost:3000';
const output = path.resolve(process.env.GAKIT_SCREENSHOT_DIR || '../downloads/weather-startup');

(async () => {
  fs.mkdirSync(output, { recursive: true });
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
    await page.screenshot({ path: path.join(output, 'rainfall-time.png') });
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
    const loader = page.locator('[data-map-loading]');
    await loader.waitFor();
    assert.equal(await loader.count(), 1, 'Slow layer updates have one local indicator');
    assert.equal(await page.locator('[aria-label="Loading page"][aria-hidden=false]').count(), 0, 'Layer downloads never block the page');
    assert.equal(await loader.getAttribute('class').then(value => value.includes('pointer-events-none')), true, 'Layer indicator cannot capture map taps');
    await page.screenshot({ path: path.join(output, 'water-loader.png') });
    releaseImage();
    await page.locator('[data-satellite-delayed]').waitFor();
    await loader.waitFor({ state: 'hidden' });
    await page.screenshot({ path: path.join(output, 'satellite-delay.png') });
    assert.deepEqual(errors, []);
    const proof = { passed: true, readyMs, noPortalPrefetch: true, lazyHazards: true, rainfallWindowsWithPhtTime: 5, sourceDelayVisible: true, nonBlockingLayerIndicator: true, runtimeErrors: errors };
    fs.writeFileSync(path.join(output, 'checks.json'), JSON.stringify(proof, null, 2));
    console.log(JSON.stringify(proof));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
