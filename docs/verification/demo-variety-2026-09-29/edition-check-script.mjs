import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
const root = '/Users/oleksandr.mekhovov/.codex/worktrees/community-admission/go_test';
const fromRoot = name => pathToFileURL(path.join(root,name));
const {collectEditionEngineFiles,collectEditionSelectedFiles,compileEdition,validateEditionCodeClosure} = await import(fromRoot('scripts/compile-edition.mjs'));
const {editionDemoResources} = await import(fromRoot('scripts/edition-runtime.mjs'));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const read = name => fs.readFile(path.join(root,name));
const json = async name => JSON.parse(await read(name));
const reportPath = path.join(root,'docs/verification/demo-variety-2026-09-29/edition-inventories.json');
const started = performance.now();
const report = {format:'revealline-demo-variety-edition-inventories.v1',status:'running',sourceScope:'Current working tree, including uncommitted Demo variety changes; not an immutable release or native launch.',sourceRevision:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),startedAt:new Date().toISOString(),command:'node --expose-gc /tmp/check-demo-variety-editions.mjs',scriptSha256:hash(await fs.readFile(new URL(import.meta.url))),releaseAdmitted:false,editions:[]};
const catalog = await json('game/editions/catalog.json');
const {version} = await json('package.json');
const demo = await json('game/demo-data/catalog.json');
const required = ['game/demo-loading.mjs','game/demo-bot-worker.mjs',...editionDemoResources(demo)];
const engine = await collectEditionEngineFiles({root});
const observedInputs = new Map(engine);
report.version=version;report.demoClips=demo.clips.length;report.demoReplayFiles=required.filter(n=>n.endsWith('.replay.json')).length;report.byteLimit=64*1024*1024;report.fileLimit=2000;
for(const {id} of catalog.editions) {
  try {
    const selected = await collectEditionSelectedFiles({catalog,editionIds:[id],read});
    for(const [name,bytes] of selected) observedInputs.set(name,bytes);
    const result = await compileEdition({catalog,editionIds:[id],files:new Map([...engine,...selected]),enginePaths:[...engine.keys()],version,sourceRevision:'development',offline:{basePath:'/'}});
    validateEditionCodeClosure(result.files);
    assert.deepEqual(result.runtimeCatalog.editions.map(e=>e.id),[id]);
    const offline=JSON.parse(result.files.get('offline-cache.json'));
    assert.ok(offline.totalBytes<=report.byteLimit);assert.ok(offline.files.length<=report.fileLimit);
    assert.equal(offline.totalBytes,offline.files.reduce((sum,f)=>sum+f.bytes,0));
    const byPath=new Map(offline.files.map(f=>[f.path,f]));assert.equal(byPath.size,offline.files.length);
    for(const row of offline.files) { const bytes=result.files.get(row.path);assert.ok(bytes,row.path);assert.equal(bytes.length,row.bytes,row.path);assert.equal(hash(bytes),row.sha256,row.path); }
    for(const name of required) {assert.ok(byPath.has(name),`Missing ${name}`);assert.equal(hash(result.files.get(name)),hash(engine.get(name)),`Changed ${name}`);}
    report.editions.push({id,status:'passed',compiledFiles:result.files.size,offlineFiles:offline.files.length,offlineBytes:offline.totalBytes,remainingBytes:report.byteLimit-offline.totalBytes,offlineInventorySha256:hash(result.files.get('offline-cache.json')),manifestSha256:hash(result.files.get('edition-build.json')),allOfflineBytesAndHashesVerified:true,fullCodeClosureVerified:true,allDemoAssetsExact:true});
  } catch(error) {report.editions.push({id,status:'failed',error:error.message});}
  console.log(JSON.stringify(report.editions.at(-1)));global.gc?.();
}
const inventory=[...observedInputs].map(([name,bytes])=>({path:name,bytes:bytes.length,sha256:hash(bytes)})).sort((a,b)=>a.path.localeCompare(b.path));
const changed=[];for(const row of inventory)if(hash(await read(row.path))!==row.sha256)changed.push(row.path);
report.inputFiles=inventory.length;report.inputInventorySha256=hash(JSON.stringify(inventory));report.demoSourceInventory=inventory.filter(row=>required.includes(row.path));report.changedInputsDuringCheck=changed;report.finishedAt=new Date().toISOString();report.elapsedSeconds=(performance.now()-started)/1000;report.status=report.editions.every(e=>e.status==='passed')&&!changed.length?'passed':'failed';report.limitations=['All compiled bytes existed only in memory; no ZIP or native output tree was emitted.','No service-worker execution, browser, physical device, audio, or release admission is established.'];
await fs.writeFile(reportPath,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({status:report.status,editions:report.editions.length,elapsedSeconds:report.elapsedSeconds,reportPath}));if(report.status!=='passed')process.exitCode=1;
