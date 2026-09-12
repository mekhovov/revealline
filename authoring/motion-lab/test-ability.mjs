import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {ABILITY_REGISTRY,validateAbilityPresets,createAbilityState,switchAbilityLoadout,requestAbility,advanceAbility,abilityReadout} from "./ability.mjs";
import {advanceMotion,createMotionState} from "./motion.mjs";

const config=JSON.parse(readFileSync(new URL("./ability-presets.json",import.meta.url)));
const visuals=JSON.parse(readFileSync(new URL("./presets.json",import.meta.url)));
const player=(x=6.5,y=6.5,direction="right")=>({x,y,direction});
const context=(point=player(),extra={})=>({player:point,paused:false,stageStart:{x:6.5,y:6.5},turnPolicy:"grid-center",...extra});
const start=(id,gear="radio",point=player())=>createAbilityState(config,id,gear,point);
const act=(state,id,point=player(),type="act",extra={})=>requestAbility(state,{id,type},context(point,extra),config);
const advance=(state,seconds,point=player(),fps=120)=>{
  let result=state;for(let i=0;i<Math.round(seconds*fps);i++)result=advanceAbility(result,context(point),1/fps,config);return result;
};
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);

test("ten classes use only registered primitives and separate valid body/link references",()=>{
  validateAbilityPresets(config);assert.equal(config.classes.length,10);
  assert.deepEqual([...new Set(config.classes.map(item=>item.primitive))].sort(),[...ABILITY_REGISTRY.primitives].sort());
  for(const item of config.classes){for(const id of Object.values(item.preferredBodies))assert.ok(visuals.characters[id]);assert.deepEqual(item.compatibleEquipment,["radio","fiber"]);}
  for(const family of Object.values(config.vocabulary))for(const item of config.classes)assert.ok(family.classLabels[item.id]);
});

test("unknown primitives, invalid resources, links, lanes and registry versions fail validation",()=>{
  for(const edit of [c=>c.classes[0].primitive="real-weapon",c=>c.registryVersion="unknown",c=>c.classes[0].tuning.cooldown=0,c=>c.classes[1].tuning.initial=20,c=>c.classes[0].compatibleEquipment=["unknown"],c=>c.stage.targets.find(t=>t.kind==="air").maxX=0]){
    const invalid=structuredClone(config);edit(invalid);assert.throws(()=>validateAbilityPresets(invalid),/Ability study/);
  }
});

test("light carrier needs nearby pickup, spends one charge and cannot repeat or overdraw",()=>{
  let state=start("light-bomber");assert.equal(act(state,1).reason,"charges-empty");
  const distant=act(state,1,player(20,20),"pickup");assert.equal(distant.reason,"near-pad-required");assert.equal(distant.state.ammo,0);
  const pickup=act(distant.state,2,player(),"pickup");assert.equal(pickup.accepted,true);assert.equal(pickup.state.ammo,1);
  const drop=act(pickup.state,3,player(10.5,6.5));assert.equal(drop.state.ammo,0);assert.equal(drop.state.targets.find(t=>t.id==="tile-a").status,"clear");
  const duplicate=act(drop.state,3,player(10.5,6.5));assert.equal(duplicate.reason,"duplicate-event");assert.deepEqual(duplicate.state,drop.state);
  state=advance(drop.state,1,player(10.5,6.5));assert.equal(act(state,4,player(10.5,6.5)).reason,"charges-empty");
});

test("heavy carrier holds two charges and cooldown cannot consume an extra charge",()=>{
  let state=act(start("heavy-carrier"),1,player(),"pickup").state;assert.equal(state.ammo,2);
  state=act(state,2,player(10.5,6.5)).state;assert.equal(state.ammo,1);
  const blocked=act(state,3,player(10.5,6.5));assert.equal(blocked.reason,"cooldown");assert.equal(blocked.state.ammo,1);
  state=advance(blocked.state,1.2,player(12.5,14.5));state=act(state,4,player(12.5,14.5)).state;
  assert.equal(state.ammo,0);assert.equal(state.completed,2);
});

test("courier delivery updates only its delivery marker, while drop-clear targets ground toys",()=>{
  let parcel=act(start("fixedwing-courier"),1,player(),"pickup").state;
  parcel=act(parcel,2,player(17.5,26.5)).state;assert.equal(parcel.targets.find(t=>t.kind==="delivery").status,"deliver");assert.equal(parcel.completed,1);
  let ground=act(start("heavy-carrier"),1,player(),"pickup").state;
  ground=act(ground,2,player(15.5,8.5)).state;assert.equal(ground.targets.find(t=>t.id==="air-a").status,"ready");
});

