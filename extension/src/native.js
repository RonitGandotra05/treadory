import {NATIVE_ACTIONS} from './native-bridge.js';
const $=id=>document.getElementById(id),controls=['left','middle','right'];
const labels={none:'Do nothing',media:'Play / pause media',scrollUp:'Scroll up one notch',scrollDown:'Scroll down one notch',space:'Space',enter:'Enter'};
let state={connected:false,capturing:false,enabled:false,learned:[],learning:null,held:0,presses:0},busy=false;
let draft={left:'scrollUp',middle:'media',right:'scrollDown'};
const verified=()=>['native-output-verified','native-mouse-verified'].every(id=>$(id).checked);
const clearVerification=()=>{for(const id of ['native-output-verified','native-mouse-verified'])$(id).checked=false;};
function render(next){
 const previous=state;state=next;
 if(!next.capturing||previous.capturing!==next.capturing||JSON.stringify(previous.learned)!==JSON.stringify(next.learned))clearVerification();
 $('native-status').textContent=next.message||`Pedal ${next.enabled?'active across your computer':next.capturing?'captured · chosen actions paused':'not captured'}.`;
 $('native-connect').disabled=next.connected||busy;$('native-disconnect').disabled=!next.connected||busy;
 $('native-list').disabled=!next.connected||next.capturing||busy;$('native-device').disabled=!next.connected||next.capturing||busy||$('native-device').options.length<2;
 $('native-start').disabled=!next.connected||next.capturing||!$('native-device').value||!$('native-reviewed').checked||busy;
 $('native-stop').disabled=!next.capturing||busy;$('native-pause').disabled=!next.enabled||busy;
 $('native-enable').disabled=!next.capturing||next.enabled||next.learned.length!==3||next.learning!==null||next.held!==0||!verified()||busy;
 for(const c of controls){$(`learn-${c}`).disabled=!next.capturing||next.enabled||next.held!==0||next.learning!==null||busy;$(`state-${c}`).textContent=next.learning===c?'Press and release this pedal':next.learned.includes(c)?'Learned':'Needs learning';$(`map-${c}`).disabled=next.enabled||busy;}
 if(!next.capturing && previous.capturing){$('native-device').replaceChildren(new Option('Inspect again before capturing',''));$('native-reviewed').checked=false;}
}
async function request(command,fields={}){
 const result=await chrome.runtime.sendMessage({type:'native',command,...fields});
 if(!result?.ok)throw new Error(result?.error||'Helper unavailable.');
 if(result.native)render(result.native);return result.result;
}
async function run(operation){if(busy)return;busy=true;render(state);try{await operation();}catch(e){$('native-status').textContent=e.message;}finally{busy=false;render({...state,message:$('native-status').textContent});}}
for(const c of controls){
 const row=document.createElement('div');row.className='native-control';
 const text=document.createElement('strong');text.textContent=`${c[0].toUpperCase()+c.slice(1)} pedal`;
 const learn=document.createElement('button');learn.id=`learn-${c}`;learn.textContent='Learn';learn.addEventListener('click',()=>run(async()=>{clearVerification();await request('learn',{control:c});}));
 const status=document.createElement('small');status.id=`state-${c}`;status.textContent='Needs learning';
 const select=document.createElement('select');select.id=`map-${c}`;select.setAttribute('aria-label',`${c} pedal computer-wide action`);for(const action of NATIVE_ACTIONS)select.append(new Option(labels[action]||action.toUpperCase(),action));select.value=draft[c];
 select.addEventListener('change',()=>{draft[c]=select.value;void chrome.storage.local.set({nativeMappings:draft});});
 row.append(text,learn,status,select);$('native-controls').append(row);
}
$('native-connect').addEventListener('click',async()=>{
 try{const allowed=await chrome.permissions.request({permissions:['nativeMessaging']});if(!allowed)throw new Error('Native messaging permission was not granted.');await run(()=>request('open'));}catch(e){$('native-status').textContent=e.message;}
});
$('native-disconnect').addEventListener('click',()=>run(()=>request('close')));
$('native-list').addEventListener('click',()=>run(async()=>{
 const result=await request('list');$('native-device').replaceChildren(new Option('Choose the identified pedal',''));
 for(const device of result.devices||[])if(typeof device.token==='string'&&/^[0-9a-f]{32}$/.test(device.token))$('native-device').append(new Option(device.label,device.token));
 $('native-device').disabled=false;$('native-device-hint').textContent=result.devices?.length?'One eligible endpoint found. Choose it explicitly.':typeof result.diagnosis==='string'?result.diagnosis.slice(0,600):'No supported mouse endpoint found. This backend cannot identify the unwanted click. Check other utilities; do not intercept another mouse.';
}));
for(const id of ['native-device','native-reviewed','native-output-verified','native-mouse-verified'])$(id).addEventListener('change',()=>render(state));
$('native-start').addEventListener('click',()=>run(async()=>{clearVerification();await request('start',{token:$('native-device').value,reviewed:$('native-reviewed').checked});}));
$('native-stop').addEventListener('click',()=>run(()=>request('stop')));
$('native-pause').addEventListener('click',()=>run(()=>request('enable',{value:false})));
$('native-enable').addEventListener('click',()=>run(async()=>{if(!verified())throw new Error('Verify original output suppression and your ordinary mouse first.');await request('mappings',{mappings:draft});await request('enable',{value:true,verified:true});}));
const port=chrome.runtime.connect({name:'treadory-native-ui'});port.onMessage.addListener(message=>{if(message.native)render(message.native);});
port.onDisconnect.addListener(()=>render({connected:false,capturing:false,enabled:false,learning:null,learned:[],held:0,presses:0,message:'Extension restarted. Reconnect, inspect and learn again.'}));
void chrome.storage.local.get('nativeMappings').then(saved=>{const map=saved.nativeMappings;if(map&&Object.keys(map).length===3&&controls.every(c=>NATIVE_ACTIONS.includes(map[c]))){draft={...map};for(const c of controls)$(`map-${c}`).value=draft[c];}});
render(state);void request('state').catch(e=>{$('native-status').textContent=e.message;});
