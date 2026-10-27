import test from 'node:test';
import assert from 'node:assert/strict';
import { Document } from './helpers/couch-dom.mjs';
import {
  WORLD_ROUTE_GUIDES_FORMAT,
  WORLD_PROJECT_FORMAT,
  routeObjectiveSignature,
  validateWorldRouteGuides,
  admitWorldRouteGuides,
  selectWorldRouteGuide,
  compilePlayable,
  mergeReimport,
  preparePack,
  inspectPack,
} from '../../optional-practice/civilian-fpv/world-content.mjs';
import { mountWorldRouteGuideEditor } from '../../optional-practice/civilian-fpv/world-editor.mjs';
import { dataIdentity } from '../data-json.mjs';

const gate = () => ({
  type: 'gate',
  axis: 'x',
  at: 3000,
  direction: 1,
  minSide: -2000,
  maxSide: 2000,
  minY: 500,
  maxY: 4000,
});
const course = () => ({
  format: 'FlightCourse.v2',
  id: 'route-lab',
  revision: 'r1',
  environment: 'meadow',
  locales: Object.fromEntries(
    ['en', 'uk'].map((lang) => [
      lang,
      {
        title: 'Route lab',
        brief: 'Pass the gate',
        lesson: 'Follow the authored approach',
      },
    ]),
  ),
  spawn: { x: -4000, y: 1000, z: 0 },
  bounds: { min: { x: -10000, y: 0, z: -10000 }, max: { x: 10000, y: 6000, z: 10000 } },
  world: { id: 'route-world', theme: 'academy', style: 'meadow' },
  obstacles: [],
  actors: [],
  rules: {},
  steps: { 'self-level': [gate()], acro: [gate()] },
});
const bundle = (
  source,
  positions = [
    [-4000, 1000, 0],
    [4000, 1000, 0],
  ],
) => ({
  format: WORLD_ROUTE_GUIDES_FORMAT,
  courseId: source.id,
  routes: [
    {
      id: 'approach',
      mode: 'self-level',
      objectiveIndex: 0,
      objectiveSignature: routeObjectiveSignature(source.steps['self-level'][0]),
      clearanceMm: 250,
      waypoints: positions.map(([x, y, z], index) => ({
        id: `point-${index}`,
        position: { x, y, z },
      })),
    },
  ],
});
const project = (source, guides) => ({
  format: WORLD_PROJECT_FORMAT,
  id: 'route-project',
  title: 'Route project',
  world: { id: 'route-world' },
  courses: [source],
  ...(guides ? { routeGuides: [guides] } : {}),
});
const wait = async (predicate) => {
  for (let i = 0; i < 100; i++) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 2));
  }
  assert.fail('Route editor did not settle');
};

test('admitted guides preserve source identity and select only their exact current objective/mode/radius', async () => {
  const source = course(),
    input = bundle(source),
    identity = dataIdentity(source),
    copy = structuredClone(input);
  const accepted = await admitWorldRouteGuides(input, source);
  assert.deepEqual(input, copy);
  assert.equal(dataIdentity(source), identity);
  assert.notEqual(accepted, input);
  assert.equal(
    selectWorldRouteGuide(accepted, { mode: 'self-level', step: 0, aircraftRadiusMm: 250 }).id,
    'approach',
  );
  for (const args of [
    { mode: 'acro', step: 0 },
    { mode: 'self-level', step: 1 },
    { mode: 'self-level', step: 0, aircraftRadiusMm: 251 },
  ])
    assert.equal(selectWorldRouteGuide(accepted, args), null);
});

test('guide schema rejects stale objective bindings, reversed passage, duplicate IDs and insufficient whole-body clearance', () => {
  const source = course();
  for (const change of [
    (v) => {
      v.routes[0].objectiveSignature = 'stale';
    },
    (v) => {
      v.routes[0].waypoints.reverse();
    },
    (v) => {
      v.routes[0].waypoints[1].id = 'point-0';
    },
    (v) => {
      v.routes[0].clearanceMm = 100;
    },
    (v) => {
      v.routes[0].waypoints[1].position.z = 9000;
    },
    (v) => {
      for (const p of v.routes[0].waypoints) p.position.y = 3700;
    },
    (v) => {
      v.routes[0].waypoints[0].position.x = -9900;
    },
    (v) => {
      v.routes.push(structuredClone(v.routes[0]));
    },
  ]) {
    const input = bundle(source);
    change(input);
    assert.throws(() => validateWorldRouteGuides(input, source));
  }
});

