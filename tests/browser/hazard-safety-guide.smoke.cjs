// Real assessment and safety dialogs; assessment data and unrelated weather are fixtures.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.GAKIT_PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '../..');

(async () => {
  const { build } = await import(pathToFileURL(require.resolve('vite', { paths: [root] })).href);
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'gakit-hazard-guide-'));
  const entry = path.join(directory, 'entry.jsx');
  fs.writeFileSync(entry, `
    import React, {useState} from 'react';
    import {createRoot} from 'react-dom/client';
    import {HazardAssessmentModal} from '@/components/HazardAssessmentModal';
    import '@/app/globals.css';
    const location = {lat:8.2312,lng:124.247,address:'Iligan City'};
    const assess = async () => ({floodHazard:'high',landslide:'medium',stormSurge:{level:'low',advisory:1},precipMm:5});
    function App(){const[open,setOpen]=useState(false);return <>
      <button onClick={()=>setOpen(true)}>Open assessment</button>
      <HazardAssessmentModal isOpen={open} onClose={()=>setOpen(false)} selectedLocation={location} onCheckLocation={assess} withinCity/>
    </>}
    createRoot(document.getElementById('root')).render(<App/>);
  `);
  let browser;
  try {
    const result = await build({
      configFile: false, root, logLevel: 'error', define: { 'process.env.NODE_ENV': '"production"' },
      resolve: { alias: [
        { find: 'react', replacement: path.join(root, 'node_modules/react') },
        { find: 'react-dom', replacement: path.join(root, 'node_modules/react-dom') },
        { find: '@', replacement: root },
      ] },
      plugins: [{ name: 'hazard-guide-fixture', enforce: 'pre',
        resolveId(id) {
          if (id.endsWith('/components/HeatIndexAssessment')) return '\0heat.jsx';
          if (id.endsWith('/lib/map/geoUtils')) return '\0geocode';
        },
        load(id) {
          if (id === '\0heat.jsx') return `import React from 'react';export function HeatIndexAssessment(){return <div>Heat index fixture</div>}`;
          if (id === '\0geocode') return `export const isRawCoordinateString=()=>false;export const reverseGeocode=async()=>null;`;
        },
      }],
      build: { write: false, minify: false, lib: { entry, formats: ['iife'], name: 'HazardGuideFixture' } },
    });
    const output = (Array.isArray(result) ? result[0] : result).output;
    const js = output.find(item => item.type === 'chunk').code;
    const css = output.filter(item => item.type === 'asset' && item.fileName.endsWith('.css')).map(item => item.source).join('\n');
    browser = await chromium.launch({ channel: process.platform === 'win32' ? 'msedge' : undefined, headless: true });

    for (const width of [320, 390, 1024, 1440]) {
      for (const theme of ['light', 'dark']) {
        const page = await browser.newPage({ viewport: { width, height: 740 } });
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.addInitScript(theme => {
          localStorage.setItem('gakit:onboarding:assessment-tour:v1', 'true');
          document.addEventListener('DOMContentLoaded', () => { document.documentElement.dataset.theme = theme; });
        }, theme);
        await page.route('**/*', route => route.fulfill({ contentType: 'text/html', body: '<div id="root"></div>' }));
        await page.goto('http://gakit.test/hazard-guide');
        await page.addStyleTag({ content: css });
        await page.addScriptTag({ content: js });
        await page.getByRole('button', { name: 'Open assessment', exact: true }).click();
        const assessment = page.getByRole('dialog', { name: 'Hazard assessment', exact: true });
        await assessment.waitFor();

        for (const [index, hazard] of ['Flood', 'Landslide', 'Storm surge'].entries()) {
          const trigger = assessment.getByRole('button', { name: new RegExp(`^${hazard}:.*Safety guide$`) });
          await trigger.click();
          const guide = page.getByRole('dialog', { name: `${hazard} safety guide`, exact: true });
          await guide.waitFor();
          assert.equal(await page.getByRole('dialog').count(), 1, 'Only the safety guide is exposed');
          assert.equal(await guide.locator('[data-safety-phase]').count(), 3);
          assert.equal(await guide.locator('[data-safety-phase] ol > li').count(), 6);
          assert.equal(await guide.locator('[data-safety-phase] svg').count(), 6, 'Every action has an SVG figure');
          assert(await guide.evaluate(el => el.scrollWidth <= el.clientWidth), 'No horizontal overflow');
          assert(await guide.evaluate(el => { const b = el.getBoundingClientRect(); return b.top >= 0 && b.bottom <= innerHeight; }), 'Guide fits the viewport');
          if (process.env.GAKIT_GUIDE_SCREENSHOTS && theme === 'light') {
            await guide.screenshot({ path: path.join(process.env.GAKIT_GUIDE_SCREENSHOTS, `gakit-guide-${hazard.replaceAll(' ', '-')}-${width}.png`) });
          }

          const close = guide.getByRole('button', { name: 'Close safety guide', exact: true });
          const back = guide.getByRole('button', { name: 'Back to assessment', exact: true });
          await close.focus();
          await page.keyboard.press('Shift+Tab');
          assert(await back.evaluate(el => el === document.activeElement), 'Focus wraps to the footer');
          await page.keyboard.press('Tab');
          assert(await close.evaluate(el => el === document.activeElement), 'Focus stays inside the guide');

          if (width < 1024) {
            await guide.getByRole('button', { name: 'After', exact: true }).click();
            assert.equal(await page.evaluate(() => document.activeElement.dataset.safetyPhase), 'After', 'Section jumps move keyboard focus');
            assert(await guide.locator('[data-hazard-safety-body]').evaluate(el => el.scrollTop > 0), 'Mobile guide body scrolls');
          } else {
            assert(await guide.locator('[data-hazard-safety-body]').evaluate(el => el.scrollHeight <= el.clientHeight), 'All desktop instructions fit without scrolling');
            const cards = await guide.locator('[data-safety-phase] ol > li').evaluateAll(items => items.map(el => {
              const box = el.getBoundingClientRect();
              return { top: box.top, width: box.width, height: box.height };
            }));
            assert(Math.max(...cards.map(c => c.width)) - Math.min(...cards.map(c => c.width)) <= 1, 'Desktop cards share a consistent width');
            assert(Math.max(...cards.map(c => c.height)) - Math.min(...cards.map(c => c.height)) <= 1, 'Desktop cards share a consistent height');
            for (const index of [0, 1]) {
              assert(Math.abs(cards[index].top - cards[index + 2].top) <= 1 && Math.abs(cards[index].top - cards[index + 4].top) <= 1, 'Card rows align across phases');
            }
          }
          assert(await back.isVisible(), 'Footer stays available while reading');
          assert.equal(await guide.locator('footer a').count(), 2, 'Sources are in the fixed footer');
          if (width < 640) {
            assert(await guide.locator('footer').evaluate(el => el.getBoundingClientRect().height <= 56), 'Mobile footer stays a compact single row');
          }
          assert.equal(await guide.locator('[data-hazard-safety-body] a').count(), 0, 'Sources stay outside the scrolling instructions');
          if (hazard === 'Landslide') {
            assert.equal(await guide.locator('a[href*="what-to-do-in-case-of-landslide"]').count(), 1);
            assert.equal(await guide.locator('a[href*="Disaster_Preparedness_First_Aid_Handbook.pdf#page=50"]').count(), 1);
            assert.equal(await guide.locator('a[href*="phivolcs"]').count(), 0, 'Sources give resident instructions');
          }

          if (index === 0) await page.keyboard.press('Escape');
          else if (index === 1) await back.click();
          else await close.click();
          await guide.waitFor({ state: 'hidden' });
          await assessment.waitFor();
          await page.waitForFunction(hazard => document.activeElement?.getAttribute('aria-label')?.startsWith(`${hazard}:`), hazard);
          assert(await trigger.evaluate(el => el === document.activeElement), 'Returns focus to the hazard row');
        }
        assert.deepEqual(errors, []);
        console.log(JSON.stringify({ width, theme, passed: true, guides: 3, focusRestored: true }));
        await page.close();
      }
    }
  } finally {
    await browser?.close();
    fs.unlinkSync(entry);
    fs.rmdirSync(directory);
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
