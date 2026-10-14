import test from 'node:test';
import assert from 'node:assert/strict';
import { OVERFLIGHT_BATTLEFIELDS } from '../overflight/battlefields.mjs';
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
  createOverflightPackage,
  exportOverflightPackage,
  importOverflightPackage,
  createOverflightLibrary,
} from '../overflight/community.mjs';
import {
  createOverflightRiyPackage,
  exportOverflightRiyPackage,
  importOverflightRiyPackage,
  createOverflightRiyLibrary,
} from '../overflight/riy-community.mjs';
import {
  createOverflightHuntPackage,
  exportOverflightHuntPackage,
  importOverflightHuntPackage,
  createOverflightHuntLibrary,
} from '../overflight/raid-community.mjs';
import { inspectCommunityPackage } from '../community/package-family.mjs';
import { createOverflightRun, startOverflight, stepOverflight } from '../overflight/core.mjs';
import { createOverflightRiy, stepOverflightRiy } from '../overflight/riy-core.mjs';
import { OVERFLIGHT_HUNT_MODE } from '../overflight/raid-mode.mjs';
import { raidStudioPreviewMode, raidStudioRuntimePath } from '../studio/raid-preview-mode.mjs';
import {
  createOverflightRaidVariant,
  overflightMarathonSequence,
} from '../overflight/raid-variants.mjs';
import { managedIndexedDB } from './helpers/managed-idb.mjs';

const families = [
  {
    id: 'overflight',
    create: createOverflightProject,
    compile: compileOverflightProject,
    pack: createOverflightPackage,
    export: exportOverflightPackage,
    import: importOverflightPackage,
    library: createOverflightLibrary,
  },
  {
    id: 'overflight-riy',
    create: createOverflightRiyProject,
    compile: compileOverflightRiyProject,
    pack: createOverflightRiyPackage,
    export: exportOverflightRiyPackage,
    import: importOverflightRiyPackage,
    library: createOverflightRiyLibrary,
  },
  {
    id: 'overflight-hunt',
    create: createOverflightHuntProject,
    compile: compileOverflightHuntProject,
    pack: createOverflightHuntPackage,
    export: exportOverflightHuntPackage,
    import: importOverflightHuntPackage,
    library: createOverflightHuntLibrary,
  },
];

for (const family of families)
  test(`${family.id}: all 18 authored maps retain compiled rules through export and fresh native profile import`, async () => {
    for (const layout of OVERFLIGHT_BATTLEFIELDS) {
      const source = family.create({ rulesVersion: 4, layout: layout.id, seed: 42 });
      const preview = family.compile(source);
      const file = family.export(family.pack(source));
      const admitted = await inspectCommunityPackage(file);
      assert.equal(admitted.family, family.id);
      const pack = await family.import(file);
      // Each map receives an empty local profile; no cached authored data or network is needed.
      const library = family.library({ indexedDB: managedIndexedDB().indexedDB });
      try {
        assert.equal((await library.list()).length, 0);
        const identity = await library.install(pack);
        assert.equal(identity, admitted.runtimeIdentity);
        const loaded = await library.load(identity);
        const native = family.compile(loaded.project);
        assert.deepEqual(native, preview);
        assert.equal(native.battlefield.id, layout.id);
        assert.equal(native.rulesVersion, 4);
        assert.deepEqual(native.presentation.paths, preview.presentation.paths);
        assert.deepEqual(native.terrain, preview.battlefield.terrain);
        assert.equal(await family.export(loaded).text(), await file.text());
        if (family.id === 'overflight-hunt') {
          for (const operation of ['overflight-hunt', 'time-attack', 'marathon']) {
            const mode = raidStudioPreviewMode(operation);
            const definition = mode.compileProject(loaded.project);
            assert.deepEqual(definition, native);
            const run = mode.createRun(definition, { airframes: 3, slowResume: false });
            assert.equal(mode.start(run), true);
            for (let frame = 0; frame < 60; frame++) mode.step(run, { x: 1, y: 0 });
            assert.equal(run.phase, 'playing');
            assert.equal(run.compiled.battlefield.id, layout.id);
            const path = raidStudioRuntimePath(operation, { community: identity });
            assert.ok(path.includes(`community=${identity}`));
            if (operation !== 'overflight-hunt') assert.ok(path.includes(`operation=${operation}`));
          }
        } else {
          const run = createOverflightRun(native);
          if (family.id === 'overflight-riy') run.riy = createOverflightRiy(run);
          assert.equal(startOverflight(run), true);
          for (let frame = 0; frame < 60; frame++) {
            stepOverflight(run, { x: 1, y: 0 });
            if (family.id === 'overflight-riy') stepOverflightRiy(run);
          }
          assert.equal(run.phase, 'playing');
          if (family.id === 'overflight-riy') assert.equal(run.riy.version, 2);
        }
      } finally {
        library.dispose();
      }
    }
  });

