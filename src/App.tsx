import { useEffect, useRef, useState } from 'react';
import { MouseObservation, mouseSignal } from './hid/mouseObservation';
import { DeviceRepair } from './components/DeviceRepair';
import { ControlOptions, type ControlScope } from './components/ControlOptions';
import { PedalVisual } from './components/PedalVisual';
import { actions, byteString, conflictFingerprint, controlsFor, decodeLearned, defaultConfiguration, deviceKey, emptyCalibration, fingerprintReleased, hex, idleState, learnFingerprint, mappingLabel, sameState, shortcutFrom, stateMask, validateConfiguration, type Calibration, type Configuration, type Control, type Fingerprint, type InputSource, type Mapping, type PedalState, type RawInput } from './hid/core';
import { brands, models, type DeviceProfile } from './hid/deviceProfiles';
import { identityOf, useFootPedal } from './hid/useFootPedal';

const STORAGE_KEY = 'pedalspectra.configuration.v1';
const nameOf = (c:Control) => c === 'auxiliary' ? 'Auxiliary' : c[0].toUpperCase()+c.slice(1);
const sourceLabel:Record<InputSource,string> = {webhid:'WebHID',keyboard:'Keyboard',mouse:'Mouse',simulation:'Simulation'};
const formatTime = (ms:number) => new Date(ms).toLocaleTimeString('en-GB',{hour12:false})+'.'+String(ms%1000).padStart(3,'0');
function load() {
  if (typeof window === 'undefined') return {config:defaultConfiguration(),notice:''};
  try { const raw = localStorage.getItem(STORAGE_KEY); return { config:raw ? validateConfiguration(JSON.parse(raw)) : defaultConfiguration(),notice:'' }; }
  catch { return {config:defaultConfiguration(),notice:'Saved settings could not be read. You can still test your pedal and export a configuration.'}; }
}
interface HistoryItem { id:number; time:number; text:string; detail:string; source:InputSource; mouseSignal?:string }
interface Result { control:Control; received:string; signature:string; actual?:string; system?:string }
interface Candidate { raw:RawInput; signature:string; fp?:Fingerprint; stableAt:number; actual?:string }
interface Wizard { kind:'hid'|'diagnose'; phase:'baseline'|'press'|'release'|'done'; step:number; controls:Control[]; baseline:Record<number,number[]>; working:Calibration; results:Result[]; candidate?:Candidate; error:string }
interface Playback { playing:boolean; position:number; muted:boolean; talking:boolean; track:number }

