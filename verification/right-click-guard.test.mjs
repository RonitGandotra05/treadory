import {test} from 'node:test';
import assert from 'node:assert/strict';
import {rightClickGuard} from '../extension/src/right-click-guard.js';
import {build} from 'esbuild';
const bundled=await build({entryPoints:['extension/src/settings.js'],bundle:true,write:false,format:'esm',platform:'node'});
const {defaults,validate}=await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString('base64')}`);

test('guard setting is opt-in, migrates older exports and rejects invalid values',()=>{
 const old=defaults();assert.equal(old.rightClickGuard,false);delete old.rightClickGuard;
 assert.equal(validate(old).rightClickGuard,false);
 assert.equal(validate({...old,rightClickGuard:true}).rightClickGuard,true);
 for(const value of ['true',1,null,{},[]])assert.throws(()=>validate({...old,rightClickGuard:value}),/invalid/);
});

function fixture(){
 const listeners=new Map();let now=1000,mono=0;
 const saved={window:globalThis.window,performance:globalThis.performance};
 const date=Date.now;Date.now=()=>now;
 globalThis.performance={now:()=>mono};
 globalThis.window={addEventListener(type,fn){listeners.set(type,fn);},removeEventListener(type,fn){if(listeners.get(type)===fn)listeners.delete(type);}};
 return {listeners,advance(ms){now+=ms;mono+=ms;},arm(ms=250){rightClickGuard(now+ms);},event(type,button=2,isTrusted=true){const e={button,isTrusted,canceled:false,stopped:false,preventDefault(){this.canceled=true;},stopImmediatePropagation(){this.stopped=true;}};listeners.get(type)?.(e);return e;},close(){rightClickGuard(0);Date.now=date;globalThis.window=saved.window;globalThis.performance=saved.performance;}};
}
test('blocks trusted right-button events, but preserves left/middle and synthetic actions',()=>{
 const f=fixture();try{f.arm();for(const type of ['pointerdown','pointerup','mousedown','mouseup','auxclick','contextmenu']){assert.equal(f.event(type).canceled,true);assert.equal(f.event(type,0).canceled,false);assert.equal(f.event(type,1).canceled,false);assert.equal(f.event(type,2,false).canceled,false);}}finally{f.close();}
});
test('expires at exactly 250 ms and detaches every listener',()=>{
 const f=fixture();try{f.arm();f.advance(249);assert.equal(f.event('contextmenu').canceled,true);f.advance(1);assert.equal(f.event('contextmenu').canceled,false);assert.equal(f.listeners.size,0);}finally{f.close();}
});
test('delayed injection uses original deadline, repeated presses never duplicate listeners',()=>{
 const f=fixture();try{f.arm(30);assert.equal(f.listeners.size,7);f.advance(29);assert.equal(f.event('contextmenu').canceled,true);f.arm();assert.equal(f.listeners.size,7);f.advance(250);assert.equal(f.event('contextmenu').canceled,false);}finally{f.close();}
});
test('disable, navigation and invalid deadlines leave no blocking listeners',()=>{
 const f=fixture();try{f.arm();rightClickGuard(0);assert.equal(f.listeners.size,0);f.arm();f.listeners.get('pagehide')();assert.equal(f.listeners.size,0);for(const deadline of [NaN,Infinity,999,1251]){rightClickGuard(deadline);assert.equal(f.listeners.size,0);}}finally{f.close();}
});
