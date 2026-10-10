// Serialized by chrome.scripting: keep this function self-contained.
export function rightClickGuard(deadline) {
 const key='__treadoryRightClickGuard';
 const old=globalThis[key];
 if(old)old.dispose();
 const remaining=deadline-Date.now();
 if(!Number.isFinite(deadline)||remaining<=0||remaining>250)return;
 const until=performance.now()+remaining;
 let timer;
 const types=['pointerdown','pointerup','mousedown','mouseup','auxclick','contextmenu'];
 const listener=event=>{
  if(performance.now()>=until){dispose();return;}
  // Context-menu keyboard commands and extension-generated actions stay usable.
  if(!event.isTrusted||event.button!==2)return;
  event.preventDefault();event.stopImmediatePropagation();
 };
 const dispose=()=>{
  clearTimeout(timer);
  for(const type of types)window.removeEventListener(type,listener,true);
  window.removeEventListener('pagehide',dispose,true);
  if(globalThis[key]?.dispose===dispose)delete globalThis[key];
 };
 globalThis[key]={dispose};
 for(const type of types)window.addEventListener(type,listener,{capture:true,passive:false});
 window.addEventListener('pagehide',dispose,true);
 timer=setTimeout(dispose,remaining);
}
