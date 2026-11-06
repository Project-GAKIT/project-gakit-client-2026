// First-load regression: slow reports must not add a second full-screen loader.
const assert = require('node:assert/strict');
const { chromium } = require(process.env.GAKIT_PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.GAKIT_BASE_URL || 'http://localhost:3000';

(async () => {
  const browser = await chromium.launch({ channel: process.platform === 'win32' ? 'msedge' : undefined, headless: true });
  try {
    for (const width of [390, 1440]) {
      const page = await browser.newPage({ viewport: { width, height: 1000 } });
      const errors = [];
      const buildings = [];
      const lazyAssets = [];
      page.on('request', request => {
        if (/lanao-del-norte-(?:flood-zones|landslide|storm-surge).*\.pmtiles|\/icons\/pagasa\/|phl-heat-land\.geojson/.test(request.url())) lazyAssets.push(request.url());
      });
      await page.route('**/data/iligan-buildings.pmtiles', route => { buildings.push(route); });
      page.on('pageerror', error => errors.push(error.message));
      await page.addInitScript(() => {
        localStorage.setItem('gakit:first-visit-seen', 'true');
        window.startupLoaderEvents = [];
        const record = () => {
          const overlays = [...document.querySelectorAll('[role="status"][aria-label="Loading page"][aria-hidden="false"]')];
          const state = { count: overlays.length, label: overlays.map(e => e.textContent).join(' ') };
          const last = window.startupLoaderEvents.at(-1);
          if (!last || last.count !== state.count || last.label !== state.label) window.startupLoaderEvents.push(state);
        };
        new MutationObserver(record).observe(document, { subtree: true, childList: true, attributes: true, characterData: true });
      });
      let releaseStyle;
      const styleGate = new Promise(resolve => { releaseStyle = resolve; });
      let styleHeld = false;
      await page.route('**/tiles.openfreemap.org/styles/positron*', async route => {
        styleHeld = true;
        await styleGate;
        await route.fulfill({ json: { version: 8, sources: {}, layers: [
          { id: 'background', type: 'background', paint: { 'background-color': '#f1f5f9' } },
        ] } });
      });
      const reports = [];
      let holdReports = true;
      await page.route('**/api/v1/reports/map*', async route => {
        if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: {
          'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET, OPTIONS',
        } });
        if (holdReports) { reports.push(route); return; }
        await route.fulfill({ json: { features: [] }, headers: { 'access-control-allow-origin': '*' } });
      });
      await page.goto(base, { waitUntil: 'domcontentloaded' });
      const overlay = page.getByRole('status', { name: 'Loading page', exact: true, includeHidden: true });
      await page.waitForFunction(() => document.querySelectorAll('[role="status"][aria-label="Loading page"][aria-hidden="false"]').length === 1, {}, { timeout: 30000 });
      for (let i = 0; i < 300 && !styleHeld; i++) await page.waitForTimeout(50);
      assert(styleHeld, 'The map style was intercepted');
      await page.waitForTimeout(300);
      assert.equal(await overlay.getAttribute('aria-hidden'), 'false');
      releaseStyle();
      await page.waitForFunction(() => document.querySelector('[role="status"][aria-label="Loading page"]')?.getAttribute('aria-hidden') === 'true', {}, { timeout: 30000 });
      assert(reports.length > 0, 'Reports remain pending while the ready map is usable');
      assert.equal(await page.locator('canvas.maplibregl-canvas').count(), 1);
      assert(buildings.length > 0, 'Optional building archive is still pending');
      assert.deepEqual(lazyAssets, [], 'Disabled hazards, icons and assessment coastline are lazy');
      await Promise.all(buildings.splice(0).map(route => route.abort()));
      const before = await page.evaluate(() => window.startupLoaderEvents);
      assert(before.every(e => e.count <= 1 && !e.label.includes('Loading flood reports')));
      holdReports = false;
      await Promise.all(reports.splice(0).map(route => route.fulfill({ json: { features: [] }, headers: {
        'access-control-allow-origin': '*',
      } }).catch(() => {})));
      await page.waitForTimeout(500);
      assert.equal(await overlay.getAttribute('aria-hidden'), 'true');
      const events = await page.evaluate(() => window.startupLoaderEvents);
      const starts = events.filter((event, i) => event.count > 0 && (i === 0 || events[i - 1].count === 0));
      assert.equal(starts.length, 1, 'One continuous startup loading period');
      assert.deepEqual(errors, []);
      console.log(JSON.stringify({ width, passed: true, singleStartupLoader: true, reportsDoNotBlockMap: true }));
      await page.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
