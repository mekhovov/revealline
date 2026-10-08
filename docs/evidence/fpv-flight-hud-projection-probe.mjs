// Bounded manual qualification; not added unit-test coverage or browser evidence.
// Run: node docs/evidence/fpv-flight-hud-projection-probe.mjs
// Reads sources and recorded controls, writes a JSON receipt to stdout only.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import * as THREE from '../../optional-practice/civilian-fpv/vendor/three.module.js';
import { createFlight, replayFlight } from '../../optional-practice/civilian-fpv/model.mjs';
import { FLIGHT_COURSES } from '../../optional-practice/civilian-fpv/catalogue.mjs';
import { FLIGHT_DEMONSTRATIONS } from '../../optional-practice/civilian-fpv/demonstrations.mjs';

const root = new URL('../../', import.meta.url);
const baselineRevision = 'cfa30a228eb25d2bc7e4dd6d76e417c0d76a6873';
const modelPath = 'optional-practice/civilian-fpv/model.mjs';
const rendererPath = 'optional-practice/civilian-fpv/renderer.mjs';
const git = (...args) =>
  execFileSync('git', args, {
    cwd: fileURLToPath(root),
    encoding: 'utf8',
    maxBuffer: 4 * 1024 * 1024,
    env: { ...process.env, GIT_NO_LAZY_FETCH: '1' },
  });
const hash = (text) => createHash('sha256').update(text).digest('hex');
const sources = {};
for (const path of [
  modelPath,
  rendererPath,
  'optional-practice/civilian-fpv/catalogue.mjs',
  'optional-practice/civilian-fpv/demonstrations.mjs',
  'docs/evidence/fpv-flight-hud-projection-probe.mjs',
])
  sources[path] = hash(await readFile(new URL(path, root)));
const checks = [];
const check = (name, condition) => {
  assert.ok(condition, name);
  checks.push({ name, passed: true });
};

