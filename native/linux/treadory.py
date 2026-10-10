#!/usr/bin/python3
"""Linux preview: isolates one verified button-only evdev node. No broad mouse grab."""
import glob
import json
import multiprocessing as mp
import os
from pathlib import Path
import select
import signal
import time
from policy import ACTIONS, CONTROLS, Decoder, eligible, settings

def inventory():
    # Inspect sysfs identities first: do not mistake an unreadable matching node for absence.
    from evdev import InputDevice
    found = []
    for path in sorted(glob.glob('/dev/input/event*')):
        ident = Path('/sys/class/input') / Path(path).name / 'device/id'
        try:
            vendor = int((ident / 'vendor').read_text().strip(), 16)
            product = int((ident / 'product').read_text().strip(), 16)
        except OSError as error:
            raise RuntimeError('Device identity unavailable; cannot safely establish uniqueness') from error
        if (vendor, product) != (0x05f3, 0xff):
            continue
        ancestry=(ident.parent.resolve(),*ident.parent.resolve().parents)
        if not any((parent/'idVendor').exists() and (parent/'idProduct').exists() and (parent/'idVendor').read_text().strip().lower()=='05f3' and (parent/'idProduct').read_text().strip().lower()=='00ff' for parent in ancestry):
            raise RuntimeError('Matching node lacks verified USB ancestry; virtual input is not a physical pedal')
        with InputDevice(path) as device:
            caps = device.capabilities()
            if not eligible(vendor, product, caps.get(1, []), caps.keys()):
                raise RuntimeError('Matching VEC node has unsupported/composite input capabilities')
            stat = os.stat(path)
            found.append((path, device.name, device.phys, device.uniq, stat.st_rdev, stat.st_ino))
    return found

def _worker(pipe):
    from evdev import InputDevice, UInput, ecodes as e
    device = output = pointer = None
    selected = None; decoder = Decoder(); active = False; lease = time.monotonic(); config = settings({'version':1,'mappings':dict.fromkeys(CONTROLS,'none')})
    def report(message):
        pipe.send((message, device is not None, active, list(decoder.learned)))
    def stop(message):
        nonlocal device, output, pointer, selected, decoder, active
        active = False
        if device:
            try: device.ungrab()
            except OSError: pass
            device.close()
        if output: output.close()
        if pointer: pointer.close()
        device = output = pointer = selected = None; decoder = Decoder(); report(message)
    def terminate(*_): raise SystemExit()
    signal.signal(signal.SIGTERM, terminate)
    key_actions = {'media':e.KEY_PLAYPAUSE,'space':e.KEY_SPACE,'enter':e.KEY_ENTER, **{f'f{n}':getattr(e,f'KEY_F{n}') for n in range(13,25)}}
    import dbus
    bus = dbus.SystemBus()
    manager_props = dbus.Interface(bus.get_object('org.freedesktop.login1','/org/freedesktop/login1'),'org.freedesktop.DBus.Properties')
    login = dbus.Interface(bus.get_object('org.freedesktop.login1','/org/freedesktop/login1'),'org.freedesktop.login1.Manager')
    session_path = login.GetSessionByPID(os.getpid())
    session_props = dbus.Interface(bus.get_object('org.freedesktop.login1',session_path),'org.freedesktop.DBus.Properties')
    def normal_session():
        properties = session_props.GetAll('org.freedesktop.login1.Session',timeout=1)
        return bool(properties.get('Active')) and not bool(properties.get('LockedHint')) and not bool(manager_props.Get('org.freedesktop.login1.Manager','PreparingForSleep',timeout=1))
    last_inventory = 0
    try:
        while True:
            if pipe.poll():
                command, value = pipe.recv()
                if command == 'ping':
                    if isinstance(value,(int,float)) and lease <= value <= time.monotonic(): lease = value
                elif command == 'quit': break
                elif command == 'stop': stop('Capture stopped; original pedal input restored.')
                elif command == 'configure':
                    if active: raise RuntimeError('Pause actions before configuration')
                    config = settings(value); report('Saved actions loaded. Activation remains explicit.')
                elif command == 'inspect':
                    if device: raise RuntimeError('Stop before inspection')
                    items = inventory(); selected = items[0] if len(items) == 1 else None
                    report(f'{len(items)} matching button-only VEC nodes. ' + (f'{selected[1]} · {selected[0]} · 05f3:00ff. Candidate, physically unverified.' if selected else 'Exactly one is required. No device selected.'))
                elif command == 'start':
                    if device or not value or selected is None or inventory() != [selected] or not normal_session(): raise RuntimeError('Inspect one device, review recovery, and release pedals first')
                    device = InputDevice(selected[0])
                    opened = os.fstat(device.fd)
                    if (opened.st_rdev, opened.st_ino) != selected[-2:] or not eligible(device.info.vendor, device.info.product, device.capabilities().get(1, []), device.capabilities().keys()): raise RuntimeError('Endpoint changed during opening')
                    if device.active_keys(): raise RuntimeError('Release the pedals before capture')
                    device.grab()
                    if device.active_keys(): raise RuntimeError('Pedal pressed during capture start; release and inspect again')
                    decoder = Decoder(); active = False
                    # Separate outputs permit udev/libinput to classify a real pointer
                    # and keys. Pointer axes/buttons are advertised, never injected.
                    output = UInput({e.EV_KEY:list(key_actions.values())},name='Treadory configured keys',vendor=0x1209,product=0x5452)
                    pointer = UInput({e.EV_KEY:[e.BTN_LEFT,e.BTN_MIDDLE,e.BTN_RIGHT],e.EV_REL:[e.REL_X,e.REL_Y,e.REL_WHEEL]},name='Treadory configured scroll',vendor=0x1209,product=0x5452)
                    report('Isolated test; originals grabbed. Learn each physical pedal. Check ordinary mouse and original outputs in another app.')
                elif command == 'learn':
                    if not device or active: raise RuntimeError('Start test/pause before learning')
                    decoder.learn(value); report(f'Press and release only {value}.')
                elif command == 'activate':
                    if not device or not value or len(decoder.learned) != 3 or decoder.learning or decoder.held: raise RuntimeError('Learn/release three pedals and verify original outputs and ordinary mouse')
                    active = True; report('Actions active. Linux OS timing guard is unavailable in this preview.')
                elif command == 'pause': active = False; report('Actions paused; original pedal outputs remain grabbed. Stop restores input.')
            now = time.monotonic()
            if device and now - lease >= 5: stop('Settings heartbeat expired; capture stopped.')
            if device and now - last_inventory >= .1:
                last_inventory = now
                if inventory() != [selected] or not normal_session(): stop('Device or login session changed; inspect and learn again.')
            if not device:
                time.sleep(.02); continue
            if not select.select([device], [], [], .02)[0]: continue
            for event in device.read():
                if event.type == e.EV_SYN:
                    if event.code == e.SYN_DROPPED: raise RuntimeError('Input overflow; capture stopped')
                    continue
                if event.type == e.EV_MSC and event.code == e.MSC_SCAN: continue
                if event.type != e.EV_KEY: raise RuntimeError('Unsupported endpoint event')
                pressed = decoder.event(event.code, event.value)
                if active:
                    for control in pressed:
                        action = config['mappings'][control]
                        if action == 'none': continue
                        if action in ('scrollUp','scrollDown'):
                            pointer.write(e.EV_REL,e.REL_WHEEL,1 if action == 'scrollUp' else -1); pointer.syn()
                        else:
                            key = key_actions[action]
                            try:
                                output.write(e.EV_KEY,key,1);output.syn()
                            finally:
                                output.write(e.EV_KEY,key,0);output.syn()
                if not active: report('Isolated / paused; learned: ' + ', '.join(decoder.learned))
    except (EOFError, BrokenPipeError, SystemExit):
        pass
    except Exception as error:
        try: report(f'Capture failed: {error}. Restart and inspect again.')
        except (EOFError, BrokenPipeError): pass
    finally:
        if device:
            try: device.ungrab()
            except OSError: pass
            device.close()
        if output: output.close()
        if pointer: pointer.close()
        pipe.close()

