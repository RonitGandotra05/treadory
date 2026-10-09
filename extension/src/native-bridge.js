export const NATIVE_ACTIONS=['none','media','scrollUp','scrollDown','space','enter',...Array.from({length:12},(_,i)=>`f${i+13}`)];
export class NativeBridge {
 constructor(runtime,changed){this.runtime=runtime;this.changed=changed;this.port=null;this.pending=new Map();this.nextId=0;this.timer=null;this.stopReason='';this.state={connected:false,capturing:false,enabled:false,learning:null,learned:[],held:0,presses:0};this.message='Windows helper not connected.';}
 snapshot(){return {...this.state,message:this.message};}
 open(){
  if(this.port)return;
  const port=this.runtime.connectNative('app.treadory.helper');this.port=port;
  this.state={...this.state,connected:true};this.stopReason='';this.message='Helper connected. Inspect the pedal before capture.';
  port.onMessage.addListener(m=>{
   if(this.port!==port)return;
   if(!m||typeof m!=='object'||!m.state||!['capturing','enabled'].every(k=>typeof m.state[k]==='boolean')||!Array.isArray(m.state.learned)||m.state.learned.length>3||new Set(m.state.learned).size!==m.state.learned.length||m.state.learned.some(c=>!['left','middle','right'].includes(c))||!Number.isInteger(m.state.held)||m.state.held<0||m.state.held>7||!Number.isInteger(m.state.presses)||m.state.presses<0||m.state.presses>1000000||![null,'left','middle','right'].includes(m.state.learning)||m.state.enabled&&!m.state.capturing||m.state.learning!==null&&!m.state.capturing){this.close('Invalid helper response. Capture disconnected.');return;}
   this.state={connected:true,capturing:m.state.capturing,enabled:m.state.enabled,learning:m.state.learning,learned:[...new Set(m.state.learned)],held:m.state.held,presses:m.state.presses};
   const request=this.pending.get(m.id);
   if(m.event==='stopped')this.stopReason=typeof m.reason==='string'?m.reason.slice(0,240):'Capture stopped. Original pedal input restored.';
   if(request&&m.ok===false)this.stopReason=typeof m.error==='string'?m.error.slice(0,240):'Native request failed.';
   if(m.state.capturing||request?.type==='list'&&m.ok===true)this.stopReason='';
   this.message=this.stopReason||(m.state.enabled?'Computer-wide actions active. Only the selected pedal is remapped.':m.state.capturing?'Pedal captured. Original outputs suppressed; chosen actions paused.':'Helper connected. Inspect the pedal before capture.');
   if(request){clearTimeout(request.timeout);this.pending.delete(m.id);m.ok?request.resolve(m):request.reject(new Error(typeof m.error==='string'?m.error.slice(0,240):'Native request failed.'));}
   this.changed();
  });
  port.onDisconnect.addListener(()=>{if(this.port===port)this.close(this.runtime.lastError?.message||'Helper disconnected. Original pedal input restored.');});
  this.timer=setInterval(()=>{if(this.pending.size<8)void this.request('ping').catch(()=>{});},1000);
  this.changed();
 }
 request(type,fields={}){
  if(!['list','start','learn','mappings','enable','ping','stop','state'].includes(type))return Promise.reject(new Error('Unsupported native request.'));
  if(type==='mappings' && (!fields.mappings||Object.keys(fields.mappings).length!==3||!['left','middle','right'].every(c=>NATIVE_ACTIONS.includes(fields.mappings[c]))))return Promise.reject(new Error('Unsupported computer-wide mapping.'));
  if(!this.port)return Promise.reject(new Error('Connect the Windows helper first.'));
  if(this.pending.size>=16){this.close('Too many native requests. Capture disconnected.');return Promise.reject(new Error(this.message));}
  const id=++this.nextId;
  return new Promise((resolve,reject)=>{
   const timeout=setTimeout(()=>this.close('Helper did not respond. Capture disconnected.'),4000);
   this.pending.set(id,{resolve,reject,timeout,type});
   try{this.port.postMessage({...fields,type,version:1,id});}catch{this.close('Helper connection failed. Capture disconnected.');}
  });
 }
 close(reason='Helper disconnected. Original pedal input restored.'){
  const port=this.port;this.port=null;clearInterval(this.timer);this.timer=null;
  for(const p of this.pending.values()){clearTimeout(p.timeout);p.reject(new Error(reason));}this.pending.clear();
  try{port?.disconnect();}catch{}
  this.state={connected:false,capturing:false,enabled:false,learning:null,learned:[],held:0,presses:0};this.message=String(reason).slice(0,240);this.changed();
 }
}
