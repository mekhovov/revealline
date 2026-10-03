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
  scenes = [],
  drones = [],
  hunts = [];
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
  compileAsync() {
    return this.preparing ?? Promise.resolve();
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
  buildWorldVisuals: ({ mesh, material, world }) => {
    const map = new THREE.DataTexture(new Uint8Array([255, 128, 0, 255]), 1, 1);
    mesh(new THREE.BoxGeometry(2, 1, 2), material(0xffffff, { map }), world);
    return {
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
    };
  },
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
  buildDroneVisual: ({ material, mesh, parent }) => {
    const tint = material(0xffffff),
      body = mesh(new THREE.BoxGeometry(1, 1, 1), tint, parent);
    const drone = { tint, rotors: [], body };
    drones.push(drone);
    return drone;
  },
});
class Controls extends THREE.EventDispatcher {
  constructor() {
    super();
    this.helper = new THREE.Group();
  }
  getHelper() {
    return this.helper;
  }
  setMode() {}
  setSpace() {}
  setTranslationSnap() {}
  setSize() {}
  attach() {}
  detach() {}
  dispose() {
    this.helper.clear();
  }
}
function fixture() {
  const listeners = new Map(),
    ownerIndex = owners.length,
    sceneIndex = scenes.length;
  let lossCalls = 0,
    controlsLoading = null,
    finishImport,
    announceImport;
  const importStarted = new Promise((resolve) => {
    announceImport = resolve;
  });
  class Loader {
    register() {
      return this;
    }
    parseAsync() {
      return new Promise((resolve) => {
        finishImport = resolve;
        announceImport();
      });
    }
  }
  const runtime = create({
    canvas: {
      addEventListener: (name, fn) => listeners.set(name, fn),
      removeEventListener: (name) => listeners.delete(name),
      ownerDocument: { createElement: () => ({ getContext: () => null }) },
    },
    window: { devicePixelRatio: 1 },
    loadTransformControls: async () => controlsLoading ?? { TransformControls: Controls },
    loadGLTF: async () => ({ GLTFLoader: Loader }),
    createHuntPresentation: ({ scene }) => {
      const group = new THREE.Group();
      scene.add(group);
      const row = {
        group,
        disposals: 0,
        reset() {},
        resources() {
          return { disposed: this.disposals > 0 };
        },
        dispose() {
          this.disposals++;
          group.removeFromParent();
        },
      };
      hunts.push(row);
      return row;
    },
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
    importStarted,
    finishImport: (value) => finishImport(value),
    waitForImport: () =>
      new Promise((resolve) => {
        announceImport = resolve;
      }),
    delayControls() {
      let resolve;
      controlsLoading = new Promise((done) => {
        resolve = done;
      });
      return () => {
        resolve({ TransformControls: Controls });
        controlsLoading = null;
      };
    },
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
first.runtime.setCosmetic({ color: '#ff66aa' });
first.runtime.setPresentation({ collectionId: 'industrial-workshop' });
set();
const editorControls = await first.runtime.createEditor();
const watched = new Map();
first.scene.traverse((item) => {
  for (const value of [
    item.geometry,
    ...[item.material].flat(),
    item.customDepthMaterial,
    item.customDistanceMaterial,
  ].filter(Boolean)) {
    for (const resource of [value, ...Object.values(value).filter((v) => v?.isTexture)]) {
      if (watched.has(resource)) continue;
      watched.set(resource, 0);
      resource.addEventListener('dispose', () => watched.set(resource, watched.get(resource) + 1));
    }
  }
});
let releasePreparation;
first.owner.preparing = new Promise((resolve) => {
  releasePreparation = resolve;
});
const pendingPreparation = first.runtime.prepare();
const resumeControls = first.delayControls(),
  pendingEditor = first.runtime.createEditor().then(
    () => false,
    (error) => /World preview changed/.test(error.message),
  ),
  pendingImport = first.runtime
    .loadScene('{"asset":{"version":"2.0","extras":{"fpvScenery":true}}}')
    .then(
      () => false,
      (error) => /World preview changed/.test(error.message),
    );
await first.importStarted;
const huntBeforeLoss = hunts[0];
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
releasePreparation();
check('pending preparation invalidated by loss', (await pendingPreparation) === false);
resumeControls();
check('pending editor creation cannot reattach after loss', await pendingEditor);
const obsoleteScene = new THREE.Group(),
  obsoleteShape = new THREE.BoxGeometry(),
  obsoletePaint = new THREE.MeshBasicMaterial();
let obsoleteShapeDisposals = 0,
  obsoletePaintDisposals = 0;
obsoleteShape.addEventListener('dispose', () => obsoleteShapeDisposals++);
obsoletePaint.addEventListener('dispose', () => obsoletePaintDisposals++);
obsoleteScene.add(new THREE.Mesh(obsoleteShape, obsoletePaint));
first.finishImport({ scene: obsoleteScene, scenes: [obsoleteScene], animations: [] });
check(
  'pending imported scene rejected and released after loss',
  (await pendingImport) && obsoleteShapeDisposals === 1 && obsoletePaintDisposals === 1,
);
check(
  'new imported scene rejected while lost',
  await first.runtime.loadScene('{}').then(
    () => false,
    (error) => /graphics are lost/.test(error.message),
  ),
);
check(
  'new editor rejected while lost',
  await first.runtime.createEditor().then(
    () => false,
    (error) => /graphics are lost/.test(error.message),
  ),
);
check(
  'all watched scene resources released once during loss',
  watched.size > 0 && [...watched.values()].every((n) => n === 1),
);
check(
  'registered resources empty while lost',
  Object.values(first.runtime.resources().registered).every((n) => n === 0),
);
check('optional hunt owner released during loss', huntBeforeLoss.disposals === 1);
check('prepare cannot reuse cleared scene', (await first.runtime.prepare()) === false);
first.runtime.setCosmetic({ color: '#66aaff' });
first.runtime.setCosmetic({ color: 'invalid' });
check('cleared editor ignores pointer selection', editorControls.pick(1, 1) === false);
editorControls.setSnap(0.5);
editorControls.zoom(12);
check(
  'cosmetic and editor interactions while lost keep scene ownership empty',
  Object.values(first.runtime.resources().registered).every((n) => n === 0),
);
first.runtime.draw({});
set();
check(
  'lost context cannot cache a newly invalid target',
  targets.length === 5 && first.scene.environment === null,
);
first.owner.lost = false;
const restoredEmptyControls = await first.runtime.createEditor();
restoredEmptyControls.zoom(12);
check('blank editor creation remains supported after restoration', !!restoredEmptyControls);

set();
check('restored same inputs regenerate', targets.length === 6);
check(
  'same-quality aircraft recreated with latest valid cosmetic chosen while lost',
  drones.at(-1).body.parent !== null && drones.at(-1).tint.color.getHex() === 0x66aaff,
);
check(
  'pending presentation retained for Retry',
  first.runtime.resources().presentation.collectionId === 'industrial-workshop',
);
check(
  'new optional hunt owner created on Retry',
  hunts.length === 3 && hunts.at(-1).disposals === 0,
);
check('restored installed scene prepares', (await first.runtime.prepare()) === true);
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
check(
  'old loss resources not disposed again',
  [...watched.values()].every((n) => n === 1),
);
check(
  'each optional hunt owner disposed once',
  hunts.every((h) => h.disposals === 1),
);
check('course is not mutated', JSON.stringify(course) === originalCourse);
check(
  'registered renderer resources zero after disposal',
  ['materials', 'geometries', 'textures'].every(
    (key) => !first.runtime.resources().registered[key],
  ),
);
const blank = fixture(),
  blankControls = await blank.runtime.createEditor();
blankControls.zoom(12);
check('initial blank editor remains supported', !!blankControls);
const initialImportStarted = blank.waitForImport(),
  initialImport = blank.runtime.loadScene('{"asset":{"version":"2.0"}}');
await initialImportStarted;
const initialImportedScene = new THREE.Group();
blank.finishImport({ scene: initialImportedScene, scenes: [initialImportedScene], animations: [] });
await initialImport;
check('non-scenery import before course remains supported', initialImportedScene.parent !== null);
blank.owner.lost = true;
blank.listeners.get('webglcontextlost')({ preventDefault() {} });
blank.owner.lost = false;
const restoredImportStarted = blank.waitForImport(),
  restoredImport = blank.runtime.loadScene(
    '{"asset":{"version":"2.0","extras":{"fpvScenery":true}}}',
  );
await restoredImportStarted;
const restoredImportedScene = new THREE.Group();
blank.finishImport({
  scene: restoredImportedScene,
  scenes: [restoredImportedScene],
  animations: [],
});
await restoredImport;
check(
  'fresh scenery import after restore tolerates the cleared course',
  restoredImportedScene.parent !== null,
);
blank.runtime.dispose();
check(
  'blank/import-only owner releases final resources',
  Object.values(blank.runtime.resources().registered).every((n) => n === 0),
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
