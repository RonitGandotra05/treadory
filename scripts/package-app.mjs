import {cp,mkdir,rm,writeFile} from 'node:fs/promises';
import {APP_SNAPSHOT,validateApp} from './app-artifact.mjs';
const manifest=await validateApp();await mkdir('public/downloads',{recursive:true});
const filename=`Treadory-${manifest.version}-windows-x64-preview.exe`;
await cp(`${APP_SNAPSHOT}/Treadory.exe`,`public/downloads/${filename}`);
await cp(`${APP_SNAPSHOT}/Treadory.exe`,'public/downloads/Treadory.exe'); // Compatibility alias only.
await writeFile('public/downloads/app-release.json',JSON.stringify({format:1,version:manifest.version,platform:'windows-x64',available:true,preview:true,standalone:true,selfContained:true,signed:false,physicalVerification:false,download:`/downloads/${filename}`,bytes:manifest.bytes,sha256:manifest.sha256},null,2)+'\n');
for(const old of ['treadory-windows-helper-preview.zip','treadory-windows-helper-source.zip','helper-release.json'])await rm(`public/downloads/${old}`,{force:true});
console.log('One standalone Windows EXE packaged; runtime included, no input driver redistributed.');
