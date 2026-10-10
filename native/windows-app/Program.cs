using System.Runtime.InteropServices;
namespace Treadory;
internal static class Program
{
    [DllImport("user32.dll")] private static extern bool SetCursorPos(int x,int y);
    [DllImport("user32.dll")] private static extern uint SendInput(uint count,WindowsSafety.Input[] inputs,int size);
    private static void Inject(uint flags,uint data,nuint extra) {
        var input=new WindowsSafety.Input {Type=0,Data=new WindowsSafety.InputData {Mouse=new WindowsSafety.MouseInput {Flags=flags,Data=data,Extra=extra}}};
        if(SendInput(1,[input],Marshal.SizeOf<WindowsSafety.Input>())!=1)throw new IOException("Synthetic OS test injection refused.");
    }
    [STAThread] private static void Main(string[] args)
    {
        if(args.SequenceEqual(new[]{"--self-test"})) {Environment.ExitCode=AppTests.Run();return;}
        if(RuntimeInformation.OSArchitecture!=Architecture.X64||RuntimeInformation.ProcessArchitecture!=Architecture.X64){MessageBox.Show("This preview requires Windows x64. ARM64/emulation is unsupported.","Treadory");return;}
        using var instance=new Mutex(true,@"Local\Treadory.Standalone.Pedal",out var first);
        if(!first){MessageBox.Show("Treadory is already open. Use its existing window.","Treadory");return;}
        ApplicationConfiguration.Initialize();
        if(args.SequenceEqual(new[]{"--guard-test"})) {
            using var target=new Form {Text="Treadory synthetic OS hook check",Size=new Size(400,200),StartPosition=FormStartPosition.CenterScreen,TopMost=true};target.Show();Application.DoEvents();
            SetCursorPos(target.Left+100,target.Top+100);
            using var guard=new WindowsClickGuard("all");guard.Arm(Environment.TickCount64);
            uint[] flags=[2,4,8,16,32,64,128,256,128,256];
            for(var i=0;i<flags.Length;i++)Inject(flags[i],i>=8?2u:i>=6?1u:0u,123);
            Inject(2,0,WindowsClickGuard.InjectionMarker);Inject(4,0,WindowsClickGuard.InjectionMarker);
            var end=Environment.TickCount64+100;while(Environment.TickCount64<end){Application.DoEvents();Thread.Sleep(1);}
            Environment.ExitCode=guard.Rejected==10&&guard.OwnPassed==2?0:1;
            Console.WriteLine($"OS hook check: canceled={guard.Rejected}, own passed={guard.OwnPassed}. Synthetic SendInput only; no pedal/driver assertion.");target.Close();return;
        }
        if(args.SequenceEqual(new[]{"--ui-test"}))
        {
            using var form=new MainForm();form.Show();Application.DoEvents();
            bool HasButton(Control parent,string name,bool enabled)
            {foreach(Control child in parent.Controls){if(child is Button button&&button.AccessibleName==name&&button.Enabled==enabled)return true;if(HasButton(child,name,enabled))return true;}return false;}
            Environment.ExitCode=HasButton(form,"Inspect pedal",true)&&HasButton(form,"Activate actions",false)&&HasButton(form,"Start isolated test",false)?0:1;
            var screenshot=Environment.GetEnvironmentVariable("TREADORY_UI_SCREENSHOT");
            if(screenshot!=null){using var image=new Bitmap(form.Width,form.Height);form.DrawToBitmap(image,new Rectangle(Point.Empty,form.Size));image.Save(screenshot,System.Drawing.Imaging.ImageFormat.Png);}
            form.Close();return;
        }
        if(args.Length!=0){MessageBox.Show("Unsupported command. Open Treadory normally to configure your pedal.","Treadory");return;}
        Application.Run(new MainForm());
    }
}
