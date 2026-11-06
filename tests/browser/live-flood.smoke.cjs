// Browser smoke fixture: run against a running client with Playwright installed.
// All simulation JSON and PNG responses are intercepted; no forecast accuracy is asserted.

const {chromium}=require(process.env.GAKIT_PLAYWRIGHT_MODULE || 'playwright');
const assert=require('node:assert/strict');
const base=process.env.GAKIT_BASE_URL || 'http://localhost:3000';
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFUlEQVR4nGNk23blLAMDAwMTiABhACOeAmF25L8LAAAAAElFTkSuQmCC','base64');
const T=new Date();T.setUTCMinutes(0,0,0);
const stamp=h=>new Date(+T+h*3600000).toISOString();
const frame=(h,kind,area,ready=true)=>({frame_id:String(h+100),valid_at:stamp(h),kind,horizon_hours:kind==='forecast'?h:0,window_start_at:stamp(h-24),window_end_at:stamp(h),window_hours:24,valid_hours:ready?24:21,missing_intervals:ready?[]:[stamp(1),stamp(2),stamp(3)],availability:ready?'ready':'incomplete',reason:ready?null:'incomplete_rainfall_window',rainfall_24h_mm:ready?24:null,hourly_rain_mm:ready?1:null,inundated_km2:ready?area:null,max_depth_m:ready?2:null,raster_url:ready?`/api/v1/surrogate/live/v2/snapshots/fixture/frames/${h+100}.png`:null,forecast_source:kind==='forecast'?'open_meteo':null,source_issues:[],coverage_fraction:ready?1:null});
const timeline={schema_version:2,snapshot_id:'fixture',created_at:new Date().toISOString(),evaluated_at:new Date().toISOString(),expires_at:new Date(Date.now()+3600000).toISOString(),observed_at:stamp(0),forecast_anchor_at:stamp(0),freshness:'fresh',readiness:'partial',build_state:'ready',bounds:[[124.15,8.35],[124.5,8.35],[124.5,8.1],[124.15,8.1]],frames:[frame(-1,'replay',2.34),frame(0,'latest',9.12),frame(1,'forecast',12.34),frame(3,'forecast',null,false)],available_horizons:[0,1],policy_version:'live-v2.1',rendering:'full_hann'};
(async()=>{
 const browser=await chromium.launch({channel:process.platform === 'win32' ? 'msedge' : undefined,headless:true});try { const page=await browser.newPage({viewport:{width:1440,height:1000}});let images=0;
 await page.addInitScript(()=>{localStorage.setItem('gakit:first-visit-seen','true');localStorage.setItem('gakit:onboarding-v1',JSON.stringify({version:1,locationChoice:'skipped',completedAt:new Date().toISOString()}))});
 await page.route('**/api/v1/surrogate/live/v2/timeline',route=>route.fulfill({json:timeline,headers:{'access-control-allow-origin':'*'}}));
 await page.route('**/api/v1/drought/catalog',route=>route.fulfill({json:{status:'pending',generatedAt:null,periods:[],forecastStatus:'unavailable',observedMessage:'Fixture awaiting assessment',forecastMessage:'Fixture awaiting outlook'},headers:{'access-control-allow-origin':'*'}}));
 await page.route('**/api/v1/surrogate/live/v2/snapshots/**',route=>{images++;return route.fulfill({body:png,contentType:'image/png',headers:{'access-control-allow-origin':'*'}})});
 await page.route(/\/data\/(scenarios|scenario-assets)\/[^/]+\.json$/,route=>route.fulfill({json:{storm_id:'fixture',source:'fixture',source_label:'Fixture',event_name:'Fixture',category:'historical',dates:'Fixture',total_rainfall_mm:0,official_total_mm:null,is_calibrated:false,description:'Fixture',total_frames:0,bounds:timeline.bounds,frames:[]}}));
 const area=async value=>page.waitForFunction(value=>document.querySelector('[data-flood-metric="area"]')?.textContent.includes(value),value);
 await page.goto(`${base}/flood-scenarios`,{waitUntil:'domcontentloaded'});
 const notice=page.getByRole('button',{name:'Start exploring',exact:true});await notice.waitFor({state:'visible'});await notice.click();
 await page.locator('[data-scenario-header]').getByRole('button',{name:/Change scenario/}).click();
 await page.getByRole('option',{name:/Live inundation estimates/}).click();
 await area('9.12');
 const scenarioControls=page.getByRole('group',{name:'Playback controls',exact:true});
 await scenarioControls.getByRole('button',{name:'Previous hour',exact:true}).click();await area('2.34');
 assert.equal(await scenarioControls.getByRole('button',{name:'Previous hour',exact:true}).isDisabled(),true);
 await scenarioControls.getByRole('button',{name:'Next hour',exact:true}).click();await area('9.12');
 await page.getByRole('slider').first().press('Home');await area('2.34');
 await page.getByRole('slider').first().press('End');await page.getByText('Forecast rainfall incomplete (21/24 hours)',{exact:true}).waitFor();
 assert((await page.locator('[data-flood-metric="area"]').innerText()).includes('—'));assert(images>=2);
 await page.goto(`${base}/`,{waitUntil:'domcontentloaded'});
 const toggle=page.getByRole('switch',{name:'Flood Simulation',exact:true});
 await toggle.click();await area('9.12');
 const publicControls=page.getByRole('group',{name:'Playback controls',exact:true});
 await publicControls.getByRole('button',{name:'Previous hour',exact:true}).click();await area('2.34');
 await publicControls.getByRole('button',{name:'Next hour',exact:true}).click();await area('9.12');
 await page.getByRole('slider',{name:'Select past, live, or forecast flood estimate',exact:true}).press('End');
 await page.getByText('Forecast rainfall incomplete (21/24 hours)',{exact:true}).waitFor();
 assert.equal(await publicControls.getByRole('button',{name:'Next hour',exact:true}).isDisabled(),true);
 assert((await page.locator('[data-flood-metric="area"]').innerText()).includes('—'));
 await toggle.click();assert.equal(await page.getByRole('region',{name:'Flood simulation timeline',exact:true}).count(),0);
 console.log(JSON.stringify({scenario:'latest, replay and unavailable forecasts',publicMap:'latest, replay and unavailable forecasts',decodedImageFetches:images}));
 } finally { await browser.close(); }
})().catch(e=>{console.error(e.stack);process.exit(1)});