// Extract the actual renderer method rather than a parallel implementation.
// Real bundled Three.js cameras, matrices, meshes and rays execute below.
// Only WebGL/context creation and the full art scene are outside this probe.
const source = await readFile(new URL(rendererPath, root), 'utf8');
const method = source.slice(
  source.indexOf('    objectiveScreen(state) {'),
  source.indexOf('    aimScreen() {'),
);
check('production objectiveScreen method found', method.startsWith('    objectiveScreen(state) {'));
function fixture(
  step,
  { wall = false, opacity = 1, visible = true, platform = false, sprite = false } = {},
) {
  const camera = new THREE.PerspectiveCamera(82, 1, 0.035, 300);
  camera.position.set(0, 1, 0);
  camera.lookAt(0, 1, -10);
  camera.updateMatrixWorld();
  const world = new THREE.Group(),
    imported = new THREE.Group(),
    actors = new THREE.Group();
  const owned = [];
  let spriteRays = 0;
  if (sprite) {
    const paint = new THREE.SpriteMaterial(),
      label = new THREE.Sprite(paint);
    label.position.set(0, 1, -5);
    const intersect = label.raycast.bind(label);
    label.raycast = (...args) => {
      spriteRays++;
      return intersect(...args);
    };
    world.add(label);
    owned.push(paint);
  }
  if (wall || platform) {
    const geometry = new THREE.BoxGeometry(...(platform ? [4, 4, 4] : [4, 5, 0.2]));
    const material = new THREE.MeshBasicMaterial({ transparent: opacity < 1, opacity });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(0, platform ? 2 : 1, platform ? -10 : -5);
    mesh.visible = visible;
    if (platform) mesh.userData.collisionId = 'raised-pad';
    world.add(mesh);
    owned.push(geometry, material);
  }
  world.updateMatrixWorld(true);
  const objectiveRaycaster = new THREE.Raycaster();
  let rays = 0;
  const query = objectiveRaycaster.intersectObjects.bind(objectiveRaycaster);
  objectiveRaycaster.intersectObjects = (...args) => {
    rays++;
    return query(...args);
  };
  const options = {
    disposed: false,
    course: { bounds: { min: { y: 0 } }, steps: { 'self-level': [step] } },
    mode: 'self-level',
    camera,
    world,
    imported,
    actors,
    objectiveRaycaster,
    sceneGeneration: 1,
    view: 'fpv',
    actorDefinitions: new Map(),
  };
  const fn = new Function(
    'THREE',
    'options',
    `
    let {disposed,course,mode,camera,world,imported,actors,objectiveRaycaster,
      sceneGeneration,view,actorDefinitions}=options;
    let objectiveVisibility=null;
    const objectivePadPoints=new Map();
    return ({${method}}).objectiveScreen;
  `,
  )(THREE, options);
  return {
    fn,
    camera,
    rays: () => rays,
    spriteRays: () => spriteRays,
    dispose: () => owned.forEach((item) => item.dispose()),
  };
}
const fixtures = [];
const make = (...args) => {
  const f = fixture(...args);
  fixtures.push(f);
  return f;
};
const state = {
  status: 'active',
  ticks: 0,
  step: 0,
  position: { x: 0, y: 1000, z: 0 },
  actors: [],
};
const gate = {
  type: 'gate',
  axis: 'z',
  at: -10000,
  direction: -1,
  minSide: -2000,
  maxSide: 2000,
  minY: 0,
  maxY: 2000,
};
try {
  const f = make(gate);
  let cue = f.fn(state);
  check(
    'gate marks the actual opening center',
    cue.x === 0.5 && cue.y === 0.5 && cue.interaction === 'cross',
  );
  check(
    'front gate is visible with real distance',
    !cue.behind && !cue.offscreen && !cue.occluded && cue.distance === 10,
  );
  for (let ticks = 1; ticks < 5; ticks++) f.fn({ ...state, ticks });
  check('visibility query cached over five accepted ticks', f.rays() === 1);
  for (let frame = 0; frame < 30; frame++) f.fn({ ...state, ticks: 4 });
  check('repeated render frames do not repeat an unchanged query', f.rays() === 1);
  f.fn({ ...state, ticks: 5 });
  check('visibility cache refreshed on next tick bucket', f.rays() === 2);
  cue = make({ ...gate, at: 10000 }).fn(state);
  check(
    'behind goal has finite edge direction',
    cue.behind && cue.directionOnly && cue.offscreen && Number.isFinite(cue.angle),
  );
  for (const axis of ['x', 'z'])
    for (const direction of [-1, 1]) {
      const directional = make({ ...gate, axis, at: 10000, direction });
      const position = { x: 0, y: 1000, z: 0, [axis]: 10000 + direction * 2000 };
      cue = directional.fn({ ...state, position });
      check(
        `${axis}/${direction} wrong-side gate points 1.5m onto entry side`,
        cue.approach && Math.abs(cue.distance - 3.5) < 1e-8,
      );
      cue = directional.fn({ ...state, position: { ...position, [axis]: 10000 } });
      check(
        `${axis}/${direction} gate plane still requires approach`,
        cue.approach && Math.abs(cue.distance - 1.5) < 1e-8,
      );
      const previousRays = directional.rays();
      cue = directional.fn({
        ...state,
        position: { ...position, [axis]: 10000 - direction * 2000 },
      });
      check(
        `${axis}/${direction} correct-side gate points to opening`,
        !cue.approach && Math.abs(cue.distance - 2) < 1e-8,
      );
      check(
        `${axis}/${direction} side change refreshes obstruction in same tick bucket`,
        directional.rays() === previousRays + 1,
      );
    }
  cue = make({
    type: 'crossing-v1',
    axis: 'y',
    at: 5000,
    direction: 1,
    minA: -1000,
    maxA: 1000,
    minB: -1000,
    maxB: 1000,
  }).fn({
    ...state,
    position: { x: 0, y: 7000, z: 0 },
  });
  check(
    'advanced vertical crossing also guides back to entry side',
    cue.approach && Math.abs(cue.distance - 3.5) < 1e-8,
  );
  cue = make(gate, { wall: true }).fn(state);
  check(
    'opaque wall gives direction only, never a bracket',
    cue.visible && cue.occluded && cue.directionOnly && cue.offscreen,
  );
  check('blocked central goal projects to edge', Math.abs(cue.y - 0.18) < 1e-8);
  check(
    'translucent geometry does not claim opaque occlusion',
    !make(gate, { wall: true, opacity: 0.2 }).fn(state).occluded,
  );
  check(
    'invisible geometry does not claim rendered occlusion',
    !make(gate, { wall: true, visible: false }).fn(state).occluded,
  );
  const labels = make(gate, { sprite: true });
  cue = labels.fn(state);
  check(
    'sprite labels are excluded before ray intersection',
    !cue.occluded && labels.spriteRays() === 0,
  );
  const hold = {
    type: 'hold',
    min: { x: -2000, y: 500, z: -12000 },
    max: { x: 2000, y: 2000, z: -8000 },
  };
  cue = make(hold).fn(state);
  check('outside zone uses nearest boundary', !cue.inside && cue.distance === 8);
  const inZone = { ...state, position: { x: 0, y: 1000, z: -9000 } };
  cue = make(hold).fn(inZone);
  check(
    'inside hold has no false behind or direction arrow',
    cue.inside && !cue.visible && !cue.behind && !cue.offscreen,
  );
  cue = make(hold).fn({ ...inZone, position: { ...inZone.position, y: 200 } });
  check(
    'below a zone retains explicit climb guidance',
    cue.visible && cue.heightOnly && cue.vertical > 0 && cue.arrow === '↑' && cue.x === 0.5,
  );
  cue = make(hold).fn({ ...inZone, position: { ...inZone.position, y: 2500 } });
  check(
    'above a zone retains explicit descent guidance',
    cue.visible && cue.heightOnly && cue.vertical < 0 && cue.arrow === '↓' && cue.x === 0.5,
  );
  const land = { ...hold, type: 'land', min: { ...hold.min, y: 0 }, surface: '$floor' };
  cue = make(land).fn(inZone);
  check(
    'landing points to the pad center, not the airborne drone',
    cue.inside &&
      cue.visible &&
      cue.vertical === -1 &&
      Math.abs(cue.distance - Math.sqrt(2)) < 1e-8,
  );
  cue = make(land).fn({
    ...inZone,
    position: { ...inZone.position, y: 0 },
    grounded: true,
    support: { id: '$floor' },
  });
  check('on-pad marker suppressed while landing gauges continue', cue.inside && !cue.visible);
  const raised = {
    ...hold,
    type: 'land',
    min: { ...hold.min, y: 3500 },
    max: { ...hold.max, y: 5000 },
    surface: 'raised-pad',
  };
  cue = make(raised, { platform: true }).fn({ ...inZone, position: { x: 0, y: 4500, z: -9000 } });
  check(
    'raised landing uses actual support top at four meters',
    cue.visible && cue.vertical === -0.5 && Math.abs(cue.distance - Math.sqrt(1.25)) < 1e-8,
  );
  check('missing named landing surface has no invented marker', make(raised).fn(state) === null);
  for (const type of ['rotation-v1', 'attitude-v1', 'path-v1']) {
    cue = make({ ...hold, type }).fn(state);
    check(
      `${type} uses authored skill zone`,
      cue.visible && cue.type === type && cue.interaction === 'manoeuvre',
    );
  }
  cue = make({
    type: 'crossing-v1',
    axis: 'z',
    at: -10000,
    minA: -2000,
    maxA: 2000,
    minB: 0,
    maxB: 2000,
  }).fn(state);
  check(
    'advanced crossing uses actual opening',
    cue.interaction === 'cross' && cue.x === 0.5 && cue.y === 0.5,
  );
  const actor = {
    id: 'runner',
    type: 'patrol',
    status: 'active',
    height: 1800,
    radius: 400,
    position: { x: 0, y: 0, z: -10000 },
  };
  cue = make({ type: 'actor-track-v1', actorId: 'runner', minTargetTravel: 5000 }).fn({
    ...state,
    actors: [actor],
  });
  check(
    'follow tracks the actual actor center',
    cue.targetId === 'runner' && cue.interaction === 'follow' && !cue.occluded,
  );
  check(
    'unavailable subject has no guessed position',
    make({ type: 'actor-track-v1', actorId: 'missing' }).fn({ ...state, actors: [actor] }) === null,
  );
  cue = make({ type: 'hunt-contact-v1', targets: ['other', 'runner'], ordered: true }).fn({
    ...state,
    hunt: { caught: ['other'] },
    actors: [actor, { ...actor, id: 'other', position: { x: 0, y: 0, z: -2000 } }],
  });
  check(
    'ordered Hunt points to the next eligible actor',
    cue.targetId === 'runner' && cue.interaction === 'touch',
  );
  cue = make({ type: 'eliminate', targets: ['other', 'runner'] }).fn({
    ...state,
    actors: [actor, { ...actor, id: 'other', status: 'defeated' }],
  });
  check('combat skips defeated actors', cue.targetId === 'runner' && cue.interaction === 'pulse');
  cue = make({ type: 'actor-track-v1', actorId: 'runner' }, { wall: true }).fn({
    ...state,
    actors: [actor],
  });
  check(
    'occluded known actor has navigation direction but no silhouette',
    cue.visible && cue.occluded && cue.directionOnly && cue.offscreen,
  );
  check(
    'survival without an authored location has no invented marker',
    make({ type: 'survive', ticks: 50 }).fn(state) === null,
  );
  check(
    'expired attempts have no active objective marker',
    make(gate).fn({ ...state, status: 'expired' }) === null,
  );
} finally {
  fixtures.forEach((f) => f.dispose());
}

