import assert from 'node:assert/strict';
import {test} from 'node:test';
import {NativeBridge} from '../extension/src/native-bridge.js';
const event=()=>({listeners:[],addListener(fn){this.listeners.push(fn)},emit(value){for(const fn of this.listeners)fn(value)}});
const neutral=()=>({capturing:false,enabled:false,learning:null,learned:[],held:0,presses:0});
function fixture(){
 const messages=[],ports=[],runtime={connectNative(name){assert.equal(name,'app.treadory.helper');const port={onMessage:event(),onDisconnect:event(),postMessage(m){messages.push(m)},disconnect(){this.closed=true;this.onDisconnect.emit()}};ports.push(port);return port;}};
 let updates=0;const bridge=new NativeBridge(runtime,()=>updates++);
 return {bridge,messages,ports,updates:()=>updates,reply(state=neutral(),ok=true){const m=messages.at(-1);ports.at(-1).onMessage.emit({id:m.id,ok,state,error:ok?undefined:'Device is ambiguous.'});}};
}
test('does not connect without explicit open; whitelist and envelope are fixed',async()=>{
 const f=fixture();assert.equal(f.ports.length,0);await assert.rejects(f.bridge.request('start'),/Connect/);
 f.bridge.open();f.bridge.open();assert.equal(f.ports.length,1);
 const response=f.bridge.request('state',{id:-1,version:99,type:'shell'});assert.equal(f.messages[0].type,'state');assert.equal(f.messages[0].version,1);assert.equal(f.messages[0].id,1);f.reply();await response;
 await assert.rejects(f.bridge.request('shell'),/Unsupported/);f.bridge.close();
});
test('rejects arbitrary mappings before reaching native code',async()=>{
 const f=fixture();f.bridge.open();await assert.rejects(f.bridge.request('mappings',{mappings:{left:'none',middle:'exec',right:'none'}}),/Unsupported/);assert.equal(f.messages.length,0);f.bridge.close();
});
test('capture/enable states update only from validated helper responses',async()=>{
 const f=fixture();f.bridge.open();const p=f.bridge.request('start',{token:'opaque',reviewed:true});assert.equal(f.bridge.snapshot().capturing,false);
 f.reply({...neutral(),capturing:true});await p;assert.equal(f.bridge.snapshot().capturing,true);assert.equal(f.bridge.snapshot().enabled,false);
 const q=f.bridge.request('enable',{value:true,verified:true});f.reply({...neutral(),capturing:true,enabled:true,learned:['left','middle','right']});await q;assert.equal(f.bridge.snapshot().enabled,true);f.bridge.close();assert.equal(f.bridge.snapshot().enabled,false);
});
test('disconnect cancels pending requests and clears learned session',async()=>{
 const f=fixture();f.bridge.open();const p=f.bridge.request('learn',{control:'middle'});const rejected=assert.rejects(p,/Original pedal input restored/);f.ports[0].onDisconnect.emit();await rejected;assert.deepEqual(f.bridge.snapshot().learned,[]);assert.equal(f.bridge.snapshot().connected,false);
});
test('malformed host response disconnects rather than trusting state',async()=>{
 const f=fixture();f.bridge.open();const p=f.bridge.request('state');const rejected=assert.rejects(p,/Invalid helper response/);f.ports[0].onMessage.emit({id:1,ok:true,state:{...neutral(),learned:['ordinary-mouse']}});await rejected;assert.equal(f.ports[0].closed,true);
});
test('old-port events cannot overwrite a newly connected session',async()=>{
 const f=fixture();f.bridge.open();f.bridge.close();f.bridge.open();f.ports[0].onMessage.emit({state:{...neutral(),capturing:true,enabled:true}});assert.equal(f.bridge.snapshot().capturing,false);f.bridge.close();
});
test('native backend rejection does not report activation',async()=>{
 const f=fixture();f.bridge.open();const p=f.bridge.request('start');const rejected=assert.rejects(p,/ambiguous/);f.reply(neutral(),false);await rejected;assert.equal(f.bridge.snapshot().enabled,false);f.bridge.close();
});
test('inconsistent active state and duplicate learned controls are rejected',()=>{
 for(const state of [{...neutral(),enabled:true},{...neutral(),capturing:true,learned:['middle','middle']}]){
  const f=fixture();f.bridge.open();f.ports[0].onMessage.emit({state});assert.equal(f.bridge.snapshot().connected,false);
 }
});
test('stopped event restores UI state and keeps the recovery explanation',()=>{
 const f=fixture();f.bridge.open();f.ports[0].onMessage.emit({event:'stopped',reason:'Device changed. Original restored.',state:neutral()});assert.equal(f.bridge.snapshot().capturing,false);assert.match(f.bridge.snapshot().message,/Device changed/);f.bridge.close();
});
test('heartbeats preserve the stop reason until explicit reinspection',async()=>{
 const f=fixture();f.bridge.open();f.ports[0].onMessage.emit({event:'stopped',reason:'Device unplugged. Original restored.',state:neutral()});
 const ping=f.bridge.request('ping');f.reply();await ping;assert.match(f.bridge.snapshot().message,/Device unplugged/);
 const list=f.bridge.request('list');f.reply();await list;assert.match(f.bridge.snapshot().message,/Inspect/);f.bridge.close();
});
test('heartbeat uses the same framed request path and disconnect clears it',async t=>{
 t.mock.timers.enable({apis:['setInterval','setTimeout']});const f=fixture();f.bridge.open();t.mock.timers.tick(1001);assert.equal(f.messages.at(-1).type,'ping');f.reply();await Promise.resolve();f.bridge.close();const count=f.messages.length;t.mock.timers.tick(10000);assert.equal(f.messages.length,count);
});
test('unresponsive host expires rather than leaving a local active state',async t=>{
 t.mock.timers.enable({apis:['setInterval','setTimeout']});const f=fixture();f.bridge.open();const p=f.bridge.request('state');const rejected=assert.rejects(p,/did not respond/);t.mock.timers.tick(4001);await rejected;assert.equal(f.bridge.snapshot().connected,false);assert.equal(f.ports[0].closed,true);
});
