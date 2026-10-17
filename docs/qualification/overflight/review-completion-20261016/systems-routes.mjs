import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {gunzipSync} from 'node:zlib';
import {pathToFileURL,fileURLToPath} from 'node:url';
const root=pathToFileURL('/Users/oleksandr.mekhovov/.codex/worktrees/fpv-survivals-recovery/go_test/');
const core=await import(new URL('game/overflight/core.mjs',root));
const project=await import(new URL('game/overflight/project.mjs',root));
const {createOverflightRiyMode}=await import(new URL('game/overflight/riy-mode.mjs',root));
const {pilot,selectCard}=await import(new URL('game/overflight/review-pilot.mjs',root));
const {createOverflightReviewPlayback}=await import(new URL('game/overflight/host-loop.mjs',root));
const output='/tmp/overflight-systems-routes-20261016.json'; assert.ok(!existsSync(output));
const base={createRun:core.createOverflightRun,step:core.stepOverflight,createProject:project.createOverflightProject,compileProject:project.compileOverflightProject,pilot,selectCard,defaultProject:null};
const modes={survivor:base,riy:createOverflightRiyMode(base)};
const evidence=JSON.parse(gunzipSync(readFileSync(new URL('docs/qualification/overflight/late-pacing-20261016/original-crowd.json.gz',root))));
const files=new Set(); function visit(url){if(files.has(url.href)) return;files.add(url.href);for(const m of readFileSync(url,'utf8').matchAll(/(?:from\s*|import\s*)['"](\.{1,2}\/[^'"]+)['"]/g)) visit(new URL(m[1],url));}
for(const f of ['core','project','riy-mode','review-pilot','host-loop']) visit(new URL(`game/overflight/${f}.mjs`,root));
const hashes=()=>Object.fromEntries([...files].sort().map(u=>[fileURLToPath(u).slice(fileURLToPath(root).length),createHash('sha256').update(readFileSync(new URL(u))).digest('hex')]));
const cases=[
 {index:4,mode:'survivor',build:'systems',layout:'freight-depot-dispatch-junction',seed:26022022,difficulty:'veteran'},
 {index:5,mode:'riy',build:'systems',layout:'field-crossing-shelterbelt-gaps',seed:19910404,difficulty:'standard'}
].flatMap(c=>[{...c,route:'figure-eight',airframes:1},{...c,route:'tight',airframes:3}]);
const head=()=>execFileSync('git',['rev-parse','HEAD'],{cwd:fileURLToPath(root),encoding:'utf8'}).trim();
const report={format:'OverflightSystemsRoutesV1',startedUTC:new Date().toISOString(),head:head(),sourceHashes:hashes(),runtime:process.version,cases,results:[],complete:false,scope:'Four predetermined existing-route/preset controls. No tuning, power grants or new pilot; original crowd rule; legal earned choices; 10Hz inputs and 1.5s visible draft delay. Not ordinary-player difficulty evidence.'};
const start=performance.now();const persist=()=>writeFileSync(output,JSON.stringify(report,null,2));persist();
try{
for(const row of cases){
 const mode=modes[row.mode],authored=mode.createProject({...row,rulesVersion:4,crowdSeparation:null}),compiled=mode.compileProject(authored),run=mode.createRun(compiled,row);
 assert.equal(compiled.balanceRevision,'overflight-balance.v4.late-choice-1');
 const controller=createOverflightReviewPlayback({build:row.build,route:row.route,pilot:mode.pilot,selectCard:mode.selectCard});
 const receipt={...row,projectIdentity:compiled.projectIdentity,balanceRevision:compiled.balanceRevision,thresholds:compiled.upgrades.thresholds,damageEvents:[],samples:[],firstReplacement:null};report.results.push(receipt);
 core.startOverflight(run);let wall=0,lastBucket=-1;
 while(['playing','upgrade'].includes(run.phase)&&run.time<720){
  assert.ok(performance.now()-start<240000,'Bounded wall time exceeded; partial receipt retained');
  if(run.phase==='upgrade'){controller.upgrade(run,wall,true);wall+=1500;const choice=controller.upgrade(run,wall,true);assert.ok(choice&&core.chooseOverflightUpgrade(run,choice.choiceId));continue;}
  const oldDamage=run.stats.damageTaken,oldLost=run.stats.airframesLost;
  mode.step(run,controller.input(run,{}));wall+=1000/60;
  if(run.stats.damageTaken!==oldDamage){
    receipt.damageEvents.push({time:run.time,tick:run.tick,hull:run.player.hull,x:run.player.x,y:run.player.y,damage:run.stats.damageTaken-oldDamage,causes:{...run.stats.damageCauses},airframesLost:run.stats.airframesLost,boostCooldown:run.player.boostCooldown,riy:run.riy?{phase:run.riy.phase,targetId:run.riy.targetId}:null,nearest:run.enemies.filter(e=>e.active).map(e=>({id:e.id,family:e.family,role:e.role,phase:e.behaviorPhase,distance:Math.hypot(e.x-run.player.x,e.y-run.player.y),warning:e.warning})).sort((a,b)=>a.distance-b.distance).slice(0,5)});
  }
  if(!receipt.firstReplacement&&run.stats.airframesLost>oldLost){receipt.firstReplacement={time:run.time,tick:run.tick,damage:run.stats.damageTaken,drafts:structuredClone(run.progression.history)};}
  const bucket=Math.floor(run.time/15);if(bucket!==lastBucket){lastBucket=bucket;receipt.samples.push({time:run.time,x:run.player.x,y:run.player.y,damage:run.stats.damageTaken,airframesLost:run.stats.airframesLost,earned:run.stats.xpEarned,collected:run.stats.xpCollected,onGround:run.stats.xpOnGround,choices:run.progression.choices,targets:run.enemies.filter(e=>e.active&&['elite','final'].includes(e.role)).map(e=>({id:e.id,role:e.role,hp:e.hp,armor:e.armor,distance:Math.hypot(e.x-run.player.x,e.y-run.player.y)}))});}
 }
 Object.assign(receipt,{phase:run.phase,time:run.time,stats:run.stats,goals:run.goals,build:run.build,drafts:run.progression.history,riy:run.riy?{commands:run.riy.commands,engagements:run.riy.engagements,escorts:run.riy.escorts.map(e=>({role:e.role,shots:e.shots}))}:null});
 const original=evidence.results.find(r=>r.index===row.index&&r.pacing==='late-1250-1550').active;
 receipt.originalOneAirframeTight={phase:original.phase,time:original.time,stats:original.stats,drafts:original.drafts};
 if(row.route==='tight')receipt.firstLifeParity={sameLossTick:receipt.firstReplacement?.time===original.time,sameDraftsUntilLoss:JSON.stringify(receipt.firstReplacement?.drafts)===JSON.stringify(original.drafts)};
 persist();console.log(JSON.stringify({index:row.index,route:row.route,airframes:row.airframes,phase:run.phase,time:run.time,damage:run.stats.damageTaken,firstLifeParity:receipt.firstLifeParity,elapsedWallSeconds:(performance.now()-start)/1000}));
}
report.complete=true;
}finally{report.endedUTC=new Date().toISOString();report.endHead=head();report.endHashes=hashes();report.sourceStable=JSON.stringify(report.sourceHashes)===JSON.stringify(report.endHashes);report.wallSeconds=(performance.now()-start)/1000;persist();}
assert.ok(report.sourceStable,'Runtime dependency sources changed during comparison');
