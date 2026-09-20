import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { inspect, BASE } from './http-engine.mjs';
const here=path.dirname(fileURLToPath(import.meta.url));
const read=p=>JSON.parse(fs.readFileSync(path.join(here,p)));
const run=read('../terminal-run.json');
assert.equal(run.id,35498558188); assert.equal(run.head_sha,'36994813027c295465ca279957c3bb7f5e813ac4');
assert.equal(run.status,'completed'); assert.equal(run.conclusion,'success'); assert.equal(run.event,'push');
const inventoryBody=fs.readFileSync(path.join(here,'../checkout/expected-inventory.json'));
const inventory=JSON.parse(inventoryBody); const lock=read('../checkout/source-lock.json');
assert.equal(BASE,inventory.base); assert.equal(createHash('sha256').update(inventoryBody).digest('hex'),lock.expectedInventorySha256);
assert.equal(lock.expectedFiles,1455);assert.equal(lock.expectedBytes,627648506);
assert.equal(inventory.files.length,lock.expectedFiles);assert.equal(inventory.files.reduce((n,f)=>n+f.bytes,0),lock.expectedBytes);
assert.equal(new Set(inventory.files.map(f=>f.path)).size,inventory.files.length);
for(const f of inventory.files){assert(!f.path.startsWith('/') && !f.path.includes('..') && !f.path.includes('\\'));assert(Number.isSafeInteger(f.bytes)&&f.bytes>=0);assert(/^[a-f0-9]{64}$/.test(f.sha256));}
// Preserve every old immutable release path; the archive landing page gains a link.
const priorBody=fs.readFileSync(path.join(here,'../../archive35-v0680-r1/checkout/expected-inventory.json'));
assert.equal(createHash('sha256').update(priorBody).digest('hex'),'bfe4198b4977a6bc4714f83e3028c3d355a5b4981624023ef4e8b1cb9d5a376e');
const prior=JSON.parse(priorBody).files;assert.equal(prior.length,729);
const nextByPath=new Map(inventory.files.map(row=>[row.path,row]));
const changed=prior.filter(row=>JSON.stringify(nextByPath.get(row.path))!==JSON.stringify(row)).map(row=>row.path);
assert.deepEqual(changed,['index.html']);
assert.equal(prior.filter(row=>row.path.startsWith('releases/v0.68.0/')).length,726);
const out=path.join(here,'http-r1');fs.mkdirSync(out);fs.writeFileSync(path.join(out,'inventory.json'),inventoryBody,{flag:'wx'});
const attempts=fs.openSync(path.join(out,'attempts.jsonl'),'wx');const results=fs.openSync(path.join(out,'results.jsonl'),'wx');
const startedAt=new Date().toISOString(),start=performance.now(),rows=[];let cursor=0;
async function worker(){
 while(cursor<inventory.files.length){
  assert(performance.now()-start<15*60*1000,'Finite audit lifetime exceeded');
  const f=inventory.files[cursor++];let row;
  for(let n=1;n<=2;n++){
   row=await inspect(f,n);fs.writeSync(attempts,JSON.stringify(row)+'\n');
   if(row.ok || n===2 || !(row.transportError||row.status===429||row.status>=500))break;
  }
  rows.push(row);fs.writeSync(results,JSON.stringify(row)+'\n');
  if(rows.length%100===0)process.stdout.write(JSON.stringify({completed:rows.length,failed:rows.filter(r=>!r.ok).length})+'\n');
 }
}
try {
 await Promise.all(Array.from({length:8},worker));
 const failed=rows.filter(r=>!r.ok);assert.equal(rows.length,inventory.files.length);
 const report={status:failed.length?'FAIL':'PASS',base:BASE,source:run.head_sha,run:run.id,files:rows.length,failedFiles:failed.length,expectedBytes:lock.expectedBytes,verifiedBytes:rows.filter(r=>r.ok).reduce((n,r)=>n+r.bytes,0),expectedInventorySha256:lock.expectedInventorySha256,priorPaths:prior.length,unchangedPriorPaths:prior.length-changed.length,mutablePriorExceptions:changed,startedAt,finishedAt:new Date().toISOString(),elapsedSeconds:(performance.now()-start)/1000,skipped:[],nativeAcceptance:false};
 fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify(report));if(failed.length)process.exitCode=1;
}finally{fs.closeSync(attempts);fs.closeSync(results);}
