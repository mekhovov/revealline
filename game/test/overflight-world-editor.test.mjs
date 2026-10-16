import test from 'node:test';
import assert from 'node:assert/strict';
import { Document } from './helpers/couch-dom.mjs';
import {
  overflightWorldEditor,
  fitOverflightWorldPlacement,
  paintOverflightTerrainLayout,
} from '../studio/overflight-world-editor.mjs';
import { createOverflightProject, compileOverflightProject } from '../overflight/project.mjs';
import {
  createOverflightRiyProject,
  compileOverflightRiyProject,
} from '../overflight/riy-project.mjs';
import {
  createOverflightHuntProject,
  compileOverflightHuntProject,
} from '../overflight/raid-project.mjs';
import {
  validateOverflightWorldPresentation,
  createExperimentalOverflightWorldProject,
} from '../overflight/worlds.mjs';
import { OVERFLIGHT_WORLD_PROP_SLOTS } from '../presentation/overflight-world-slots.mjs';
import { paintOverflightMission } from '../overflight/mission-library.mjs';

function harness(project, options = {}) {
  const document = new Document();
  let changes = 0,
    applications = 0;
  const root = overflightWorldEditor({
    document,
    project,
    locale: 'en',
    onChange: () => changes++,
    onApply: () => applications++,
    ...options,
  });
  document.body.append(root);
  return { root, document, changes: () => changes, applications: () => applications };
}

for (const [name, create, compile] of [
  ['Single Drone', createOverflightProject, compileOverflightProject],
  ['Riy', createOverflightRiyProject, compileOverflightRiyProject],
  ['Raid', createOverflightHuntProject, compileOverflightHuntProject],
])
  test(`${name} world selection changes presentation only; explicit application preserves author settings`, () => {
    const project = create({ rulesVersion: 3 }),
      before = structuredClone(project),
      identity = compile(project).projectIdentity,
      view = harness(project),
      selection = view.root.querySelector('[data-world-select]');
    selection.value = 'freight-depot';
    selection.emit('change');
    assert.equal(project.presentation.world, 'freight-depot');
    assert.equal(compile(project).projectIdentity, identity);
    assert.deepEqual(project.encounters, before.encounters);
    assert.equal(view.changes(), 1);
    project.presentation.landmarks[0].x = 5;
    project.presentation.landmarks[0].width -= 5;
    const authoredPresentation = structuredClone(project.presentation);
    view.root.querySelector('[data-world-encounters]').emit('click');
    assert.equal(view.applications(), 1);
    assert.notDeepEqual(project.encounters, before.encounters);
    assert.equal(project.encounterProfile, 'freight-depot.v1');
    assert.equal(project.id, before.id);
    assert.deepEqual(project.title, before.title);
    assert.deepEqual(project.combat, before.combat);
    assert.deepEqual(project.resources, before.resources);
    assert.deepEqual(project.presentation, authoredPresentation);
    assert.notEqual(compile(project).projectIdentity, identity);
    selection.value = '';
    selection.emit('change');
    assert.equal(project.presentation, undefined);
    assert.doesNotThrow(() => compile(project));
  });

test('legacy drafts expose the explicit upgraded-copy path without mutating originals', () => {
  const project = createOverflightProject(),
    before = structuredClone(project),
    view = harness(project);
  assert.equal(view.root.querySelector('[data-world-select]'), null);
  assert.deepEqual(project, before);
  assert.equal(view.changes(), 0);
});

test('placement authoring bounds footprints, reserves tall scenery for edges and keeps expanded controls open', () => {
  const project = createOverflightProject({ rulesVersion: 3, world: 'field-crossing' }),
    view = harness(project),
    group = view.root.querySelector('[data-world-group="landmarks"]');
  group.open = true;
  const tree = view.root.querySelector('[data-world-placement="landmarks:shelter-0"]');
  const y = tree.querySelector('[data-world-coordinate="y"]');
  y.value = 500;
  y.emit('change');
  const entry = project.presentation.landmarks.find((entry) => entry.id === 'shelter-0');
  assert.ok(entry.y + entry.height <= 150);
  assert.equal(Number(y.value), entry.y);
  assert.equal(group.open, true);
  const width = tree.querySelector('[data-world-coordinate="width"]');
  width.value = 99999;
  width.emit('change');
  assert.equal(entry.width, project.arena.width);
  assert.equal(entry.x, 0);
  assert.doesNotThrow(() =>
    validateOverflightWorldPresentation(project.presentation, project.arena),
  );
  const count = project.presentation.landmarks.length;
  view.root.querySelector('[data-world-add-landmarks]').emit('click');
  assert.equal(project.presentation.landmarks.length, count + 1);
  assert.equal(view.root.querySelector('[data-world-group="landmarks"]').open, true);
  view.root
    .querySelector('[data-world-placement="landmarks:custom-landmarks-1"] [data-world-remove]')
    .emit('click');
  assert.equal(project.presentation.landmarks.length, count);
});

