const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { chromium } = require(process.env.GAKIT_PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.GAKIT_BASE_URL || 'http://localhost:3000';
const artifacts = process.env.GAKIT_APPEARANCE_ARTIFACTS || path.join(__dirname, 'artifacts', 'appearance');

async function theme(page, expected) {
  await page.waitForFunction(value => document.documentElement.dataset.theme === value, expected);
}
async function menu(page) {
  const button = page.getByRole('button', { name: 'Display settings', exact: true }).filter({ visible: true }).first();
  if (await button.getAttribute('aria-expanded') !== 'true') await button.click();
  await page.getByRole('radio', { name: 'System', exact: true }).waitFor();
}
async function select(page, appearance) {
  await menu(page);
  await page.getByRole('radio', { name: appearance, exact: true }).check();
}

(async () => {
  await fs.mkdir(artifacts, { recursive: true });
  const browser = await chromium.launch({ channel: process.platform === 'win32' ? 'msedge' : undefined, headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: 'light' });
    const requests = [];
    let failDark = false;
    // Deterministic style fixtures test appearance separately from tile/network
    // readiness. GAKIT_LIVE_MAPS=1 also exercises the real provider styles.
    await context.route('https://tiles.openfreemap.org/styles/**', async route => {
      const id = route.request().url().split('/').pop();
      requests.push(id);
      if (failDark && id === 'dark') return route.fulfill({ status: 503, body: 'Unavailable' });
      if (process.env.GAKIT_LIVE_MAPS === '1') return route.continue();
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ version: 8, name: id, sources: {}, layers: [{ id: 'background', type: 'background', paint: { 'background-color': id === 'dark' ? '#1c1c1c' : '#e9edf0' } }] }) });
    });
    await context.addInitScript(() => {
      localStorage.setItem('gakit:first-visit-seen', 'true');
      localStorage.setItem('gakit:scenario-disclaimer-seen', 'true');
      localStorage.setItem('gakit:onboarding:report-guide:v1', 'true');
      localStorage.setItem('gakit:onboarding:assessment-tour:v1', 'true');
      window.__appearanceFirstFrame = new Promise(resolve => requestAnimationFrame(() => resolve(document.documentElement.dataset.theme)));
    });
    const page = await context.newPage();
    const hydrationErrors = [];
    page.on('pageerror', error => hydrationErrors.push(error.message));
    page.on('console', message => { if (/hydration|did not match|hydrated.*didn't match/i.test(message.text())) hydrationErrors.push(message.text()); });
    await page.goto(base, { waitUntil: 'domcontentloaded' });
    await page.locator('canvas.maplibregl-canvas').first().waitFor();
    await theme(page, 'light');
    await menu(page);
    await page.screenshot({ path: path.join(artifacts, 'public-light-desktop.png') });
    await page.evaluate(() => { window.__appearanceCanvas = document.querySelector('canvas.maplibregl-canvas'); window.__appearanceDocument = document; });

    const cdp = await context.newCDPSession(page);
    await cdp.send('Tracing.start', { categories: 'devtools.timeline,blink.user_timing,disabled-by-default-devtools.screenshot', transferMode: 'ReturnAsStream' });
    await page.evaluate(() => performance.mark('appearance-switch-start'));
    await select(page, 'Dark');
    await theme(page, 'dark');
    await page.evaluate(() => performance.mark('appearance-root-dark'));
    assert(await page.evaluate(() => document === window.__appearanceDocument && document.querySelector('canvas.maplibregl-canvas') === window.__appearanceCanvas), 'Switch preserves the document and map canvas');
    const colors = await page.getByRole('group', { name: 'Appearance', exact: true }).evaluate(el => ({ panel: getComputedStyle(el).getPropertyValue('--surface-panel').trim(), text: getComputedStyle(el).color }));
    assert.equal(colors.panel, '28 28 28');
    await page.waitForTimeout(150);
    await page.screenshot({ path: path.join(artifacts, 'public-dark-desktop.png') });
    const traceReady = new Promise(resolve => cdp.once('Tracing.tracingComplete', resolve));
    await cdp.send('Tracing.end');
    const { stream } = await traceReady;
    let trace = '';
    while (true) { const chunk = await cdp.send('IO.read', { handle: stream }); trace += chunk.data; if (chunk.eof) break; }
    await cdp.send('IO.close', { handle: stream });
    await fs.writeFile(path.join(artifacts, 'theme-switch.trace.json'), trace);
    assert(requests.includes('dark'), 'Dark requests Dark Matter');

    // Explicit choice overrides the device, then System follows it.
    await page.emulateMedia({ colorScheme: 'light' }); await theme(page, 'dark');
    await select(page, 'System'); await theme(page, 'light');
    await page.emulateMedia({ colorScheme: 'dark' }); await theme(page, 'dark');
    await select(page, 'Light'); await theme(page, 'light');
    const peer = await context.newPage();
    await peer.goto(base + '/login', { waitUntil: 'domcontentloaded' });
    await peer.getByLabel('Email address', { exact: true }).fill('appearance-check@example.com');
    await select(page, 'Dark'); await theme(peer, 'dark');
    assert.equal(await peer.getByLabel('Email address', { exact: true }).inputValue(), 'appearance-check@example.com');
    await peer.reload({ waitUntil: 'domcontentloaded' });
    assert.equal(await peer.evaluate(() => window.__appearanceFirstFrame), 'dark', 'Refresh resolves dark before the first animation frame');
    await peer.screenshot({ path: path.join(artifacts, 'login-dark-desktop.png') });
    await page.evaluate(() => localStorage.removeItem('gakit.appearance.v1'));
    await theme(peer, 'light'); // peer's system is light
    await select(page, 'Light'); await theme(page, 'light');

    // Network failures leave the existing canvas working and allow retry.
    failDark = true;
    await select(page, 'Dark'); await theme(page, 'dark');
    await page.getByRole('button', { name: 'Retry', exact: true }).waitFor();
    assert(await page.getByRole('radio', { name: 'Light', exact: true }).isEnabled(), 'Style failure does not block interface controls');
    failDark = false;
    await page.getByRole('button', { name: 'Retry', exact: true }).click();
    await page.waitForFunction(() => !Array.from(document.querySelectorAll('button')).some(el => el.textContent === 'Retry'));

    for (const appearance of ['Light', 'Dark']) {
      await select(page, appearance);
      await page.setViewportSize({ width: 390, height: 844 });
      await menu(page);
      await page.screenshot({ path: path.join(artifacts, `public-${appearance.toLowerCase()}-mobile.png`) });
      assert(await page.getByRole('radio', { name: appearance, exact: true }).isChecked());
      await page.setViewportSize({ width: 1440, height: 900 });
    }

    await page.goto(base + '/flood-scenarios', { waitUntil: 'domcontentloaded' });
    await page.getByRole('region', { name: 'Flood simulation timeline', exact: true }).waitFor();
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(artifacts, 'scenario-dark-desktop.png') });
    await page.getByRole('button', { name: 'Next hour', exact: true }).click();
    const timeline = await page.getByRole('region', { name: 'Flood simulation timeline', exact: true }).textContent();
    await select(page, 'Light'); await theme(page, 'light');
    assert.equal(await page.getByRole('region', { name: 'Flood simulation timeline', exact: true }).textContent(), timeline, 'Switch preserves simulation time');
    await page.screenshot({ path: path.join(artifacts, 'scenario-light-desktop.png') });
    await page.setViewportSize({ width: 390, height: 844 });
    await select(page, 'Dark');
    await page.screenshot({ path: path.join(artifacts, 'scenario-dark-mobile.png') });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.getByRole('radio', { name: 'Light', exact: true }).focus();
    await page.keyboard.press('Space'); await theme(page, 'light');
    assert.equal(hydrationErrors.length, 0, hydrationErrors.join('\n'));
    await fs.writeFile(path.join(artifacts, 'results.json'), JSON.stringify({ requests, hydrationErrors, fixtureMaps: process.env.GAKIT_LIVE_MAPS !== '1', colors }, null, 2));
    console.log('Appearance smoke passed: pre-paint, persistence, System, cross-tab, retained form/map/timeline, failure retry, keyboard and mobile.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
