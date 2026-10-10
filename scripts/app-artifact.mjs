import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
export const APP_SNAPSHOT='native/windows-app/distribution/win-x64';
export const APP_SOURCES=['native/windows-app/Treadory.App.csproj','native/windows-app/Program.cs','native/windows-app/MainForm.cs','native/windows-app/Session.cs','native/windows-app/Runner.cs','native/windows-app/Settings.cs','native/windows-app/ClickGuard.cs','native/windows-app/AppTests.cs','native/windows-app/README.md','native/windows/Engine.cs','native/windows/WindowsBackend.cs','native/windows/DOTNET-APPHOST-LICENSE.txt','native/windows/DOTNET-THIRD-PARTY-NOTICES.txt'];
export const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
export async function appSources(root='.') {return Object.fromEntries(await Promise.all(APP_SOURCES.map(async file=>[file,hash(await readFile(path.join(root,file)))])));}
export function checkAppExe(bytes) {
 if(bytes.length<1000000||bytes.toString('ascii',0,2)!=='MZ')throw new Error('Standalone app must be a bundled Windows executable.');
 const pe=bytes.readUInt32LE(0x3c);
 if(pe+94>bytes.length||bytes.toString('ascii',pe,pe+4)!=='PE\0\0'||bytes.readUInt16LE(pe+4)!==0x8664||bytes.readUInt16LE(pe+24+68)!==2)throw new Error('Standalone app must be a Windows x64 GUI executable.');
 // .NET host bundle marker; reject accidentally publishing only an apphost stub.
 const marker=Buffer.from('8b1202b96a612038727b930214d7a03213f5b9e6efae3318ee3b2dce24b36aae','hex');
 const offset=bytes.indexOf(marker);if(offset<8||bytes.readBigUInt64LE(offset-8)===0n)throw new Error('Single-file runtime bundle is missing.');
}
export async function validateApp(directory=APP_SNAPSHOT,root='.'){
 const manifest=JSON.parse(await readFile(path.join(directory,'artifact.json'),'utf8'));
 if(manifest.format!==1||manifest.platform!=='windows-x64'||manifest.selfContained!==true||manifest.standalone!==true||manifest.physicalVerification!==false||manifest.signed!==false)throw new Error('Invalid standalone preview metadata.');
 const sources=await appSources(root);for(const file of APP_SOURCES)if(manifest.sources?.[file]!==sources[file])throw new Error(`Standalone app source changed (${file}); republish and stage the app before shipping.`);
 const bytes=await readFile(path.join(directory,'Treadory.exe'));checkAppExe(bytes);
 if(manifest.sha256!==hash(bytes)||manifest.bytes!==bytes.length)throw new Error('Standalone app checksum mismatch.');return manifest;
}
