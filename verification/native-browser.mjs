import assert from 'node:assert/strict';
import {readFile,mkdir} from 'node:fs/promises';
const {webkit}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await webkit.launch();const context=await browser.newContext({viewport:{width:1100,height:900}});const page=await context.newPage();const errors=[];let checks=0;
page.on('pageerror',e=>errors.push(e.message));
await mkdir('test-results',{recursive:true});
try{
 await page.route('https://native.test/**',async route=>{const file=new URL(route.request().url()).pathname.slice(1);await route.fulfill({body:await readFile(`dist-extension/${file}`),contentType:file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':file.endsWith('.png')?'image/png':'text/html'});});
 await page.addInitScript(()=>{
  const state={connected:false,capturing:false,enabled:false,learning:null,learned:[],held:0,presses:0,message:'Helper not connected.'};window.nativeRequests=[];window.nativePermission=false;window.nativeDevices=false;let update=()=>{};
  window.nativeUpdate=patch=>{Object.assign(state,patch);update({native:structuredClone(state)});};
  window.chrome={permissions:{request:async()=>window.nativePermission},storage:{local:{get:async()=>({}),set:async value=>{window.savedNative=value}}},runtime:{connect:()=>({onMessage:{addListener:fn=>{update=fn}},onDisconnect:{addListener(){}}}),sendMessage:async m=>{
   window.nativeRequests.push(m);
   if(m.command==='open')Object.assign(state,{connected:true,message:'Helper connected.'});
   if(m.command==='start')Object.assign(state,{capturing:true,message:'Isolated test active. Originals suppressed.'});
   if(m.command==='learn')state.learning=m.control;
   if(m.command==='mappings'){state.enabled=false;window.appliedNative=m.mappings;}
   if(m.command==='enable'){state.enabled=m.value;state.message=m.value?'Computer-wide actions active.':'Chosen actions paused. Originals suppressed.';}
   if(m.command==='stop'||m.command==='close')Object.assign(state,{capturing:false,enabled:false,learning:null,learned:[],held:0,message:'Original input restored.'},m.command==='close'?{connected:false}:{});
   return {ok:true,native:structuredClone(state),result:{devices:window.nativeDevices?[{token:'a'.repeat(32),label:'VEC Infinity mouse endpoint'}]:[]}};
  }}};
 });
 await page.goto('https://native.test/native.html');await page.locator('#native-connect').waitFor();
 assert.equal(await page.locator('#native-start').isDisabled(),true);assert.equal(await page.locator('#native-enable').isDisabled(),true);checks++;
 await page.locator('#native-connect').click();assert.match(await page.locator('#native-status').innerText(),/not granted/);assert.equal(await page.evaluate(()=>window.nativeRequests.filter(m=>m.command==='open').length),0);checks++;
 await page.evaluate(()=>window.nativePermission=true);await page.locator('#native-connect').click();await page.locator('#native-list').click();assert.match(await page.locator('#native-device-hint').innerText(),/cannot identify/);assert.equal(await page.locator('#native-start').isDisabled(),true);checks++;
 await page.evaluate(()=>window.nativeDevices=true);await page.locator('#native-list').click();await page.locator('#native-device').selectOption('a'.repeat(32));assert.equal(await page.locator('#native-start').isDisabled(),true);await page.locator('#native-reviewed').check();await page.locator('#native-start').click();assert.equal(await page.locator('#native-enable').isDisabled(),true);checks++;
 for(const c of ['left','middle','right']){
  await page.locator(`#learn-${c}`).click();assert.match(await page.locator(`#state-${c}`).innerText(),/Press and release/);
  await page.evaluate(c=>window.nativeUpdate({learning:c,held:1}),c);assert.equal(await page.locator('#native-enable').isDisabled(),true);
  await page.evaluate(c=>{const before=c==='left'?[]:c==='middle'?['left']:['left','middle'];window.nativeUpdate({learning:null,held:0,learned:[...before,c]});},c);
 }
 assert.equal(await page.locator('#native-enable').isDisabled(),true);checks++;
 await page.locator('#map-middle').selectOption('space');await page.locator('#native-output-verified').check();assert.equal(await page.locator('#native-enable').isDisabled(),true);await page.locator('#native-mouse-verified').check();await page.locator('#native-enable').click();assert.equal(await page.evaluate(()=>window.appliedNative.middle),'space');assert.equal(await page.locator('#map-middle').isDisabled(),true);checks++;
 await page.locator('#native-pause').click();assert.match(await page.locator('#native-status').innerText(),/Originals suppressed/);assert.equal(await page.locator('#native-stop').isDisabled(),false);checks++;
 for(const width of [1100,390,320]){await page.setViewportSize({width,height:900});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);checks++;}
 await page.screenshot({path:'test-results/native-setup-mobile.png',fullPage:true});
 await page.locator('#native-stop').click();assert.equal(await page.locator('#native-output-verified').isChecked(),false);assert.equal(await page.locator('#native-start').isDisabled(),true);assert.match(await page.locator('#native-device').innerText(),/Inspect again/);checks++;
 await page.locator('#native-disconnect').click();assert.equal(await page.locator('#native-list').isDisabled(),true);checks++;
 const web=await context.newPage();web.on('pageerror',e=>errors.push(e.message));await web.goto(process.env.PEDALSPECTRA_URL||'http://127.0.0.1:5173/');
 const store=web.getByRole('link',{name:'Get it on Chrome Web Store'});assert.equal(await store.getAttribute('href'),'https://chromewebstore.google.com/detail/treadory-%E2%80%94-foot-pedal-con/kkgfhpnkicjkkiignanfgceldfhlicfl');assert.equal(await store.getAttribute('download'),null);assert.equal(await store.getAttribute('target'),'_blank');checks++;
 assert.equal(await web.locator('a[href="/downloads/treadory-extension.zip"]').count(),0);assert.ok(!(await web.locator('body').innerText()).includes('Developer mode'));assert.match(await web.locator('#computer-wide').textContent(),/normal desktop apps/);checks++;
 await web.getByRole('link',{name:'Computer-wide control · Windows preview'}).click();assert.equal(await web.locator('#computer-wide').isVisible(),true);assert.equal(await web.locator('#browser-extension').isVisible(),false);assert.equal(await web.evaluate(()=>document.querySelector('#browser-extension').closest('#control-options')===document.querySelector('#computer-wide').closest('#control-options')),true);checks++;
 await web.goto(`${process.env.PEDALSPECTRA_URL||'http://127.0.0.1:5173/'}#computer-wide`);await web.waitForFunction(()=>!document.querySelector('#computer-wide').hidden);await web.waitForFunction(()=>{const r=document.querySelector('#control-options').getBoundingClientRect();return r.top<innerHeight&&r.bottom>0;});checks++;
 await web.getByRole('button',{name:'Test & fix pedal',exact:false}).click();await web.getByRole('button',{name:'Device outputs',exact:true}).click();await web.getByRole('button',{name:'Computer-wide control · Windows preview'}).click();assert.equal(await web.getByRole('dialog').count(),0);assert.equal(await web.locator('#computer-wide').isVisible(),true);checks++;
 await web.getByRole('tab',{name:'Website-wide'}).click();assert.equal(await store.isVisible(),true);assert.equal(await web.locator('#computer-wide').isVisible(),false);checks++;
 await web.getByRole('tab',{name:'Website-wide'}).press('ArrowRight');assert.equal(await web.getByRole('tab',{name:'System-wide'}).getAttribute('aria-selected'),'true');assert.equal(await web.locator('#scope-computer').evaluate(el=>el===document.activeElement),true);checks++;
 await web.getByRole('tab',{name:'System-wide'}).press('Home');assert.equal(await web.getByRole('tab',{name:'Website-wide'}).getAttribute('aria-selected'),'true');await web.locator('#control-options').screenshot({path:'test-results/control-options-web-desktop.png'});checks++;
 await web.getByRole('tab',{name:'Website-wide'}).press('End');assert.equal(await web.locator('#computer-wide').isVisible(),true);await web.locator('#control-options').screenshot({path:'test-results/control-options-system-desktop.png'});checks++;
 const download=web.getByRole('link',{name:'Download Windows helper ZIP'});await download.waitFor();assert.match(await web.locator('#computer-wide').innerText(),/ZIP containing treadory-helper.exe/);assert.match(await web.locator('#computer-wide').textContent(),/Extract All/);assert.match(await web.locator('#computer-wide').textContent(),/install.ps1 -ExtensionId kkgfhpnkicjkkiignanfgceldfhlicfl/);assert.equal(await download.getAttribute('href'),'/downloads/treadory-windows-helper-preview.zip');
 for(const width of [1100,390,320]){await web.setViewportSize({width,height:900});assert.equal(await web.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await web.getByRole('tab',{name:'Website-wide'}).click();assert.equal(await web.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);const sizes=await web.locator('[role=tab]').evaluateAll(tabs=>tabs.map(tab=>tab.getBoundingClientRect().width));assert.ok(Math.abs(sizes[0]-sizes[1])<1);await web.getByRole('tab',{name:'System-wide'}).click();checks++;}
 await web.locator('#control-options').screenshot({path:'test-results/control-options-system-mobile.png'});
 await web.getByRole('tab',{name:'Website-wide'}).click();await web.locator('#control-options').screenshot({path:'test-results/control-options-web-mobile.png'});await web.getByRole('tab',{name:'System-wide'}).click();
 await web.locator('#computer-wide .scope-guide>summary').click();assert.equal(await web.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);checks++;
 await web.screenshot({path:'test-results/computer-wide-mobile.png',fullPage:true});
 const response=await web.request.get(new URL('/downloads/treadory-windows-helper-preview.zip',web.url()).href);assert.equal(response.status(),200);assert.equal((await response.body()).subarray(0,2).toString(),'PK');checks++;
 await web.route('**/downloads/helper-release.json',route=>route.fulfill({json:{format:1,platform:'windows-x64',available:false,preview:true}}));await web.reload();await web.waitForFunction(()=>!document.querySelector('#computer-wide').hidden);assert.equal(await web.getByRole('link',{name:'Download Windows helper ZIP'}).count(),0);assert.equal(await web.getByRole('link',{name:'Download helper source & setup'}).count(),1);checks++;
 await web.evaluate(()=>{window.contextMenus=0;document.addEventListener('contextmenu',()=>window.contextMenus++);});await web.locator('h1').click({button:'right'});assert.equal(await web.evaluate(()=>window.contextMenus),1);checks++;
 assert.deepEqual(errors,[]);console.log(`PASS ${checks} native setup/browser/download/layout scenarios; virtual helper, no physical suppression assertion.`);
}finally{await browser.close();}
