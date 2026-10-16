#!/usr/bin/env node
// Manual authenticated-recording replay against the actual current runtime.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {readFile,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
const root='/Users/oleksandr.mekhovov/.codex/worktrees/fpv-stadium-structures/go_test/';
const expectedHead=process.argv[2];
assert.match(expectedHead||'',/^[a-f0-9]{40}$/,'explicit frozen committed candidate SHA required');
const git=(...args)=>execFileSync('git',args,{cwd:root,maxBuffer:16*1024*1024});
const hash=value=>createHash('sha256').update(value).digest('hex');
const startedAt=new Date().toISOString(),checks=[],results=[];
const check=(name,pass,details=undefined)=>{checks.push({name,passed:!!pass,...(details===undefined?{}:{details})});assert(pass,name);};
const candidate=git('rev-parse','HEAD').toString().trim();check('current source is the intended normally merged candidate',candidate===expectedHead);
const tree=git('rev-parse','HEAD^{tree}').toString().trim();
const sources={},paths=[...git('ls-files','optional-practice/civilian-fpv').toString().trim().split('\n'),'game/data-json.mjs','game/presentation/theme-system.mjs'];
for(const path of paths){const bytes=await readFile(root+path);check(path+': current probe input equals its committed candidate bytes',bytes.equals(git('show',candidate+':'+path)));sources[path]={bytes:bytes.length,sha256:hash(bytes)};}
const archiveInfo=JSON.parse(await readFile(root+'docs/evidence/fpv-adventures-proof-archive-20261002.json','utf8')),
 historical=JSON.parse(await readFile(root+'docs/evidence/fpv-adventures-physics-20261002.json','utf8')),
 inputsBytes=await readFile('/tmp/fpv-campus-authenticated-replay-inputs.json'),inputs=JSON.parse(inputsBytes),archive=await readFile(inputs.archive);
check('whole authoritative archive retains its pinned bytes and SHA-256',archive.length===archiveInfo.archiveBytes&&hash(archive)===archiveInfo.archiveSha256&&inputs.archiveSha256===archiveInfo.archiveSha256);
check('authenticated extraction is bound to the retained manifest',inputs.manifestSha256===archiveInfo.manifestSha256&&inputs.files.length===10);
const {WORLD_CATALOGUE,ADVENTURE_IDENTITY}=await import(pathToFileURL(root+'optional-practice/civilian-fpv/world-catalogue.mjs')),
 {initWorldRuntime,replayWorldFlight,validateWorldCourse,worldStateIdentity}=await import(pathToFileURL(root+'optional-practice/civilian-fpv/world-model.mjs')),
 {dataIdentity}=await import(pathToFileURL(root+'game/data-json.mjs')),
 {default:RAPIER}=await import(pathToFileURL(root+'optional-practice/civilian-fpv/vendor/rapier/rapier.mjs'));
