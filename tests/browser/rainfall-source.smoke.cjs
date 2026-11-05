// Node >=22 + installed Edge. Intercepts rainfall fixtures; does not assess forecasts.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const {spawn}=require('node:child_process');
const output=process.env.GAKIT_SCREENSHOT_DIR || path.resolve('../rainfall-calibration/results/live/rainfall-source-ui');
const profile=fs.mkdtempSync(path.join(os.tmpdir(),'gakit-rainfall-source-'));
const edge=process.env.GAKIT_EDGE_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const browser=spawn(edge,['--headless','--enable-unsafe-swiftshader','--no-first-run','--no-default-browser-check','--remote-debugging-port=0','--user-data-dir='+profile,'about:blank'],{windowsHide:true,stdio:'ignore'});
const base=process.env.GAKIT_BASE_URL || 'http://localhost:3000';
const png='iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFUlEQVR4nGNk23blLAMDAwMTiABhACOeAmF25L8LAAAAAElFTkSuQmCC';
const anchor=new Date();anchor.setUTCMinutes(0,0,0);const stamp=h=>new Date(+anchor+h*3600000).toISOString();
const corrected='gsmap_now_corrected:123456789abc';
const frame=(h,source)=>({frame_id:String(h+10),valid_at:stamp(h),kind:h<0?'replay':h===0?'latest':'forecast',horizon_hours:Math.max(0,h),
  window_start_at:stamp(h-24),window_end_at:stamp(h),window_hours:24,valid_hours:24,missing_intervals:[],availability:'ready',reason:null,
  rainfall_24h_mm:30,hourly_rain_mm:2,inundated_km2:1+h/10,max_depth_m:1,raster_url:'/api/v1/surrogate/live/v2/snapshots/fixture/frames/'+(h+10)+'.png',
  hourly_rainfall_source:source,hourly_issue_at:source==='gsmap_rnc'?stamp(-6):null,forecast_retrieved_at:source==='open_meteo'?stamp(-.1):null,
  forecast_source:h>0?source:null,source_issues:source==='gsmap_rnc'?['gsmap_rnc:'+stamp(-6)]:[],
  rainfall_sources:h>0?[corrected,source]:[source],coverage_fraction:1});
