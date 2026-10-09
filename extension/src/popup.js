import {ACTIONS,baseMappings,controlsFor,originOf,validate} from './settings.js';
const $=id=>document.getElementById(id);let state=null,origin=null,draft=baseMappings(),dirty=false,renderedKey='';
const title=c=>c[0].toUpperCase()+c.slice(1);
const port=chrome.runtime.connect({name:'treadory-ui'});
async function request(type,fields={}){const response=await chrome.runtime.sendMessage({type,...fields});if(!response?.ok)throw new Error(response?.error||'Extension service unavailable. Reload the extension.');update(response.state);return response.state;}
function error(e){$('status').textContent=e.message||String(e);}
function bind(id,fn){$(id).addEventListener('click',()=>{Promise.resolve().then(fn).catch(error);});}
function text(parent,tag,value){const n=document.createElement(tag);n.textContent=value;parent.append(n);return n;}
function extra(container,control){
 container.replaceChildren();const m=draft[control];
 const input=(label,type,key,max)=>{const id=`extra-${control}`;const l=text(container,'label',label);l.htmlFor=id;const n=document.createElement(type==='textarea'?'textarea':'input');n.id=id;if(type!=='textarea')n.type=type;n.value=m[key]??'';if(max)n.maxLength=max;if(type==='number'){n.min=key==='amount'?50:1;n.max=key==='amount'?3000:120;}container.append(n);n.addEventListener('input',()=>{m[key]=type==='number'?Number(n.value):n.value;dirty=true;});return n;};
 if(['scrollUp','scrollDown'].includes(m.action))input('Pixels per press','number','amount');
 if(['rewind','forward'].includes(m.action))input('Seconds per press','number','seconds');
 if(m.action==='click'){input('Unique CSS selector','text','selector',200);text(container,'p','Choose one button on this website, e.g. button[aria-label="Play"].');}
 if(m.action==='insertText'){input('Text to insert','textarea','text',1000);text(container,'p','Inserts into the focused plain text field. Password fields are excluded.');}
 if(m.action==='shortcut'){
  const n=input('Click here and press your shortcut','text','label',80);n.readOnly=true;const s=m.shortcut;n.value=s?[s.ctrl?'Ctrl':'',s.alt?'Alt':'',s.shift?'Shift':'',s.meta?'Meta':'',s.key].filter(Boolean).join(' + '):'';
  n.addEventListener('keydown',e=>{if(e.key==='Tab'||e.key==='Escape'||['Control','Alt','Shift','Meta'].includes(e.key))return;e.preventDefault();m.shortcut={key:e.key,code:e.code,ctrl:e.ctrlKey,alt:e.altKey,shift:e.shiftKey,meta:e.metaKey};n.value=[e.ctrlKey?'Ctrl':'',e.altKey?'Alt':'',e.shiftKey?'Shift':'',e.metaKey?'Meta':'',e.key].filter(Boolean).join(' + ');dirty=true;});text(container,'p','For website handlers only. Simulated keys may be ignored and cannot trigger native browser shortcuts.');
 }
}
function renderMappings(){
 $('mappings').replaceChildren();for(const c of controlsFor(state.config.pedalCount)){
  const card=document.createElement('article');card.className='mapping';card.dataset.control=c;
  const label=document.createElement('label');label.className='heading';label.htmlFor=`action-${c}`;text(label,'strong',`${title(c)} pedal`);text(label,'span','Ready');card.append(label);
  const select=document.createElement('select');select.id=`action-${c}`;select.setAttribute('aria-label',`${title(c)} pedal action`);for(const [value,name] of ACTIONS){const option=new Option(name,value);select.append(option);}select.value=draft[c].action;card.append(select);
  const options=document.createElement('div');options.className='extra';card.append(options);extra(options,c);
  select.addEventListener('change',()=>{draft[c].action=select.value;dirty=true;extra(options,c);});$('mappings').append(card);
 }
}
function update(next){
 state=next;$('browser-mode').setAttribute('aria-pressed',String(!next.native?.connected));$('browser-mode').disabled=!next.native?.connected;$('native-open').setAttribute('aria-pressed',String(Boolean(next.native?.connected)));$('native-mode-hint').hidden=!next.native?.connected;$('native-mode-hint').textContent=next.native?.enabled?'Computer-wide control active. Manage it in its setup tab.':next.native?.capturing?'Pedal originals suppressed; chosen actions paused. Manage capture in its setup tab.':'Windows helper connected. Browser reader disconnected.';$('mode-hint').hidden=!next.connected||!next.config.enabled;$('enabled').checked=next.native?.connected?false:next.config.enabled;$('enabled').disabled=Boolean(next.native?.connected);$('device-name').textContent=next.connected?(next.config.device?.name||'USB pedal'):'No pedal connected';$('connection-hint').textContent=next.connected?(next.profile||'Readable USB · learn inputs below'):'Connect opens a setup tab for USB access.';$('connect').textContent=next.connected?'Disconnect':'Connect';$('connect').disabled=!next.hidSupported||Boolean(next.native?.connected);
 $('status').textContent=next.native?.connected?next.native.message:next.message;$('count').value=String(next.config.pedalCount);$('calibrate').disabled=!next.connected;
 const key=JSON.stringify([next.config.mappings,next.config.sites,next.config.pedalCount,$('scope').value]);if(!dirty&&key!==renderedKey){draft=structuredClone(next.config.sites[$('scope').value]??next.config.mappings);renderMappings();renderedKey=key;}
 for(const node of document.querySelectorAll('.mapping')){const down=next.physical[node.dataset.control];node.classList.toggle('down',down);node.querySelector('.heading span').textContent=down?'Pressed':next.connected?'Released':'Not connected';}
 const w=next.wizard;$('wizard').hidden=!w;$('baseline').hidden=!w||w.phase!=='baseline';
 if(w){$('setup').open=true;$('wizard-title').textContent=w.phase==='done'?'All inputs learned.':w.phase==='baseline'?'Release all pedals, then capture neutral.':`${w.phase==='release'?'Release':'Press and hold'} the ${w.controls[w.step]} pedal · ${w.step+1}/${w.controls.length}`;$('wizard-error').textContent=w.error||'';}
 $('history').replaceChildren();for(const item of next.history){const row=document.createElement('div');row.className='history-row';text(row,'strong',`${title(item.control)} press`);const time=text(row,'time',new Date(item.time).toLocaleTimeString(undefined,{hour12:false})+'.'+String(item.time%1000).padStart(3,'0'));time.dateTime=new Date(item.time).toISOString();time.title=new Date(item.time).toLocaleString();$('history').append(row);}if(!next.history.length)text($('history'),'p','Your last 50 presses appear here.');
 $('remove-site').hidden=!next.config.sites[$('scope').value];
}
port.onMessage.addListener(update);
$('scope').addEventListener('change',()=>{dirty=false;renderedKey='';update(state);});
$('enabled').addEventListener('change',()=>request('enabled',{value:$('enabled').checked}).catch(error));
$('count').addEventListener('change',()=>{dirty=false;request('count',{count:Number($('count').value)}).catch(error);});
$('connect').addEventListener('click',async()=>{
 try{if(state?.connected){await request('disconnect');return;}
  await chrome.tabs.create({url:chrome.runtime.getURL('connect.html')});
 }catch(e){error(e);}
});
// Permission prompts must also run directly in a user gesture.
$('allow-site').addEventListener('click',async()=>{try{if(!origin)throw new Error('Open a normal http/https website first.');const granted=await chrome.permissions.request({origins:[`${origin}/*`]});$('access-hint').textContent=granted?`Allowed: ${origin}`:'Website access was not granted.';}catch(e){error(e);}});
$('allow-all').addEventListener('click',async()=>{try{const granted=await chrome.permissions.request({origins:['http://*/*','https://*/*']});$('access-hint').textContent=granted?'Allowed on normal HTTP/HTTPS websites. Protected pages are excluded.':'Website access was not granted.';}catch(e){error(e);}});
bind('remove-access',async()=>{const permissions=await chrome.permissions.getAll();if(permissions.origins?.length)await chrome.permissions.remove({origins:permissions.origins});$('access-hint').textContent='Persistent website access removed. Temporary access from opening this popup expires when you leave the site.';});
bind('save',async()=>{const previousDirty=dirty;dirty=false;try{await request('mappings',{mappings:draft,origin:$('scope').value||null});}catch(e){dirty=previousDirty;throw e;}});
bind('remove-site',async()=>{dirty=false;await request('removeSite',{origin:$('scope').value});});
bind('calibrate',()=>request('calibrate'));bind('baseline',()=>request('baseline'));bind('end-calibration',()=>request('endCalibration'));bind('clear-history',()=>request('clearHistory'));
bind('reset',async()=>{if(!confirm('Reset browser mappings and learned pedal inputs?'))return;dirty=false;await request('reset');});
bind('export',()=>{const blob=new Blob([JSON.stringify(state.config,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='treadory-extension-settings.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
bind('import',()=>$('import-file').click());$('import-file').addEventListener('change',async()=>{try{const file=$('import-file').files[0];if(!file)return;if(file.size>150000)throw new Error('Settings files must be smaller than 150 KB.');const next=validate(JSON.parse(await file.text()));dirty=false;await request('import',{config:next});}catch(e){error(e);}finally{$('import-file').value='';}});
(async()=>{try{await request('state');const [tab]=await chrome.tabs.query({active:true,currentWindow:true});origin=originOf(tab?.url);if(origin){$('scope').append(new Option(`This site · ${new URL(origin).hostname}`,origin));const allowed=await chrome.permissions.contains({origins:[`${origin}/*`]});$('access-hint').textContent=allowed?`Allowed: ${new URL(origin).hostname}`:'Allow this site for persistent control, or allow all websites.';}else{$('allow-site').disabled=true;$('access-hint').textContent='Open a normal website to configure site-specific mappings.';}}catch(e){error(e);}})();

$('copy-diagnostics').addEventListener('click',async()=>{
 try{
  const response=await chrome.runtime.sendMessage({type:'diagnostics'});
  if(!response?.ok||!response.diagnostics)throw new Error('Could not collect diagnostics. Reload the extension.');
  const output=JSON.stringify(response.diagnostics,null,2);$('diagnostics-output').value=output;$('diagnostics-output').hidden=false;
  try{await navigator.clipboard.writeText(output);$('diagnostics-hint').textContent='Copied. Paste this report into your support chat.';}
  catch{$('diagnostics-output').focus();$('diagnostics-output').select();$('diagnostics-hint').textContent='Select and copy the report below, then paste it into your support chat.';}
 }catch(e){error(e);}
});

bind('native-open',()=>chrome.tabs.create({url:chrome.runtime.getURL('native.html')}));

bind('browser-mode',async()=>{const response=await chrome.runtime.sendMessage({type:'native',command:'close'});if(!response?.ok)throw new Error(response?.error||'Unable to stop the Windows helper.');await request('state');});
