#!/usr/bin/env python3
"""Compile/package native previews; record actual source and output integrity."""
import hashlib
import io
import os
import json
from pathlib import Path
import plistlib
import shutil
import subprocess
import sys
import tarfile
import tempfile
import zipfile
VERSION = '0.3.0'
ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'native/platform-distributions'
def digest(path): return hashlib.sha256(path.read_bytes()).hexdigest()
def sources(platform):
    files=sorted((ROOT/'native'/platform).glob('*'))
    return {str(p.relative_to(ROOT)):digest(p) for p in files if p.is_file()} | {'scripts/package-platforms.py':digest(Path(__file__))}
def record(platform, artifact, before, extra):
    if before != sources(platform): raise RuntimeError('Source changed during build; rebuild')
    metadata={'format':1,'version':VERSION,'platform':platform,'preview':True,'physicalVerification':False,'artifact':artifact.name,'bytes':artifact.stat().st_size,'sha256':digest(artifact),'sources':before,**extra}
    (OUT/f'{platform}-release.json').write_text(json.dumps(metadata,indent=2)+'\n')
def macos(gui=False):
    before=sources('macos');name=f'Treadory-{VERSION}-macos-arm64-preview.zip'
    with tempfile.TemporaryDirectory(prefix='treadory-macos-') as tmp:
        app=Path(tmp)/'Treadory.app';binary=app/'Contents/MacOS/Treadory';resources=app/'Contents/Resources';binary.parent.mkdir(parents=True);resources.mkdir()
        subprocess.run(['swiftc','-swift-version','5','-O','-target','arm64-apple-macos14.0','-module-cache-path',str(Path(tmp)/'cache'),*[str(ROOT/'native/macos'/p) for p in ['Policy.swift','Backend.swift','main.swift']],'-o',str(binary),'-framework','AppKit','-framework','IOKit','-framework','ApplicationServices'],check=True)
        subprocess.run([str(binary),'--self-test'],check=True)
        shutil.copy(ROOT/'native/macos/README.md',resources/'README.md')
        (app/'Contents/Info.plist').write_bytes(plistlib.dumps({'CFBundleIdentifier':'com.treadory.pedal','CFBundleName':'Treadory','CFBundleExecutable':'Treadory','CFBundlePackageType':'APPL','CFBundleShortVersionString':VERSION,'CFBundleVersion':VERSION,'LSMinimumSystemVersion':'14.0','NSHighResolutionCapable':True,'NSInputMonitoringUsageDescription':'Read the supported pedal and apply the optional click guard only after explicit activation.'}))
        subprocess.run(['codesign','--force','--sign','-',str(app)],check=True)
        subprocess.run(['codesign','--verify','--deep','--strict',str(app)],check=True)
        if gui:
            (ROOT/'test-results').mkdir(exist_ok=True)
            subprocess.run([str(binary),'--ui-test'],check=True,timeout=15,env={**os.environ,'TREADORY_MAC_UI_SCREENSHOT':str(ROOT/'test-results/treadory-macos-ui.png')})
        with zipfile.ZipFile(OUT/name,'w',zipfile.ZIP_DEFLATED) as archive:
            for path in sorted(app.rglob('*')):
                if path.is_file(): archive.write(path,str(path.relative_to(Path(tmp))))
    record('macos',OUT/name,before,{'architecture':'arm64','minOS':'14.0','developerIDSigned':False,'notarized':False,'adHocSigned':True,'policyTests':True,'guiStartupVerified':gui,'osInputVerified':False})
def tar(entries):
    result=io.BytesIO()
    with tarfile.open(fileobj=result,mode='w:gz',format=tarfile.USTAR_FORMAT) as archive:
        # dpkg needs directory members before nested files; tar extraction alone
        # can create them implicitly and therefore is not an installation test.
        directories=set()
        for name,_,_ in entries:
            directories.update(str(p) for p in Path(name).parents if str(p) != '.')
        for name in sorted(directories,key=lambda p:(p.count('/'),p)):
            info=tarfile.TarInfo(name+'/');info.type=tarfile.DIRTYPE;info.mode=0o755;info.mtime=0;info.uid=info.gid=0;info.uname=info.gname='root';archive.addfile(info)
        for name,data,mode in entries:
            info=tarfile.TarInfo(name);info.size=len(data);info.mode=mode;info.mtime=0;info.uid=info.gid=0;info.uname=info.gname='root';archive.addfile(info,io.BytesIO(data))
    return result.getvalue()
def linux():
    before=sources('linux');name=f'Treadory-{VERSION}-linux-all-preview.deb'
    control=f'Package: treadory\nVersion: {VERSION}\nArchitecture: all\nMaintainer: Ronit Gandotra\nDepends: python3 (>= 3.10), python3-tk, python3-evdev, python3-dbus, python3-gi, systemd\nSection: utils\nPriority: optional\nDescription: Experimental standalone VEC pedal configuration and evdev isolation\n Physical and desktop input verification pending. OS timing guard unavailable.\n'
    payload=[('usr/lib/treadory/'+p.name,p.read_bytes(),0o644) for p in sorted((ROOT/'native/linux').glob('*.py'))]
    payload += [('usr/share/doc/treadory/README.md',(ROOT/'native/linux/README.md').read_bytes(),0o644),('usr/bin/treadory',b'#!/bin/sh\nexec /usr/bin/python3 /usr/lib/treadory/treadory.py "$@"\n',0o755),('usr/share/applications/treadory.desktop',b'[Desktop Entry]\nType=Application\nName=Treadory\nComment=Experimental foot pedal control\nExec=/usr/bin/treadory\nTerminal=false\nCategories=Utility;Accessibility;\n',0o644)]
    members=[('debian-binary',b'2.0\n'),('control.tar.gz',tar([('control',control.encode(),0o644)])),('data.tar.gz',tar(payload))]
    with (OUT/name).open('wb') as file:
        file.write(b'!<arch>\n')
        for member,data in members:
            header=f'{member+"/":<16}{0:<12}{0:<6}{0:<6}{"100644":<8}{len(data):<10}`\n'.encode();assert len(header)==60;file.write(header);file.write(data)
            if len(data)%2: file.write(b'\n')
    record('linux',OUT/name,before,{'architecture':'all','runtimeBundled':False,'signed':False,'runtimeVerified':False,'osInputVerified':False,'clickGuardAvailable':False})
if __name__=='__main__':
    OUT.mkdir(parents=True,exist_ok=True)
    if sys.argv[1:] in (['macos'],['macos','--gui-test']): macos('--gui-test' in sys.argv)
    elif sys.argv[1:] == ['linux']: linux()
    else: raise SystemExit('Usage: package-platforms.py macos|linux')
