// Copyright 2024 The Chromium Authors. BSD-3-Clause; see devtools-LICENSE.txt.
// Adapted from Chrome DevTools CalibrationController.ts: TypeScript annotations
// removed; exported for a local, explicitly invoked qualification tool.
// Upstream blob 514aa4d4290d6967c73ccadedce3517830d231a3.
// https://chromium.googlesource.com/devtools/devtools-frontend/+/HEAD/front_end/panels/mobile_throttling/CalibrationController.ts
export function computeBenchmarkIndex(duration = 1000) {
  const halfTime = duration / 2;

  /**
   * The GC-heavy benchmark that creates a string of length 10000 in a loop.
   * The returned index is the number of times per second the string can be created divided by 10.
   * The division by 10 is to keep similar magnitudes to an earlier version of BenchmarkIndex that
   * used a string length of 100000 instead of 10000.
   */
  function benchmarkIndexGC() {
    const start = Date.now();
    let iterations = 0;

    while (Date.now() - start < halfTime) {
      let s = '';
      for (let j = 0; j < 10000; j++) {
        s += 'a';
      }
      if (s.length === 1) {
        throw new Error('will never happen, but prevents compiler optimizations');
      }

      iterations++;
    }

    const durationInSeconds = (Date.now() - start) / 1000;
    return Math.round(iterations / 10 / durationInSeconds);
  }

  /**
   * The non-GC-dependent benchmark that copies integers back and forth between two arrays of length 100000.
   * The returned index is the number of times per second a copy can be made, divided by 10.
   * The division by 10 is to keep similar magnitudes to the GC-dependent version.
   */
  function benchmarkIndexNoGC() {
    const arrA = [];
    const arrB = [];
    for (let i = 0; i < 100000; i++) {
      arrA[i] = arrB[i] = i;
    }

    const start = Date.now();
    let iterations = 0;

    // Some Intel CPUs have a performance cliff due to unlucky JCC instruction alignment.
    // Two possible fixes: call Date.now less often, or manually unroll the inner loop a bit.
    // We'll call Date.now less and only check the duration on every 10th iteration for simplicity.
    // See https://bugs.chromium.org/p/v8/issues/detail?id=10954#c1.
    while (iterations % 10 !== 0 || Date.now() - start < halfTime) {
      const src = iterations % 2 === 0 ? arrA : arrB;
      const tgt = iterations % 2 === 0 ? arrB : arrA;

      for (let j = 0; j < src.length; j++) {
        tgt[j] = src[j];
      }

      iterations++;
    }

    const durationInSeconds = (Date.now() - start) / 1000;
    return Math.round(iterations / 10 / durationInSeconds);
  }

  // The final BenchmarkIndex is a simple average of the two components.
  return (benchmarkIndexGC() + benchmarkIndexNoGC()) / 2;
}
