import test from 'node:test';
import assert from 'node:assert/strict';
import { createStarterProject } from '../content-design/starter.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import {
  SENTINEL_ACTOR_CATALOG,
  SENTINEL_RECIPE,
  LIVEWIRE_ACTOR_CATALOG,
  compileActor,
} from '../content-design/catalogs.mjs';
import { inspectCaptureSnapshot } from '../core/capture-regions.mjs';
import { createRun } from '../core/index.mjs';

import { sentinelProjectFixture as source } from './helpers/sentinel-project.mjs';
const resolve = (source, options) =>
  resolveMission(compileContentProject(source), 'nearby-shore', options);

test('Sentinel catalog adds one explicit role without changing old missions or physics', () => {
  for (const [id, role] of Object.entries(LIVEWIRE_ACTOR_CATALOG.roles))
    assert.equal(SENTINEL_ACTOR_CATALOG.roles[id], role);
  const old = createStarterProject();
  old.actorCatalogId = LIVEWIRE_ACTOR_CATALOG.id;
  const next = structuredClone(old);
  next.actorCatalogId = SENTINEL_ACTOR_CATALOG.id;
  for (const difficulty of ['gentle', 'standard', 'expert']) {
    assert.deepEqual(resolve(next, { difficulty }).level, resolve(old, { difficulty }).level);
    assert.equal(
      resolve(next, { difficulty }).simulationIdentity,
      resolve(old, { difficulty }).simulationIdentity,
    );
  }
  assert.throws(
    () => compileActor(source().missions[0].actors[0], 'standard', LIVEWIRE_ACTOR_CATALOG.id),
    /Unsupported actor role/,
  );
});

test('shared compiler resolves equal Solo/Versus encounters with fixed warnings in every preset', () => {
  const project = source(),
    before = structuredClone(project);
  for (const difficulty of ['gentle', 'standard', 'expert']) {
    const solo = resolve(project, { difficulty });
    assert.equal(solo.format, 'ResolvedMissionV4');
    assert.equal(solo.level.version, 'xonix-level.v8');
    assert.equal(solo.level.rules.moveSpeed, 10);
    assert.equal(solo.level.rules.lives, { gentle: 5, standard: 3, expert: 2 }[difficulty]);
    assert.deepEqual(resolve(project, { difficulty, mode: 'versus' }).level, solo.level);
    assert.deepEqual(solo.level.encounter, {
      ...SENTINEL_RECIPE.definition,
      enemyId: 'sentinel',
      shieldObjectiveIds: ['west', 'east'],
      coreObjectiveId: 'core',
    });
    assert.deepEqual(
      inspectCaptureSnapshot(createRun(solo.level)).components.flatMap((c) => c.enemyIds),
      ['sentinel'],
    );
    assert.equal(solo.officialProgressEligible, false);
  }
  assert.deepEqual(project, before);
  const changed = structuredClone(project);
  changed.missions[0].encounter.shieldObjectiveIds = ['west'];
  assert.notEqual(resolve(changed).simulationIdentity, resolve(project).simulationIdentity);
});

test('authoring rejects per-level boss physics, malformed links, older formats and unqualified Team', () => {
  for (const change of [
    (p) => {
      delete p.missions[0].encounter;
    },
    (p) => {
      p.missions[0].encounter.initialDelayTicks = 1;
    },
    (p) => {
      p.missions[0].encounter.minReleaseCutCells = 1;
    },
    (p) => {
      p.missions[0].encounter.recipeId = 'fast';
    },
    (p) => {
      p.missions[0].encounter.enemyId = 'other';
    },
    (p) => {
      p.missions[0].encounter.shieldObjectiveIds.push('missing');
    },
    (p) => {
      p.missions[0].actors[0].tier = 'brisk';
    },
    (p) => {
      p.missions[0].actors[0].speed = 99;
    },
    (p) => {
      p.missions[0].actors[0].heading = [1, 0];
    },
    (p) => {
      p.missions[0].format = 'MissionDesignV3';
    },
    (p) => {
      p.missions[0].encounter = null;
    },
    (p) => {
      p.actorCatalogId = LIVEWIRE_ACTOR_CATALOG.id;
    },
    (p) => {
      p.maps[0].format = 'MapDesignV2';
      delete p.maps[0].speedZones;
    },
    (p) => {
      p.missions[0].modes.push('team');
      p.missions[0].team = {};
    },
  ]) {
    const candidate = source();
    change(candidate);
    assert.throws(() => compileContentProject(candidate), undefined, change.toString());
  }
});

test('encounter may be explicitly absent for non-boss missions in the new campaign edition', () => {
  const project = source();
  project.missions[0].encounter = null;
  project.missions[0].actors = [
    { id: 'keeper', role: 'field-keeper', tier: 'measured', x: 54.5, y: 18.5, heading: [1, 0] },
  ];
  const result = resolve(project);
  assert.equal(result.level.version, 'xonix-level.v8');
  assert.equal(result.level.encounter, null);
});
