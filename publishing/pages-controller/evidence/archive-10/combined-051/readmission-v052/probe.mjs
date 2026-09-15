import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {inspect} from '../public-audit/http-engine.mjs';
const out=path.dirname(fileURLToPath(import.meta.url));
const delta=JSON.parse(await fs.readFile(path.join(out,'inventory-delta.json')));
const rows=delta.selectedProbes, attempts=[], results=[], bodies={};
let next=0;
await Promise.all(Array.from({length:4},async()=>{while(next<rows.length){const row=rows[next++];for(let n=1;n<=3;n++){const r=await inspect(row,n,{url:new URL(row.path,'https://mekhovov.github.io/revealline-archive-10/').href,captureLimit:row.bytes<=200000?200000:0,onBody:b=>{bodies[row.path]=b.toString('utf8');}});attempts.push(r);if(r.ok||!(r.transportError||r.status===429||r.status>=500)||n===3){results.push(r);break;}}}}));
const sha=b=>createHash('sha256').update(b).digest('hex');
for (const [name,body] of Object.entries({'attempts.jsonl':attempts.map(x=>JSON.stringify(x)).join('\n')+'\n','results.jsonl':results.map(x=>JSON.stringify(x)).join('\n')+'\n','selected-semantic-bodies.json':JSON.stringify(bodies,null,2)+'\n'})){await fs.writeFile(path.join(out,name),body,{flag:'wx'});}
const failed=results.filter(x=>!x.ok);
const report={format:'revealline-archive-deployment-drift-probe.v1',status:failed.length?'FAIL':'PARTIAL_PROBES_PASS',checkedAt:new Date().toISOString(),archiveId:'archive-10',infrastructureCommit:delta.infrastructureCommit,deploymentId:delta.deploymentId,oldInventorySha256:delta.oldInventorySha256,newInventorySha256:delta.newInventorySha256,probeCount:results.length,verifiedBytes:results.filter(x=>x.ok).reduce((s,x)=>s+x.bytes,0),failedFiles:failed.length,retries:attempts.length-results.length,all353RetainedCanonicalDescriptorsUnchanged:delta.allRetainedV042DescriptorsIdentical,changedSharedFiles:delta.changedExistingFiles.map(x=>x.path),newV051Files:delta.addedFiles,fullHistoricalHttpAuditRerun:false,publicMainV052Acceptance:false,browserAcceptance:false,conclusion:failed.length?'A selected live public body did not match current archive authority.':'All selected live canonical, worker, manifest and shared-routing bodies match the expanded archive authority. All retained v0.42 descriptors are unchanged; routing globals and newly added v0.51 files require current admission.',failed,proofs:{inventoryDeltaSha256:sha(await fs.readFile(path.join(out,'inventory-delta.json'))),runnerSha256:sha(await fs.readFile(fileURLToPath(import.meta.url))),httpEngineSha256:sha(await fs.readFile(new URL('../public-audit/http-engine.mjs',import.meta.url)))} };
await fs.writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify(report,null,2));if(failed.length)process.exitCode=1;
