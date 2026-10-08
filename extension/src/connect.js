import {describe,selectDevice} from './device.js';
const choose=document.getElementById('choose'),status=document.getElementById('status'),done=document.getElementById('done');
// A persistent extension tab keeps the chooser attached to a normal browser
// window. Keep the explicit user gesture here; never request USB from a worker.
const port=chrome.runtime.connect({name:'treadory-ui'});
port.onMessage.addListener(()=>{});
if(!navigator.hid){choose.disabled=true;status.textContent='WebHID is unavailable. Use Chrome 117+ or a compatible desktop browser.';}
choose.addEventListener('click',async()=>{
 if(choose.disabled)return;
 choose.disabled=true;done.hidden=true;
 try{
  const selected=await navigator.hid.requestDevice({filters:[]});
  if(!selected.length){status.textContent='No device chosen. The picker was closed or access was unavailable. Try again, or open the help below if your pedal is missing.';return;}
  status.textContent='Opening your pedal…';
  const response=await chrome.runtime.sendMessage({type:'connect',device:describe(selectDevice(selected))});
  if(!response?.ok)throw new Error(response?.error||'The extension could not open your pedal. Reload Treadory and try again.');
  if(!response.state?.connected)throw new Error('The connection was interrupted. Choose your pedal again.');
  status.textContent=`Connected to ${response.state.config.device.name}. Return to your website, open Treadory and allow the site to use your mappings.`;
  done.hidden=false;choose.textContent='Choose another pedal';
 }catch(e){status.textContent=e?.message||'Could not connect. Close other pedal connections and try again.';}
 finally{choose.disabled=!navigator.hid;}
});
done.addEventListener('click',async()=>{try{const tab=await chrome.tabs.getCurrent();if(tab?.id)await chrome.tabs.remove(tab.id);else status.textContent='Connected. You can close this tab and return to your website.';}catch{status.textContent='Connected. Close this tab and return to your website.';}});
