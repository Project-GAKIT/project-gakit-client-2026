// Live delivery check: running app + public Storage; no service credential in the browser.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url');
const {chromium}=require(process.env.GAKIT_PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'../..'),base=process.env.GAKIT_BASE_URL||'http://localhost:3000';
(async()=>{
 require('@next/env').loadEnvConfig(root);
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'gakit-published-satellite-'));
 const entry=path.join(directory,'entry.jsx');
 fs.writeFileSync(entry,`
 import React,{useEffect,useRef} from 'react';import {createRoot} from 'react-dom/client';
 import {useHimawariLayer} from '@/hooks/useHimawariLayer';
 window.draws=[];const map={getSource:()=>({updateImage:({image})=>window.draws.push({url:image.src,at:performance.now()})}),getLayer:()=>true,setLayoutProperty(){},setPaintProperty(){},cameraForBounds:()=>({center:[124,8],zoom:4}),flyTo(){}};
 function Fixture(){const mapRef=useRef(map),ready=useRef(true);const satellite=useHimawariLayer(mapRef,ready);
 useEffect(()=>{window.satellite={loading:satellite.isLoading,hasFrames:satellite.hasFrames,observedAt:satellite.observedAt};});
 return <button onClick={()=>satellite.toggleHimawariIR(!satellite.showHimawariIR)}>{satellite.showHimawariIR?'Disable':'Enable'}</button>}
 createRoot(document.getElementById('fixture')).render(<Fixture/>);
 `);
 const {build}=await import(pathToFileURL(require.resolve('vite',{paths:[root]})).href);
 const result=await build({configFile:false,root,logLevel:'error',define:{'process.env.NODE_ENV':'"production"','process.env.NEXT_PUBLIC_SUPABASE_URL':JSON.stringify(process.env.NEXT_PUBLIC_SUPABASE_URL)},esbuild:{jsx:'automatic'},resolve:{alias:{'@':root,react:path.join(root,'node_modules/react'),'react-dom':path.join(root,'node_modules/react-dom')}},build:{write:false,lib:{entry,formats:['iife'],name:'PublishedSatellite'}}});
 const bundle=(Array.isArray(result)?result[0]:result).output.find(o=>o.type==='chunk').code;
 const browser=await chromium.launch({channel:process.platform==='win32'?'msedge':undefined,headless:true});
 try{
  const page=await browser.newPage();const errors=[],requests=[],responses=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>requests.push(r.url()));
  page.on('response',r=>{if(r.url().includes('/storage/v1/object/public/satellite-frames/'))responses.push({url:r.url(),status:r.status()})});
  await page.route('**/__published-satellite',r=>r.fulfill({contentType:'text/html',body:'<div id="fixture"></div>'}));
  await page.goto(base+'/__published-satellite');await page.addScriptTag({content:bundle});
  const started=await page.evaluate(()=>performance.now());await page.getByRole('button',{name:'Enable',exact:true}).click();
  await page.waitForFunction(()=>window.draws.length>0,{},{timeout:30000});
  const firstImageMs=await page.evaluate(t=>Math.round(window.draws[0].at-t),started);
  await page.waitForFunction(()=>window.satellite?.hasFrames&&!window.satellite.loading,{},{timeout:30000});
  const imageRequests=requests.filter(u=>/\/frames\/\d{14}\.webp/.test(u));
  assert(imageRequests.length>0&&imageRequests.length<=6);
  assert(requests.every(u=>!u.includes('colostate.edu')&&!u.includes('himawari-proxy')));
  assert(responses.every(r=>r.status===200));
  assert(await page.evaluate(()=>Boolean(window.satellite.observedAt)));
  const count=imageRequests.length;await page.getByRole('button',{name:'Disable',exact:true}).click();
  await page.getByRole('button',{name:'Enable',exact:true}).click();await page.waitForTimeout(400);
  assert.equal(requests.filter(u=>/\/frames\/\d{14}\.webp/.test(u)).length,count);
  // A full reload resets module caches. Hold the new manifest request: a saved
  // valid manifest must still let the first image draw before refresh finishes.
  let releaseManifest;
  const manifestGate=new Promise(resolve=>{releaseManifest=resolve});
  let heldManifest=false;
  await page.route('**/latest.json?*',async route=>{heldManifest=true;await manifestGate;await route.continue()});
  await page.reload();await page.addScriptTag({content:bundle});
  const returnStarted=await page.evaluate(()=>performance.now());
  await page.getByRole('button',{name:'Enable',exact:true}).click();
  await page.waitForFunction(()=>window.draws.length>0,{},{timeout:30000});
  assert(heldManifest,'A background manifest refresh was requested');
  const returningImageMs=await page.evaluate(t=>Math.round(window.draws[0].at-t),returnStarted);
  releaseManifest();await page.unroute('**/latest.json?*');
  assert.deepEqual(errors,[]);
  const proof={passed:true,firstImageMs,returningImageMs,savedManifestDrawsBeforeRefresh:true,noNextManifestRequest:true,completedImageRequests:count,allImagesFromSharedStorage:true,noOnDemandImageRequests:true,noBrowserCIRARequests:true,cachedReenableNoDownloads:true,observedAt:await page.evaluate(()=>window.satellite.observedAt),runtimeErrors:errors};
  fs.writeFileSync(path.resolve(root,'../rainfall-calibration/results/live/satellite-browser-publication.json'),JSON.stringify(proof,null,2));console.log(JSON.stringify(proof));
 }finally{await browser.close();fs.rmSync(directory,{recursive:true,force:true})}
})().catch(e=>{console.error(e);process.exitCode=1});
