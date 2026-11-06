// Node >=22 + Edge; tests map lifecycle and request counts with a numeric fixture.
const fs = require('node:fs'), path = require('node:path'), os = require('node:os'), assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const base = process.env.GAKIT_BASE_URL || 'http://localhost:3000';
const output = process.env.GAKIT_SCREENSHOT_DIR || path.resolve('../downloads/forecast-wind');
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'gakit-forecast-browser-'));
const browser = spawn(process.env.GAKIT_EDGE_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  ['--headless', '--enable-unsafe-swiftshader', '--no-first-run', '--no-default-browser-check', '--remote-debugging-port=0', '--user-data-dir=' + profile, 'about:blank'],
  { windowsHide: true, stdio: 'ignore' });
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const start = new Date(); start.setUTCMinutes(0, 0, 0);
const stamp = h => new Date(+start + h * 3600000).toISOString();
let grid = { model: 'ecmwf_ifs', source: 'ECMWF IFS Open Data', issuedAt: stamp(0), rainResolutionDegrees: .1, nativeIntervalHours: 3, fetchedAt: new Date().toISOString(),
  expiresAt: stamp(12), stale: false, rainUnit: 'mm', windUnit: 'm/s', sampleSpacingDegrees: 1,
  bounds: { west: 105, east: 150, south: -.2, north: 29.2 }, rows: 2, cols: 2,
  latitude: [21.85, 7.15], longitude: [116.25, 138.75], times: Array.from({ length: 80 }, (_, h) => stamp(h)),
  frames: Array.from({ length: 80 }, (_, h) => ({ rasterUrl: '/api/v1/weather/forecast-grid/assets/' + 'a'.repeat(24) + '/3.png', rainWindowEndAt: stamp(3 * Math.max(1, Math.ceil(h / 3))), u: Array(4).fill(h < 24 ? 7 : -7), v: Array(4).fill(3) })) };