test("scan reveals notes temporarily and relay pulse restores only relay markers",()=>{
  let scout=act(start("scout"),1).state;
  assert.ok(scout.targets.find(t=>t.id==="note-a").revealedUntil>0);assert.equal(scout.completed,0);
  scout=advance(scout,4.2);assert.ok(scout.targets.find(t=>t.id==="note-a").revealedUntil<scout.time);
  const relay=act(start("relay"),1,player(29.5,10.5)).state;assert.equal(relay.targets.find(t=>t.kind==="relay").status,"restore");assert.equal(relay.ammo,0);
});

test("strike uses authoritative cardinal direction, spends charge and returns on ground tag",()=>{
  const point={...player(),heading:Math.PI};
  const result=act(start("strike"),1,point);
  assert.equal(result.accepted,true);assert.equal(result.state.ammo,0);assert.equal(result.reason,"tagged-returned");assert.deepEqual(result.relocation,{x:6.5,y:6.5,reset:true});assert.equal(point.x,6.5);
  const air=act(start("interceptor"),1,player(11.5,8.5));assert.equal(air.state.targets.find(t=>t.id==="air-a").status,"disable");assert.equal(air.relocation.reset,false);
});

test("grid dash ends on a valid rail center; immediate keeps continuous end and both clamp bounds",()=>{
  const point=player(6.9,20.5),state=start("interceptor","radio",point);
  const grid=act(state,1,point);near(grid.relocation.x,10.5);near(grid.relocation.y,20.5);
  const immediate=act(state,1,point,"act",{turnPolicy:"immediate"});near(immediate.relocation.x,10.9);
  const edge=act(start("interceptor"),1,player(46.9,20.5));near(edge.relocation.x,47.5);
  const edgeImmediate=act(start("interceptor"),1,player(46.9,20.5),"act",{turnPolicy:"immediate"});near(edgeImmediate.relocation.x,47.2);
});

test("a short grid dash cannot round backward or spend a charge without a reachable forward center",()=>{
  const modified=structuredClone(config);modified.classes.find(item=>item.id==="interceptor").tuning.range=.1;validateAbilityPresets(modified);
  for(const point of [player(6.9,6.5,"right"),player(6.1,6.5,"left"),player(6.5,6.9,"down"),player(6.5,6.1,"up")]){
    const initial=createAbilityState(modified,"interceptor","radio",point);
    const result=requestAbility(initial,{id:1,type:"act"},context(point),modified);
    assert.equal(result.reason,"no-reachable-center");assert.equal(result.relocation,null);assert.equal(result.state.ammo,initial.ammo);assert.equal(result.state.cooldownUntil,0);
  }
});

test("fiber dash charges its outbound distance once and excludes the strike return teleport",()=>{
  const point=player(),initial=start("strike","fiber",point),result=act(initial,1,point);
  assert.equal(result.relocation.reset,true);near(result.state.budget,32);
  const after=advanceAbility(result.state,context(point),.1,config);near(after.budget,32);
  const flight=start("interceptor","fiber",player(6.5,20.5));const dash=act(flight,1,player(6.5,20.5));near(dash.state.budget,32);
});

test("emitted dots use swept toy hits and deterministic fixed ticks across frame rates",()=>{
  let expected;
  for(const fps of [10,20,30,60,120]){
    let state=act(start("repeater"),1).state;state=advance(state,1,player(),fps);
    assert.equal(state.targets.find(t=>t.id==="tile-a").status,"clear");assert.equal(state.ammo,7);assert.equal(state.projectiles.length,0);
    if(!expected)expected=state;else{near(state.time,expected.time);near(state.targets.find(t=>t.id==="air-a").x,expected.targets.find(t=>t.id==="air-a").x);assert.equal(state.completed,expected.completed);}
  }
});

test("net slows an airborne toy then captures it after dwell time",()=>{
  const point=player(14,8.5);
  const plain=advance(start("net-catcher"),.5,point);
  let net=act(start("net-catcher"),1,point).state;net=advance(net,.5,point);
  const a=net.targets.find(t=>t.id==="air-a"),b=plain.targets.find(t=>t.id==="air-a");
  assert.ok(a.x<b.x);assert.ok(a.netProgress>.4);assert.equal(a.status,"ready");
  net=advance(net,.7,point);assert.equal(net.targets.find(t=>t.id==="air-a").status,"capture");
});

test("a net processes its full active interval including equal dwell/expiry and a partial final tick",()=>{
  for(const duration of [.1,.105,.5,1,2]){
    const modified=structuredClone(config),tune=modified.classes.find(item=>item.id==="net-catcher").tuning;
    tune.duration=duration;tune.captureSeconds=duration;modified.stage.targets.find(t=>t.id==="air-a").speed=0;validateAbilityPresets(modified);
    const point=player(14,8.5);let state=createAbilityState(modified,"net-catcher","radio",point);
    state=requestAbility(state,{id:1,type:"act"},context(point),modified).state;
    for(let i=0;i<Math.ceil(duration*120);i++)state=advanceAbility(state,context(point),1/120,modified);
    const target=state.targets.find(t=>t.id==="air-a");assert.equal(target.status,"capture");near(target.netProgress,duration);assert.equal(state.fields.length,0);
  }
});

