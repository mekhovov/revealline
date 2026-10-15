import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createOverflightGrid,
  rebuildOverflightGrid,
  overflightCrowdSeparation,
  visitOverflightGrid,
} from '../overflight/grid.mjs';
import { createOverflightProject, compileOverflightProject } from '../overflight/project.mjs';
import {
  createOverflightRiyProject,
  compileOverflightRiyProject,
} from '../overflight/riy-project.mjs';
import { overflightCombatEditor } from '../studio/overflight-combat-editor.mjs';
import { Document } from './helpers/couch-dom.mjs';
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-7, `${a} != ${b}`);
function scene(x) {
  const records = [
    { id: 1, x, y: 64, radius: 9, active: true },
    { id: 2, x: 74, y: 64, radius: 9, active: true },
    { id: 3, x: 55, y: 69, radius: 9, active: true },
  ];
  const grid = createOverflightGrid(512, 512, records.length);
  rebuildOverflightGrid(grid, records);
  return { grid, records };
}
test('local crowd force crosses grid boundaries continuously and uses neighboring cells', () => {
  const a = scene(64 - 1e-9),
    b = scene(64 + 1e-9);
  const left = overflightCrowdSeparation(a.grid, 0, 28, {}),
    right = overflightCrowdSeparation(b.grid, 0, 28, {});
  close(left.x, right.x);
  close(left.y, right.y);
  const translated = scene(164 - 1e-9);
  for (const record of translated.records) if (record.id !== 1) record.x += 100;
  rebuildOverflightGrid(translated.grid, translated.records);
  const other = overflightCrowdSeparation(translated.grid, 0, 28, {});
  close(left.x, other.x);
  close(left.y, other.y);
  assert.ok(Math.hypot(left.x, left.y) <= 0.65000001);
  const before = { ...left };
  a.records[1].x = 400;
  const frozen = overflightCrowdSeparation(a.grid, 0, 28, {});
  assert.deepEqual(frozen, before, 'movement iteration reads one frozen spatial snapshot');
});
test('coincident bodies receive finite opposite separation and distant bodies have no force', () => {
  const records = [
    { id: 1, x: 64, y: 64, radius: 9, active: true },
    { id: 2, x: 64, y: 64, radius: 9, active: true },
  ];
  const grid = createOverflightGrid(512, 512, 2);
  rebuildOverflightGrid(grid, records);
  const a = overflightCrowdSeparation(grid, 0, 28, {}),
    b = overflightCrowdSeparation(grid, 1, 28, {});
  assert.ok(Math.hypot(a.x, a.y) > 0.1);
  close(a.x, -b.x);
  close(a.y, -b.y);
  records[1].x = 300;
  rebuildOverflightGrid(grid, records);
  assert.deepEqual(overflightCrowdSeparation(grid, 0, 28, {}), { x: 0, y: 0 });
});
for (const [label, create, compile] of [
  ['Survival', createOverflightProject, compileOverflightProject],
  ['Riy', createOverflightRiyProject, compileOverflightRiyProject],
]) {
  test(`${label} authors local separation explicitly without rewriting earlier content or records`, () => {
    const old = create({ rulesVersion: 4, seed: 202604, layout: 'relay-ruins-receiver-gardens' });
    const saved = JSON.stringify(old);
    const revised = create({
      rulesVersion: 4,
      seed: 202604,
      layout: 'relay-ruins-receiver-gardens',
      crowdSeparation: 'local-v1',
    });
    const previous = compile(old),
      current = compile(revised);
    assert.equal(previous.combat.crowdSeparation, undefined);
    assert.equal(current.combat.crowdSeparation, 'local-v1');
    assert.notEqual(current.projectIdentity, previous.projectIdentity);
    assert.equal(current.visualIdentity, previous.visualIdentity);
    assert.equal(
      compile(JSON.parse(JSON.stringify(revised))).projectIdentity,
      current.projectIdentity,
    );
    assert.equal(JSON.stringify(old), saved);
    assert.throws(() => create({ rulesVersion: 3, crowdSeparation: 'local-v1' }));
    const invalid = structuredClone(revised);
    invalid.combat.crowdSeparation = 'unbounded';
    assert.throws(() => compile(invalid));
    const project = structuredClone(old);
    let changes = 0;
    const editor = overflightCombatEditor({
      document: new Document(),
      project,
      locale: 'en',
      onChange: () => changes++,
    });
    const select = editor.querySelector('[data-crowd-separation]');
    assert.ok(select);
    select.value = 'local-v1';
    select.dispatchEvent({ type: 'change' });
    assert.equal(compile(project).combat.crowdSeparation, 'local-v1');
    select.value = 'legacy';
    select.dispatchEvent({ type: 'change' });
    assert.equal(compile(project).projectIdentity, previous.projectIdentity);
    assert.equal(changes, 2);
  });
}

