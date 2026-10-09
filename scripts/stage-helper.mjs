import {cp,mkdir,readFile,rename,rm,writeFile} from 'node:fs/promises';
import {HELPER_FILES,HELPER_SNAPSHOT,checkWindowsHost,sha256,sourceHashes} from './helper-artifact.mjs';

const host=process.argv[2]||'releases/windows/host';
await checkWindowsHost(host);
const staging=`${HELPER_SNAPSHOT}.staging`;
await rm(staging,{recursive:true,force:true});await mkdir(staging,{recursive:true});
const files={};
for(const file of HELPER_FILES){await cp(`${host}/${file}`,`${staging}/${file}`);files[file]=sha256(await readFile(`${host}/${file}`));}
await writeFile(`${staging}/artifact.json`,JSON.stringify({format:1,platform:'windows-x64',selfContained:false,sources:await sourceHashes(),files},null,2)+'\n');
await rm(HELPER_SNAPSHOT,{recursive:true,force:true});await rename(staging,HELPER_SNAPSHOT);
console.log('Staged first-party Windows x64 helper snapshot with source and file checksums; no runtime or third-party driver included.');