def worker(pipe):
    try:
        _worker(pipe)
    except Exception as error:
        try: pipe.send((f'Worker startup failed: {error}. Review dependencies, permissions and the normal logind session.',False,False,[]))
        except (OSError,EOFError): pass
    finally:
        pipe.close()

def main():
    import tkinter as tk
    from tkinter import ttk
    try: import evdev  # explicit startup dependency check
    except ImportError: raise SystemExit('Install python3-evdev and python3-tk from your distribution. See README.md.')
    import dbus
    from dbus.mainloop.glib import DBusGMainLoop
    from gi.repository import GLib
    DBusGMainLoop(set_as_default=True)
    root=tk.Tk();root.title('Treadory · Linux developer preview');root.geometry('840x820');root.configure(bg='#eeede9')
    canvas=tk.Canvas(root,bg='#eeede9',highlightthickness=0);scroll=ttk.Scrollbar(root,orient='vertical',command=canvas.yview);canvas.configure(yscrollcommand=scroll.set);scroll.pack(side='right',fill='y');canvas.pack(side='left',fill='both',expand=True)
    panel=tk.Frame(canvas,bg='#fafaf7',padx=24,pady=24);item=canvas.create_window((0,0),window=panel,anchor='nw');canvas.bind('<Configure>',lambda event:canvas.itemconfigure(item,width=event.width));panel.bind('<Configure>',lambda _:canvas.configure(scrollregion=canvas.bbox('all')))
    def text(value,size=11): tk.Label(panel,text=value,bg='#fafaf7',fg='#242722',justify='left',wraplength=740,font=('Sans',size)).pack(anchor='w',pady=8)
    text('Your pedal. Across your computer.',23);text('LINUX · EXPERIMENTAL · PHYSICAL AND DESKTOP VERIFICATION PENDING')
    text('Standalone evdev/uinput control, independent of Chrome. One VEC 05f3:00ff button-only node is eligible. Composite/ambiguous devices fail safely. Never run this GUI as root. Grant narrow device permissions first; see README.md.')
    parent,child=mp.Pipe();process=mp.Process(target=worker,args=(child,),daemon=True);process.start();child.close()
    message=tk.StringVar(value='No input captured. Inspect to begin.');tk.Label(panel,textvariable=message,bg='#fafaf7',wraplength=740,justify='left').pack(anchor='w',pady=8)
    reviewed=tk.BooleanVar();verified=tk.BooleanVar();captures=False;enabled=False
    file=Path(os.environ.get('XDG_CONFIG_HOME',str(Path.home()/'.config')))/'treadory/settings.json'
    config={'version':1,'mappings':dict.fromkeys(CONTROLS,'none')}
    try:
        if file.exists() and file.stat().st_size<=8192: config=settings(json.loads(file.read_text()))
    except (ValueError,OSError): message.set('Invalid saved settings; defaults loaded without capture.')
    maps={c:tk.StringVar(value=config['mappings'][c]) for c in CONTROLS};widgets=[]
    def send(command,value=None):
        try: parent.send((command,value))
        except (BrokenPipeError,OSError): message.set('Worker unavailable. Original grabs are released when it exits. Restart app.')
    bus=dbus.SystemBus()
    bus.add_signal_receiver(lambda sleeping:send('stop') if sleeping else None,signal_name='PrepareForSleep',dbus_interface='org.freedesktop.login1.Manager',bus_name='org.freedesktop.login1')
    def button(name,command):
        b=tk.Button(panel,text=name,command=command,bg='#c7470b',fg='white',padx=12,pady=6);b.pack(anchor='w',pady=5);return b
    button('Inspect pedal',lambda:send('inspect'));tk.Checkbutton(panel,text='I reviewed recovery and exclusive pedal capture.',variable=reviewed,bg='#fafaf7').pack(anchor='w');button('Start isolated test',lambda:send('start',reviewed.get()))
    for c in CONTROLS:
        text(c.capitalize());menu=ttk.Combobox(panel,textvariable=maps[c],values=ACTIONS,state='readonly');menu.pack(anchor='w');widgets.append(menu);button('Learn '+c,lambda c=c:send('learn',c))
    def save():
        if enabled: message.set('Pause actions before changing saved actions.');return
        verified.set(False)
        try:
            value=settings({'version':1,'mappings':{c:maps[c].get() for c in CONTROLS}});file.parent.mkdir(parents=True,exist_ok=True);temporary=file.with_suffix('.tmp');temporary.write_text(json.dumps(value));temporary.replace(file);send('configure',value)
        except (ValueError,OSError) as error: message.set(str(error))
    button('Save actions',save)
    text('250 ms OS click guard: UNAVAILABLE in this Linux preview. Device-specific pedal grabs remain available. A full Wayland-compatible guard needs a separately validated ordinary-mouse forwarding worker. This app never grabs your ordinary mouse.')
    tk.Checkbutton(panel,text='I verified original outputs are absent and my ordinary mouse works.',variable=verified,bg='#fafaf7').pack(anchor='w');button('Activate actions',lambda:send('activate',verified.get()));button('Pause actions',lambda:send('pause'));button('Stop capture',lambda:send('stop'))
    text('Pause retains pedal suppression. Stop restores it. Ctrl+Alt+Shift+F12 stops while this window is focused. Emergency recovery from another app: unplug the pedal or terminate Treadory using the desktop process manager. UI heartbeat loss releases capture after 5 seconds. Requires systemd-logind; session/lock/sleep changes stop capture. Desktop behavior is unverified: stop before locking or sleeping.')
    root.bind('<Control-Alt-Shift-F12>',lambda _:send('stop'))
    text('Media play/pause depends on desktop shortcuts; seeking needs a player shortcut/integration and is not universal. No telemetry, network listener or global input log. Creator: Ronit Gandotra.')
    def poll():
        nonlocal captures,enabled
        while GLib.MainContext.default().pending(): GLib.MainContext.default().iteration(False)
        send('ping',time.monotonic())
        while parent.poll():
            try: msg,captures,enabled,_=parent.recv();message.set(msg);[widget.configure(state='disabled' if enabled else 'readonly') for widget in widgets]
            except EOFError:
                captures=enabled=False
                message.set(message.get()+' Worker stopped; restart the app to inspect again.');return
        if not process.is_alive():
            captures=enabled=False
            message.set(message.get()+' Worker exited; kernel grabs closed. Restart app.');return
        root.after(200,poll)
    def close():
        send('quit');process.join(1)
        if process.is_alive(): process.terminate();process.join(1)
        parent.close();root.destroy()
    root.protocol('WM_DELETE_WINDOW',close);send('configure',config);poll()
    import sys
    if '--ui-test' in sys.argv:
        def ui_check():
            assert not captures
            print('PASS Linux GUI startup; no capture activated.')
            close()
        root.after(500,ui_check)
    root.mainloop()
if __name__=='__main__':
    mp.set_start_method('spawn');main()
