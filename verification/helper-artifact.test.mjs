import test from 'node:test';
import assert from 'node:assert/strict';
import {cp,mkdtemp,readFile,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {HELPER_FILES,HELPER_SNAPSHOT,checkWindowsHost,validateSnapshot} from '../scripts/helper-artifact.mjs';

test('website helper snapshot is a complete x64 host matching its current sources',async()=>{
 await validateSnapshot();await checkWindowsHost(HELPER_SNAPSHOT);
 const deps=JSON.parse(await readFile(`${HELPER_SNAPSHOT}/treadory-helper.deps.json`,'utf8'));
 assert.deepEqual(Object.keys(deps.libraries),['treadory-helper/1.0.0']);
 assert.equal(HELPER_FILES.length,4);
});
test('source edits and damaged binary snapshots cannot silently ship',async()=>{
 const root=await mkdtemp(path.join(tmpdir(),'treadory-artifact-'));
 try{
  const artifact=path.join(root,'snapshot'),sources=path.join(root,'sources');
  await cp(HELPER_SNAPSHOT,artifact,{recursive:true});await cp('native/windows',sources,{recursive:true,filter:src=>!/(?:^|\/)(?:bin|obj|distribution)(?:\/|$)/.test(src)});
  await validateSnapshot(artifact,sources);
  const engine=path.join(sources,'Engine.cs'),original=await readFile(engine);
  await writeFile(engine,Buffer.concat([original,Buffer.from('\n// changed source\n')]));
  await assert.rejects(validateSnapshot(artifact,sources),/source changed/);
  await writeFile(engine,original);await writeFile(path.join(artifact,'treadory-helper.dll'),'damaged');
  await assert.rejects(validateSnapshot(artifact,sources),/checksum mismatch/);
 }finally{await rm(root,{recursive:true,force:true});}
});
