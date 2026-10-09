import {cp,mkdir,readFile,rm,stat,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {HELPER_FILES,HELPER_SNAPSHOT,checkWindowsHost,validateSnapshot} from './helper-artifact.mjs';
const out='public/downloads';await mkdir(out,{recursive:true});
const staging='releases/helper-staging';await rm(staging,{recursive:true,force:true});await mkdir(staging,{recursive:true});
const source=path.join(staging,'source');await mkdir(source);
for(const file of ['Treadory.Helper.csproj','Engine.cs','Protocol.cs','WindowsBackend.cs','Program.cs','SelfTest.cs','install.ps1','uninstall.ps1','README.md','DOTNET-APPHOST-LICENSE.txt','DOTNET-THIRD-PARTY-NOTICES.txt'])await cp(`native/windows/${file}`,`${source}/${file}`);
await cp('docs/INPUT-ARCHITECTURE.md',`${source}/INPUT-ARCHITECTURE.md`);
execFileSync('python3',['scripts/package-extension.py',source,`${out}/treadory-windows-helper-source.zip`]);
// Website builds use the versioned first-party snapshot, never ignored local output.
// Source/file checksums prevent shipping it after native source changes.
const host=process.env.TREADORY_HELPER_DIR||HELPER_SNAPSHOT;
if(!process.env.TREADORY_HELPER_DIR)await validateSnapshot();
let available=false;
try{available=(await stat(`${host}/treadory-helper.exe`)).isFile();}catch{}
let release={format:1,platform:'windows-x64',available:false,preview:true,physicalVerification:false,source:'/downloads/treadory-windows-helper-source.zip'};
const binary=`${out}/treadory-windows-helper-preview.zip`;
if(available){
 const destination=path.join(staging,'preview');await mkdir(`${destination}/host`,{recursive:true});
 await checkWindowsHost(host);
 for(const file of HELPER_FILES)await cp(`${host}/${file}`,`${destination}/host/${file}`);
 for(const file of ['install.ps1','uninstall.ps1','README.md','DOTNET-APPHOST-LICENSE.txt','DOTNET-THIRD-PARTY-NOTICES.txt'])await cp(`native/windows/${file}`,`${destination}/${file}`);
 execFileSync('python3',['scripts/package-extension.py',destination,binary]);
 const bytes=await readFile(binary);release={...release,available:true,download:'/downloads/treadory-windows-helper-preview.zip',bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),runtime:'.NET 10 x64 Runtime required'};
}else await rm(binary,{force:true});
await writeFile(`${out}/helper-release.json`,JSON.stringify(release,null,2)+'\n');
console.log(available?'Windows x64 helper preview packaged; no third-party driver/DLL included.':'Windows helper source packaged; no binary download advertised.');
