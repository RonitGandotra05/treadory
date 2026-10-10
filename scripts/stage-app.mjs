import {cp,mkdir,readFile,writeFile} from 'node:fs/promises';
import {APP_SNAPSHOT,appSources,checkAppExe,hash} from './app-artifact.mjs';
const source=process.argv[2]||'releases/windows-app/Treadory.exe';const bytes=await readFile(source);checkAppExe(bytes);
await mkdir(APP_SNAPSHOT,{recursive:true});await cp(source,`${APP_SNAPSHOT}/Treadory.exe`);
await writeFile(`${APP_SNAPSHOT}/artifact.json`,JSON.stringify({format:1,version:'0.2.0',platform:'windows-x64',selfContained:true,standalone:true,signed:false,physicalVerification:false,bytes:bytes.length,sha256:hash(bytes),sources:await appSources()},null,2)+'\n');
console.log('Staged standalone self-contained Windows x64 EXE; source and executable hashes recorded.');