test('the native simulation uses authored local spacing and preserves complete area damage', async () => {
  const {
    createOverflightRun,
    startOverflight,
    stepOverflight,
    spawnOverflightEnemy,
    damageOverflightArea,
  } = await import('../overflight/core.mjs');
  function setup(local) {
    const compiled = structuredClone(
      compileOverflightProject(
        createOverflightProject({ rulesVersion: 4, crowdSeparation: local ? 'local-v1' : null }),
      ),
    );
    compiled.encounters = [];
    compiled.goals = { eliteAt: 10000, finalAt: 20000, finalHp: 5000 };
    const run = createOverflightRun(compiled);
    startOverflight(run);
    run.player.x = 800;
    run.player.y = 500;
    const a = spawnOverflightEnemy(run, {
      family: 'patroller',
      x: 500,
      y: 500,
      warning: 0,
      hp: 100,
      speed: 40,
    });
    const b = spawnOverflightEnemy(run, {
      family: 'patroller',
      x: 500,
      y: 508,
      warning: 0,
      hp: 100,
      speed: 40,
    });
    // Both pursue to the right; a must also move away from b in the local variant.
    a.steeringX = b.steeringX = 1;
    a.steeringY = b.steeringY = 0;
    return { run, a, b };
  }
  const local = setup(true),
    legacy = setup(false);
  stepOverflight(local.run);
  stepOverflight(legacy.run);
  assert.ok(local.a.y < legacy.a.y, 'authored local steering is applied by the real movement step');
  assert.equal(legacy.a.y, 500, 'original two-body pursuit has no centroid separation');
  damageOverflightArea(local.run, 500, 500, 40, 1000);
  assert.equal(local.a.active, false);
  assert.equal(local.b.active, false);
  assert.equal(local.run.stats.kills, 2, 'neighbor steering never truncates damage coverage');
});

test('same and new-seed sorties preserve explicitly authored local crowd rules', async () => {
  const { overflightSortieProject } = await import('../overflight/host-loop.mjs');
  for (const create of [createOverflightProject, createOverflightRiyProject]) {
    const mode = { createProject: (options) => create({ ...options, rulesVersion: 4 }) };
    const source = mode.createProject({ seed: 17, crowdSeparation: 'local-v1' });
    assert.equal(
      overflightSortieProject(mode, source, { seed: 17, difficulty: 'standard' }),
      source,
    );
    const retry = overflightSortieProject(mode, source, { seed: 18, difficulty: 'veteran' });
    assert.equal(retry.seed, 18);
    assert.equal(retry.combat.crowdSeparation, 'local-v1');
    assert.equal(retry.battlefield.id, source.battlefield.id);
  }
});

test('Raid does not advertise or silently accept the Survivor-only movement experiment', async () => {
  const { createOverflightHuntProject, compileOverflightHuntProject } = await import(
    '../overflight/raid-project.mjs'
  );
  const project = createOverflightHuntProject({ rulesVersion: 4 });
  const editor = overflightCombatEditor({
    document: new Document(),
    project,
    locale: 'uk',
    onChange() {},
  });
  assert.equal(editor.querySelector('[data-crowd-separation]'), null);
  project.combat.crowdSeparation = 'local-v1';
  assert.throws(() => compileOverflightHuntProject(project));
});

