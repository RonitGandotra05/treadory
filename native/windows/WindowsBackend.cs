using System.Runtime.InteropServices;
using System.Text;

namespace Treadory;
// ABI facts from Interception's public API; no library/driver code vendored.
internal sealed class WindowsBackend : IDisposable
{
    [StructLayout(LayoutKind.Sequential)] internal struct Stroke { internal ushort State, Flags; internal short Wheel; internal int X, Y; internal uint Information; }
    [UnmanagedFunctionPointer(CallingConvention.Cdecl)] internal delegate int Predicate(int device);
    private static readonly object LibraryLock = new();
    private static bool resolverInstalled;
    private readonly Predicate predicate;
    private nint context;
    internal int Selected { get; private set; }
    internal WindowsBackend()
    {
        if (!OperatingSystem.IsWindows() || RuntimeInformation.ProcessArchitecture != Architecture.X64 || RuntimeInformation.OSArchitecture != Architecture.X64) throw new InvalidOperationException("This preview requires Windows x64; ARM64/emulation is unsupported.");
        var path = Path.Combine(AppContext.BaseDirectory, "interception.dll");
        if (!File.Exists(path)) throw new InvalidOperationException("Install your separately licensed x64 Interception DLL beside the helper. Treadory does not bundle its driver.");
        // Never search the working directory or PATH for the privileged integration.
        lock (LibraryLock)
        {
            if (!resolverInstalled)
            {
                NativeLibrary.SetDllImportResolver(typeof(WindowsBackend).Assembly, (name, _, _) => name == "interception.dll" ? NativeLibrary.Load(path) : 0);
                resolverInstalled = true;
            }
        }
        predicate = d => d == Selected ? 1 : 0;
        context = Create();
        if (context == 0) throw new InvalidOperationException("Interception driver is unavailable or another client owns it. See the installation guide; no device was captured.");
    }
    internal Dictionary<int, string> Candidates()
    {
        var devices = new Dictionary<int, string>();
        for (var d = 11; d <= 20; d++) { var id = HardwareId(d); if (Engine.Supported(id)) devices.Add(d, id); }
        return devices;
    }
    internal string HardwareId(int d)
    {
        var bytes = new byte[2048]; var length = GetId(context, d, bytes, (uint)bytes.Length);
        if (length == 0 || length > bytes.Length || (length & 1) != 0) return "";
        return Encoding.Unicode.GetString(bytes, 0, (int)length).TrimEnd('\0');
    }
    internal void Capture(int device)
    {
        if (Selected != 0) throw new InvalidOperationException("Stop the existing capture first.");
        if (Filter(context, device) != 0) throw new InvalidOperationException("Another input filter is active. Quit other remappers first.");
        Selected = device; SetFilter(context, predicate, 0xffff);
        if (Filter(context, device) != 0xffff) { Release(); throw new InvalidOperationException("The device filter could not be installed."); }
    }
    internal void Release() { if (Selected != 0 && context != 0) SetFilter(context, predicate, 0); Selected = 0; }
    internal int Wait() => WaitFor(context, 20);
    internal bool Receive(int device, out Stroke stroke) => Read(context, device, out stroke, 1) == 1;
    internal void Forward(int device, ref Stroke stroke) { if (Send(context, device, ref stroke, 1) != 1) throw new IOException("Original input could not be forwarded."); }
    public void Dispose() { Release(); if (context != 0) Destroy(context); context = 0; GC.KeepAlive(predicate); }

