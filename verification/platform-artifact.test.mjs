import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {createHash} from 'node:crypto';import {execFileSync} from 'node:child_process';
const sha=b=>createHash('sha256').update(b).digest('hex');
for(const platform of ['macos','linux'])test(`${platform} actual artifact, source hashes and capability metadata`,async()=>{
 const base='native/platform-distributions',m=JSON.parse(await readFile(`${base}/${platform}-release.json`,'utf8'));assert.equal(m.physicalVerification,false);assert.equal(m.preview,true);const bytes=await readFile(`${base}/${m.artifact}`);assert.equal(sha(bytes),m.sha256);assert.equal(bytes.length,m.bytes);
 for(const [path,expected] of Object.entries(m.sources))assert.equal(sha(await readFile(path)),expected,`stale ${path}`);
 if(platform==='macos'){
  assert.equal(m.architecture,'arm64');assert.equal(m.notarized,false);assert.equal(m.osInputVerified,false);
  execFileSync('python3',['-c',`import zipfile,struct,sys,plistlib
z=zipfile.ZipFile(sys.argv[1]);p=plistlib.loads(z.read('Treadory.app/Contents/Info.plist'));assert p['CFBundleExecutable']=='Treadory';assert p['CFBundleShortVersionString']=='0.3.0';b=z.read('Treadory.app/Contents/MacOS/Treadory');assert b[:4]==b'\\xcf\\xfa\\xed\\xfe';assert struct.unpack_from('<I',b,4)[0]==0x100000c;assert z.getinfo('Treadory.app/Contents/MacOS/Treadory').external_attr>>16&0o111;assert 'Treadory.app/Contents/Resources/README.md' in z.namelist()`,`${base}/${m.artifact}`]);
 }else{
  assert.equal(m.clickGuardAvailable,false);assert.equal(m.runtimeVerified,false);assert.equal(bytes.toString('ascii',0,8),'!<arch>\n');
  execFileSync('python3',['-c',`import sys,io,tarfile,pathlib
b=open(sys.argv[1],'rb').read();offset=8;members={}
while offset<len(b):
 h=b[offset:offset+60];assert h[58:]==b'\x60\\n';size=int(h[48:58]);name=h[:16].decode().strip().rstrip('/');members[name]=b[offset+60:offset+60+size];offset+=60+size+size%2
assert members['debian-binary']==b'2.0\\n'
c=tarfile.open(fileobj=io.BytesIO(members['control.tar.gz']));control=c.extractfile('control').read();assert b'python3-evdev' in control and b'Architecture: all' in control
d=tarfile.open(fileobj=io.BytesIO(members['data.tar.gz']));assert d.getmember('usr/bin/treadory').mode&0o111;assert 'usr/lib/treadory/treadory.py' in d.getnames()
seen=set()
for member in d.getmembers():
 if member.isfile():
  for parent in pathlib.PurePosixPath(member.name).parents:
   if str(parent)!='.': assert str(parent) in seen, 'missing directory before file: '+str(parent)
 elif member.isdir(): seen.add(member.name.rstrip('/'))`,`${base}/${m.artifact}`]);
 }
});
