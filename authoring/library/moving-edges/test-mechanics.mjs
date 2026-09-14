import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { verifyMovingEdgesMechanics } from './mechanics.mjs';

const proofURL = new URL('./mechanics-proof.json', import.meta.url);
const ordinarySHA = '19d9be49c5db2b1b5235213896b0f100e6cc48988a00566aea68a65ef7e152a6';
const actorCauses = {
  'terrace-rover': 'enemy-player',
  'wheel-interceptor': 'enemy-trail',
  'wheel-counterclockwise': 'enemy-trail',
  'breakwater-west': 'enemy-trail',
};

// One actual finite replay/session verification; all observations below share it.
test('Moving Edges mechanics reproduce actual losses, counterplay and saved continuations', async (t) => {
  const before = await readFile(proofURL, 'utf8');
  const proof = await verifyMovingEdgesMechanics();
  assert.equal(
    await readFile(proofURL, 'utf8'),
    before,
    'Verification cannot rewrite its authority.',
  );
  assert.equal(proof.ordinaryProofSha256, ordinarySHA);
  assert.equal(proof.ordinaryObservations.length, 24);
  assert.equal(proof.summary.ordinaryContextsReexecuted, 0);
  assert.deepEqual(proof.summary.replayedClasses, ['scout']);
  assert.deepEqual(proof.summary.kinds, {
    'recovered-win': 12,
    'game-over': 12,
    'warning-return': 4,
    'life-win': 4,
    'slow-expiry': 4,
    'actor-loss': 16,
  });
  assert.equal(proof.cases.length, 52);
  assert.equal(new Set(proof.cases.map((row) => row.id)).size, 52);
  for (const row of proof.cases) {
    assert.equal(row.classId, 'scout');
    assert.equal(row.expected.classId, 'scout');
    assert.equal(row.expected.activeClassId, 'scout');
    assert.equal(row.expected.switches, 0);
    assert.equal(row.expected.levelId, row.levelId);
    assert.equal(row.expected.turnPolicy, row.turnPolicy);
  }
  const byKind = (kind) => proof.cases.filter((row) => row.kind === kind);
  const events = (row, type) => row.observations.filter((event) => event.type === type);

  await t.test(
    'each responsible actor is distinguished from self-contact in both policies and difficulties',
    () => {
      const rows = byKind('actor-loss');
      for (const [actorId, cause] of Object.entries(actorCauses)) {
        const owned = rows.filter((row) => events(row, 'player.failed')[0]?.actorId === actorId);
        assert.equal(owned.length, 4, actorId);
        assert.deepEqual(
          new Set(owned.map((row) => `${row.difficulty}/${row.turnPolicy}`)),
          new Set([
            'standard/immediate',
            'standard/grid-center',
            'gentle/immediate',
            'gentle/grid-center',
          ]),
        );
        for (const row of owned) {
          const failures = events(row, 'player.failed');
          assert.equal(failures.length, 1);
          assert.equal(failures[0].cause, cause);
          assert.equal(row.expected.failureCause, cause);
          assert.equal(row.expected.livesLost, 1);
          assert.equal(row.expected.status, 'running');
          assert.equal(events(row, 'player.respawned').length, 1);
          if (actorId === 'terrace-rover') {
            const warning = events(row, 'rover.warning')[0];
            const active = events(row, 'rover.activated')[0];
            assert.equal(active.tick, warning.activationTick);
            assert.equal(active.tick - warning.tick, 120);
            assert.ok(active.tick < failures[0].tick);
          }
          if (actorId === 'wheel-interceptor') {
            const committed = events(row, 'pressure.committed')[0];
            assert.ok(committed && committed.tick < failures[0].tick);
            assert.ok(row.metrics.pressureTicks.cooldown > 0);
          }
        }
      }
    },
  );

  await t.test('loss recovery and terminal exhaustion do not erase the recorded loss', () => {
    for (const row of [...byKind('recovered-win'), ...byKind('game-over')]) {
      const lost = row.kind === 'game-over';
      const losses = lost ? (row.difficulty === 'gentle' ? 5 : 3) : 1;
      assert.equal(row.expected.status, lost ? 'lost' : 'won');
      assert.equal(row.expected.livesLost, losses);
      assert.equal(events(row, 'player.failed').length, losses);
      assert.ok(
        events(row, 'player.failed').every(
          (event) => event.actorId === 'player' && event.cause === 'self-contact',
        ),
      );
      assert.equal(events(row, 'player.respawned').length, lost ? losses - 1 : 1);
      if (lost) assert.equal(row.expected.lives, 0);
      else assert.notEqual(row.expected.medal, 'gold');
    }
  });

  await t.test('the warning return is a short moving escape before commitment', () => {
    for (const row of byKind('warning-return')) {
      const warning = row.warningReturn;
      const cancelled = events(row, 'pressure.cancelled');
      assert.equal(row.expected.livesLost, 0);
      assert.equal(events(row, 'pressure.committed').length, 0);
      assert.equal(cancelled.length, 1);
      assert.equal(cancelled[0].reason, 'trail-closed');
      assert.equal(warning.closed.tick, cancelled[0].tick);
      assert.ok(warning.tick < warning.closed.tick && warning.closed.tick < warning.warningUntil);
      assert.ok(warning.closed.travelledCells > 0 && warning.closed.travelledCells < 20);
      assert.notDeepEqual(warning.closed.player, warning.player);
    }
  });

  await t.test(
    'extra life preserves lost-life history and timed slow expires at the exact boundary',
    () => {
      for (const row of byKind('life-win')) {
        const pickup = events(row, 'powerup.collected');
        assert.equal(pickup.length, 1);
        assert.equal(pickup[0].id, 'terrace-life');
        assert.equal(pickup[0].kind, 'extra-life');
        assert.equal(pickup[0].gain, 1);
        assert.equal(pickup[0].livesLost, 1);
        assert.equal(row.expected.won, true);
        assert.equal(row.expected.livesLost, 1);
        assert.equal(row.expected.lives, row.difficulty === 'gentle' ? 5 : 3);
        assert.notEqual(row.expected.medal, 'gold');
      }
      for (const row of byKind('slow-expiry')) {
        const pickup = events(row, 'powerup.collected').find(
          (event) => event.kind === 'enemy-slow',
        );
        assert.ok(pickup);
        assert.equal(pickup.untilTick - pickup.activationTick, 720);
        const observed = events(row, 'observed.slow-effect');
        assert.deepEqual(
          observed.map((event) => [event.tick, event.active]),
          [
            [pickup.untilTick - 1, true],
            [pickup.untilTick, false],
          ],
        );
        assert.ok(row.saved.some((saved) => saved.label === 'slow-last-active'));
        assert.ok(row.saved.some((saved) => saved.label === 'slow-expiry'));
      }
    },
  );

  await t.test(
    'restored suffixes retain exact owner, continuation and final checkpoint without calling endpoints suffixes',
    () => {
      const all = proof.cases.flatMap((row) => row.saved);
      assert.equal(all.length, 290);
      assert.equal(all.filter((saved) => saved.suffixTicks > 0).length, 274);
      assert.equal(all.filter((saved) => saved.suffixTicks === 0).length, 16);
      for (const row of proof.cases) {
        assert.ok(row.saved.some((saved) => saved.suffixTicks > 0));
        for (const saved of row.saved) {
          assert.equal(saved.exactRestoredSuffix, true);
          assert.equal(saved.tick + saved.suffixTicks, row.expected.tick);
          assert.equal(saved.finalCheckpointSha256, row.checkpointSha256);
          assert.equal(saved.presentationPins.executionKey, row.executionKey);
          assert.equal(saved.presentationPins.levelId, row.levelId);
          assert.equal(saved.presentationPins.levelRevision, row.expected.revision);
          assert.equal(saved.presentationPins.choices[0].story, null);
          assert.ok([null, 'up', 'right', 'down', 'left'].includes(saved.continuation.direction));
          assert.match(saved.sessionSha256, /^[a-f0-9]{64}$/);
          assert.match(saved.checkpointSha256, /^[a-f0-9]{64}$/);
        }
      }
    },
  );
});