    [DllImport("interception.dll", EntryPoint="interception_create_context", CallingConvention=CallingConvention.Cdecl)] private static extern nint Create();
    [DllImport("interception.dll", EntryPoint="interception_destroy_context", CallingConvention=CallingConvention.Cdecl)] private static extern void Destroy(nint c);
    [DllImport("interception.dll", EntryPoint="interception_set_filter", CallingConvention=CallingConvention.Cdecl)] private static extern void SetFilter(nint c, Predicate p, ushort f);
    [DllImport("interception.dll", EntryPoint="interception_get_filter", CallingConvention=CallingConvention.Cdecl)] private static extern ushort Filter(nint c, int d);
    [DllImport("interception.dll", EntryPoint="interception_get_hardware_id", CallingConvention=CallingConvention.Cdecl)] private static extern uint GetId(nint c, int d, [Out] byte[] id, uint size);
    [DllImport("interception.dll", EntryPoint="interception_wait_with_timeout", CallingConvention=CallingConvention.Cdecl)] private static extern int WaitFor(nint c, uint milliseconds);
    [DllImport("interception.dll", EntryPoint="interception_receive", CallingConvention=CallingConvention.Cdecl)] private static extern int Read(nint c, int d, out Stroke stroke, uint count);
    [DllImport("interception.dll", EntryPoint="interception_send", CallingConvention=CallingConvention.Cdecl)] private static extern int Send(nint c, int d, ref Stroke stroke, uint count);
}

internal static class WindowsSafety
{
    [StructLayout(LayoutKind.Sequential)] private struct Device { internal nint Handle; internal uint Type; }
    [DllImport("user32.dll")] private static extern uint GetRawInputDeviceList([Out] Device[]? devices, ref uint count, uint size);
    [DllImport("user32.dll", EntryPoint="GetRawInputDeviceInfoW")] private static extern uint DeviceInfo(nint device, uint command, nint data, ref uint size);
    [DllImport("user32.dll", EntryPoint="GetRawInputDeviceInfoW", CharSet=CharSet.Unicode)] private static extern uint DeviceName(nint device, uint command, StringBuilder? data, ref uint size);
    [DllImport("user32.dll")] private static extern short GetAsyncKeyState(int key);
    [DllImport("user32.dll")] private static extern nint OpenInputDesktop(uint flags, bool inherit, uint access);
    [DllImport("user32.dll")] private static extern bool CloseDesktop(nint desktop);
    [DllImport("user32.dll", CharSet=CharSet.Unicode)] private static extern bool GetUserObjectInformationW(nint handle, int index, StringBuilder name, uint size, out uint needed);
    internal static string Topology()
    {
        uint count = 0; var size = (uint)Marshal.SizeOf<Device>();
        if (GetRawInputDeviceList(null, ref count, size) == uint.MaxValue || count > 256) throw new IOException("Device inventory unavailable.");
        var devices = new Device[count]; var read = GetRawInputDeviceList(devices, ref count, size);
        if (read == uint.MaxValue || read > devices.Length) throw new IOException("Device inventory changed.");
        return string.Join(',', devices.Take((int)read).Select(d => $"{d.Handle}:{d.Type}").Order());
    }
    internal static List<(string Kind, int UsagePage, int Usage)> PedalEndpoints()
    {
        uint count = 0; var size = (uint)Marshal.SizeOf<Device>();
        if (GetRawInputDeviceList(null, ref count, size) == uint.MaxValue || count > 256) throw new IOException("Device inventory unavailable.");
        var devices = new Device[count]; var read = GetRawInputDeviceList(devices, ref count, size);
        if (read == uint.MaxValue || read > devices.Length) throw new IOException("Device inventory changed.");
        var result = new List<(string, int, int)>();
        foreach (var device in devices.Take((int)read))
        {
            // Inspect metadata only; never register for global input or read its data.
            uint chars = 0;
            if (DeviceName(device.Handle, 0x20000007, null, ref chars) == uint.MaxValue || chars is 0 or > 4096) continue;
            var name = new StringBuilder((int)chars);
            if (DeviceName(device.Handle, 0x20000007, name, ref chars) == uint.MaxValue || !System.Text.RegularExpressions.Regex.IsMatch(name.ToString(), @"[\\#]VID_05F3&PID_00FF(?:&|#)", System.Text.RegularExpressions.RegexOptions.IgnoreCase)) continue;
            if (device.Type == 0) { result.Add(("mouse", 1, 2)); continue; }
            if (device.Type != 2) continue;
            var data = Marshal.AllocHGlobal(32);
            try
            {
                Marshal.Copy(new byte[32], 0, data, 32); Marshal.WriteInt32(data, 32); uint bytes = 32;
                if (DeviceInfo(device.Handle, 0x2000000b, data, ref bytes) == uint.MaxValue || bytes < 24) continue;
                if (Marshal.ReadInt32(data, 8) != 0x05f3 || Marshal.ReadInt32(data, 12) != 0x00ff) continue;
                result.Add(("hid", (ushort)Marshal.ReadInt16(data, 20), (ushort)Marshal.ReadInt16(data, 22)));
            }
            finally { Marshal.FreeHGlobal(data); }
        }
        return result;
    }
    internal static bool DesktopAvailable()
    {
        var desktop = OpenInputDesktop(0, false, 1); if (desktop == 0) return false;
        try { var name = new StringBuilder(256); return GetUserObjectInformationW(desktop, 2, name, 512, out _) && name.ToString() == "Default"; }
        finally { CloseDesktop(desktop); }
    }
    internal static bool ButtonsReleased() => new[] { 1, 2, 4, 5, 6 }.All(k => (GetAsyncKeyState(k) & 0x8000) == 0);
    internal static bool EscapePressed() => new[] { 0x11, 0x12, 0x10, 0x7b }.All(k => (GetAsyncKeyState(k) & 0x8000) != 0); // Ctrl Alt Shift F12

