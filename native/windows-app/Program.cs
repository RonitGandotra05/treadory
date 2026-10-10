using System.Runtime.InteropServices;
namespace Treadory;
internal static class Program
{
    [STAThread] private static void Main(string[] args)
    {
        if(args.SequenceEqual(new[]{"--self-test"})) {Environment.ExitCode=AppTests.Run();return;}
        if(RuntimeInformation.OSArchitecture!=Architecture.X64||RuntimeInformation.ProcessArchitecture!=Architecture.X64){MessageBox.Show("This preview requires Windows x64. ARM64/emulation is unsupported.","Treadory");return;}
        using var instance=new Mutex(true,@"Local\Treadory.Standalone.Pedal",out var first);
        if(!first){MessageBox.Show("Treadory is already open. Use its existing window.","Treadory");return;}
        ApplicationConfiguration.Initialize();
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
