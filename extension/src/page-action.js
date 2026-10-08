// Self-contained function: the extension injects a copy into the active permitted
// page. It reads only DOM state needed for the requested action, never passwords.
export async function pageAction(mapping){
 try {
  const active=document.activeElement;
  if(active?.matches('input[type="password"]'))return {ok:false,message:'Pedal actions are paused in password fields.'};
  const docs=[document];const walk=(doc,depth)=>{if(depth>2)return;for(const frame of doc.querySelectorAll('iframe'))try{if(frame.contentDocument){docs.push(frame.contentDocument);walk(frame.contentDocument,depth+1);}}catch{}};walk(document,0);
  const media=docs.flatMap(doc=>[...doc.querySelectorAll('video,audio')]).filter(m=>m.isConnected).sort((a,b)=>Number(!b.paused)-Number(!a.paused)||Number(b.tagName==='VIDEO'&&b.getBoundingClientRect().width>0)-Number(a.tagName==='VIDEO'&&a.getBoundingClientRect().width>0))[0];
  const {action}=mapping;
  if(['scrollUp','scrollDown','pageUp','pageDown'].includes(action)){
   let target=active;while(target && target!==document.body && target!==document.documentElement){const style=getComputedStyle(target);if(/auto|scroll/.test(style.overflowY)&&target.scrollHeight>target.clientHeight+2)break;target=target.parentElement;}
   if(!target||target===document.body||target===document.documentElement)target=document.scrollingElement;
   if(!target)return {ok:false,message:'This page has no scrollable content.'};
   const amount=action.startsWith('page')?Math.max(100,target.clientHeight*.85):mapping.amount;
   target.scrollBy({top:amount*(action.endsWith('Up')?-1:1),behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
   return {ok:true,message:'Page scrolled.'};
  }
  if(['play','rewind','forward','mute'].includes(action)){
   if(!media)return {ok:false,message:'No accessible media found. Embedded players may need a site-specific button action.'};
   if(action==='play'){if(media.paused)await media.play();else media.pause();}
   if(action==='mute')media.muted=!media.muted;
   if(action==='rewind'||action==='forward'){const next=Math.max(0,media.currentTime+(action==='rewind'?-1:1)*mapping.seconds);media.currentTime=Number.isFinite(media.duration)?Math.min(media.duration,next):next;}
   return {ok:true,message:'Media updated.'};
  }
  if(action==='click'){
   let elements;try{elements=document.querySelectorAll(mapping.selector);}catch{return {ok:false,message:'The element selector is invalid.'};}
   if(elements.length!==1)return {ok:false,message:elements.length?'The selector matches multiple elements. Use a more specific selector.':'That element was not found on this page.'};
   const target=elements[0];if(typeof target.click!=='function'||target.matches(':disabled,input[type="password"]')||!target.getClientRects().length)return {ok:false,message:'That element cannot be clicked.'};
   target.click();return {ok:true,message:'Element clicked.'};
  }
  if(action==='shortcut'){
   const s=mapping.shortcut;const target=active||document.body;
   if(target.matches('input,textarea,[contenteditable]'))return {ok:false,message:'Website shortcuts are paused in text fields.'};
   const init={key:s.key,code:s.code,ctrlKey:s.ctrl,shiftKey:s.shift,altKey:s.alt,metaKey:s.meta,bubbles:true,cancelable:true,composed:true};
   target.dispatchEvent(new KeyboardEvent('keydown',init));target.dispatchEvent(new KeyboardEvent('keyup',init));
   return {ok:true,message:'Website shortcut sent. Sites may ignore simulated keys; browser shortcuts are not supported.'};
  }
  if(action==='insertText'){
   if(!active?.matches('textarea,input[type="text"],input[type="search"],input[type="url"],input:not([type])')||active.disabled||active.readOnly)return {ok:false,message:'Focus a plain text field first. Passwords and rich-text editors are excluded.'};
   active.setRangeText(mapping.text,active.selectionStart??active.value.length,active.selectionEnd??active.value.length,'end');
   active.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertText',data:mapping.text}));return {ok:true,message:'Text inserted.'};
  }
  return {ok:false,message:'Action unavailable.'};
 }catch(error){return {ok:false,message:error?.name==='NotAllowedError'?'Click play once on this page to allow playback.':'This page did not allow that action.'};}
}
