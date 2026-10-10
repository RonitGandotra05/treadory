import AppKit
import IOKit.hid
import ApplicationServices
final class Backend {
    private let lock=NSLock()
    private var commands: [() -> Void] = []
    private var heartbeat=milliseconds(), closing=false
    private var manager: IOHIDManager!, device: IOHIDDevice?, tap: CFMachPort?, tapSource: CFRunLoopSource?
    private var identity: UInt64=0, selected: IOHIDDevice?
    private let buffer=UnsafeMutablePointer<UInt8>.allocate(capacity:64)
    let decoder=Decoder(), policy=Policy()
    var settings=Settings(), active=false, captured=false
    var update: ((String,Bool,Bool,[String])->Void)?
    func send(_ work: @escaping () -> Void) { lock.lock();commands.append(work);lock.unlock() }
    func ping() { lock.lock();heartbeat=milliseconds();lock.unlock() }
    func close() { send { self.stop("Stopped.") };lock.lock();closing=true;lock.unlock() }
    func launch() {
        Thread.detachNewThread {
            self.manager=IOHIDManagerCreate(kCFAllocatorDefault,IOOptionBits(kIOHIDOptionsTypeNone))
            IOHIDManagerSetDeviceMatching(self.manager,[kIOHIDVendorIDKey:0x05f3,kIOHIDProductIDKey:0x00ff] as CFDictionary)
            IOHIDManagerScheduleWithRunLoop(self.manager,CFRunLoopGetCurrent(),CFRunLoopMode.defaultMode.rawValue)
            while true {
                self.lock.lock();let work=self.commands;self.commands.removeAll();let expired=milliseconds()-self.heartbeat>5000,done=self.closing;self.lock.unlock()
                for command in work { command() }
                if done { break }
                if self.captured && expired { self.stop("Settings window heartbeat lost. Capture stopped.") }
                if self.captured && (!CGPreflightListenEventAccess() || (self.active && !AXIsProcessTrusted()) || self.registry(self.device!) != self.identity || self.devices().map(self.registry) != [self.identity]) { self.stop("Device or input permission changed. Inspect again.") }
                if self.captured && CGEventSource.keyState(.combinedSessionState,key:111) && CGEventSource.flagsState(.combinedSessionState).intersection([.maskControl,.maskAlternate,.maskShift]) == [.maskControl,.maskAlternate,.maskShift] { self.stop("Recovery chord pressed.") }
                CFRunLoopRunInMode(.defaultMode,0.02,true)
            }
            self.stop("Closed.");IOHIDManagerClose(self.manager,0)
            IOHIDManagerUnscheduleFromRunLoop(self.manager,CFRunLoopGetCurrent(),CFRunLoopMode.defaultMode.rawValue)
            self.buffer.deallocate()
        }
    }
    private func devices() -> [IOHIDDevice] { (IOHIDManagerCopyDevices(manager) as? Set<IOHIDDevice>).map(Array.init) ?? [] }
    private func registry(_ d: IOHIDDevice) -> UInt64 { var id: UInt64=0;IORegistryEntryGetRegistryEntryID(IOHIDDeviceGetService(d),&id);return id }
    private func publish(_ text: String) { let capture=captured,enabled=active,learned=Array(decoder.learned.keys);DispatchQueue.main.async { self.update?(text,capture,enabled,learned) } }
    func configure(_ value: Settings) { guard !active else { publish("Pause actions before configuration.");return };do { try value.validate();settings=value } catch { publish("Invalid configuration.") } }
    func inspect() {
        guard !captured else { return }
        selected=nil
        guard CGPreflightListenEventAccess() else { publish("Grant Input Monitoring using Permissions, then inspect again.");return }
        let list=devices()
        guard list.count == 1,let d=list.first else { publish("Found \(list.count) matching VEC HID services. Exactly one is required; composite or identical devices are not eligible.");return }
        guard (IOHIDDeviceGetProperty(d,kIOHIDTransportKey as CFString) as? String)=="USB",let size=IOHIDDeviceGetProperty(d,kIOHIDMaxInputReportSizeKey as CFString) as? NSNumber, size.intValue == 2 else { publish("VEC device found, but its report format is unsupported. No capture available.");return }
        selected=d;identity=registry(d)
        let name=IOHIDDeviceGetProperty(d,kIOHIDProductKey as CFString) as? String ?? "VEC HID pedal"
        publish("\(name) · 05f3:00ff · two-byte candidate protocol · registry \(identity). Physical compatibility unverified.")
    }
    func start(reviewed: Bool) {
        guard !captured,reviewed,let d=selected,devices().count == 1,registry(d)==identity,CGPreflightListenEventAccess() else { publish("Inspect one eligible pedal and review recovery first.");return }
        guard (0...4).allSatisfy({ !CGEventSource.buttonState(.combinedSessionState,button:CGMouseButton(rawValue:UInt32($0))!) }) else { publish("Release all mouse buttons and pedals before capture.");return }
        guard IOHIDDeviceOpen(d,IOOptionBits(kIOHIDOptionsTypeSeizeDevice)) == kIOReturnSuccess else { publish("Exclusive HID access refused. Quit other readers; check permissions. No capture started.");return }
        device=d;captured=true;active=false;decoder.reset()
        IOHIDDeviceRegisterInputReportCallback(d,buffer,64,{ context,result,_,_,reportID,report,length in
            guard let context else { return };let owner=Unmanaged<Backend>.fromOpaque(context).takeUnretainedValue()
            guard result == kIOReturnSuccess,reportID == 0,length == 2 else { owner.stop("Unsupported report or input failure.");return }
            owner.report(Array(UnsafeBufferPointer(start:report,count:length)))
        },Unmanaged.passUnretained(self).toOpaque())
        IOHIDDeviceScheduleWithRunLoop(d,CFRunLoopGetCurrent(),CFRunLoopMode.defaultMode.rawValue)
        publish("Isolated test started. Release pedals to establish neutral, then learn each pedal. Verify originals and ordinary mouse in another app.")
    }
    private func report(_ bytes: [UInt8]) {
        guard captured else { return };let detected=milliseconds()
        do {
            let pressed=try decoder.report(bytes)
            if active && !pressed.isEmpty { policy.arm(detected);for c in pressed { try act(settings.mappings[c]!) } }
            if !active { publish("Isolated / paused · learned: \(decoder.learned.keys.sorted().joined(separator:", ")) · held: \(decoder.held)") }
        } catch { stop("Input or action validation failed. Capture stopped.") }
    }
    func learn(_ control: String) {
        guard captured,!active,decoder.held == 0,controls.contains(control) else { publish("Pause and release pedals before learning.");return }
        decoder.learned.removeValue(forKey:control);decoder.learning=control;decoder.candidate=0;publish("Press and release only the \(control) pedal.")
    }
    func activate(verified: Bool) {
        guard !active,captured,verified,decoder.learned.count==3,decoder.learning==nil,decoder.held==0,AXIsProcessTrusted(),CGPreflightPostEventAccess() else { publish("Learn/release all three pedals, verify outputs and mouse, and grant Accessibility before activation.");return }
        policy.scope=settings.guardScope;policy.clear()
        if policy.scope != "off" {
            let types: [CGEventType]=[.leftMouseDown,.leftMouseUp,.rightMouseDown,.rightMouseUp,.otherMouseDown,.otherMouseUp]
            let mask=types.reduce(CGEventMask(0)) { $0 | (CGEventMask(1)<<$1.rawValue) }
            tap=CGEvent.tapCreate(tap:.cgSessionEventTap,place:.headInsertEventTap,options:.defaultTap,eventsOfInterest:mask,callback:{ _,type,event,context in
                guard let context else { return Unmanaged.passUnretained(event) };let owner=Unmanaged<Backend>.fromOpaque(context).takeUnretainedValue()
                if type == .tapDisabledByTimeout || type == .tapDisabledByUserInput { owner.stop("Mouse tap disabled; capture stopped. Inspect again.");return Unmanaged.passUnretained(event) }
                if event.getIntegerValueField(.eventSourceUserData)==0x54524459 { return Unmanaged.passUnretained(event) }
                let button=Int(event.getIntegerValueField(.mouseEventButtonNumber)),down=[CGEventType.leftMouseDown,.rightMouseDown,.otherMouseDown].contains(type)
                return owner.policy.reject(button,down:down,now:milliseconds()) ? nil : Unmanaged.passUnretained(event)
            },userInfo:Unmanaged.passUnretained(self).toOpaque())
            guard let tap else { stop("Mouse event tap refused. Guard not available; capture stopped.");return }
            tapSource=CFMachPortCreateRunLoopSource(kCFAllocatorDefault,tap,0);CFRunLoopAddSource(CFRunLoopGetCurrent(),tapSource,.defaultMode);CGEvent.tapEnable(tap:tap,enable:true)
        }
        active=true;publish("Actions active in the focused app. Guard: \(settings.guardScope). Keep Treadory open.")
    }
    func pause() { active=false;clearTap();publish("Actions paused; original pedal reports remain seized. Stop restores input.") }
    private func clearTap() { policy.clear();if let tap { CGEvent.tapEnable(tap:tap,enable:false);CFMachPortInvalidate(tap) };if let tapSource { CFRunLoopRemoveSource(CFRunLoopGetCurrent(),tapSource,.defaultMode) };tap=nil;tapSource=nil }
    func stop(_ reason: String) {
        active=false;clearTap()
        if let device { IOHIDDeviceRegisterInputReportCallback(device,buffer,64,nil,nil);IOHIDDeviceUnscheduleFromRunLoop(device,CFRunLoopGetCurrent(),CFRunLoopMode.defaultMode.rawValue);IOHIDDeviceClose(device,0) }
        captured=false;device=nil;selected=nil;identity=0;decoder.reset();publish(reason)
    }
    private func act(_ action: String) throws {
        if action == "none" { return }
        guard AXIsProcessTrusted(),CGPreflightPostEventAccess() else { throw Failure.invalid("Accessibility lost") }
        if action == "scrollUp" || action == "scrollDown" {
            guard let event=CGEvent(scrollWheelEvent2Source:nil,units:.line,wheelCount:1,wheel1:action=="scrollUp" ? 3 : -3,wheel2:0,wheel3:0) else { throw Failure.invalid("Scroll failed") }
            event.setIntegerValueField(.eventSourceUserData,value:0x54524459);event.post(tap:.cgSessionEventTap);return
        }
        let keys: [String:CGKeyCode]=["space":49,"enter":36,"f13":105,"f14":107,"f15":113,"f16":106,"f17":64,"f18":79,"f19":80,"f20":90]
        guard let key=keys[action],!CGEventSource.keyState(.combinedSessionState,key:key),let down=CGEvent(keyboardEventSource:nil,virtualKey:key,keyDown:true),let up=CGEvent(keyboardEventSource:nil,virtualKey:key,keyDown:false) else { throw Failure.invalid("Key held or unsupported") }
        down.setIntegerValueField(.eventSourceUserData,value:0x54524459);up.setIntegerValueField(.eventSourceUserData,value:0x54524459);down.post(tap:.cgSessionEventTap);up.post(tap:.cgSessionEventTap)
    }
}
