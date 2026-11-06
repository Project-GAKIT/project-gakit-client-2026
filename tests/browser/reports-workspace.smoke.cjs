// Real shell, report components and MapLibre renderer; service data and basemap tiles are fixtures.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.GAKIT_PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '../..');
const base = process.env.GAKIT_BASE_URL || 'http://localhost:3000';

(async () => {
  const { build } = await import(pathToFileURL(require.resolve('vite', { paths:[root] })).href);
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'gakit-workspace-'));
  const entry = path.join(directory, 'entry.jsx');
  fs.writeFileSync(entry, `
    import React from 'react';
    import {createRoot} from 'react-dom/client';
    import {MonitoringShell} from '@/app/monitoring/MonitoringShell';
    import '@/app/globals.css';
    import {buildReportsGeoJson} from '@/lib/map/reportMarkers';
    window.requests=[];window.decisions=[];window.maps=[];
    window.records=Array.from({length:60},(_,index)=>({
      id:'report-'+String(index).padStart(8,'0'),
      location:{latitude:8.23+index*.0001,longitude:124.24,address:'Quezon Avenue '+index+', Poblacion, Iligan City'},
      depth:{code:index===0?'head':'knee',label:index===0?'Head':'Knee',approximateCm:index===0?159:45},depthCm:index===1?null:index===0?159:45,reference:'adult',reporterType:'public',
      observedAt:new Date().toISOString(),createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),
      status:index===0?'UNVERIFIED':'REJECTED',decisionSource:'automated',validationSummary:{assessedAt:new Date().toISOString(),
        recommendedStatus:index===0?'UNVERIFIED':'REJECTED',checkState:index===0?'review_required':'complete',corroboratingSourceCount:0,
        depthQuality:'estimated',support:[],conflicts:['CURRENT_CONDITIONS_UNSUPPORTED'],missing:[],context:[]}
    }));
    createRoot(document.getElementById('root')).render(<MonitoringShell/>);
  `);
  let browser;
  try {
    const result = await build({configFile:false,root,logLevel:'error',define:{'process.env.NODE_ENV':'"production"'},
      resolve:{alias:[{find:'react',replacement:path.join(root,'node_modules/react')},{find:'react-dom',replacement:path.join(root,'node_modules/react-dom')},{find:'@',replacement:root}]},
      plugins:[{name:'workspace-fixture',enforce:'pre',
        resolveId(id) {
          if(id==='next/dynamic')return '\0dynamic';
          if(id==='next/navigation')return '\0navigation';
          if(id==='next/link')return '\0link';
          if(id==='maplibre-gl')return '\0maplibre';
          if(id.endsWith('/components/SideBar'))return '\0sidebar.jsx';
          if(id.endsWith('/components/AdminHeader'))return '\0header.jsx';
          if(id.endsWith('/components/WeatherAlertModal'))return '\0alertmodal';
          if(id.endsWith('/dashboard/DashboardOverview'))return '\0dashboard.jsx';
          if(id.endsWith('/alerts/AlertsTab'))return '\0alerts.jsx';
          if(id.endsWith('/actions/reports'))return '\0reports';
          if(id.endsWith('/lib/map/pmtilesProtocol'))return '\0protocol';
        },
        load(id) {
          if(id==='\0dynamic')return `import React,{useEffect,useState} from 'react';export default function dynamic(loader,options={}){return function Dynamic(props){const [Component,setComponent]=useState(null);useEffect(()=>{let live=true;loader().then(m=>{if(live)setComponent(()=>m.default||m)});return()=>{live=false}},[]);return Component?React.createElement(Component,props):options.loading?React.createElement(options.loading):null}}`;
          if(id==='\0navigation')return 'export function useSearchParams(){return new URLSearchParams(location.search)};export function usePathname(){return "/monitoring"};const router={push:()=>{},prefetch:()=>{}};export function useRouter(){return router}';
          if(id==='\0link')return `import React from 'react';export default React.forwardRef(function Link({href,children,...props},ref){return React.createElement('a',{href,ref,...props},children)});`;
          if(id==='\0sidebar.jsx')return `import React from 'react';export function SideBar({onTabChange}){return <aside aria-label="App sidebar" className="hidden w-64 shrink-0 lg:block">{['dashboard','reports','alerts'].map(tab=><button key={tab} onClick={()=>onTabChange(tab)}>{tab}</button>)}</aside>}`;
          if(id==='\0header.jsx')return `import React from 'react';export function AdminHeader({compact}){return <header aria-label="App header" className={compact?"h-14 shrink-0":"h-24 shrink-0"}>Monitoring</header>}`;
          if(id==='\0alertmodal')return 'export const WeatherAlertModal=()=>null';
          if(id==='\0dashboard.jsx')return `import React from 'react';export function DashboardOverview({onReviewReports}){return <div style={{height:1800}}>Dashboard content<button onClick={()=>onReviewReports()}>Browse reports fixture</button><button onClick={()=>onReviewReports({reportId:'report-00000000'})}>Open older report fixture</button><button onClick={()=>onReviewReports({time:'24h'})}>Recent reports fixture</button></div>}`;
          if(id==='\0alerts.jsx')return `import React from 'react';export function AlertsTab(){return <div style={{height:1800}}>Alerts content</div>}`;
          if(id==='\0reports')return `export async function listReports(params){window.requests.push(params);const items=window.records.slice((params.page-1)*params.limit,params.page*params.limit);return {items,total:60,totalPages:3}};export async function getReport(id){return window.records.find(r=>r.id===id)};export async function updateReportStatus(id,status,reason){window.decisions.push({id,status,reason});const report=window.records.find(r=>r.id===id);Object.assign(report,{status,decisionSource:'manual'});return report};export async function fetchReportReviewHistory(){return {reportRevision:1,assessments:[],jobs:[],decisions:[]}};export async function requestReportReassessment(){}`;
          if(id==='\0maplibre')return `export class Map extends window.maplibregl.Map {constructor(options){super(options);window.maps.push(this)}};export const {Marker,Popup,AttributionControl,NavigationControl,ScaleControl,LngLat,LngLatBounds,addProtocol,removeProtocol,setWorkerUrl}=window.maplibregl;`;
          if(id==='\0protocol')return `let protocol;export async function ensurePmtilesProtocol(m){if(!protocol){protocol={tilev4:async(params)=>({data:params.type==='json'?{tilejson:'3.0.0',tiles:['pmtiles://fixture/{z}/{x}/{y}'],minzoom:0,maxzoom:0,vector_layers:[]}:new ArrayBuffer(0)})};m.addProtocol('pmtiles',protocol.tilev4)}return protocol}`;
        },
        transform(source,id) {
          if(!id.replaceAll('\\','/').endsWith('/constants/publicMap.ts'))return;
          const style='{version:8,glyphs:"/fixture-glyphs/{fontstack}/{range}.pbf",sources:{},layers:[{id:"background",type:"background",paint:{"background-color":"#dce8e7"}}]}';
          return source.replace('light: OPENFREEMAP_STYLE,','light: '+style+',').replace('bright: OPENFREEMAP_BRIGHT_STYLE,','bright: '+style+',').replace('satellite: SATELLITE_STYLE,','satellite: '+style+',');
        }
      }],build:{write:false,minify:false,lib:{entry,formats:['iife'],name:'WorkspaceFixture'}}});
    const output=(Array.isArray(result)?result[0]:result).output;
    const js=output.find(item=>item.type==='chunk').code;
    const css=output.filter(item=>item.type==='asset'&&item.fileName.endsWith('.css')).map(item=>item.source).join('\n');
    browser=await chromium.launch({channel:process.platform==='win32'?'msedge':undefined,headless:true});
    const page=await browser.newPage({viewport:{width:1440,height:900}});
    await page.emulateMedia({reducedMotion:'reduce'});
    const errors=[];page.on('pageerror',error=>errors.push(error.message));
    await page.route('**/*', async route=> {
      const url=new URL(route.request().url());
      if(url.pathname.startsWith('/preview-tiles/')) {const tile=url.pathname.replace('/preview-tiles/','');const response=await fetch('https://tile.openstreetmap.org/'+tile,{headers:{'User-Agent':'Gakit report marker UI review'}});return route.fulfill({status:response.status,contentType:'image/png',body:Buffer.from(await response.arrayBuffer())}) }
      if(url.pathname.startsWith('/fixture-glyphs/')) { const range=url.pathname.split('/').at(-1);const font=decodeURIComponent(url.pathname.split('/').at(-2)).includes('Bold')?'Noto Sans Bold':'Noto Sans Regular';const response=await fetch('https://raw.githubusercontent.com/maplibre/demotiles/gh-pages/font/'+encodeURIComponent(font)+'/'+range);return route.fulfill({status:response.status,contentType:'application/x-protobuf',body:Buffer.from(await response.arrayBuffer())}) }
      if(url.pathname==='/workspace-fixture')return route.fulfill({contentType:'text/html',body:'<div id="root"></div>'});
      if(url.pathname.startsWith('/fixture-maplibre/')||url.pathname.startsWith('/vendor/maplibre-gl/'))return route.fulfill({contentType:'application/javascript',body:fs.readFileSync(path.join(root,'node_modules/maplibre-gl/dist',path.basename(url.pathname)))});
      if(url.pathname.startsWith('/data/') && /\.(json|geojson)$/.test(url.pathname)) {
        const file=path.resolve(root,'public',url.pathname.slice(1));
        if(file.startsWith(path.join(root,'public')+path.sep)&&fs.existsSync(file))return route.fulfill({contentType:'application/json',body:fs.readFileSync(file)});
      }
      if(url.pathname.includes('/reports'))return route.fulfill({json:{type:'FeatureCollection',features:[]}});
      if(url.pathname.includes('/health'))return route.fulfill({json:{status:'ok'}});
      if(url.pathname.includes('World_Imagery'))return route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="256" height="256" fill="#cbd5e1"/></svg>'});
      return route.fulfill({status:503,body:'Fixture: service unavailable'});
    });
    await page.goto(base+'/workspace-fixture?tab=reports');
    await page.addStyleTag({content:css});
    await page.addScriptTag({type:'module',content:`window.maplibregl=await import(${JSON.stringify(base+'/fixture-maplibre/maplibre-gl.mjs')})`});
    await page.waitForFunction(()=>window.maplibregl);
    await page.addScriptTag({content:'window.process={env:{NODE_ENV:"production"}};'+js});
    await page.waitForFunction(()=>window.maps?.length===1&&window.maps[0].getLayer('report-points')).catch(async error=>{
      console.error('Map initialization:',errors,await page.evaluate(()=>({maps:window.maps?.length,layers:window.maps?.[0]?.getStyle()?.layers?.map(l=>l.id),text:document.body.innerText.slice(0,800)})));
      throw error;
    });
    const map=page.getByRole('region',{name:'Flood report map',exact:true});
    const panel=page.getByRole('region',{name:'Reports panel',exact:true});
    const firstRow=panel.locator('.report-row-wide').first();
    await firstRow.waitFor();
    assert.equal(await panel.locator('.report-row-wide').count(),20,'Reports are paginated');
    assert((await firstRow.getByRole('cell').nth(1).innerText()).includes('159 cm'));
    assert(!(await panel.locator('.report-row-wide').nth(1).getByRole('cell').nth(1).innerText()).includes('45'),'Category-only reports have no invented numeric depth');
    const canvas=await map.locator('canvas.maplibregl-canvas').elementHandle();
    await firstRow.getByRole('cell').first().getByRole('button').first().click();
    await page.getByRole('dialog',{name:'Report details',exact:true}).waitFor();
    await page.getByRole('button',{name:'Close report details',exact:true}).click();
    assert(await canvas.evaluate(el=>el.isConnected),'Opening details preserves the main map');
    await panel.getByRole('button',{name:'Next',exact:true}).click();
    await page.waitForFunction(()=>window.requests.at(-1).page===2);
    await panel.getByRole('button',{name:'Pending & validated',exact:true}).click();
    await page.getByRole('option',{name:'Pending',exact:true}).click();
    await page.waitForFunction(()=>window.requests.at(-1).status==='UNVERIFIED'&&window.requests.at(-1).page===1);
    await panel.getByRole('button',{name:'All depths',exact:true}).click();
    await page.getByRole('option',{name:'Knee Deep',exact:true}).click();
    await page.waitForFunction(()=>window.requests.at(-1).depth==='knee');
    await panel.getByRole('button',{name:'Reset filters',exact:true}).click();
    await page.waitForFunction(()=>!window.requests.at(-1).status&&!window.requests.at(-1).depth);
    const search=panel.getByRole('textbox',{name:'Search reports'});
    await search.fill('P');await search.fill('Pob');await search.fill('Poblacion');
    await page.waitForFunction(()=>window.requests.at(-1).search==='Poblacion');
    assert.equal(await page.evaluate(()=>window.requests.filter(r=>r.search==='P'||r.search==='Pob').length),0,'Search requests wait until typing pauses');
    assert.equal(await page.evaluate(()=>window.requests.at(-1).page),1,'Search resets pagination');
    assert.deepEqual(errors,[]);
    console.log('Reports workspace passed: pagination, status/depth filters, debounced search, accurate depth and report details.');
  } finally {
    await browser?.close();fs.unlinkSync(entry);fs.rmdirSync(directory);
  }
})().catch(error=>{console.error(error);process.exitCode=1});
