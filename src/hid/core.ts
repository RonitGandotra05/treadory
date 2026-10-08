export const CONTROL_ORDER = ['left', 'middle', 'right', 'auxiliary'] as const;
export type Control = typeof CONTROL_ORDER[number];
export type PedalState = Record<Control, boolean>;
export const idleState = (): PedalState => ({ left: false, middle: false, right: false, auxiliary: false });
export const bits: Record<Control, number> = { left: 1, middle: 2, right: 4, auxiliary: 8 };
export function decodeInfinity(bytes: number[]): PedalState {
  const mask = bytes[0] ?? 0;
  return { left: Boolean(mask & 1), middle: Boolean(mask & 2), right: Boolean(mask & 4), auxiliary: false };
}
export type InputSource = 'webhid' | 'keyboard' | 'mouse' | 'simulation';
export interface RawInput { source: InputSource; timestamp: number; reportId?: number; bytes?: number[]; key?: string; code?: string; mouseButton?: number; mouseButtons?: number; label?: string; down?: boolean }
export const hex = (n: number, width = 2) => n.toString(16).toUpperCase().padStart(width, '0');
export const byteString = (bytes: number[]) => bytes.map(b => hex(b)).join(' ');
export function stateMask(state: PedalState): number { return CONTROL_ORDER.reduce((mask, c) => mask | (state[c] ? bits[c] : 0), 0); }
export function sameState(a: PedalState, b: PedalState): boolean { return CONTROL_ORDER.every(c => a[c] === b[c]); }
export function deviceKey(d: DeviceIdentity): string { return `${hex(d.vendorId,4)}:${hex(d.productId,4)}:${d.name}`; }
export interface DeviceIdentity { vendorId: number; productId: number; name: string }
export const controlsFor = (count: number): Control[] => count === 1 ? ['middle'] : count === 2 ? ['left', 'right'] : count === 4 ? [...CONTROL_ORDER] : ['left', 'middle', 'right'];

export interface Fingerprint { reportId: number; length: number; changes: { index: number; mask: number; baseline: number; pressed: number }[] }
export interface DomFingerprint { id: string; label: string; code?: string; mouseButton?: number }
export interface Calibration { hid: Partial<Record<Control, Fingerprint>>; dom: Partial<Record<Control, DomFingerprint>> }
export const emptyCalibration = (): Calibration => ({ hid: {}, dom: {} });
export function learnFingerprint(reportId: number, baseline: number[], pressed: number[]): Fingerprint {
  if (baseline.length !== pressed.length || !baseline.length) throw new Error('Report length changed. Release every pedal and try again.');
  if (baseline.length>512) throw new Error('This report exceeds the 512-byte calibration limit. Use a device-specific input adapter.');
  const changes = pressed.flatMap((value, index) => { const mask = value ^ baseline[index]; return mask ? [{ index, mask, baseline: baseline[index] & mask, pressed: value & mask }] : []; });
  if (!changes.length) throw new Error('No changed input. Release the pedal, then press it again.');
  return { reportId, length: baseline.length, changes };
}
export function matchesFingerprint(fp: Fingerprint, reportId: number, bytes: number[]): boolean {
  return reportId === fp.reportId && bytes.length === fp.length && fp.changes.every(c => (bytes[c.index] & c.mask) === c.pressed);
}
export function fingerprintReleased(fp: Fingerprint, reportId: number, bytes: number[]): boolean {
  return reportId === fp.reportId && bytes.length === fp.length && fp.changes.every(c => (bytes[c.index] & c.mask) === c.baseline);
}
export function conflictFingerprint(a: Fingerprint, b: Fingerprint): boolean {
  // Overlapping changed bits cannot safely represent independent simultaneous switches.
  return a.reportId === b.reportId && a.changes.some(x => b.changes.some(y => x.index === y.index && Boolean(x.mask & y.mask)));
}
export function decodeLearned(cal: Calibration, reportId: number, bytes: number[], previous = idleState()): PedalState {
  const next = { ...previous };
  for (const control of CONTROL_ORDER) {
    const fp = cal.hid[control];
    if (fp?.reportId === reportId && bytes.length === fp.length) {
      if (matchesFingerprint(fp,reportId,bytes)) next[control]=true;
      else if (fingerprintReleased(fp,reportId,bytes)) next[control]=false;
    }
  }
  return next;
}

