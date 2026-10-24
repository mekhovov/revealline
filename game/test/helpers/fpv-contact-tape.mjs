import RAPIER from '../../../optional-practice/civilian-fpv/vendor/rapier/rapier.mjs';

const methods = ['resetForces', 'resetTorques', 'addForce', 'addTorque'];
const vector = (value) => ['x', 'y', 'z'].every((key) => Number.isFinite(value?.[key]));
const required = (condition, message) => {
  if (!condition) throw new Error(message);
};
export const contactTapeMethods = Object.freeze(methods);

/** Diagnostic observations only; values are neither rounded nor applied to the body. */
export function contactTapeBodyState(body) {
  return {
    position: body.translation(),
    rotation: body.rotation(),
    velocity: body.linvel(),
    angularVelocity: body.angvel(),
    sleeping: body.isSleeping(),
    enabled: body.isEnabled(),
  };
}

export function contactTapeContactState(world) {
  const pairs = new Set(),
    result = { bodies: 0, colliders: 0, activeBodies: 0, pairs: 0, manifolds: 0, contacts: 0 };
  world.forEachRigidBody(() => result.bodies++);
  world.forEachActiveRigidBody(() => result.activeBodies++);
  world.forEachCollider((collider) => {
    result.colliders++;
    world.contactPairsWith(collider, (peer) => {
      const key = [collider.handle, peer.handle].sort((a, b) => a - b).join(':');
      if (pairs.has(key)) return;
      pairs.add(key);
      result.pairs++;
      world.contactPair(collider, peer, (manifold) => {
        result.manifolds++;
        result.contacts += manifold.numContacts();
      });
    });
  });
  return result;
}

export function validateContactTape(tape) {
  required(tape?.format === 'RapierContactForceTape.v1', 'Unsupported contact tape');
  required(tape.version === '0.21.0', 'Contact tape requires pinned Rapier 0.21.0');
  required(tape.afterSubstep === 500 && tape.steps?.length === 1000, 'Unexpected contact interval');
  required(Number.isFinite(tape.bodyHandle), 'Invalid body handle');
  required(
    typeof tape.snapshot === 'string' && tape.snapshot.length <= 256000,
    'Invalid checkpoint size',
  );
  const digest = (value) => /^[a-f0-9]{64}$/.test(value);
  required(digest(tape.initialWorldSha256), 'Missing initial world digest');
  for (const [index, step] of tape.steps.entries()) {
    required(step.substep === 501 + index, 'Nonsequential contact tape');
    required(digest(step.worldSha256), 'Missing step world digest');
    required(step.operations?.length === 4, 'Unexpected body operations');
    for (const [i, operation] of step.operations.entries()) {
      required(operation.method === methods[i], 'Unexpected body operation order');
      required(operation.bodyHandle === tape.bodyHandle, 'Body handle changed');
      const args = operation.args;
      required(Array.isArray(args), 'Missing body operation arguments');
      required(
        i < 2
          ? args.length === 1 && typeof args[0] === 'boolean'
          : args.length === 2 && vector(args[0]) && typeof args[1] === 'boolean',
        'Invalid body operation arguments',
      );
    }
  }
  return tape;
}

export async function contactTapeSha256(bytes) {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, '0')).join('');
}

/** Pure Rapier diagnostic: a frozen force tape, not a flight/controller simulation.
 * Hashes, snapshots, force calls and contact inspection are outside World.step timers. */
export async function replayContactTape(tape, { sha256 = contactTapeSha256 } = {}) {
  validateContactTape(tape);
  await RAPIER.init();
  required(RAPIER.version() === tape.version, 'Pinned Rapier version changed');
  const snapshot = Uint8Array.from(atob(tape.snapshot), (character) => character.charCodeAt(0));
  required((await sha256(snapshot)) === tape.initialWorldSha256, 'Checkpoint bytes changed');
  const world = RAPIER.World.restoreSnapshot(snapshot),
    body = world.getRigidBody(tape.bodyHandle),
    bins = [];
  let completedSteps = 0,
    firstMismatch = null;
  try {
    required(body && world.timestep === Math.fround(0.001), 'Unexpected restored world');
    required(world.profilerEnabled === false, 'Contact diagnostic requires profiler disabled');
    const initialContact = contactTapeContactState(world),
      initialWorldSha256 = await sha256(world.takeSnapshot());
    required(initialWorldSha256 === tape.initialWorldSha256, 'Restored world bytes differ');
    required(
      JSON.stringify(contactTapeBodyState(body)) === JSON.stringify(tape.initialBody),
      'Restored body state differs',
    );
    required(
      JSON.stringify(initialContact) === JSON.stringify(tape.initialContact),
      'Restored contact state differs',
    );
    for (const step of tape.steps) {
      for (const operation of step.operations)
        Reflect.apply(body[operation.method], body, operation.args);
      const before = performance.now();
      world.step();
      const elapsedMs = performance.now() - before,
        bin = (bins[Math.floor(completedSteps / 100)] ??= {
          fromSubstep: step.substep,
          steps: 0,
          worldStepMs: 0,
        });
      bin.steps++;
      bin.worldStepMs += elapsedMs;
      completedSteps++;
      const observedWorldSha256 = await sha256(world.takeSnapshot()),
        observedBody = contactTapeBodyState(body);
      if (
        observedWorldSha256 !== step.worldSha256 ||
        JSON.stringify(observedBody) !== JSON.stringify(step.body)
      ) {
        firstMismatch = {
          substep: step.substep,
          expectedWorldSha256: step.worldSha256,
          observedWorldSha256,
          expectedBody: step.body,
          observedBody,
        };
        break;
      }
    }
    return {
      matched: firstMismatch === null && completedSteps === tape.steps.length,
      completedSteps,
      firstMismatch,
      profilerEnabled: world.profilerEnabled,
      bins,
      worldStepMs: bins.reduce((sum, bin) => sum + bin.worldStepMs, 0),
      finalWorldSha256: await sha256(world.takeSnapshot()),
      finalBody: contactTapeBodyState(body),
      initialContact,
      finalContact: contactTapeContactState(world),
    };
  } finally {
    world.free();
  }
}