test('mechanics candidates refuse malformed ownership and context sets before replay', async () => {
  await assert.rejects(
    verifyMovingEdgesMechanics({ candidate: [] }),
    /Candidate must be an object/,
  );
  await assert.rejects(
    verifyMovingEdgesMechanics({ candidate: {}, record: true }),
    /Explicit candidate cannot record/,
  );
  const original = JSON.parse(await readFile(proofURL, 'utf8'));
  for (const [key, value] of [
    ['format', 'foreign-mechanics-proof'],
    ['ordinaryProofSha256', '0'.repeat(64)],
    ['packSha256', '0'.repeat(64)],
  ]) {
    const candidate = structuredClone(original);
    candidate[key] = value;
    await assert.rejects(
      verifyMovingEdgesMechanics({ candidate }),
      new RegExp(`Exact ${key} required`),
    );
  }
  for (const mutate of [
    (candidate) => candidate.cases.pop(),
    (candidate) => {
      candidate.cases[1].id = candidate.cases[0].id;
    },
    (candidate) => {
      candidate.cases[0].id = 'foreign-owner/standard/immediate';
    },
  ]) {
    const candidate = structuredClone(original);
    mutate(candidate);
    await assert.rejects(
      verifyMovingEdgesMechanics({ candidate }),
      /Exact52 mechanic contexts required/,
    );
  }
});