test('authoring will not exceed the admitted 64-placement budget', () => {
  const project = createOverflightProject({ rulesVersion: 3, world: 'relay-ruins' });
  project.presentation.regions = Array.from({ length: 64 }, (_, index) => ({
    id: `region-${index}`,
    material: 'earth',
    x: index,
    y: 10,
    width: 1,
    height: 1,
  }));
  const view = harness(project),
    add = view.root.querySelector('[data-world-add-regions]');
  assert.equal(add.disabled, true);
  add.emit('click');
  assert.equal(project.presentation.regions.length, 64);
  assert.equal(view.changes(), 0);
});

test('placement fit handles every arena size without turning visual props into interior obstructions', () => {
  for (const arena of [
    { width: 960, height: 540 },
    { width: 5760, height: 2160 },
  ])
    for (const y of [-10, 50, arena.height / 2, arena.height + 500]) {
      const entry = fitOverflightWorldPlacement(
        { kind: 'container', x: -10, y, width: 120, height: 9999 },
        arena,
      );
      assert.ok(entry.x >= 0 && entry.x + entry.width <= arena.width);
      assert.ok(entry.y >= 0 && entry.y + entry.height <= arena.height);
      assert.ok(
        entry.y + entry.height <= (150 * arena.height) / 1080 ||
          entry.y >= arena.height - (150 * arena.height) / 1080,
      );
    }
});

test('mission thumbnails paint native world appearance without changing combat projects', () => {
  const signatures = [];
  for (const world of ['field-crossing', 'freight-depot', 'relay-ruins']) {
    const project = createOverflightProject({ rulesVersion: 3, world }),
      before = structuredClone(project),
      calls = [];
    const context = new Proxy(
      {},
      {
        get: (target, key) =>
          key in target ? target[key] : (...args) => calls.push([key, ...args]),
      },
    );
    paintOverflightMission(context, { operation: 'overflight', project });
    assert.ok(calls.some(([name]) => name === 'scale'));
    assert.ok(calls.filter(([name]) => name === 'fillRect').length > 100);
    assert.deepEqual(project, before);
    signatures.push(JSON.stringify(calls));
  }
  assert.equal(new Set(signatures).size, 3);
});

for (const [name, create, compile] of [
  ['Single Drone', createOverflightProject, compileOverflightProject],
  ['Riy', createOverflightRiyProject, compileOverflightRiyProject],
  ['Raid', createOverflightHuntProject, compileOverflightHuntProject],
])
  test(`${name} guided terrain preserves author settings, admits valid footprints and rejects blocked passages`, () => {
    const project = create({ rulesVersion: 3, world: 'field-crossing' });
    const before = structuredClone(project),
      originalIdentity = compile(project).projectIdentity,
      view = harness(project);
    view.root.querySelector('[data-terrain-add]').emit('click');
    assert.equal(project.terrain.obstacles.length, 8);
    assert.equal(project.terrain.obstacles.filter((item) => item.breakable).length, 2);
    assert.equal(view.root.querySelectorAll('[data-terrain-coordinate]').length, 32);
    for (const key of ['id', 'title', 'combat', 'presentation', 'upgrades', 'resources'])
      assert.deepEqual(project[key], before[key]);
    assert.notEqual(compile(project).projectIdentity, originalIdentity);
    const first = view.root.querySelector('[data-terrain-obstacle="west-cover"]');
    const width = first.querySelector('[data-terrain-coordinate="width"]');
    width.value = '160';
    width.emit('change');
    assert.equal(project.terrain.obstacles[0].width, 160);
    assert.doesNotThrow(() => compile(project));
    const accepted = structuredClone(project),
      changes = view.changes(),
      y = first.querySelector('[data-terrain-coordinate="y"]');
    for (const value of ['510', 'NaN', '']) {
      y.value = value;
      y.emit('change');
      assert.deepEqual(project, accepted);
      assert.equal(view.changes(), changes);
      assert.equal(view.root.querySelector('[data-world-status]').dataset.error, 'true');
    }
    view.root.querySelector('[data-terrain-remove]').emit('click');
    assert.equal(project.terrain, undefined);
    assert.equal(view.root.querySelectorAll('[data-terrain-coordinate]').length, 0);
    assert.doesNotThrow(() => compile(project));
  });

