using System.Collections.Concurrent;
using System.Text.Json;

namespace Treadory;
internal static class Program
{
    internal static int Main(string[] args)
    {
        if (args.SequenceEqual(new[] { "--self-test" })) return SelfTest.Run();
        if (!OperatingSystem.IsWindows()) { Console.Error.WriteLine("The native backend requires Windows. Use --self-test for portable safety tests."); return 1; }
        // Chrome/Edge pass the authorized extension origin as the first argument.
        try
        {
            var installed = File.ReadAllText(Path.Combine(AppContext.BaseDirectory, "allowed-origin.txt")).Trim();
            if (!System.Text.RegularExpressions.Regex.IsMatch(installed, @"^chrome-extension://[a-p]{32}/$") || args.Length < 1 || args[0] != installed) throw new InvalidDataException("Unauthorized extension origin.");
            return Serve();
        }
        catch { Console.Error.WriteLine("Treadory helper could not start. Check its local installation and authorized extension ID."); return 1; }
    }
    private static int Serve()
    {
        var incoming = new ConcurrentQueue<JsonDocument>();
        using var outgoing = new BlockingCollection<byte[]>(64);
        var ended = 0;
        // Output never blocks the device/lease loop. A stalled receiver fills this
        // bounded queue, then triggers cleanup rather than freezing interception.
        var output = new Thread(() => { try { using var stream = Console.OpenStandardOutput(); foreach (var bytes in outgoing.GetConsumingEnumerable()) { stream.Write(bytes); stream.Flush(); } } catch { Interlocked.Exchange(ref ended, 1); } }) { IsBackground = true };
        var input = new Thread(() => { try { using var stream = Console.OpenStandardInput(); while (true) { var message = Protocol.Read(stream); if (message == null) break; if (incoming.Count >= 64) { message.Dispose(); break; } incoming.Enqueue(message); } } catch { } finally { Interlocked.Exchange(ref ended, 1); } }) { IsBackground = true };
        input.Start(); output.Start();
        var engine = new Engine(); WindowsBackend? backend = null;
        var tokens = new Dictionary<string, int>(); string capturedId = "", topology = ""; long lastCheck = 0;
        void Emit(object message) { if (!outgoing.TryAdd(Protocol.Encode(message))) throw new IOException("Native messaging receiver stalled."); }
        object State() => new { capturing = engine.Capturing, enabled = engine.Enabled, learning = engine.Learning, learned = Engine.Controls.Where(c => engine.Learned.ContainsKey(c)).ToArray(), held = engine.Held, presses = engine.Presses, computerWide = true, preview = true };
        void Stop(string reason) { backend?.Release(); engine.Stop(); tokens.Clear(); Emit(new { @event = "stopped", reason, state = State() }); }
        bool IdentityValid() => backend != null && backend.HardwareId(engine.Device) == capturedId && backend.Candidates().Count == 1 && WindowsSafety.Topology() == topology;
        try
        {
            while (Volatile.Read(ref ended) == 0)
            {
                var now = Environment.TickCount64;
                if (engine.Capturing && (now - lastCheck >= 100 || WindowsSafety.EscapePressed()))
                {
                    lastCheck = now;
                    if (WindowsSafety.EscapePressed() || !WindowsSafety.DesktopAvailable() || !IdentityValid()) Stop("Device, desktop or recovery state changed. Select and learn again.");
                }
                if (engine.Expire(now)) { backend?.Release(); tokens.Clear(); Emit(new { @event = "stopped", reason = "Browser heartbeat expired. Original pedal input restored.", state = State() }); }
                // Bound processing so command floods cannot starve the lease loop.
                for (var commands = 0; commands < 8 && incoming.TryDequeue(out var document); commands++)
                {
                    using (document)
                    {
                        var id = 0;
                        try
                        {
                            var m = document.RootElement; id = Protocol.Id(m); var type = m.GetProperty("type").GetString();
                            switch (type)
                            {
                                case "list":
                                    if (engine.Capturing) throw new InvalidOperationException("Stop capture before listing devices.");
                                    tokens.Clear(); var endpoints = WindowsSafety.PedalEndpoints();
                                    // Establish the OS endpoint type before asking for a driver.
                                    if (!endpoints.Any(e => e.Kind == "mouse"))
                                    {
                                        Emit(new { id, ok = true, devices = Array.Empty<object>(), diagnosis = endpoints.Count == 0 ? "No VEC 05f3:00ff raw-input endpoint found. Check its actual device identity and USB connection." : "VEC raw HID input is present, but Windows exposes no matching mouse endpoint. This backend cannot attribute the right-click to that pedal. Check conflicting utility mappings; installing a mouse filter is not an established fix.", endpoints = endpoints.Select(e => new { kind = e.Kind, usagePage = e.UsagePage, usage = e.Usage }).ToArray(), state = State() }); continue;
                                    }
                                    if (!File.Exists(Path.Combine(AppContext.BaseDirectory, "interception.dll")))
                                    {
                                        Emit(new { id, ok = true, devices = Array.Empty<object>(), diagnosis = "Windows exposes a matching VEC mouse endpoint. Selective replacement needs the separately licensed Interception driver and x64 DLL. Review compatibility and installation instructions before proceeding.", state = State() }); continue;
                                    }
                                    backend ??= new WindowsBackend();
                                    var candidates = backend.Candidates();
                                    if (candidates.Count > 1) throw new InvalidOperationException("Multiple matching pedal endpoints. Unplug extra pedals; this preview refuses ambiguous hardware.");
                                    foreach (var d in candidates.Keys) tokens[Guid.NewGuid().ToString("N")] = d;
                                    Emit(new { id, ok = true, devices = tokens.Keys.Select(token => new { token, label = "VEC Infinity mouse endpoint · identity checked", vendorId = 0x05f3, productId = 0x00ff }).ToArray(), state = State() }); continue;
                                case "start":
                                    if (!m.GetProperty("reviewed").GetBoolean()) throw new InvalidDataException("Review the source and recovery instructions first.");
                                    var token = m.GetProperty("token").GetString() ?? "";
                                    if (engine.Capturing || backend == null || !tokens.TryGetValue(token, out var selected) || backend.Candidates().Count != 1 || !Engine.Supported(backend.HardwareId(selected))) throw new InvalidOperationException("Select one uniquely identified pedal again.");
                                    if (!WindowsSafety.DesktopAvailable() || !WindowsSafety.ButtonsReleased()) throw new InvalidOperationException("Return to the normal desktop and release every pedal and mouse button first.");
                                    topology = WindowsSafety.Topology(); capturedId = backend.HardwareId(selected);
                                    backend.Capture(selected); engine.Start(selected, now); break;
                                case "learn": engine.Learn(m.GetProperty("control").GetString() ?? ""); break;
                                case "mappings":
                                    var map = m.GetProperty("mappings"); if (map.ValueKind != JsonValueKind.Object) throw new InvalidDataException("Invalid mappings.");
                                    engine.SetMappings(map.EnumerateObject().ToDictionary(p => p.Name, p => p.Value.GetString() ?? "")); break;
                                case "enable":
                                    var enable = m.GetProperty("value").GetBoolean();
                                    if (enable && !m.GetProperty("verified").GetBoolean()) throw new InvalidDataException("Verify original output suppression and your ordinary mouse before activating.");
                                    engine.Enable(enable); break;
                                case "ping": engine.Ping(now); break;
                                case "stop": Stop("Capture stopped. Original pedal input restored."); break;
                                case "state": break;
                                default: throw new InvalidDataException("Unknown request.");
                            }
                            Emit(new { id, ok = true, state = State() });
                        }
                        catch (Exception error)
                        {
                            if (engine.Capturing || backend is { Selected: not 0 }) Stop("Request rejected. Original input restored.");
                            Emit(new { id, ok = false, error = error is InvalidOperationException or InvalidDataException or IOException ? error.Message : "Native request failed. Capture stopped.", state = State() });
                        }
                    }
                }
                if (!engine.Capturing || backend == null) { Thread.Sleep(20); continue; }
                var device = backend.Wait(); if (device == 0) continue;
                if (!backend.Receive(device, out var stroke)) { Stop("Input read failed. Select and learn again."); continue; }
                if (device != engine.Device) { backend.Forward(device, ref stroke); continue; }
                if (!IdentityValid()) { backend.Forward(device, ref stroke); Stop("Device identity changed."); continue; }
                try
                {
                    var actions = engine.Stroke(device, stroke.State, stroke.Flags, stroke.X, stroke.Y, stroke.Wheel);
                    foreach (var action in actions ?? []) WindowsSafety.Act(action);
                    Emit(new { @event = "input", state = State() });
                }
                catch (Exception error) { Stop(error is InvalidOperationException or IOException ? error.Message : "Input processing failed. Original input restored."); }
            }
        }
        catch { return 1; }
        finally
        {
            // Browser exit, malformed framing, output failure, or any exception.
            backend?.Dispose(); engine.Stop(); while (incoming.TryDequeue(out var doc)) doc.Dispose(); outgoing.CompleteAdding();
        }
        return 0;
    }
}