export const actions = [
  ['none','No action'],['play','Play / Pause'],['rewind','Rewind'],['forward','Fast Forward'],['previous','Previous'],['next','Next'],['mute','Mute / Unmute'],['talk','Push to Talk'],['scrollUp','Scroll Up'],['scrollDown','Scroll Down'],['enter','Enter'],['space','Space'],['escape','Escape'],['shortcut','Custom Keyboard Shortcut'],['custom','Custom Action'],
] as const;
export type ActionId = typeof actions[number][0];
export interface Shortcut { key: string; code: string; ctrl: boolean; shift: boolean; alt: boolean; meta: boolean; label: string }
export interface Mapping { action: ActionId; seconds: number; shortcut?: Shortcut; custom?: string }
export type Mappings = Record<Control, Mapping>;
export const defaultMappings = (): Mappings => ({ left: { action:'rewind',seconds:5 }, middle: { action:'play',seconds:5 }, right: { action:'forward',seconds:5 }, auxiliary: { action:'none',seconds:5 } });
export const mappingLabel = (m: Mapping): string => m.action === 'rewind' || m.action === 'forward' ? `${m.action === 'rewind' ? 'Rewind' : 'Fast Forward'} ${m.seconds} sec` : m.action === 'shortcut' ? m.shortcut?.label || 'Shortcut not recorded' : m.action === 'custom' ? m.custom || 'Custom action not named' : actions.find(a => a[0] === m.action)?.[1] || 'No action';
export function shortcutFrom(e: Pick<KeyboardEvent,'key'|'code'|'ctrlKey'|'shiftKey'|'altKey'|'metaKey'>): Shortcut {
  const key = e.code === 'Space' ? 'Space' : e.key.length === 1 ? e.key.toUpperCase() : e.key;
  return { key: e.key, code:e.code, ctrl:e.ctrlKey, shift:e.shiftKey, alt:e.altKey, meta:e.metaKey,
    label: [e.ctrlKey ? 'Ctrl' : '',e.metaKey ? 'Command' : '',e.altKey ? 'Alt / Option' : '',e.shiftKey ? 'Shift' : '',key].filter(Boolean).join(' + ') };
}
export const domKeyId = (s: Shortcut) => `key:${s.code}:${Number(s.ctrl)}${Number(s.alt)}${Number(s.shift)}${Number(s.meta)}`;
export const mouseLabel = (button: number) => ['Mouse Left Click','Mouse Middle Click','Mouse Right Click','Mouse Back','Mouse Forward'][button] ?? `Mouse Button ${button}`;

