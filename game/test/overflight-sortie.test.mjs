import assert from 'node:assert/strict';
import test from 'node:test';
import { overflightSortieProject } from '../overflight/host-loop.mjs';
import { createOverflightProject, compileOverflightProject } from '../overflight/project.mjs';
import {
  createOverflightHuntProject,
  compileOverflightHuntProject,
} from '../overflight/raid-project.mjs';
import { pilot } from '../overflight/review-pilot.mjs';
import { overflightAttackContains } from '../overflight/tactics.mjs';

for (const [name, createProject, compileProject, encounterSets] of [
  ['Survivor', createOverflightProject, compileOverflightProject, ['front', 'crossing', 'mixed']],
  [
    'Raid',
    createOverflightHuntProject,
    compileOverflightHuntProject,
    ['patrol', 'crossing', 'mixed'],
  ],
]) {
  const mode = { createProject, encounterSets };
  test(`${name} new sorties regenerate seeded encounters; same-seed retry preserves identity`, () => {
    for (const encounterSet of encounterSets) {
      const before = createProject({ seed: 17031991, encounterSet });
      const next = overflightSortieProject(mode, before, { seed: 42, difficulty: 'standard' });
      assert.equal(next.seed, 42);
      assert.notDeepEqual(next.encounters, before.encounters);
      assert.deepEqual(
        compileProject(next),
        compileProject(createProject({ seed: 42, encounterSet })),
      );
      assert.equal(overflightSortieProject(mode, next, { seed: 42, difficulty: 'standard' }), next);
      const veteran = overflightSortieProject(mode, next, { seed: 42, difficulty: 'veteran' });
      assert.deepEqual(
        compileProject(veteran),
        compileProject(createProject({ seed: 42, difficulty: 'veteran', encounterSet })),
      );
    }
  });
  test(`${name} authored and legacy layouts survive seed and difficulty changes`, () => {
    const authored = createProject();
    authored.title.en = 'An authored layout with a built-in id';
    const snapshot = structuredClone(authored);
    assert.equal(
      overflightSortieProject(mode, authored, { seed: 42, difficulty: 'veteran', authored: true }),
      authored,
    );
    assert.deepEqual(authored, snapshot);
    const legacy = createProject({ legacy: true });
    assert.equal(
      overflightSortieProject(mode, legacy, { seed: 42, difficulty: 'veteran' }),
      legacy,
    );
    const unknown = { ...authored, id: 'community-custom-layout' };
    assert.equal(
      overflightSortieProject(mode, unknown, { seed: 42, difficulty: 'veteran' }),
      unknown,
    );
  });
}

for (const kind of ['lane', 'fan', 'ground']) {
  test(`review pilot respects visible ${kind} warning geometry without changing gameplay state`, () => {
    const run = {
      time: 0,
      player: { x: 500, y: 500, vx: 180, vy: 0, radius: 9, boostCooldown: 0 },
      compiled: { arena: { width: 2880, height: 1080 } },
      pickups: [{ active: true, x: 750, y: 500, value: 1 }],
      enemies: [],
      priorityAttacks: [
        {
          active: true,
          kind,
          originX: 0,
          originY: 500,
          heading: 0,
          x: kind === 'ground' ? 550 : 900,
          y: 500,
          length: 1000,
          spread: 0.32,
          radius: kind === 'ground' ? 40 : 8,
          remaining: 0.5,
        },
      ],
    };
    const snapshot = structuredClone(run);
    const input = pilot(run);
    assert.deepEqual(run, snapshot);
    assert.ok(Math.hypot(input.x, input.y) <= 1 + 1e-9);
    assert.equal(
      overflightAttackContains(
        run.priorityAttacks[0],
        500 + input.x * 180 * 0.42,
        500 + input.y * 180 * 0.42,
        18,
      ),
      false,
    );
    const unthreatened = pilot({ ...run, priorityAttacks: [] });
    assert.notDeepEqual(input, unthreatened);
  });
}
