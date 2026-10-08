import { useCallback, useEffect, useRef, useState } from 'react';
import { deviceKey, type DeviceIdentity, type RawInput } from './core.js';
import { findDeviceProfile, type DeviceProfile } from './deviceProfiles.js';

export interface HidReport { reportId:number; items?:unknown[] }
export interface HidCollection { usagePage:number; usage:number; inputReports:HidReport[]; outputReports:HidReport[]; featureReports:HidReport[]; children:HidCollection[] }
export interface PedalDevice extends EventTarget { productName:string; vendorId:number; productId:number; opened:boolean; collections:HidCollection[]; open():Promise<void>; close():Promise<void> }
interface HidApi extends EventTarget { getDevices():Promise<PedalDevice[]>; requestDevice(options:{filters:object[]}):Promise<PedalDevice[]> }
interface ReportEvent extends Event { device:PedalDevice; reportId:number; data:DataView }
interface DeviceEvent extends Event { device:PedalDevice }
export const identityOf = (d:PedalDevice): DeviceIdentity => ({ vendorId:d.vendorId,productId:d.productId,name:d.productName || 'Unknown foot pedal' });
export function collectionSummary(collections:HidCollection[]) {
  const flat:HidCollection[] = [];
  const walk = (items:HidCollection[]) => items.forEach(c => {flat.push(c);walk(c.children || []);});
  walk(collections);
  return flat.map(c => ({ usagePage:c.usagePage,usage:c.usage,inputReports:(c.inputReports || []).map(r => r.reportId),outputReports:(c.outputReports || []).map(r => r.reportId),featureReports:(c.featureReports || []).map(r => r.reportId) }));
}
export function chooseInputDevice(devices:PedalDevice[]):PedalDevice|undefined {
  const unique=[...new Set(devices)];
  const rank=(d:PedalDevice)=>findDeviceProfile(identityOf(d),d.collections) ? 2 : collectionSummary(d.collections).some(c=>c.inputReports.length) ? 1 : 0;
  const best=unique.filter(d=>rank(d)===Math.max(...unique.map(rank)));
  return best.length===1 ? best[0] : undefined;
}
export function useFootPedal(onInput:(raw:RawInput)=>void, onConnected:(identity:DeviceIdentity,profile:DeviceProfile|undefined)=>void, onRelease:()=>void, remembered:DeviceIdentity|null) {
  const hid = typeof navigator !== 'undefined' ? (navigator as Navigator & {hid?:HidApi}).hid : undefined;
  const supported = typeof navigator !== 'undefined' && typeof window !== 'undefined' && 'hid' in navigator && Boolean(hid) && window.isSecureContext;
  const [device,setDevice] = useState<PedalDevice|null>(null);
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState('');
  const [notice,setNotice] = useState('');
  const current = useRef<PedalDevice|null>(null);
  const pending = useRef<PedalDevice|null>(null);
  const generation = useRef(0);
  const lifecycle = useRef<Promise<void>>(Promise.resolve());
  const suspended = useRef(false);
  const callbacks = useRef({onInput,onConnected,onRelease});
  callbacks.current = {onInput,onConnected,onRelease};
  const lastIdentity = useRef(remembered); lastIdentity.current = remembered;
  const reportHandler = useCallback((event:Event) => {
    const e = event as ReportEvent;
    if (e.device !== current.current) return;
    const bytes = Array.from(new Uint8Array(e.data.buffer,e.data.byteOffset,e.data.byteLength));
    callbacks.current.onInput({source:'webhid',timestamp:Date.now(),reportId:e.reportId,bytes});
  },[]);
  const detach = useCallback(() => {
    generation.current++;
    const previous = current.current; current.current = null; pending.current = null;
    previous?.removeEventListener('inputreport',reportHandler);
    // Serialize closes with pending opens so a late open cannot close a newer connection.
    if (previous) lifecycle.current = lifecycle.current.then(async () => {
      if (previous.opened) await previous.close().catch(() => {});
    });
    setDevice(null); callbacks.current.onRelease();
  },[reportHandler]);
  const attach = useCallback(async (next:PedalDevice) => {
    if (next === current.current) return;
    detach();
    const attempt = generation.current;
    pending.current = next;
    setBusy(true);setError('');setNotice('');
    const operation = lifecycle.current.then(async () => {
      if (attempt !== generation.current) return;
      if (!next.opened) await next.open();
      if (attempt !== generation.current) { if (next.opened) await next.close().catch(() => {}); return; }
      current.current = next;
      pending.current = null;
      next.addEventListener('inputreport',reportHandler);
      setDevice(next); suspended.current = false;
      callbacks.current.onConnected(identityOf(next),findDeviceProfile(identityOf(next),next.collections));
      if (!collectionSummary(next.collections).some(c => c.inputReports.length)) setNotice('This interface exposes no readable input reports. Check Device outputs for programming options, or use device-aware desktop software.');
    });
    lifecycle.current = operation.catch(() => {});
    try {
      await operation;
    } catch (e) {
      console.warn('Pedal open failed',e);
      if (attempt === generation.current) { pending.current = null;setError('The pedal could not be opened. Close other pedal software, reconnect the USB cable, and try again.'); }
    } finally { if (attempt === generation.current) setBusy(false); }
  },[detach,reportHandler]);
  const connect = async () => {
    if (!supported || !hid) return;
    const chooserAttempt = generation.current;
    setBusy(true);setError('');setNotice('');
    try {
      const selected = await hid.requestDevice({filters:[]});
      // A disconnect or programming session supersedes an older open chooser.
      if (chooserAttempt !== generation.current) return;
      const next=chooseInputDevice(selected);
      if (next) await attach(next);
      else setNotice(selected.length ? 'More than one readable interface was selected. Select one readable pedal interface.' : 'No pedal selected. Choose Connect Pedal when you are ready.');
    } catch (e) {
      if (chooserAttempt !== generation.current) return;
      const name = e instanceof DOMException ? e.name : '';
      if (name === 'NotFoundError') setNotice('Device selection cancelled. Your configuration is unchanged.');
      else { console.warn('Pedal chooser failed',e);setError('Device access was not granted. Allow HID access for this page, or check Device outputs for other options.'); }
    } finally { if (chooserAttempt === generation.current) setBusy(false); }
  };
  const disconnect = () => { suspended.current = true; detach();setBusy(false);setNotice('Pedal disconnected from this page.'); };
  const prepareForProgramming = () => { disconnect(); setNotice(''); setError(''); return lifecycle.current; };
  useEffect(() => {
    if (!supported || !hid) return;
    let live = true;
    const restore = async (attempt:number) => {
      try {
        const devices=await hid.getDevices();
        if (!live || suspended.current || current.current || pending.current || attempt!==generation.current) return;
        const matches=devices.filter(d=>lastIdentity.current && deviceKey(identityOf(d))===deviceKey(lastIdentity.current));
        const next=chooseInputDevice(matches);
        if (next) void attach(next);
        else if (matches.length>1) setNotice('Multiple matching pedals are authorized. Use Connect Pedal to choose one explicitly.');
      } catch(e) { if (live && attempt===generation.current) {console.warn('Authorized pedals unavailable',e);setNotice('Previously authorized pedals could not be checked. Use Connect Pedal to try again.');} }
    };
    const onConnect = (e:Event) => { const next=(e as DeviceEvent).device;if (live && !suspended.current && !current.current && !pending.current && lastIdentity.current && deviceKey(identityOf(next))===deviceKey(lastIdentity.current)) void restore(generation.current); };
    const onDisconnect = (e:Event) => { if ((e as DeviceEvent).device === current.current || (e as DeviceEvent).device === pending.current) { detach();setBusy(false);setNotice('USB pedal removed. Reconnect it to continue.'); } };
    hid.addEventListener('connect',onConnect);hid.addEventListener('disconnect',onDisconnect);
    void restore(generation.current);
    return () => { live = false;hid.removeEventListener('connect',onConnect);hid.removeEventListener('disconnect',onDisconnect);detach(); };
  },[hid,supported,attach,detach]);
  const profile = device ? findDeviceProfile(identityOf(device),device.collections) : undefined;
  return {device,profile,supported,busy,error,notice,connect,disconnect,prepareForProgramming,collections:device ? collectionSummary(device.collections) : []};
}
