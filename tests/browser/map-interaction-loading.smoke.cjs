// Real map interaction regression: pending sources must not disable painted tiles.
const assert = require('node:assert/strict');
const { chromium } = require(process.env.GAKIT_PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.GAKIT_BASE_URL || 'http://localhost:3000';
(async () => {
  const browser = await chromium.launch({ channel: process.platform === 'win32' ? 'msedge' : undefined, headless: true });
  try {
    for (const width of [390, 1440]) {
      const page = await browser.newPage({ viewport: { width, height: 1000 } });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.addInitScript(() => {
        localStorage.setItem('gakit:first-visit-seen', 'true');
        localStorage.setItem('gakit:onboarding-v1', JSON.stringify({ version: 1, locationChoice: 'skipped', completedAt: new Date().toISOString() }));
      });
      await page.goto(base, { waitUntil: 'domcontentloaded' });
      await page.locator('.maplibregl-canvas').waitFor({ timeout: 45000 });
      await page.locator('[aria-label="Loading page"][aria-hidden=false]').waitFor({ state: 'hidden', timeout: 30000 });
      if (width < 768) {
        await page.getByRole('dialog', { name: 'See reports near you' }).waitFor();
        await page.keyboard.press('Escape');
      }
      await page.waitForFunction(() => {
        const element = document.querySelector('.maplibregl-map');
        let fiber = element?.[Object.keys(element).find(key => key.startsWith('__reactFiber$'))];
        while (fiber) {
          for (let hook = fiber.memoizedState; hook; hook = hook.next) {
            const map = hook.memoizedState?.current;
            if (map?.getSource && map?.getStyle) { window.testInteractionMap = map; return true; }
          }
          fiber = fiber.return;
        }
        return false;
      });
      await page.evaluate(() => window.testInteractionMap.jumpTo({ center: [124.265, 8.24], zoom: 14, pitch: 0 }));
      await page.waitForFunction(() => window.testInteractionMap.getLayer('assessment-water-mask') && window.testInteractionMap.isSourceLoaded('openmaptiles'), {}, { timeout: 30000 });
      await page.evaluate(() => {
        const map = window.testInteractionMap;
        const original = map.isSourceLoaded.bind(map);
        map.isSourceLoaded = id => id === 'openmaptiles' ? false : original(id);
        map.isStyleLoaded = () => false;
      });
      const coordinates = await page.evaluate(() => { const point = window.testInteractionMap.project([124.265, 8.24]); return { x: point.x, y: point.y }; });
      await page.locator('.maplibregl-canvas').click({ position: coordinates });
      await page.getByLabel('Selected location', { exact: true }).waitFor({ timeout: 15000 });
      assert.equal(await page.locator('[aria-label="Loading page"][aria-hidden=false]').count(), 0);
      await page.getByRole('button', { name: 'Display settings', exact: true }).click();
      const buildings = page.getByRole('switch', { name: 'Buildings', exact: true });
      if (await buildings.getAttribute('aria-checked') !== 'true') await buildings.click();
      await buildings.click();
      await page.waitForFunction(() => window.testInteractionMap.getLayoutProperty('iligan-buildings-2d', 'visibility') === 'none');
      await buildings.click();
      await page.waitForFunction(() => window.testInteractionMap.getLayoutProperty('iligan-buildings-2d', 'visibility') === 'visible');
      assert.equal(await page.locator('[aria-label="Loading page"][aria-hidden=false]').count(), 0);
      assert.deepEqual(errors, []);
      console.log(JSON.stringify({ width, pinOnPaintedTile: true, buildingsToggleDuringLoading: true, noBlockingOverlay: true }));
      await page.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
