import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { inspect, BASE } from './http-engine.mjs';
const here=path.dirname(fileURLToPath(import.meta.url));
const read=p=>JSON.parse(fs.readFileSync(path.join(here,p)));
const run=read('../terminal-run.json');
assert.equal(run.id,35514523868); assert.equal(run.head_sha,'f47c70dc37ab1948fed02b0148589c4e9c10574c');
assert.equal(run.status,'completed'); assert.equal(run.conclusion,'success'); assert.equal(run.event,'push');
const inventoryBody=fs.readFileSync(path.join(here,'../../archive36-v0682-r1/checkout/expected-inventory.json'));
const inventory=JSON.parse(inventoryBody); const lock=read('../../archive36-v0682-r1/checkout/source-lock.json');
assert.equal(BASE,inventory.base); assert.equal(createHash('sha256').update(inventoryBody).digest('hex'),lock.expectedInventorySha256);
assert.equal(lock.expectedFiles,1506);assert.equal(lock.expectedBytes,653831399);
assert.equal(inventory.files.length,lock.expectedFiles);assert.equal(inventory.files.reduce((n,f)=>n+f.bytes,0),lock.expectedBytes);
assert.equal(new Set(inventory.files.map(f=>f.path)).size,inventory.files.length);
for(const f of inventory.files){assert(!f.path.startsWith('/') && !f.path.includes('..') && !f.path.includes('\\'));assert(Number.isSafeInteger(f.bytes)&&f.bytes>=0);assert(/^[a-f0-9]{64}$/.test(f.sha256));}
const prior=read('../../archive36-v0682-r1/public-audit/http-r1/inventory.json');
const next=new Map(inventory.files.map(f=>[f.path,f]));
assert(prior.files.every(f=>next.has(f.path)));
const changed=prior.files.filter(f=>JSON.stringify(f)!==JSON.stringify(next.get(f.path))).map(f=>f.path);
assert.deepEqual(changed,['index.html']);
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
 const report={status:failed.length?'FAIL':'PASS',base:BASE,source:run.head_sha,run:run.id,files:rows.length,failedFiles:failed.length,expectedBytes:lock.expectedBytes,verifiedBytes:rows.filter(r=>r.ok).reduce((n,r)=>n+r.bytes,0),expectedInventorySha256:lock.expectedInventorySha256,priorPaths:prior.files.length,unchangedPriorPaths:prior.files.length-changed.length,mutablePriorExceptions:changed,startedAt,finishedAt:new Date().toISOString(),elapsedSeconds:(performance.now()-start)/1000,skipped:[],nativeAcceptance:false};
 fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify(report));if(failed.length)process.exitCode=1;
}finally{fs.closeSync(attempts);fs.closeSync(results);}
