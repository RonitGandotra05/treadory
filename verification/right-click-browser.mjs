import assert from 'node:assert/strict';
import {rightClickGuard} from '../extension/src/right-click-guard.js';
const playwright=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
for(const name of (process.env.TEST_BROWSERS||'chromium,webkit').split(',')){
 const browser=await playwright[name].launch(name==='chromium'&&process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:undefined);
 try{
  const page=await browser.newPage();await page.setContent('<button id="target">Test</button><div style="height:3000px">Scroll</div>');
  await page.addScriptTag({content:`window.armGuard = ${rightClickGuard.toString()}`});
  await page.evaluate(()=>{window.observed=[];for(const type of ['pointerdown','pointerup','mousedown','mouseup','auxclick','contextmenu','click','dblclick','wheel'])document.addEventListener(type,event=>observed.push([type,event.button,event.isTrusted]));});
  const arm=scope=>page.evaluate(scope=>armGuard(performance.timeOrigin+performance.now()+250,scope),scope);
  const clear=()=>page.evaluate(()=>{armGuard(0);observed=[]});
  const click=button=>page.mouse.click(35,15,{button});const observed=()=>page.evaluate(()=>observed);
  for(const button of ['left','middle','right']){await clear();await arm('all');await click(button);assert.deepEqual(await observed(),[])}
  await clear();await arm('right');await click('left');assert.ok((await observed()).some(([type])=>type==='click'));
  await clear();await arm('all');await page.evaluate(()=>document.querySelector('button').click());assert.ok((await observed()).some(([type,,trusted])=>type==='click'&&!trusted));
  await clear();await arm('all');await page.mouse.move(35,15);await page.mouse.down();await page.waitForTimeout(270);await page.mouse.up();assert.deepEqual(await observed(),[],'release after deadline still paired');
  await clear();await page.mouse.down();await arm('all');await page.mouse.up();assert.ok((await observed()).some(([type])=>type==='mouseup'),'preexisting drag release allowed');
  await clear();await arm('all');await page.mouse.dblclick(35,15);assert.deepEqual(await observed(),[],'double-click canceled');
  await clear();await arm('all');await page.mouse.wheel(0,200);await page.waitForTimeout(30);assert.ok((await observed()).some(([type])=>type==='wheel'));
  await clear();await arm('all');await page.evaluate(()=>armGuard(0));await click('right');assert.ok((await observed()).some(([type])=>type==='contextmenu'));
  await clear();await arm('all');await page.waitForTimeout(270);await click('left');assert.ok((await observed()).some(([type])=>type==='click'));
  const delay=await page.evaluate(()=>{const detected=performance.timeOrigin+performance.now();const past=detected-260;armGuard(past+250,'all');return {listenersArmed:Boolean(window.__treadoryRightClickGuard),processingMs:performance.timeOrigin+performance.now()-detected}});await clear();
  console.log(`PASS ${name}: actual mouse sequences, all/right, synthetic actions, expiry, drag, double-click, wheel and clear; arm processing ${delay.processingMs.toFixed(2)} ms. No hardware or installed-extension assertion.`);
 }finally{await browser.close()}
}
