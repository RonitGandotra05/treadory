using System.Runtime.InteropServices;
using System.Text.Json;

namespace Treadory;
internal static class SelfTest
{
    internal static int Run()
    {
        var checks = 0;
        void Check(bool value, string name) { if (!value) throw new Exception(name); checks++; }
        void Reject(Action action, string name) { try { action(); } catch { checks++; return; } throw new Exception(name); }
        Engine Learned()
        {
            var e = new Engine(); e.Start(11, 100);
            foreach (var pair in new[] { ("left", 1), ("middle", 4), ("right", 16) })
            { e.Learn(pair.Item1); e.Stroke(11, (ushort)pair.Item2, 0, 0, 0, 0); Check(e.Learning != null, "release is required"); e.Stroke(11, (ushort)(pair.Item2 << 1), 0, 0, 0, 0); }
            return e;
        }
        try
        {
            Check(Engine.Supported("HID\\VID_05F3&PID_00FF&REV_0100"), "known identity");
            Check(!Engine.Supported("HID\\VID_05F3&PID_00FF0"), "PID prefix is not an identity");
            Check(!Engine.Supported("HID\\VID_1234&PID_00FF"), "ordinary mouse excluded");
            var e = Learned();
            e.SetMappings(new() { ["left"] = "scrollUp", ["middle"] = "space", ["right"] = "none" }); e.Enable(true);
            Check(e.Stroke(12, 4, 0, 2, 3, 0) == null && e.Held == 0, "foreign mouse untouched");
            Check(e.Stroke(11, 4, 0, 0, 0, 0)!.SequenceEqual(new[] { "space" }), "middle uses learned right-button source");
            Check(e.Stroke(11, 4, 0, 0, 0, 0)!.Count == 0, "hold/repeat deduplicated");
            Reject(() => e.Learn("left"), "held control cannot be relearned");
            e.Stroke(11, 8, 0, 0, 0, 0);
            Check(e.Stroke(11, 5, 0, 0, 0, 0)!.SequenceEqual(new[] { "scrollUp", "space" }), "simultaneous learned pedals");
            e.Stroke(11, 10, 0, 0, 0, 0); e.Enable(false);
            Check(e.Stroke(11, 4, 0, 0, 0, 0)!.Count == 0 && e.Capturing, "pause keeps originals suppressed"); e.Stroke(11, 8, 0, 0, 0, 0);
            Reject(() => e.SetMappings(new() { ["left"] = "shell", ["middle"] = "space", ["right"] = "none" }), "arbitrary execution rejected");
            Reject(() => e.SetMappings(new() { ["left"] = "none" }), "partial maps rejected");
            Reject(() => e.Stroke(11, 4, 0, 1, 0, 0), "movement endpoint refused");
            Reject(() => e.Stroke(11, 0x400, 0, 0, 0, 120), "wheel endpoint refused");
            Reject(() => e.Stroke(11, 12, 0, 0, 0, 0), "ambiguous packet rejected");
            Check(!e.Expire(5099), "lease remains valid"); e.Ping(5000); Check(!e.Expire(9999), "heartbeat renewal");
            Check(e.Expire(10000) && !e.Enabled && !e.Capturing && e.Learned.Count == 0, "lease loss clears session");
            e.Start(11, 11000); Reject(() => e.Enable(true), "reconnect requires learning");
            e.Learn("left"); e.Stroke(11, 1, 0, 0, 0, 0); e.Stroke(11, 2, 0, 0, 0, 0); e.Learn("middle");
            Reject(() => e.Stroke(11, 1, 0, 0, 0, 0), "overlapping physical control rejected");
            e.Stop(); Check(e.Stroke(11, 4, 0, 0, 0, 0) == null, "stop restores forwarding");
            Reject(() => e.Start(1, 0), "keyboard cannot be captured");
            var f = new Engine(); f.Start(11, 0); f.Learn("left"); Reject(() => f.Stroke(11, 5, 0, 0, 0, 0), "learning chords rejected");
            using var frame = new MemoryStream(Protocol.Encode(new { version = 1, id = 7, type = "state" }));
            using var parsed = Protocol.Read(frame); Check(parsed != null && Protocol.Id(parsed.RootElement) == 7, "framed UTF8 JSON roundtrip");
            Check(Protocol.Read(new MemoryStream()) == null, "clean EOF");
            Reject(() => Protocol.Read(new MemoryStream(new byte[] { 1, 0 })), "truncated header");
            Reject(() => Protocol.Read(new MemoryStream(new byte[] { 0, 0, 0, 0 })), "zero length");
            Reject(() => Protocol.Read(new MemoryStream(new byte[] { 1, 0, 1, 0 })), "oversized frame");
            Reject(() => Protocol.Read(new MemoryStream(new byte[] { 4, 0, 0, 0, 123 })), "partial payload");
            using var invalid = JsonDocument.Parse("{\"version\":1,\"id\":-2}"); Reject(() => Protocol.Id(invalid.RootElement), "invalid request ID");
            Check(Marshal.SizeOf<WindowsBackend.Stroke>() == 20 && Marshal.OffsetOf<WindowsBackend.Stroke>("X").ToInt32() == 8, "Interception ABI");
            Check(Marshal.SizeOf<WindowsSafety.Input>() == (IntPtr.Size == 8 ? 40 : 28), "SendInput ABI");
            if (OperatingSystem.IsWindows())
            {
                Check(WindowsSafety.PedalEndpoints().All(e => e.Kind is "hid" or "mouse"), "Windows read-only endpoint API");
                Check(WindowsSafety.Topology() != null, "Windows inventory API");
            }
            Console.WriteLine($"PASS {checks} helper safety, device isolation, learning, lifecycle, mapping, framing and ABI checks."); return 0;
        }
        catch (Exception error) { Console.Error.WriteLine($"FAIL after {checks} checks: {error.Message}"); return 1; }
    }
}
