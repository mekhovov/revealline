// Manual CPU-only observation. This is not a rendering, FPS, or latency benchmark.
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import { groundMotionCases } from './cases.mjs';
import {
  createWorldFlight,
  initWorldRuntime,
} from '../../../optional-practice/civilian-fpv/world-model.mjs';
assert(process.argv[2], 'Pass a new receipt path');
await initWorldRuntime();
const course = structuredClone(
  groundMotionCases().find((c) => c.name === 'vehicle/finite-flat').course,
);
course.actors = Array.from({ length: 12 }, (_, i) => {
  const type = ['vehicle', 'patrol', 'sentry'][i % 3];
  const actor = structuredClone(
    groundMotionCases().find((c) => c.name === type + '/finite-flat').course.actors[0],
  );
  actor.id = 'subject-' + i;
  actor.position.x = -8800 + i * 1600;
  actor.path.forEach((p) => {
    p.x = actor.position.x;
  });
  return actor;
});
const input = { roll: 0, pitch: 0, yaw: 0, throttle: 0, actions: 0 };
const receipt = {
  format: 'FPVGroundMotionCPU.v1',
  node: process.version,
  platform: process.platform,
  architecture: process.arch,
  ticks: 3000,
  actors: 12,
  order: ['legacy', 'support-v1', 'support-v1', 'legacy'],
  scope:
    'Native clock around ordinary step loop, same finite scene and commands. Legacy stalls and opt-in continues, so later poses and native query work differ. Fresh Worlds; no rendering, snapshots/recorder in loop, hardware isolation, FPS or whole-frame claim.',
  samples: [],
  complete: false,
};
try {
  // Untimed common warm-up initializes the pinned native runtime.
  const warm = createWorldFlight({ course, mode: 'self-level' });
  try {
    warm.arm();
    for (let i = 0; i < 100; i++) warm.step(input);
  } finally {
    warm.dispose();
  }
  for (const variant of receipt.order) {
    const data = structuredClone(course);
    if (variant === 'support-v1')
      data.actors.forEach((a) => {
        a.groundMotion = variant;
      });
    const flight = createWorldFlight({ course: data, mode: 'self-level' });
    try {
      flight.arm();
      const started = performance.now();
      for (let i = 0; i < receipt.ticks; i++) flight.step(input);
      const elapsedMs = performance.now() - started;
      const state = flight.snapshot();
      assert.equal(state.ticks, receipt.ticks);
      assert.equal(state.status, 'active');
      receipt.samples.push({
        variant,
        elapsedMs,
        millisecondsPerTick: elapsedMs / receipt.ticks,
        finalActors: state.actors.map((a) => ({
          id: a.id,
          position: a.position,
          blocked: a.blocked,
        })),
      });
    } finally {
      flight.dispose();
    }
  }
  receipt.complete = true;
} catch (e) {
  receipt.error = { message: e.message, stack: e.stack };
  throw e;
} finally {
  await writeFile(process.argv[2], JSON.stringify(receipt, null, 2) + '\n', { flag: 'wx' });
  console.log(
    JSON.stringify({
      complete: receipt.complete,
      samples: receipt.samples.map(({ variant, millisecondsPerTick }) => ({
        variant,
        millisecondsPerTick,
      })),
    }),
  );
}
