import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {bladeAngles, aliasSafePhase, advanceAnimation, createAnimationState, componentPose, rotorAnchors, validateAnimationRecipes} from "./animation.mjs";
import {fittedBodySize} from "./render-character.mjs";
import {advanceMotion, createMotionState} from "./motion.mjs";

const presets = JSON.parse(readFileSync(new URL("./presets.json",import.meta.url)));
const collection = JSON.parse(readFileSync(new URL("./collection-presets.json",import.meta.url)));
const clone = value => JSON.parse(JSON.stringify(value));
const close = (a,b) => assert.ok(Math.abs(a-b)<1e-8, `${a} != ${b}`);
const freeze = value => {if (value && typeof value === "object") {Object.freeze(value); for (const item of Object.values(value)) freeze(item);} return value;};

test("every supplied cosmetic has a validated recipe; FPV defaults use three blades", () => {
  validateAnimationRecipes(presets);
  for (const id of ["fpv-body","fpv-racer","fpv-night"]) {
    assert.equal(presets.animationRecipes[presets.characters[id].animationRecipe].components[0].bladeCount,3);
    assert.equal(rotorAnchors(presets.characters[id]).length,4);
  }
  assert.equal(Object.keys(presets.characters).length,21);
  for (const character of collection.characters) assert.equal(presets.characters[character.id].label,character.label,"Inspect and equipped labels must agree");
});

test("malformed count, radius, rate, recipe ref and source anchor fail before rendering", () => {
  for (const [key,value] of [["bladeCount",5],["radius",Infinity],["bladeShape","unbounded"],["travelRps",-1],["direction",0]]) {
    const broken=clone(presets);broken.animationRecipes["fpv-tri"].components[0][key]=value;
    assert.throws(()=>validateAnimationRecipes(broken),/Animation preset error/);
  }
  const anchor=clone(presets);anchor.characters["fpv-body"].rotors[0].x=2; assert.throws(()=>validateAnimationRecipes(anchor),/rig/);
  const missing=clone(presets);missing.characters["fpv-body"].animationRecipe="absent"; assert.throws(()=>validateAnimationRecipes(missing),/unknown recipe/);
});

test("two, three and four blades have complete evenly spaced geometry at any phase", () => {
  for (const count of [2,3,4]) {
    const angles=bladeAngles(count,.35);assert.equal(angles.length,count);
    for (let i=0;i<count;i++) close((angles[(i+1)%count]+(i===count-1?Math.PI*2:0))-angles[i],Math.PI*2/count);
  }
  assert.throws(()=>bladeAngles(1));
});

test("display sampling never jumps a quarter repeated blade pattern even on a slow frame", () => {
  for (const count of [2,3,4]) for (const fps of [4,10,20,30,60,120]) {
    const sample=aliasSafePhase(0,45,1/fps,count);
    assert.ok(sample.phaseStep>0 && sample.phaseStep<Math.PI*2/count*.25);
    assert.ok(sample.visualRps<=2.6+1e-8); assert.equal(sample.requestedRps,45); assert.equal(sample.limited,true);
  }
});

test("spin responds to movement; slow inspection caps detail while preserving requested speed metadata", () => {
  const initial=freeze(createAnimationState()), recipe=freeze(clone(presets.animationRecipes["fpv-tri"]));
  const travel=freeze({visualSpeed:9,cruiseSpeed:9});
  const cruise=advanceAnimation(initial,recipe,travel,1/60);
  const boost=advanceAnimation(initial,recipe,{visualSpeed:15.3,cruiseSpeed:9},1/60);
  const slow=advanceAnimation(initial,recipe,travel,1/60,{inspectionSlow:true});
  assert.ok(boost.rates.propellers.rawRps>cruise.rates.propellers.rawRps);
  assert.ok(slow.rates.propellers.visualRps<=.65+1e-8);
  assert.equal(slow.rates.propellers.rawRps,cruise.rates.propellers.rawRps);
  assert.equal(initial.time,0);assert.deepEqual(initial.phases,{});assert.equal(travel.visualSpeed,9);
});

test("pause and reduced motion freeze every animation layer, and reduced poses are time invariant", () => {
  const recipe=presets.animationRecipes["fpv-tri"], travel={visualSpeed:9,cruiseSpeed:9};
  const running=advanceAnimation(createAnimationState(),recipe,travel,.1);
  for (const options of [{paused:true},{reducedMotion:true}]) assert.deepEqual(advanceAnimation(running,recipe,travel,.1,options),running);
  for (const recipe of Object.values(presets.animationRecipes)) for (const component of recipe.components.filter(c=>c.type!=="rotors")) {
    assert.deepEqual(componentPose(component,{time:2},1,true),componentPose(component,{time:200},1,true));
  }
});

test("wing phase stays continuous when speed changes after a long-running preview", () => {
  const recipe=presets.animationRecipes["swallow-flight"], component=recipe.components[0];
  let animation=createAnimationState();
  for (let frame=0;frame<6000;frame++) animation=advanceAnimation(animation,recipe,{visualSpeed:9,cruiseSpeed:9},1/60);
  const before=componentPose(component,animation,1);
  const changed=advanceAnimation(animation,recipe,{visualSpeed:15.3,cruiseSpeed:9},0);
  assert.deepEqual(componentPose(component,changed,1.7),before);
  const next=advanceAnimation(animation,recipe,{visualSpeed:15.3,cruiseSpeed:9},1/600);
  assert.ok(Math.abs(componentPose(component,next,1.7).flap-before.flap)<.04);
});

test("all character recipes leave authoritative movement identical across a turn and boost", () => {
  let baseline;
  for (const character of Object.values(presets.characters)) {
    let motion=createMotionState(presets.route), animation=createAnimationState();
    for (let frame=0;frame<180;frame++) {
      motion=advanceMotion(motion,{direction:frame<80?"right":"down",boost:frame>120,autoplay:false,paused:false,reducedMotion:false},presets.motion,presets.board,presets.route,1/60);
      const before=clone(motion);
      animation=advanceAnimation(animation,presets.animationRecipes[character.animationRecipe],{visualSpeed:motion.visualSpeed,cruiseSpeed:presets.motion.cruiseSpeed},1/60);
      assert.deepEqual(motion,before);
    }
    if (!baseline) baseline=motion; else assert.deepEqual(motion,baseline);
  }
});

test("non-square source containment preserves body aspect and source-normalized anchor placement", () => {
  const body={widthCells:1.25,heightCells:1.25};
  const size=fittedBodySize(body,{naturalWidth:1145,naturalHeight:1374});
  close(size.height,1.25);close(size.width/size.height,1145/1374);
  const racer=fittedBodySize(body,{naturalWidth:1312,naturalHeight:1199});
  close(racer.width,1.25);close(racer.height/racer.width,1199/1312);
  const anchor=rotorAnchors(presets.characters["fpv-racer"])[0];
  close(anchor.x*racer.width+racer.width/2,.239*racer.width);
  close(anchor.y*racer.height+racer.height/2,.253*racer.height);
});