let socket, sequence = 0, forecastRequests = 0, rainfallGeojsonRequests = 0;
const pending = new Map(), errors = [];
function command(method, params = {}) { return new Promise((resolve, reject) => {
  const id = ++sequence; pending.set(id, { resolve, reject }); socket.send(JSON.stringify({ id, method, params }));
}); }
async function evaluate(expression) {
  const r = await command('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw Error(JSON.stringify(r.exceptionDetails));
  return r.result.value;
}
async function waitFor(expression) { for (let i = 0; i < 240; i++) { if (await evaluate(expression)) return; await pause(150); } throw Error('Timed out: ' + expression); }
async function click(selector) { await evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`); }
async function button(label) { await evaluate(`Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === ${JSON.stringify(label)}).click()`); }
async function screenshot(name) { const r = await command('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(path.join(output, name), Buffer.from(r.data, 'base64')); }
async function main() {
  fs.mkdirSync(output, { recursive: true });
  if (process.env.GAKIT_REAL_FORECAST === '1') {
    grid = await (await fetch('http://localhost:4000/api/v1/weather/forecast-grid')).json();
    assert.equal(grid.rainResolutionDegrees, .1, 'Live map uses actual 0.1-degree rainfall');
  }
  const portFile = path.join(profile, 'DevToolsActivePort');
  for (let i = 0; i < 150 && !fs.existsSync(portFile); i++) await pause(100);
  const port = fs.readFileSync(portFile, 'utf8').split(/\r?\n/)[0];
  const targets = await (await fetch('http://127.0.0.1:' + port + '/json')).json();
  socket = new WebSocket(targets.find(t => t.type === 'page').webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); });
  socket.addEventListener('message', async event => {
    const m = JSON.parse(event.data);
    if (m.id) { const p = pending.get(m.id); pending.delete(m.id); if (m.error) p.reject(Error(JSON.stringify(m.error))); else p.resolve(m.result); }
    if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails);
    if (m.method === 'Fetch.requestPaused') {
      const { requestId, request } = m.params;
      let body;
      if (request.url.includes('/weather-maps/forecast/browser.json') || request.url.includes('/weather-maps/rainfall/latest.json')) {
        if (process.env.GAKIT_REAL_FORECAST === '1') {
          if (request.url.includes('forecast/browser.json')) forecastRequests++;
          await command('Fetch.continueRequest', { requestId });
        } else {
          await command('Fetch.fulfillRequest', { requestId, responseCode: 503, responseHeaders: [{ name: 'access-control-allow-origin', value: '*' }], body: Buffer.from('{}').toString('base64') });
        }
        return;
      }
      if (request.url.includes('/forecast-grid/assets/')) {
        if (process.env.GAKIT_REAL_FORECAST === '1') await command('Fetch.continueRequest', { requestId });
        else await command('Fetch.fulfillRequest', { requestId, responseCode: 200, responseHeaders: [{ name: 'content-type', value: 'image/png' }, { name: 'access-control-allow-origin', value: '*' }], body: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR4nGNgAAIAAAUAAXpeqz8AAAAASUVORK5CYII=' });
        return;
      }
      if (request.url.includes('/weather/forecast-grid')) { if (request.method !== 'OPTIONS') forecastRequests++; body = grid; }
      else if (request.url.includes('/rainfall/gsmap')) { rainfallGeojsonRequests++; body = { type: 'FeatureCollection', properties: { source: 'JAXA GSMaP_NOW', observedAt: stamp(0).replace('Z', ''), accumulationHours: 1 }, features: [] }; }
      else if (request.url.includes('tiles.openfreemap.org/styles/') && process.env.GAKIT_REAL_FORECAST !== '1') body = { version: 8, sources: {}, layers: [{ id: 'background', type: 'background', paint: { 'background-color': '#e8edf0' } }] };
      if (body) await command('Fetch.fulfillRequest', { requestId, responseCode: 200,
        responseHeaders: [{ name: 'content-type', value: 'application/json' }, { name: 'access-control-allow-origin', value: '*' }, { name: 'access-control-allow-headers', value: '*' }],
        body: Buffer.from(request.method === 'OPTIONS' ? '' : JSON.stringify(body)).toString('base64') });
      else await command('Fetch.continueRequest', { requestId });
    }
  });
  await command('Page.enable'); await command('Runtime.enable');
  await command('Fetch.enable', { patterns: [{ urlPattern: '*weather/forecast-grid*' }, { urlPattern: '*rainfall/gsmap*' }, { urlPattern: '*/weather-maps/forecast/browser.json' }, { urlPattern: '*/weather-maps/rainfall/latest.json' }, { urlPattern: '*tiles.openfreemap.org/styles/*' }] });
  await command('Page.addScriptToEvaluateOnNewDocument', { source: `
    localStorage.setItem('gakit:first-visit-seen','true');
    localStorage.setItem('gakit:onboarding-v1',JSON.stringify({version:1,locationChoice:'skipped',completedAt:new Date().toISOString()}));
    window.windProfile={strokes:0,webgl:0};
    const stroke=CanvasRenderingContext2D.prototype.stroke;
    CanvasRenderingContext2D.prototype.stroke=function(...args){if(this.canvas.dataset.windTrails)window.windProfile.strokes++;return stroke.apply(this,args)};
    for(const C of [WebGLRenderingContext,WebGL2RenderingContext])for(const name of ['drawElements','drawArrays']){const draw=C.prototype[name];C.prototype[name]=function(...args){window.windProfile.webgl++;return draw.apply(this,args)}};
  ` });
  await command('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
  await command('Page.navigate', { url: base });
  await waitFor("Boolean(document.querySelector('canvas.maplibregl-canvas'))");
  await waitFor("Boolean(document.querySelector('button[aria-label=\"Rainfall\"],button[aria-label=\"Map Layers\"]'))");
  if (!await evaluate("Boolean(document.querySelector('button[aria-label=\"Rainfall\"]'))")) await click('button[aria-label="Map Layers"]');
  await waitFor("Boolean(document.querySelector('button[aria-label=\"Rainfall\"]'))");
  await click('button[aria-label="Rainfall"]');
  await waitFor("Boolean(document.querySelector('canvas[data-wind-trails]'))");
  await button('Forecast');
  await waitFor("Boolean(document.querySelector('input[aria-label=\"Rainfall forecast time\"]'))");
  const original = await evaluate("document.querySelector('[data-forecast-valid-at]').dataset.forecastValidAt");
  await button('+1d');
  await waitFor(`document.querySelector('[data-forecast-valid-at]')?.dataset.forecastValidAt !== ${JSON.stringify(original)}`);
  assert.equal(Date.parse(await evaluate("document.querySelector('canvas[data-wind-trails]').dataset.windValidAt")), Date.parse(stamp(24)));
  await button('+2d'); await button('+3d'); await button('Now');
  assert.equal(forecastRequests, 1, 'Timeline and wind share one request');
  await pause(2000);
  const before = await evaluate('({...window.windProfile})'); await pause(2000);
  const after = await evaluate('({...window.windProfile})');
  assert(after.strokes > before.strokes, 'Trails animate');
  assert(after.webgl - before.webgl < 20, 'Wind must not continuously repaint the map');
  await screenshot('forecast-desktop.png');
  await click('button[aria-label="Wind trails"]');
  await waitFor("!document.querySelector('canvas[data-wind-trails]')");
  const stopped = await evaluate('window.windProfile.strokes'); await pause(400);
  assert.equal(await evaluate('window.windProfile.strokes'), stopped, 'No animation after wind is disabled');
  await click('button[aria-label="Wind trails"]');
  await command('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  await pause(300);
  const reduced = await evaluate('window.windProfile.strokes'); await pause(400);
  assert.equal(await evaluate('window.windProfile.strokes'), reduced, 'Reduced motion uses static arrows');
  await command('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await pause(600);
  if (!await evaluate("Boolean(document.querySelector('[aria-label=\"Rainfall source\"]'))")) await click('button[aria-label="Layers"]');
  await waitFor("Boolean(document.querySelector('[aria-label=\"Rainfall source\"]'))");
  await screenshot('forecast-mobile.png');
  assert(await evaluate('document.documentElement.scrollWidth <= innerWidth'), 'No mobile page overflow');
  await button('Recent');
  await waitFor("Boolean(document.querySelector('[aria-label=\"Rainfall accumulation window\"]'))");
  assert.equal(Date.parse(await evaluate("document.querySelector('canvas[data-wind-trails]').dataset.windValidAt")), Date.parse(stamp(0)));
  await click('button[aria-label="Rainfall"]');
  await waitFor("!document.querySelector('canvas[data-wind-trails]')");
  assert.equal(forecastRequests, 1);
  assert.equal(errors.length, 0, 'No runtime exceptions');
  if (process.env.GAKIT_REAL_FORECAST === '1') assert.equal(rainfallGeojsonRequests, 0, 'Published JAXA images avoid GeoJSON');
  const proof = { passed: true, forecastRequests, rainfallGeojsonRequests, animationStrokesInTwoSeconds: after.strokes - before.strokes,
    mapDrawCallsInTwoSeconds: after.webgl - before.webgl, reducedMotionStatic: true, cleanupVerified: true, mobileFits: true };
  fs.writeFileSync(path.join(output, 'checks.json'), JSON.stringify(proof, null, 2)); console.log(JSON.stringify(proof));
}
main().catch(async error => { console.error(error); process.exitCode = 1;
  if (socket?.readyState === WebSocket.OPEN) { await screenshot('failure.png'); console.error(await evaluate('document.body.innerText.slice(-5000)')); console.error(JSON.stringify(errors)); }
}).finally(async () => { if (socket?.readyState === WebSocket.OPEN) { try { await command('Browser.close'); } catch {} socket.close(); } else browser.kill(); });
