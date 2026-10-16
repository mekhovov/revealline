import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { performance } from 'node:perf_hooks';

import * as current from '../../../optional-practice/civilian-fpv/regional-session.mjs';
const baselinePath = process.argv[2];
assert(baselinePath, 'Provide a preserved baseline session module with resolved imports');
const baseline = await import(pathToFileURL(path.resolve(baselinePath)));
const root = path.resolve(
  process.argv[3] ?? '/Volumes/alex/CodexMigrationStaging/fpv-large-worlds-20261014/urban-mixed-r2',
);
const fetchImpl = async (url, { signal } = {}) => {
  signal?.throwIfAborted();
  const file = path.resolve(root, '.' + new URL(url).pathname);
  assert(file.startsWith(root + path.sep));
  return new Response(await readFile(file));
};
const config = await current.loadRegionalReview({
  manifestURL: '/terrain/region.json',
  sceneryURL: '/scenery/region.json',
  pageURL: 'https://review.example/sim',
  fetchImpl,
});
const zero = { roll: 0, pitch: 0, yaw: 0, throttle: 0 };
let comparisons = 0;
const scrub = (object) => {
  for (const key of Object.keys(object)) {
    if (object[key] && typeof object[key] === 'object') scrub(object[key]);
    else object[key] = null;
  }
};
for (const mode of ['self-level', 'acro']) {
  const a = current.createRegionalSession({ ...config, mode });
  const b = baseline.createRegionalSession({ ...config, mode });
  try {
    await a.prepare();
    await b.prepare();
    assert.deepEqual(a.snapshot(), b.snapshot());
    for (let phase = 0; phase < 3; phase++) {
      assert(a.arm());
      assert(b.arm());
      for (let i = 0; i < 200; i++) {
        const axes = {
          roll: phase === 0 ? 0 : i % 40 < 20 ? 0.02 : -0.02,
          pitch: phase === 0 ? 0 : i % 60 < 30 ? -0.02 : 0.02,
          yaw: phase === 0 ? 0 : 0.01,
          throttle: phase === 0 ? 0.52 : 0.15,
        };
        const result = a.step(axes),
          expected = b.step(axes);
        assert.deepEqual(result, expected);
        comparisons++;
        assert.deepEqual(result, a.snapshot());
        if (i === 40) {
          const retained = a.snapshot(),
            saved = structuredClone(retained);
          const disposable = a.snapshot();
          scrub(disposable);
          assert.deepEqual(a.snapshot(), saved, 'Snapshot mutation must not change owner state');
          const r1 = a.step(zero),
            r2 = b.step(zero);
          assert.deepEqual(r1, r2);
          comparisons++;
          assert.deepEqual(retained, saved, 'Later steps must not mutate retained snapshots');
          scrub(r1);
          assert.deepEqual(
            a.snapshot(),
            b.snapshot(),
            'Step result mutation must not change owner state',
          );
        }
      }
      a.pause();
      b.pause();
      assert.deepEqual(a.step({ ...zero, throttle: 1 }), b.step({ ...zero, throttle: 1 }));
      comparisons++;
      a.cancelPreparation();
      b.cancelPreparation();
      assert.equal(a.arm(), false);
      assert.equal(b.arm(), false);
      await a.prepare();
      await b.prepare();
      assert.deepEqual(a.snapshot(), b.snapshot());
    }
  } finally {
    await a.dispose();
    await b.dispose();
  }
  assert.equal(a.root.children.length, 0);
  assert.equal(b.root.children.length, 0);
}
const timings = { before: [], after: [] };
for (let round = 0; round < 5; round++) {
  for (const name of round % 2 ? ['after', 'before'] : ['before', 'after']) {
    const api = name === 'after' ? current : baseline;
    const flight = api.createRegionalSession({ ...config, mode: 'self-level' });
    await flight.prepare();
    assert(flight.arm());
    try {
      // A grounded low-throttle workload keeps every tick accepted inside one window.
      for (let i = 0; i < 200; i++) flight.step({ ...zero, throttle: 0.1 });
      const startTick = flight.snapshot().ticks;
      const started = performance.now();
      for (let i = 0; i < 2000; i++) flight.step({ ...zero, throttle: 0.1 });
      timings[name].push(performance.now() - started);
      assert.equal(flight.snapshot().ticks - startTick, 2000);
    } finally {
      await flight.dispose();
    }
  }
}
const median = (values) => [...values].sort((a, b) => a - b)[2];
console.log(
  JSON.stringify(
    {
      comparisons,
      mutationIsolation: 'passed',
      acceptedBenchmarkTicks: 20000,
      node: process.version,
      milliseconds: timings,
      medianMs: { before: median(timings.before), after: median(timings.after) },
      limitation: 'Node CPU workload; no browser/device FPS or GPU claim',
    },
    null,
    2,
  ),
);
