import {readFileSync} from 'node:fs'; import {execFileSync} from 'node:child_process';
const path='docs/qualification/overflight/rebalance-20261014/verify-balance.mjs';
const source=readFileSync(path,'utf8');
let child=(source.slice(0,source.indexOf('const paths ='))+source.slice(source.indexOf('const clone ='),source.indexOf('const receiptURL ='))).replaceAll('../../../../game/','./game/').replace('  stepOverflight,','  stepOverflight as originalStepOverflight,');
child+=`
const densitySamples=[]; let lastSample=-1; let capTicks=0;
function stepOverflight(run,...args){const result=originalStepOverflight(run,...args);if(run.stats.enemiesAlive===2500)capTicks++;if(run.tick%600===0&&lastSample!==run.tick){lastSample=run.tick;let boundary=0,crossBoundary=0,offscreen=0;const patterns={};for(const e of run.enemies){if(!e.active)continue;patterns[e.pattern]=(patterns[e.pattern]??0)+1;const near=e.x<=e.radius+5||e.y<=e.radius+5||e.x>=run.compiled.arena.width-e.radius-5||e.y>=run.compiled.arena.height-e.radius-5;if(near){boundary++;if(['crossing','flank'].includes(e.pattern))crossBoundary++;}if(Math.abs(e.x-run.camera.x)>480+e.radius||Math.abs(e.y-run.camera.y)>270+e.radius)offscreen++;}densitySamples.push({time:run.time,alive:run.stats.enemiesAlive,visible:run.stats.enemiesVisible,boundary,crossBoundary,offscreen,patterns,spawnDeferred:run.stats.spawnDeferred,xpEarned:run.stats.xpEarned,xpCollected:run.stats.xpCollected});}return result;}
const matrix=JSON.parse(gunzipSync(readFileSync('docs/qualification/overflight/rebalance-20261014/balance-matrix.json.gz')));
const old=matrix.results.find(r=>r.route==='active'&&r.config.mode==='riy'&&r.summary.stats.peakAlive===2500);
const config=old.config,compiled=compileOverflightRiyProject(createOverflightRiyProject({...config,rulesVersion:3}));
const sourceHashes=matrix.source.map(s=>({...s,sha256:createHash('sha256').update(readFileSync(s.path)).digest('hex')}));
const run=createOverflightRun(compiled,{airframes:config.airframes});run.riy=createOverflightRiy(run);startOverflight(run);
const earned=drive(run,config,'checkpoint',old.stop);const result=earned.run?drive(clone(earned.run),config,'active',old.stop):earned;
if(earned.run)result.choices=[...earned.choices,...result.choices];
const sourceAtFinish=sourceHashes.map(s=>({...s,sha256:createHash('sha256').update(readFileSync(s.path)).digest('hex')}));
console.log(JSON.stringify({format:'OverflightDensityObservationV1',config,sourceReceipt:'balance-matrix.json.gz',source:sourceHashes,sourceAtFinish,capSeconds:capTicks/60,summary:result.summary,choices:result.choices,samples:densitySamples},null,2));
`;
process.stdout.write(execFileSync(process.execPath,['--max-old-space-size=256','--input-type=module','-e',child],{encoding:'utf8',maxBuffer:1024*1024}));