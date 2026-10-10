import assert from 'node:assert/strict';
import {rightClickGuard} from '../extension/src/right-click-guard.js';
const {webkit}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await webkit.launch();
try{
 const page=await browser.newPage();
 await page.setContent('<button id="target">Test</button>');
 await page.evaluate(()=>{
  window.observed=[];
  for(const type of ['mousedown','mouseup','auxclick','contextmenu','click'])document.addEventListener(type,event=>observed.push([type,event.button,event.isTrusted]));
 });
 const arm=async()=>page.evaluate(rightClickGuard,Date.now()+250);
 const click=button=>page.mouse.click(35,15,{button});
 const observed=()=>page.evaluate(()=>observed);
 await arm();await click('right');assert.deepEqual(await observed(),[]);
 await page.waitForTimeout(270);await click('right');assert.ok((await observed()).some(([type])=>type==='contextmenu'));
 await page.evaluate(()=>observed=[]);await arm();await click('left');assert.ok((await observed()).some(([type])=>type==='click'));
 await page.evaluate(()=>observed=[]);await arm();await page.evaluate(()=>document.querySelector('button').click());assert.ok((await observed()).some(([type,,trusted])=>type==='click'&&!trusted));
 await page.evaluate(()=>observed=[]);await arm();await page.evaluate(rightClickGuard,0);await click('right');assert.ok((await observed()).some(([type])=>type==='contextmenu'));
 console.log('PASS browser guard: trusted right-click blocked, expiry, ordinary left-click, synthetic actions and immediate disable.');
}finally{await browser.close();}
