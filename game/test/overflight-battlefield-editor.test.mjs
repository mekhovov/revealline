import test from 'node:test';
import assert from 'node:assert/strict';
import { Document } from './helpers/couch-dom.mjs';
import {
  overflightBattlefieldEditor,
  editOverflightMovement,
  paintOverflightBattlefieldRoutes,
} from '../studio/overflight-battlefield-editor.mjs';
import { overflightWorldEditor } from '../studio/overflight-world-editor.mjs';
import { createOverflightProject, compileOverflightProject } from '../overflight/project.mjs';
import {
  createOverflightHuntProject,
  compileOverflightHuntProject,
} from '../overflight/raid-project.mjs';
import {
  createOverflightRiyProject,
  compileOverflightRiyProject,
} from '../overflight/riy-project.mjs';

function harness(project, editor = overflightBattlefieldEditor) {
  const document = new Document();
  let changes = 0,
    applications = 0;
  const root = editor({
    document,
    project,
    locale: 'en',
    onChange: () => changes++,
    onApply: () => applications++,
  });
  document.body.append(root);
  return { root, changes: () => changes, applications: () => applications };
}

for (const [name, create, compile] of [
  ['Single Drone', createOverflightProject, compileOverflightProject],
  ['Riy', createOverflightRiyProject, compileOverflightRiyProject],
  ['Raid', createOverflightHuntProject, compileOverflightHuntProject],
])
  test(`${name}: applying a layout changes gameplay explicitly, world appearance stays cosmetic`, () => {
    const project = create({ rulesVersion: 4 }),
      before = compile(project).projectIdentity,
      view = harness(project);
    const world = view.root.querySelector('[data-battlefield-world]'),
      layout = view.root.querySelector('[data-battlefield-layout]');
    assert.equal(world.children.length, 6);
    assert.equal(layout.children.length, 3);
    world.value = 'freight-depot';
    world.emit('change');
    assert.equal(compile(project).projectIdentity, before);
    layout.value = 'freight-depot-loading-loop';
    view.root.querySelector('[data-battlefield-apply]').emit('click');
    assert.equal(view.changes(), 1);
    assert.equal(view.applications(), 1);
    assert.equal(project.battlefield.id, 'freight-depot-loading-loop');
    const applied = compile(project).projectIdentity;
    assert.notEqual(applied, before);
    const appearance = harness(project, overflightWorldEditor),
      select = appearance.root.querySelector('[data-world-select]');
    select.value = 'river-port';
    select.emit('change');
    assert.equal(project.presentation.world, 'river-port');
    assert.equal(project.battlefield.world, 'freight-depot');
    assert.equal(compile(project).projectIdentity, applied);
  });

test('legacy projects do not expose battlefield editing before explicit upgrade', () => {
  const project = createOverflightProject({ rulesVersion: 3 }),
    before = JSON.stringify(project),
    view = harness(project);
  assert.equal(view.root.hidden, true);
  assert.equal(JSON.stringify(project), before);
});

test('movement controls preserve bounds and invalid edits leave the draft unchanged', () => {
  const project = createOverflightProject({ rulesVersion: 4 }),
    view = harness(project);
  const preset = view.root.querySelector('[data-movement-preset]');
  preset.value = 'committed-flank';
  preset.emit('change');
  assert.equal(project.encounters[0].movement.preset, 'committed-flank');
  assert.equal(view.changes(), 1);
  const input = view.root.querySelector('[data-movement-field="coordinatedFraction"]');
  input.value = 0.3;
  input.emit('change');
  assert.equal(project.encounters[0].movement.coordinatedFraction, 0.3);
  const before = JSON.stringify(project);
  input.value = 0.9;
  input.emit('change');
  assert.equal(JSON.stringify(project), before);
  assert.equal(Number(input.value), 0.3);
  assert.match(view.root.querySelector('[role="status"]').textContent, /coordinatedFraction/);
});

test('route editing derives escort geometry and rejects direct wing edits or covered anchors atomically', () => {
  const source = createOverflightHuntProject({
      rulesVersion: 4,
      layout: 'freight-depot-loading-loop',
    }),
    before = JSON.stringify(source);
  const target = source.encounters[1].objectives.find((o) => o.id === 'carrier');
  const anchors = target.route.map((p) => ({ x: p.x + 8, y: p.y }));
  const next = editOverflightMovement(source, target.id, { anchors });
  assert.equal(JSON.stringify(source), before);
  const moved = next.encounters[1].objectives.find((o) => o.id === target.id);
  assert.deepEqual(moved.route, anchors);
  for (const wing of next.encounters[1].packs.filter((p) => p.escortOf === target.id)) {
    assert.deepEqual(wing.movement.anchors, wing.route);
    for (const [i, p] of wing.route.entries())
      assert.ok(Math.abs(p.x - moved.route[i].x - wing.x + moved.x) < 1e-7);
    assert.throws(() => editOverflightMovement(source, wing.id, { anchors }), /escorted objective/);
  }
  assert.doesNotThrow(() => compileOverflightHuntProject(next));
  assert.throws(
    () =>
      editOverflightMovement(source, target.id, {
        anchors: [
          { x: 1400, y: 500 },
          { x: 1600, y: 500 },
        ],
      }),
    /cover/,
  );
  assert.throws(() => editOverflightMovement(source, target.id, { anchors: [] }), /two to eight/);
  assert.equal(JSON.stringify(source), before);
});

test('Survivor movement anchor edits cannot put pursuit goals inside cover', () => {
  const source = createOverflightProject({ rulesVersion: 4, layout: 'freight-depot-loading-loop' });
  assert.throws(
    () =>
      editOverflightMovement(source, source.encounters[0].id, { anchors: [{ x: 1400, y: 500 }] }),
    /cover/,
  );
});

test('cover coordinate edits and removal keep V2 artwork synchronized without changing unrelated decoration', () => {
  const project = createOverflightProject({
      rulesVersion: 4,
      layout: 'freight-depot-loading-loop',
    }),
    view = harness(project, overflightWorldEditor);
  const custom = structuredClone(project.presentation.landmarks.find((p) => !p.coverId));
  const coordinate = view.root.querySelector('[data-terrain-coordinate="width"]');
  coordinate.value = '620';
  coordinate.emit('change');
  assert.equal(project.terrain.obstacles[0].width, 620);
  assert.equal(project.battlefield.terrain.obstacles[0].width, 620);
  assert.doesNotThrow(() => compileOverflightProject(project));
  assert.deepEqual(
    project.presentation.landmarks.find((p) => p.id === custom.id),
    custom,
  );
  view.root.querySelector('[data-terrain-remove]').emit('click');
  assert.equal(project.terrain.obstacles.length, 0);
  assert.equal(project.presentation.landmarks.filter((p) => p.coverId).length, 0);
  assert.doesNotThrow(() => compileOverflightProject(project));
});

test('route overlay uses compiled authored geometry and does not mutate it', () => {
  const project = createOverflightProject({ rulesVersion: 4, layout: 'chalk-quarry-survey-basin' }),
    before = JSON.stringify(project.battlefield),
    calls = [];
  const context = new Proxy(
    {},
    {
      get:
        (_target, key) =>
        (...args) =>
          calls.push([key, ...args]),
      set: () => true,
    },
  );
  paintOverflightBattlefieldRoutes(context, project.battlefield);
  assert.equal(calls.filter(([kind]) => kind === 'strokeRect').length, 3);
  assert.equal(
    calls.filter(([kind]) => kind === 'moveTo').length,
    project.battlefield.routes.length,
  );
  assert.equal(JSON.stringify(project.battlefield), before);
});