export interface Configuration { version: 1; device: DeviceIdentity | null; modelId: string; pedalCount: number; mappings: Mappings; calibrations: Record<string, Calibration> }
export const defaultConfiguration = (): Configuration => ({ version:1,device:null,modelId:'vec-infinity3',pedalCount:3,mappings:defaultMappings(),calibrations:{} });
const record = (v: unknown): v is Record<string,unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const integer = (v: unknown, min: number, max: number): v is number => Number.isInteger(v) && Number(v) >= min && Number(v) <= max;
const boundedString = (v: unknown, max = 200): v is string => typeof v === 'string' && v.length <= max;
const fail = (): never => { throw new Error('This file is not a valid Treadory version 1 configuration.'); };
export function validateConfiguration(value: unknown): Configuration {
  if (!record(value) || value.version !== 1 || !boundedString(value.modelId,100) || !integer(value.pedalCount,1,4) || !record(value.mappings) || !record(value.calibrations)) return fail();
  let device: DeviceIdentity | null = null;
  if (value.device !== null) { const d = value.device; if (!record(d) || !integer(d.vendorId,0,65535) || !integer(d.productId,0,65535) || !boundedString(d.name)) return fail(); device = { vendorId:d.vendorId,productId:d.productId,name:d.name }; }
  const mappings = defaultMappings();
  for (const control of CONTROL_ORDER) {
    const m = value.mappings[control];
    if (!record(m) || !actions.some(a => a[0] === m.action) || typeof m.seconds !== 'number' || !Number.isFinite(m.seconds) || m.seconds < 0.1 || m.seconds > 120) return fail();
    const safe: Mapping = { action:m.action as ActionId,seconds:m.seconds };
    if (m.custom !== undefined) { if (!boundedString(m.custom,120)) return fail(); safe.custom = m.custom; }
    if (m.shortcut !== undefined) { const s = m.shortcut; if (!record(s) || !boundedString(s.key,80) || !boundedString(s.code,80) || !boundedString(s.label,160) || ['ctrl','alt','shift','meta'].some(k => typeof s[k] !== 'boolean')) return fail(); safe.shortcut = { key:s.key,code:s.code,label:s.label,ctrl:s.ctrl as boolean,alt:s.alt as boolean,shift:s.shift as boolean,meta:s.meta as boolean }; }
    mappings[control] = safe;
  }
  const calibrations: Record<string, Calibration> = {};
  if (Object.keys(value.calibrations).length > 40) return fail();
  for (const [key, item] of Object.entries(value.calibrations)) {
    if (!boundedString(key,300) || ['__proto__','constructor','prototype'].includes(key) || !record(item) || !record(item.hid) || !record(item.dom)) return fail();
    const cal = emptyCalibration();
    for (const control of CONTROL_ORDER) {
      const fp = item.hid[control];
      if (fp !== undefined) {
        if (!record(fp) || !integer(fp.reportId,0,255) || !integer(fp.length,1,512) || !Array.isArray(fp.changes) || !fp.changes.length || fp.changes.length > fp.length) return fail();
        const changes: Fingerprint['changes'] = [];
        for (const change of fp.changes) {
          if (!record(change) || !integer(change.index,0,fp.length-1) || !integer(change.mask,1,255) || !integer(change.baseline,0,255) || !integer(change.pressed,0,255) || (change.baseline & change.mask) !== change.baseline || (change.pressed & change.mask) !== change.pressed || (change.baseline ^ change.pressed) !== change.mask || changes.some(c => c.index === change.index)) return fail();
          changes.push({ index:change.index,mask:change.mask,baseline:change.baseline,pressed:change.pressed });
        }
        const candidate = { reportId:fp.reportId,length:fp.length,changes };
        if (Object.values(cal.hid).some(other=>other.reportId===candidate.reportId && other.length!==candidate.length)) return fail();
        if (Object.values(cal.hid).some(other => conflictFingerprint(candidate, other))) return fail();
        cal.hid[control] = candidate;
      }
      const dom = item.dom[control];
      if (dom !== undefined) {
        if (!record(dom) || !boundedString(dom.id,120) || !boundedString(dom.label,160) || !dom.id.length || (dom.code !== undefined && !boundedString(dom.code,80)) || (dom.mouseButton !== undefined && !integer(dom.mouseButton,0,4)) || Object.values(cal.dom).some(other => other.id === dom.id)) return fail();
        if (dom.mouseButton!==undefined) {
          if (dom.id!==`mouse:${dom.mouseButton}` || dom.code!==undefined) return fail();
        } else {
          const prefix=`key:${dom.code}:`;
          if (!dom.code || !dom.id.startsWith(prefix) || !/^[01]{4}$/.test(dom.id.slice(prefix.length))) return fail();
        }
        cal.dom[control] = { id:dom.id,label:dom.label,...(typeof dom.code === 'string' ? {code:dom.code}:{}),...(typeof dom.mouseButton === 'number' ? {mouseButton:dom.mouseButton}:{}) };
      }
    }
    calibrations[key] = cal;
  }
  return { version:1,device,modelId:value.modelId,pedalCount:value.pedalCount,mappings,calibrations };
}
