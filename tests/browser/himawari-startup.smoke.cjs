const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.GAKIT_PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '../..');
const base = process.env.GAKIT_BASE_URL || 'http://localhost:3000';
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR4nGNgAAIAAAUAAXpeqz8AAAAASUVORK5CYII=', 'base64');
const anchor = Math.floor(Date.now() / 600000) * 600000 - 600000;
const stamp = offset => new Date(anchor + offset * 600000).toISOString().replace(/\D/g, '').slice(0, 14);
const frames = Array.from({ length: 6 }, (_, i) => stamp(-i));

(async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'gakit-satellite-startup-'));
  const entry = path.join(directory, 'entry.jsx');
  fs.writeFileSync(entry, `
    import React, { useLayoutEffect, useRef } from 'react';
    import { createRoot } from 'react-dom/client';
    import { useHimawariLayer } from '@/hooks/useHimawariLayer';
    import { useMapDisplayLoading } from '@/hooks/useMapDisplayLoading';
    import { PageLoader } from '@/components/ui/LoadingState';
    const listeners = new Map();
    window.draws = [];
    const map = {
      on(type, fn) { if (!listeners.has(type)) listeners.set(type, new Set()); listeners.get(type).add(fn); },
      off(type, fn) { listeners.get(type)?.delete(fn); },
      isStyleLoaded: () => true, areTilesLoaded: () => true, isMoving: () => false,
      triggerRepaint() { requestAnimationFrame(() => [...(listeners.get('render') || [])].forEach(fn => fn())); },
      getSource: () => ({ updateImage: ({ image }) => window.draws.push(image.src) }),
      getLayer: () => true, setLayoutProperty() {}, setPaintProperty() {},
      cameraForBounds: () => ({ center: [124, 8], zoom: 4 }), flyTo() {},
    };
    function Fixture() {
      const mapRef = useRef(map), ready = useRef(true), pending = useRef(false);
      const satellite = useHimawariLayer(mapRef, ready);
      const { loading, run } = useMapDisplayLoading(mapRef, ready);
      useLayoutEffect(() => {
        pending.current = satellite.showHimawariIR && satellite.isLoading && !satellite.hasFrames;
        map.triggerRepaint();
      }, [satellite.showHimawariIR, satellite.isLoading, satellite.hasFrames]);
      window.satellite = { loading: satellite.isLoading, hasFrames: satellite.hasFrames };
      return <><PageLoader isLoading={Boolean(loading.layers)} />
        <button onClick={() => run('layers', () => satellite.toggleHimawariIR(!satellite.showHimawariIR), () => pending.current)}>
          {satellite.showHimawariIR ? 'Disable satellite' : 'Enable satellite'}
        </button></>;
    }
    createRoot(document.getElementById('fixture')).render(<Fixture />);
  `);
  const { build } = await import(pathToFileURL(require.resolve('vite', { paths: [root] })).href);
  const result = await build({ configFile: false, root, logLevel: 'error',
    define: { 'process.env.NODE_ENV': '"production"', 'process.env.NEXT_PUBLIC_SUPABASE_URL': JSON.stringify('https://storage.test') }, esbuild: { jsx: 'automatic' },
    resolve: { alias: { '@': root, react: path.join(root, 'node_modules/react'), 'react-dom': path.join(root, 'node_modules/react-dom') } },
    build: { write: false, lib: { entry, formats: ['iife'], name: 'SatelliteStartupFixture' } },
  });
  const bundle = (Array.isArray(result) ? result[0] : result).output.find(item => item.type === 'chunk').code;
  const browser = await chromium.launch({ channel: process.platform === 'win32' ? 'msedge' : undefined, headless: true });
  try {
    for (const width of [390, 1440]) {
      const page = await browser.newPage({ viewport: { width, height: 900 } });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      let manifests = 0, requests = 0, hold = true;
      const held = [];
      await page.route('**/storage/v1/object/public/satellite-frames/**', route => {
        if (new URL(route.request().url()).pathname.endsWith('/latest.json')) {
          manifests++;
          return route.fulfill({ json: { schema: 'himawari-publication-v2', generated_at: new Date().toISOString(), frames: frames.map(stamp => ({stamp,bytes:400000,sha256:'a'.repeat(64)})) } });
        }
        requests++;
        if (hold) { held.push(route); return; }
        return route.fulfill({ contentType: 'image/png', body: png });
      });
      await page.goto(base, { waitUntil: 'domcontentloaded' });
      const styles = await page.locator('link[rel="stylesheet"]').evaluateAll(elements => elements.map(element => element.href));
      await page.route('**/__satellite-startup-fixture', route => route.fulfill({ contentType: 'text/html',
        body: styles.map(href => '<link rel="stylesheet" href="' + href + '">').join('') + '<div id="fixture"></div>',
      }));
      await page.goto(base + '/__satellite-startup-fixture');
      await page.addScriptTag({ content: bundle });
      await page.getByRole('button', { name: 'Enable satellite', exact: true }).click();
      const overlay = page.getByRole('status', { name: 'Loading page', exact: true });
      await overlay.waitFor();
      await page.waitForFunction(() => window.satellite.loading);
      while (held.length < 2) await page.waitForTimeout(20);
      await held.shift().fulfill({ contentType: 'image/png', body: png });
      await overlay.waitFor({ state: 'hidden' });
      assert(await page.evaluate(() => window.satellite.loading && window.satellite.hasFrames), 'First usable scan clears full-page loading before batch completes');
      assert(await page.evaluate(() => window.draws.length > 0), 'A scan is drawn before loading clears');
      hold = false;
      await Promise.all(held.splice(0).map(route => route.fulfill({ contentType: 'image/png', body: png })));
      await page.waitForFunction(() => !window.satellite.loading);
      assert.equal(requests, 6);
      await page.getByRole('button', { name: 'Disable satellite', exact: true }).click();
      await overlay.waitFor({ state: 'hidden' });
      const draws = await page.evaluate(() => window.draws.length);
      await page.getByRole('button', { name: 'Enable satellite', exact: true }).click();
      await page.waitForFunction(count => window.draws.length > count, draws);
      await overlay.waitFor({ state: 'hidden' });
      assert.equal(manifests, 1, 'Fresh re-enable skips metadata discovery');
      assert.equal(requests, 6, 'Fresh re-enable reuses decoded frames without downloads');
      assert.deepEqual(errors, []);
      console.log('Satellite startup ' + width + 'px: first-frame readiness and zero-request cached re-enable passed');
      await page.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
