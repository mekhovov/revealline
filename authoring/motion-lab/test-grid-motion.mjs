import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {advanceMotion,createMotionState,validatePresets} from "./motion.mjs";
import {isGridCenter,nextGridCenter,routeForPolicy} from "./grid-motion.mjs";

const presets=JSON.parse(readFileSync(new URL("./presets.json",import.meta.url)));
const config={...presets.motion,turnPolicy:"grid-center"};
const input=changes=>({direction:null,autoplay:false,boost:false,slow:false,paused:false,reducedMotion:false,...changes});
const advance=(state,changes,time,settings=config)=>advanceMotion(state,input(changes),settings,presets.board,presets.route,time);
const initial=()=>createMotionState(presets.route,config);
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);
const between=()=>({...initial(),x:6.9,y:6.5,direction:"right",speed:9,visualSpeed:9});

test("policy configuration defaults to compatible immediate movement and validates unknown values",()=>{
  assert.equal(presets.motion.turnPolicy,"immediate");
  const legacy={...presets.motion};delete legacy.turnPolicy;
  let a=createMotionState(presets.route),b=createMotionState(presets.route,presets.motion);
  for(const direction of ["right","left","down",null,"up"]){a=advance(a,{direction},.13,legacy);b=advance(b,{direction},.13,presets.motion);assert.deepEqual(a,b);}
  const invalid=structuredClone(presets);invalid.motion.turnPolicy="diagonal";assert.throws(()=>validatePresets(invalid),/turnPolicy/);
});

test("explicit grid reset starts at a true cell center without mutating authored route",()=>{
  const before=structuredClone(presets.route),state=initial();
  near(state.x,6.5);near(state.y,6.5);assert.ok(isGridCenter(state));assert.equal(state.queuedDirection,null);
  assert.deepEqual(presets.route,before);assert.deepEqual(routeForPolicy(routeForPolicy(before,"grid-center"),"grid-center"),routeForPolicy(before,"grid-center"));
  const right=advance(state,{direction:"right"},.02);near(right.x,6.68);near(right.y,6.5);
});

test("perpendicular turns consume at the next center with unchanged speed and leftover distance",()=>{
  const queued=advance(between(),{direction:"down"},.02);near(queued.x,7.08);near(queued.y,6.5);assert.equal(queued.queuedDirection,"down");assert.equal(queued.direction,"right");assert.equal(queued.speed,9);
  const turned=advance(between(),{direction:"down"},.1);near(turned.x,7.5);near(turned.y,6.8);assert.equal(turned.direction,"down");assert.equal(turned.queuedDirection,null);assert.equal(turned.speed,9);
});

test("opposite command waits for the center and reverses at the same speed",()=>{
  const queued=advance(between(),{direction:"left"},.02);near(queued.x,7.08);assert.equal(queued.direction,"right");assert.equal(queued.queuedDirection,"left");
  const reversed=advance(between(),{direction:"left"},.1);near(reversed.x,7.2);near(reversed.y,6.5);assert.equal(reversed.direction,"left");assert.equal(reversed.speed,9);
});

test("one buffer uses the latest held command, including cancellation by the current direction",()=>{
  let state=advance(between(),{direction:"down"},.02);
  state=advance(state,{direction:"left"},.02);assert.equal(state.queuedDirection,"left");
  state=advance(state,{direction:"up"},.02);assert.equal(state.queuedDirection,"up");
  state=advance(state,{direction:"up"},.02);near(state.x,7.5);near(state.y,6.38);assert.equal(state.direction,"up");assert.equal(state.queuedDirection,null);
  const cancelled=advance(advance(between(),{direction:"down"},.02),{direction:"right"},.02);assert.equal(cancelled.queuedDirection,null);assert.equal(cancelled.direction,"right");
});

test("release stops immediately, clears queued turn and does not retain a tap for restart",()=>{
  const queued=advance(between(),{direction:"down"},.02);
  const stopped=advance(queued,{},.2);near(stopped.x,queued.x);near(stopped.y,queued.y);assert.equal(stopped.speed,0);assert.equal(stopped.queuedDirection,null);
  const resumed=advance(stopped,{direction:"up"},.1);near(resumed.x,7.5);near(resumed.y,6.02);assert.equal(resumed.direction,"up");
  const noElapsed=advance(queued,{},0);assert.equal(noElapsed.queuedDirection,null);assert.equal(noElapsed.speed,0);
});

