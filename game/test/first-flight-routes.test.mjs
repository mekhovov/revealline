import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { CELL } from '../core/index.mjs';
import { createLessonObserver, captureLessonFacts } from '../first-flight.mjs';
import { exportReplay, verifyReplayAsync, authoritativeCheckpoint } from '../replay.mjs';
import {
  createAttempt,
  feedAttempt,
  ordinarySegments,
  segment,
  proveRoute,
} from './first-flight-helpers.mjs';
const proof = JSON.parse(
  await readFile(new URL('fixtures/first-flight-routes.json', import.meta.url), 'utf8'),
);
const sameSet = (actual, expected) =>
  assert.deepEqual(
    [...actual].sort((a, b) => a - b),
    [...expected].sort((a, b) => a - b),
  );
const divider = Array.from({ length: 34 }, (_, i) => (i + 1) * 48 + 24);
const horizontal = (row) => Array.from({ length: 23 }, (_, i) => row * 48 + i + 1);
const rectangle = (row) =>
  Array.from({ length: row * 23 }, (_, i) => (Math.floor(i / 23) + 1) * 48 + (i % 23) + 1);

test('new private lesson oracle has exactly the named routes, separate from historic campaign proofs', () => {
  assert.equal(proof.format, 'first-flight-proofs.v1');
  assert.equal(proof.routes.length, 14);
  assert.equal(new Set(proof.routes.map((r) => r.id)).size, 14);
  // Pin semantic JSON: formatting never changes the replay/observer expectations.
  assert.equal(
    createHash('sha256').update(JSON.stringify(proof)).digest('hex'),
    '3e6ef810876547c96a597a162c48bc14d06cf401ce524a7b765dc1cceebec4ad',
  );
});
for (const route of proof.routes)
  test(`public-input proof preserves exact simulation and lesson result: ${route.id}`, () => {
    const actual = proveRoute(route);
    assert.deepEqual(actual, route.expected);
    assert.equal(actual.summary.ruleset, 'xonix-core.v2');
    assert.equal(actual.setup.seed, 1);
    assert.equal(actual.setup.classId, 'scout');
    if (route.id.includes('-alternate-')) {
      assert.equal(actual.summary.status, 'won');
      assert.equal(actual.lesson.outcome, 'missed');
      assert.ok(actual.lesson.steps.every((s) => s.status === 'pending'));
    } else if (route.id.includes('-outside-band-')) {
      assert.equal(actual.summary.status, 'won');
      assert.equal(actual.lesson.outcome, 'missed');
      assert.deepEqual(
        actual.lesson.steps.map((s) => s.status),
        ['complete', 'pending'],
      );
    } else if (route.id.includes('-loss-')) {
      assert.equal(actual.lesson.outcome, 'lost');
      assert.equal(actual.summary.lives, 0);
      assert.equal(actual.lesson.territoryKept, false);
    } else assert.equal(actual.lesson.outcome, 'complete');
    if (route.id.includes('-recovery-')) {
      assert.equal(actual.summary.lives, 2);
      assert.equal(actual.failures.length, 1);
      assert.equal(actual.failures[0].lesson.steps[0].status, 'complete');
      assert.equal(actual.failures[0].lesson.territoryKept, true);
      assert.equal(actual.recoveries[0].lesson.territoryKept, true);
    }
  });
for (const turnPolicy of ['immediate', 'grid-center'])
  for (let row = 16; row <= 24; row++)
    test(`empty-side exact divider, live line and filled rectangle at row ${row}, ${turnPolicy}`, () => {
      const a = createAttempt('empty-side', turnPolicy);
      let closures = 0;
      feedAttempt(a, ordinarySegments('empty-side', row), {
        onStep(before, after) {
          const closed = after.events.find((e) => e.type === 'cut.closed');
          if (!closed) return;
          const claimed = after.events.find((e) => e.type === 'cells.claimed').indices;
          if (closures++ === 0) {
            sameSet(before.trail, divider);
            sameSet(claimed, divider);
            assert.equal(closed.cells, 34);
            for (const i of divider) {
              assert.equal(before.cells[i], CELL.FIELD);
              assert.equal(after.cells[i], CELL.SAFE);
            }
            for (const enemy of before.enemies)
              assert.equal(
                before.cells[Math.floor(enemy.y) * 48 + Math.floor(enemy.x)],
                CELL.FIELD,
              );
            for (const enemy of after.enemies)
              assert.equal(after.cells[Math.floor(enemy.y) * 48 + Math.floor(enemy.x)], CELL.FIELD);
          } else {
            sameSet(before.trail, horizontal(row));
            sameSet(claimed, rectangle(row));
            assert.equal(
              closed.cells,
              row * 23,
              'closed.cells counts all new territory, not line length',
            );
            for (const i of rectangle(row)) {
              assert.equal(before.cells[i], CELL.FIELD);
              assert.equal(after.cells[i], CELL.SAFE);
            }
            const filled = claimed.filter((i) => !before.trail.includes(i));
            assert.equal(filled.length, (row - 1) * 23);
            assert.equal(before.objectives[0].captured, false);
            assert.equal(after.objectives[0].captured, true);
            assert.equal(after.status, 'won');
          }
        },
      });
      assert.equal(closures, 2);
      assert.equal(a.observer.snapshot().outcome, 'complete');
    });
for (const turnPolicy of ['immediate', 'grid-center'])
  test(`observing and repeated idle sampling preserve exported replay bytes: ${turnPolicy}`, async () => {
    const observed = createAttempt('picture-home', turnPolicy);
    const plain = createAttempt('picture-home', turnPolicy);
    feedAttempt(observed, ordinarySegments('picture-home'));
    feedAttempt(plain, ordinarySegments('picture-home'), { observe: false });
    const before = authoritativeCheckpoint(observed.run);
    const terminal = captureLessonFacts(observed.run, { runId: observed.runId });
    assert.equal(observed.observer.observe(terminal, terminal).outcome, 'complete');
    assert.deepEqual(authoritativeCheckpoint(observed.run), before);
    const replay = exportReplay(observed.recorder, observed.run);
    assert.equal(JSON.stringify(replay), JSON.stringify(exportReplay(plain.recorder, plain.run)));
    assert.equal(replay.version, 'xonix-replay.v3');
    assert.equal((await verifyReplayAsync(replay)).match, true);
    assert.ok(!JSON.stringify(replay).includes('territoryKept'));
    assert.equal(
      createLessonObserver({
        lessonId: 'picture-home',
        runId: 'different',
        initial: plain.initial,
      }).snapshot().available,
      false,
    );
  });
for (const turnPolicy of ['immediate', 'grid-center'])
  test(`a different valid separator and filled rectangle do not count as the taught example: ${turnPolicy}`, () => {
    const a = createAttempt('empty-side', turnPolicy);
    // Both enemies stay FIELD after a real 34-cell divider at x30, not authored x24.
    feedAttempt(a, [segment('right', 72), segment('down', 420)]);
    assert.equal(a.run.claimedCount, 34);
    assert.equal(a.observer.snapshot().steps[0].status, 'current');
    feedAttempt(a, [segment('up', 216), segment('left', 354)]);
    assert.equal(a.run.status, 'won');
    assert.equal(a.observer.snapshot().outcome, 'missed');
    assert.ok(a.observer.snapshot().steps.every((step) => step.status === 'pending'));
  });
