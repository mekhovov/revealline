import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {readEditionZip} from '/Users/oleksandr.mekhovov/.codex/worktrees/fpv-garage-surfaces/go_test/publishing/edition-zip.mjs';
const root='/Users/oleksandr.mekhovov/.codex/worktrees/fpv-garage-surfaces/go_test';
const candidate='/tmp/fpv-orchard-admission-v2';
const output=path.join(root,'dist/fpv-orchard-admitted-player-480a2a19a');
const sha=b=>createHash('sha256').update(b).digest('hex');
const checks=[];const check=(name,value)=>{checks.push({name,passed:!!value});assert(value,name);};
const envelope=JSON.parse(await fs.readFile(path.join(candidate,'optional-packages.json'),'utf8'));
const verification=JSON.parse(await fs.readFile(path.join(candidate,'optional-candidate-verification.json'),'utf8'));
check('exact source, two identical builds, committed inputs and ZIP admission',verification.sourceRevision==='480a2a19a37357466700d36cc5e78728a75c1736'&&verification.reproducibleBuilds===2&&verification.committedInputsVerified&&verification.admission.zipMembersVerified);
const sums=JSON.parse(await fs.readFile(path.join(candidate,'optional-checksums.json'),'utf8'));
for(const file of sums.files){const b=await fs.readFile(path.join(candidate,file.path));check('candidate checksum '+file.path,b.length===file.bytes&&sha(b)===file.sha256);}
const row=envelope.packages.find(row=>row.id==='fpv-worlds');
const zip=await fs.readFile(path.join(candidate,row.distribution.path));
check('admitted world ZIP matches envelope',zip.length===row.distribution.bytes&&sha(zip)===row.distribution.sha256);
const entries=readEditionZip(zip),manifestBytes=await fs.readFile(path.join(candidate,row.manifest.path)),manifest=JSON.parse(manifestBytes);
check('manifest matches envelope',manifestBytes.length===row.manifest.bytes&&sha(manifestBytes)===row.manifest.sha256);
const expected=new Map(manifest.files.map(f=>[f.path,f]));expected.set('optional-package.json',{bytes:manifestBytes.length,sha256:sha(manifestBytes)});
check('complete admitted ZIP has102 members including exact package descriptor',entries.size===102&&expected.size===102&&entries.get('optional-package.json')?.equals(manifestBytes));
await fs.mkdir(output,{recursive:false});
const files=[], storage={linkedFiles:0,linkedBytes:0,writtenFiles:0,writtenBytes:0};
const previous='/tmp/fpv-environment-light-player-06d154e76';
for(const [name,bytes] of entries){const meta=expected.get(name);check('member equals admitted inventory '+name,!!meta&&meta.bytes===bytes.length&&meta.sha256===sha(bytes));const target=path.join(output,name);assert(target.startsWith(output+path.sep));await fs.mkdir(path.dirname(target),{recursive:true});const prior=path.join(previous,name),old=await fs.readFile(prior).catch(error=>{if(error.code==='ENOENT')return null;throw error;});if(old?.equals(bytes)){await fs.link(prior,target);storage.linkedFiles++;storage.linkedBytes+=bytes.length;}else{await fs.writeFile(target,bytes,{flag:'wx'});storage.writtenFiles++;storage.writtenBytes+=bytes.length;}const stored=await fs.readFile(target);check('staged member re-read exact '+name,stored.equals(bytes));files.push({path:name,bytes:stored.length,sha256:sha(stored)});}
const sourceInventory=JSON.parse(await fs.readFile(path.join(candidate,row.sourceInventory.path),'utf8'));
const receipt={format:'FPVOrchardFullAdmittedPlayer.v1',sourceRevision:verification.sourceRevision,sourceTree:verification.sourceTree,output,entry:manifest.entry,zip:{...row.distribution},checks,files,storage,totals:{files:files.length,bytes:files.reduce((n,f)=>n+f.bytes,0),originalInputs:sourceInventory.inputs.length,originalInputBytes:sourceInventory.inputs.reduce((n,f)=>n+f.bytes,0)},limitations:['Exact102-file admitted ZIP extraction, not a94-file development playtest.','Local static serving is not installed identity, service-worker/offline, public deployment or hardware qualification.']};
const receiptPath='/tmp/fpv-orchard-admitted-player.json';await fs.writeFile(receiptPath,JSON.stringify(receipt,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({passed:checks.length,receipt:receiptPath,...receipt.totals,storage,zipSha256:row.distribution.sha256,url:'http://127.0.0.1:8834/dist/fpv-orchard-admitted-player-480a2a19a/'+manifest.entry}));
