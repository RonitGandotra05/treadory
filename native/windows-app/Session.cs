namespace Treadory;
internal interface IAppBackend : IDisposable
{
    Dictionary<int,string> Candidates(); string HardwareId(int device);
    void Capture(int device); void Release(); int Wait();
    bool Receive(int device, out WindowsBackend.Stroke stroke); void Forward(int device, ref WindowsBackend.Stroke stroke);
}
internal interface IAppPlatform
{
    int MouseEndpoints(); bool DesktopAvailable(); bool ButtonsReleased(); bool EscapePressed();
    string Topology(); void Act(string action);
    void Guard(string scope) {} void ArmGuard(long detected) {}
}
internal sealed record AppState(bool Capturing, bool Enabled, string? Learning, string[] Learned, int Held, int Presses, bool Ready, string Message);
// Owned by one worker. No saved endpoint, learned input or active state survives a session.
internal sealed class AppSession : IDisposable
{
    private readonly Engine engine = new();
    private readonly IAppPlatform platform;
    private readonly Func<IAppBackend> factory;
    private readonly Action verifyIntegration;
    private IAppBackend? backend;
    private int selected; private string identity="", topology="", message="Inspect your pedal to begin.";
    private long lastCheck; private string guardScope="off";
    private readonly Func<long> clock;
    internal AppSession(IAppPlatform platform, Func<IAppBackend> factory,Action? verifyIntegration=null,Func<long>? clock=null) { this.clock=clock??(()=>Environment.TickCount64);this.platform=platform;this.factory=factory;this.verifyIntegration=verifyIntegration??(()=>{}); }
    internal AppState State => new(engine.Capturing,engine.Enabled,engine.Learning,engine.Learned.Keys.ToArray(),engine.Held,engine.Presses,selected!=0,message);
    internal void Inspect()
    {
        if(engine.Capturing)throw new InvalidOperationException("Stop capture before inspection.");
        selected=0;
        var count=platform.MouseEndpoints();
        if(count!=1) { message=count==0?"No matching VEC mouse endpoint. Check USB identity and quit other pedal utilities. This app cannot attribute their injected clicks.":"Multiple matching pedal endpoints. Unplug extra pedals; no device was selected.";return; }
        verifyIntegration();backend??=factory();
        var candidates=backend.Candidates();
        if(candidates.Count!=1)throw new InvalidOperationException("The driver must expose exactly one eligible VEC mouse endpoint. No device selected.");
        var pair=candidates.Single();
        if(!Engine.Supported(pair.Value))throw new InvalidOperationException("This is not a supported VEC endpoint.");
        selected=pair.Key;identity=pair.Value;message="One eligible VEC endpoint found. Review recovery and start an isolated test.";
    }
    private bool IdentityValid() => backend!=null && backend.Candidates().Count==1 && backend.HardwareId(engine.Device)==identity && platform.Topology()==topology;
    internal void Start(bool reviewed,long now)
    {
        if(!reviewed||selected==0||backend==null||engine.Capturing)throw new InvalidOperationException("Inspect one pedal and review recovery first.");
        if(!platform.DesktopAvailable()||!platform.ButtonsReleased())throw new InvalidOperationException("Use the normal desktop and release all pedal and mouse buttons.");
        verifyIntegration();var candidates=backend.Candidates();
        if(candidates.Count!=1||!candidates.TryGetValue(selected,out var id)||id!=identity||!Engine.Supported(id))throw new InvalidOperationException("Pedal identity changed. Inspect again.");
        topology=platform.Topology();backend.Capture(selected);engine.Start(selected,now);lastCheck=now;message="Original pedal outputs suppressed. Learn all three physical pedals; ordinary mice remain available.";
    }
    internal void Learn(string control) { engine.Learn(control);platform.Guard("off");message=$"Press and release only the {control} pedal."; }
    internal void Configure(Dictionary<string,string> mappings) { engine.SetMappings(mappings);platform.Guard("off");message="Actions saved. Activation remains explicit."; }
    internal void ConfigureGuard(string scope) { if(engine.Capturing)throw new InvalidOperationException("Stop capture before changing the click guard.");if(scope is not ("off" or "all" or "right"))throw new InvalidDataException("Invalid guard scope.");guardScope=scope; }
    internal void Enable(bool value,bool outputsVerified,bool mouseVerified)
    {
        if(value&&(!outputsVerified||!mouseVerified))throw new InvalidOperationException("Verify original outputs are absent and your ordinary mouse still works.");
        if(value&&engine.Enabled)return;
        engine.Enable(value);platform.Guard(value?guardScope:"off");message=value?"Computer-wide actions active. Keep this app open.":"Actions paused; original pedal outputs remain suppressed. Stop capture restores them.";
    }
    internal void Ping(long now)=>engine.Ping(now);
    internal void Stop(string reason="Capture stopped. Original pedal input restored.")
    {
        try {platform.Guard("off");backend?.Release();} finally {engine.Stop();selected=0;identity="";message=reason;}
    }
    internal void Reject(Exception error) { Stop(error is InvalidOperationException or IOException or InvalidDataException ? error.Message : "Input integration failed. Capture stopped. Review setup and inspect again."); }
    internal void Tick(long now)
    {
        if(!engine.Capturing)return;
        if(engine.Expire(now)) { Stop("Settings window heartbeat expired. Original input restored.");return; }
        if(platform.EscapePressed()) {Stop("Recovery chord pressed. Original input restored.");return;}
        if(now-lastCheck>=100) {lastCheck=now;if(!platform.DesktopAvailable()||!IdentityValid()) {Stop("Device inventory or desktop changed. Original input restored. Inspect and learn again.");return;}}
        var device=backend!.Wait();if(device==0)return;
        if(!backend.Receive(device,out var stroke))throw new IOException("Input read failed.");
        var detected=clock(); // Timestamp receipt before inventory checks or action execution.
        if(device!=engine.Device) {backend.Forward(device,ref stroke);return;}
        if(!IdentityValid()) {backend.Forward(device,ref stroke);Stop("Pedal identity changed. Original input restored.");return;}
        var actions=engine.Stroke(device,stroke.State,stroke.Flags,stroke.X,stroke.Y,stroke.Wheel)??[];
        if(engine.Enabled&&engine.LastPressed!=0)platform.ArmGuard(detected); // Before any action, including Do nothing.
        foreach(var action in actions)platform.Act(action);
        if(engine.Learning==null&&engine.Learned.Count>0&&!engine.Enabled)message="Learning complete for: "+string.Join(", ",engine.Learned.Keys)+". Verify outputs and mouse before activation.";
    }
    public void Dispose() {try {Stop();} finally {backend?.Dispose();backend=null;}}
}
