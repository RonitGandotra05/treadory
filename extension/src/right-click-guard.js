// Serialized by chrome.scripting; all state belongs to this permitted frame.
export function rightClickGuard(deadline, scope = 'right') {
 const key = '__treadoryRightClickGuard';
 if (deadline === 0) { globalThis[key]?.dispose(); return; }
 const epochNow = () => performance.timeOrigin + performance.now();
 if (!Number.isFinite(deadline) || deadline <= epochNow() || deadline - epochNow() > 250 || !['all','right'].includes(scope)) return;
 // Keep sequence ownership across repeated physical presses, rather than reinstalling.
 if (globalThis[key]) { globalThis[key].arm(deadline, scope); return; }
 const sequences = new Map();
 let until = 0, lastDeadline = 0, mode = scope, keyboardMenuUntil = 0, timer;
 const types = ['keydown','pointerdown','pointerup','pointercancel','mousedown','mouseup','click','dblclick','auxclick','contextmenu'];
 const arm = (end, nextScope) => {
  if (end <= lastDeadline) return;
  lastDeadline = end; until = end - performance.timeOrigin; mode = nextScope;
  clearTimeout(timer); timer = setTimeout(dispose, Math.max(0,end-epochNow()) + 5000);
 };
 const listener = event => {
  if (event.type === 'keydown') {
   if (event.key === 'ContextMenu' || event.key === 'F10' && event.shiftKey) keyboardMenuUntil = performance.now() + 100;
   return; // Observe only these menu commands; never cancel or store keyboard input.
  }
  if (event.type === 'contextmenu' && (event.button !== 2 || performance.now() < keyboardMenuUntil)) return;
  // Programmatic actions and keyboard context-menu commands are not mouse clicks.
  if (!event.isTrusted || event.button < 0 || event.pointerType && event.pointerType !== 'mouse') return;
  const now = performance.now(), button = event.button;
  for (const [b,s] of sequences) if (now >= s.expires) sequences.delete(b);
  let sequence = sequences.get(button);
  const down = event.type === 'pointerdown' || event.type === 'mousedown';
  const up = event.type === 'pointerup' || event.type === 'mouseup';
  if (down && (!sequence || sequence.released)) {
   // When armed during an existing drag, a release without a recorded down stays allowed.
   sequence = { blocked: now < until && (mode === 'all' || button === 2), released:false, expires:now+5000 };
   sequences.set(button, sequence);
  }
  if (event.type === 'pointercancel') { sequences.delete(button); return; }
  const blocked = sequence?.blocked; // Unobserved downs cannot safely establish sequence ownership.
  if (up && sequence) sequence.released = true;
  if (blocked) { event.preventDefault(); event.stopImmediatePropagation(); }
 };
 const dispose = () => {
  clearTimeout(timer); sequences.clear();
  for (const type of types) window.removeEventListener(type,listener,true);
  window.removeEventListener('pagehide',dispose,true);
  if (globalThis[key]?.dispose === dispose) delete globalThis[key];
 };
 globalThis[key] = { dispose, arm };
 for (const type of types) window.addEventListener(type,listener,{capture:true,passive:false});
 window.addEventListener('pagehide',dispose,true); arm(deadline,scope);
}
