// An isolated, fictional toy study. No body images, collection unlocks, terrain rules or real weapon model.
export const ABILITY_REGISTRY = Object.freeze({version:"arcade-abilities.v1",primitives:Object.freeze(["pulse","drop","dash","projectile","net"])});
const vectors={up:[0,-1],right:[1,0],down:[0,1],left:[-1,0]};
const clone=value=>structuredClone(value);
const bounded=(value,min,max)=>Number.isFinite(value)&&value>=min&&value<=max;
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const getClass=(config,id)=>config.classes.find(item=>item.id===id);
const getEquipment=(config,id)=>config.equipment.find(item=>item.id===id);
const fail=message=>{throw new Error(`Ability study: ${message}`);};
const validId=id=>typeof id==="string"&&/^[a-z][a-z0-9-]{0,63}$/.test(id);
const allowedTargets=outcome=>({scan:["note"],clear:["ground","air"],deliver:["delivery"],restore:["relay"],disable:["air"],capture:["air"]})[outcome]||[];

export function validateAbilityPresets(config) {
  if(config.version!=="1.0.0"||config.registryVersion!==ABILITY_REGISTRY.version)fail("unsupported registry/version");
  if(!Array.isArray(config.classes)||config.classes.length<1||config.classes.length>40)fail("bounded class list required");
  if(!Array.isArray(config.equipment)||config.equipment.length<1||config.equipment.length>8)fail("bounded equipment list required");
  const ids=new Set();
  for(const item of config.equipment){
    if(!validId(item.id)||ids.has(item.id))fail("equipment IDs must be unique");ids.add(item.id);
    if(!bounded(item.budgetCapacity,0,200)||!bounded(item.costPerCell,0,10)||typeof item.ignoreHaze!=="boolean"||typeof item.blockWhenEmpty!=="boolean")fail("invalid link parameters");
    if(item.blockWhenEmpty&&item.budgetCapacity<=0)fail("a budgeted link needs capacity");
  }
  const classIds=new Set();
  for(const item of config.classes){
    if(!validId(item.id)||classIds.has(item.id))fail("class IDs must be unique");classIds.add(item.id);
    if(!ABILITY_REGISTRY.primitives.includes(item.primitive))fail(`unsupported primitive ${item.primitive}`);
    if(!Array.isArray(item.compatibleEquipment)||!item.compatibleEquipment.length||item.compatibleEquipment.some(id=>!ids.has(id))||!item.compatibleEquipment.includes(item.recommendedEquipment))fail("invalid equipment compatibility");
    if(!item.preferredBodies||typeof item.description!=="string")fail("class description and preferred-body map required");
    const tune=item.tuning;
    if(!tune||!bounded(tune.cooldown,.1,30)||!Number.isInteger(tune.capacity)||!bounded(tune.capacity,0,20)||!Number.isInteger(tune.initial)||!bounded(tune.initial,0,tune.capacity)||!Number.isInteger(tune.cost)||!bounded(tune.cost,0,tune.capacity))fail("invalid cooldown/charge parameters");
    if(!bounded(tune.radius,.1,6)||!bounded(tune.duration,.1,10)||!allowedTargets(tune.outcome).length)fail("invalid radius/duration/outcome");
    if(["dash","projectile","net"].includes(item.primitive)&&!bounded(tune.range,.1,12))fail("invalid range");
    if(item.primitive==="projectile"&&!bounded(tune.speed,.5,20))fail("invalid projectile speed");
    if(item.primitive==="dash"&&typeof tune.resetOnHit!=="boolean")fail("dash reset behavior must be explicit");
    if(item.primitive==="net"&&(!bounded(tune.slowFactor,.05,1)||!bounded(tune.captureSeconds,.1,8)))fail("invalid net parameters");
    if(item.visualWake&&(!bounded(item.visualWake.spacing,.05,2)||!bounded(item.visualWake.duration,.1,2)))fail("invalid visual wake");
    const outcomes={pulse:["scan","restore"],drop:["clear","deliver"],dash:["clear","disable"],projectile:["clear","disable"],net:["capture"]};
    if(!outcomes[item.primitive].includes(tune.outcome))fail("primitive/outcome pair unsupported");
  }
  if(!classIds.has(config.defaults?.classId)||!getClass(config,config.defaults.classId).compatibleEquipment.includes(config.defaults.equipmentId))fail("invalid defaults");
  const stage=config.stage;
  if(!stage||!Array.isArray(stage.targets)||stage.targets.length>24||!Array.isArray(stage.supplyPads)||!stage.supplyPads.length||stage.supplyPads.length>6||!Array.isArray(stage.haze)||stage.haze.length>6)fail("invalid toy stage");
  const targetIds=new Set();
  for(const item of [...stage.targets,...stage.supplyPads]){
    if(!validId(item.id)||targetIds.has(item.id)||!bounded(item.x,.5,47.5)||!bounded(item.y,.5,35.5))fail("invalid stage identity/coordinate");targetIds.add(item.id);
  }
  for(const target of stage.targets){
    if(!["ground","air","note","delivery","relay"].includes(target.kind)||typeof target.label!=="string")fail("unknown toy marker");
    if(target.kind==="air"&&(!bounded(target.speed,0,3)||!bounded(target.minX,.5,target.x)||!bounded(target.maxX,target.x,47.5)||target.maxX-target.minX<1))fail("invalid moving toy lane");
  }
  for(const pad of stage.supplyPads)if(!bounded(pad.radius,.5,4))fail("invalid pad radius");
  for(const haze of stage.haze)if(!bounded(haze.x,0,47)||!bounded(haze.y,0,35)||!bounded(haze.width,1,48-haze.x)||!bounded(haze.height,1,36-haze.y)||!bounded(haze.displaySignal,0,1))fail("invalid synthetic haze");
  for(const family of ["fpv-front","ukraine-atlas","retro-1994","navi-network"]){
    const vocab=config.vocabulary?.[family];
    if(!vocab||config.classes.some(item=>typeof vocab.classLabels?.[item.id]!=="string")||config.equipment.some(item=>typeof vocab.equipmentLabels?.[item.id]!=="string"))fail("missing family vocabulary");
    for(const key of ["supplyLabel","hazeLabel","budgetLabel"])if(typeof vocab[key]!=="string"||!vocab[key].trim()||vocab[key].length>100)fail(`invalid vocabulary ${key}`);
  }
  return config;
}

