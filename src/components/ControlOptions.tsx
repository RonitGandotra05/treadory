import {useEffect,useState,type KeyboardEvent} from 'react';

export type ControlScope='web'|'computer';
const STORE_URL='https://chromewebstore.google.com/detail/treadory-%E2%80%94-foot-pedal-con/kkgfhpnkicjkkiignanfgceldfhlicfl';
function ScopeIcon({computer=false}:{computer?:boolean}){
 return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">{computer?<><rect x="3" y="4" width="18" height="13" rx="2"/><path d="M12 17v4M8 21h8"/></>:<><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M7 6.5h.01M10 6.5h.01M9 13l-2 2 2 2M15 13l2 2-2 2"/></>}</svg>;
}
export function ControlOptions({scope,onScopeChange}:{scope:ControlScope;onScopeChange:(scope:ControlScope)=>void}){
 const [binary,setBinary]=useState(false);
 useEffect(()=>{
  let frame=0;
  const followLink=()=>{
   if(!['#computer-wide','#browser-extension'].includes(window.location.hash))return;
   onScopeChange(window.location.hash==='#computer-wide'?'computer':'web');
   window.cancelAnimationFrame(frame);frame=window.requestAnimationFrame(()=>document.getElementById('control-options')?.scrollIntoView({block:'center'}));
  };
  followLink();window.addEventListener('hashchange',followLink);return()=>{window.removeEventListener('hashchange',followLink);window.cancelAnimationFrame(frame);};
 },[onScopeChange]);
 useEffect(()=>{
  const controller=new AbortController();
  void fetch('/downloads/helper-release.json',{signal:controller.signal}).then(r=>r.ok?r.json():null).then(r=>{
   if(r?.format===1&&r.platform==='windows-x64'&&r.preview===true&&r.available===true&&r.download==='/downloads/treadory-windows-helper-preview.zip')setBinary(true);
  }).catch(()=>{});return()=>controller.abort();
 },[]);
 const select=(next:ControlScope)=>{onScopeChange(next);window.history.replaceState(null,'',next==='web'?'#browser-extension':'#computer-wide');};
 const navigate=(event:KeyboardEvent<HTMLButtonElement>)=>{
  if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
  event.preventDefault();const next=event.key==='Home'?'web':event.key==='End'?'computer':scope==='web'?'computer':'web';
  select(next);document.getElementById(`scope-${next}`)?.focus();
 };
 return <section className="control-options" id="control-options" aria-label="Website and system pedal control">
  <p className="control-options-label">Where should your pedal work?</p>
  <div className="scope-switch" role="tablist" aria-label="Pedal control scope">
   <button id="scope-web" role="tab" aria-selected={scope==='web'} aria-controls="browser-extension" tabIndex={scope==='web'?0:-1} onClick={()=>select('web')} onKeyDown={navigate}><ScopeIcon/><span><strong>Website-wide</strong><small>Chrome extension</small></span><i aria-hidden="true"/></button>
   <button id="scope-computer" role="tab" aria-selected={scope==='computer'} aria-controls="computer-wide" tabIndex={scope==='computer'?0:-1} onClick={()=>select('computer')} onKeyDown={navigate}><ScopeIcon computer/><span><strong>System-wide</strong><small>Windows helper · preview</small></span><i aria-hidden="true"/></button>
  </div>
  <div className="scope-panel" id="browser-extension" role="tabpanel" aria-labelledby="scope-web" hidden={scope!=='web'}>
   <div className="scope-overview"><div><p className="eyebrow">CHROME EXTENSION</p><h2>Your pedal. Across the web.</h2><p>Scroll, control media and run website actions on the tabs you allow. No Windows helper is needed for browser mode.</p><ul className="scope-features"><li>Allowed website tabs</li><li>Scroll &amp; media</li><li>No helper needed</li></ul></div><div className="scope-downloads"><a className="scope-download" href={STORE_URL} target="_blank" rel="noopener noreferrer">Get it on Chrome Web Store <span aria-hidden="true">↗</span></a><span className="scope-download-note">Install in Chrome, then choose your actions.</span></div></div>
   <details className="scope-guide"><summary>Connect &amp; use <span aria-hidden="true">+</span></summary><div><ol><li>Open the Chrome Web Store listing and choose <strong>Add to Chrome</strong>.</li><li>Disconnect the pedal from this page. In the extension, choose <strong>Browser websites</strong>, then Connect and choose your readable USB pedal.</li><li>Allow the websites you want to control, choose each pedal’s action and save.</li><li>Close the popup and release your pedals. Mappings follow the active website while the browser is focused.</li></ol><p><strong>Learn pedal inputs</strong> assigns physical controls in software; it does not rewrite their stored outputs. Browser mode does not suppress an extra operating-system click or control desktop apps.</p><p>Chrome 117+ with readable USB pedal input. Protected browser pages and some embedded players are excluded. Firefox and Safari lack the required WebHID support.</p></div></details>
  </div>
  <div className="scope-panel" id="computer-wide" role="tabpanel" aria-labelledby="scope-computer" hidden={scope!=='computer'}>
   <div className="scope-overview"><div><p className="eyebrow">WINDOWS HELPER · DEVELOPER PREVIEW</p><h2>Your pedal. Across your computer.</h2><p>Use chosen pedal actions in normal desktop apps. Replace original mouse outputs from one supported, individually identified VEC pedal endpoint.</p><ul className="scope-features"><li>Normal desktop apps</li><li>Selected pedal only</li><li>Windows x64</li></ul></div><div className="scope-downloads">{binary?<a className="scope-download" href="/downloads/treadory-windows-helper-preview.zip" download>Download Windows helper ZIP <span aria-hidden="true">↗</span></a>:<span className="scope-download-note">Preview binary unavailable. Source and setup are below.</span>}<span className="scope-download-note">Downloads a ZIP containing treadory-helper.exe, setup scripts and a README. Extract it first; this preview uses PowerShell setup.</span><a className="scope-source" href="/downloads/treadory-windows-helper-source.zip" download>Download helper source &amp; setup <span aria-hidden="true">↗</span></a></div></div>
   <p className="scope-preview"><span className="scope-status-dot" aria-hidden="true"/>Physical Windows verification pending. Requires .NET 10 Runtime. Replacement also requires a separately installed, licensed Interception driver.</p>
   <details className="scope-guide"><summary>Setup, compatibility &amp; recovery <span aria-hidden="true">+</span></summary><div><p>For unwanted clicks, first quit other pedal or remapping utilities and test in another app. If quitting a utility removes the click, correct its mapping there.</p><ol><li>Install the Chrome extension using <a href={STORE_URL} target="_blank" rel="noopener noreferrer">the Store listing</a>. It must show <strong>Computer-wide</strong>; if that control is missing, a companion-enabled extension update is needed.</li><li>Download the Windows helper ZIP and choose <strong>Extract All</strong> in Windows. Keep the extracted files together, including the <code>host/treadory-helper.exe</code> file. This is a developer preview, not a double-click installer.</li><li>Install Microsoft’s <a href="https://dotnet.microsoft.com/en-us/download/dotnet/10.0" target="_blank" rel="noopener noreferrer">.NET 10 x64 Runtime</a> (the console runtime). Open PowerShell in the extracted folder and run <code>.\install.ps1 -ExtensionId kkgfhpnkicjkkiignanfgceldfhlicfl</code> for the Chrome Store extension. This registers the helper for read-only inspection; the extension starts its EXE when you connect.</li><li>To replace original pedal outputs, separately obtain and appropriately license the <a href="https://github.com/oblitum/Interception" target="_blank" rel="noopener noreferrer">Interception driver</a>. Follow its official administrator installation and reboot instructions. Then follow the extracted <strong>README.md</strong> to remove the inspection-only registration and reinstall the helper with your verified x64 DLL. The README includes the exact command and removal steps; the driver and DLL are not in this ZIP.</li><li>Choose <strong>Computer-wide</strong> in the extension and connect the helper. Inspect the endpoint, start an isolated test and learn each physical pedal. Verify unwanted outputs are absent in other apps and your ordinary mouse still works before activating actions.</li></ol><p>Read-only inspection needs no driver or administrator access. Driver installation for replacement needs administrator access and verified compatibility. No matching pedal mouse endpoint means this backend cannot suppress the click. Mac and Linux backends are not available yet.</p><p>Learning assigns software actions; it does not reset or program firmware. <strong>Stop capture</strong> or choose Browser websites in the extension to restore original input. Pausing chosen actions keeps original pedal outputs suppressed.</p><p><strong>Ctrl + Alt + Shift + F12</strong> is the recovery chord. Browser/helper exit or connection loss stops capture. Reconnect USB before returning to browser actions. Elevated apps and secure desktops are excluded.</p></div></details>
  </div>
 </section>;
}
