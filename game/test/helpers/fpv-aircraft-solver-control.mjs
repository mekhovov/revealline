import RAPIER from '../../../optional-practice/civilian-fpv/vendor/rapier/rapier.mjs';
import { runAircraftSolverProfile } from './fpv-aircraft-solver-profile.mjs';

/** Additional read-only observations, outside the measured raw native step. */
export function installAircraftContactObservation() {
  const step = RAPIER.World.prototype.step,
    samples = [];
  let defaults = null,
    substeps = 0;
  RAPIER.World.prototype.step = function (...args) {
    if (!defaults)
      defaults = Object.fromEntries(
        [
          'dt',
          'lengthUnit',
          'normalizedAllowedLinearError',
          'normalizedPredictionDistance',
          'numSolverIterations',
          'numInternalPgsIterations',
          'maxCcdSubsteps',
          'contact_natural_frequency',
          'contact_erp',
        ].map((key) => [key, this.integrationParameters[key]]),
      );
    const value = Reflect.apply(step, this, args);
    substeps++;
    if (substeps % 100 === 0) {
      const pairs = new Set();
      const row = {
        substep: substeps,
        activeBodies: 0,
        bodies: 0,
        colliders: 0,
        contactPairs: 0,
        manifolds: 0,
        contacts: 0,
        solverContacts: 0,
      };
      this.forEachActiveRigidBody(() => row.activeBodies++);
      this.forEachRigidBody(() => row.bodies++);
      this.forEachCollider((collider) => {
        row.colliders++;
        this.contactPairsWith(collider, (peer) => {
          const key = [collider.handle, peer.handle].sort((a, b) => a - b).join(':');
          if (pairs.has(key)) return;
          pairs.add(key);
          row.contactPairs++;
          this.contactPair(collider, peer, (manifold) => {
            row.manifolds++;
            row.contacts += manifold.numContacts();
            row.solverContacts += manifold.numSolverContacts();
          });
        });
      });
      samples.push(row);
    }
    return value;
  };
  return {
    read: () => ({
      defaults,
      islandCount: null,
      islandCountAvailability:
        'Not exposed by pinned public Rapier API; active body count is measured instead.',
      samples: structuredClone(samples),
    }),
    dispose: () => {
      RAPIER.World.prototype.step = step;
    },
  };
}

export async function runAircraftSolverControl(options) {
  const observer = options.scenario === 'cetus-floor' ? installAircraftContactObservation() : null;
  try {
    const result = await runAircraftSolverProfile(options);
    return {
      ...result,
      contactObservation: observer?.read() ?? result.counters.contactObservation,
    };
  } finally {
    observer?.dispose();
  }
}
