# Optional FPV lifecycle observation

`scripts/observe-fpv-retention.mjs` is a separate forced-GC diagnostic for the
optional civilian FPV package. It does not run a gameplay benchmark, manufacture
progress, calibrate a radio or qualify a physical device.

Run it with an already installed Playwright module and Chrome. The output
directory must not exist; no browser download is performed:

```sh
node scripts/observe-fpv-retention.mjs /absolute/path/to/playwright/index.mjs /absolute/path/to/new-evidence-directory
node --test scripts/test-analyze-fpv-heap.mjs
```

The harness builds the selected development package, serves it on its own
loopback server, and verifies the hash and length of every compiled manifest
member over HTTP. The manifest has no committed-source or release qualification
claim. A separately hashed wrapper mounts the unchanged app and exposes its
read-only resource counts and disposal method to the observer.

An isolated headless Chrome session warms all twelve courses. Each warm-up and
measured cycle selects a course, resets, opens and closes Radio and Notebook,
opens Studio, previews without earning, and returns to the first course. It
records snapshots at the warmed baseline, after twenty cycles and after another
twenty cycles. It then disposes the app, releases the wrapper's API reference,
and records a fourth snapshot. Static host DOM remains mounted. Every snapshot
follows explicit garbage collection; each collection and capture has a
60-second deadline. The first two preserved diagnostic runs used one twenty-cycle
interval. Their exact older observer copies remain part of their evidence.

`analyze-fpv-heap.mjs` validates at most 128 MiB, one million nodes and eight
million edges. It reports shallow bytes, detachedness when present, selected
constructor/closure populations, same-snapshot object identities and at most two
shortest strong retaining paths per cohort. Weak edges are excluded. A cohort
name can include library prototypes or scratch objects, so its count is not
automatically a live scene-instance count. Object IDs are compared only within
one browser session.

These observations cannot establish dominator/exclusive retained bytes, native
decoder memory, GPU byte totals, process RSS or natural runtime pacing. Stable
connected DOM counts alone do not establish cleanup. A nonzero Three.js texture
counter is preserved even after actual WebGL context loss; it is not rewritten
to zero. The report always uses `qualification: false` and preserves population
growth instead of treating procedure completion as a memory-stability pass.

Keep raw `.heapsnapshot` files private: snapshots may include source text,
fixture strings and browser state. A publication-safe receipt should include
hashes, bounded counts and a diagnosis, never the snapshot payload. The output
also preserves the exact observer, analyzer, wrapper and runtime manifest used
for that run. Later tool changes do not retroactively alter those pins.

The initial diagnostic and its focused disposal correction are recorded in
[`fpv-retention-2026-09-28.json`](verification/evidence/fpv-retention-2026-09-28.json).

The harness uses documented [Playwright CDP sessions](https://playwright.dev/docs/api/class-cdpsession)
and [Chrome HeapProfiler commands](https://chromedevtools.github.io/devtools-protocol/tot/HeapProfiler/).
Chrome describes snapshot interpretation and shallow versus retained memory in
its [heap snapshot documentation](https://developer.chrome.com/docs/devtools/memory-problems/heap-snapshots).
