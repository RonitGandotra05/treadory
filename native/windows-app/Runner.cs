using System.Collections.Concurrent;
namespace Treadory;
internal sealed class AppRunner : IDisposable
{
    private readonly BlockingCollection<Action<AppSession>> commands=new(32);
    private readonly Thread thread;
    private volatile bool closing;
    private AppState state=new(false,false,null,[],0,0,false,"Inspect your pedal to begin.");
    internal AppState State=>Volatile.Read(ref state);
    internal AppRunner(AppSession session)
    {
        thread=new Thread(()=>{
            try {while(!closing) {
                for(var i=0;i<8&&commands.TryTake(out var command);i++){try{command(session);}catch(Exception error){session.Reject(error);}}
                try {session.Tick(Environment.TickCount64);}catch(Exception error){session.Reject(error);}
                Volatile.Write(ref state,session.State);if(!session.State.Capturing)Thread.Sleep(20);
            }} finally {session.Dispose();Volatile.Write(ref state,session.State);}
        }) {IsBackground=true,Name="Treadory isolated pedal worker"};thread.Start();
    }
    internal void Send(Action<AppSession> command)
    {
        if(closing)return;if(!commands.TryAdd(command))closing=true; // A flooded control queue releases the context.
    }
    public void Dispose() {closing=true;thread.Join(1500);}
}
internal sealed class AppPlatform : IAppPlatform
{
    public int MouseEndpoints()=>WindowsSafety.PedalEndpoints().Count(e=>e.Kind=="mouse");
    public bool DesktopAvailable()=>WindowsSafety.DesktopAvailable();
    public bool ButtonsReleased()=>WindowsSafety.ButtonsReleased();
    public bool EscapePressed()=>WindowsSafety.EscapePressed();
    public string Topology()=>WindowsSafety.Topology();
    public void Act(string action)=>WindowsSafety.Act(action);
}
internal sealed class AppBackend : IAppBackend
{
    private readonly WindowsBackend backend=new();
    public Dictionary<int,string> Candidates()=>backend.Candidates(); public string HardwareId(int device)=>backend.HardwareId(device);
    public void Capture(int device)=>backend.Capture(device);public void Release()=>backend.Release();public int Wait()=>backend.Wait();
    public bool Receive(int device,out WindowsBackend.Stroke stroke)=>backend.Receive(device,out stroke);
    public void Forward(int device,ref WindowsBackend.Stroke stroke)=>backend.Forward(device,ref stroke);
    public void Dispose()=>backend.Dispose();
}
