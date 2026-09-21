import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import * as current from './source/game/core/index.mjs';
import * as previous from './previous/game/core/index.mjs';
import {authoritativeCheckpoint as newCheckpoint} from './source/game/replay.mjs';
import {authoritativeCheckpoint as oldCheckpoint} from './previous/game/replay.mjs';
const rows=[];
for(const file of ['fpv-arcade-r5','classic-lab','sentinel-relay']){
 const pack=JSON.parse(await readFile(new URL(file+'.json',import.meta.url),'utf8'));
 for(const campaign of pack.campaigns)for(const level of campaign.levels)for(const turnPolicy of ['immediate','grid-center'])for(const seed of [1,7]){
  const options={turnPolicy,seed,classId:'scout'},a=current.createRun(level,options),b=previous.createRun(level,options),events={},snapshots=[];
  assert.deepEqual(newCheckpoint(a),oldCheckpoint(b));
  let ticks=0;
  for(;ticks<1200&&!['won','lost'].includes(a.status);ticks++){
   const direction=['right','down','left','up'][Math.floor(ticks/240)%4];
   current.stepRun(a,{direction},current.FIXED_DT);previous.stepRun(b,{direction},previous.FIXED_DT);
   assert.deepEqual(a.events,b.events,`${level.id}/${turnPolicy}/${seed}/tick${ticks}`);
   for(const e of a.events)events[e.type]=(events[e.type]||0)+1;
   if(ticks%120===0){assert.deepEqual(newCheckpoint(a),oldCheckpoint(b));snapshots.push(newCheckpoint(a).hash);}
  }
  assert.deepEqual(newCheckpoint(a),oldCheckpoint(b));
  rows.push({pack:pack.id,level:level.id,version:level.version,turnPolicy,seed,ticks,status:a.status,coverage:a.coverage,score:a.score,events,snapshots,finalHash:newCheckpoint(a).hash});
 }
 console.log(JSON.stringify({pack:pack.id,cases:rows.filter(r=>r.pack===pack.id).length,pass:true}));
}
await writeFile(new URL('historical-comparison.json',import.meta.url),JSON.stringify({runtime:process.version,current:'851a2100',previous:'6ff7e3a3',scope:'Default scout; fixed authored input sequence; 1200 tick maximum; every event and 120-tick checkpoints compared; no claim of human balance or every historical map.',cases:rows},null,2)+'\n');
