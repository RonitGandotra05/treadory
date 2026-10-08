import type { HidCollection, PedalDevice } from './useFootPedal.js';

export interface ProgrammableDevice extends PedalDevice {
  sendReport(reportId: number, data: Uint8Array): Promise<void>;
}
export const programmingIds = [
  { vendorId: 0x0c45, productId: 0x7403 }, { vendorId: 0x0c45, productId: 0x7404 },
  { vendorId: 0x413d, productId: 0x2107 }, { vendorId: 0x1a86, productId: 0xe026 },
  { vendorId: 0x3553, productId: 0xb001 },
] as const;

type ReportItem = { reportSize: number; reportCount: number };
const reportBits = (items: unknown[] | undefined): number => items?.reduce<number>((n, item) => {
  const i = item as Partial<ReportItem> | null;
  return i && Number.isInteger(i.reportSize) && Number.isInteger(i.reportCount) && i.reportSize! > 0 && i.reportCount! > 0
    ? n + i.reportSize! * i.reportCount! : NaN;
}, 0) ?? NaN;
const matchesReport = (reports: HidCollection['inputReports'], id: number, size: number) =>
  reports.filter(r => r.reportId === id).length === 1 && reports.some(r => r.reportId === id && reportBits(r.items) === size);

export function programmingCompatibility(device: PedalDevice): { supported: boolean; reason: string } {
  if (!programmingIds.some(p => p.vendorId === device.vendorId && p.productId === device.productId))
    return { supported: false, reason: 'This USB identity is not supported by Treadory’s programmer. Use the manufacturer’s tool.' };
  // Some vendors reuse these IDs for thermometers and other equipment.
  if (!/foot[\s_-]*(switch|pedal)/i.test(device.productName))
    return { supported: false, reason: 'The connected device does not identify itself as a foot switch. No programming commands were sent.' };
  const candidates: HidCollection[] = [];
  const walk = (c: HidCollection) => {
    candidates.push(c); (c.children || []).forEach(walk);
  };
  // Only vendor-defined top-level collections. Never keyboard/mouse endpoints.
  device.collections.filter(c => c.usagePage >= 0xff00).forEach(walk);
  const matching = candidates.filter(c =>
    matchesReport(c.outputReports, 1, 56) && matchesReport(c.outputReports, 8, 56) && matchesReport(c.inputReports, 8, 56));
  if (matching.length !== 1 || typeof (device as Partial<ProgrammableDevice>).sendReport !== 'function')
    return { supported: false, reason: 'This firmware exposes a different programming interface. Use ElfKey; Treadory will not guess its commands.' };
  return { supported: true, reason: 'Compatible interface found. Stored settings must also pass the read check before editing.' };
}

export type StoredOutput = readonly number[];
export type DeviceSettings = readonly [StoredOutput, StoredOutput, StoredOutput];
export const sameSettings = (a: DeviceSettings, b: DeviceSettings) => a.every((p, i) => p.every((v, j) => v === b[i][j]));
export function validStoredOutput(bytes: readonly number[]): boolean {
  if (bytes.length !== 8 || bytes.some(v => !Number.isInteger(v) || v < 0 || v > 255) || bytes[0] !== 8) return false;
  const type = bytes[1];
  if (![0, 1, 2, 3, 0x81].includes(type)) return false; // Strings/macros require another protocol.
  if (type === 0) return bytes.slice(2).every(v => v === 0);
  if ([1, 3, 0x81].includes(type) && bytes[3] > 0xe7) return false;
  if ([1, 0x81].includes(type) && bytes.slice(4).some(v => v !== 0)) return false;
  if (type === 2 && (bytes[2] !== 0 || bytes[3] !== 0)) return false;
  return !(bytes[4] & ~7);
}