test('static admission rejects blocked full segments and accepts an authored detour without inventing a joining line', async () => {
  const source = course();
  source.obstacles = [
    { id: 'wall', min: { x: -500, y: 0, z: -1000 }, max: { x: 500, y: 5000, z: 1000 } },
  ];
  await assert.rejects(admitWorldRouteGuides(bundle(source), source), /crosses an obstacle/);
  const detour = bundle(source, [
    [-4000, 1000, 0],
    [-1500, 1000, 2000],
    [1500, 1000, 2000],
    [2000, 1000, 0],
    [4000, 1000, 0],
  ]);
  assert.deepEqual(await admitWorldRouteGuides(detour, source), detour);
  const rotated = course();
  rotated.obstacles = [
    { ...source.obstacles[0], rotation: [0, Math.sin(Math.PI / 8), 0, Math.cos(Math.PI / 8)] },
  ];
  await assert.rejects(admitWorldRouteGuides(bundle(rotated), rotated), /crosses an obstacle/);
  const mesh = course();
  mesh.obstacles = [
    {
      id: 'mesh-wall',
      type: 'trimesh',
      vertices: [0, 0, -2000, 0, 5000, -2000, 0, 5000, 2000, 0, 0, 2000],
      indices: [0, 1, 2, 0, 2, 3],
    },
  ];
  await assert.rejects(admitWorldRouteGuides(bundle(mesh), mesh), /crosses an obstacle/);
});

test('landing route reaches the actual floor and hold route must finish inside its objective', async () => {
  const source = course(),
    step = {
      type: 'land',
      min: { x: 2000, y: 0, z: -1000 },
      max: { x: 4500, y: 200, z: 1000 },
      ticks: 5,
      maxSpeed: 1000,
      maxTilt: 1000,
      minTilt: 0,
      centred: true,
      heading: null,
      surface: '$floor',
    };
  source.steps['self-level'] = [step];
  const input = bundle(source, [
    [-4000, 1000, 0],
    [3000, 0, 0],
  ]);
  await admitWorldRouteGuides(input, source);
  const outside = structuredClone(input);
  outside.routes[0].waypoints.at(-1).position.x = 6000;
  assert.throws(() => validateWorldRouteGuides(outside, source), /end inside/);
  source.obstacles = [
    { id: 'pad', min: { x: 2000, y: 0, z: -1000 }, max: { x: 4500, y: 500, z: 1000 } },
  ];
  step.min.y = 500;
  step.max.y = 700;
  step.surface = 'pad';
  await admitWorldRouteGuides(
    bundle(source, [
      [3000, 1800, 0],
      [3000, 500, 0],
    ]),
    source,
  );
});

test('reimport keeps guide and waypoint IDs; geometry changes require fresh admission', async () => {
  const source = course(),
    guides = bundle(source),
    p = project(source, guides);
  const result = mergeReimport(p, {
    sourceHash: 'source-revision',
    metadata: { anchors: [], colliders: [], diagnostics: [] },
  });
  assert.deepEqual(result.project.routeGuides, [guides]);
  assert.deepEqual(await admitWorldRouteGuides(result.project.routeGuides[0], source), guides);
});

test('static skill crossings retain their direction and exact objective binding', async () => {
  const source = course();
  source.steps.acro = [
    {
      type: 'crossing-v1',
      min: { x: -5000, y: 500, z: -3000 },
      max: { x: 5000, y: 5000, z: 3000 },
      maxTicks: 500,
      axis: 'x',
      at: 3000,
      direction: 1,
      minA: 500,
      maxA: 4000,
      minB: -2000,
      maxB: 2000,
      minSpeed: 1000,
      forwardTolerance: 3000,
    },
  ];
  const guides = bundle(source);
  guides.routes[0].mode = 'acro';
  guides.routes[0].objectiveSignature = routeObjectiveSignature(source.steps.acro[0]);
  await admitWorldRouteGuides(guides, source);
  guides.routes[0].waypoints.reverse();
  await assert.rejects(admitWorldRouteGuides(guides, source), /required direction/);
});

test('project compile and pack round trip preserve guide IDs without adding course fields; admission repeats against imported geometry', async () => {
  const source = course(),
    input = bundle(source),
    p = project(source, input);
  const compiled = compilePlayable(p);
  assert.deepEqual(compiled.routeGuides, [input]);
  assert.equal(Object.hasOwn(compiled.courses[0], 'routeGuides'), false);
  const pack = await preparePack(p),
    restored = await inspectPack(pack);
  assert.deepEqual(restored.project.routeGuides, [input]);
  assert.deepEqual(
    (await inspectPack(await preparePack(project(source)))).project.routeGuides,
    undefined,
  );
  p.courses[0].obstacles = [
    { id: 'late-wall', min: { x: -500, y: 0, z: -1000 }, max: { x: 500, y: 5000, z: 1000 } },
  ];
  await assert.rejects(preparePack(p), /crosses an obstacle/);
});