test("pause clears queued intent without moving or changing the frozen cosmetic pose",()=>{
  const queued=advance(between(),{direction:"down"},.02);
  const paused=advance(queued,{direction:"down",paused:true},20);
  near(paused.x,queued.x);near(paused.y,queued.y);assert.equal(paused.queuedDirection,null);assert.equal(paused.speed,0);assert.equal(paused.visualSpeed,queued.visualSpeed);
  const resumedWithoutKey=advance(paused,{},.2);near(resumedWithoutKey.x,paused.x);near(resumedWithoutKey.y,paused.y);
});

test("large and boosted frame intervals cannot skip a turn center or lose remaining distance",()=>{
  const boosted=advance(between(),{direction:"down",boost:true},.25);
  near(boosted.x,7.5);near(boosted.y,6.5+9*1.7*.25-.6);assert.equal(boosted.queuedDirection,null);
  const slow=advance(between(),{direction:"down",slow:true},.2);near(slow.x,7.5);near(slow.y,6.5+9*.38*.2-.6);
  const both=advance(between(),{direction:"down",boost:true,slow:true},.2);near(both.x,7.5);near(both.y,6.5+9*1.7*.38*.2-.6);
});

test("grid travel and turns are invariant at 10,20,30,60,120fps",()=>{
  let expected;
  for(const fps of [10,20,30,60,120]){
    let state=initial();
    // Commands deliberately arrive between centers, including a stop and a boosted restart.
    for(const [seconds,direction,boost] of [[.3,"right",false],[.7,"down",false],[.4,"left",false],[.2,null,false],[.8,"up",true]])
      for(let frame=0;frame<Math.round(fps*seconds);frame++)state=advance(state,{direction,boost},1/fps);
    if(!expected)expected=state;else{near(state.x,expected.x);near(state.y,expected.y);assert.equal(state.direction,expected.direction);assert.equal(state.queuedDirection,expected.queuedDirection);}
  }
});

test("grid autoplay uses center-aligned route with empty manual buffer at every frame rate",()=>{
  let expected;
  for(const fps of [10,20,60,120]){
    let state=initial();
    for(let frame=0;frame<fps*17;frame++)state=advance(state,{autoplay:true,direction:"left"},1/fps);
    assert.equal(state.queuedDirection,null);
    if(!expected)expected=state;else{near(state.x,expected.x);near(state.y,expected.y);}
  }
});

test("all four edges are reachable centers and support held turns and reversals",()=>{
  for(const edge of [{x:.5,y:6.5,out:"left",reverse:"right",turn:"up"},{x:47.5,y:6.5,out:"right",reverse:"left",turn:"down"},{x:6.5,y:.5,out:"up",reverse:"down",turn:"right"},{x:6.5,y:35.5,out:"down",reverse:"up",turn:"left"}]){
    const start={...initial(),x:edge.x,y:edge.y,direction:edge.out};
    const stopped=advance(start,{direction:edge.out},.2);near(stopped.x,start.x);near(stopped.y,start.y);assert.equal(stopped.speed,0);assert.equal(stopped.queuedDirection,null);assert.ok(isGridCenter(stopped));
    for(const direction of [edge.reverse,edge.turn]){const moved=advance(stopped,{direction},.02);assert.equal(moved.direction,direction);near(Math.abs(moved.x-start.x)+Math.abs(moved.y-start.y),.18);}
    assert.deepEqual(nextGridCenter(stopped,presets.board),{x:edge.x,y:edge.y});
  }
});

test("body scale, turn response and reduced motion cannot alter buffered travel",()=>{
  const results=[];
  for(const option of [{turnRateDegrees:90,reducedMotion:false},{turnRateDegrees:720,reducedMotion:false},{turnRateDegrees:90,reducedMotion:true}]){
    let state=between();for(let frame=0;frame<60;frame++)state=advance(state,{direction:"down",reducedMotion:option.reducedMotion},1/60,{...config,turnRateDegrees:option.turnRateDegrees});results.push(state);
  }
  for(const state of results.slice(1)){near(state.x,results[0].x);near(state.y,results[0].y);assert.equal(state.speed,results[0].speed);assert.equal(state.queuedDirection,results[0].queuedDirection);}
});
