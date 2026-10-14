import test from 'node:test';
import assert from 'node:assert/strict';
import { dataIdentity } from '../data-json.mjs';
import {
  OVERFLIGHT_BATTLEFIELDS,
  createOverflightBattlefield,
  applyOverflightBattlefield,
  validateOverflightBattlefield,
} from '../overflight/battlefields.mjs';
import { createOverflightProject, compileOverflightProject } from '../overflight/project.mjs';
import {
  createOverflightHuntProject,
  compileOverflightHuntProject,
} from '../overflight/raid-project.mjs';
import {
  createOverflightRiyProject,
  compileOverflightRiyProject,
  upgradeOverflightRiyProjectCopy,
} from '../overflight/riy-project.mjs';
import { upgradeOverflightProjectCopy } from '../overflight/project-upgrade.mjs';
import {
  overflightMarathonProject,
  overflightMarathonSequence,
} from '../overflight/raid-variants.mjs';
import { createOverflightWorldPresentation } from '../overflight/worlds.mjs';
import {
  validateOverflightTerrain,
  createOverflightTerrainFixture,
  createOverflightTerrain,
  overflightTerrainClear,
  overflightTerrainWaypoint,
  damageOverflightTerrain,
} from '../overflight/terrain.mjs';

const modes = [
  [createOverflightProject, compileOverflightProject],
  [createOverflightRiyProject, compileOverflightRiyProject],
  [createOverflightHuntProject, compileOverflightHuntProject],
];

test('18 authored layouts retain distinct paths and compile all three rule families in every difficulty', () => {
  assert.equal(OVERFLIGHT_BATTLEFIELDS.length, 18);
  assert.equal(new Set(OVERFLIGHT_BATTLEFIELDS.map((entry) => entry.world)).size, 6);
  const paths = new Set();
  for (const entry of OVERFLIGHT_BATTLEFIELDS) {
    const layout = createOverflightBattlefield(entry.id);
    assert.deepEqual(layout, createOverflightBattlefield(entry.id));
    paths.add(JSON.stringify(layout.routes));
    assert.ok(layout.terrain.obstacles.length <= 12);
    for (const route of layout.routes)
      for (let i = 1; i < route.points.length; i++) {
        const a = route.points[i - 1],
          b = route.points[i];
        assert.ok(
          overflightTerrainClear(layout.terrain, a.x, a.y, b.x, b.y, 28),
          `${entry.id}: road crosses cover`,
        );
      }
    for (const difficulty of ['relaxed', 'standard', 'veteran'])
      for (const [create, compile] of modes) {
        const project = create({ layout: entry.id, rulesVersion: 4, difficulty });
        const compiled = compile(project);
        assert.equal(compiled.rulesVersion, 4);
        assert.equal(compiled.battlefield.id, entry.id);
        assert.equal(compiled.presentation.world, entry.world);
        assert.equal(compiled.presentation.format, 'OverflightWorldPresentationV2');
        if (compiled.riy) assert.equal(compiled.riyVersion, 2);
      }
  }
  assert.equal(paths.size, 18);
});

test('ordinary opening and relief keep direct pursuit; later decks cover all coordinated behaviors', () => {
  const decks = new Set();
  for (const entry of OVERFLIGHT_BATTLEFIELDS.filter((entry) => entry.kind === 'open')) {
    const project = createOverflightProject({ rulesVersion: 4, layout: entry.id });
    const encounters = project.encounters.filter((e) => e.pattern !== 'relief');
    assert.deepEqual(
      encounters.slice(0, 2).map((e) => e.movement.preset),
      ['pursuit', 'pursuit'],
    );
    assert.equal(new Set(encounters.slice(2, 8).map((e) => e.movement.preset)).size, 6);
    assert.ok(
      project.encounters
        .filter((e) => e.pattern === 'relief')
        .every((e) => e.movement.coordinatedFraction === 0),
    );
    decks.add(
      encounters
        .slice(2, 8)
        .map((e) => e.movement.preset)
        .join(','),
    );
  }
  assert.equal(decks.size, 6);
});

test('V1–V3 imports retain identities; upgrading creates a copy and keeps Riy squad semantics', () => {
  for (const [create, compile] of modes)
    for (const rulesVersion of [2, 3]) {
      const original = create({ rulesVersion }),
        serialized = JSON.stringify(original);
      assert.equal(compile(original).projectIdentity, dataIdentity(original));
      const upgrade =
        create === createOverflightRiyProject
          ? upgradeOverflightRiyProjectCopy(original, { rulesVersion: 4 })
          : upgradeOverflightProjectCopy(original, {
              rulesVersion: 4,
              hunt: create === createOverflightHuntProject,
            });
      assert.equal(compile(upgrade).rulesVersion, 4);
      assert.equal(JSON.stringify(original), serialized);
      assert.notEqual(compile(upgrade).projectIdentity, compile(original).projectIdentity);
      const injected = structuredClone(original);
      injected.battlefield = createOverflightBattlefield();
      injected.terrain = injected.battlefield.terrain;
      assert.throws(() => compile(injected), /V4|current rules/);
    }
});

