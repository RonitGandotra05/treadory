namespace Treadory;

// No OS calls: exercise the same policy on every build machine.
internal sealed class Engine
{
    internal static readonly string[] Controls = ["left", "middle", "right"];
    internal static readonly string[] Actions = ["none", "media", "scrollUp", "scrollDown", "space", "enter", "f13", "f14", "f15", "f16", "f17", "f18", "f19", "f20", "f21", "f22", "f23", "f24"];
    internal bool Capturing { get; private set; }
    internal bool Enabled { get; private set; }
    internal int Device { get; private set; }
    internal string? Learning { get; private set; }
    internal int Held { get; private set; }
    internal Dictionary<string, int> Learned { get; } = [];
    internal Dictionary<string, string> Mappings { get; private set; } = Controls.ToDictionary(c => c, _ => "none");
    private int candidate;
    private long lease;
    internal int Presses { get; private set; }

    internal static bool Supported(string hardwareId) =>
        System.Text.RegularExpressions.Regex.IsMatch(hardwareId, @"(?:^|\\|&)VID_05F3&PID_00FF(?:&|\\|\0|$)", System.Text.RegularExpressions.RegexOptions.IgnoreCase);

    internal void Start(int device, long now)
    {
        if (device is < 11 or > 20) throw new InvalidOperationException("Invalid mouse endpoint.");
        Stop(); Device = device; Capturing = true; lease = now + 5000;
    }
    internal void Ping(long now) { if (Capturing) lease = now + 5000; }
    internal bool Expire(long now) { if (Capturing && now >= lease) { Stop(); return true; } return false; }
    internal void Stop() { Capturing = false; Enabled = false; Device = 0; Learning = null; Held = candidate = 0; Learned.Clear(); Presses = 0; }
    internal void Learn(string control)
    {
        if (!Capturing || !Controls.Contains(control) || Held != 0) throw new InvalidOperationException("Release every pedal before learning.");
        Enabled = false; Learning = control; candidate = 0;
        // Relearning invalidates this control until a complete release.
        Learned.Remove(control);
    }
    internal void SetMappings(Dictionary<string, string> mappings)
    {
        if (mappings.Count != 3 || !Controls.All(c => mappings.TryGetValue(c, out var value) && Actions.Contains(value))) throw new InvalidOperationException("Unsupported computer-wide action.");
        Enabled = false; Mappings = new(mappings);
    }
    internal void Enable(bool value)
    {
        if (value && (!Capturing || Learned.Count != 3 || Learning != null || Held != 0)) throw new InvalidOperationException("Learn all three controls and release them first.");
        Enabled = value;
    }
    // Return null for foreign devices: caller must forward those untouched.
    // The selected pedal is consumed even when replacement actions are paused.
    internal List<string>? Stroke(int device, ushort state, ushort flags, int x, int y, short wheel)
    {
        if (!Capturing || device != Device) return null;
        if ((state & ~0x3f) != 0 || flags != 0 || x != 0 || y != 0 || wheel != 0) throw new InvalidOperationException("This endpoint includes pointer movement or unsupported controls. Capture stopped.");
        var before = Held;
        for (var i = 0; i < 3; i++)
        {
            var down = 1 << (i * 2); var up = down << 1;
            if ((state & down) != 0 && (state & up) != 0) throw new InvalidOperationException("Conflicting press/release packet.");
            if ((state & down) != 0) Held |= 1 << i;
            if ((state & up) != 0) Held &= ~(1 << i);
        }
        var pressed = Held & ~before;
        if (Learning != null)
        {
            if (candidate == 0 && pressed != 0)
            {
                if (Held != pressed || (pressed & (pressed - 1)) != 0 || Learned.Values.Contains(pressed)) throw new InvalidOperationException("Press one distinct physical pedal. Learning stopped.");
                candidate = pressed;
            }
            if (candidate != 0 && (Held & ~candidate) != 0) throw new InvalidOperationException("Inputs overlap. Learning stopped.");
            if (candidate != 0 && Held == 0) { Learned[Learning] = candidate; Learning = null; candidate = 0; }
            return [];
        }
        if (!Enabled) return [];
        var result = new List<string>();
        foreach (var control in Controls)
            if ((pressed & Learned[control]) != 0) { Presses = Math.Min(1000000, Presses + 1); if (Mappings[control] != "none") result.Add(Mappings[control]); }
        return result;
    }
}
