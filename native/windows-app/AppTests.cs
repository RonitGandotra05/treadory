namespace Treadory;
internal static class AppTests
{
    private sealed class Platform : IAppPlatform
    {
        internal int Count=1;internal bool Desktop=true,Released=true,Escape;internal string Inventory="initial";
        internal readonly List<string> GuardEvents=[];
        public void Guard(string scope)=>GuardEvents.Add(scope);public void ArmGuard(long detected)=>GuardEvents.Add("arm:"+detected);
        internal readonly List<string> Actions=[];internal bool FailAction;
        public int MouseEndpoints()=>Count;public bool DesktopAvailable()=>Desktop;public bool ButtonsReleased()=>Released;public bool EscapePressed()=>Escape;public string Topology()=>Inventory;
        public void Act(string action){if(FailAction)throw new IOException("action failed");GuardEvents.Add("act:"+action);Actions.Add(action);}
    }
    private sealed class Backend : IAppBackend
    {
        internal string Id="HID\\VID_05F3&PID_00FF";internal int Count=1,Selected,Forwarded,Releases;internal bool Disposed,FailRead;
        internal readonly Queue<(int,WindowsBackend.Stroke)> Input=[];
        public Dictionary<int,string> Candidates()=>Count==1?new(){[11]=Id}:Count==0?[]:new(){[11]=Id,[12]=Id};
        public string HardwareId(int device)=>Id;public void Capture(int device)=>Selected=device;public void Release(){Selected=0;Releases++;}
        public int Wait()=>Input.TryPeek(out var item)?item.Item1:0;
        public bool Receive(int device,out WindowsBackend.Stroke stroke){stroke=Input.Dequeue().Item2;return !FailRead;}
        public void Forward(int device,ref WindowsBackend.Stroke stroke)=>Forwarded++;public void Dispose(){Release();Disposed=true;}
        internal void Add(ushort state,int device=11,int x=0)=>Input.Enqueue((device,new WindowsBackend.Stroke{State=state,X=x}));
    }
    internal static int Run()
    {
        var checks=0;void Check(bool value,string name){if(!value)throw new Exception(name);checks++;}void Reject(Action action,string name){try{action();}catch{checks++;return;}throw new Exception(name);}
        var policy=new ClickPolicy();
        policy.Configure("all");policy.Arm(1000);
        foreach(var button in new[]{0,1,2,3,4}){Check(policy.Reject(button,true,1000),"all button down at 0");Check(policy.Reject(button,false,1251),"paired up after deadline");}
        foreach(var elapsed in new[]{0,249,250,251}){policy.Configure("all");policy.Arm(1000);Check(policy.Reject(0,true,1000+elapsed)==(elapsed<250),"exact guard boundary");policy.Reject(0,false,1400);}
        policy.Configure("right");policy.Arm(0);Check(!policy.Reject(0,true,1)&&policy.Reject(2,true,1),"right scope");
        policy.Configure("all");Check(!policy.Reject(0,true,0),"unarmed down allowed");policy.Arm(10);Check(!policy.Reject(0,false,11),"preexisting drag release preserved");
        Check(!policy.Reject(1,false,11),"unknown held release preserved");Check(!policy.Reject(2,true,11,true),"own marked action preserved");
        policy.Configure("all");policy.Arm(0);policy.Arm(200);Check(policy.Reject(2,true,449),"repeated press deadline updated");Check(policy.Reject(2,true,600),"held mouse repeat stays paired");Check(policy.Reject(2,false,601),"repeat released");Check(!policy.Reject(2,true,601),"new down after deadline allowed");
        policy.Configure("all");policy.Arm(0);Check(policy.Reject(0,true,1),"blocked down");Check(!policy.Reject(0,false,5001),"five second sequence failsafe");
        policy.Configure("off");policy.Arm(0);Check(!policy.Reject(0,true,1),"disabled never blocks");
        var directory=Path.Combine(Path.GetTempPath(),"treadory-app-test-"+Guid.NewGuid());Directory.CreateDirectory(directory);
        try{
            var p=new Platform();var b=new Backend();using var session=new AppSession(p,()=>b,clock:()=>1000);
            session.ConfigureGuard("all");
            Check(!session.State.Capturing&&!session.State.Ready,"startup never captures");
            p.Count=0;session.Inspect();Check(!session.State.Ready&&b.Selected==0,"no matching metadata means no driver selection");
            p.Count=2;session.Inspect();Check(!session.State.Ready,"ambiguous raw endpoints rejected");p.Count=1;
            b.Id="HID\\VID_1234&PID_00FF";Reject(session.Inspect,"ordinary mouse rejected");b.Id="HID\\VID_05F3&PID_00FF";
            b.Count=2;Reject(session.Inspect,"ambiguous driver endpoints rejected");b.Count=1;session.Inspect();Check(session.State.Ready&&!session.State.Capturing,"inspection does not capture");
            Reject(()=>session.Start(false,0),"review required");p.Released=false;Reject(()=>session.Start(true,0),"release required");p.Released=true;p.Desktop=false;Reject(()=>session.Start(true,0),"normal desktop required");p.Desktop=true;
            b.Id="changed";Reject(()=>session.Start(true,0),"changed identity rejected");b.Id="HID\\VID_05F3&PID_00FF";session.Start(true,0);
            Check(session.State.Capturing&&!session.State.Enabled,"isolated test suppresses without actions");
            b.Add(4,12,8);session.Tick(1);Check(b.Forwarded==1&&p.Actions.Count==0,"ordinary mouse forwarded unchanged");
            Reject(()=>session.Enable(true,true,true),"learning required");
            foreach(var pair in new[]{("left",1),("middle",4),("right",16)}){session.Learn(pair.Item1);b.Add((ushort)pair.Item2);session.Tick(2);Check(session.State.Learning!=null,"learning requires release");b.Add((ushort)(pair.Item2<<1));session.Tick(3);}
            Check(session.State.Learned.Length==3,"three distinct controls learned");
            session.Configure(new(){["left"]="scrollUp",["middle"]="space",["right"]="none"});Reject(()=>session.Enable(true,false,true),"output verification required");Reject(()=>session.Enable(true,true,false),"ordinary mouse verification required");session.Enable(true,true,true);
            b.Add(4);session.Tick(4);Check(p.Actions.SequenceEqual(new[]{"space"}),"chosen middle action only");Check(p.GuardEvents.TakeLast(2).SequenceEqual(new[]{"arm:1000","act:space"}),"physical detection arms before action");var armCount=p.GuardEvents.Count(x=>x=="arm:1000");b.Add(4);session.Tick(5);Check(p.Actions.Count==1,"held repeat deduplicated");Check(p.GuardEvents.Count(x=>x=="arm:1000")==armCount,"held reports never rearm guard");b.Add(8);session.Tick(6);
            b.Add(5);session.Tick(7);Check(p.Actions.Count==3,"two physical pedals simultaneous");b.Add(10);session.Tick(8);b.Add(16);session.Tick(8);Check(p.GuardEvents.Last()=="arm:1000"&&p.Actions.Count==3,"No action physical press still arms guard");b.Add(32);session.Tick(8);session.Enable(false,false,false);b.Add(4);session.Tick(9);Check(p.Actions.Count==3&&session.State.Capturing,"pause preserves suppression");Check(p.GuardEvents.Last()=="off","pause clears guard");b.Add(8);session.Tick(10);
            session.Ping(4000);session.Tick(5000);Check(session.State.Capturing,"UI heartbeat renews lease");session.Tick(9000);Check(!session.State.Capturing&&!session.State.Ready&&b.Selected==0,"UI freeze expires and releases");
            void Restart(){session.Inspect();session.Start(true,10000);}
            Restart();p.Escape=true;session.Tick(10001);Check(!session.State.Capturing,"recovery chord releases");p.Escape=false;
            Restart();p.Inventory="changed";session.Tick(10100);Check(!session.State.Capturing,"device topology change releases");
            Restart();p.Desktop=false;session.Tick(10100);Check(!session.State.Capturing,"secure desktop releases");p.Desktop=true;
            Restart();b.Id="foreign";session.Tick(10100);Check(!session.State.Capturing,"identity replacement releases");b.Id="HID\\VID_05F3&PID_00FF";
            Restart();b.Add(4,11,1);try{session.Tick(10001);}catch(Exception e){session.Reject(e);}Check(!session.State.Capturing,"pointer packet fails closed");
            Restart();b.FailRead=true;b.Add(4);try{session.Tick(10001);}catch(Exception e){session.Reject(e);}Check(!session.State.Capturing,"read failure releases");b.FailRead=false;
            Restart();foreach(var pair in new[]{("left",1),("middle",4),("right",16)}){session.Learn(pair.Item1);b.Add((ushort)pair.Item2);session.Tick(10001);b.Add((ushort)(pair.Item2<<1));session.Tick(10002);}session.Enable(true,true,true);p.FailAction=true;b.Add(4);try{session.Tick(10003);}catch(Exception e){session.Reject(e);}Check(!session.State.Capturing&&b.Selected==0,"action failure releases");p.FailAction=false;
            Restart();session.Stop();Check(!session.State.Capturing&&session.State.Learned.Length==0,"manual stop clears learning");
            var path=Path.Combine(directory,"settings.json");var settings=AppSettings.Default with {Mappings=new(){["left"]="scrollUp",["middle"]="space",["right"]="f13"}};SettingsStore.Save(path,settings);Check(SettingsStore.Load(path).Mappings["middle"]=="space","local mapping roundtrip");
            var json=File.ReadAllText(path);Check(SettingsStore.Load(path).ClickGuardScope=="off","old and new settings default guard off");
            File.WriteAllText(path,json.Replace(",\"ClickGuardScope\":\"off\"",""));Check(SettingsStore.Load(path).ClickGuardScope=="off","v1 config without guard migrates off");File.WriteAllText(path,json);Check(!json.Contains("Capturing")&&!json.Contains("Learned")&&!json.Contains("Device"),"active state and identity never persisted");
            Reject(()=>SettingsStore.Save(path,settings with {Mappings=new(){["left"]="shell",["middle"]="none",["right"]="none"}}),"unknown actions rejected");
            File.WriteAllText(path,"{\"Version\":1,\"Mappings\":null,\"DriverHash\":null}");Reject(()=>SettingsStore.Load(path),"malformed config rejected");
            File.WriteAllText(path,json[..^1]+",\"AutoCapture\":true}");Reject(()=>SettingsStore.Load(path),"unexpected persisted capture field rejected");
            File.WriteAllText(path,new string('x',8193));Reject(()=>SettingsStore.Load(path),"oversized config rejected");Check(SettingsStore.Load(Path.Combine(directory,"missing.json")).Mappings.Values.All(a=>a=="none"),"first run neutral defaults");
            var dll=Path.Combine(directory,"source.dll");var bytes=new byte[160];bytes[0]=77;bytes[1]=90;BitConverter.GetBytes(64).CopyTo(bytes,60);BitConverter.GetBytes(0x4550).CopyTo(bytes,64);BitConverter.GetBytes((ushort)0x8664).CopyTo(bytes,68);BitConverter.GetBytes((ushort)0x2000).CopyTo(bytes,86);File.WriteAllBytes(dll,bytes);
            var hash=Convert.ToHexString(System.Security.Cryptography.SHA256.HashData(bytes));Reject(()=>DriverFile.Verify(dll,hash,false),"license acknowledgment required");Reject(()=>DriverFile.Verify(dll,new string('0',64),true),"checksum mismatch rejected");Check(DriverFile.Verify(dll,hash,true).Length==160,"trusted x64 DLL accepted");
            var destination=Path.Combine(directory,"interception.dll");DriverFile.Import(dll,destination,hash,true);Reject(()=>DriverFile.Import(dll,destination,hash,true),"existing DLL never overwritten");
            bytes[68]=0x4c;bytes[69]=1;File.WriteAllBytes(dll,bytes);var wrongHash=Convert.ToHexString(System.Security.Cryptography.SHA256.HashData(bytes));Reject(()=>DriverFile.Verify(dll,wrongHash,true),"x86 DLL rejected");
            session.Dispose();Check(b.Disposed&&b.Selected==0,"exit disposes driver context");
            var workerBackend=new Backend();var workerPlatform=new Platform();using(var worker=new AppRunner(new AppSession(workerPlatform,()=>workerBackend))){worker.Send(s=>{s.Inspect();s.Start(true,Environment.TickCount64);});Check(SpinWait.SpinUntil(()=>worker.State.Capturing,1500),"worker runs explicit capture commands without browser");worker.Dispose();Check(workerBackend.Disposed&&workerBackend.Selected==0,"worker shutdown restores input");}
            Console.WriteLine($"PASS {checks} standalone app policy/configuration/driver trust tests; no physical input assertion.");return 0;
        }catch(Exception error){Console.Error.WriteLine($"FAIL after {checks}: {error.Message}");return 1;}finally{Directory.Delete(directory,true);}
    }
}
