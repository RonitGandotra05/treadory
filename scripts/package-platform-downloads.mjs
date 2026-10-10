import {readFile,cp,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const hash=data=>createHash('sha256').update(data).digest('hex');
await mkdir('public/downloads',{recursive:true});
for(const platform of ['macos','linux']){
 const directory='native/platform-distributions';
 const metadata=JSON.parse(await readFile(`${directory}/${platform}-release.json`,'utf8'));
 for(const [file,expected] of Object.entries(metadata.sources))if(hash(await readFile(file))!==expected)throw new Error(`${platform} source changed: ${file}; rebuild before packaging.`);
 const bytes=await readFile(`${directory}/${metadata.artifact}`);
 if(bytes.length!==metadata.bytes||hash(bytes)!==metadata.sha256)throw new Error(`${platform} artifact checksum mismatch`);
 // Linux package is kept for maintainer/CI verification; no public download until runtime checks.
 if(platform==='macos')await cp(`${directory}/${metadata.artifact}`,`public/downloads/${metadata.artifact}`);
 await writeFile(`public/downloads/${platform}-release.json`,JSON.stringify({...metadata,available:platform==='macos',download:platform==='macos'?`/downloads/${metadata.artifact}`:null},null,2)+'\n');
}
console.log('macOS preview integrity checked; Linux remains a maintainer artifact pending runtime verification.');