// Protocol facts independently implemented from rgerganov/footswitch.
// The numbered HID report ID is passed separately, never duplicated in data.
export const queryPacket = (slot: number) => {
  if (!Number.isInteger(slot) || slot < 0 || slot > 2) throw new Error('Invalid pedal slot.');
  return new Uint8Array([0x82, 8, slot + 1, 0, 0, 0, 0]);
};
export function writePackets(settings: DeviceSettings): { reportId: number; data: Uint8Array }[] {
  if (settings.length !== 3 || !settings.every(validStoredOutput)) throw new Error('Unsupported stored output. Use the manufacturer’s tool.');
  return [
    { reportId: 1, data: new Uint8Array([0x80, 8, 0, 0, 0, 0, 0]) },
    ...settings.flatMap((bytes, i) => [
      { reportId: 1, data: new Uint8Array([0x81, 8, i + 1, 0, 0, 0, 0]) },
      { reportId: 8, data: new Uint8Array(bytes.slice(1)) },
    ]),
  ];
}

export const outputOptions = [
  { id: 'space', label: 'Space', usage: 0x2c }, { id: 'enter', label: 'Enter', usage: 0x28 },
  { id: 'escape', label: 'Escape', usage: 0x29 },
  ...Array.from({ length: 12 }, (_, i) => ({ id: `f${i + 1}`, label: `F${i + 1}`, usage: 0x3a + i })),
  ...Array.from({ length: 12 }, (_, i) => ({ id: `f${i + 13}`, label: `F${i + 13}`, usage: 0x68 + i })),
  { id: 'mouse-left', label: 'Mouse Left Click', button: 1 },
  { id: 'mouse-middle', label: 'Mouse Middle Click', button: 4 },
  { id: 'mouse-right', label: 'Mouse Right Click', button: 2 },
  { id: 'none', label: 'No output' },
] as const;
export function encodeOutput(id: string): StoredOutput {
  const option = outputOptions.find(o => o.id === id);
  if (!option) throw new Error('Choose a supported output.');
  return [8, 'usage' in option ? 1 : 'button' in option ? 2 : 0, 0, 'usage' in option ? option.usage : 0, 'button' in option ? option.button : 0, 0, 0, 0];
}
export function outputLabel(bytes: StoredOutput): string {
  const match = outputOptions.find(o => encodeOutput(o.id).every((v, i) => v === bytes[i]));
  if (match) return match.label;
  const key = outputOptions.find(o => 'usage' in o && o.usage === bytes[3]);
  const mouse = ['Left', 'Right', 'Middle'].filter((_, i) => bytes[4] & (1 << i)).join(' + ');
  const parts = [];
  if (bytes[1] & 1) parts.push(`${bytes[2] ? 'Modified ' : ''}${key?.label || `key 0x${bytes[3].toString(16)}`}${bytes[1] === 0x81 ? ' (alternate trigger)' : ''}`);
  if (bytes[1] & 2) parts.push(`Mouse ${mouse || 'movement / wheel'}${bytes.slice(5).some(v => v) ? ' + movement / wheel' : ''}`);
  return parts.join(' + ') || 'No output';
}

function pause(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const abort = () => { clearTimeout(timer); signal.removeEventListener('abort', abort); reject(new Error('Device session ended. Reconnect to read its settings.')); };
    const timer = setTimeout(() => { signal.removeEventListener('abort', abort); resolve(); }, ms);
    signal.addEventListener('abort', abort, { once: true });
    if (signal.aborted) abort();
  });
}

