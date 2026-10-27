import RAPIER from '../../../optional-practice/civilian-fpv/vendor/rapier/rapier.mjs';
import { runAircraftRepresentativeProfile } from './fpv-aircraft-profile.mjs';
import {
  contactTapeBodyState,
  contactTapeContactState,
  contactTapeMethods,
} from './fpv-contact-tape.mjs';

/** Test-only interception. Forward receiver/arguments/result/errors unchanged.
 * Retain one checkpoint and per-step digests, never a snapshot array. */
export async function captureContactTape({ sha256 }) {
  const baseline = await runAircraftRepresentativeProfile({ scenario: 'cetus-floor' });
  if (baseline.finalHash !== '44a47ba9') throw new Error('Original Cetus fixture identity changed');
  const tape = {
    format: 'RapierContactForceTape.v1',
    version: RAPIER.version(),
    scenario: 'cetus-floor',
    afterSubstep: 500,
    steps: [],
  };
  const restores = [];
  let world,
    body,
    substep = 0,
    pending = [];
  for (const method of contactTapeMethods) {
    const original = RAPIER.RigidBody.prototype[method];
    RAPIER.RigidBody.prototype[method] = function (...args) {
      if (substep >= tape.afterSubstep) {
        if (this !== body) throw new Error('Unexpected force recipient');
        pending.push({ bodyHandle: this.handle, method, args: structuredClone(args) });
      }
      return Reflect.apply(original, this, args);
    };
    restores.push(() => {
      RAPIER.RigidBody.prototype[method] = original;
    });
  }
  const originalStep = RAPIER.World.prototype.step;
  RAPIER.World.prototype.step = function (...args) {
    if (!world) {
      world = this;
      this.forEachRigidBody((candidate) => {
        if (body) throw new Error('Expected exactly one body');
        body = candidate;
      });
      tape.bodyHandle = body.handle;
    }
    if (this !== world || args.length) throw new Error('Unexpected world or step hooks');
    const result = Reflect.apply(originalStep, this, args);
    substep++;
    if (substep === tape.afterSubstep) {
      const bytes = this.takeSnapshot();
      tape.snapshot = btoa(String.fromCharCode(...bytes));
      tape.initialWorldSha256 = sha256(bytes);
      tape.initialBody = contactTapeBodyState(body);
      tape.initialContact = contactTapeContactState(this);
      tape.integration = Object.fromEntries(
        [
          'dt',
          'lengthUnit',
          'contact_erp',
          'normalizedAllowedLinearError',
          'normalizedPredictionDistance',
          'numSolverIterations',
          'numInternalPgsIterations',
          'maxCcdSubsteps',
        ].map((key) => [key, this.integrationParameters[key]]),
      );
      if (tape.initialContact.bodies !== 1 || tape.initialContact.colliders !== 11)
        throw new Error('Original contact workload changed');
    } else if (substep > tape.afterSubstep) {
      tape.steps.push({
        substep,
        operations: pending,
        worldSha256: sha256(this.takeSnapshot()),
        body: contactTapeBodyState(body),
      });
      pending = [];
    }
    return result;
  };
  restores.push(() => {
    RAPIER.World.prototype.step = originalStep;
  });
  let observed;
  try {
    observed = await runAircraftRepresentativeProfile({ scenario: 'cetus-floor' });
  } finally {
    restores.reverse().forEach((restore) => restore());
  }
  if (
    observed.finalHash !== baseline.finalHash ||
    JSON.stringify(observed.finalTelemetry) !== JSON.stringify(baseline.finalTelemetry)
  )
    throw new Error('Capture changed original simulator state');
  if (substep !== 1500 || pending.length) throw new Error('Incomplete force capture');
  return { tape, finalSimulatorHash: observed.finalHash, finalTelemetry: observed.finalTelemetry };
}
