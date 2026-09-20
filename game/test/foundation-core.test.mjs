import test from 'node:test';
import assert from 'node:assert/strict';
import { createRun, stepRun, validateLevel, CELL, FIXED_DT } from '../core/index.mjs';
import {
  classicErosionReason,
  commitClassicErosion,
  updateClassicAnchors,
} from '../core/classic-topology.mjs';
import {
  authoritativeCheckpoint,
  createRecorder,
  recordInput,
  exportReplay,
  verifyReplay,
} from '../replay.mjs';

const level = (changes = {}) => ({
  version: 'xonix-level.v5',
  id: 'nearby-shore',
  revision: '1',
  name: 'Nearby shore',
  width: 72,
  height: 36,
  spawn: { x: 32.5, y: 17.5 },
  foundations: [{ x: 30, y: 15, w: 5, h: 5 }],
  walls: [],
  goal: { coverage: 0.99 },
  encounter: null,
  classic: { version: 'classic.v1', terrain: [], powerups: [] },
  enemies: [{ id: 'keeper', type: 'bouncer', x: 60.5, y: 18.5, vx: 0, vy: 0 }],
  objectives: [],
  supplies: [],
  rules: { lives: 3, moveSpeed: 10, stopOnCapture: true },
  ...changes,
});

test('foundations use an explicit new runtime with interior spawn and zero earned coverage', () => {
  const source = level(),
    run = createRun(source);
  assert.equal(run.ruleset, 'xonix-core.v6');
  assert.equal(run.totalClaimable, 70 * 34 - 25);
  assert.equal(run.coverage, 0);
  assert.equal(run.claimedCount, 0);
  assert.equal(run.score, 0);
  assert.equal(run.cells[17 * 72 + 32], CELL.SAFE);
  assert.equal(run.classic.eligible[17 * 72 + 32], 0);
  assert.equal(classicErosionReason(run, 17 * 72 + 32), 'foundation');
  assert.equal(validateLevel({ ...source, version: 'xonix-level.v4' }).valid, false);
  const legacy = level({ version: 'xonix-level.v4', spawn: { x: 32.5, y: 0.5 } });
  delete legacy.foundations;
  assert.equal(createRun(legacy).ruleset, 'xonix-core.v5');
  assert.equal(createRun(legacy).totalClaimable, 70 * 34);
});

test('a legal departure from an island closes on the perimeter and only scores eligible cells', () => {
  const run = createRun(level());
  for (let n = 0; n < 500 && !run.claimedCount; n++) stepRun(run, { direction: 'down' }, FIXED_DT);
  assert.equal(run.status, 'running');
  assert.equal(run.claimedCount, 15);
  assert.equal(run.coverage, 15 / (70 * 34 - 25));
  assert.equal(run.player.speed, 0);
  assert.equal(run.classic.uniqueClaimedCount, 15);
  assert.equal(run.cells[17 * 72 + 32], CELL.SAFE);
});

test('a legal cut may return to an island without making that island score-bearing', () => {
  const run = createRun(level({ spawn: { x: 32.5, y: 0.5 } }));
  for (let n = 0; n < 500 && !run.claimedCount; n++) stepRun(run, { direction: 'down' }, FIXED_DT);
  assert.equal(run.claimedCount, 14);
  assert.equal(run.totalClaimable, 70 * 34 - 25);
  assert.equal(run.classic.everClaimed[15 * 72 + 32], 0);
});

test('new actor validation distinguishes field seeds, objective ground and island contours', () => {
  assert.equal(
    validateLevel(
      level({ enemies: [{ id: 'bad', type: 'bouncer', x: 32.5, y: 17.5, vx: 1, vy: 0 }] }),
    ).valid,
    false,
  );
  assert.equal(
    validateLevel(level({ objectives: [{ id: 'bad', x: 32.5, y: 17.5, required: true }] })).valid,
    false,
  );
  const run = createRun(
    level({
      enemies: [
        ...level().enemies,
        {
          id: 'frontier',
          type: 'contour-patrol',
          edge: { x: 29, y: 17, side: 'east' },
          clockwise: true,
          speed: 2,
        },
      ],
    }),
  );
  assert.equal(run.enemies[1].classic.mode, 'patrolling');
  assert(Number.isFinite(run.enemies[1].x));
  assert.equal(
    validateLevel(
      level({
        enemies: [
          {
            id: 'invalid',
            type: 'contour-patrol',
            edge: { x: 20, y: 20, side: 'east' },
            clockwise: true,
            speed: 2,
          },
        ],
      }),
    ).valid,
    false,
  );
});

test('interior spawn clearance covers field, reclaimed-ground and frontier threats', () => {
  for (const enemy of [
    { id: 'near', type: 'bouncer', x: 29.5, y: 17.5, vx: 1, vy: 0 },
    { id: 'near', type: 'claimed-rover', x: 31.5, y: 17.5, vx: 1, vy: 0 },
    {
      id: 'near',
      type: 'contour-patrol',
      edge: { x: 29, y: 17, side: 'east' },
      clockwise: true,
      speed: 2,
    },
  ]) {
    const result = validateLevel(level({ spawn: { x: 30.5, y: 17.5 }, enemies: [enemy] }));
    assert.equal(result.valid, false);
    assert.match(result.errors.join(' '), /spawn clearance/);
  }
});

test('erosion cannot reopen a foundation and objective anchors can terminate on an island', () => {
  const run = createRun(
    level({
      enemies: [{ id: 'eroder', type: 'eroder', x: 29.5, y: 17.5, vx: 0, vy: 0 }],
      objectives: [{ id: 'relay', x: 29.5, y: 18.5, required: true }],
    }),
  );
  const index = 17 * 72 + 30,
    enemy = run.enemies[0];
  enemy.classic.target = index;
  enemy.classic.erosionAt = 0;
  assert.equal(commitClassicErosion(run), 0);
  assert.equal(run.cells[index], CELL.SAFE);
  assert(
    run.events.some((event) => event.type === 'erosion.blocked' && event.reason === 'foundation'),
  );
  const objective = run.objectives[0];
  objective.captured = true;
  run.cells[18 * 72 + 29] = CELL.SAFE;
  updateClassicAnchors(run);
  const anchor = run.classic.anchors.find((a) => a.id === 'relay');
  assert.deepEqual(anchor.path, [18 * 72 + 29, 18 * 72 + 30]);
});

test('foundation state has its own replay tuple and authoritative checkpoint section', () => {
  const source = level(),
    run = createRun(source),
    recorder = createRecorder(source);
  for (let n = 0; n < 20; n++) {
    recordInput(recorder, { direction: 'down' });
    stepRun(run, { direction: 'down' }, FIXED_DT);
  }
  const replay = exportReplay(recorder, run);
  assert.equal(replay.version, 'xonix-replay.v7');
  assert.equal(replay.checkpoint.algorithm, 'fnv1a64-state-v6');
  assert.equal(verifyReplay(replay).match, true);
  const before = authoritativeCheckpoint(run);
  assert(before.sections.foundations);
  run.foundation.permanent[17 * 72 + 32] = 0;
  assert.notEqual(authoritativeCheckpoint(run).hash, before.hash);
});