export class PedalProgrammer {
  private abort = new AbortController();
  private busy = false;
  private approved = false;
  constructor(readonly device: ProgrammableDevice, private timeoutMs = 1000, private settleMs = 1000) {
    const check = programmingCompatibility(device);
    if (!check.supported) throw new Error(check.reason);
  }
  cancel() { this.approved = false; this.abort.abort(); }
  private check() {
    if (this.abort.signal.aborted || !this.device.opened) throw new Error('Pedal disconnected. Reconnect and check its settings again.');
  }
  private async send(reportId: number, data: Uint8Array) {
    this.check();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let abort!: () => void;
    try {
      await Promise.race([
        this.device.sendReport(reportId, data),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error('The pedal did not complete the USB request.')), this.timeoutMs);
          abort = () => reject(new Error('Device session ended.'));
          this.abort.signal.addEventListener('abort', abort, { once: true });
          if (this.abort.signal.aborted) abort();
        }),
      ]);
      this.check();
      await pause(30, this.abort.signal);
    } finally { clearTimeout(timer); this.abort.signal.removeEventListener('abort', abort); }
  }
  private async readSlot(slot: number): Promise<StoredOutput> {
    this.check();
    let handler!: (e: Event) => void;
    let stop!: () => void;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const response = new Promise<StoredOutput>((resolve, reject) => {
      handler = event => {
        const e = event as Event & { device: PedalDevice; reportId: number; data: DataView };
        if (e.device !== this.device || e.reportId !== 8) return;
        const bytes = [8, ...new Uint8Array(e.data.buffer, e.data.byteOffset, e.data.byteLength)];
        if (!validStoredOutput(bytes)) reject(new Error('The pedal returned a macro or an unsupported settings format. Use ElfKey.'));
        else resolve(Object.freeze(bytes));
      };
      timer = setTimeout(() => reject(new Error('No settings reply from this firmware. Close other pedal software, reconnect, or use ElfKey.')), this.timeoutMs);
      stop = () => reject(new Error('Pedal disconnected while reading settings.'));
      this.device.addEventListener('inputreport', handler);
      this.abort.signal.addEventListener('abort', stop, { once: true });
    });
    // Attach a rejection handler immediately, including synchronous send failures.
    void response.catch(() => {});
    try { await this.send(1, queryPacket(slot)); return await response; }
    finally { clearTimeout(timer); this.device.removeEventListener('inputreport', handler); this.abort.signal.removeEventListener('abort', stop); }
  }
  private async readAll(): Promise<DeviceSettings> {
    const result: StoredOutput[] = [];
    for (let slot = 0; slot < 3; slot++) {
      const first = await this.readSlot(slot);
      const second = await this.readSlot(slot);
      if (!first.every((v, i) => v === second[i])) throw new Error('Stored settings changed during the check. Close other pedal software and reconnect.');
      result.push(first);
    }
    return Object.freeze(result) as unknown as DeviceSettings;
  }
  async inspect(): Promise<DeviceSettings> {
    if (this.busy) throw new Error('A device check is already running.');
    this.busy = true; this.approved = false;
    try { const settings = await this.readAll(); this.approved = true; return settings; }
    catch (e) { this.cancel(); throw e; }
    finally { this.busy = false; }
  }
  async apply(expected: DeviceSettings, desired: DeviceSettings): Promise<DeviceSettings> {
    if (this.busy || !this.approved) throw new Error('Read the connected pedal’s settings before saving.');
    // Validate and freeze copies before any asynchronous work or device write.
    const target = desired.map(p => Object.freeze([...p])) as unknown as DeviceSettings;
    const before = expected.map(p => Object.freeze([...p])) as unknown as DeviceSettings;
    writePackets(before); const packets = writePackets(target);
    if (sameSettings(before, target)) return before;
    this.busy = true;
    let started = false;
    try {
      if (!sameSettings(before, await this.readAll())) throw new Error('The pedal’s settings changed after you reviewed them. Reconnect and review again.');
      for (let i = 0; i < packets.length; i++) {
        started = true;
        await this.send(packets[i].reportId, packets[i].data);
        if (i === 0) await pause(this.settleMs, this.abort.signal);
      }
      await pause(100, this.abort.signal);
      const verified = await this.readAll();
      if (!sameSettings(target, verified)) throw new Error('Read-back did not match the requested outputs.');
      return verified;
    } catch (e) {
      this.cancel();
      const reason = e instanceof Error ? e.message : 'USB operation failed.';
      throw new Error(started ? `The save could not be verified; some outputs may have changed. ${reason} Reconnect and check every pedal, or restore your outputs with ElfKey using the backup.` : reason);
    } finally { this.busy = false; }
  }
}
