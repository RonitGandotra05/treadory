import {test} from 'node:test';
import assert from 'node:assert/strict';
import {rightClickGuard} from '../extension/src/right-click-guard.js';
import {build} from 'esbuild';
const bundled=await build({entryPoints:['extension/src/settings.js'],bundle:true,write:false,format:'esm',platform:'node'});
const {defaults,validate}=await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString('base64')}`);
test('opt in and migration never broaden an existing right-only guard',()=>{
 const old=defaults();assert.equal(old.rightClickGuard,false);assert.equal(old.clickGuardScope,'all');delete old.clickGuardScope;delete old.rightClickGuard;
 assert.equal(validate(old).rightClickGuard,false);assert.equal(validate({...old,rightClickGuard:true}).clickGuardScope,'right');
 assert.equal(validate({...old,rightClickGuard:true,clickGuardScope:'all'}).clickGuardScope,'all');
 for(const value of ['true',1,null,{},[]])assert.throws(()=>validate({...old,rightClickGuard:value}),/invalid/);
 assert.throws(()=>validate({...old,clickGuardScope:'left'}),/invalid/);
});
function fixture(){
 const listeners=new Map();let now=1000,mono=0;
 const saved={window:globalThis.window,performance:globalThis.performance};const date=Date.now;Date.now=()=>now;
 globalThis.performance={timeOrigin:1000,now:()=>mono};globalThis.window={addEventListener(type,fn){listeners.set(type,fn)},removeEventListener(type,fn){if(listeners.get(type)===fn)listeners.delete(type)}};
 return {listeners,advance(ms){now+=ms;mono+=ms},wall(ms){now+=ms},arm(ms=250,scope='all'){rightClickGuard(1000+mono+ms,scope)},event(type,button=2,isTrusted=true,extra={}){const e={type,button,isTrusted,...extra,canceled:false,preventDefault(){this.canceled=true},stopImmediatePropagation(){}};listeners.get(type)?.(e);return e},close(){rightClickGuard(0);Date.now=date;globalThis.window=saved.window;globalThis.performance=saved.performance}};
}
test('all five buttons and complete sequences; movement/wheel and synthetic actions preserved',()=>{
 const f=fixture();try{f.arm();for(const button of [0,1,2,3,4])for(const type of ['pointerdown','mousedown','pointerup','mouseup','click','auxclick','dblclick'])assert.equal(f.event(type,button).canceled,true,`${type}/${button}`);
 assert.equal(f.event('contextmenu',2).canceled,true);assert.equal(f.event('click',0,false).canceled,false);assert.equal(f.event('contextmenu',-1).canceled,false);assert.equal(f.event('pointerdown',0,true,{pointerType:'touch'}).canceled,false);assert.equal(f.listeners.has('wheel'),false);assert.equal(f.listeners.has('pointermove'),false);
 }finally{f.close()}
});
test('0,249,250,251 boundaries refer to new downs, not release ownership',()=>{
 for(const ms of [0,249,250,251]){const f=fixture();try{f.arm();f.advance(ms);assert.equal(f.event('mousedown',0).canceled,ms<250);f.advance(300);assert.equal(f.event('mouseup',0).canceled,ms<250)}finally{f.close()}}
});
test('delayed arming, repeats and held pedals keep original finite deadline',()=>{
 const f=fixture();try{f.arm(30);f.advance(29);assert.equal(f.event('mousedown').canceled,true);f.advance(1);assert.equal(f.event('mouseup').canceled,true);assert.equal(f.event('mousedown',0).canceled,false);f.arm();f.advance(249);assert.equal(f.event('mousedown',1).canceled,true);f.advance(2);assert.equal(f.event('mousedown',3).canceled,false);assert.equal(f.listeners.size,11)}finally{f.close()}
});
test('right only; preexisting down/up crossing window and unknown held drag are preserved',()=>{
 const f=fixture();try{f.arm(250,'right');assert.equal(f.event('mousedown',0).canceled,false);assert.equal(f.event('mouseup',0).canceled,false);assert.equal(f.event('mouseup',2).canceled,false);assert.equal(f.event('contextmenu',2).canceled,false);assert.equal(f.event('mousedown',2).canceled,true)}finally{f.close()}
});
test('five-second sequence failsafe, stop and navigation clear protection',()=>{
 const f=fixture();try{f.arm();assert.equal(f.event('mousedown').canceled,true);f.advance(5000);assert.equal(f.event('mouseup').canceled,false);rightClickGuard(0);assert.equal(f.listeners.size,0);f.arm();f.listeners.get('pagehide')();assert.equal(f.listeners.size,0);for(const deadline of [NaN,Infinity,999,6251]){rightClickGuard(deadline);assert.equal(f.listeners.size,0)}}finally{f.close()}
});

test('wall-clock changes and stale asynchronous arm requests do not alter monotonic window',()=>{
 const f=fixture();try{f.arm();f.advance(200);f.wall(86400000);f.arm(30);f.advance(49);assert.equal(f.event('mousedown',0).canceled,true);f.advance(1);assert.equal(f.event('mousedown',1).canceled,false);rightClickGuard(1200,'all');assert.equal(f.event('mouseup',0).canceled,true)}finally{f.close()}
});

test('keyboard menu commands are never canceled or confused with a blocked right sequence',()=>{
 const f=fixture();try{f.arm();assert.equal(f.event('mousedown',2).canceled,true);assert.equal(f.event('keydown',0,true,{key:'F10',shiftKey:true}).canceled,false);assert.equal(f.event('contextmenu',2).canceled,false)}finally{f.close()}
});
