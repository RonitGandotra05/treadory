import AppKit
import ApplicationServices
if CommandLine.arguments.contains("--self-test") { do { try selfTest();exit(0) } catch { print(error);exit(1) } }
final class ContentStack: NSStackView { override var isFlipped: Bool { true } }
func actionTitle(_ value: String) -> String { ["none":"No action","scrollUp":"Scroll up","scrollDown":"Scroll down","space":"Space (application shortcut)","enter":"Enter" ][value] ?? value.uppercased() }
final class App: NSObject,NSApplicationDelegate {
    let backend=Backend()
    var window: NSWindow!,status=NSTextField(wrappingLabelWithString:"Inspect your pedal to begin. No input is captured.")
    var menus: [NSPopUpButton]=[],scope=NSPopUpButton(),review=NSButton(checkboxWithTitle:"I reviewed recovery and understand exclusive pedal capture.",target:nil,action:nil),verified=NSButton(checkboxWithTitle:"I verified original outputs are absent and my ordinary mouse works.",target:nil,action:nil)
    var timer: Timer?,capture=false,activated=false,observers: [NSObjectProtocol]=[]
    let file=FileManager.default.urls(for:.applicationSupportDirectory,in:.userDomainMask)[0].appendingPathComponent("Treadory/settings.json")
    var settings=Settings(),buttons: [String:NSButton]=[:]
    func applicationDidFinishLaunching(_ notification: Notification) {
        NSApp.appearance=NSAppearance(named:.aqua)
        if let data=try? Data(contentsOf:file),data.count <= 8192,let loaded=try? JSONDecoder().decode(Settings.self,from:data),(try? loaded.validate()) != nil { settings=loaded }
        window=NSWindow(contentRect:NSRect(x:0,y:0,width:800,height:820),styleMask:[.titled,.closable,.miniaturizable,.resizable],backing:.buffered,defer:false);window.title="Treadory · macOS developer preview";window.minSize=NSSize(width:720,height:500);window.center()
        window.backgroundColor=NSColor(calibratedRed:0.94,green:0.93,blue:0.91,alpha:1)
        let scroll=NSScrollView();scroll.drawsBackground=true;scroll.backgroundColor=NSColor(calibratedRed:0.98,green:0.98,blue:0.96,alpha:1);scroll.hasVerticalScroller=true;scroll.translatesAutoresizingMaskIntoConstraints=false;window.contentView!.addSubview(scroll)
        NSLayoutConstraint.activate([scroll.leadingAnchor.constraint(equalTo:window.contentView!.leadingAnchor),scroll.trailingAnchor.constraint(equalTo:window.contentView!.trailingAnchor),scroll.topAnchor.constraint(equalTo:window.contentView!.topAnchor),scroll.bottomAnchor.constraint(equalTo:window.contentView!.bottomAnchor)])
        let stack=ContentStack();stack.orientation = .vertical;stack.alignment = .leading;stack.spacing=16;stack.edgeInsets=NSEdgeInsets(top:24,left:24,bottom:24,right:24);stack.translatesAutoresizingMaskIntoConstraints=false;scroll.documentView=stack
        NSLayoutConstraint.activate([stack.widthAnchor.constraint(equalTo:scroll.contentView.widthAnchor)])
        func text(_ value: String,_ size: CGFloat=13) { let label=NSTextField(wrappingLabelWithString:value);label.font=NSFont.systemFont(ofSize:size);label.textColor=NSColor(calibratedRed:0.2,green:0.22,blue:0.19,alpha:1);stack.addArrangedSubview(label);label.widthAnchor.constraint(lessThanOrEqualTo:stack.widthAnchor,constant:-48).isActive=true;if size==11 { label.textColor=NSColor(calibratedRed:0.78,green:0.28,blue:0.04,alpha:1) } }
        func button(_ name: String,_ action: Selector) { let b=NSButton(title:name,target:self,action:action);b.bezelStyle = .rounded;b.contentTintColor=NSColor(calibratedRed:0.78,green:0.28,blue:0.04,alpha:1);if ["Start isolated test","Activate actions"].contains(name) { b.bezelColor=NSColor(calibratedRed:0.78,green:0.28,blue:0.04,alpha:1);b.contentTintColor = .white };stack.addArrangedSubview(b);buttons[name]=b }
        text("Your pedal. Across your computer.",27);text("MACOS · ARM64 · DEVELOPER PREVIEW",11)
        text("Independent of Chrome. Only one VEC 05f3:00ff HID service with the candidate two-byte report format is eligible. Physical compatibility is unverified. Quit other pedal readers first.")
        button("Permissions",#selector(permissions));button("Inspect pedal",#selector(inspect));stack.addArrangedSubview(status);status.widthAnchor.constraint(lessThanOrEqualTo:stack.widthAnchor,constant:-48).isActive=true
        stack.addArrangedSubview(review);button("Start isolated test",#selector(start))
        text("Learn each physical pedal by a complete press and release. Original outputs remain seized during learning and pause.")
        for (i,c) in controls.enumerated() { text(c.capitalized,15);let menu=NSPopUpButton();menu.addItems(withTitles:actions.map(actionTitle));menu.selectItem(at:actions.firstIndex(of:settings.mappings[c]!)!);stack.addArrangedSubview(menu);menus.append(menu);let b=NSButton(title:"Learn \(c)",target:self,action:#selector(learn(_:)));b.tag=i;stack.addArrangedSubview(b);buttons["Learn \(c)"]=b }
        text("Optional 250 ms click guard");scope.addItems(withTitles:["Off (default)","All mouse buttons: left, middle, right & additional","Right-click only"]);scope.selectItem(at:["off","all","right"].firstIndex(of:settings.guardScope)!);stack.addArrangedSubview(scope)
        text("Starts at decoded pedal detection. Ordinary mouse clicks can also be blocked. Movement and wheel remain available. Existing drags can finish. A canceled down keeps its up canceled for up to 5 seconds. Events before detection/tap activation cannot be undone.")
        button("Save actions & guard",#selector(save));stack.addArrangedSubview(verified);button("Activate actions",#selector(activate));button("Pause actions",#selector(pause));button("Stop capture",#selector(stop))
        text("Recovery: Control + Option + Shift + F12, Stop capture, or quit. A five-second UI heartbeat loss stops capture. Lock/session and sleep notifications stop capture. Never automatically reconnect or activate. Permission changes require inspection again.")
        text("Space/Enter/F13–F20 are application shortcuts; assign them in your player for play/pause or seeking. There is no universal rewind or media integration. Scroll uses Quartz line events; targeting follows OS scroll/focus behavior.")
        text("Settings stay in ~/Library/Application Support/Treadory/settings.json. No telemetry, network listener, shell mappings or global input history. Created by Ronit Gandotra.")
        button("Setup & recovery guide",#selector(guide))
        backend.update={ [weak self] message,captured,active,_ in guard let self else { return };self.status.stringValue=message;self.capture=captured;self.activated=active;self.menus.forEach { $0.isEnabled = !active };self.scope.isEnabled = !active
            for (name,b) in self.buttons { b.isEnabled = name.hasPrefix("Learn") ? captured && !active : name=="Activate actions" ? captured && !active : name=="Pause actions" ? active : name=="Stop capture" ? captured : ["Start isolated test","Inspect pedal"].contains(name) ? !captured : name=="Save actions & guard" ? !active : true }
            if !captured { self.verified.state = .off }
        }
        backend.send { self.backend.configure(self.settings) };backend.launch()
        for name in [NSWorkspace.willSleepNotification,NSWorkspace.sessionDidResignActiveNotification,NSWorkspace.screensDidSleepNotification] { observers.append(NSWorkspace.shared.notificationCenter.addObserver(forName:name,object:nil,queue:nil) { _ in self.backend.send { self.backend.stop("Session or sleep changed. Inspect again.") } }) }
        timer=Timer.scheduledTimer(withTimeInterval:1,repeats:true) { _ in self.backend.ping() }
        for name in ["Activate actions","Pause actions","Stop capture","Learn left","Learn middle","Learn right"] { buttons[name]?.isEnabled=false }
        window.makeKeyAndOrderFront(nil);NSApp.activate(ignoringOtherApps:true)
        if CommandLine.arguments.contains("--ui-test") { DispatchQueue.main.asyncAfter(deadline:.now()+0.5) { if let path=ProcessInfo.processInfo.environment["TREADORY_MAC_UI_SCREENSHOT"],let view=self.window.contentView,let bitmap=view.bitmapImageRepForCachingDisplay(in:view.bounds) { view.cacheDisplay(in:view.bounds,to:bitmap);if let data=bitmap.representation(using:.png,properties:[:]) { try? data.write(to:URL(fileURLWithPath:path)) } }
            print("PASS macOS GUI startup; capture inactive.");NSApp.terminate(nil) } }
    }
    @objc func permissions() { _=CGRequestListenEventAccess();let options=[kAXTrustedCheckOptionPrompt.takeUnretainedValue() as String:true] as CFDictionary;_=AXIsProcessTrustedWithOptions(options) }
    @objc func inspect() { backend.send { self.backend.inspect() } }
    @objc func start() { let reviewed=review.state == .on;verified.state = .off;backend.send { self.backend.start(reviewed:reviewed) } }
    @objc func learn(_ button: NSButton) { backend.send { self.backend.learn(controls[button.tag]) } }
    @objc func activate() { let ok=verified.state == .on;backend.send { self.backend.activate(verified:ok) } }
    @objc func pause() { backend.send { self.backend.pause() } }
    @objc func stop() { backend.send { self.backend.stop("Capture stopped. Original input restored.") } }
    @objc func save() {
        guard !activated else { return };verified.state = .off;var next=Settings();next.mappings=Dictionary(uniqueKeysWithValues:controls.enumerated().map { ($0.element,actions[menus[$0.offset].indexOfSelectedItem]) });next.guardScope=["off","all","right"][scope.indexOfSelectedItem]
        do { try next.validate();try FileManager.default.createDirectory(at:file.deletingLastPathComponent(),withIntermediateDirectories:true);try JSONEncoder().encode(next).write(to:file,options:.atomic);settings=next;backend.send { self.backend.configure(next) };status.stringValue="Saved locally. Activation remains explicit." } catch { status.stringValue="Settings could not be saved. No activation requested." }
    }
    @objc func guide() { if let url=Bundle.main.url(forResource:"README",withExtension:"md") { NSWorkspace.shared.open(url) } }
    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool { true }
    func applicationWillTerminate(_ notification: Notification) { timer?.invalidate();backend.close();Thread.sleep(forTimeInterval:0.1) }
}
let app=NSApplication.shared;let delegate=App();app.delegate=delegate;app.setActivationPolicy(.regular);app.run()