const timeline={schema_version:2,snapshot_id:'fixture',created_at:new Date().toISOString(),evaluated_at:new Date().toISOString(),expires_at:new Date(Date.now()+3600000).toISOString(),observed_at:stamp(0),forecast_anchor_at:stamp(0),freshness:'fresh',readiness:'ready',build_state:'ready',bounds:[[124.15,8.35],[124.5,8.35],[124.5,8.1],[124.15,8.1]],frames:[frame(-1,'uncorrected_fallback:JAXA GSMaP_NRT v9'),frame(0,corrected),frame(1,'open_meteo'),frame(2,'gsmap_rnc')],available_horizons:[1,2],policy_version:'live-v2.3',rendering:'full_hann'};
const historical={storm_id:'fixture',source:'jaxa',source_label:'Historical fixture',event_name:'Fixture',category:'historical',dates:'Fixture',total_rainfall_mm:0,official_total_mm:null,is_calibrated:false,description:'Fixture',total_frames:1,bounds:timeline.bounds,frames:[{hour_index:0,raw_time:stamp(0),display_time:'Fixture',hourly_rain_mm:0,cum_rain_mm:0,inundated_km2:0,q_peak_m3s:null,narrative:'Fixture',raster_uri:'data:image/png;base64,'+png}]};
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
let socket,sequence=0;const pending=new Map(),errors=[];
function command(method,params={}){return new Promise((resolve,reject)=>{const id=++sequence;pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params}));});}
async function evaluate(expression){const r=await command('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;}
async function waitFor(expression){for(let i=0;i<180;i++){if(await evaluate(expression))return;await pause(150);}throw Error('Timed out: '+expression);}
async function click(selector){await evaluate(`(()=>{const b=document.querySelector(${JSON.stringify(selector)});if(!b)throw Error('Missing button');b.focus();b.click()})()`);}
async function screenshot(name){const r=await command('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(output,name),Buffer.from(r.data,'base64'));}
async function main(){
 const portFile=path.join(profile,'DevToolsActivePort');for(let i=0;i<150&&!fs.existsSync(portFile);i++)await pause(100);
 const port=fs.readFileSync(portFile,'utf8').split(/\r?\n/)[0];const targets=await(await fetch('http://127.0.0.1:'+port+'/json')).json();
 socket=new WebSocket(targets.find(t=>t.type==='page').webSocketDebuggerUrl);await new Promise((r,j)=>{socket.addEventListener('open',r,{once:true});socket.addEventListener('error',j,{once:true});});
 socket.addEventListener('message',async event=>{const m=JSON.parse(event.data);if(m.id){const p=pending.get(m.id);pending.delete(m.id);if(m.error)p.reject(Error(JSON.stringify(m.error)));else p.resolve(m.result);}
  if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails);
  if(m.method==='Fetch.requestPaused'){
   const {requestId,request}=m.params;let body,type='application/json';
   if(request.url.includes('/surrogate/live/v2/timeline'))body=JSON.stringify(timeline);
   else if(request.url.includes('/surrogate/live/v2/snapshots/')){body=png;type='image/png';}
   else if(/\/data\/(scenarios|scenario-assets)\//.test(request.url))body=JSON.stringify(historical);
   if(body){await command('Fetch.fulfillRequest',{requestId,responseCode:200,responseHeaders:[{name:'content-type',value:type},{name:'access-control-allow-origin',value:'*'},{name:'access-control-allow-methods',value:'GET, OPTIONS'},{name:'access-control-allow-headers',value:'content-type'}],body:request.method==='OPTIONS'?'':type==='image/png'?body:Buffer.from(body).toString('base64')});}
   else await command('Fetch.continueRequest',{requestId});
  }
 });
 await command('Page.enable');await command('Runtime.enable');
 await command('Fetch.enable',{patterns:[{urlPattern:'*surrogate/live/v2/*'},{urlPattern:'*/data/scenarios/*.json'},{urlPattern:'*/data/scenario-assets/*.json'}]});
 await command('Page.addScriptToEvaluateOnNewDocument',{source:"try{localStorage.setItem('gakit:scenario-disclaimer-seen','true')}catch{}"});
 await command('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
 await command('Page.navigate',{url:base+'/flood-scenarios'});
 await waitFor("Array.from(document.querySelectorAll('[role=option]')).some(e=>e.textContent.includes('Live inundation estimates'))");
 await waitFor("Boolean(document.querySelector('[data-rainfall-source]'))"); // Initial fetch/effect confirms hydration.
 await evaluate("Array.from(document.querySelectorAll('[role=option]')).find(e=>e.textContent.includes('Live inundation estimates')).click()");
 await waitFor("document.querySelector('[data-rainfall-source]')?.textContent==='JAXA NOW · corrected'");
 fs.mkdirSync(output,{recursive:true});
 const playerLayouts=[];
 for(const width of [1440,1024,768,390]){
  await command('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width<768});
  await pause(200);
  const layout=await evaluate(`(()=>{const p=document.querySelector('[aria-label="Flood simulation timeline"]'),r=p.getBoundingClientRect(),labels=Array.from(p.querySelectorAll('[data-playback-labels] span')).map(e=>e.getBoundingClientRect()),live=p.querySelector('button[aria-label="Return to live and follow updates"]');return {width:innerWidth,playerWidth:r.width,left:r.left,right:r.right,labelsSeparated:labels.length<2||labels[0].right+7<=labels[1].left,liveSeparate:!live.closest('[data-playback-labels]'),speedControls:document.querySelectorAll('button[aria-label*="Playback speed"]').length}})()`);
  assert(layout.left>=0&&layout.right<=width&&layout.labelsSeparated&&layout.liveSeparate&&layout.speedControls===0);
  if(width===1440)assert.equal(Math.round(layout.playerWidth),960);
  playerLayouts.push(layout);
 }
 await command('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
 await pause(200);await screenshot('source-desktop.png');
 await click('button[aria-label="About rainfall correction"]');
 await waitFor("document.querySelector('[role=dialog][aria-label=\"About rainfall correction\"]')?.textContent.includes('XGBoost + Spatial Correction')");
 assert(await evaluate("document.querySelector('[role=dialog]').contains(document.activeElement)"));
 await evaluate("document.dispatchEvent(new KeyboardEvent('keydown',{key:'Tab',shiftKey:true,bubbles:true,cancelable:true}))");
 assert.equal(await evaluate('document.activeElement.textContent'),'Got it');
 await screenshot('method-desktop.png');
 await command('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
 await command('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
 await waitFor("!document.querySelector('[role=dialog][aria-label=\"About rainfall correction\"]')");
 assert.equal(await evaluate("document.activeElement.getAttribute('aria-label')"),'About rainfall correction');
 await click('button[aria-label="Next hour"]');await waitFor("document.querySelector('[data-rainfall-source]')?.textContent==='Open-Meteo'");
 assert(await evaluate("document.querySelector('[aria-label=\"Rainfall source\"]').textContent.includes('Open-Meteo retrieved')"));
 await click('button[aria-label="Next hour"]');await waitFor("document.querySelector('[data-rainfall-source]')?.textContent==='JAXA RNC'");
 assert(await evaluate("document.querySelector('[aria-label=\"Rainfall source\"]').textContent.includes('Forecast issued')"));
 await command('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
 await waitFor("document.querySelector('button[aria-label=\"Toggle flood overview\"]').getAttribute('aria-expanded')==='false'");
 await click('button[aria-label="Toggle flood overview"]');await waitFor("Boolean(document.querySelector('[data-rainfall-source]'))");
 await click('button[aria-label="About rainfall correction"]');await waitFor("Boolean(document.querySelector('[role=dialog][aria-label=\"About rainfall correction\"]'))");
 const fit=await evaluate("(()=>{const d=document.querySelector('[role=dialog]'),r=d.getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,overflow:d.scrollWidth>d.clientWidth,pageOverflow:document.documentElement.scrollWidth>innerWidth}})()");
 assert(fit.x>=0&&fit.y>=0&&fit.right<=390&&fit.bottom<=844&&!fit.overflow&&!fit.pageOverflow);
 await screenshot('method-mobile.png');await click('button[aria-label="Close rainfall correction details"]');
 await waitFor("!document.querySelector('[role=dialog][aria-label=\"About rainfall correction\"]')");
 for(let i=0;i<3;i++){await click('button[aria-label="Previous hour"]');await pause(100);}
 await waitFor("document.querySelector('[data-rainfall-source]')?.textContent==='JAXA NRT · raw fallback'");
 await click('button[aria-label="About rainfall correction"]');
 await waitFor("document.querySelector('[role=dialog]')?.textContent.includes('The available observations are uncorrected')");
 await evaluate("Array.from(document.querySelectorAll('[role=dialog] button')).find(b=>b.textContent==='Got it').click()");
 await waitFor("!document.querySelector('[role=dialog][aria-label=\"About rainfall correction\"]')");
 // Older published snapshots identify a mixed window, but not its selected hour.
 timeline.policy_version='live-v2.2';
 Object.assign(timeline.frames[1],{hourly_rainfall_source:null,rainfall_sources:['JAXA GSMaP_NOW','JAXA GSMaP_NRT v9']});
 await command('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
 await command('Page.reload',{ignoreCache:true});
 await waitFor("Boolean(document.querySelector('[data-rainfall-source]'))");
 await evaluate("Array.from(document.querySelectorAll('[role=option]')).find(e=>e.textContent.includes('Live inundation estimates')).click()");
 await waitFor("document.querySelector('[data-rainfall-source]')?.textContent==='JAXA NOW + JAXA NRT'");
 assert(await evaluate("document.querySelector('[aria-label=\"Rainfall source\"]').textContent.includes('selected hour is not identified')"));
 assert.equal(errors.length,0,'No browser runtime exceptions');
 const proof={passed:true,playerLayouts,legacy_mixed_source_window_visible:true,selected_hour_provider_and_24h_sources_visible:true,RNC_issue_and_NWP_retrieval_distinguished:true,raw_fallback_and_modal_status_verified:true,method_modal_opens:true,Escape_and_close_button_work:true,focus_trapped_and_restored:true,mobile_modal_fits:true,runtime_exceptions:errors.length};
 fs.writeFileSync(path.join(output,'checks.json'),JSON.stringify(proof,null,2));console.log(JSON.stringify(proof));
}
main().catch(async e=>{console.error(e);if(socket?.readyState===WebSocket.OPEN){fs.mkdirSync(output,{recursive:true});await screenshot('failure.png');console.error(JSON.stringify(await evaluate("({body:document.body.innerText.slice(0,4500),sources:Array.from(document.querySelectorAll('[data-rainfall-source]')).map(e=>e.textContent)})")));console.error(JSON.stringify(errors));}process.exitCode=1;}).finally(async()=>{if(socket?.readyState===WebSocket.OPEN){try{await command('Browser.close')}catch{}socket.close();}else browser.kill();});
