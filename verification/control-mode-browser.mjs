import assert from 'node:assert/strict';
import {readFile,mkdir} from 'node:fs/promises';
const {webkit}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await webkit.launch();const page=await browser.newPage({viewport:{width:360,height:1000}});const errors=[];
page.on('pageerror',error=>errors.push(error.message));
try{
 await page.route('https://mode.test/**',async route=>{const file=new URL(route.request().url()).pathname.slice(1)||'popup.html';await route.fulfill({body:await readFile(`dist-extension/${file}`),contentType:file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':file.endsWith('.png')?'image/png':'text/html'});});
 await page.addInitScript(()=>{
  const mapping={action:'scrollDown',amount:400,seconds:5};
  const state={config:{version:1,enabled:true,autoConnect:false,device:null,pedalCount:3,mappings:{left:{...mapping},middle:{...mapping,action:'play'},right:{...mapping},auxiliary:{...mapping,action:'none'}},sites:{},calibrations:{}},connected:false,profile:null,physical:{left:false,middle:false,right:false,auxiliary:false},wizard:null,history:[],message:'Browser ready.',hidSupported:true};
  window.requests=[];window.modeState=state;window.rejectDisconnect=false;
  window.chrome={runtime:{getURL:file=>'chrome-extension://test/'+file,connect:()=>({onMessage:{addListener:fn=>window.modeUpdate=fn}}),sendMessage:async message=>{
   window.requests.push(message);
   if(message.type==='disconnect'){
    if(window.rejectDisconnect)return {ok:false,error:'Pedal could not disconnect.'};
    state.connected=false;
   }
   if(message.type==='rightClickGuard')state.config.rightClickGuard=message.value;
   return {ok:true,state:structuredClone(state)};
  }},tabs:{create:async args=>window.requests.push({opened:args.url}),query:async()=>[{url:'https://example.org/'}]},permissions:{contains:async()=>false,getAll:async()=>({origins:[]})}};
 });
 await page.goto('https://mode.test/popup.html');await page.locator('#action-left').waitFor();
 assert.equal(await page.locator('#native-open').count(),0);
 assert.equal(await page.locator('#right-click-guard').isChecked(),false);
 await page.locator('#right-click-guard').check();assert.equal(await page.evaluate(()=>window.modeState.config.rightClickGuard),true);
 await page.evaluate(()=>window.rejectDisconnect=true);await page.locator('#app-open').click();await page.waitForFunction(()=>document.getElementById('status').textContent==='Pedal could not disconnect.');assert.equal(await page.evaluate(()=>window.requests.some(r=>r.opened)),false);
 await page.evaluate(()=>window.rejectDisconnect=false);await page.locator('#app-open').click();await page.waitForFunction(()=>window.requests.some(r=>r.opened));
 assert.equal(await page.evaluate(()=>window.requests.at(-1).opened),'https://treadory.netlify.app/#computer-wide');
 assert.equal(await page.evaluate(()=>window.requests.some(r=>r.type==='native')),false);
 assert.equal(await page.locator('#connect').isDisabled(),false);assert.equal(await page.locator('#enabled').isDisabled(),false);
 for(const width of [360,320]){await page.setViewportSize({width,height:1000});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);}
 await mkdir('test-results',{recursive:true});await page.screenshot({path:'test-results/control-mode-popup.png',fullPage:true});assert.deepEqual(errors,[]);
 console.log('PASS popup UI: independent app link, disconnect before download, failed disconnect, guard setting and mobile layout.');
}finally{await browser.close();}
