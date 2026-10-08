import { decodeInfinity, type DeviceIdentity, type PedalState } from './core.js';

export interface InputCollection { usagePage:number; usage:number; inputReports:{reportId:number}[]; children?:InputCollection[] }
export interface DeviceProfile {
  vendorId:number; productIds:readonly number[]; label:string; modelId:string;
  usagePage?:number; usage?:number;
  decode(reportId:number,bytes:number[]):PedalState|null;
}
export const deviceProfiles:readonly DeviceProfile[] = [
  { vendorId:0x05f3,productIds:[0x00ff],label:'VEC Infinity USB family',modelId:'vec-infinity3',
    decode:(id,bytes)=>id===0 && bytes.length===2 && !(bytes[0]&~7) ? decodeInfinity(bytes) : null },
  // SDK buffers include a leading report-ID byte. WebHID data excludes it:
  // native index 3 (pedals) becomes payload index 2. Timestamps are ignored.
  // Only PID modes with the Consumer-page raw input endpoint are included.
  { vendorId:0x05f3,productIds:[0x0438,0x043a,0x042c,0x042e],label:'X-keys XK-3 raw input',modelId:'xkeys3',usagePage:0x0c,usage:1,
    decode:(id,bytes)=>id===0 && bytes.length===32 && bytes[1]<=3 && !(bytes[2]&~14) ? decodeInfinity([bytes[2]>>1]) : null },
];
export function findDeviceProfile(identity:DeviceIdentity,collections:readonly InputCollection[]):DeviceProfile|undefined {
  const profile=deviceProfiles.find(p=>p.vendorId===identity.vendorId && p.productIds.includes(identity.productId));
  if (!profile) return;
  const hasReport=(items:readonly InputCollection[]):boolean=>items.some(c=>c.inputReports.some(r=>r.reportId===0) || hasReport(c.children??[]));
  const hasInput=(items:readonly InputCollection[]):boolean=>items.some(c=>
    (profile.usagePage===undefined || c.usagePage===profile.usagePage && c.usage===profile.usage) && hasReport([c]) || hasInput(c.children??[]));
  return hasInput(collections) ? profile : undefined;
}
export interface PedalModel { id:string; brand:string; label:string; count:1|2|3|4; route:'hid'|'standard'|'either'; note:string; url?:string }
export const models: PedalModel[] = [
  {id:'vec-infinity3',brand:'VEC',label:'Infinity 3 · IN-USB-3',count:3,route:'hid',note:'Known Infinity decoder · identity checked on connection.',url:'https://www.veccorp.com/foot-controls.html'},
  {id:'vec-single',brand:'VEC',label:'INS-USB · Single',count:1,route:'either',note:'USB foot control · learn its input before mapping.',url:'https://www.veccorp.com/foot-controls.html'},
  {id:'vec-dual',brand:'VEC',label:'IND-USB · Double',count:2,route:'either',note:'USB foot control · learn its input before mapping.',url:'https://www.veccorp.com/foot-controls.html'},
  {id:'philips2310',brand:'Philips',label:'ACC2310 · 3 pedals',count:3,route:'either',note:'Transcription control · generic raw HID calibration if accessible.',url:'https://www.dictation.philips.com/us/products/transcription-accessories/foot-control-acc2300/'},
  {id:'philips2320',brand:'Philips',label:'ACC2320 · 3 pedals',count:3,route:'either',note:'Transcription control · generic raw HID calibration if accessible.',url:'https://www.dictation.philips.com/us/products/transcription-accessories/foot-control-acc2300/'},
  {id:'philips2330',brand:'Philips',label:'ACC2330 · 4 pedals',count:4,route:'either',note:'Includes an auxiliary control. Calibrate all four inputs.',url:'https://www.dictation.philips.com/us/products/transcription-accessories/foot-control-acc2300/'},
  {id:'olympus28',brand:'OM SYSTEM / Olympus',label:'RS28H · 3 pedals',count:3,route:'either',note:'Keyboard mode needs desktop software for device-specific monitoring; try raw HID if exposed.',url:'https://audiosupport.omsystem.com/en/product/rs28h-usb-foot-switch-with-3-pedals/'},
  {id:'olympus31',brand:'OM SYSTEM / Olympus',label:'RS31H · 4 pedals',count:4,route:'either',note:'Use readable raw HID to learn all controls; keyboard mode needs a desktop bridge.',url:'https://my.omsystem.com/consumer/manuals/audio/RS31H_MANUAL_MULTI.pdf'},
  {id:'pcsensor-single',brand:'PCsensor',label:'FS221 · Single',count:1,route:'standard',note:'Keyboard / mouse emulation. Test the function set in ElfKey.',url:'https://pcsensor.com/'},
  {id:'pcsensor-dual',brand:'PCsensor',label:'FS2016 · Double',count:2,route:'standard',note:'Keyboard / mouse emulation. Test the function set in ElfKey.',url:'https://pcsensor.com/'},
  {id:'pcsensor-triple',brand:'PCsensor',label:'FS2020 / FS23 · Triple',count:3,route:'standard',note:'Keyboard / mouse emulation. Learn what each pedal sends.',url:'https://pcsensor.com/'},
  {id:'xkeys3',brand:'X-keys',label:'XK-3 · 3 pedals',count:3,route:'either',note:'USB HID control. Use keyboard mode or learn accessible raw reports.',url:'https://xkeys.com/media/wysiwyg/smartwave/porto/category/spec%20sheets/XK-3%20spec%20sheet.pdf'},
  {id:'airturn-duo',brand:'AirTurn',label:'DUO 500 · Bluetooth / 2 pedals',count:2,route:'standard',note:'Configure with AirTurn Manager. Device-specific browser monitoring is unavailable for keyboard-only Bluetooth input; MIDI is not supported.',url:'https://www.airturn.com/products/airturn-duo-500'},
  {id:'generic',brand:'Other',label:'Other / unknown pedal',count:3,route:'either',note:'Choose the number of controls, then learn their inputs. Analog, MIDI and gamepad pedals are not supported.'},
];
export const brands = [...new Set(models.map(m => m.brand))];
