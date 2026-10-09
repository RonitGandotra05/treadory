import assert from 'node:assert/strict';
import {readFile,mkdir} from 'node:fs/promises';
const {webkit}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await webkit.launch();const page=await browser.newPage({viewport:{width:360,height:1000}});const errors=[];
page.on('pageerror',error=>errors.push(error.message));
try{
 await page.route('https://mode.test/**',async route=>{const file=new URL(route.request().url()).pathname.slice(1)||'popup.html';await route.fulfill({body:await readFile(`dist-extension/${file}`),contentType:file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':file.endsWith('.png')?'image/png':'text/html'});});
 await page.addInitScript(()=>{
  const mapping={action:'scrollDown',amount:400,seconds:5};
  const state={config:{version:1,enabled:true,autoConnect:false,device:null,pedalCount:3,mappings:{left:{...mapping},middle:{...mapping,action:'play'},right:{...mapping},auxiliary:{...mapping,action:'none'}},sites:{},calibrations:{}},connected:false,profile:null,physical:{left:false,middle:false,right:false,auxiliary:false},wizard:null,history:[],message:'Browser ready.',hidSupported:true,native:{connected:false,capturing:false,enabled:false,message:'Not connected.'}};
  window.requests=[];window.modeState=state;window.rejectClose=false;
  window.chrome={runtime:{getURL:file=>'chrome-extension://test/'+file,connect:()=>({onMessage:{addListener:fn=>window.modeUpdate=fn}}),sendMessage:async message=>{
   window.requests.push(message);
   if(message.type==='native'){
    if(window.rejectClose)return {ok:false,error:'Helper could not disconnect.'};
    Object.assign(state.native,{connected:false,capturing:false,enabled:false});return {ok:true,native:structuredClone(state.native)};
   }
   return {ok:true,state:structuredClone(state)};
  }},tabs:{create:async args=>window.requests.push({opened:args.url}),query:async()=>[{url:'https://example.org/'}]},permissions:{contains:async()=>false,getAll:async()=>({origins:[]})}};
 });
 await page.goto('https://mode.test/popup.html');await page.locator('#action-left').waitFor();
 assert.equal(await page.locator('#browser-mode').getAttribute('aria-pressed'),'true');assert.equal(await page.locator('#native-open').getAttribute('aria-pressed'),'false');
 await page.locator('#native-open').click();assert.equal(await page.evaluate(()=>window.requests.at(-1).opened),'chrome-extension://test/native.html');assert.equal(await page.evaluate(()=>window.requests.some(r=>r.type==='native')),false);
 await page.evaluate(()=>{Object.assign(window.modeState.native,{connected:true,capturing:true,enabled:true,message:'Computer-wide active.'});window.modeUpdate(structuredClone(window.modeState));});
 assert.equal(await page.locator('#native-open').getAttribute('aria-pressed'),'true');assert.equal(await page.locator('#browser-mode').isDisabled(),false);assert.equal(await page.locator('#connect').isDisabled(),true);assert.equal(await page.locator('#enabled').isDisabled(),true);
 await page.evaluate(()=>window.rejectClose=true);await page.locator('#browser-mode').click();await page.waitForFunction(()=>document.getElementById('status').textContent==='Helper could not disconnect.');assert.equal(await page.locator('#native-open').getAttribute('aria-pressed'),'true');
 await page.evaluate(()=>window.rejectClose=false);await page.locator('#browser-mode').click();await page.waitForFunction(()=>document.getElementById('browser-mode').getAttribute('aria-pressed')==='true');assert.equal(await page.evaluate(()=>window.modeState.native.capturing),false);assert.equal(await page.locator('#connect').isDisabled(),false);assert.equal(await page.locator('#enabled').isDisabled(),false);
 for(const width of [360,320]){await page.setViewportSize({width,height:1000});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);}
 await mkdir('test-results',{recursive:true});await page.screenshot({path:'test-results/control-mode-popup.png',fullPage:true});assert.deepEqual(errors,[]);
 console.log('PASS control mode UI: actual state, setup without capture, browser/native isolation, rejected stop, explicit return to browser and mobile layout. Virtual helper only.');
}finally{await browser.close();}