export function createAbilityState(config,classId=config.defaults.classId,equipmentId=config.defaults.equipmentId,player={x:6,y:6},lastEventId=0) {
  const item=getClass(config,classId);
  if(!item||!item.compatibleEquipment.includes(equipmentId))fail("incompatible class/link");
  const equipment=getEquipment(config,equipmentId);
  return {version:"1.0.0",classId,equipmentId,time:0,remainder:0,ammo:item.tuning.initial,cooldownUntil:0,lastEventId,
    budget:equipment.budgetCapacity||null,lastPlayer:{x:player.x,y:player.y},lastTravelDistance:Number.isFinite(player.distance)?player.distance:null,tetherAnchor:{...config.stage.supplyPads[0]},
    targets:config.stage.targets.map(target=>({...clone(target),status:"ready",revealedUntil:0,netProgress:0,travelDirection:1})),effects:[],projectiles:[],fields:[],wake:[],wakeDistance:0,completed:0};
}

export function switchAbilityLoadout(previous,config,classId,equipmentId,player) {
  return createAbilityState(config,classId,equipmentId,player,previous.lastEventId);
}

export function abilityReadout(state,config,player) {
  const item=getClass(config,state.classId),equipment=getEquipment(config,state.equipmentId);
  const haze=config.stage.haze.find(area=>player.x>=area.x&&player.x<=area.x+area.width&&player.y>=area.y&&player.y<=area.y+area.height);
  const pad=config.stage.supplyPads.find(pad=>distance(player,pad)<=pad.radius);
  const cooldown=Math.max(0,state.cooldownUntil-state.time);
  return {class:item,equipment,capacity:item.tuning.capacity,ammo:state.ammo,cooldown,budget:state.budget,budgetCapacity:equipment.budgetCapacity,
    pad:pad?.id||null,inHaze:Boolean(haze),signal:haze&&!equipment.ignoreHaze?haze.displaySignal:1,
    ready:cooldown<=1e-8&&state.ammo>=item.tuning.cost&&!(equipment.blockWhenEmpty&&state.budget<=0),
    completed:state.completed,total:state.targets.length};
}

export function segmentDistance(point,start,end) {
  const dx=end.x-start.x,dy=end.y-start.y,length=dx*dx+dy*dy;
  const t=length?Math.max(0,Math.min(1,((point.x-start.x)*dx+(point.y-start.y)*dy)/length)):0;
  return Math.hypot(point.x-start.x-t*dx,point.y-start.y-t*dy);
}

export function segmentContactFraction(point,start,end,radius) {
  const dx=end.x-start.x,dy=end.y-start.y,px=start.x-point.x,py=start.y-point.y;
  const a=dx*dx+dy*dy,c=px*px+py*py-radius*radius;
  if(c<=0)return 0;if(a<=1e-14)return null;
  const b=2*(px*dx+py*dy),discriminant=b*b-4*a*c;
  if(discriminant<0)return null;
  const fraction=(-b-Math.sqrt(discriminant))/(2*a);
  return fraction>=-1e-10&&fraction<=1+1e-10?Math.max(0,Math.min(1,fraction)):null;
}

