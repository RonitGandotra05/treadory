import { useEffect, useRef, useState } from 'react';
import type { PedalModel } from '../hid/deviceProfiles';
import { identityOf, type PedalDevice } from '../hid/useFootPedal';
import { repairSupport } from '../hid/repairSupport';
import { encodeOutput, outputLabel, outputOptions, PedalProgrammer, programmingCompatibility, programmingIds, sameSettings, type DeviceSettings, type ProgrammableDevice } from '../hid/programming';
import type { DeviceIdentity } from '../hid/core';

interface Props {
  embedded?: boolean;
  model: PedalModel;
  hidAvailable: boolean;
  open: boolean;
  onOpen: (open: boolean) => void;
  onPrepare: () => Promise<void>;
  onBusy: (busy: boolean) => void;
  onActive: (active: boolean) => void;
  onApplied: (identity: DeviceIdentity) => void;
  onVerify: () => void;
  onExtension?: () => void;
}
const slots = ['Left', 'Middle', 'Right'];
export function DeviceRepair({ embedded, model, hidAvailable, open, onOpen, onPrepare, onBusy, onActive, onApplied, onVerify, onExtension }: Props) {
  const support = repairSupport(model);
  const [step, setStep] = useState<'start' | 'edit' | 'review' | 'saved' | 'failed'>('start');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [settings, setSettings] = useState<DeviceSettings | null>(null);
  const [choices, setChoices] = useState(['keep', 'keep', 'keep']);
  const [deviceName, setDeviceName] = useState('');
  const [backup, setBackup] = useState<DeviceSettings | null>(null);
  const [restoring, setRestoring] = useState(false);
  const backupIdentity = useRef<DeviceIdentity | null>(null);
  const session = useRef<PedalProgrammer | null>(null);
  const live = useRef(true);
  const inFlight = useRef(false);
  const callbacks = useRef({ onPrepare, onBusy, onActive, onApplied, onVerify, onExtension }); callbacks.current = { onPrepare, onBusy, onActive, onApplied, onVerify, onExtension };
  const closeSession = async () => {
    const previous = session.current; session.current = null;
    previous?.cancel();
    if (previous?.device.opened) await previous.device.close().catch(() => {});
    callbacks.current.onActive(false);
  };
  useEffect(() => {
    live.current = true;
    const hid = (navigator as Navigator & { hid?: EventTarget }).hid;
    const disconnect = (event: Event) => {
      if ((event as Event & { device: PedalDevice }).device !== session.current?.device) return;
      void closeSession();
      if (live.current) { setStep('failed'); setMessage('Pedal disconnected. Any save in progress may be incomplete. Reconnect and check its outputs.'); }
    };
    hid?.addEventListener('disconnect', disconnect);
    return () => { live.current = false; hid?.removeEventListener('disconnect', disconnect); void closeSession(); };
  }, []);
  const run = async (operation: () => Promise<void>) => {
    if (inFlight.current) return;
    inFlight.current = true; setBusy(true); callbacks.current.onBusy(true); setMessage('');
    try { await operation(); }
    catch (e) {
      if (live.current) { setStep('failed'); setMessage(e instanceof Error ? e.message : 'The device could not be checked. Use the manufacturer’s tool.'); }
      await closeSession();
    } finally {
      inFlight.current = false;
      if (live.current) setBusy(false);
      callbacks.current.onBusy(false);
    }
  };
  const checkDevice = () => run(async () => {
    const hid = (navigator as Navigator & { hid?: { requestDevice(options: { filters: object[] }): Promise<ProgrammableDevice[]> } }).hid;
    if (!hidAvailable || !hid) return;
    // Request during the user's click, before awaiting any lifecycle operations.
    let selected: ProgrammableDevice[];
    try { selected = await hid.requestDevice({ filters: programmingIds.map(p => ({ ...p })) }); }
    catch (e) {
      if (e instanceof DOMException && e.name === 'NotFoundError') { if (live.current) setMessage('Device selection cancelled. No settings were changed.'); return; }
      throw new Error('Device access was not granted. Use the manufacturer’s tool or allow HID access for this page.');
    }
    if (!live.current) return;
    if (!selected.length) { setMessage('No pedal selected. No settings were changed.'); return; }
    const candidates = [...new Set(selected)].filter(d => programmingCompatibility(d).supported);
    if (candidates.length !== 1) throw new Error(candidates.length > 1 ? 'Select one pedal’s programming interface at a time. No commands were sent.' : programmingCompatibility(selected[0]).reason);
    await closeSession();
    await callbacks.current.onPrepare();
    if (!live.current) return;
    const device = candidates[0];
    const programmer = new PedalProgrammer(device); session.current = programmer; callbacks.current.onActive(true);
    if (!device.opened) await device.open();
    if (!live.current || session.current !== programmer) { if (device.opened) await device.close().catch(() => {}); return; }
    const current = await programmer.inspect();
    if (!live.current) return;
    setSettings(current); setBackup(current); backupIdentity.current = identityOf(device); setChoices(['keep', 'keep', 'keep']); setRestoring(false);
    setDeviceName(device.productName); setStep('edit');
    setMessage('Settings read successfully. Choose the output for the affected pedal. Other outputs will be preserved.');
  });
  const desired = restoring && backup ? backup : settings?.map((p, i) => choices[i] === 'keep' ? p : encodeOutput(choices[i])) as DeviceSettings | undefined;
  const changed = Boolean(settings && desired && !sameSettings(settings, desired));
  const save = () => run(async () => {
    const programmer = session.current;
    if (!programmer || !settings || !desired || step !== 'review') throw new Error('Check the connected device and review your changes first.');
    const verified = await programmer.apply(settings, desired);
    if (!live.current) return;
    setSettings(verified); setChoices(['keep', 'keep', 'keep']); setRestoring(false); setStep('saved');
    callbacks.current.onApplied(identityOf(programmer.device));
    setMessage('Stored outputs read back correctly. Now test the actual pedal here and in your other app.');
  });
  const downloadBackup = () => {
    if (!backup || !backupIdentity.current) return;
    const json = { format: 'treadory-device-output-backup', version: 1, device: backupIdentity.current, protocol: 'pcsensor-numbered-8-byte', outputs: backup.map((bytes, i) => ({ slot: i + 1, label: outputLabel(bytes), bytes })) };
    const url = URL.createObjectURL(new Blob([JSON.stringify(json, null, 2)], { type: 'application/json' }));
    const a = document.createElement('a'); a.href = url; a.download = 'treadory-pedal-output-backup.json'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const verify = () => run(async () => { await closeSession(); if (live.current) { setStep('start'); setSettings(null); setBackup(null); backupIdentity.current = null; callbacks.current.onVerify(); } });
  const Container=embedded?'div':'details';
  return <Container className="device-repair" {...(!embedded?{open,onToggle:(e:React.SyntheticEvent)=>onOpen((e.currentTarget as HTMLDetailsElement).open)}:{})}>
    {!embedded && <summary><span><strong>Pedal sending the wrong click or key?</strong><small>{['edit','review','saved'].includes(step) ? 'Device programmer connected · disconnect here when finished' : support.label}</small></span><span className="repair-expand" aria-hidden="true">{open ? '−' : '+'}</span></summary>}
    <div className="repair-content">
      {embedded && <p className="technical repair-support-label">{support.label}</p>}
      <h3 className="repair-scope">{support.status==='unverified'?'Unwanted click? A desktop fix may still work.':'Change the output stored on your pedal.'}</h3>
      <p>{support.description}</p>
      {support.browserCandidate && <div className="repair-direct">
        <h3>Check your pedal</h3>
        <p>{hidAvailable ? 'Release every pedal and close other pedal software. Connect the USB programming interface to check its identity, report format, and stored outputs. The check does not change outputs.' : 'Direct programming is unavailable in this browser. Use ElfKey below, or open this page in a WebHID-capable desktop browser such as Edge.'}</p>
        <p className="small muted">Direct support is limited to compatible three-pedal PCsensor firmware. Virtually tested; physical hardware verification is pending.</p>
        {['start', 'failed'].includes(step) && <button className="secondary" disabled={!hidAvailable || busy} onClick={() => void checkDevice()}>{busy ? 'Checking…' : 'Check connected pedal'} <span aria-hidden="true">↗</span></button>}
        {settings && !['start', 'failed'].includes(step) && <>
          <p className="repair-device"><strong>{deviceName}</strong> · {step === 'saved' ? 'Saved settings verified' : 'Stored settings checked'}</p>
          <div className="repair-outputs">{slots.map((label, i) => <div className="repair-output" key={label}>
            <label htmlFor={`device-output-${i}`}>{label} pedal <small>Currently: {outputLabel(settings[i])}</small></label>
            {step === 'edit' ? <select id={`device-output-${i}`} aria-label={`${label} pedal device output`} value={choices[i]} disabled={busy} onChange={e => setChoices(p => p.map((v, j) => j === i ? e.target.value : v))}>
              <option value="keep">Keep current output</option>{outputOptions.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
            </select> : <strong>{step === 'review' && desired ? outputLabel(desired[i]) : outputLabel(settings[i])}{step === 'review' && desired && settings[i].every((v, j) => v === desired[i][j]) && <small>Unchanged</small>}</strong>}
          </div>)}</div>
          {step === 'review' && <p className="repair-scope">Saving replaces the pedal’s stored outputs and affects every app. All three outputs above are included. Choose keys your other app recognizes.</p>}

          <div className="repair-actions">
            {step === 'edit' && <button className="primary" disabled={!changed || busy} onClick={() => { setRestoring(false); setStep('review'); setMessage('Review the outputs before saving to your pedal.'); }}>Review changes ↗</button>}
            {step === 'review' && <><button className="primary" disabled={busy} onClick={() => void save()}>{busy ? 'Saving & checking…' : restoring ? 'Restore to pedal' : 'Save to pedal'} ↗</button><button className="text-button" disabled={busy} onClick={() => { setRestoring(false); setStep('edit'); }}>Back to editing</button></>}
            {step === 'saved' && <><button className="primary" disabled={busy} onClick={() => void verify()}>Finish & verify in your app ↗</button><button className="text-button" disabled={busy} onClick={() => setStep('edit')}>Edit again</button></>}
            <button className="text-button" disabled={busy} onClick={downloadBackup}>Download original settings</button>
            {step !== 'review' && backup && !sameSettings(backup, settings) && <button className="text-button" disabled={busy} onClick={() => { setRestoring(true); setStep('review'); setMessage('Review the original outputs before restoring them to this pedal.'); }}>Restore original outputs</button>}
            <button className="text-button" disabled={busy} onClick={() => void verify()}>{step === 'saved' ? 'Disconnect programmer' : 'Cancel & disconnect'}</button>
          </div>
        </>}
        {step === 'failed' && backup && <button className="text-button" onClick={downloadBackup}>Download original settings</button>}
        {message && <p className={step === 'failed' ? 'wizard-error' : 'repair-message'} role="status">{message}</p>}
      </div>}
      <p className="repair-browser-alternative">Want browser-wide controls instead? <button className="text-button" disabled={busy} onClick={()=>void run(async()=>{await closeSession();if(live.current)callbacks.current.onExtension?.();})}>Get the Treadory extension ↗</button> It maps readable USB presses across permitted websites without changing hardware output.</p>
      <div className="repair-guide">
        <h3>{support.tool ? `Using ${support.tool}` : 'Your next steps'}</h3>
        <ol>{support.steps.map(s => <li key={s}>{s}</li>)}</ol>
        {support.url && <a className="repair-tool-link" href={support.url} target="_blank" rel="noreferrer">Open {support.tool} ↗</a>}
      </div>
      <p className="small muted">Treadory’s action mappings affect this page and compatible web integrations; they do not reprogram your pedal. A broken or stuck physical switch needs hardware troubleshooting.</p>
    </div>
  </Container>;
}
