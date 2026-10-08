// Self-contained function: the extension injects a copy into the active permitted
// page. It reads only DOM state needed for the requested action, never passwords.
export async function pageAction(mapping){
 try {
  const active=document.activeElement;
  if(active?.matches('input[type="password"]'))return {ok:false,message:'Pedal actions are paused in password fields.'};
  // Measure content actually visible in its viewport and clipping ancestors.
  // Social feeds keep off-screen media and nested scroll regions in the DOM.
  const visibleArea=element=>{
   const doc=element.ownerDocument,view=doc.defaultView;let rect=element.getBoundingClientRect();
   let left=Math.max(0,rect.left),top=Math.max(0,rect.top),right=Math.min(view.innerWidth,rect.right),bottom=Math.min(view.innerHeight,rect.bottom);
   for(let node=element;node;node=node.parentElement){const style=view.getComputedStyle(node);if(style.display==='none'||style.visibility==='hidden'||style.visibility==='collapse')return 0;
    if(node!==element&&/(auto|scroll|hidden|clip)/.test(style.overflowX+' '+style.overflowY)){const clip=node.getBoundingClientRect();left=Math.max(left,clip.left);right=Math.min(right,clip.right);top=Math.max(top,clip.top);bottom=Math.min(bottom,clip.bottom);}}
   if(doc!==document){try{const frame=view.frameElement;if(frame&&!visibleArea(frame))return 0;}catch{return 0;}}
   return Math.max(0,right-left)*Math.max(0,bottom-top);
  };
  const dialogs=[...document.querySelectorAll('dialog[open],[role="dialog"],[aria-modal="true"]')].filter(visibleArea);
  const region=dialogs.at(-1)||document;
  const {action}=mapping;
  if(['scrollUp','scrollDown','pageUp','pageDown'].includes(action)){
   const root=document.scrollingElement;
   const scrollable=element=>{
    if(!element||element.scrollHeight<=element.clientHeight+2||!visibleArea(element))return false;
    if(element===root)return region===document&&!/hidden|clip/.test(getComputedStyle(element).overflowY)&&!/(hidden|clip)/.test(getComputedStyle(document.body).overflowY);
    return /auto|scroll|overlay/.test(getComputedStyle(element).overflowY);
   };
   let target=null;
   if(region===document||region.contains(active))for(let node=active;node;node=node.parentElement){if(scrollable(node)){target=node;break;}if(node===region)break;}
   if(!target&&scrollable(root))target=root;
   if(!target){
    const candidates=[...(region===document?[]:[region]),...region.querySelectorAll('*')].slice(0,5000).filter(scrollable);
    const score=node=>{const rect=node.getBoundingClientRect();const center=rect.left<innerWidth/2&&rect.right>innerWidth/2&&rect.top<innerHeight/2&&rect.bottom>innerHeight/2;return visibleArea(node)*(center?1.5:1)*(node.matches('main,[role="main"],[role="feed"]')||node.closest('main,[role="main"],[role="feed"]')?1.25:1);};
    target=candidates.sort((a,b)=>score(b)-score(a))[0];
   }
   if(!target)return {ok:false,message:'No visible scrollable content found. Open a feed or scrollable page first.'};
   const direction=action.endsWith('Up')?-1:1,max=target.scrollHeight-target.clientHeight;
   if(direction<0&&target.scrollTop<=1||direction>0&&target.scrollTop>=max-1)return {ok:false,message:direction<0?'Already at the top of this scroll area.':'Already at the bottom of this scroll area.'};
   let amount=action.startsWith('page')?Math.max(100,target.clientHeight*.85):mapping.amount;
   // A short pixel movement can snap back to the same reel/post. Advance far
   // enough to reach the next vertical snap position on these containers.
   if(/y|both/.test(getComputedStyle(target).scrollSnapType))amount=Math.max(amount,target.clientHeight*.85);
   target.scrollBy({top:amount*direction,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
   return {ok:true,message:'Scroll sent to the visible page or feed.'};
  }
  const docs=[document];const walk=(doc,depth)=>{if(depth>2)return;for(const frame of doc.querySelectorAll('iframe'))try{if(frame.contentDocument&&visibleArea(frame)){docs.push(frame.contentDocument);walk(frame.contentDocument,depth+1);}}catch{}};walk(document,0);
  const mediaList=docs.flatMap(doc=>[...doc.querySelectorAll('video,audio')]).filter(m=>m.isConnected);
  const visibleVideos=mediaList.filter(m=>m.tagName==='VIDEO'&&visibleArea(m)>0).sort((a,b)=>visibleArea(b)-visibleArea(a));
  const media=visibleVideos[0]||mediaList.filter(m=>m.tagName==='AUDIO').sort((a,b)=>Number(!b.paused)-Number(!a.paused))[0];
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
