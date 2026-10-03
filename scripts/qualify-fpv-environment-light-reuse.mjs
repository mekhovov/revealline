#!/usr/bin/env node
// Manual renderer ownership qualification. The real WebGL companion is run separately.
import { readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import vm from 'node:vm';
import { parse } from 'acorn';
import * as THREE from '../optional-practice/civilian-fpv/vendor/three.module.js';
import * as visuals from '../optional-practice/civilian-fpv/world-visuals.mjs';
import * as themes from '../optional-practice/civilian-fpv/world-themes.mjs';
import { FLIGHT_COURSES } from '../optional-practice/civilian-fpv/catalogue.mjs';

const root = new URL('../', import.meta.url),
  baseline = '0aeb0c2b4342715ba9a19b976114d7d905fed7bd',
  relative = 'optional-practice/civilian-fpv/renderer.mjs',
  bytes = await readFile(new URL(relative, root)),
  hash = (value) => createHash('sha256').update(value).digest('hex'),
  checks = [],
  check = (name, pass) => {
    checks.push({ name, pass: Boolean(pass) });
    if (!pass) throw Error(name);
  };
const args = process.argv.slice(2);
if (args.length && (args.length !== 2 || args[0] !== '--out'))
  throw Error('Usage: node scripts/qualify-fpv-environment-light-reuse.mjs [--out NEW.json]');
for (const file of [
  'world-visuals.mjs',
  'world-model.mjs',
  'world-collision.mjs',
  'world-catalogue.mjs',
  'world-assets.mjs',
  'world-themes.mjs',
]) {
  const name = 'optional-practice/civilian-fpv/' + file;
  check(
    file + ' unchanged',
    (await readFile(new URL(name, root))).equals(
      execFileSync('git', ['show', baseline + ':' + name], {
        cwd: root,
        maxBuffer: 8 * 1024 * 1024,
      }),
    ),
  );
}
let module = bytes.toString();
const ast = parse(module, { ecmaVersion: 'latest', sourceType: 'module' });
for (const item of ast.body.filter((item) => item.type === 'ImportDeclaration').reverse())
  module = module.slice(0, item.start) + module.slice(item.end);
module = module.replaceAll('export function ', 'function ');
const targets = [],
  owners = [],
  scenes = [];
let nextInputs = { sky: 0xc5d7e4, ground: 0x535c54, indoor: false },
  failGeneration = false;
class Renderer {
  constructor() {
    this.shadowMap = {};
    this.capabilities = { getMaxAnisotropy: () => 4 };
    this.info = { programs: [], memory: {}, render: {} };
    this.lost = false;
    owners.push(this);
  }
  dispose() {}
  forceContextLoss() {}
  setPixelRatio() {}
  setSize() {}
  getContext() {
    return { isContextLost: () => this.lost };
  }
}
class Scene extends THREE.Scene {
  constructor() {
    super();
    scenes.push(this);
  }
}
const create = vm.runInNewContext(`${module}; createFlightRenderer`, {
  ...themes,
  ...visuals,
  Blob,
  URL,
  ArrayBuffer,
  Uint8Array,
  DataView,
  TextDecoder,
  TextEncoder,
  structuredClone,
  THREE: { ...THREE, WebGLRenderer: Renderer, Scene },
  buildWorldVisuals: () => ({
    theme: {
      ...themes.resolveSimThemeProfile(FLIGHT_COURSES[0]).palette,
      sky: nextInputs.sky,
      wall: nextInputs.sky,
      ground: nextInputs.ground,
    },
    groundColor: new THREE.Color(nextInputs.ground),
    indoor: nextInputs.indoor,
    center: [0, 0],
    width: 20,
    depth: 20,
  }),
  createEnvironmentLight: (owner, inputs) => {
    check(
      'previous target released before each allocation',
      !targets.some((t) => t.owner === owner && !t.disposals),
    );
    if (failGeneration) throw Error('controlled PMREM failure');
    const target = {
      owner,
      inputs,
      texture: new THREE.Texture(),
      disposals: 0,
      dispose() {
        this.disposals++;
      },
    };
    targets.push(target);
    return target;
  },
  buildDroneVisual: ({ material }) => ({ tint: material(0xffffff), rotors: [] }),
});
function fixture() {
  const listeners = new Map(),
    ownerIndex = owners.length,
    sceneIndex = scenes.length;
  let lossCalls = 0;
  const runtime = create({
    canvas: {
      addEventListener: (name, fn) => listeners.set(name, fn),
      removeEventListener: (name) => listeners.delete(name),
      ownerDocument: { createElement: () => ({ getContext: () => null }) },
    },
    window: { devicePixelRatio: 1 },
    onContextLost: () => {
      lossCalls++;
      check(
        'context loss clears environment before callback',
        scenes[sceneIndex].environment === null,
      );
    },
  });
  return {
    runtime,
    listeners,
    owner: owners[ownerIndex],
    scene: scenes[sceneIndex],
    losses: () => lossCalls,
  };
}
const first = fixture(),
  course = structuredClone(FLIGHT_COURSES[0]),
  originalCourse = JSON.stringify(course),
  set = () => first.runtime.setCourse(course);
set();
const initial = targets.at(-1);
set();
check(
  'same probe reuses exact target',
  targets.length === 1 && initial.disposals === 0 && first.scene.environment === initial.texture,
);
for (const quality of ['low', 'balanced', 'high', 'low', 'high']) {
  first.runtime.setQuality(quality);
  check(
    'quality keeps ownership and expected binding: ' + quality,
    targets.length === 1 &&
      first.scene.environment === (quality === 'low' ? null : initial.texture),
  );
}
nextInputs = {
  ...nextInputs,
  sky: new THREE.Color(nextInputs.sky),
  ground: new THREE.Color(nextInputs.ground),
};
set();
check('normalized Color and integer inputs reuse', targets.length === 1);
nextInputs = { ...nextInputs, ground: nextInputs.ground.clone() };
nextInputs.ground.r += 1e-10;
check(
  'precision case deliberately shares rounded hex',
  nextInputs.ground.getHex() === initial.inputs.ground.getHex(),
);
set();
check('sub-hex linear difference regenerates', targets.length === 2 && initial.disposals === 1);
nextInputs = { ...nextInputs, indoor: true };
set();
check('indoor change regenerates', targets.length === 3 && targets[1].disposals === 1);
nextInputs = { ...nextInputs, sky: nextInputs.sky.clone() };
nextInputs.sky.b += 1e-10;
set();
check('sky channel change regenerates', targets.length === 4);
const second = fixture();
second.runtime.setCourse(course);
check(
  'two renderers have distinct targets',
  targets.length === 5 &&
    targets[3].owner !== targets[4].owner &&
    targets[3].texture !== targets[4].texture,
);
second.runtime.dispose();
second.runtime.dispose();
check(
  'second renderer releases only its own target once',
  targets[4].disposals === 1 && targets[3].disposals === 0,
);
first.owner.lost = true;
let prevented = false;
first.listeners.get('webglcontextlost')({
  preventDefault: () => {
    prevented = true;
  },
});
check(
  'context loss releases and invalidates exactly once',
  prevented && first.losses() === 1 && targets[3].disposals === 1,
);
set();
check(
  'lost context cannot cache a newly invalid target',
  targets.length === 5 && first.scene.environment === null,
);
first.owner.lost = false;
set();
check('restored same inputs regenerate', targets.length === 6);
nextInputs = { ...nextInputs, indoor: false };
failGeneration = true;
let threw = false;
try {
  set();
} catch (error) {
  threw = error.message === 'controlled PMREM failure';
}
check(
  'generation failure keeps no stale binding',
  threw && targets[5].disposals === 1 && first.scene.environment === null,
);
failGeneration = false;
set();
check(
  'same inputs recover after generation failure',
  targets.length === 7 && first.scene.environment === targets[6].texture,
);
first.runtime.dispose();
first.runtime.dispose();
check(
  'every allocated target disposed exactly once',
  targets.every((t) => t.disposals === 1),
);
check('course is not mutated', JSON.stringify(course) === originalCourse);
check(
  'registered renderer resources zero after disposal',
  ['materials', 'geometries', 'textures'].every(
    (key) => !first.runtime.resources().registered[key],
  ),
);
const receipt = {
  format: 'fpv-environment-light-reuse-manual.v1',
  baseline,
  rendererSha256: hash(bytes),
  method:
    'Real renderer closure, actual Three Colors/Scene; WebGLRenderer, scene construction and PMREM allocation controlled. Does not substitute for actual WebGL/browser comparison.',
  checks,
  allocated: targets.length,
  disposals: targets.map((t) => t.disposals),
  passed: checks.every((c) => c.pass),
};
if (args.length) await writeFile(args[1], JSON.stringify(receipt, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify(receipt, null, 2));