test('V4 Marathon rotates all five layouts with carried resources, fresh terrain and a reproducible retry', () => {
  const mode = createOverflightRaidVariant(OVERFLIGHT_HUNT_MODE, { variant: 'marathon' });
  for (const layout of OVERFLIGHT_BATTLEFIELDS) {
    const source = createOverflightHuntProject({ rulesVersion: 4, layout: layout.id, seed: 42 });
    const compiled = mode.compileProject(source);
    const initial = mode.createRun(compiled, { airframes: 3, slowResume: false });
    const run = mode.createRun(compiled, { airframes: 3, slowResume: false });
    const sequence = overflightMarathonSequence(source);
    run.player.hull = 37;
    run.player.shield = 1;
    run.airframesRemaining = 2;
    run.build.hunt['boost-duration'] = 2;
    run.progression.rerolls = 1;
    run.progression.history.push({ id: 'boost-duration:2', time: 3, tick: 180 });
    for (let contract = 1; contract <= 5; contract++) {
      assert.equal(run.raidVariant.contract, contract);
      assert.equal(run.compiled.battlefield.id, sequence[contract - 1]);
      assert.equal(run.player.hull, 37);
      assert.equal(run.player.shield, 1);
      assert.equal(run.airframesRemaining, 2);
      assert.equal(run.progression.rerolls, 1);
      assert.equal(run.build.hunt['boost-duration'], 2);
      assert.equal(run.progression.history[0].id, 'boost-duration:2');
      assert.ok(run.terrain.obstacles.every((o) => o.active !== false));
      assert.ok(run.terrain.obstacles.filter((o) => o.breakable).every((o) => o.hp === 2));
      // Transaction fixture only: settlement and lifecycle are separate from pilot completion evidence.
      for (const barrier of run.terrain.obstacles.filter((o) => o.breakable)) {
        barrier.active = false;
        barrier.hp = 0;
      }
      run.phase = 'won';
      run.time = 30;
      run.hunt.score = 1000;
      const priorTerrain = run.terrain;
      assert.equal(mode.continueContract(run), contract < 5);
      if (contract < 5) assert.notEqual(run.terrain, priorTerrain);
    }
    assert.equal(run.raidVariant.status, 'banked');
    const retry = mode.createRun(mode.compileProject(run.raidVariant.source), {
      ...run.raidVariant.options,
      seed: run.raidVariant.seed,
    });
    assert.equal(retry.seed, initial.seed);
    assert.equal(retry.raidVariant.contract, 1);
    assert.equal(retry.raidVariant.escrow, 0);
    assert.equal(retry.player.hull, 100);
    assert.deepEqual(retry.compiled, initial.compiled);
    assert.deepEqual(retry.build, initial.build);
    assert.deepEqual(retry.terrain.obstacles, initial.terrain.obstacles);
    assert.deepEqual(
      source,
      createOverflightHuntProject({ rulesVersion: 4, layout: layout.id, seed: 42 }),
    );
  }
});
