# Optional FPV lifecycle observation

`scripts/observe-fpv-retention.mjs` is a separate forced-GC diagnostic for the
optional civilian FPV package. It does not run a gameplay benchmark, manufacture
progress, calibrate a radio or qualify a physical device.

Run it against an already frozen optional candidate using an installed Playwright
module and Chrome. The tool does not build source, install dependencies or download
a browser. The output directory must not exist:

```sh
node scripts/observe-fpv-retention.mjs retention-plan.json /absolute/path/to/playwright/index.mjs /absolute/path/to/new-evidence-directory
```

Use the exact artifact fields documented in the
[runtime observer plan](fpv-runtime-observer.md), with
`format: "revealline-fpv-retention-plan.v1"` and
`protocol: "civilian-fpv-retention.v1"`. Retention and runtime observations are
different procedures; neither uses the first-completion protocol or its trace field.
Record the real device and concurrent work in each plan.

The shared artifact loader reuses optional-package admission, verifying every
original distribution/source archive and inventory against the pinned envelope,
source commit/tree and selected package revision. It extracts only the selected
FPV runtime, serves it on a temporary loopback server, and checks the hash and length
of every original ZIP member over HTTP, including its manifest. Frozen source
identity is not release approval or independent proof of a GitHub tag.

A separately hashed observation document and wrapper mount the unchanged app and
expose its resource counts and disposal method. Every original runtime member stays
unchanged. The report preserves the exact plan, admission, member pins, harness and
admission-authority copies, external Playwright entry-module hash and preview headers.
The reported scope remains an instrumented host using packaged-preview headers,
not a deployed origin or installed PWA.

An isolated headless Chrome session warms all twelve courses. Each warm-up and
measured cycle selects a course, resets, opens and closes Radio and Notebook,
opens Studio, previews without earning, and returns to the first course. It
records snapshots at the warmed baseline, after twenty cycles and after another
twenty cycles. It then disposes the app, releases the wrapper's API reference,
and records a fourth snapshot. Static host DOM remains mounted. Every snapshot
follows explicit garbage collection; each collection and capture has a
60-second deadline. The complete warm-up, forty cycles and four captures also have
a ten-minute procedure deadline, so an unresponsive evaluation proceeds to cleanup
instead of waiting indefinitely. The first two preserved diagnostic runs used one twenty-cycle
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
to zero. The version-two report always uses `qualification: false` and preserves population
growth instead of treating procedure completion as a memory-stability pass.

Keep raw `.heapsnapshot` files private: snapshots may include source text,
fixture strings and browser state. A publication-safe receipt should include
hashes, bounded counts and a diagnosis, never the snapshot payload. The output
also preserves the exact observer, analyzer, shared loader, wrapper and runtime manifest used
for that run. Later tool changes do not retroactively alter those pins.

The report is `observation.json`. A partial or failed procedure keeps its error,
completed checkpoints and cleanup outcomes there. Heap captures and bounded partials
receive byte/hash records; truncated captures are never analyzed as complete JSON.
The observer attempts each owned cleanup even when an earlier one fails. Cleanup
waits have ten-second deadlines, but a deadline does not prove that an underlying
browser process has terminated. A timeout records failed cleanup and cannot produce
`completed: true`. The owned preview server closes its active connections. There is
no forced termination of unrelated browser processes.

Procedure completion is separate from a memory-stability conclusion. Review the
first and second interval, strong retaining paths and disposal results together;
keep unexplained growth visible. Authored regression coverage is in
`scripts/test-fpv-observation-artifact.mjs` and `scripts/test-analyze-fpv-heap.mjs`;
execution follows the repository's explicit automated-suite policy.

Earlier development-package observations retain their original identities and are
not retroactively qualified by the new loader. The initial diagnostic and its
focused disposal correction are recorded in
[`fpv-retention-2026-09-28.json`](verification/evidence/fpv-retention-2026-09-28.json).

The harness uses documented [Playwright CDP sessions](https://playwright.dev/docs/api/class-cdpsession)
and [Chrome HeapProfiler commands](https://chromedevtools.github.io/devtools-protocol/tot/HeapProfiler/).
Chrome describes snapshot interpretation and shallow versus retained memory in
its [heap snapshot documentation](https://developer.chrome.com/docs/devtools/memory-problems/heap-snapshots).
