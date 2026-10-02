#!/usr/bin/env node
/** Reproducible fixed-step/replay/data qualification; no additional unit suite. */
import assert from 'node:assert/strict';
import { writeFile, readFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
const root = fileURLToPath(new URL('../', import.meta.url));
const args = process.argv.slice(2);
if (args.length && (args.length !== 2 || args[0] !== '--output'))
  throw new Error('Usage: node scripts/qualify-fpv-actor-tracking.mjs [--output path.json]');
const output = path.resolve(root, args[1] ?? 'dist/fpv-actor-track-functional.json');
const load = (p) => import(`file://${root}/${p}`);
const {
  createWorldFlight,
  createWorldRecorder,
  replayWorldFlight,
  recoverWorldFlight,
  initWorldRuntime,
  validateWorldCourse,
  exportWorldCourse,
  worldCourseRequiresAcro,
  worldStateIdentity,
} = await load('optional-practice/civilian-fpv/world-model.mjs');
const { schoolAuthoringPilot } = await load('scripts/qualify-fpv-acro-school.mjs');
const { WORLD_CATALOGUE, BEGINNER_CATALOGUE } = await load(
  'optional-practice/civilian-fpv/world-catalogue.mjs',
);
const { WORLD_DEMONSTRATIONS } = await load(
  'optional-practice/civilian-fpv/world-demonstrations.mjs',
);
const { splitCourseDefinition, compileChallengeDefinition } = await load(
  'optional-practice/civilian-fpv/content-definitions.mjs',
);
const { preparePack, inspectPack, installPack, WORLD_PROJECT_FORMAT } = await load(
  'optional-practice/civilian-fpv/world-content.mjs',
);
const { openWorldStore } = await load('optional-practice/civilian-fpv/world-store.mjs');
const { exportEditableZip, importEditableZip } = await load(
  'optional-practice/civilian-fpv/world-zip.mjs',
);
const { replayFlight } = await load('optional-practice/civilian-fpv/model.mjs');
const { FLIGHT_DEMONSTRATIONS } = await load('optional-practice/civilian-fpv/demonstrations.mjs');
const requireAuthoring = createRequire(root + '/authoring/fpv-worlds/package.json');
const { IDBFactory } = requireAuthoring('fake-indexeddb');
await initWorldRuntime();
const results = [];
const check = async (name, fn) => {
  try {
    const detail = await fn();
    results.push({ name, pass: true, ...detail });
    console.log('PASS ' + name);
  } catch (error) {
    results.push({ name, pass: false, error: error.message, stack: error.stack });
    console.log('FAIL ' + name + ': ' + error.message);
  }
};
const neutral = { roll: 0, pitch: 0, yaw: 0, throttle: 0.5, actions: 0 };
const criterion = {
  type: 'actor-track-v1',
  actorId: 'subject',
  minDistance: 2500,
  maxDistance: 9000,
  maxRelativeSpeed: 2000,
  maxTilt: 4500,
  ticks: 100,
  viewAngle: 4500,
  minTargetTravel: 0,
};
const subject = {
  id: 'subject',
  type: 'drone',
  role: 'civilian',
  position: { x: 0, y: 3000, z: -6000 },
  radius: 220,
  health: 100,
  fireEveryTicks: 0,
  path: [],
  speed: 0,
};
function course(overrides = {}, actorOverrides = {}, courseOverrides = {}) {
  const step = { ...criterion, ...overrides };
  return validateWorldCourse({
    format: 'FlightCourse.v2',
    id: 'track-probe',
    revision: 'r1',
    environment: 'field',
    world: { id: 'track-probe', theme: 'academy', style: 'meadow' },
    locales: Object.fromEntries(
      ['en', 'uk'].map((k) => [
        k,
        {
          title: 'Functional tracking fixture',
          brief: 'Actual command verification',
          lesson: 'Unscored temporary verification',
        },
      ]),
    ),
    spawn: { x: 0, y: 3000, z: 0 },
    bounds: { min: { x: -35000, y: 0, z: -35000 }, max: { x: 35000, y: 30000, z: 35000 } },
    obstacles: [],
    actors: [{ ...subject, ...actorOverrides }],
    steps: { 'self-level': [step], acro: [structuredClone(step)] },
    rules: { maxTicks: 5000 },
    ...courseOverrides,
  });
}
function run(
  c,
  {
    mode = 'self-level',
    input = () => neutral,
    ticks = 4000,
    stop = (s) => s.status !== 'active',
  } = {},
) {
  const f = createWorldFlight({ course: c, mode });
  f.arm();
  const r = createWorldRecorder(f, { session: 'authoring' });
  let s = f.snapshot();
  try {
    for (let i = 0; i < ticks && s.status === 'active'; i++) {
      s = f.step(input(s, i));
      r.record();
      if (stop(s, i)) break;
    }
    return { state: s, proof: r.export() };
  } finally {
    f.dispose();
  }
}
const replay = async (c, r) => {
  const played = await replayWorldFlight(c, r.proof, { yieldControl: async () => {} });
  assert.equal(worldStateIdentity(played.state), worldStateIdentity(r.state));
  return played;
};
const trackingPilot = (mode) => {
  const memory = {};
  return (state) => {
    const a = state.actors[0];
    const p = { x: a.position.x, y: a.position.y, z: a.position.z + 6000 };
    const next = {
      ...state,
      target: {
        type: 'hold',
        min: p,
        max: p,
        maxTilt: 9000,
        minTilt: 0,
        heading: 0,
        centred: false,
      },
    };
    return schoolAuthoringPilot(next, { id: 'track-probe' }, memory, mode);
  };
};
for (const mode of ['self-level', 'acro']) {
  await check(
    'Observe a live stationary subject with actual ' + mode + ' commands and replay',
    async () => {
      const c = course();
      assert.equal(worldCourseRequiresAcro(c), false);
      const r = run(c, { mode, ticks: 120 });
      assert.equal(r.state.status, 'complete');
      assert.equal(r.state.ticks, 100);
      assert.equal(r.state.actorTrack.travel, 0);
      await replay(c, r);
      return { ticks: r.state.ticks };
    },
  );
  await check('Follow a moving subject with actual ' + mode + ' commands and replay', async () => {
    const c = course(
      { ticks: 250, minTargetTravel: 6000, maxRelativeSpeed: 700 },
      {
        speed: 1000,
        path: [
          { x: 0, y: 3000, z: -25000 },
          { x: 0, y: 3000, z: -6000 },
        ],
      },
    );
    const r = run(c, { mode, input: trackingPilot(mode), ticks: 1800 });
    assert.equal(r.state.status, 'complete');
    assert.ok(r.state.actorTrack.travel >= 6000);
    assert.ok(r.state.ticks >= 300);
    assert.ok(r.state.position.z < -1000, 'Pilot must actually move');
    await replay(c, r);
    return {
      ticks: r.state.ticks,
      travel: r.state.actorTrack.travel,
      playerTravelZ: -r.state.position.z,
    };
  });
}
await check('Occluding static geometry blocks observation', async () => {
  const c = course(
    {},
    {},
    {
      obstacles: [
        { id: 'occluder', min: { x: -4000, y: 0, z: -3500 }, max: { x: 4000, y: 7000, z: -3000 } },
      ],
    },
  );
  const r = run(c, { ticks: 180 });
  assert.equal(r.state.step, 0);
  assert.equal(r.state.hold, 0);
  assert.equal(r.state.actorTrack.reason, 'subject-occluded');
  await replay(c, r);
});
await check('Outside subject range never gains dwell', () => {
  const c = course({}, { position: { x: 0, y: 3000, z: -20000 } });
  const r = run(c, { ticks: 180 });
  assert.equal(r.state.hold, 0);
  assert.equal(r.state.actorTrack.reason, 'subject-range');
});
await check('Grounded observation never gains dwell', () => {
  const c = course({ viewAngle: 8000 }, {}, { spawn: { x: 0, y: 0, z: 0 } });
  const r = run(c, { input: () => ({ ...neutral, throttle: 0 }), ticks: 180 });
  assert.equal(r.state.hold, 0);
  assert.equal(r.state.actorTrack.reason, 'airborne-clearance');
});
await check('Turning away resets consecutive dwell and subject travel', () => {
  const c = course(
    { ticks: 500, minTargetTravel: 1000 },
    {
      speed: 500,
      path: [
        { x: 0, y: 3000, z: -20000 },
        { x: 0, y: 3000, z: -6000 },
      ],
    },
  );
  const r = run(c, { ticks: 140, input: (s, i) => ({ ...neutral, yaw: i < 40 ? 0 : 0.6 }) });
  assert.equal(r.state.hold, 0);
  assert.equal(r.state.actorTrack.travel, 0);
  assert.equal(r.state.actorTrack.reason, 'nose-alignment');
});
await check('Body pitch changes the full 3D nose cone', () => {
  const c = course({ ticks: 500, maxTilt: 9000, viewAngle: 1000 });
  const r = run(c, {
    mode: 'acro',
    ticks: 30,
    input: (s, i) => ({ ...neutral, pitch: i < 10 ? 0 : 0.5 }),
  });
  assert.equal(r.state.hold, 0);
  assert.equal(r.state.actorTrack.reason, 'nose-alignment');
});
await check('Relative subject speed is measured from actual movement', () => {
  const c = course(
    { maxRelativeSpeed: 100 },
    {
      speed: 1000,
      path: [
        { x: 0, y: 3000, z: -20000 },
        { x: 0, y: 3000, z: -6000 },
      ],
    },
  );
  const r = run(c, { ticks: 80 });
  assert.equal(r.state.hold, 0);
  assert.equal(r.state.actorTrack.reason, 'relative-speed');
});
await check('Blocked moving route cannot fabricate follow travel', () => {
  const c = course(
    { ticks: 100, minTargetTravel: 2000 },
    {
      speed: 1000,
      path: [
        { x: 0, y: 3000, z: -18000 },
        { x: 0, y: 3000, z: -6000 },
      ],
    },
    {
      obstacles: [
        { id: 'path-wall', min: { x: -3000, y: 0, z: -8000 }, max: { x: 3000, y: 7000, z: -7000 } },
      ],
    },
  );
  const r = run(c, { ticks: 500 });
  assert.equal(r.state.step, 0);
  assert.ok(r.state.hold >= 100);
  assert.ok(r.state.actorTrack.travel < 2000);
  assert.equal(r.state.actorTrack.reason, 'subject-travel');
  return { travel: r.state.actorTrack.travel, heldTicks: r.state.hold };
});
await check('Defeated subjects cannot be observed', async () => {
  const c = course({ ticks: 500 }, { role: 'hostile', health: 1 });
  const r = run(c, { ticks: 70, input: () => ({ ...neutral, actions: 1 }) });
  assert.equal(r.state.actors[0].status, 'defeated');
  assert.equal(r.state.hold, 0);
  assert.equal(r.state.actorTrack.reason, 'subject-unavailable');
  await replay(c, r);
});
await check('Pause retains progress; recorded prefix recovery resumes exactly', async () => {
  const c = course();
  const f = createWorldFlight({ course: c });
  f.arm();
  const recorder = createWorldRecorder(f, { session: 'authoring' });
  for (let i = 0; i < 40; i++) {
    f.step(neutral);
    recorder.record();
  }
  f.pause();
  const before = f.snapshot();
  f.step({ ...neutral, yaw: 1 });
  assert.deepEqual(f.snapshot(), before);
  const recovered = await recoverWorldFlight(c, JSON.parse(JSON.stringify(recorder.export())), {
    yieldControl: async () => {},
  });
  assert.deepEqual(recovered.flight.snapshot(), before);
  recovered.flight.arm();
  let s;
  for (let i = 0; i < 60; i++) {
    s = recovered.flight.step(neutral);
    recovered.recorder.record();
  }
  assert.equal(s.status, 'complete');
  assert.equal(s.ticks, 100);
  await replayWorldFlight(c, recovered.recorder.export(), { yieldControl: async () => {} });
  recovered.flight.dispose();
  f.dispose();
});
await check('Layered definitions and portable compiled pack preserve actor tracking', async () => {
  const c = course();
  const split = splitCourseDefinition(c);
  const compiled = compileChallengeDefinition(split).course;
  assert.deepEqual(compiled.steps, c.steps);
  const exported = JSON.parse(exportWorldCourse(compiled));
  assert.deepEqual(exported.steps, c.steps);
  const p = {
    format: WORLD_PROJECT_FORMAT,
    id: 'actor-track-fixture',
    title: 'Actor tracking verification',
    world: { id: 'actor-track-fixture', title: 'Tracking' },
    courses: [c],
    themes: [],
    campaigns: [],
    playlists: [],
  };
  const pack = await preparePack(p, { assets: new Map() });
  const loaded = await inspectPack(pack.blob ?? pack);
  assert.deepEqual(validateWorldCourse(loaded.project.courses[0]).steps, c.steps);
  return { bytes: (pack.blob ?? pack).size };
});
await check(
  'New criterion validation rejects missing subject, hazards, impossible movement and malformed limits',
  () => {
    for (const [step, actor] of [
      [{ actorId: 'missing' }, {}],
      [{}, { type: 'hazard', role: undefined }],
      [{ minTargetTravel: 100 }, {}],
      [{ maxDistance: 100 }, {}],
      [{ maxRelativeSpeed: -1 }, {}],
      [{ viewAngle: 9001 }, {}],
      [{ minTargetTravel: 1.5 }, {}],
      [{ ticks: 5001 }, {}],
    ])
      assert.throws(() => course(step, actor));
  },
);
await check('Unscored tracking practice completes without creating proof evidence', () => {
  const c = course();
  const f = createWorldFlight({ course: c, unscoredPractice: true });
  f.arm();
  for (let i = 0; i < 150; i++) f.step(neutral);
  assert.equal(f.snapshot().step, 1);
  assert.equal(f.snapshot().status, 'active');
  assert.throws(() => createWorldRecorder(f));
  f.dispose();
});
await check(
  'IndexedDB transaction API installs/reopens exact objectives and editable ZIP roundtrips',
  async () => {
    const c = course();
    const p = {
      format: WORLD_PROJECT_FORMAT,
      id: 'actor-track-storage',
      title: 'Actor tracking storage verification',
      world: { id: 'actor-track-storage', title: 'Tracking' },
      courses: [c],
      themes: [],
      campaigns: [],
      playlists: [],
    };
    const pack = await preparePack(p);
    const indexedDB = new IDBFactory();
    let store = await openWorldStore({ indexedDB, name: 'actor-track-storage' });
    try {
      await installPack(pack, { store, expectedGeneration: 0 });
      store.close();
      store = await openWorldStore({ indexedDB, name: 'actor-track-storage' });
      const saved = await store.get(p.id);
      assert.deepEqual(validateWorldCourse(saved.project.courses[0]).steps, c.steps);
      const zip = await exportEditableZip(saved.project, { assets: saved.assets });
      const reopened = await importEditableZip(zip);
      assert.deepEqual(validateWorldCourse(reopened.project.courses[0]).steps, c.steps);
      return {
        storage:
          'Production world-store API on fake-indexeddb; browser storage is a separate qualification',
        zipBytes: zip.size,
      };
    } finally {
      store.close();
    }
  },
);
await check('Changing tracking rules invalidates previous exact-dependency proof', async () => {
  const c = course();
  const r = run(c);
  const changed = structuredClone(c);
  changed.steps['self-level'][0].viewAngle = 6000;
  await assert.rejects(
    replayWorldFlight(changed, r.proof, { yieldControl: async () => {} }),
    /Exact world/,
  );
});
await check('All 24 original v1 demonstrations still complete', () => {
  const map = new Map(WORLD_CATALOGUE.filter((e) => e.legacy).map((e) => [e.id, e.course]));
  for (const proof of FLIGHT_DEMONSTRATIONS) {
    const replayed = replayFlight(map.get(proof.course), proof);
    assert.equal(replayed.state.status, 'complete', proof.course);
  }
  return { proofs: FLIGHT_DEMONSTRATIONS.length };
});
await check(
  'All pre-adventure world demonstrations retain exact identities and final states',
  async () => {
    const map = new Map([...WORLD_CATALOGUE, ...BEGINNER_CATALOGUE].map((e) => [e.id, e.course]));
    let frames = 0;
    const prior = WORLD_DEMONSTRATIONS.filter((row) => !row.proof.course.startsWith('adventure-'));
    for (const row of prior) {
      const c = map.get(row.proof.course);
      assert.ok(c, row.proof.course);
      const result = await replayWorldFlight(c, row.proof, { yieldControl: async () => {} });
      assert.equal(result.state.status, 'complete', row.proof.course);
      assert.equal('actorTrack' in result.state, false);
      frames += row.proof.frames.length;
    }
    return { proofs: prior.length, frames };
  },
);
const receipt = {
  format: 'fpv-actor-track-functional.v1',
  at: new Date().toISOString(),
  worldModelSHA256: createHash('sha256')
    .update(await readFile(root + '/optional-practice/civilian-fpv/world-model.mjs'))
    .digest('hex'),
  qualification:
    'Actual fixed-step controls, replay and portable data roundtrips. Temporary functional checks; no additional unit coverage, physical hardware, browser or deployment acceptance.',
  passed: results.filter((r) => r.pass).length,
  total: results.length,
  checks: results,
};
await mkdir(path.dirname(output), { recursive: true });
await writeFile(output, JSON.stringify(receipt, null, 2) + '\n');
console.log(JSON.stringify({ passed: receipt.passed, total: receipt.total, receipt: output }));
if (receipt.passed !== receipt.total) process.exitCode = 1;