function finishTarget(state,target,outcome,duration=0) {
  if(outcome==="scan"){target.revealedUntil=state.time+duration;return;}
  if(target.status!=="ready")return;
  target.status=outcome;state.completed++;
}

function hitTargets(state,outcome,position,radius,duration,groundOnly=false) {
  let hits=0;
  for(const target of state.targets)if(target.status==="ready"&&allowedTargets(outcome).includes(target.kind)&&(!groundOnly||target.kind==="ground")&&distance(target,position)<=radius){finishTarget(state,target,outcome,duration);hits++;}
  return hits;
}

function dashEnd(player,range,policy) {
  const [dx,dy]=vectors[player.direction],low=policy==="grid-center"?.5:.8,highX=48-low,highY=36-low;
  const end={x:Math.max(low,Math.min(highX,player.x+dx*range)),y:Math.max(low,Math.min(highY,player.y+dy*range))};
  if(policy==="grid-center"){
    if(dx)end.x=(dx>0?Math.floor(end.x-.5+1e-8):Math.ceil(end.x-.5-1e-8))+.5;
    if(dy)end.y=(dy>0?Math.floor(end.y-.5+1e-8):Math.ceil(end.y-.5-1e-8))+.5;
  }
  if((end.x-player.x)*dx+(end.y-player.y)*dy<=1e-8)return null;
  return end;
}

export function requestAbility(previous,event,context,config) {
  const state=clone(previous);
  const reject=reason=>({state,accepted:false,reason,relocation:null});
  if(!Number.isSafeInteger(event?.id)||event.id<=0||!["act","pickup"].includes(event.type))return reject("invalid-event");
  if(event.id<=state.lastEventId)return reject("duplicate-event");
  state.lastEventId=event.id;
  if(context.paused)return reject("paused");
  if(!vectors[context.player?.direction]||![context.player.x,context.player.y].every(Number.isFinite))return reject("invalid-player");
  const readout=abilityReadout(state,config,context.player),item=readout.class,tune=item.tuning;
  if(event.type==="pickup"){
    if(!readout.pad)return reject("near-pad-required");
    state.ammo=tune.capacity;state.budget=readout.equipment.budgetCapacity||null;
    state.tetherAnchor={...config.stage.supplyPads.find(pad=>pad.id===readout.pad)};
    state.lastPlayer={x:context.player.x,y:context.player.y};
    state.lastTravelDistance=Number.isFinite(context.player.distance)?context.player.distance:null;
    return {state,accepted:true,reason:"refilled",relocation:null};
  }
  if(readout.cooldown>1e-8)return reject("cooldown");
  if(readout.equipment.blockWhenEmpty&&state.budget<=0)return reject("link-empty");
  if(state.ammo<tune.cost)return reject("charges-empty");
  if(item.primitive==="projectile"&&state.projectiles.length>=32||item.primitive==="net"&&state.fields.length>=16)return reject("effect-limit");
  const plannedDash=item.primitive==="dash"?dashEnd(context.player,tune.range,context.turnPolicy):null;
  if(item.primitive==="dash"&&!plannedDash)return reject("no-reachable-center");
  state.ammo-=tune.cost;state.cooldownUntil=state.time+tune.cooldown;
  const player=context.player,[dx,dy]=vectors[player.direction];
  let hits=0,relocation=null;
  if(item.primitive==="pulse"||item.primitive==="drop"){
    hits=hitTargets(state,tune.outcome,player,tune.radius,tune.duration,item.primitive==="drop"&&tune.outcome==="clear");
    state.effects.push({type:item.primitive,x:player.x,y:player.y,radius:tune.radius,outcome:tune.outcome,until:state.time+Math.min(tune.duration,1)});
  }else if(item.primitive==="dash"){
    const end=plannedDash;
    for(const target of state.targets)if(target.status==="ready"&&allowedTargets(tune.outcome).includes(target.kind)&&(tune.outcome!=="clear"||target.kind==="ground")&&segmentDistance(target,player,end)<=tune.radius){finishTarget(state,target,tune.outcome);hits++;}
    state.effects.push({type:"dash",x:player.x,y:player.y,toX:end.x,toY:end.y,until:state.time+tune.duration});
    relocation=tune.resetOnHit&&hits?{x:context.stageStart.x,y:context.stageStart.y,reset:true}:{...end,reset:false};
    if(state.budget!==null)state.budget=Math.max(0,state.budget-(Math.abs(end.x-player.x)+Math.abs(end.y-player.y))*readout.equipment.costPerCell);
    state.lastPlayer={x:relocation.x,y:relocation.y};
  }else if(item.primitive==="projectile"){
    state.projectiles.push({id:event.id,x:player.x,y:player.y,dx,dy,speed:tune.speed,remaining:Math.min(tune.range,tune.speed*tune.duration),radius:tune.radius,outcome:tune.outcome});
  }else if(item.primitive==="net"){
    state.fields.push({id:event.id,x:Math.max(.5,Math.min(47.5,player.x+dx*tune.range)),y:Math.max(.5,Math.min(35.5,player.y+dy*tune.range)),radius:tune.radius,until:state.time+tune.duration,slowFactor:tune.slowFactor,captureSeconds:tune.captureSeconds});
  }
  return {state,accepted:true,reason:relocation?.reset?"tagged-returned":hits?"marker-updated":"action-used",relocation};
}

