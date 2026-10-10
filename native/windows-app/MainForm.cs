using System.Diagnostics;
using System.Reflection;
using Microsoft.Win32;
namespace Treadory;
internal sealed class MainForm : Form
{
    private static readonly Color Paper=Color.FromArgb(250,250,247), Page=Color.FromArgb(238,237,233), Ink=Color.FromArgb(36,39,34), Muted=Color.FromArgb(102,107,99), Accent=Color.FromArgb(199,71,11);
    private readonly string settingsPath=Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),"Treadory","settings.json");
    private readonly string dllPath=Path.Combine(AppContext.BaseDirectory,"interception.dll");
    private AppSettings settings;
    private readonly AppRunner runner;
    private readonly System.Windows.Forms.Timer timer=new() {Interval=100};
    private readonly FlowLayoutPanel root=new() {Dock=DockStyle.Fill,FlowDirection=FlowDirection.TopDown,WrapContents=false,AutoScroll=true,Padding=new Padding(24)};
    private readonly Label status=TextLabel("Inspect your pedal to begin.",12);
    private readonly Label live=TextLabel("Capture stopped · original input available",10);
    private readonly CheckBox reviewed=Check("I understand original pedal input is suppressed during testing; Stop capture restores it.");
    private readonly CheckBox outputs=Check("I tested the pedal in another app: unwanted original outputs are absent.");
    private readonly CheckBox mouse=Check("I tested my ordinary mouse: its clicks and movement still work.");
    private readonly Button inspect=Button("Inspect pedal"),start=Button("Start isolated test",true),activate=Button("Activate actions",true),pause=Button("Pause actions"),stop=Button("Stop capture");
    private readonly ComboBox[] maps=Engine.Controls.Select(_=>new ComboBox {DropDownStyle=ComboBoxStyle.DropDownList,Width=210,Font=new Font("Segoe UI",10),AccessibleName="Pedal action"}).ToArray();
    private readonly Button[] learns=Engine.Controls.Select(c=>Button("Learn "+c)).ToArray();
    private readonly Label[] learned=Engine.Controls.Select(_=>TextLabel("Not learned",10)).ToArray();
    private readonly Button save=Button("Save actions"),import=Button("Import verified x64 DLL"),clear=Button("Clear saved settings");
    private readonly TextBox hash=new() {Width=510,PlaceholderText="Independently verified SHA-256 (64 hexadecimal characters)",AccessibleName="Trusted driver SHA-256"};
    private readonly CheckBox licensed=Check("I obtained the official DLL and my use complies with its applicable license.");
    private bool mapsDirty;
    private bool wasCapturing; private long lastPing;
    internal MainForm()
    {
        Text="Treadory · Computer-wide pedal control";BackColor=Page;ForeColor=Ink;Font=new Font("Segoe UI",10);Size=new Size(860,870);MinimumSize=new Size(760,580);AutoScaleMode=AutoScaleMode.Dpi;StartPosition=FormStartPosition.CenterScreen;
        try {settings=SettingsStore.Load(settingsPath);}catch {settings=AppSettings.Default;MessageBox.Show("Saved settings were invalid or unreadable. Defaults loaded; no input is captured.","Treadory");}
        runner=new AppRunner(new AppSession(new AppPlatform(),()=>new AppBackend(),()=>{
            if(settings.DriverHash==null)throw new InvalidOperationException("Matching VEC mouse endpoint found. Use Setup & recovery to import your licensed driver DLL before replacement.");
            DriverFile.Verify(dllPath,settings.DriverHash,true);
        }));
        Controls.Add(root);
        var heading=TextLabel("Your pedal. Across your computer.",23,true);root.Controls.Add(heading);
        root.Controls.Add(TextLabel("WINDOWS X64 · STANDALONE DEVELOPER PREVIEW",9,true));
        root.Controls.Add(TextLabel("No Chrome extension needed. Configure your pedal here, then keep this app open while using normal desktop apps. Physical Windows verification is pending.",11));
        var device=Card("01  INSPECT & CONNECT");device.Controls.Add(TextLabel("Supported: one uniquely identified VEC 05f3:00ff mouse endpoint. Quit other pedal/remapping tools and disconnect browser pedal readers first. Inspection changes no input.",10));
        device.Controls.Add(Row(inspect,start,stop));device.Controls.Add(reviewed);device.Controls.Add(status);device.Controls.Add(live);root.Controls.Add(device);
        inspect.Click+=(_,_)=>runner.Send(s=>s.Inspect());start.Click+=(_,_)=>{var consent=reviewed.Checked;outputs.Checked=mouse.Checked=false;runner.Send(s=>s.Start(consent,Environment.TickCount64));};stop.Click+=(_,_)=>runner.Send(s=>s.Stop());
        var actions=Card("02  LEARN & CHOOSE ACTIONS");actions.Controls.Add(TextLabel("Learn each physical pedal with a full press and release. Learning is repeated for each capture session; saved actions stay local.",10));
        for(var i=0;i<3;i++){
            var control=Engine.Controls[i];var index=i;maps[i].AccessibleName=control+" pedal action";
            foreach(var action in Engine.Actions)maps[i].Items.Add(new ActionItem(action));maps[i].SelectedIndex=Array.IndexOf(Engine.Actions,settings.Mappings[control]);maps[i].SelectedIndexChanged+=(_,_)=>{mapsDirty=true;outputs.Checked=mouse.Checked=false;};
            learns[i].Click+=(_,_)=>runner.Send(s=>s.Learn(control));actions.Controls.Add(Row(TextLabel(char.ToUpperInvariant(control[0])+control[1..],11,true),maps[i],learns[i],learned[index]));
        }
        actions.Controls.Add(Row(save,clear));save.Click+=(_,_)=>Ui(()=>{
            var values=Engine.Controls.Select((c,i)=>(c,((ActionItem)maps[i].SelectedItem!).Value)).ToDictionary(p=>p.c,p=>p.Value);
            var updated=settings with {Mappings=values};SettingsStore.Save(settingsPath,updated);settings=updated;mapsDirty=false;runner.Send(s=>s.Configure(values));outputs.Checked=mouse.Checked=false;
        });
        clear.Click+=(_,_)=>Ui(()=>{if(File.Exists(settingsPath))File.Delete(settingsPath);settings=AppSettings.Default;for(var i=0;i<3;i++)maps[i].SelectedIndex=0;runner.Send(s=>{s.Stop();s.Configure(settings.Mappings);});MessageBox.Show("Saved settings cleared. Imported DLL and separately installed driver remain; see removal instructions.","Treadory");});root.Controls.Add(actions);
        var verify=Card("03  VERIFY & ACTIVATE");verify.Controls.Add(outputs);verify.Controls.Add(mouse);verify.Controls.Add(Row(activate,pause));verify.Controls.Add(TextLabel("Pause stops chosen actions but keeps original pedal outputs suppressed. Stop capture restores originals. Actions run in normal apps and Windows browsers; elevated apps and secure desktops are excluded.",10));root.Controls.Add(verify);
        activate.Click+=(_,_)=>{var a=outputs.Checked;var b=mouse.Checked;runner.Send(s=>s.Enable(true,a,b));};pause.Click+=(_,_)=>runner.Send(s=>s.Enable(false,false,false));
        var setup=Card("SETUP & RECOVERY");setup.Controls.Add(TextLabel("Original-output replacement requires a separately licensed Interception driver. Install it using its official administrator tool and reboot as instructed. Importing a DLL here does not install its driver. Treadory does not bundle or download either.",10));
        setup.Controls.Add(Row(Link("Official driver & licensing", "https://github.com/oblitum/Interception"),Link("GitHub source", "https://github.com/RonitGandotra05/treadory")));
        setup.Controls.Add(hash);setup.Controls.Add(licensed);setup.Controls.Add(import);import.Click+=(_,_)=>Ui(()=>{
            using var chooser=new OpenFileDialog {Filter="Interception DLL|interception.dll",Title="Choose your trusted official x64 Interception DLL",CheckFileExists=true};if(chooser.ShowDialog(this)!=DialogResult.OK)return;
            var expected=hash.Text.Trim();DriverFile.Import(chooser.FileName,dllPath,expected,licensed.Checked);
            var updated=settings with {DriverHash=expected.ToLowerInvariant()};SettingsStore.Save(settingsPath,updated);settings=updated;MessageBox.Show("Verified DLL copied beside Treadory.exe. Inspect your pedal after driver installation. Restart if replacing an earlier integration.","Treadory");
        });
        setup.Controls.Add(TextLabel("Recovery: Ctrl + Alt + Shift + F12. Closing, lock/sleep, device changes or loss of the settings-window heartbeat stops capture. No automatic capture, startup service, network listener or telemetry.",10));
        var guide=Button("Full setup & removal guide");guide.Click+=(_,_)=>ShowResource("README.md","Setup & recovery");var notices=Button("License notices");notices.Click+=(_,_)=>ShowResource("DOTNET-APPHOST-LICENSE.txt","Runtime licenses", "DOTNET-THIRD-PARTY-NOTICES.txt");setup.Controls.Add(Row(guide,notices));root.Controls.Add(setup);
        root.Controls.Add(Row(TextLabel("Created by Ronit Gandotra",10,true),Link("GitHub","https://github.com/RonitGandotra05"),Link("LinkedIn","https://www.linkedin.com/in/ronitgandotra")));
        runner.Send(s=>s.Configure(settings.Mappings));
        timer.Tick+=(_,_)=>RefreshState();timer.Start();Resize+=(_,_)=>LayoutCards();Shown+=(_,_)=>{LayoutCards();RefreshState();};
        SystemEvents.SessionSwitch+=SessionChanged;SystemEvents.PowerModeChanged+=PowerChanged;
        FormClosed+=(_,_)=>{timer.Stop();timer.Dispose();SystemEvents.SessionSwitch-=SessionChanged;SystemEvents.PowerModeChanged-=PowerChanged;runner.Dispose();};
    }
    private void RefreshState()
    {
        var state=runner.State;var now=Environment.TickCount64;if(now-lastPing>=1000){lastPing=now;runner.Send(s=>s.Ping(now));}
        if(wasCapturing!=state.Capturing){outputs.Checked=mouse.Checked=false;reviewed.Checked=false;wasCapturing=state.Capturing;}
        status.Text=state.Message;live.Text=state.Capturing?$"{(state.Enabled?"Active":"Isolated / paused")} · {state.Presses} chosen actions · held mask {state.Held}":"Capture stopped · original input available";
        inspect.Enabled=!state.Capturing;start.Enabled=!state.Capturing&&state.Ready&&reviewed.Checked;stop.Enabled=state.Capturing;pause.Enabled=state.Enabled;
        activate.Enabled=!mapsDirty&&state.Capturing&&!state.Enabled&&state.Learned.Length==3&&state.Learning==null&&state.Held==0&&outputs.Checked&&mouse.Checked;
        save.Enabled=clear.Enabled=import.Enabled=hash.Enabled=licensed.Enabled=!state.Enabled&&!state.Capturing; // Stop before changing persistent integration/mappings.
        // Saving actions during an isolated session is safe and explicitly disables activation.
        save.Enabled=!state.Enabled;foreach(var map in maps)map.Enabled=!state.Enabled;
        for(var i=0;i<3;i++){learns[i].Enabled=state.Capturing&&!state.Enabled&&state.Held==0;learned[i].Text=state.Learning==Engine.Controls[i]?"Press & release…":state.Learned.Contains(Engine.Controls[i])?"Learned ✓":"Not learned";}
    }
    private void SessionChanged(object sender,SessionSwitchEventArgs e)=>runner.Send(s=>s.Stop("Windows session changed. Original input restored."));
    private void PowerChanged(object sender,PowerModeChangedEventArgs e)=>runner.Send(s=>s.Stop("Windows power state changed. Original input restored."));
    private void LayoutCards(){var width=Math.Max(660,ClientSize.Width-70);foreach(Control child in root.Controls){child.Width=width;if(child is Label label)label.MaximumSize=new Size(width,0);if(child is FlowLayoutPanel card)foreach(Control item in card.Controls)if(item is Label or CheckBox)item.MaximumSize=new Size(width-36,0);}}
    private static void Ui(Action action){try{action();}catch(Exception error){MessageBox.Show(error is IOException or InvalidDataException or UnauthorizedAccessException?error.Message:"The operation failed. No activation was requested.","Treadory",MessageBoxButtons.OK,MessageBoxIcon.Information);}}
    private static Label TextLabel(string text,int size,bool bold=false)=>new(){Text=text,AutoSize=true,MaximumSize=new Size(710,0),Margin=new Padding(0,4,0,10),Font=new Font("Segoe UI",size,bold?FontStyle.Bold:FontStyle.Regular),ForeColor=bold?Ink:Muted};
    private static CheckBox Check(string text)=>new(){Text=text,AutoSize=true,MaximumSize=new Size(700,0),Margin=new Padding(0,6,0,8),AccessibleName=text};
    private static Button Button(string text,bool primary=false)=>new(){Text=text,AutoSize=true,Padding=new Padding(10,6,10,6),Margin=new Padding(0,4,10,8),FlatStyle=FlatStyle.Flat,BackColor=primary?Accent:Paper,ForeColor=primary?Paper:Ink,AccessibleName=text};
    private static FlowLayoutPanel Row(params Control[] controls){var row=new FlowLayoutPanel {AutoSize=true,WrapContents=true,MaximumSize=new Size(710,0),Margin=new Padding(0)};row.Controls.AddRange(controls);return row;}
    private static FlowLayoutPanel Card(string title){var card=new FlowLayoutPanel {FlowDirection=FlowDirection.TopDown,WrapContents=false,AutoSize=true,BackColor=Paper,Padding=new Padding(18),Margin=new Padding(0,12,0,6)};card.Controls.Add(TextLabel(title,10,true));return card;}
    private static LinkLabel Link(string text,string url){var link=new LinkLabel {Text=text+" ↗",AutoSize=true,LinkColor=Accent,ActiveLinkColor=Accent,VisitedLinkColor=Accent,Margin=new Padding(0,6,14,8),AccessibleName=text};link.LinkClicked+=(_,_)=>Ui(()=>Process.Start(new ProcessStartInfo(url){UseShellExecute=true}));return link;}
    private static void ShowResource(string suffix,string title,string? extra=null)
    {
        var assembly=Assembly.GetExecutingAssembly();string Read(string name){using var stream=assembly.GetManifestResourceStream(assembly.GetManifestResourceNames().Single(n=>n.EndsWith(name,StringComparison.Ordinal)))!;using var reader=new StreamReader(stream);return reader.ReadToEnd();}
        using var window=new Form {Text="Treadory · "+title,Size=new Size(780,640),BackColor=Page,StartPosition=FormStartPosition.CenterParent};window.Controls.Add(new TextBox {Multiline=true,ReadOnly=true,ScrollBars=ScrollBars.Vertical,Dock=DockStyle.Fill,BackColor=Paper,ForeColor=Ink,Font=new Font("Segoe UI",10),Text=Read(suffix)+(extra==null?"":"\r\n\r\n"+Read(extra))});window.ShowDialog();
    }
    private sealed record ActionItem(string Value){public override string ToString()=>Value switch {"none"=>"No action","media"=>"Media play / pause","scrollUp"=>"Scroll up","scrollDown"=>"Scroll down","space"=>"Space","enter"=>"Enter",_=>Value.ToUpperInvariant()};}
}