test('guided cover changes reject inaccessible rewards and Raid route points atomically', () => {
  for (const create of [createOverflightProject, createOverflightHuntProject]) {
    const project = createExperimentalOverflightWorldProject(create);
    if (create === createOverflightProject) Object.assign(project.props[0], { x: 482, y: 350 });
    else
      project.encounters[0].objectives[0].route = [
        { x: 1350, y: 240 },
        { x: 1400, y: 240 },
      ];
    (create === createOverflightProject ? compileOverflightProject : compileOverflightHuntProject)(
      project,
    );
    const view = harness(project),
      before = structuredClone(project),
      fields = view.root.querySelector(
        `[data-terrain-obstacle="${create === createOverflightProject ? 'west-cover' : 'middle-cover'}"]`,
      );
    if (create === createOverflightProject) {
      // Growing downward preserves passage gaps but covers the repair reward.
      const height = fields.querySelector('[data-terrain-coordinate="height"]');
      height.value = '180';
      height.emit('change');
    } else {
      // A clear obstacle edit must still keep the authored route markers clear.
      const width = fields.querySelector('[data-terrain-coordinate="width"]');
      width.value = '200';
      width.emit('change');
    }
    assert.deepEqual(project, before);
    assert.equal(view.changes(), 0);
    assert.equal(view.root.querySelector('[data-world-status]').dataset.error, 'true');
    assert.match(
      view.root.querySelector('[data-world-status]').textContent,
      create === createOverflightProject ? /reward need drone clearance/ : /route points clear/,
    );
  }
});

test('Time Attack and Marathon retain imported terrain visibly but allow only its explicit removal', () => {
  for (const operation of ['time-attack', 'marathon']) {
    const project = createExperimentalOverflightWorldProject(createOverflightHuntProject),
      before = structuredClone(project),
      view = harness(project, { allowTerrain: false });
    const inputs = view.root.querySelectorAll('[data-terrain-coordinate]');
    assert.equal(inputs.length, 32, operation);
    assert.ok(inputs.every((input) => input.disabled));
    inputs[0].value = '300';
    inputs[0].emit('change');
    assert.deepEqual(project, before);
    assert.match(view.root.textContent, /unavailable in Time Attack and Contract Marathon/);
    view.root.querySelector('[data-terrain-remove]').emit('click');
    assert.equal(project.terrain, undefined);
    assert.equal(view.root.querySelector('[data-terrain-add]').disabled, true);
    view.root.querySelector('[data-terrain-add]').emit('click');
    assert.equal(project.terrain, undefined);
  }
});

test('terrain preview overlays all eight exact footprints and distinguishes both breakable barriers', () => {
  const project = createExperimentalOverflightWorldProject(createOverflightProject),
    before = structuredClone(project.terrain),
    fills = [],
    outlines = [],
    patterns = [];
  const ctx = new Proxy(
    {
      fillRect: (...args) => fills.push(args),
      strokeRect: (...args) => outlines.push(args),
      setLineDash: (pattern) => patterns.push(pattern),
    },
    { get: (target, key) => target[key] ?? (() => {}) },
  );
  paintOverflightTerrainLayout(ctx, project.terrain);
  const expected = project.terrain.obstacles.map(({ x, y, width, height }) => [
    x,
    y,
    width,
    height,
  ]);
  assert.deepEqual(fills, expected);
  assert.deepEqual(outlines, expected);
  assert.equal(patterns.filter((pattern) => pattern.length > 0).length, 2);
  assert.deepEqual(project.terrain, before);
});