export default function App() {
  const [initial] = useState(load);
  const [config,setConfig] = useState<Configuration>(initial.config);
  const configRef = useRef(config); configRef.current = config;
  const [toolsOpen,setToolsOpen] = useState(false);
  const [controlScope,setControlScope] = useState<ControlScope>('web');
  const [toolsTab,setToolsTab] = useState<'test'|'repair'>('test');
  const toolsDialog = useRef<HTMLDialogElement>(null);
  const toolsTrigger = useRef<HTMLButtonElement>(null);
  useEffect(()=>{const dialog=toolsDialog.current;if(toolsOpen && !dialog?.open)dialog?.showModal();else if(!toolsOpen && dialog?.open)dialog.close();},[toolsOpen]);
  const [repairBusy,setRepairBusy] = useState(false);
  const [repairActive,setRepairActive] = useState(false);
  const repairBusyRef = useRef(false);
  const repairSessions = useRef(new Set<string>());
  const [mode,setModeState] = useState<'hardware'|'simulation'>('hardware');
  const modeRef = useRef(mode);modeRef.current = mode;
  const [state,setState] = useState<PedalState>(idleState);
  const stateRef = useRef(state);stateRef.current = state;
  const states = useRef<Record<InputSource,PedalState>>({webhid:idleState(),keyboard:idleState(),mouse:idleState(),simulation:idleState()});
  const [lastRaw,setLastRaw] = useState<RawInput|null>(null);
  const lastRawRef = useRef<RawInput|null>(null);
  const [hardwareRaw,setHardwareRaw] = useState<RawInput|null>(null);
  const [lastControl,setLastControl] = useState<{control:Control;down:boolean}|null>(null);
  const [history,setHistory] = useState<HistoryItem[]>([]);
  const [timeZone,setTimeZone] = useState('local time');
  useEffect(()=>setTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone),[]);
  const sequence = useRef(0);
  // Physical history is independent of the action state, which is reset on blur.
  const historyStates = useRef({webhid:idleState(),simulation:idleState()});
  const mouseObservation = useRef(new MouseObservation());
  const observeMouseRef = useRef<(label:string)=>void>(()=>{});
  const reports = useRef<Record<number,number[]>>({});
  const [storageStatus,setStorageStatus] = useState('Saved on this device');
  const [notice,setNotice] = useState(initial.notice);
  const [wizard,setWizardState] = useState<Wizard|null>(null);
  const wizardRef = useRef(wizard);wizardRef.current = wizard;
  const [recording,setRecording] = useState<Control|null>(null);
  const [testEnabled,setTestEnabled] = useState(true);
  const testRef = useRef(testEnabled);testRef.current = testEnabled;
  const [playback,setPlayback] = useState<Playback>({playing:false,position:30,muted:false,talking:false,track:1});
  const [execution,setExecution] = useState('Press a pedal to preview its action.');
  const fileInput = useRef<HTMLInputElement>(null);
  const activeActions = useRef(new Map<Control,{mapping:Mapping;source:InputSource}>());
  const background = useRef(false);
  const physicalHid = useRef<PedalState>(idleState());
  const awaitingRelease = useRef<PedalState>(idleState());
  const hardwareRef = useRef<{identity:ReturnType<typeof identityOf>|null;profile:DeviceProfile|undefined}>({identity:null,profile:undefined});
  const selectedModel = models.find(m => m.id === config.modelId) ?? models[models.length-1];
  const controls = controlsFor(config.pedalCount);
  const setWizard = (next:Wizard|null) => { wizardRef.current = next;setWizardState(next); };
  const calibrationKey = (source:'hid'|'dom') => source === 'hid' && hardwareRef.current.identity ? deviceKey(hardwareRef.current.identity) : `standard:${configRef.current.modelId}:${configRef.current.pedalCount}`;
  const getCalibration = (source:'hid'|'dom') => configRef.current.calibrations[calibrationKey(source)] ?? emptyCalibration();

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY,JSON.stringify(config));setStorageStatus('Saved on this device'); }
    catch { setStorageStatus('Storage unavailable · export to save'); }
  },[config]);
  useEffect(() => {
    if (!playback.playing || !testEnabled) return;
    const interval = window.setInterval(() => setPlayback(p => ({...p,position:Math.min(120,p.position+0.25),playing:p.position+0.25 < 120})),250);
    return () => window.clearInterval(interval);
  },[playback.playing,testEnabled]);

  const releaseAction = (control:Control) => {
    const active=activeActions.current.get(control);
    if (!active) return;
    activeActions.current.delete(control);
    window.dispatchEvent(new CustomEvent('pedalspectra:action',{detail:{control,phase:'up',mapping:structuredClone(active.mapping),source:active.source,timestamp:Date.now()}}));
    if (active.mapping.action==='talk') setPlayback(p=>({...p,talking:[...activeActions.current.values()].some(a=>a.mapping.action==='talk')}));
  };
  const releaseActions = () => {for (const control of [...activeActions.current.keys()]) releaseAction(control);};
  const execute = (control:Control,down:boolean,source:InputSource) => {
    if (!down) {releaseAction(control);return;}
    if (repairBusyRef.current || background.current || !testRef.current || wizardRef.current && wizardRef.current.phase !== 'done') return;
    if (source==='webhid' && awaitingRelease.current[control]) return;
    if (activeActions.current.has(control)) return;
    const mapping = structuredClone(configRef.current.mappings[control]);
    activeActions.current.set(control,{mapping,source});
    window.dispatchEvent(new CustomEvent('pedalspectra:action',{detail:{control,phase:'down',mapping:structuredClone(mapping),source,timestamp:Date.now()}}));
    setExecution(`${nameOf(control)} → ${mappingLabel(mapping)}`);
    setPlayback(p => {
      switch(mapping.action) {
        case 'play': return {...p,playing:!p.playing,position:p.position >= 120 ? 0 : p.position};
        case 'rewind': return {...p,position:Math.max(0,p.position-mapping.seconds)};
        case 'forward': return {...p,position:Math.min(120,p.position+mapping.seconds)};
        case 'previous': return {...p,track:Math.max(1,p.track-1),position:0};
        case 'next': return {...p,track:p.track+1,position:0};
        case 'mute': return {...p,muted:!p.muted};
        case 'talk': return {...p,talking:true};
        default:return p;
      }
    });
    if (mapping.action === 'scrollUp') window.scrollBy({top:-160,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
    if (mapping.action === 'scrollDown') window.scrollBy({top:160,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
  };
  const releaseAll = () => {
    for (const control of controlsFor(configRef.current.pedalCount)) awaitingRelease.current[control] ||= physicalHid.current[control];
    releaseActions();
    setLastControl(previous=>previous?{...previous,down:false}:null);
    states.current = {webhid:idleState(),keyboard:idleState(),mouse:idleState(),simulation:idleState()};
    const empty = idleState();stateRef.current = empty;setState(empty);
    setPlayback(p => ({...p,talking:false}));
  };
  const resetMode = (next:typeof mode) => { historyStates.current.simulation=idleState();mouseObservation.current.reset();releaseAll();setWizard(null);setRecording(null);modeRef.current = next;setModeState(next);setLastControl(null); };

  const acceptWizard = (raw:RawInput,normalized:PedalState) => {
    const w=wizardRef.current;
    if(!w || w.phase==='done' || w.phase==='baseline' || raw.source!==(modeRef.current==='simulation'?'simulation':'webhid'))return;
    const control=w.controls[w.step];
    if(w.phase==='press') {
      if(!raw.bytes?.length || (w.kind==='hid' && byteString(raw.bytes)===byteString(w.baseline[raw.reportId??0]??[])))return;
      try {
        let fp:Fingerprint;let actual:string|undefined;
        if(w.kind==='hid') {
          const baseline=w.baseline[raw.reportId??0];if(!baseline)throw new Error('Capture neutral again after releasing all pedals.');
          fp=learnFingerprint(raw.reportId??0,baseline,raw.bytes);
          if(Object.values(w.working.hid).some(other=>conflictFingerprint(fp,other)))throw new Error('This signal overlaps an earlier pedal. Release all controls and press only the requested pedal.');
        } else {
          const pressed=w.controls.filter(c=>normalized[c]);if(!pressed.length)return;
          if(pressed.length!==1)throw new Error('Press just one physical pedal for this step.');
          actual=nameOf(pressed[0]);fp=learnFingerprint(raw.reportId??0,[0],[stateMask(normalized)]);
        }
        const signature=`hid:${raw.reportId??0}:${fp.changes.map(c=>`${c.index}/${c.mask}/${c.pressed}`).join(',')}`;
        setWizard({...w,phase:'release',candidate:{raw,signature,fp,stableAt:Date.now()+80,actual},error:''});
      }catch(e){setWizard({...w,error:e instanceof Error?e.message:'This signal could not be learned.'});}
      return;
    }
    const candidate=w.candidate;if(!candidate?.fp || candidate.raw.source!==raw.source)return;
    let released=false;
    if(w.kind==='diagnose') {
      released=stateMask(normalized)===0;
      if(!released && stateMask(normalized)!==candidate.fp.changes[0].pressed){setWizard({...w,phase:'press',candidate:undefined,error:'Release all controls and press only the requested pedal.'});return;}
    } else {
      released=fingerprintReleased(candidate.fp,raw.reportId??0,raw.bytes??[]);
      if(!released && raw.reportId===candidate.fp.reportId && byteString(raw.bytes??[])!==byteString(candidate.raw.bytes??[])){setWizard({...w,phase:'press',candidate:undefined,error:'The signal changed while held. Try a steady press.'});return;}
    }
    if(!released)return;
    if(Date.now()<candidate.stableAt){setWizard({...w,phase:'press',candidate:undefined,error:'Hold for at least 80 ms, then release.'});return;}
    const working={hid:{...w.working.hid},dom:{...w.working.dom}};
    if(w.kind==='hid')working.hid[control]=candidate.fp;
    const results=[...w.results,{control,received:`HID ${byteString(candidate.raw.bytes??[])} · report ${candidate.raw.reportId??0}`,signature:candidate.signature,actual:candidate.actual}];
    const done=w.step===w.controls.length-1;
    setWizard({...w,phase:done?'done':'press',step:done?w.step:w.step+1,candidate:undefined,working,results,error:''});
    if(done && w.kind==='hid') {
      const key=calibrationKey('hid');setConfig(p=>({...p,calibrations:{...p.calibrations,[key]:working}}));
      setNotice('Inputs learned for Treadory. This does not change the pedal’s stored output.');
    }
  };

  const addMouseObservations = (observations:{id:number;label:string}[]) => {
    if(!observations.length)return;
    setHistory(previous=>previous.map(item=>{
      const labels=observations.filter(o=>o.id===item.id).map(o=>o.label);
      if(labels.includes(''))return {...item,mouseSignal:undefined};
      return labels.length?{...item,mouseSignal:[...new Set([...(item.mouseSignal?.split(' / ')??[]),...labels])].join(' / ')}:item;
    }));
  };
  observeMouseRef.current = label => addMouseObservations(mouseObservation.current.observe(label,performance.now()));

  const recordPresses = (next:PedalState,raw:RawInput) => {
    if(raw.source!=='webhid' && raw.source!=='simulation')return;
    const before=historyStates.current[raw.source];
    const pressed=controlsFor(configRef.current.pedalCount).filter(c=>next[c] && !before[c]);
    historyStates.current[raw.source]={...next};
    if(!pressed.length)return;
    const rows=pressed.map(control=>({id:++sequence.current,time:raw.timestamp,text:`${nameOf(control)} press`,detail:byteString(raw.bytes??[]),source:raw.source}));
    setHistory(previous=>[...rows,...previous].slice(0,50));
    if(raw.source==='webhid' && !background.current && !document.hidden)addMouseObservations(mouseObservation.current.press(rows.map(row=>row.id),performance.now()));
  };

  const ingest = (next:PedalState,raw:RawInput,decoded=true,record=true) => {
    if (record) recordPresses(next,raw);
    if (decoded) acceptWizard(raw,next);
    const oldRaw = lastRawRef.current;
    const rawChanged = !oldRaw || oldRaw.source !== raw.source || oldRaw.reportId !== raw.reportId || oldRaw.down !== raw.down || oldRaw.key !== raw.key || oldRaw.mouseButton !== raw.mouseButton || byteString(oldRaw.bytes ?? []) !== byteString(raw.bytes ?? []);
    if (rawChanged) {lastRawRef.current = raw;setLastRaw(raw);}
    if (raw.source === 'webhid' || raw.source === 'simulation') { if (rawChanged) setHardwareRaw(raw); }
    const shouldMap = raw.source === 'simulation' ? modeRef.current === 'simulation' : raw.source === 'webhid' ? modeRef.current === 'hardware' : false;
    if (!shouldMap) return;
    states.current[raw.source] = next;
    const combined = idleState();
    const sources:InputSource[] = modeRef.current === 'hardware' ? ['webhid'] : ['simulation'];
    for (const c of controlsFor(configRef.current.pedalCount)) combined[c] = sources.some(s => states.current[s][c]);
    const changes = controlsFor(configRef.current.pedalCount).filter(c => stateRef.current[c] !== combined[c]);
    if (changes.length) {
      setLastControl({control:changes[changes.length-1],down:combined[changes[changes.length-1]]});
      for (const c of changes) execute(c,combined[c],raw.source);
      if (testRef.current && (!wizardRef.current || wizardRef.current.phase === 'done')) {
        const talking = [...activeActions.current.values()].some(a=>a.mapping.action==='talk');
        setPlayback(p => p.talking === talking ? p : {...p,talking});
      }
    } else if (rawChanged) {
      const expected = wizardRef.current?.controls[wizardRef.current.step];
      if (expected && decoded) setLastControl({control:expected,down:raw.down ?? Boolean(stateMask(next))});
    }
    if (!sameState(stateRef.current,combined)) {stateRef.current = combined;setState(combined);}
  };
  const onHid = (raw:RawInput) => {
    if (repairBusyRef.current) return;
    reports.current[raw.reportId ?? 0] = raw.bytes ?? [];
    const profile = hardwareRef.current.profile;
    let next = physicalHid.current;
    if (profile) {
      const decoded=profile.decode(raw.reportId??0,raw.bytes??[]);
      if (!decoded) {setNotice(`A report outside the ${profile.label} button layout was received. It was not decoded.`);ingest(states.current.webhid,raw,false,false);return;}
      next=decoded;
    }
    else {
      const calibration=getCalibration('hid');
      if (Object.values(calibration.hid).some(fp=>fp.reportId===(raw.reportId??0) && fp.length!==raw.bytes?.length)) {
        setNotice('A learned report arrived with an unexpected length. This packet was not decoded.');ingest(states.current.webhid,raw,false,false);return;
      }
      next = decodeLearned(calibration,raw.reportId ?? 0,raw.bytes ?? [],next);
    }
    physicalHid.current=next;
    for (const control of controlsFor(configRef.current.pedalCount)) {
      if (!next[control]) awaitingRelease.current[control]=false;
      else if (background.current || document.hidden) awaitingRelease.current[control]=true;
    }
    // Keep the live inspector truthful; eligibility gates action execution separately.
    const rearming=controlsFor(configRef.current.pedalCount).some(c=>next[c] && awaitingRelease.current[c]);
    ingest(next,raw,!background.current && !document.hidden && !rearming);
  };
  const pedal = useFootPedal(onHid,(identity,profile) => {
    reports.current = {};
    historyStates.current.webhid=idleState();
    physicalHid.current=idleState();awaitingRelease.current=idleState();
    hardwareRef.current = {identity,profile};
    resetMode('hardware');setHardwareRaw(null);mouseObservation.current.reset();setLastRaw(null);lastRawRef.current=null;
    setConfig(p => ({...p,device:identity,...(profile ? {modelId:profile.modelId,pedalCount:3}:{})}));
    setNotice(profile ? 'Pedal connected. Press any control to see its live input.' : "Unknown foot pedal. Open Test & fix pedal to learn its USB inputs.");
  },() => {hardwareRef.current = {identity:null,profile:undefined};mouseObservation.current.reset();historyStates.current.webhid=idleState();reports.current={};physicalHid.current=idleState();awaitingRelease.current=idleState();releaseAll();const w=wizardRef.current;if(w && w.phase !== 'done')setWizard(null);},config.device);

  useEffect(() => {
    const clear = () => { mouseObservation.current.reset();background.current=true;for(const c of controlsFor(configRef.current.pedalCount))awaitingRelease.current[c] ||= physicalHid.current[c];releaseAll();const w=wizardRef.current;if(w && w.phase !== 'done')setWizard({...w,phase:w.kind==='hid'?'baseline':'press',candidate:undefined,error:'The page lost focus. Release all pedals, return to this page, and repeat this step.'}); };
    const focus = () => {background.current=document.hidden;};
    const hidden = () => {if(document.hidden)clear();else if(document.hasFocus())focus();};
    background.current=document.hidden;
    window.addEventListener('blur',clear);window.addEventListener('focus',focus);document.addEventListener('visibilitychange',hidden);
    return () => {window.removeEventListener('blur',clear);window.removeEventListener('focus',focus);document.removeEventListener('visibilitychange',hidden);};
  },[]);

  useEffect(() => {
    const mouse=(event:MouseEvent)=>{
      if(!hardwareRef.current.identity || repairBusyRef.current || document.hidden || background.current || event.button<0 || event.button>4)return;
      if(event.target instanceof Element && event.target.closest('button,a,input,select,textarea,summary,[contenteditable]'))return;
      const label=mouseSignal(event.button,event.buttons);if(label)observeMouseRef.current(label);
    };
    window.addEventListener('mousedown',mouse,true);
    return ()=>window.removeEventListener('mousedown',mouse,true);
  },[]);

  const simulate = (control:Control,down:boolean) => {
    if (modeRef.current !== 'simulation' || states.current.simulation[control] === down) return;
    const next = {...states.current.simulation,[control]:down};
    ingest(next,{source:'simulation',timestamp:Date.now(),reportId:0,bytes:[stateMask(next),0]});
  };
  const beginWizard = (kind:Wizard['kind']) => {
    setToolsTab('test');setToolsOpen(true);
    releaseAll();setRecording(null);
    if (kind === 'hid' && !pedal.device) {setNotice('Connect a readable USB pedal first. Pedals that expose only keyboard or mouse input need device-aware desktop software for reliable identification.');return;}
    const working = emptyCalibration();
    setWizard({kind,phase:kind==='hid'?'baseline':'press',step:0,controls:controlsFor(configRef.current.pedalCount),baseline:{},working,results:[],error:''});
  };
  const diagnose = () => beginWizard(mode === 'simulation' || pedal.profile ? 'diagnose' : 'hid');
  const captureBaseline = () => {
    const w = wizardRef.current;if (!w) return;
    if (!Object.keys(reports.current).length) {setWizard({...w,error:'No report yet. Press and release a pedal once, then capture neutral with all pedals released.'});return;}
    setWizard({...w,phase:'press',baseline:structuredClone(reports.current),error:''});
  };
  const setMapping = (control:Control,patch:Partial<Mapping>) => {releaseAction(control);setConfig(p=>({...p,mappings:{...p.mappings,[control]:{...p.mappings[control],...patch}}}));};
  useEffect(() => {
    if (!recording) return;
    const record = (e:KeyboardEvent) => {
      if (e.key === 'Escape') {e.preventDefault();setRecording(null);return;}
      if (e.key === 'Tab' || ['Control','Alt','Shift','Meta'].includes(e.key)) return;
      e.preventDefault();e.stopPropagation();setMapping(recording,{shortcut:shortcutFrom(e)});setRecording(null);setNotice('Shortcut recorded as a logical action for compatible web integrations.');
    };
    window.addEventListener('keydown',record,true);return () => window.removeEventListener('keydown',record,true);
  },[recording]);

  const openControlOptions = (scope:ControlScope) => {setToolsOpen(false);setControlScope(scope);window.history.replaceState(null,'',scope==='computer'?'#computer-wide':'#browser-extension');setTimeout(()=>document.getElementById('control-options')?.scrollIntoView({behavior:'smooth',block:'center'}),0);};
  const openComputerWide = () => openControlOptions('computer');
  const selectModel = (id:string) => { resetMode('hardware');const m=models.find(m=>m.id===id)!;setConfig(p=>({...p,modelId:id,pedalCount:m.count})); };
  const exportConfig = () => {
    const blob=new Blob([JSON.stringify(configRef.current,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='treadory-config.json';a.click();window.setTimeout(()=>URL.revokeObjectURL(url),1000);setNotice('Configuration exported. Keep this file to restore your mappings.');
  };
  const importConfig = async (file:File|undefined) => {
    if (!file)return;
    try { if(file.size>150_000)throw new Error('Configuration files must be smaller than 150 KB.');const next=validateConfiguration(JSON.parse(await file.text()));if(!models.some(m=>m.id===next.modelId))next.modelId='generic';releaseAll();setWizard(null);setRecording(null);if(pedal.device)next.device=identityOf(pedal.device);setConfig(next);setNotice('Configuration imported and saved on this device.'); }
    catch(e){setNotice(e instanceof SyntaxError?'This file contains invalid JSON. Your current configuration is unchanged.':e instanceof Error?e.message:'The file could not be imported.');}
    finally{if(fileInput.current)fileInput.current.value='';}
  };
  const copyDiagnostics = async () => {
    const summary={app:'Treadory',version:1,webhidSupported:pedal.supported,connected:Boolean(pedal.device),device:pedal.device?identityOf(pedal.device):null,profile:pedal.profile?.label ?? null,collections:pedal.collections,lastHardwareReport:hardwareRaw?{source:hardwareRaw.source,reportId:hardwareRaw.reportId,bytes:hardwareRaw.bytes}:null};
    try { await navigator.clipboard.writeText(JSON.stringify(summary,null,2));setNotice('Device diagnostics copied. No personal data or typed shortcuts are included.'); }
    catch {setNotice('Clipboard access is unavailable. Select and copy the device details below.');}
  };
  const resetDefaults = () => { releaseAll();setWizard(null);setRecording(null);setConfig(p=>({...p,mappings:defaultConfiguration().mappings,calibrations:{}}));setNotice('Mappings and learned inputs reset to defaults.'); };
  const mismatch = wizard?.results.find(r => r.actual && r.actual !== nameOf(r.control));
  const duplicate = wizard ? new Set(wizard.results.map(r=>r.signature)).size !== wizard.results.length : false;
  const middleMouse = wizard?.results.find(r=>r.control==='middle' && /Right Click/.test(r.received));
  const connected = Boolean(pedal.device);
  const liveCal = getCalibration('hid');
  const learnedCount = Object.keys(liveCal.hid).length;
  const minutes = (sec:number) => `${String(Math.floor(sec/60)).padStart(2,'0')}:${String(Math.floor(sec%60)).padStart(2,'0')}`;

  const renderMappingSelect = (c:Control,id:string) => <select aria-label={`${nameOf(c)} pedal action`} id={id} value={config.mappings[c].action} onChange={e=>setMapping(c,{action:e.target.value as Mapping['action']})}>{actions.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select>;
  const diagnosticPanel = wizard ? <section className="wizard" aria-label="Pedal diagnostic wizard"><div className="wizard-top"><span className="technical">{wizard.kind==='hid'?'RAW HID CALIBRATION':'PEDAL DIAGNOSTICS'} / {wizard.phase==='done'?'COMPLETE':`STEP ${wizard.step+1} OF ${wizard.controls.length}`}</span><button className="text-button" onClick={()=>{setWizard(null);releaseAll();}}>End test</button></div>{wizard.phase==='done'?<><h3>{duplicate?'Some controls send the same signal.':mismatch?'A physical control is arriving out of position.':'All physical controls are distinct.'}</h3>{mode==='simulation'&&<p className="small muted">Simulation result. Connect hardware to verify your actual pedal.</p>}{mismatch&&<p className="info-line">Your {mismatch.control} pedal arrived as {mismatch.actual}. Check the device or system remapper.</p>}{middleMouse&&<><p className="info-line">Your middle pedal is currently arriving as Right Click. Changing its action here does not change its output in other apps.</p><button className="secondary" onClick={()=>{setToolsTab('repair');setWizard(null);releaseAll();}}>Fix the pedal’s stored output ↗</button></>}<div className="diagnostic-results">{wizard.results.map(r=><div key={r.control}><strong>{nameOf(r.control)}</strong><span>{r.received}{r.system&&<small>System event: {r.system}</small>}</span></div>)}</div><button className="secondary" onClick={()=>beginWizard(wizard.kind)}>Run again ↗</button></>:<><div className="wizard-instruction"><div><h3>{wizard.phase==='baseline'?'Start with all pedals released.':wizard.phase==='release'?`Now release the ${nameOf(wizard.controls[wizard.step]).toLowerCase()} pedal.`:`Press and hold the ${nameOf(wizard.controls[wizard.step]).toUpperCase()} pedal.`}</h3><p>{wizard.phase==='baseline'?'If no report has arrived, press and release once. Then capture the neutral state.':wizard.phase==='release'?'Keep the press steady, then release to confirm this input.':'Use only this physical control. Hold it briefly, then release.'}</p></div><div className="wizard-progress">{wizard.controls.map((c,i)=><span key={c} className={i<wizard.step?'complete':i===wizard.step?'current':''}>{i<wizard.step?'✓':i+1}</span>)}</div></div>{wizard.candidate&&<p className="captured technical">RECEIVED / {wizard.candidate.raw.label||byteString(wizard.candidate.raw.bytes??[])}</p>}{wizard.error&&<p className="wizard-error">{wizard.error}</p>}<div className="wizard-actions">{wizard.phase==='baseline'&&<button className="primary" onClick={captureBaseline}>Capture neutral <span aria-hidden="true">↗</span></button>}{wizard.kind==='hid'&&wizard.phase!=='baseline'&&<button className="text-button" onClick={()=>setWizard({...wizard,phase:'baseline',candidate:undefined,error:''})}>Capture neutral again</button>}</div></>}</section> : null;
  return <main className="canvas">
    <header><a className="brand" href="#" aria-label="Treadory home"><svg viewBox="0 0 40 40" aria-hidden="true"><rect width="40" height="40" rx="12" fill="currentColor"/><path d="M8 27V17Q8 12 13 12H27Q32 12 32 17V27Z" fill="#eeede9"/><path d="M16 13V26M24 13V26" stroke="#c7470b" strokeWidth="3"/></svg><span className="brand-word">treadory<span className="brand-period">.</span></span></a><span className="technical"><span className="header-note">Foot control, made clear.</span></span></header>
    <section className="hero"><div className="hero-copy"><p className="eyebrow"><i/> USB FOOT PEDAL TESTER &amp; MAPPER</p><h1>Know every press.<br/><em>Map every pedal.</em></h1><p className="hero-description">Test your USB foot pedal. Choose what every press does.<br/>No installation. No account. Just your controls.</p><div className="hero-actions"><button className="primary" title={repairActive?'Disconnect the programmer in the device repair panel first.':undefined} disabled={!pedal.supported || pedal.busy || repairBusy || repairActive} onClick={connected?pedal.disconnect:pedal.connect}>{pedal.busy?'Connecting…':connected?'Disconnect Pedal':'Connect Pedal'}<span aria-hidden="true">↗</span></button><button className={`demo-toggle ${mode==='simulation'?'selected':''}`} aria-pressed={mode==='simulation'} disabled={repairBusy} onClick={()=>resetMode(mode==='simulation'?'hardware':'simulation')}><span className="toggle-track"><i/></span> Demo / Simulate</button></div><p className="small muted">Your mappings are saved automatically on this device.</p><a className="computer-wide-entry" href="#computer-wide" onClick={openComputerWide}>Computer-wide control · Windows preview <span aria-hidden="true">↗</span></a></div><PedalVisual state={state} controls={controls} simulate={mode==='simulation'} onPress={simulate}/></section>

    <section className="connection-section" aria-labelledby="connection-title"><div className="section-title"><div><p className="step-label"><span>01</span> CONNECT</p><h2 id="connection-title">Choose your pedal.</h2></div><span className="connection-hint">Or start with the demo above</span></div><div className="device-panel" aria-label="Device connection"><div className="device-status"><i className={connected?'connected':''}/><div><strong>{mode==='simulation'?'Demo mode':connected?pedal.device!.productName || 'Unknown foot pedal':'No pedal connected'}</strong><span className="technical" aria-live="polite">{mode==='simulation'?'Virtual input · no hardware needed':connected?'Connected and ready':'Choose a model, then connect'}</span></div></div><div className="model-picker"><label htmlFor="device-model">Your foot pedal</label><select id="device-model" disabled={repairBusy} value={config.modelId} onChange={e=>selectModel(e.target.value)}>{brands.map(brand=><optgroup key={brand} label={brand}>{models.filter(m=>m.brand===brand).map(m=><option value={m.id} key={m.id}>{m.brand} · {m.label}</option>)}</optgroup>)}</select></div>{selectedModel.id==='generic'&&<div className="count-picker"><label htmlFor="pedal-count">Controls</label><select id="pedal-count" disabled={repairBusy} value={config.pedalCount} onChange={e=>{releaseAll();setWizard(null);setConfig(p=>({...p,pedalCount:Number(e.target.value)}));}}>{[1,2,3,4].map(n=><option key={n} value={n}>{n} pedal{n!==1?'s':''}</option>)}</select></div>}</div></section>
    {(selectedModel.route==='standard'||selectedModel.id==='generic'||connected&&!pedal.profile)&&<p className="connection-help">{selectedModel.route==='standard'?'This model may need desktop software to identify pedal presses. See Device outputs for programming options.':learnedCount?`${learnedCount} controls learned. Ready to test.`:'Open Test & fix pedal to learn each control.'}</p>}
    {!pedal.supported&&<p className="browser-note">USB access needs a WebHID-capable desktop browser such as Edge. You can try the demo here.</p>}
    {(notice||pedal.error||pedal.notice)&&<div className={`notice ${pedal.error?'error':''}`} role="status"><span>{pedal.error||pedal.notice||notice}</span><button onClick={()=>setNotice('')} aria-label="Dismiss notification" hidden={Boolean(pedal.error||pedal.notice)}>×</button></div>}

    <section className="workbench" aria-labelledby="mapping-title"><div className="section-title"><div><p className="step-label"><span>02</span> CUSTOMIZE</p><h2 id="mapping-title">Assign your actions.</h2></div><div className="section-actions"><button ref={toolsTrigger} className="secondary" onClick={()=>{setToolsTab('test');setToolsOpen(true);}} disabled={repairBusy}>Test &amp; fix pedal <span aria-hidden="true">↗</span></button></div></div>
    <div className={`mapping-grid count-${controls.length}`}>{controls.map((c,i)=><article className={`mapping-card ${state[c]?'active':''}`} key={c}><div className="mapping-heading"><h3><span className="pedal-number">0{i+1}</span>{nameOf(c)} pedal</h3><span className="pedal-state">{state[c]?'↓ Pressed':'○ Released'}</span></div><label htmlFor={`mapping-${c}`}>Action</label>{renderMappingSelect(c,`mapping-${c}`)}<div className="mapping-extra">{['rewind','forward'].includes(config.mappings[c].action)?<><label htmlFor={`seconds-${c}`}>Jump by</label><div className="duration-row"><select id={`seconds-${c}`} aria-label={`${nameOf(c)} seek duration`} value={[1,3,5,10].includes(config.mappings[c].seconds)?config.mappings[c].seconds:'custom'} onChange={e=>setMapping(c,{seconds:e.target.value==='custom'?15:Number(e.target.value)})}>{[1,3,5,10].map(n=><option value={n} key={n}>{n} seconds</option>)}<option value="custom">Custom</option></select>{![1,3,5,10].includes(config.mappings[c].seconds)&&<input aria-label={`${nameOf(c)} custom duration`} type="number" min="0.1" max="120" step="0.1" value={config.mappings[c].seconds} onChange={e=>{const n=Number(e.target.value);if(n>=.1&&n<=120)setMapping(c,{seconds:n});}}/>}</div></>:config.mappings[c].action==='shortcut'?<><button className="record-button" onClick={()=>setRecording(recording===c?null:c)}>{recording===c?'Press shortcut · Esc to cancel':config.mappings[c].shortcut?.label || 'Record shortcut'}<span aria-hidden="true">↗</span></button></>:config.mappings[c].action==='custom'?<><label htmlFor={`custom-${c}`}>Action name</label><input id={`custom-${c}`} maxLength={120} type="text" placeholder="e.g. Toggle captions" value={config.mappings[c].custom ?? ''} onChange={e=>setMapping(c,{custom:e.target.value})}/></>:config.mappings[c].action==='talk'?<p className="mapping-footnote">Hold to activate. Lift to release.</p>:null}</div></article>)}</div>
    <div className="mapping-caption small"><span>✓ {storageStatus}</span></div>
    </section>



    <ControlOptions scope={controlScope} onScopeChange={setControlScope}/>
    <section className="test-section" aria-labelledby="test-title"><div className="section-title"><div><p className="step-label"><span>03</span> TRY IT</p><h2 id="test-title">See every press in action.</h2></div></div>
    <div className="instrument-grid"><div className="preview-panel"><div className="panel-heading"><h3>Mapping preview</h3><label className="inline-toggle"><input type="checkbox" checked={testEnabled} onChange={e=>{if(!e.target.checked)releaseActions();testRef.current=e.target.checked;setTestEnabled(e.target.checked);setPlayback(p=>({...p,playing:false,talking:false}));}}/> Test Mapping</label></div><div className="execution" aria-label="Last mapping execution">{execution}</div><div className="transport"><button className="play-button" aria-label={playback.playing?'Pause demo playback':'Play demo playback'} disabled={!testEnabled} onClick={()=>setPlayback(p=>({...p,playing:!p.playing,position:p.position>=120?0:p.position}))}>{playback.playing?'Ⅱ':'▶'}</button><div className="timeline"><div className="timeline-label technical"><span>DEMO TRACK {String(playback.track).padStart(2,'0')} {playback.muted?' / MUTED':''} {playback.talking?' / HELD':''}</span><span>{minutes(playback.position)} / 02:00</span></div><progress max={120} value={playback.position} aria-label="Demo playback position"/></div></div><p className="preview-caption">Try playback and seeking here. Mappings apply within compatible web apps.</p></div>
    <div className="inspector"><div className="panel-heading"><h3>Live input</h3><span className={`source-badge ${lastRaw?.source==='simulation'?'simulated':''}`}>{lastRaw?sourceLabel[lastRaw.source]:'Waiting'}</span></div><div className="live-reading"><span>Last pedal</span><strong>{lastControl?nameOf(lastControl.control):'—'}</strong><span className={lastControl?.down?'reading-state down':'reading-state'}>{lastControl?(lastControl.down?'Pressed ↓':'Released ○'):'Press a pedal to begin'}</span></div><div className="signal-comparison"><div><span>Pedal signal</span><strong>{hardwareRaw?`${hardwareRaw.source==='simulation'?'Simulation':'HID'} / ${byteString(hardwareRaw.bytes??[])}`:'No signal yet'}</strong></div></div><details className="raw-details"><summary>Raw input details <span>+</span></summary><dl><div><dt>Decoded mask</dt><dd>{lastRaw&&(lastRaw.source==='simulation'||pedal.profile)?`0x${hex(stateMask(state))}`:'—'}</dd></div><div><dt>Raw bytes</dt><dd>{hardwareRaw?.bytes?byteString(hardwareRaw.bytes):'—'}</dd></div><div><dt>Report ID</dt><dd>{hardwareRaw?.reportId??'—'}</dd></div><div><dt>Received</dt><dd>{lastRaw?formatTime(lastRaw.timestamp):'—'}</dd></div></dl></details></div></div></section>
    <details className="history-panel"><summary><span className="disclosure-title">Press history <small>{history.length ? `${history.length} / 50 presses` : 'No presses yet'}</small></span><span>+</span></summary><div className="history-content"><div className="panel-heading"><p className="technical">LAST 50 PRESSES · NEWEST FIRST</p><button className="text-button" onClick={()=>{setHistory([]);mouseObservation.current.reset();}} disabled={!history.length}>Clear</button></div><p className="history-coverage">Computer time ({timeZone}) · live as reports arrive. USB: across focus changes. Mouse observations: this page only.</p><details className="history-scope"><summary>What can be monitored?</summary><p>USB history continues while the browser delivers reports; suspended pages can miss input. Mouse clicks received within 120 ms of one identifiable USB press are attached to that press, regardless of which event arrives first. Coincident clicks may come from an ordinary mouse. Clicks on app controls and text fields are excluded. Multiple nearby pedal presses are not assigned a mouse event. Pedals exposing only keyboard/mouse input cannot be identified reliably here. Monitoring other apps requires desktop software.</p></details>{history.some(item=>item.mouseSignal) && <p className="history-mouse-note">Nearby mouse events are observations, not proof that your pedal sent them.</p>}{history.length?<div className="event-history" aria-label="Last 50 presses">{history.map(item=><div className="history-row" key={item.id}><time dateTime={new Date(item.time).toISOString()} title={new Date(item.time).toLocaleString()}><small>{new Date(item.time).toLocaleDateString(undefined,{month:'short',day:'numeric'})}</small>{formatTime(item.time)}</time><strong>{item.text}{item.mouseSignal && <small className="mouse-signal">Mouse event nearby: {item.mouseSignal}</small>}</strong><code>{item.detail}</code><span>{sourceLabel[item.source]}</span></div>)}</div>:<p className="history-empty">Connect a pedal, learn its inputs, or try the demo. Each press is recorded once; releases and held repeats do not use history slots.</p>}</div></details>

    <div className="advanced"><details><summary>Device details <span>+</span></summary><div className="details-content"><dl className="device-details"><div><dt>Product</dt><dd>{pedal.device?.productName||'No raw HID device connected'}</dd></div><div><dt>Vendor / Product ID</dt><dd>{pedal.device?`${hex(pedal.device.vendorId,4)} / ${hex(pedal.device.productId,4)}`:'—'}</dd></div><div><dt>Detected profile</dt><dd>{pedal.profile?.label||'Generic · calibrated input'}</dd></div><div><dt>WebHID</dt><dd>{pedal.supported?'Available in this secure browser':'Unavailable'}</dd></div></dl>{pedal.collections.length>0&&<div className="collection-list">{pedal.collections.map((c,i)=><div key={i}><code>Usage page 0x{hex(c.usagePage,4)} · Usage 0x{hex(c.usage,4)}</code><p>Input reports: {c.inputReports.join(', ')||'none'} · Output reports: {c.outputReports.join(', ')||'none'} · Feature reports: {c.featureReports.join(', ')||'none'}</p></div>)}</div>}<p className="small muted">Connecting and calibrating read pedal input. Only the separate device repair flow can write stored outputs on compatible hardware.</p><button className="secondary" onClick={copyDiagnostics}>Copy device diagnostics ↗</button></div></details><details><summary>Help &amp; compatibility <span>+</span></summary><div className="details-content"><p><strong>Where do mappings work?</strong><br/>This page’s mappings work here and in compatible web integrations. Install the Treadory extension to map readable USB pedal presses across permitted websites. Use Computer-wide control for the Windows native-helper preview.</p><p><strong>Can I use my pedal in another app?</strong><br/>Open Test & fix pedal, then Device outputs, to check programming options for your model. The separate Windows helper preview requires explicit installation and endpoint checks.</p><p className="small muted"><strong>Which browser should I use?</strong><br/>Direct USB access needs a WebHID-capable desktop browser such as Edge, on HTTPS or localhost. The demo works in other browsers. Mouse events do not reveal device identity; nearby clicks are observations only. Pedals exposing only keyboard/mouse input need device-aware desktop software for reliable monitoring.</p>{selectedModel.url&&<a target="_blank" rel="noreferrer" href={selectedModel.url}>Manufacturer information for your selected pedal ↗</a>}<details className="catalog-details"><summary>Pedal types & manufacturer references <span>+</span></summary><p className="small muted">USB transcription HID controls use raw input when exposed. Pedals exposing only keyboard/mouse signals need device-aware desktop software for reliable identification. MIDI-only, analog sustain, racing axes and proprietary dongles need a compatible bridge; this app does not decode them.</p><div className="reference-links"><a href="https://www.veccorp.com/foot-controls.html" target="_blank" rel="noreferrer">VEC</a><a href="https://www.dictation.philips.com/us/products/transcription-accessories/foot-control-acc2300/" target="_blank" rel="noreferrer">Philips</a><a href="https://audiosupport.omsystem.com/en/product/rs28h-usb-foot-switch-with-3-pedals/" target="_blank" rel="noreferrer">OM SYSTEM / Olympus</a><a href="https://pcsensor.com/" target="_blank" rel="noreferrer">PCsensor</a><a href="https://xkeys.com/media/wysiwyg/smartwave/porto/category/spec%20sheets/XK-3%20spec%20sheet.pdf" target="_blank" rel="noreferrer">X-keys</a><a href="https://www.airturn.com/products/airturn-duo-500" target="_blank" rel="noreferrer">AirTurn</a></div></details></div></details></div>
    <dialog ref={toolsDialog} className="tools-dialog" aria-labelledby="tools-title" onCancel={e=>{e.preventDefault();if(!repairBusy&&!repairActive){setToolsOpen(false);setWizard(null);releaseAll();}}} onClose={()=>{setToolsOpen(false);toolsTrigger.current?.focus();}}>
      <div className="tools-header"><div><p className="eyebrow">YOUR PEDAL, WORKING YOUR WAY</p><h2 id="tools-title">Test &amp; fix your pedal.</h2></div><button className="dialog-close" aria-label="Close pedal tools" title={repairActive?'Disconnect the programmer before closing':undefined} disabled={repairBusy||repairActive} onClick={()=>{setToolsOpen(false);setWizard(null);releaseAll();}}>×</button></div>
      <div className="tools-tabs" aria-label="Pedal tools"><button aria-pressed={toolsTab==='test'} disabled={repairBusy||repairActive} onClick={()=>setToolsTab('test')}>Test inputs</button><button aria-pressed={toolsTab==='repair'} disabled={repairBusy} onClick={()=>{setToolsTab('repair');setWizard(null);releaseAll();}}>Device outputs</button></div>
      <div hidden={toolsTab!=='test'} className="tools-body">
        {!wizard && <><p className="tools-intro">{mode==='simulation'?'Try the guided check with virtual pedals.':connected?'Press any pedal. Its history automatically checks for nearby mouse clicks received by this page.':'Connect your pedal to check its physical controls. Ordinary mouse clicks are never counted as pedal presses.'}</p><button className="primary" disabled={!connected&&mode!=='simulation'} onClick={diagnose}>Start pedal check ↗</button>{!connected&&mode!=='simulation'&&<p className="small muted">A readable USB connection is required. Keyboard/mouse-only pedals need device-aware desktop software.</p>}</>}
        {diagnosticPanel}
        {mode==='simulation' && <PedalVisual state={state} controls={controls} simulate onPress={simulate}/>}
      </div><div hidden={toolsTab!=='repair'} className="tools-body">
    <DeviceRepair embedded key={selectedModel.id} model={selectedModel} hidAvailable={pedal.supported} open={true} onOpen={()=>{}} onBusy={busy=>{repairBusyRef.current=busy;setRepairBusy(busy);if(busy)releaseAll();}} onActive={active=>{if(active)repairSessions.current.add(selectedModel.id);else repairSessions.current.delete(selectedModel.id);setRepairActive(repairSessions.current.size>0);}} onPrepare={async()=>{resetMode('hardware');setPlayback(p=>({...p,playing:false}));await pedal.prepareForProgramming();}} onApplied={identity=>{setConfig(p=>{const calibrations={...p.calibrations};delete calibrations[`standard:${p.modelId}:${p.pedalCount}`];delete calibrations[deviceKey(identity)];return {...p,calibrations};});setNotice('Device outputs were saved and read back. Test them before using your pedal in another app.');}} onComputerWide={openComputerWide} onExtension={()=>openControlOptions('web')} onVerify={()=>{setToolsOpen(false);resetMode('hardware');setNotice('Programmer disconnected. Reconnect a readable USB pedal to observe its presses here, and verify saved outputs in your target app. Keyboard/mouse-only outputs require a desktop tool for device-specific monitoring.');}}/>

      </div>
    </dialog>
    <footer><a className="footer-privacy" href="/privacy/">Privacy policy ↗</a><span className="footer-brand">treadory<span>.</span><small>Your settings stay with you.</small></span><details className="settings-menu"><summary>Settings &amp; backup <span>+</span></summary><div className="footer-actions"><button className="text-button" disabled={repairBusy} onClick={resetDefaults}>Reset to defaults</button><button className="secondary" disabled={repairBusy} onClick={()=>fileInput.current?.click()}>Import JSON <span>↙</span></button><button className="secondary" onClick={exportConfig}>Export configuration <span aria-hidden="true">↗</span></button><input ref={fileInput} hidden type="file" accept=".json,application/json" aria-label="Import configuration file" onChange={e=>void importConfig(e.target.files?.[0])}/></div></details><div className="creator-credit" id="creator"><span>Created by <a className="creator-name" href="https://github.com/RonitGandotra05" target="_blank" rel="noopener noreferrer">Ronit Gandotra</a></span><span className="creator-divider" aria-hidden="true">·</span><a href="https://github.com/RonitGandotra05" target="_blank" rel="noopener noreferrer">GitHub <span aria-hidden="true">↗</span></a><a href="https://www.linkedin.com/in/ronitgandotra" target="_blank" rel="noopener noreferrer">LinkedIn <span aria-hidden="true">↗</span></a></div></footer>
  </main>;
}