test("projectiles resolve the first swept contact rather than the nearest target center",()=>{
  const modified=structuredClone(config);
  modified.stage.targets=[{id:"a",kind:"ground",label:"A",x:6.76,y:6.72},{id:"b",kind:"ground",label:"B",x:6.85,y:6.5}];validateAbilityPresets(modified);
  let state=createAbilityState(modified,"repeater","radio",player());
  state=requestAbility(state,{id:1,type:"act"},context(),modified).state;
  state=advanceAbility(state,context(),1/120,modified);
  assert.equal(state.targets.find(t=>t.id==="b").status,"clear");assert.equal(state.targets.find(t=>t.id==="a").status,"ready");
});

test("pause freezes cooldown and actors; rejected/duplicate actions cannot spend charges",()=>{
  const initial=start("repeater"),shot=act(initial,1).state;
  const paused=advanceAbility(shot,context(player(),{paused:true}),20,config);assert.deepEqual(paused,shot);
  const rejected=act(paused,2,player(),"act",{paused:true});assert.equal(rejected.reason,"paused");assert.equal(rejected.state.ammo,7);assert.equal(rejected.state.projectiles.length,1);
  const duplicate=act(rejected.state,2);assert.equal(duplicate.reason,"duplicate-event");assert.equal(duplicate.state.ammo,7);
  const withoutNewPress=advance(shot,1);assert.equal(withoutNewPress.ammo,7);
});

test("fiber is modular, spends budget on travel, refills at pads and does not obstruct movement",()=>{
  let fiber=start("light-bomber","fiber");fiber=advanceAbility(fiber,context(player(8.5,6.5)),.1,config);near(fiber.budget,34);
  fiber=advanceAbility(fiber,context(player(46.5,6.5)),.1,config);assert.equal(fiber.budget,0);
  const blocked=act(fiber,1,player(46.5,6.5));assert.equal(blocked.reason,"link-empty");
  const point=player(6.5,6.5);const refilled=act(blocked.state,2,point,"pickup");assert.equal(refilled.state.budget,36);assert.equal(refilled.state.ammo,1);
  fiber=advanceAbility(refilled.state,context(point),.1,config);assert.equal(fiber.budget,36);assert.deepEqual(point,player());
});

test("fiber charges authoritative reversal distance even when one frame returns to the same point",()=>{
  const settings={...visuals.motion,turnPolicy:"grid-center"};
  const costs=[];
  for(const steps of [1,2,4]){
    let motion={...createMotionState(visuals.route,settings),x:6.4,y:6.5,direction:"right"};
    let state=createAbilityState(config,"scout","fiber",{...player(6.4,6.5),distance:0});
    for(let i=0;i<steps;i++){
      const dt=.2/settings.cruiseSpeed/steps;
      motion=advanceMotion(motion,{direction:"left",paused:false,autoplay:false},settings,visuals.board,visuals.route,dt);
      state=advanceAbility(state,context({...player(motion.x,motion.y,motion.direction),distance:motion.travelDistance}),dt,config);
    }
    near(motion.x,6.4);near(motion.travelDistance,.2);near(state.budget,35.8);costs.push(state.budget);
  }
  for(const cost of costs)near(cost,costs[0]);
});

test("only synthetic display haze differs between radio and fiber; source player stays untouched",()=>{
  const point=player(22,8),copy=structuredClone(point);
  const radio=abilityReadout(start("scout","radio",point),config,point),fiber=abilityReadout(start("scout","fiber",point),config,point);
  assert.equal(radio.signal,.4);assert.equal(fiber.signal,1);assert.equal(radio.inHaze,true);assert.deepEqual(point,copy);
  assert.equal(abilityReadout(start("scout"),config,player()).signal,1);
});

test("class/link change cancels transients, resets toy resources, preserves dedupe and avoids cosmetics",()=>{
  let state=act(start("net-catcher"),1,player(14,8.5)).state;assert.equal(state.fields.length,1);
  const switched=switchAbilityLoadout(state,config,"repeater","fiber",player(14,8.5));
  assert.equal(switched.fields.length,0);assert.equal(switched.effects.length,0);assert.equal(switched.projectiles.length,0);assert.equal(switched.ammo,8);assert.equal(switched.budget,36);assert.equal(switched.time,0);assert.equal(switched.lastEventId,1);
  assert.equal(act(switched,1).reason,"duplicate-event");assert.equal(Object.hasOwn(switched,"characterId"),false);
  const supplied={...player(),sprite:"heavy-lift",scale:2.2,heading:2};const snapshot=structuredClone(supplied);act(switched,2,supplied);assert.deepEqual(supplied,snapshot);
});
