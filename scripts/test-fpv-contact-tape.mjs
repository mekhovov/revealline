import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import RAPIER from '../optional-practice/civilian-fpv/vendor/rapier/rapier.mjs';
import { captureContactTape } from '../game/test/helpers/fpv-contact-tape-capture.mjs';
import { replayContactTape, validateContactTape } from '../game/test/helpers/fpv-contact-tape.mjs';

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
test('contact-only replay retains the complete frozen source interval and fails on changed inputs', async (t) => {
  const Worker = globalThis.Worker;
  // The shared representative helper declares a worker class for its other scenario.
  globalThis.Worker = class {
    constructor() {
      throw new Error('Contact fixture must not construct a worker');
    }
  };
  t.after(() => {
    if (Worker === undefined) delete globalThis.Worker;
    else globalThis.Worker = Worker;
  });
  const step = RAPIER.World.prototype.step,
    addForce = RAPIER.RigidBody.prototype.addForce,
    captured = await captureContactTape({ sha256 }),
    tape = captured.tape;
  assert.equal(captured.finalSimulatorHash, '44a47ba9');
  assert.equal(RAPIER.World.prototype.step, step);
  assert.equal(RAPIER.RigidBody.prototype.addForce, addForce);
  assert.equal(tape.steps.length, 1000);
  assert.deepEqual(tape.initialContact, {
    bodies: 1,
    colliders: 11,
    activeBodies: 1,
    pairs: 5,
    manifolds: 10,
    contacts: 40,
  });
  const first = await replayContactTape(tape, { sha256 }),
    second = await replayContactTape(tape, { sha256 });
  for (const result of [first, second]) {
    assert.equal(result.matched, true);
    assert.equal(result.completedSteps, 1000);
    assert.equal(result.firstMismatch, null);
    assert.deepEqual(result.finalBody, tape.steps.at(-1).body);
    assert.equal(result.finalWorldSha256, tape.steps.at(-1).worldSha256);
  }
  await t.test('an unrecorded force change fails at its exact substep', async () => {
    const changed = structuredClone(tape);
    changed.steps[12].operations[2].args[0].y += 1;
    const result = await replayContactTape(changed, { sha256 });
    assert.equal(result.matched, false);
    assert.equal(result.completedSteps, 13);
    assert.equal(result.firstMismatch.substep, 513);
  });
  await t.test('missing, reordered and malformed operations are rejected', () => {
    for (const alter of [
      (value) => value.steps.pop(),
      (value) => value.steps[0].operations.reverse(),
      (value) => (value.steps[0].operations[0].args[0] = 1),
      (value) => (value.steps[0].operations[3].args[0].x = Infinity),
      (value) => value.steps[0].operations[3].bodyHandle++,
    ]) {
      const changed = structuredClone(tape);
      alter(changed);
      assert.throws(() => validateContactTape(changed));
    }
  });
  await t.test(
    'altered checkpoint and claimed contact state are rejected before stepping',
    async () => {
      await assert.rejects(
        replayContactTape({ ...tape, initialWorldSha256: '0'.repeat(64) }, { sha256 }),
        /Checkpoint bytes changed/,
      );
      await assert.rejects(
        replayContactTape({ ...tape, initialContact: {} }, { sha256 }),
        /Restored contact state differs/,
      );
    },
  );
  await t.test('capture failure restores every intercepted method', async () => {
    await assert.rejects(
      captureContactTape({
        sha256() {
          throw new Error('Synthetic digest failure');
        },
      }),
      /Synthetic digest failure/,
    );
    assert.equal(RAPIER.World.prototype.step, step);
    assert.equal(RAPIER.RigidBody.prototype.addForce, addForce);
  });
});
