import {defaults,validate,mappings,identity,controlsFor,originOf} from './settings.js';
import {describe,sameDevice,selectDevice,findDeviceProfile} from './device.js';
import {rightClickGuard} from './right-click-guard.js';
import {pageAction} from './page-action.js';
import {idleState,deviceKey,decodeLearned,emptyCalibration,learnFingerprint,conflictFingerprint,fingerprintReleased,byteString} from '../../src/hid/core.ts';
let config=defaults(),device=null,profile=null,physical=idleState(),blocked=idleState(),reports={},wizard=null,history=[],sequence=0,revision=0,generation=0,armed=false,currentCalKey='';
let trace=[],lastStop='startup';
const mark=(row,status,details={})=>{Object.assign(row,{status,...details});};
const failureCode=error=>{const text=String(error?.message||'');return /not focused/.test(text)?'browser_not_focused':/Allow this website/.test(text)?'website_access_required':/top of/.test(text)?'scroll_at_top':/bottom of/.test(text)?'scroll_at_bottom':/scrollable/.test(text)?'no_scrollable_content':/did not move/.test(text)?'scroll_did_not_move':/feed changed/.test(text)?'feed_changed':/password/.test(text)?'password_field':/media/.test(text)?'no_accessible_media':/Cannot access|permission|Missing host/i.test(text)?'injection_permission_denied':'action_failed';};
let queue=Promise.resolve(),routing=Promise.resolve(),message='Connect your pedal, then allow the websites you want to control.',ports=new Set();
const ready=chrome.storage.local.get('config').then(saved=>{if(saved.config)try{config=validate(saved.config);}catch{message='Saved settings are invalid. Export or reset them before continuing.';config=defaults();config.enabled=false;}});
const trusted=sender=>sender.id===chrome.runtime.id && sender.url?.startsWith(chrome.runtime.getURL(''));
const calKey=()=>currentCalKey;
async function keyFor(d){const identity=describe(d);const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(identity.signature));return `${deviceKey(identity)}:${Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join('')}`;}
const snapshot=()=>({config,connected:Boolean(device),profile:profile?.label??null,physical,wizard,history,message,hidSupported:Boolean(navigator.hid)});
const publish=()=>{const state=snapshot();for(const port of ports)try{port.postMessage(state);}catch{};void chrome.action.setBadgeText({text:device?(config.enabled?'ON':'Ⅱ'):''}).catch(()=>{});};
const save=async()=>{await chrome.storage.local.set({config});};
const guardedTabs=new Set();
const clearGuards=()=>{for(const tabId of guardedTabs)void chrome.scripting.executeScript({target:{tabId,allFrames:true},func:rightClickGuard,args:[0]}).catch(()=>{});guardedTabs.clear();};
async function guardPress(at,token){
 try{const tab=await targetTab();if(token!==revision||!config.enabled||!config.rightClickGuard||!device||ports.size||wizard||Date.now()-at>=250)return;
 if(!await chrome.permissions.contains({origins:[`${originOf(tab.url)}/*`]}))return;
 if(token!==revision)return;guardedTabs.add(tab.id);
 await chrome.scripting.executeScript({target:{tabId:tab.id,allFrames:true},func:rightClickGuard,args:[at+250]});
 if(token!==revision)clearGuards();
 }catch{/* Protected or inaccessible frames cannot be guarded. */}
}
const stop=(reason='settings_changed')=>{clearGuards();lastStop=reason;revision++;for(const c of controlsFor(config.pedalCount))blocked[c] ||= physical[c];};
function detach(){
 generation++;stop();wizard=null;const old=device;device=null;profile=null;reports={};armed=false;currentCalKey='';physical=idleState();blocked=idleState();old?.removeEventListener('inputreport',onReport);
 if(old)queue=queue.then(async()=>{if(old.opened)await old.close().catch(()=>{});});publish();return queue;
}
async function connect(descriptor){
 await ready;const attempt=++generation;stop();const candidates=(await navigator.hid.getDevices()).filter(d=>sameDevice(d,descriptor));
 if(attempt!==generation)return;
 const chosen=selectDevice(candidates);detach();const token=generation;
 const operation=queue.then(async()=>{
  if(token!==generation)return;
  if(!chosen.opened)await chosen.open();
  if(token!==generation){if(chosen.opened)await chosen.close().catch(()=>{});return;}
  const learnedKey=await keyFor(chosen);if(token!==generation){await chosen.close().catch(()=>{});return;}
  currentCalKey=learnedKey;armed=false;device=chosen;profile=findDeviceProfile(describe(chosen),chosen.collections);physical=idleState();blocked=idleState();reports={};
  chosen.addEventListener('inputreport',onReport);config.device=describe(chosen);config.autoConnect=true;await save();if(token!==generation)return;
  message=profile?'Connected. Close this popup to use your pedal on an allowed website.':'Connected. Learn the pedal inputs in Device setup before using browser actions.';publish();
 });queue=operation.catch(()=>{});await operation;
}
async function targetTab(){const window=await chrome.windows.getLastFocused({windowTypes:['normal']});if(!window.focused)throw new Error('Browser is not focused.');const tabs=await chrome.tabs.query({active:true,windowId:window.id});const tab=tabs[0];if(!tab||!originOf(tab.url))throw new Error('Allow this website in Treadory. Browser settings, stores and protected pages are excluded.');return tab;}
async function run(control,token,at,row){
 const canceled=()=>{if(token!==revision||ports.size||!config.enabled||!device){mark(row,'canceled',{reason:ports.size?'setup_open':lastStop});return true;}return false;};
 if(canceled())return;
 if(performance.now()-at>1500){mark(row,'skipped',{reason:'queue_expired'});return;}
 let stage='choose_tab';
 try {
  mark(row,'running',{stage});const tab=await targetTab();if(canceled())return;
  stage='check_site_access';mark(row,'running',{stage});
  row.siteAccess=await chrome.permissions.contains({origins:[`${originOf(tab.url)}/*`]});
  if(!row.siteAccess)throw new Error('Allow this website from the extension first.');
  if(canceled())return;
  row.sitePreset=Boolean(config.sites[originOf(tab.url)]);
  const map=(config.sites[originOf(tab.url)]??config.mappings)[control];row.action=map.action;
  if(map.action==='none'){mark(row,'skipped',{reason:'no_action_selected'});return;}
  stage='execute_action';mark(row,'running',{stage});
  if(['nextTab','previousTab'].includes(map.action)){const tabs=(await chrome.tabs.query({windowId:tab.windowId})).sort((a,b)=>a.index-b.index);const i=tabs.findIndex(t=>t.id===tab.id);if(i>=0&&tabs.length)await chrome.tabs.update(tabs[(i+(map.action==='nextTab'?1:-1)+tabs.length)%tabs.length].id,{active:true});message='Tab changed.';}
  else if(map.action==='back'){await chrome.tabs.goBack(tab.id);message='Went back.';}
  else if(map.action==='forwardHistory'){await chrome.tabs.goForward(tab.id);message='Went forward.';}
  else if(map.action==='reload'){await chrome.tabs.reload(tab.id);message='Page reloaded.';}
  else {const result=await chrome.scripting.executeScript({target:{tabId:tab.id},func:pageAction,args:[map]});const outcome=result.find(r=>r.frameId===0)?.result;if(outcome?.details){const d=outcome.details;if(['page','container'].includes(d.kind)&&typeof d.dialog==='boolean'&&Number.isFinite(d.requested)&&Number.isFinite(d.moved))row.scroll={kind:d.kind,dialog:d.dialog,requested:d.requested,moved:d.moved};}if(!outcome?.ok)throw new Error(outcome?.message||'This page did not allow the action.');message=outcome.message;}
  mark(row,'completed',{elapsedMs:Math.round(performance.now()-at)});
 }catch(e){message=e.message||'Website access is needed. Allow the site from Treadory.';mark(row,'failed',{stage,reason:failureCode(e),errorType:['Error','NotAllowedError','SecurityError','TypeError','ReferenceError','RangeError','SyntaxError','AbortError'].includes(e.name)?e.name:'OtherError'});}
 publish();
}
async function diagnostics(){
 let activeTab={available:false};
 try{const window=await chrome.windows.getLastFocused({windowTypes:['normal']});const [tab]=await chrome.tabs.query({active:true,windowId:window.id});const origin=originOf(tab?.url);activeTab={available:Boolean(tab),browserFocused:Boolean(window.focused),normalWebsite:Boolean(origin),siteAccess:origin?await chrome.permissions.contains({origins:[`${origin}/*`]}):false,sitePreset:Boolean(origin&&config.sites[origin])};}catch{}
 return {format:1,version:chrome.runtime.getManifest().version,capturedAt:new Date().toISOString(),connected:Boolean(device),hidSupported:Boolean(navigator.hid),device:device?{vendorId:device.vendorId,productId:device.productId,knownProfile:Boolean(profile)}:null,enabled:config.enabled,armed,learning:Boolean(wizard),setupPagesOpen:ports.size,heldControls:controlsFor(config.pedalCount).filter(c=>physical[c]),releaseRequired:controlsFor(config.pedalCount).filter(c=>blocked[c]),lastStop,activeTab,defaultActions:Object.fromEntries(controlsFor(config.pedalCount).map(c=>[c,config.mappings[c].action])),presses:structuredClone(trace)};
}
function learn(raw){
 if(!wizard||wizard.phase==='done'||wizard.phase==='baseline')return;
 const control=wizard.controls[wizard.step];
 if(wizard.phase==='press'){
  const baseline=wizard.baseline[raw.reportId];if(!baseline||byteString(raw.bytes)===byteString(baseline))return;
  try{const fp=learnFingerprint(raw.reportId,baseline,raw.bytes);if(Object.values(wizard.working.hid).some(other=>conflictFingerprint(fp,other)))throw new Error('Inputs overlap. Press only the requested pedal.');wizard={...wizard,phase:'release',candidate:{fp,bytes:raw.bytes,at:performance.now()},error:''};}catch(e){wizard={...wizard,error:e.message};}
 }else{
  const candidate=wizard.candidate;if(raw.reportId!==candidate.fp.reportId)return;
  if(!fingerprintReleased(candidate.fp,raw.reportId,raw.bytes)){
   if(byteString(candidate.bytes)!==byteString(raw.bytes))wizard={...wizard,phase:'press',candidate:null,error:'The signal changed. Release all controls and try a steady press.'};
  }else if(performance.now()-candidate.at<80)wizard={...wizard,phase:'press',candidate:null,error:'Hold briefly (at least 80 ms), then release.'};
  else {const working={hid:{...wizard.working.hid,[control]:candidate.fp},dom:{}};const done=wizard.step===wizard.controls.length-1;wizard={...wizard,working,step:done?wizard.step:wizard.step+1,phase:done?'done':'press',candidate:null,error:''};if(done){const calibrations={...config.calibrations,[calKey()]:working};if(Object.keys(calibrations).length>40){wizard={...wizard,phase:'press',error:'A maximum of 40 learned devices can be saved. Export settings, then reset old devices.'};return;}try{config=validate({...config,calibrations});}catch(e){wizard={...wizard,phase:'press',error:e.message};publish();return;}stop();void save().catch(()=>{message='Inputs learned, but storage failed. Keep the popup open and export settings.';publish();});message='Inputs learned. They affect browser mappings, not hardware outputs.';}}
 }
 publish();
}
function onReport(event){
 if(event.device!==device)return;
 const bytes=Array.from(new Uint8Array(event.data.buffer,event.data.byteOffset,event.data.byteLength));if(bytes.length>512)return;
 const id=event.reportId;reports[id]=bytes;learn({reportId:id,bytes});
 const cal=config.calibrations[calKey()];
 // Explicit learning can override a known profile; status/timestamp-only generic
 // reports must be rejected by the user during calibration, not guessed here.
 let next;
 if(cal && Object.keys(cal.hid).length){if(Object.values(cal.hid).some(fp=>fp.reportId===id&&fp.length!==bytes.length))return;next=decodeLearned(cal,id,bytes,physical);}
 else if(profile){next=profile.decode(id,bytes);if(!next)return;}
 else return;
 if(!armed&&!Object.values(next).some(Boolean))armed=true;
 const down=controlsFor(config.pedalCount).filter(c=>next[c]&&!physical[c]);physical=next;
 for(const c of controlsFor(config.pedalCount))if(!next[c])blocked[c]=false;
 for(const control of down){
  const item={id:++sequence,control,time:Date.now()};history=[item,...history].slice(0,50);
  const row={...item,status:'queued'};trace=[row,...trace].slice(0,50);
  const reason=!armed?'waiting_for_neutral':blocked[control]?'release_required':wizard?'learning_inputs':!config.enabled?'actions_paused':ports.size?'setup_open':null;
  if(reason)mark(row,'skipped',{reason});else {if(config.rightClickGuard)void guardPress(item.time,revision);const token=revision,at=performance.now();routing=routing.then(()=>run(control,token,at,row)).catch(()=>mark(row,'failed',{reason:'routing_failed'}));}
 }
 publish();
}
async function handle(m){
 await ready;
 switch(m?.type){
  case 'state':return snapshot();
  case 'diagnostics':return diagnostics();
  case 'connect':if(!navigator.hid)throw new Error('WebHID is unavailable. Use Chrome 117+ or a compatible Edge/Brave desktop browser.');await connect(identity(m.device));break;
  case 'disconnect':config.autoConnect=false;await save();await detach();message='Pedal disconnected.';break;
  case 'enabled':if(typeof m.value!=='boolean')throw new Error('Invalid pause setting.');stop();config.enabled=m.value;await save();message=m.value?(device?'Ready. Close this popup and release held pedals before using them.':'Actions enabled. Connect your pedal to begin.'):'Pedal actions paused.';break;
  case 'rightClickGuard':if(typeof m.value!=='boolean')throw new Error('Invalid right-click guard setting.');stop();config.rightClickGuard=m.value;await save();message=m.value?'250 ms website right-click guard enabled. Ordinary mouse right-clicks in that window are also blocked.':'Website right-click guard disabled.';break;
  case 'mappings':{const next=mappings(m.mappings);stop();if(m.origin){if(originOf(m.origin)!==m.origin||m.origin.length>256)throw new Error('Invalid website.');if(!config.sites[m.origin]&&Object.keys(config.sites).length>=50)throw new Error('At most 50 website presets are supported.');config.sites[m.origin]=next;}else config.mappings=next;await save();message='Mappings saved on this device.';break;}
  case 'removeSite':if(originOf(m.origin)!==m.origin)throw new Error('Invalid website.');stop();delete config.sites[m.origin];await save();break;
  case 'count':if(!Number.isInteger(m.count)||m.count<1||m.count>4)throw new Error('Invalid pedal count.');stop();config.pedalCount=m.count;wizard=null;await save();break;
  case 'calibrate':if(!device)throw new Error('Connect a readable USB pedal first.');stop();wizard={phase:'baseline',step:0,controls:controlsFor(config.pedalCount),baseline:{},working:emptyCalibration(),candidate:null,error:''};break;
  case 'baseline':if(!wizard||wizard.phase!=='baseline')throw new Error('Start learning first.');if(!Object.keys(reports).length)throw new Error('Press and release once, then capture neutral with every pedal released.');wizard={...wizard,phase:'press',baseline:structuredClone(reports),error:''};break;
  case 'endCalibration':stop();wizard=null;break;
  case 'clearHistory':history=[];trace=[];break;
  case 'import':{const next=validate(m.config);next.device=config.device;next.autoConnect=config.autoConnect;stop();config=next;wizard=null;await save();message='Settings imported. USB permission is never imported.';break;}
  case 'reset':stop();config={...defaults(),device:config.device,autoConnect:config.autoConnect};wizard=null;await save();message='Default mappings restored.';break;
  default:throw new Error('Unknown request.');
 }
 publish();return snapshot();
}
chrome.runtime.onMessage.addListener((m,sender,reply)=>{if(!trusted(sender))return false;handle(m).then(state=>reply(m?.type==='diagnostics'?{ok:true,diagnostics:state}:{ok:true,state})).catch(e=>{message=e.message;publish();reply({ok:false,error:e.message});});return true;});
chrome.runtime.onConnect.addListener(port=>{if(port.name!=='treadory-ui'||!trusted(port.sender))return;stop('setup_opened');ports.add(port);void ready.then(()=>port.postMessage(snapshot()));port.onDisconnect.addListener(()=>{ports.delete(port);stop('setup_closed');if(!ports.size)wizard=null;});});
chrome.tabs.onRemoved.addListener(tabId=>guardedTabs.delete(tabId));
chrome.tabs.onActivated.addListener(()=>stop('active_tab_changed'));chrome.tabs.onUpdated.addListener((_id,change,tab)=>{if(tab?.active&&change.status==='loading')stop('page_navigation');});chrome.windows.onFocusChanged.addListener(()=>stop('window_focus_changed'));chrome.permissions.onRemoved.addListener(()=>stop('website_access_removed'));
if(navigator.hid){navigator.hid.addEventListener('disconnect',event=>{if(event.device===device){void detach();message='Pedal unplugged. Reconnect it to resume.';publish();}});navigator.hid.addEventListener('connect',()=>{void ready.then(async()=>{if(!device&&config.autoConnect&&config.device)try{await connect(config.device);}catch(e){message=e.message;publish();}});});}
void ready.then(async()=>{if(navigator.hid&&config.autoConnect&&config.device)try{await connect(config.device);}catch{message='Reconnect your pedal. No unique authorized readable device was found.';publish();}});
