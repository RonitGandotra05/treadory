import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';

export const HELPER_FILES=['treadory-helper.exe','treadory-helper.dll','treadory-helper.deps.json','treadory-helper.runtimeconfig.json'];
export const HELPER_SOURCES=['Treadory.Helper.csproj','Engine.cs','Protocol.cs','WindowsBackend.cs','Program.cs','SelfTest.cs'];
export const HELPER_SNAPSHOT='native/windows/distribution/win-x64';
export const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
export async function sourceHashes(root='native/windows'){
 return Object.fromEntries(await Promise.all(HELPER_SOURCES.map(async file=>[file,sha256(await readFile(path.join(root,file)))])));
}
export async function validateSnapshot(directory=HELPER_SNAPSHOT,sourceRoot='native/windows'){
 const manifest=JSON.parse(await readFile(path.join(directory,'artifact.json'),'utf8'));
 if(manifest.format!==1||manifest.platform!=='windows-x64'||manifest.selfContained!==false)throw new Error('Invalid Windows helper snapshot metadata.');
 const sources=await sourceHashes(sourceRoot);
 for(const file of HELPER_SOURCES)if(manifest.sources?.[file]!==sources[file])throw new Error(`Windows helper source changed (${file}); rebuild and run npm run build:helper-snapshot before publishing.`);
 for(const file of HELPER_FILES)if(manifest.files?.[file]!==sha256(await readFile(path.join(directory,file))))throw new Error(`Windows helper snapshot checksum mismatch: ${file}`);
 return manifest;
}
export async function checkWindowsHost(directory){
 const exe=await readFile(path.join(directory,'treadory-helper.exe'));
 if(exe.length<64||exe.toString('ascii',0,2)!=='MZ')throw new Error('Windows helper is not a PE executable.');
 const pe=exe.readUInt32LE(0x3c);
 if(pe+6>exe.length||exe.toString('ascii',pe,pe+4)!=='PE\0\0'||exe.readUInt16LE(pe+4)!==0x8664)throw new Error('Windows helper must be an x64 PE executable.');
 for(const file of HELPER_FILES)await readFile(path.join(directory,file));
}
