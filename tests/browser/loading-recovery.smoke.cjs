const assert = require('node:assert/strict');
const { chromium } = require(process.env.GAKIT_PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.GAKIT_BASE_URL || 'http://localhost:3000';

(async () => {
  const browser = await chromium.launch({ channel: process.platform === 'win32' ? 'msedge' : undefined, headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await context.addInitScript(() => localStorage.setItem('gakit:scenario-disclaimer-seen', 'true'));
    const page = await context.newPage();
    let failScenario = true;
    await page.route('**/data/scenario-assets/sendong.json', route => failScenario
      ? route.fulfill({ status: 503, body: 'unavailable' }) : route.continue());
    const requested = [];
    page.on('request', request => requested.push(request.url()));
    await page.goto(base + '/flood-scenarios', { waitUntil: 'domcontentloaded' });
    const loader = page.locator('[role="status"][aria-label="Loading page"][aria-hidden="false"]');
    await page.waitForSelector('[data-scenario-header-slot] button');
    await page.getByRole('button', { name: 'Retry', exact: true }).waitFor();
    failScenario = false;
    await page.getByRole('button', { name: 'Retry', exact: true }).click();
    await loader.waitFor({ state: 'hidden', timeout: 30000 });
    assert(requested.some(url => url.endsWith('/scenario-assets/sendong.json')));
    assert(!requested.some(url => url.endsWith('/scenarios/sendong.json')));
    const images = requested.filter(url => /\/scenario-assets\/.*\.png$/.test(url));
    assert.equal(images.length, 1, 'Only the initial scenario raster is requested');
    await page.locator('[data-scenario-header]').getByRole('button', { name: /Change scenario/ }).click();
    await Promise.all([
      page.waitForResponse(response => response.url().endsWith('/scenario-assets/basyang.json')),
      page.getByRole('option', { name: /Tropical Storm Basyang/ }).click(),
    ]);
    console.log('Scenario failure/retry, compact load, on-demand image, and switching passed');
    await page.evaluate(() => {
      window.loadingLabels = [];
      new MutationObserver(() => {
        const active = document.querySelector('[role="status"][aria-label="Loading page"][aria-hidden="false"]');
        if (active) window.loadingLabels.push(active.textContent.trim());
      }).observe(document.body, { subtree: true, attributes: true, childList: true, characterData: true });
    });
    await page.getByRole('button', { name: 'Back to Hazard Map', exact: true }).click();
    await page.waitForURL(base + '/');
    await loader.waitFor({ state: 'hidden', timeout: 30000 });
    const labels = await page.evaluate(() => window.loadingLabels);
    assert(labels.length > 0 && labels.every(label => label === 'Loading map…'), 'Return navigation keeps one map-loading label');
    await page.goBack({ waitUntil: 'domcontentloaded' });
    await page.waitForURL(base + '/flood-scenarios');
    await loader.waitFor({ state: 'hidden', timeout: 30000 });
    console.log('Return navigation and browser Back complete without a generic loading-page handoff');
    await page.close();

    const iconPage = await context.newPage();
    const icons = [];
    await iconPage.route('**/icons/pagasa/*.png', route => { icons.push(route); });
    const iconRequest = iconPage.waitForRequest('**/icons/pagasa/*.png');
    await iconPage.goto(base + '/', { waitUntil: 'domcontentloaded' });
    await iconPage.locator('[data-public-map-shell]').waitFor();
    await iconRequest;
    await iconPage.locator('[role="status"][aria-label="Loading page"][aria-hidden="false"]').waitFor({ state: 'hidden', timeout: 14000 });
    assert(icons.length > 0, 'Icon requests are still pending when the map becomes ready');
    await Promise.all(icons.map(route => route.abort()));
    console.log('Pending typhoon icons do not block map readiness');
    await iconPage.close();

    const recoveryPage = await context.newPage();
    const styles = [];
    await recoveryPage.route('https://tiles.openfreemap.org/styles/*', route => { styles.push(route); });
    await recoveryPage.goto(base + '/', { waitUntil: 'domcontentloaded' });
    const retry = recoveryPage.getByRole('button', { name: 'Reload page', exact: true });
    await retry.waitFor({ timeout: 23000 });
    assert(styles.length > 0, 'The basemap request is stalled');
    assert(await retry.isEnabled(), 'Stalled startup provides a working recovery control');
    await Promise.all(styles.map(route => route.continue()));
    await recoveryPage.locator('[role="status"][aria-label="Loading page"][aria-hidden="false"]').waitFor({ state: 'hidden', timeout: 30000 });
    assert.equal(await retry.count(), 0, 'Recovery controls disappear once the map is ready');
    console.log('Stalled startup offers recovery and finishes when the request resumes');
    await context.close();
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