    [StructLayout(LayoutKind.Sequential)] internal struct MouseInput { internal int X, Y; internal uint Data, Flags, Time; internal nuint Extra; }
    [StructLayout(LayoutKind.Sequential)] internal struct KeyInput { internal ushort Key, Scan; internal uint Flags, Time; internal nuint Extra; }
    [StructLayout(LayoutKind.Explicit)] internal struct InputData { [FieldOffset(0)] internal MouseInput Mouse; [FieldOffset(0)] internal KeyInput Key; }
    [StructLayout(LayoutKind.Sequential)] internal struct Input { internal uint Type; internal InputData Data; }
    [DllImport("user32.dll", SetLastError=true)] private static extern uint SendInput(uint count, Input[] input, int size);
    internal static void Act(string action)
    {
        if (action is "scrollUp" or "scrollDown")
        {
            var inputs = new[] { new Input { Type = 0, Data = new InputData { Mouse = new MouseInput { Flags = 0x800, Data = unchecked((uint)(action == "scrollUp" ? 120 : -120)) } } } };
            if (SendInput(1, inputs, Marshal.SizeOf<Input>()) != 1) throw new IOException("Windows refused the action. Elevated apps and secure desktops are unsupported.");
            return;
        }
        var vk = action switch { "media" => 0xb3, "space" => 0x20, "enter" => 0x0d, _ when action.StartsWith('f') && int.TryParse(action[1..], out var n) && n is >= 13 and <= 24 => 0x7c + n - 13, _ => throw new InvalidDataException("Unsupported action.") };
        if ((GetAsyncKeyState(vk) & 0x8000) != 0) throw new IOException("The chosen key is already held on your keyboard. Capture stopped without injecting a key-up.");
        var down = new Input { Type = 1, Data = new InputData { Key = new KeyInput { Key = (ushort)vk } } };
        var up = down; up.Data.Key.Flags = 2;
        if (SendInput(2, [down, up], Marshal.SizeOf<Input>()) != 2)
        {
            // A partial batch may have inserted the key-down; always try release.
            _ = SendInput(1, [up], Marshal.SizeOf<Input>());
            throw new IOException("Windows refused a key tap. Capture stopped; key release requested.");
        }
    }
}