const original = git('show', `${baselineRevision}:${modelPath}`).replace(
  /from '([^']+)'/g,
  (_, path) => `from '${new URL(path, new URL(modelPath, root)).href}'`,
);
const baseline = await import(
  `data:text/javascript;base64,${Buffer.from(original).toString('base64')}`
);
let ticks = 0,
  acceptedObjectives = 0,
  landingFacts = 0,
  preCollisionDifferences = 0;
for (const proof of FLIGHT_DEMONSTRATIONS) {
  const course = FLIGHT_COURSES.find((entry) => entry.id === proof.course);
  assert.deepEqual(replayFlight(course, proof), baseline.replayFlight(course, proof));
  check(`${proof.course}/${proof.mode} legacy replay unchanged`, true);
  const flight = createFlight({ course, mode: proof.mode, response: proof.response });
  assert.equal(flight.objectiveFeedback(), null);
  flight.arm();
  for (const frame of proof.frames) {
    const snapshot = flight.step(
      Object.fromEntries(['roll', 'pitch', 'yaw', 'throttle'].map((key, i) => [key, frame[i]])),
      { quantized: true },
    );
    const facts = flight.objectiveFeedback();
    assert.equal(facts.tick, snapshot.ticks);
    assert.equal(facts.eligible, Object.values(facts.conditions).every(Boolean));
    assert.deepEqual(facts.position, snapshot.position);
    if (facts.type === 'land') landingFacts++;
    if (facts.speed !== Math.floor(Math.hypot(...Object.values(snapshot.velocity))))
      preCollisionDifferences++;
    if (facts.accepted) acceptedObjectives++;
    ticks++;
    facts.position.x = 999999;
    facts.conditions.position = 'mutated observer copy';
    assert.deepEqual(flight.snapshot(), snapshot);
    assert.notEqual(flight.objectiveFeedback().position.x, 999999);
  }
  flight.reset();
  assert.equal(flight.objectiveFeedback(), null);
}
check(
  'all original demonstration facts and replay outcomes qualified',
  FLIGHT_DEMONSTRATIONS.length === 24 && ticks === 14847 && acceptedObjectives === 110,
);
check(
  'actual pre-collision and landing facts exercised',
  preCollisionDifferences > 0 && landingFacts > 0,
);
console.log(
  JSON.stringify(
    {
      format: 'FPVFlightHudProjectionObservation.v1',
      head: git('rev-parse', 'HEAD').trim(),
      baselineRevision,
      sources,
      checks,
      legacy: {
        proofs: FLIGHT_DEMONSTRATIONS.length,
        ticks,
        acceptedObjectives,
        landingFacts,
        preCollisionDifferences,
      },
      limitations: [
        'Projection calls the extracted production method with real bundled Three.js math and bounded geometric fixtures; it does not create WebGL or launch a host.',
        'Legacy verification replays existing recorded commands and compares complete results with the pinned baseline model; feedback never changes snapshots.',
        'This does not qualify renderer frame times, hardware, all imported geometry, player acceptance or public deployment.',
        'Additional unit coverage remains deferred; this is a standalone manual evidence probe.',
      ],
    },
    null,
    2,
  ),
);
