import {useEffect,useState} from 'react';
export function ComputerWide(){
 const [binary,setBinary]=useState(false);
 useEffect(()=>{
  const showLinkedPanel=()=>{if(window.location.hash==='#computer-wide'){const panel=document.getElementById('computer-wide') as HTMLDetailsElement|null;if(panel)panel.open=true;}};
  showLinkedPanel();window.addEventListener('hashchange',showLinkedPanel);return()=>window.removeEventListener('hashchange',showLinkedPanel);
 },[]);
 useEffect(()=>{
  const controller=new AbortController();
  void fetch('/downloads/helper-release.json',{signal:controller.signal}).then(r=>r.ok?r.json():null).then(r=>{
   if(r?.format===1&&r.platform==='windows-x64'&&r.preview===true&&r.available===true&&r.download==='/downloads/treadory-windows-helper-preview.zip')setBinary(true);
  }).catch(()=>{});return()=>controller.abort();
 },[]);
 return <details className="computer-wide" id="computer-wide"><summary><span><strong>Computer-wide pedal control</strong><small>Windows native helper · developer preview</small></span><span aria-hidden="true">+</span></summary><div className="details-content">
  <p>Use the optional Windows helper when you need pedal actions in normal desktop apps, or need to replace a supported pedal’s original mouse outputs. For actions only on website tabs, use the browser extension above.</p>
  <p>For unwanted clicks, first quit other pedal or remapping utilities and test in another app. If quitting a utility removes the click, correct its mapping there.</p>
  <p>The Windows helper can replace original outputs from one uniquely identified VEC mouse endpoint with your chosen actions across normal desktop apps. Your ordinary mouse keeps working. If the pedal has no matching endpoint, this backend cannot suppress its click.</p>
  <p className="small muted">Windows x64 preview · physical Windows verification pending. Requires .NET 10 Runtime. Read-only endpoint inspection needs no driver or administrator access. Replacement additionally needs a separately installed, appropriately licensed Interception driver; its installation needs administrator access. Mac and Linux backends are not available yet.</p>
  <div className="repair-actions">{binary&&<a className="secondary" href="/downloads/treadory-windows-helper-preview.zip" download>Download Windows helper preview ↗</a>}<a className="text-button" href="/downloads/treadory-windows-helper-source.zip" download>Download helper source &amp; setup ↗</a></div>
  <ol><li>Install Treadory from the Chrome Web Store above. Your extension must show the <strong>Computer-wide</strong> control; if it is missing, a companion-enabled extension update is needed before this helper can connect.</li><li>Review the included setup, driver licensing and recovery instructions. Install the helper for your extension ID, then choose <strong>Computer-wide</strong> in the extension.</li><li>Inspect the endpoint, start an isolated test and learn each physical pedal. Verify unwanted outputs are absent in other apps and your ordinary mouse still works, then activate your actions.</li></ol>
  <p className="small muted">Learning assigns each physical pedal to its software action. It does not reset or reprogram the pedal’s firmware. Choose Browser websites in the extension to stop the helper and restore original pedal input, then reconnect USB for browser actions.</p>
  <p className="small muted">Stop capture to restore original pedal input. Ctrl + Alt + Shift + F12 is the recovery chord. Browser/helper exit or connection loss stops capture. This changes behavior on the current computer while the helper runs; it does not program the pedal.</p>
 </div></details>;
}
