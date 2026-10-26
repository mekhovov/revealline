import RAPIER from '../../../optional-practice/civilian-fpv/vendor/rapier/rapier.mjs';
import { initAdvancedRuntime } from '../../../optional-practice/civilian-fpv/advanced-simulation.mjs';
import { runAircraftRepresentativeProfile } from './fpv-aircraft-profile.mjs';

const timings = [
  'Step',
  'CollisionDetection',
  'BroadPhase',
  'NarrowPhase',
  'Solver',
  'VelocityAssembly',
  'VelocityResolution',
  'VelocityUpdate',
  'VelocityWriteback',
  'Ccd',
  'CcdToiComputation',
  'CcdBroadPhase',
  'CcdNarrowPhase',
  'CcdSolver',
  'IslandConstruction',
  'UserChanges',
];

/** Diagnostic only. No physics inputs/settings change. Profiler counters are
 * inclusive native wall-clock observations; their overhead is not subtracted. */
export async function installAircraftSolverProfile({ native = false } = {}) {
  await initAdvancedRuntime();
  const probe = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  const rawPrototype = Object.getPrototypeOf(probe.physicsPipeline.raw);
  probe.free();
  const restores = [];
  let result,
    active = null,
    steps = 0;
  function reset() {
    result = { native, worlds: [], bins: [] };
    steps = 0;
  }
  reset();
  const worlds = new WeakSet();
  function wrap(target, key, handler) {
    const original = target[key];
    target[key] = function (...args) {
      return handler.call(this, original, args);
    };
    restores.push(() => {
      target[key] = original;
    });
  }
  function row() {
    const index = Math.floor(steps / 100);
    return (result.bins[index] ??= {
      fromSubstep: index * 100,
      calls: 0,
      worldMs: 0,
      rawMs: 0,
      mappingMs: 0,
      nativeMs: {},
    });
  }
  wrap(rawPrototype, 'step', function (original, args) {
    const started = performance.now();
    try {
      return Reflect.apply(original, this, args);
    } finally {
      if (active) active.rawMs += performance.now() - started;
    }
  });
  wrap(RAPIER.World.prototype, 'mapNewSoftBodies', function (original, args) {
    const started = performance.now();
    try {
      return Reflect.apply(original, this, args);
    } finally {
      if (active) active.mappingMs += performance.now() - started;
    }
  });
  wrap(RAPIER.World.prototype, 'step', function (original, args) {
    if (!worlds.has(this)) {
      worlds.add(this);
      const colliders = [];
      this.forEachCollider((collider) => {
        const shape = collider.shape;
        colliders.push({
          handle: collider.handle,
          shape: shape.constructor.name,
          shapeType: shape.type,
          ...(shape.indices
            ? { triangles: shape.indices.length / 3, vertices: shape.vertices.length / 3 }
            : {}),
          ...(shape.radius ? { radius: shape.radius } : {}),
        });
      });
      result.worlds.push({
        profilerInitiallyEnabled: this.profilerEnabled,
        timestep: this.timestep,
        solverIterations: this.numSolverIterations,
        maxCcdSubsteps: this.maxCcdSubsteps,
        colliders,
      });
      if (native) this.profilerEnabled = true;
    }
    active = row();
    const started = performance.now();
    try {
      return Reflect.apply(original, this, args);
    } finally {
      active.worldMs += performance.now() - started;
      active.calls++;
      if (native)
        for (const key of timings) {
          const measured = this['timing' + key]();
          active.nativeMs[key] = (active.nativeMs[key] ?? 0) + measured;
        }
      active = null;
      steps++;
    }
  });
  return {
    reset,
    read: () => structuredClone(result),
    dispose: () => restores.reverse().forEach((restore) => restore()),
  };
}

export async function runAircraftSolverProfile({ scenario, native, workerURL }) {
  const profile =
    scenario === 'cetus-floor' ? await installAircraftSolverProfile({ native }) : null;
  try {
    const measured = await runAircraftRepresentativeProfile({ scenario, workerURL });
    return { ...measured, native, solverProfile: profile?.read() ?? measured.counters };
  } finally {
    profile?.dispose();
  }
}
