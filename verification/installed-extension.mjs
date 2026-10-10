import assert from 'node:assert/strict';
import path from 'node:path';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const profile=await mkdtemp(path.join(tmpdir(),'treadory-extension-'));
const extension=path.resolve('dist-extension');
const context=await chromium.launchPersistentContext(profile,{headless:true,channel:'chromium',...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{}),args:[`--disable-extensions-except=${extension}`,`--load-extension=${extension}`]});
try{
 const worker=context.serviceWorkers()[0]??await context.waitForEvent('serviceworker',{timeout:15000});const id=new URL(worker.url()).host;
 const popup=await context.newPage();await popup.setViewportSize({width:360,height:1000});await popup.goto(`chrome-extension://${id}/popup.html`);
 const manifest=await popup.evaluate(()=>chrome.runtime.getManifest());assert.equal(manifest.version,'0.1.9');assert.ok(!manifest.permissions.includes('nativeMessaging'));
 await popup.waitForFunction(()=>document.querySelector('#click-guard-scope')?.value==='all');
 assert.equal(await popup.locator('#right-click-guard').isChecked(),false);
 await popup.locator('#click-guard-scope').selectOption('right');
 await popup.waitForFunction(async()=>{const {config}=await chrome.storage.local.get('config');return config?.clickGuardScope==='right'});
 const config=await popup.evaluate(async()=>{const state=await chrome.runtime.sendMessage({type:'state'});return state.state.config});delete config.clickGuardScope;config.rightClickGuard=true;
 const result=await popup.evaluate(config=>chrome.runtime.sendMessage({type:'import',config}),config);assert.equal(result.ok,true);assert.equal(result.state.config.clickGuardScope,'right');
 assert.equal(result.state.connected,false);
 assert.equal(await popup.locator('#app-open').innerText(),'Get the Windows app ↗');
 await popup.screenshot({path:'test-results/extension-0.1.9.png',fullPage:true});
 console.log('PASS real installed Chrome-for-Testing extension: worker/popup startup, opt-in scope persistence, legacy right migration, no nativeMessaging. No physical HID assertion.');
}finally{await context.close();await rm(profile,{recursive:true,force:true})}
