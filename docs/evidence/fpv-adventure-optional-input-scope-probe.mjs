import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const root='/Users/oleksandr.mekhovov/.codex/worktrees/fpv-garage-surfaces/go_test';
const inventoryPath='/Users/oleksandr.mekhovov/.codex/worktrees/fpv-stadium-structures/go_test/dist/fpv-railworks-wagon-candidate-9efa36364/source-inventory-optional-fpv-worlds.json';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const inventoryBytes=await readFile(inventoryPath),inventory=JSON.parse(inventoryBytes),candidate=execFileSync('git',['rev-parse','HEAD'],{cwd:root}).toString().trim();
const checks=[],inputs=[];const check=(name,passed)=>{checks.push({name,passed});assert(passed,name);};
check('95 admitted original inputs',inventory.inputs.length===95);
for(const input of inventory.inputs){
 const bytes=await readFile(root+'/'+input.path),committed=execFileSync('git',['show',candidate+':'+input.path],{cwd:root,maxBuffer:8*1024*1024});
 check('unchanged admitted input '+input.path,bytes.length===input.bytes&&hash(bytes)===input.sha256&&bytes.equals(committed));inputs.push(input);
}
const diff=execFileSync('git',['diff','--name-only',inventory.sourceRevision,candidate,'--','optional-practice','game','publishing'],{cwd:root}).toString().trim();
check('admitted production source equals current main',diff==='');
check('optional archive excluded from every original input',inputs.every(i=>!i.path.startsWith('authoring/')));
const bytes=inputs.reduce((n,i)=>n+i.bytes,0);check('unchanged 16 MiB source capacity',bytes===16762811&&bytes<16*1024*1024);
const archivePath='authoring/fpv-worlds/demonstrations/optional/adventures-v1.json',archiveBytes=await readFile(root+'/'+archivePath);
check('exact optional transport',archiveBytes.length===4637320&&hash(archiveBytes)==='c9734dcf05fcfc87a42960daad05e3b594e938dcfeb44624305802972aad5ca3');
const receipt={format:'FPVAdventureOptionalInputScope.v1',candidate,admittedSource:inventory.sourceRevision,inventoryPath,inventorySha256:hash(inventoryBytes),checks,inputs,originalBytes:bytes,sourceCap:16*1024*1024,headroom:16*1024*1024-bytes,optionalArchive:{path:archivePath,bytes:archiveBytes.length,sha256:hash(archiveBytes)},limitations:['Read-only equality against a previously admitted source; no new package build or admission claimed.','Optional archive is delivered separately from selected core inputs; later independent art changes need their own cumulative capacity audit.']};
await writeFile('/tmp/fpv-adventure-input-scope.json',JSON.stringify(receipt,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({checks:checks.length,originalBytes:bytes,headroom:receipt.headroom,inputs:inputs.length}));