for (const [name, create, compile] of [
  ['Single Drone', createOverflightProject, compileOverflightProject],
  ['Riy', createOverflightRiyProject, compileOverflightRiyProject],
  ['Raid', createOverflightHuntProject, compileOverflightHuntProject],
])
  test(`${name} V2 artwork controls admit all native props and preserve valid texture variants`, () => {
    const project = create({ rulesVersion: 4, layout: 'freight-depot-loading-loop' }),
      before = compile(project).projectIdentity,
      view = harness(project);
    for (const entry of project.presentation.landmarks) {
      const control = view.root.querySelector(
        `[data-world-placement="landmarks:${entry.id}"] [data-world-kind]`,
      );
      assert.equal(control.value, entry.kind);
      assert.ok(
        control
          .querySelectorAll('option')
          .some((option) => option.getAttribute('value') === entry.kind),
      );
    }
    view.root.querySelector('[data-world-add-regions]').emit('click');
    const added = project.presentation.regions.find((entry) => entry.id === 'custom-regions-1');
    assert.equal(added.variant, 0);
    const variant = view.root.querySelector(
      '[data-world-placement="regions:custom-regions-1"] [data-world-variant]',
    );
    variant.value = '3';
    variant.emit('change');
    assert.equal(added.variant, 3);
    assert.doesNotThrow(() => compile(project));
    view.root.querySelector('[data-world-add-landmarks]').emit('click');
    const kind = view.root.querySelector(
      '[data-world-placement="landmarks:custom-landmarks-1"] [data-world-kind]',
    );
    assert.deepEqual(
      kind
        .querySelectorAll('option')
        .map((option) => option.getAttribute('value'))
        .sort(),
      Object.keys(OVERFLIGHT_WORLD_PROP_SLOTS).sort(),
    );
    for (const value of ['pallet', 'bollard', 'glass', 'irrigation']) {
      kind.value = value;
      kind.emit('change');
      assert.equal(
        project.presentation.landmarks.find((entry) => entry.id === 'custom-landmarks-1').kind,
        value,
      );
      assert.equal(
        compile(project).projectIdentity,
        before,
        'art edits preserve gameplay identity',
      );
    }
  });

test('V2 region additions stop at32 while V1 keeps its admitted64', () => {
  const project = createOverflightProject({
    rulesVersion: 4,
    layout: 'field-crossing-broken-crossroads',
  });
  project.presentation.regions = Array.from({ length: 31 }, (_, index) => ({
    id: `region-${index}`,
    material: 'earth',
    variant: index % 4,
    x: index,
    y: 10,
    width: 1,
    height: 1,
  }));
  const view = harness(project);
  view.root.querySelector('[data-world-add-regions]').emit('click');
  assert.equal(project.presentation.regions.length, 32);
  const add = view.root.querySelector('[data-world-add-regions]');
  assert.equal(add.disabled, true);
  add.emit('click');
  assert.equal(project.presentation.regions.length, 32);
  assert.doesNotThrow(() => compileOverflightProject(project));
});

for (const [name, create, compile] of [
  ['Single Drone', createOverflightProject, compileOverflightProject],
  ['Riy wrapper', createOverflightRiyProject, compileOverflightRiyProject],
  ['Raid', createOverflightHuntProject, compileOverflightHuntProject],
])
  test(`${name} authored battlefields expose layout editing without the legacy encounter override`, () => {
    const project = create({ rulesVersion: 4, layout: 'field-crossing-broken-crossroads' }),
      before = structuredClone(project),
      identity = compile(project).projectIdentity,
      view = harness(project);
    assert.equal(view.root.querySelector('[data-world-encounters]'), null);
    assert.ok(view.root.querySelector('[data-battlefield-apply]'));
    const select = view.root.querySelector('[data-world-select]');
    select.value = 'chalk-quarry';
    select.emit('change');
    assert.deepEqual(project.encounters, before.encounters);
    assert.equal(project.encounterProfile, before.encounterProfile);
    assert.equal(compile(project).projectIdentity, identity);
    assert.equal(view.root.querySelector('[data-world-encounters]'), null);
    assert.equal(view.applications(), 0);
  });
