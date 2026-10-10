import Foundation
let controls = ["left", "middle", "right"]
let actions = ["none", "scrollUp", "scrollDown", "space", "enter", "f13", "f14", "f15", "f16", "f17", "f18", "f19", "f20"]
func milliseconds() -> Double { ProcessInfo.processInfo.systemUptime * 1000 }
struct Settings: Codable {
    var version = 1
    var mappings = ["left":"none", "middle":"none", "right":"none"]
    var guardScope = "off"
    func validate() throws {
        guard version == 1, Set(mappings.keys) == Set(controls), mappings.values.allSatisfy(actions.contains), ["off","all","right"].contains(guardScope) else { throw Failure.invalid("Invalid settings; no capture started.") }
    }
}
enum Failure: Error { case invalid(String) }
final class Policy {
    var scope = "off", until: Double = 0
    var sequences: [Int:(blocked: Bool, expires: Double)] = [:]
    func clear() { until = 0; sequences.removeAll() }
    func arm(_ now: Double) { if scope != "off" { until = now + 250 } }
    func reject(_ button: Int, down: Bool, now: Double) -> Bool {
        if scope == "off" { return false }
        if let prior = sequences[button], now >= prior.expires { sequences.removeValue(forKey: button) }
        if down {
            if let prior = sequences[button] { return prior.blocked }
            let block = now < until && (scope == "all" || button == 1) // Quartz: right = 1
            sequences[button] = (block, now + 5000); return block
        }
        return sequences.removeValue(forKey: button)?.blocked ?? false
    }
}
final class Decoder {
    var held = 0, neutral = false, learning: String?, candidate = 0
    var learned: [String:Int] = [:]
    func reset() { held = 0; neutral = false; learning = nil; candidate = 0; learned.removeAll() }
    func report(_ bytes: [UInt8]) throws -> [String] {
        guard bytes.count == 2, bytes[0] & 0xf8 == 0 else { throw Failure.invalid("Unsupported HID report. Capture stopped.") }
        let next = Int(bytes[0]), pressed = next & ~held; held = next
        if next == 0 { neutral = true }
        guard neutral else { return [] }
        if let control = learning {
            if candidate == 0 && pressed != 0 {
                guard pressed.nonzeroBitCount == 1, next == pressed, !learned.values.contains(pressed) else { throw Failure.invalid("Learn one distinct pedal at a time.") }
                candidate = pressed
            }
            guard candidate == 0 || next & ~candidate == 0 else { throw Failure.invalid("Overlapping learning inputs.") }
            if candidate != 0 && next == 0 { learned[control] = candidate; learning = nil; candidate = 0 }
            return []
        }
        return controls.filter { (learned[$0] ?? 0) & pressed != 0 }
    }
}
func selfTest() throws {
    func check(_ value: Bool) throws { if !value { throw Failure.invalid("Policy test failed") } }
    let p = Policy(); p.scope = "all"
    for t in [0.0,249,250,251] { p.clear();p.arm(1000);try check(p.reject(0,down:true,now:1000+t) == (t<250));try check(p.reject(0,down:false,now:1600) == (t<250)) }
    for b in 0...4 { p.clear();p.arm(0);try check(p.reject(b,down:true,now:1));try check(p.reject(b,down:false,now:251)) }
    p.clear();try check(!p.reject(0,down:true,now:0));p.arm(1);try check(!p.reject(0,down:false,now:2));try check(!p.reject(2,down:false,now:2))
    p.clear();p.arm(0);p.arm(200);try check(p.reject(0,down:true,now:449));try check(!p.reject(2,down:true,now:450))
    p.clear();p.arm(0);try check(p.reject(0,down:true,now:1));try check(!p.reject(0,down:false,now:5001))
    p.scope="right";p.clear();p.arm(0);try check(!p.reject(0,down:true,now:1));try check(p.reject(1,down:true,now:1))
    let d=Decoder();try check(try d.report([2,0]).isEmpty);_ = try d.report([0,0])
    for (index,c) in controls.enumerated() { d.learning=c;_ = try d.report([UInt8(1<<index),0]);_ = try d.report([0,0]) }
    try check(try d.report([3,0]) == ["left","middle"]);try check(try d.report([3,0]).isEmpty)
    let settings=Settings();try settings.validate();let loaded=try JSONDecoder().decode(Settings.self,from:JSONEncoder().encode(settings));try loaded.validate()
    print("PASS macOS pure policy: boundaries, five buttons, sequences, repeats, neutral, learning, hold and settings. No physical assertions.")
}