test('terrain revisions do not reinterpret old experiments and enforce bounded cover clearance', () => {
  const arena = { width: 2880, height: 1080 };
  const old = createOverflightTerrainFixture(arena);
  assert.deepEqual(validateOverflightTerrain(old, arena), old);
  assert.throws(() => validateOverflightTerrain({ ...old, obstacles: [] }, arena), /six permanent/);
  const layout = createOverflightBattlefield('freight-depot-loading-loop');
  const invalid = structuredClone(layout);
  invalid.terrain.obstacles[0].y = 100;
  assert.throws(() => validateOverflightBattlefield(invalid), /240-unit perimeter/);
  const excessive = structuredClone(layout.terrain);
  excessive.obstacles = Array.from({ length: 13 }, (_, i) => ({
    ...excessive.obstacles[0],
    id: `cover-${i}`,
  }));
  assert.throws(() => validateOverflightTerrain(excessive, arena));
  const joined = {
    ...layout.terrain,
    obstacles: [
      { id: 'left', x: 1000, y: 400, width: 200, height: 200, breakable: false },
      { id: 'right', x: 1200, y: 400, width: 200, height: 200, breakable: false },
    ],
  };
  assert.doesNotThrow(() => validateOverflightTerrain(joined, arena));
  joined.obstacles[1].height = 120;
  assert.throws(() => validateOverflightTerrain(joined, arena), /rectangular assembly/);
});

test('all 18 Marathon selections retain five valid contracts, escort offsets and fresh terrain', () => {
  for (const { id } of OVERFLIGHT_BATTLEFIELDS) {
    const base = createOverflightHuntProject({ rulesVersion: 4, layout: id, seed: 42 });
    const original = JSON.stringify(base),
      sequence = overflightMarathonSequence(base);
    assert.equal(sequence[0], id);
    assert.equal(sequence[4], id);
    assert.equal(sequence[1], sequence[3]);
    assert.equal(new Set(sequence).size, 3);
    for (let contract = 1; contract <= 5; contract++) {
      const next = overflightMarathonProject(base, contract, 42);
      const compiled = compileOverflightHuntProject(next);
      assert.equal(compiled.battlefield.id, sequence[contract - 1]);
      const terrain = createOverflightTerrain(compiled.terrain, compiled.arena);
      assert.equal(terrain.strikes, 0);
      assert.ok(terrain.obstacles.every((o) => o.active && (!o.breakable || o.hp === 2)));
      for (const encounter of compiled.encounters)
        for (const wing of encounter.packs.filter((p) => p.escortOf)) {
          const target = encounter.objectives.find((o) => o.id === wing.escortOf);
          for (const [i, p] of wing.route.entries()) {
            assert.ok(Math.abs(p.x - target.route[i].x - wing.x + target.x) < 1e-7);
            assert.ok(Math.abs(p.y - target.route[i].y - wing.y + target.y) < 1e-7);
          }
        }
    }
    assert.equal(JSON.stringify(base), original);
  }
});

test('layout changes preserve explicit options and same-layout application is idempotent', () => {
  for (const [create, compile] of modes) {
    const source = create({
      rulesVersion: 4,
      layout: 'field-crossing-broken-crossroads',
      difficulty: 'veteran',
      seed: 42,
    });
    assert.deepEqual(applyOverflightBattlefield(source, source.battlefield.id), source);
    const changed = applyOverflightBattlefield(source, 'freight-depot-loading-loop');
    changed.presentation = createOverflightWorldPresentation(
      changed.battlefield.world,
      changed.arena,
      { layout: changed.battlefield },
    );
    assert.equal(changed.seed, 42);
    assert.equal(changed.difficulty, 'veteran');
    assert.deepEqual(changed.upgrades, source.upgrades);
    assert.notEqual(compile(changed).projectIdentity, compile(source).projectIdentity);
    const visual = structuredClone(changed);
    visual.presentation.regions[0].material = 'timber';
    assert.equal(compile(visual).projectIdentity, compile(changed).projectIdentity);
  }
});

test('mismatched snapshot, cover art, invalid profiles and buried Raid targets are rejected', () => {
  let project = createOverflightProject({ rulesVersion: 4, layout: 'freight-depot-loading-loop' });
  project.terrain.obstacles[0].width -= 20;
  assert.throws(() => compileOverflightProject(project), /snapshot/);
  project = createOverflightProject({ rulesVersion: 4 });
  project.encounters[0].movement.coordinatedFraction = 1;
  assert.throws(() => compileOverflightProject(project), /coordinatedFraction/);
  const raid = createOverflightHuntProject({
    rulesVersion: 4,
    layout: 'freight-depot-loading-loop',
  });
  raid.encounters[1].objectives[0].x = 1400;
  raid.encounters[1].objectives[0].y = 500;
  assert.throws(() => compileOverflightHuntProject(raid));
});

test('bounded navigation goes around cover and barrier destruction invalidates cached paths', () => {
  const layout = createOverflightBattlefield('freight-depot-loading-loop');
  const terrain = createOverflightTerrain(layout.terrain, layout.arena);
  const actor = { x: 800, y: 540, radius: 28 },
    target = { x: 2000, y: 540 };
  const next = overflightTerrainWaypoint(terrain, actor, target, layout.arena);
  assert.notDeepEqual(next, target);
  assert.ok(overflightTerrainClear(terrain, actor.x, actor.y, next.x, next.y, 29));
  const breach = createOverflightBattlefield('freight-depot-dispatch-junction');
  const state = createOverflightTerrain(breach.terrain, breach.arena),
    barrier = state.obstacles.find((o) => o.breakable);
  state.fields.set('old', [1]);
  state.graphs.set(28, {});
  const x = barrier.x + barrier.width / 2,
    y = barrier.y + barrier.height / 2;
  assert.equal(damageOverflightTerrain(state, x, y, 100, 'first'), 1);
  assert.equal(damageOverflightTerrain(state, x, y, 100, 'first'), 0);
  assert.equal(damageOverflightTerrain(state, x, y, 100, 'second'), 1);
  assert.equal(barrier.active, false);
  assert.equal(state.fields.size, 0);
  assert.equal(state.graphs.size, 0);
  assert.equal(state.strikes, 2);
});
