/** Deterministic ordinary-input balance probes, never a claim of human difficulty. */
import { writeFileSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { createOverflightProject,compileOverflightProject } from '../../../../game/overflight/project.mjs';
import { createOverflightRiyProject,compileOverflightRiyProject } from '../../../../game/overflight/riy-project.mjs';
import { createOverflightRiy,stepOverflightRiy,overflightRiyTarget } from '../../../../game/overflight/riy-core.mjs';
import { createOverflightRiyMode } from '../../../../game/overflight/riy-mode.mjs';
import { createOverflightRun,startOverflight,stepOverflight,chooseOverflightUpgrade,overflightSummary } from '../../../../game/overflight/core.mjs';
import { pilot,selectCard } from '../../../../game/overflight/review-pilot.mjs';
const squadMode=createOverflightRiyMode({selectCard});
const paths=['core','project','tactics','combat-profile','upgrades','riy-core','riy-project','riy-upgrades','review-pilot'].map(x=>`game/overflight/${x}.mjs`);
const hashes=()=>paths.map(path=>({path,sha256:createHash('sha256').update(readFileSync(new URL(`../../../../${path}`,import.meta.url))).digest('hex')}));
const evidence={format:'OverflightRebalanceReviewV1',date:new Date().toISOString(),source:hashes(),scope:'Ordinary inputs and earned cards only; draft menus always resolved, including after stopping or replacement. Automated route skill does not establish enjoyment or medal timing.',results:[]};
const clone=(value,seen=new Map())=>{
  if(value===null||typeof value!=='object') return value;
  if(seen.has(value)) return seen.get(value);
  const out=value instanceof Map?new Map():value instanceof Set?new Set():ArrayBuffer.isView(value)?value.slice():Array.isArray(value)?[]:{};
  seen.set(value,out);
  if(value instanceof Map)for(const[k,v]of value)out.set(clone(k,seen),clone(v,seen));
  else if(value instanceof Set)for(const v of value)out.add(clone(v,seen));
  else for(const key of Object.keys(value))out[key]=clone(value[key],seen);
  return out;
};
function drive(run, config, route='active', stop=Infinity) {
  const {mode,build}=config;
  const choices=[], samples=[]; let input={}, focus=false, stationaryOrigin=null;
  while(!['won','lost'].includes(run.phase)&&run.time<450) {
    while(run.phase==='upgrade'){
      const card=mode==='riy'?squadMode.selectCard(run,build):selectCard(run,build);
      if(!card||!chooseOverflightUpgrade(run,card.id))throw Error('Unresolved earned draft');
      choices.push({time:run.time,id:card.id});
    }
    if(run.time>=stop && !stationaryOrigin)stationaryOrigin={x:run.player.x,y:run.player.y};
    if(run.tick%6===0){
      if(!stationaryOrigin) input=pilot(run,'tight');
      else if(route==='none')input={};
      else if(route==='wall')input={x:1};
      else if(route==='tiny')input={x:Math.cos(run.time*4)*.2,y:Math.sin(run.time*4)*.2};
      else if(route==='orbit')input={x:Math.cos(run.time*.7),y:Math.sin(run.time*.7)};
      else input=pilot(run,'tight');
      const target=mode==='riy'?overflightRiyTarget(run):null;
      focus=process.env.BALANCE_FOCUS!=='0'&&(!stationaryOrigin||route==='active')&&target&&(target.role!=='common'||target.maxArmor>0||target.guardIntegrity>0)&&run.riy.cooldown===0;
    }
    const tick=run.tick;stepOverflight(run,input);
    if(mode==='riy'&&run.tick!==tick){stepOverflightRiy(run,{focus});focus=false;}
    if(run.tick%600===0)samples.push({time:run.time,x:Math.round(run.player.x),y:Math.round(run.player.y),hull:run.player.hull,airframes:run.airframesRemaining,damage:run.stats.damageTaken,kills:run.stats.kills,visible:run.stats.enemiesVisible});
    if(route==='checkpoint'&&run.time>=stop) return {run,choices,samples};
  }
  return {config,route,stop:Number.isFinite(stop)?stop:null,summary:overflightSummary(run),build:run.build,damageCauses:run.stats.damageCauses,shieldBlocks:run.stats.shieldBlocks,choices,samples};
}
const save=()=>writeFileSync(new URL(process.env.BALANCE_OUTPUT??'balance-smoke.json.gz',import.meta.url),gzipSync(JSON.stringify({...evidence,sourceAtFinish:hashes()},null,2)));
const matrix=process.env.BALANCE_MATRIX==='1';
const configs=[];
for(const mode of (process.env.BALANCE_MODE?[process.env.BALANCE_MODE]:['survivor','riy']))for(const build of (process.env.BALANCE_BUILD?[process.env.BALANCE_BUILD]:['fan-shield','echo','echo-shield','systems']))
for(const encounterSet of matrix?['front','crossing','mixed']:['front'])
for(const difficulty of matrix?['standard','veteran']:['standard']){
 const index=configs.length;
 configs.push({mode,build,encounterSet,difficulty,airframes:matrix&&Math.floor(index/2)%2?1:3,seed:matrix?[17031991,42,7][Math.floor(index/2)%3]:17031991});
}
for(const config of configs){
 const opts={...config,rulesVersion:Number(process.env.BALANCE_RULES??3)};
 const compiled=config.mode==='riy'?compileOverflightRiyProject(createOverflightRiyProject(opts)):compileOverflightProject(createOverflightProject(opts));
 const run=createOverflightRun(compiled,{airframes:config.airframes});
 if(config.mode==='riy')run.riy=createOverflightRiy(run);
 startOverflight(run);
 const checkpoint=Number(process.env.BALANCE_STOP??(matrix?[120,180,240][configs.indexOf(config)%3]:210));
 const earned=drive(run,config,'checkpoint',checkpoint);
 if(!earned.run){evidence.results.push(earned);save();console.log(JSON.stringify({config,early:earned.summary.outcome,time:earned.summary.time}));continue;}
 for(const route of matrix?['active','none','tiny','wall','orbit']:['active','none']){
   const result=drive(clone(earned.run),config,route,checkpoint);
   result.checkpoint={time:earned.run.time,build:clone(earned.run.build),hull:earned.run.player.hull,airframes:earned.run.airframesRemaining,choices:earned.run.progression.choices,heading:earned.run.player.heading};
   result.choices=[...earned.choices,...result.choices];
   result.samples=[...earned.samples,...result.samples];
   evidence.results.push(result);save();
   console.log(JSON.stringify({config,route,time:result.summary.time,outcome:result.summary.outcome,choices:result.choices}));
 }
}