function tick(state,dt) {
  const startTime=state.time;
  state.time+=dt;
  state.effects=state.effects.filter(effect=>effect.until>state.time);
  for(const target of state.targets){
    if(target.status!=="ready"||target.kind!=="air")continue;
    const field=state.fields.filter(field=>field.until>startTime+1e-10&&distance(target,field)<=field.radius).sort((a,b)=>b.until-a.until)[0];
    const activeTime=field?Math.min(dt,Math.max(0,field.until-startTime)):0;
    let travel=target.speed*(activeTime*(field?.slowFactor||1)+(dt-activeTime));
    while(travel>1e-10){const edge=target.travelDirection>0?target.maxX:target.minX,portion=Math.min(travel,Math.abs(edge-target.x));target.x+=portion*target.travelDirection;travel-=portion;if(Math.abs(target.x-edge)<1e-8)target.travelDirection*=-1;}
    if(field){target.netProgress+=activeTime;if(target.netProgress+1e-8>=field.captureSeconds)finishTarget(state,target,"capture");}else target.netProgress=0;
  }
  state.fields=state.fields.filter(field=>field.until>state.time+1e-10);
  const surviving=[];
  for(const projectile of state.projectiles){
    const travel=Math.min(projectile.remaining,projectile.speed*dt),end={x:projectile.x+projectile.dx*travel,y:projectile.y+projectile.dy*travel};
    const candidates=state.targets.filter(target=>target.status==="ready"&&allowedTargets(projectile.outcome).includes(target.kind)).map(target=>({target,entry:segmentContactFraction(target,projectile,end,projectile.radius)})).filter(item=>item.entry!==null);
    candidates.sort((a,b)=>a.entry-b.entry||(a.target.id<b.target.id?-1:a.target.id>b.target.id?1:0));
    const hit=candidates[0]?.target;
    if(hit){finishTarget(state,hit,projectile.outcome);state.effects.push({type:"spark",x:hit.x,y:hit.y,radius:.6,until:state.time+.3});continue;}
    Object.assign(projectile,end);projectile.remaining-=travel;
    if(projectile.remaining>1e-8&&projectile.x>=0&&projectile.x<=48&&projectile.y>=0&&projectile.y<=36)surviving.push(projectile);
  }
  state.projectiles=surviving;
}

export function advanceAbility(previous,context,elapsed,config) {
  if(context.paused)return clone(previous);
  const state=clone(previous),dt=Number.isFinite(elapsed)?Math.max(0,Math.min(.25,elapsed)):0;
  const equipment=getEquipment(config,state.equipmentId);
  const wake=getClass(config,state.classId).visualWake;
  const player=context.player;
  if(player){
    const travel=Number.isFinite(player.distance)&&Number.isFinite(state.lastTravelDistance)?Math.max(0,player.distance-state.lastTravelDistance):Math.abs(player.x-state.lastPlayer.x)+Math.abs(player.y-state.lastPlayer.y);
    if(state.budget!==null)state.budget=Math.max(0,state.budget-travel*equipment.costPerCell);
    if(wake){
      state.wakeDistance+=travel;
      if(state.wakeDistance>=wake.spacing){state.wake.push({x:state.lastPlayer.x,y:state.lastPlayer.y,until:state.time+wake.duration,duration:wake.duration});state.wakeDistance%=wake.spacing;}
    }
    state.lastPlayer={x:player.x,y:player.y};
    state.lastTravelDistance=Number.isFinite(player.distance)?player.distance:null;
  }
  state.remainder+=dt;
  const step=1/120;
  while(state.remainder>=step-1e-10){tick(state,step);state.remainder-=step;}
  state.remainder=Math.max(0,state.remainder);
  state.wake=state.wake.filter(point=>point.until>state.time).slice(-24);
  return state;
}