test('local broad phase matches every nearby body across rebuilds, radii and arena edges', () => {
  const records = Array.from({ length: 240 }, (_, index) => ({
    id: index + 1,
    active: index % 17 !== 0,
    radius: [8, 15, 28][index % 3],
    x: (index * 79.125) % 512,
    y: (index * 31.875) % 256,
  }));
  const grid = createOverflightGrid(512, 256, records.length),
    scratch = {};
  function reference(source) {
    let x = 0,
      y = 0;
    for (const other of records) {
      if (!other.active || other.id === source.id) continue;
      const dx = source.x - other.x,
        dy = source.y - other.y,
        d = Math.hypot(dx, dy),
        cutoff = source.radius + other.radius + 8;
      if (d > 0 && d < cutoff) {
        const weight = (1 - d / cutoff) / d;
        x += dx * weight;
        y += dy * weight;
      }
    }
    const length = Math.hypot(x, y);
    if (length > 0.65) {
      x *= 0.65 / length;
      y *= 0.65 / length;
    }
    return { x, y };
  }
  for (let frame = 0; frame < 3; frame++) {
    for (const record of records) {
      record.x = (record.x + 13.5) % 512;
      record.y = (record.y + 7.25) % 256;
      if (frame === 1 && record.id % 19 === 0) record.active = !record.active;
    }
    rebuildOverflightGrid(grid, records);
    const before = [];
    visitOverflightGrid(grid, 256, 128, 600, (enemy) => before.push(enemy.id));
    for (let index = 0; index < records.length; index++) {
      const actual = overflightCrowdSeparation(grid, index, grid.maxRadius, scratch);
      const expected = records[index].active ? reference(records[index]) : { x: 0, y: 0 };
      close(actual.x, expected.x);
      close(actual.y, expected.y);
    }
    const after = [];
    visitOverflightGrid(grid, 256, 128, 600, (enemy) => after.push(enemy.id));
    assert.deepEqual(after, before, 'local indexing preserves the exact-query candidate order');
  }
});

test('local spacing freezes coordinates before its first query and allocates its fine index only on demand', () => {
  const { grid, records } = scene(64);
  assert.equal(grid.local, null);
  const reference = overflightCrowdSeparation(scene(64).grid, 0, 28, {});
  records[1].x = 400;
  const actual = overflightCrowdSeparation(grid, 0, 28, {});
  close(actual.x, reference.x);
  close(actual.y, reference.y);
  assert.ok(grid.local.heads.byteLength + grid.local.next.byteLength <= 60 * 1024);
});
test('diagnostic fixtures explicitly select local spacing without enabling it in ordinary play or Raid', async () => {
  const { overflightReviewCrowdSeparation } = await import('../overflight/host-loop.mjs');
  const params = new URLSearchParams('reviewCrowd=local');
  for (const mode of ['overflight', 'overflight-riy']) {
    assert.equal(overflightReviewCrowdSeparation(params, { mode, build: 'echo' }), 'local-v1');
    for (const fixture of ['reference', 'stress'])
      assert.equal(overflightReviewCrowdSeparation(params, { mode, fixture }), 'local-v1');
    assert.equal(overflightReviewCrowdSeparation(params, { mode }), null);
    assert.equal(overflightReviewCrowdSeparation(params, { mode, fixture: 'invalid' }), null);
  }
  assert.equal(
    overflightReviewCrowdSeparation(params, {
      mode: 'overflight-hunt',
      build: 'objectives',
      fixture: 'reference',
    }),
    null,
  );
  assert.equal(
    overflightReviewCrowdSeparation(new URLSearchParams('reviewCrowd=unknown'), {
      mode: 'overflight',
      fixture: 'reference',
    }),
    null,
  );
});
