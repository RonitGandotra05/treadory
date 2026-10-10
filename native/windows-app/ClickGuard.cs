using System.Runtime.InteropServices;
namespace Treadory;
// Timing is deliberately source-agnostic. Own injected events alone have a marker.
internal sealed class ClickPolicy
{
    private readonly object gate=new();
    private readonly Dictionary<int,(bool Blocked,long Expires)> held=[];
    private long until; private string scope="off";
    internal void Configure(string value) {if(value is not ("off" or "all" or "right"))throw new InvalidDataException("Invalid click guard scope.");lock(gate){scope=value;until=0;held.Clear();}}
    internal void Arm(long detected) {lock(gate){if(scope!="off")until=detected+250;}}
    internal bool Reject(int button,bool down,long now,bool own=false)
    {
        lock(gate){
            if(own||scope=="off")return false;
            if(held.TryGetValue(button,out var previous)&&now>=previous.Expires)held.Remove(button);
            if(down){
                if(held.TryGetValue(button,out var repeated))return repeated.Blocked;
                var blocked=now<until&&(scope=="all"||button==2);
                held[button]=(blocked,now+5000);return blocked;
            }
            // Up without observed down includes buttons already held before installation.
            if(!held.Remove(button,out var sequence))return false;
            return sequence.Blocked;
        }
    }
}
internal sealed class WindowsClickGuard : IDisposable
{
    internal static readonly nuint InjectionMarker=0x54524459;
    private readonly ClickPolicy policy=new();
    private readonly HookProc callback;
    private readonly Thread thread;
    private readonly ManualResetEventSlim ready=new();
    private int rejected,ownPassed;internal int Rejected=>Volatile.Read(ref rejected);internal int OwnPassed=>Volatile.Read(ref ownPassed);
    private nint hook;private uint threadId;private Exception? failure;
    internal WindowsClickGuard(string scope)
    {
        policy.Configure(scope);callback=OnMouse;
        thread=new Thread(()=>{
            threadId=GetCurrentThreadId();
            PeekMessage(out _,0,0,0,0); // Create the message queue before publishing readiness.
            hook=SetWindowsHookEx(14,callback,GetModuleHandle(null),0);
            if(hook==0)failure=new IOException("Windows refused the optional mouse hook. Capture stopped.");
            ready.Set();
            if(hook==0)return;
            try{while(GetMessage(out var message,0,0,0)>0){TranslateMessage(ref message);DispatchMessage(ref message);}}
            finally{UnhookWindowsHookEx(hook);hook=0;}
        }){IsBackground=true,Name="Treadory click guard"};thread.Start();ready.Wait();
        if(failure!=null){Dispose();throw failure;}
    }
    internal void Arm(long now)=>policy.Arm(now);
    private nint OnMouse(int code,nuint kind,nint data)
    {
        if(code>=0){
            var e=Marshal.PtrToStructure<MouseEvent>(data);
            var button=kind switch{0x201 or 0x202=>0,0x207 or 0x208=>1,0x204 or 0x205=>2,0x20b or 0x20c=>2+(int)(e.Data>>16),_=>-1};
            var own=(e.Flags&1)!=0&&e.Extra==InjectionMarker;
            if(button>=0&&own)Interlocked.Increment(ref ownPassed);
            if(button>=0&&policy.Reject(button,kind is 0x201 or 0x207 or 0x204 or 0x20b,Environment.TickCount64,own)){Interlocked.Increment(ref rejected);return 1;}
        }
        return CallNextHookEx(hook,code,kind,data);
    }
    public void Dispose(){policy.Configure("off");if(thread.IsAlive){PostThreadMessage(threadId,0x12,0,0);thread.Join(1500);}GC.KeepAlive(callback);}
    private delegate nint HookProc(int code,nuint kind,nint data);
    [StructLayout(LayoutKind.Sequential)] private struct MouseEvent{internal int X,Y;internal uint Data,Flags,Time;internal nuint Extra;}
    [StructLayout(LayoutKind.Sequential)] private struct Message{internal nint Window;internal uint Id;internal nuint W;internal nint L;internal uint Time;internal int X,Y;internal uint Private;}
    [DllImport("user32.dll",EntryPoint="SetWindowsHookExW",SetLastError=true)] private static extern nint SetWindowsHookEx(int id,HookProc proc,nint module,uint thread);
    [DllImport("user32.dll")] private static extern bool UnhookWindowsHookEx(nint hook);
    [DllImport("user32.dll")] private static extern nint CallNextHookEx(nint hook,int code,nuint kind,nint data);
    [DllImport("user32.dll")] private static extern bool PeekMessage(out Message message,nint window,uint min,uint max,uint remove);
    [DllImport("user32.dll",EntryPoint="GetMessageW")] private static extern int GetMessage(out Message message,nint window,uint min,uint max);
    [DllImport("user32.dll")] private static extern bool TranslateMessage(ref Message message);
    [DllImport("user32.dll",EntryPoint="DispatchMessageW")] private static extern nint DispatchMessage(ref Message message);
    [DllImport("user32.dll")] private static extern bool PostThreadMessage(uint thread,uint message,nuint w,nint l);
    [DllImport("kernel32.dll")] private static extern uint GetCurrentThreadId();
    [DllImport("kernel32.dll",CharSet=CharSet.Unicode)] private static extern nint GetModuleHandle(string? name);
}