check('current adventure pack retains the archived identity',ADVENTURE_IDENTITY===inputs.manifest.packIdentity&&ADVENTURE_IDENTITY===historical.packIdentity);
const courses=WORLD_CATALOGUE.filter(entry=>entry.course.environment==='rooftops');
const pairs=new Set(inputs.files.map(file=>{const row=JSON.parse(file.text);return row.id+'/'+row.mode;}));
check('exactly both modes for each of the five current Campus courses are present',courses.length===5&&pairs.size===10&&courses.every(entry=>['self-level','acro'].every(mode=>pairs.has(entry.id+'/'+mode))));
await initWorldRuntime();
const oldCreateCollider=RAPIER.World.prototype.createCollider,oldFree=RAPIER.World.prototype.free;
const worlds=new Map();let peakLiveWorlds=0;
RAPIER.World.prototype.createCollider=function(...args){if(!worlds.has(this))worlds.set(this,{collidersCreated:0,freeCalls:0,freed:false});const value=Reflect.apply(oldCreateCollider,this,args);worlds.get(this).collidersCreated++;peakLiveWorlds=Math.max(peakLiveWorlds,[...worlds.values()].filter(row=>!row.freed).length);return value;};
RAPIER.World.prototype.free=function(...args){const row=worlds.get(this);assert(row,'freed Rapier world was observed allocating its collision resources');row.freeCalls++;assert.equal(row.freeCalls,1,'collision world freed exactly once');const value=Reflect.apply(oldFree,this,args);row.freed=true;return value;};
try{
 for(const file of inputs.files){
  const bytes=Buffer.from(file.text),row=JSON.parse(file.text),manifest=inputs.manifest.recordings.find(record=>record.file===file.path),prior=historical.results.find(record=>record.id===row.id&&record.mode===row.mode),entry=courses.find(course=>course.id===row.id),label=row.id+'/'+row.mode;
  check(label+': complete extracted proof bytes match archive manifest',!!manifest&&bytes.length===file.bytes&&bytes.length===manifest.bytes&&hash(bytes)===file.sha256&&hash(bytes)===manifest.sha256);
  check(label+': complete proof retains historical authoring hash and final identity',!!prior&&hash(JSON.stringify(row.proof))===prior.proofSha256&&row.proof.finalStateIdentity===prior.finalStateIdentity&&row.proof.finalStateIdentity===manifest.finalStateIdentity&&row.proof.frames.length===manifest.ticks&&manifest.ticks===prior.ticks);
  const course=validateWorldCourse(entry.course),sourceIdentity=dataIdentity(course);
  check(label+': current normalized course and recorded mode identities match',sourceIdentity===row.sourceIdentity&&sourceIdentity===manifest.sourceIdentity&&sourceIdentity===prior.sourceIdentity&&row.packIdentity===ADVENTURE_IDENTITY&&row.proof.course===row.id&&row.proof.mode===row.mode);
  const beforeWorlds=worlds.size,replay=await replayWorldFlight(course,row.proof,{sampleEvery:50,yieldControl:async()=>{}}),state=replay.state,identity=worldStateIdentity(state),newWorlds=[...worlds.values()].slice(beforeWorlds),blocked=state.actors.filter(actor=>actor.blocked);
  check(label+': real fixed-step replay completes every objective with exact final identity',state.status==='complete'&&state.step===state.total&&identity===row.proof.finalStateIdentity&&state.ticks===row.proof.frames.length);
  check(label+': every runtime, world, course, mode, response, rule and condition identity is exact',Object.entries(replay.identity).every(([key,value])=>row.proof[key]===value));
  check(label+': collision, health and weapon outcomes match authoritative recording',state.contacts===prior.contacts&&state.contacts===0&&state.health===prior.health&&state.maxHealth===prior.maxHealth&&state.shots===prior.shots&&state.hits===prior.hits,{actual:{contacts:state.contacts,health:state.health,maxHealth:state.maxHealth,shots:state.shots,hits:state.hits},historical:{contacts:prior.contacts,health:prior.health,maxHealth:prior.maxHealth,shots:prior.shots,hits:prior.hits}});
  check(label+': sampled replay positions remain in the authored flight bounds',replay.path.length>0&&replay.path.every(sample=>['x','y','z'].every(axis=>sample.position[axis]>=course.bounds.min[axis]&&sample.position[axis]<=course.bounds.max[axis])));
  check(label+': no final actor is blocked',blocked.length===0);
  check(label+': exactly one Rapier collision world is released once before return',newWorlds.length===1&&newWorlds[0].freeCalls===1&&newWorlds[0].freed&&[...worlds.values()].every(world=>world.freed));
  results.push({id:row.id,mode:row.mode,sourceIdentity,courseIdentity:replay.identity.courseIdentity,worldIdentity:replay.identity.worldIdentity,proofFile:file.path,proofFileSha256:file.sha256,proofSha256:prior.proofSha256,completed:true,replayed:true,ticks:state.ticks,status:state.status,step:state.step,total:state.total,contacts:state.contacts,health:state.health,maxHealth:state.maxHealth,shots:state.shots,hits:state.hits,finalBlockedActors:blocked.length,finalStateIdentity:identity,pathSamples:replay.path.length,pathSampleSha256:hash(JSON.stringify(replay.path)),resources:newWorlds[0]});
  console.log(JSON.stringify({course:row.id,mode:row.mode,ticks:state.ticks,identity,contacts:state.contacts,health:state.health,collisionWorldFreed:newWorlds[0].freed}));
 }
}finally{RAPIER.World.prototype.createCollider=oldCreateCollider;RAPIER.World.prototype.free=oldFree;}
check('all ten authenticated proofs replay through exactly 53982 ticks',results.length===10&&results.reduce((sum,row)=>sum+row.ticks,0)===53982);
check('all ten collision worlds are freed exactly once with none left live',worlds.size===10&&[...worlds.values()].every(row=>row.freed&&row.freeCalls===1)&&peakLiveWorlds===1);
for(const [path,source] of Object.entries(sources))check(path+': qualified source bytes remained unchanged during replay',hash(await readFile(root+path))===source.sha256);
const receipt={format:'FPVCampusFacadeReplay.v1',startedAt,finishedAt:new Date().toISOString(),candidate,candidateTree:tree,headAfterReplay:git('rev-parse','HEAD').toString().trim(),rendererSha256:sources['optional-practice/civilian-fpv/renderer.mjs'].sha256,probeSha256:hash(await readFile(new URL(import.meta.url))),inputBundleSha256:hash(inputsBytes),archive:{path:inputs.archive,bytes:archive.length,sha256:hash(archive),manifestSha256:archiveInfo.manifestSha256},method:'Fresh replayWorldFlight of all ten authenticated retained Campus proofs using the current committed 50 Hz model, original recorded controls and current normalized catalogue courses. Existing replay validates every runtime/course/world/mode/response/rules/conditions identity and exact final state. No recording generation, injected state, altered controls or course edits. Transparent wrappers around the actual Rapier World createCollider/free methods observe construction and cleanup while forwarding all calls and return values unchanged; wrappers are restored in finally.',sources,checks,results,summary:{courses:5,modes:['acro','self-level'],recordings:results.length,ticks:results.reduce((sum,row)=>sum+row.ticks,0),completed:results.filter(row=>row.completed).length,replayed:results.filter(row=>row.replayed).length,contacts:results.reduce((sum,row)=>sum+row.contacts,0),fullHealth:results.every(row=>row.health===row.maxHealth),finalBlockedActors:results.reduce((sum,row)=>sum+row.finalBlockedActors,0),collisionWorldsCreated:worlds.size,collisionWorldsFreed:[...worlds.values()].filter(row=>row.freed).length,peakLiveCollisionWorlds:peakLiveWorlds,liveCollisionWorldsAfter:[...worlds.values()].filter(row=>!row.freed).length},limitations:['Exact historical health, contacts and weapon outcomes are required for every recording.', 'Fresh CPU deterministic replay is not WebGL, visual acceptance, public launch, human learning or physical-controller qualification.','Path samples are one-second interval snapshots plus terminal state, not a swept-clearance proof. Zero contacts is the authoritative simulation contact counter. Actor blockage is reported at the exact final state; no claim of continuous actor-clearance sampling.','Observed Rapier free calls confirm collision-world cleanup, not a measured process-memory plateau or GPU resource result.','Additional unit coverage remains deferred; this is a manual functional replay command.']};
const path='/tmp/fpv-campus-facade-replay.json',bytes=JSON.stringify(receipt,null,2)+'\n';await writeFile(path,bytes,{flag:'wx'});console.log(JSON.stringify({passed:checks.length,...receipt.summary,receipt:path,receiptBytes:Buffer.byteLength(bytes),receiptSha256:hash(bytes),rendererSha256:receipt.rendererSha256}));
