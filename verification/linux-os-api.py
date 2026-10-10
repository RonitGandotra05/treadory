"""Real kernel API check with virtual input only. Never opens a real input node."""
import os
import select
import time
import multiprocessing as mp
import signal
from evdev import UInput, InputDevice, ecodes as e

def grab(path, ready):
    device=InputDevice(path);device.grab();ready.send(True)
    while True: time.sleep(1)
def run():
    if not os.path.exists('/dev/uinput'):
        print('SKIP Linux kernel input check: /dev/uinput unavailable; real API/crash proof remains a release gate.');return
    with UInput({e.EV_KEY:[e.BTN_LEFT,e.BTN_MIDDLE,e.BTN_RIGHT]},name='Treadory CI virtual fixture',vendor=0x1209,product=0x5452) as virtual:
        path=virtual.device.path
        observer=InputDevice(path);owner=InputDevice(path);owner.grab()
        virtual.write(e.EV_KEY,e.BTN_RIGHT,1);virtual.syn()
        assert select.select([owner],[],[],1)[0];assert not select.select([observer],[],[],.1)[0]
        list(owner.read());owner.close()
        virtual.write(e.EV_KEY,e.BTN_RIGHT,0);virtual.syn()
        assert select.select([observer],[],[],1)[0];list(observer.read())
        parent,child=mp.Pipe();process=mp.Process(target=grab,args=(path,child));process.start();assert parent.poll(3) and parent.recv()
        os.kill(process.pid,signal.SIGKILL);process.join(3);assert not process.is_alive()
        virtual.write(e.EV_KEY,e.BTN_LEFT,1);virtual.syn();assert select.select([observer],[],[],1)[0]
        virtual.write(e.EV_KEY,e.BTN_LEFT,0);virtual.syn();observer.close()
    print('PASS Linux real evdev/uinput virtual fixture: exclusive grab, ordinary reader exclusion, close and SIGKILL restore. No physical pedal/compositor assertion.')
if __name__=='__main__': run()