test('mounted Studio route editor previews and applies stable waypoint IDs and clears preview when drafts change', async () => {
  const document = new Document(),
    container = document.createElement('div'),
    source = course(),
    guides = bundle(source);
  document.body.append(container);
  const previews = [],
    changes = [],
    errors = [];
  const editor = mountWorldRouteGuideEditor({
    document,
    container,
    onPreview: (v) => previews.push(v),
    onChange: (v) => changes.push(v),
    onError: (e) => errors.push(e),
  });
  editor.update({ course: source, guides, mode: 'self-level', objectiveIndex: 0 });
  const select = container.querySelector('[data-route-field="route"]');
  select.value = 'approach';
  select.dispatchEvent(new Event('change'));
  container.querySelector('[data-route-action="preview"]').click();
  await wait(() => previews.some((v) => v?.id === 'approach'));
  assert.equal(changes.length, 0);
  const x = container.querySelector('[data-route-waypoint="point-0"] [data-route-axis="x"]');
  x.value = '-3.5';
  x.dispatchEvent(new Event('change'));
  assert.equal(previews.at(-1), null);
  container.querySelector('[data-route-action="apply"]').click();
  await wait(() => changes.length === 1);
  assert.deepEqual(
    changes[0].routes[0].waypoints.map((v) => v.id),
    ['point-0', 'point-1'],
  );
  assert.equal(changes[0].routes[0].waypoints[0].position.x, -3500);
  assert.equal(errors.length, 0);
  editor.dispose();
  assert.equal(previews.at(-1), null);
});

test('mounted Studio reports blocked guides and discards late admission after course ownership changes', async () => {
  const document = new Document(),
    container = document.createElement('div'),
    source = course(),
    guides = bundle(source),
    previews = [],
    changes = [];
  source.obstacles = [
    { id: 'wall', min: { x: -500, y: 0, z: -1000 }, max: { x: 500, y: 5000, z: 1000 } },
  ];
  const editor = mountWorldRouteGuideEditor({
    document,
    container,
    onPreview: (v) => previews.push(v),
    onChange: (v) => changes.push(v),
  });
  const selectRoute = () => {
    const select = container.querySelector('[data-route-field="route"]');
    select.value = 'approach';
    select.dispatchEvent(new Event('change'));
  };
  editor.update({ course: source, guides });
  selectRoute();
  container.querySelector('[data-route-action="apply"]').click();
  await wait(() =>
    container.querySelector('[data-route-guide-status]').textContent.includes('Route not applied'),
  );
  assert.equal(changes.length, 0);
  const clear = course();
  editor.update({ course: clear, guides });
  selectRoute();
  container.querySelector('[data-route-action="preview"]').click();
  editor.update({});
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(previews.filter(Boolean).length, 0);
  assert.equal(editor.root.hidden, true);
  editor.dispose();
});

test('Studio repairs or removes multiple stale guides independently while export still requires all guides', async () => {
  const document = new Document(),
    container = document.createElement('div'),
    source = course(),
    original = bundle(source),
    changes = [];
  original.routes.push({
    ...structuredClone(original.routes[0]),
    id: 'acro-approach',
    mode: 'acro',
  });
  source.steps['self-level'][0].maxSide = 1900;
  source.steps.acro[0].maxSide = 1900;
  const editor = mountWorldRouteGuideEditor({
    document,
    container,
    onChange: (value) => changes.push(value),
  });
  const select = (id) => {
    const control = container.querySelector('[data-route-field="route"]');
    control.value = id;
    control.dispatchEvent(new Event('change'));
  };
  try {
    editor.update({ course: source, guides: original, mode: 'self-level', objectiveIndex: 0 });
    select('approach');
    container.querySelector('[data-route-action="rebind"]').click();
    container.querySelector('[data-route-action="apply"]').click();
    await wait(() => changes.length === 1);
    assert.deepEqual(
      changes[0].routes.find((route) => route.id === 'acro-approach'),
      original.routes[1],
    );
    await assert.rejects(preparePack(project(source, changes[0])), /Review and rebind/);
    editor.update({ course: source, guides: changes[0], mode: 'acro', objectiveIndex: 0 });
    select('acro-approach');
    container.querySelector('[data-route-action="rebind"]').click();
    container.querySelector('[data-route-action="apply"]').click();
    await wait(() => changes.length === 2);
    await preparePack(project(source, changes[1]));
    assert.deepEqual(changes[1].routes.map((route) => route.id).sort(), [
      'acro-approach',
      'approach',
    ]);
    editor.update({ course: source, guides: original });
    select('approach');
    container.querySelector('[data-route-action="delete"]').click();
    await wait(() => changes.length === 3);
    assert.deepEqual(changes[2].routes, [original.routes[1]]);
    await assert.rejects(preparePack(project(source, changes[2])), /Review and rebind/);
    select('acro-approach');
    container.querySelector('[data-route-action="delete"]').click();
    await wait(() => changes.length === 4);
    assert.deepEqual(changes[3].routes, []);
    await preparePack(project(source, changes[3]));
  } finally {
    editor.dispose();
  }
});
