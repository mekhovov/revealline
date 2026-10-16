# Regional source preparation

This dependent increment adds a working source-byte window loader to the
[regional authoring foundation](fpv-regional-foundation.md). It performs local/HTTPS
fetch, integrity checks, bounded concurrency, cancellation and transactional source
replacement. It remains outside the shipped player dependency graph. No regional
world is advertised playable by this work.

## Why a separate preparation stage

The current renderer imports and replaces a complete scene, while the fixed-world
collision adapter builds its static broad phase once. Neither offers a safe incremental
terrain/collision insertion interface. Directly feeding partial scene data into those
interfaces would create incorrect readiness and disposal behaviour.

The new `createRegionSourceWindow(manifest, options)` in
`authoring/fpv-worlds/regions/source-window.mjs` supplies verified bytes for a future
scene/collision staging adapter. It neither decodes GLB nor instantiates physics.
Every snapshot explicitly reports `flightReady: false`. `sourceReady` only becomes
true when every selected asset passes byte-length and SHA-256 verification.

## Interface and lifecycle

- `baseURL`: a directory URL using HTTPS, or localhost HTTP for verification. No
  credentials, query, fragment or redirect is accepted. Fetch omits credentials.
- `maxSourceBytes`: combined committed and staging source bytes; at most the
  foundation's 256 MiB authoring ceiling. This does not modify production budgets.
- `concurrency`: one to four fetches, default two. Each response streams into a
  pre-sized buffer and rejects oversized, truncated or hash-mismatched data.
- `timeoutMs`: bounded whole-transition deadline, default/max 120 seconds.
- `transition(position)`: plan and prepare a new window. Shared committed asset ids
  are reused; each missing asset is fetched once. A successor cancels earlier work
  and waits for that work to settle before beginning new fetches.
- `snapshot()`: preparation state, committed position/origin, chunk and asset ids,
  committed bytes, reserved source bytes and explicit source/flight readiness.
- `copyAsset(id)`: a caller-owned copy of a committed asset. Caller copies, network
  internals, decoder memory and GPU resources are outside the loader's source-byte
  accounting and require their own limits in the future runtime adapter.
- `cancel()`: cancel preparation, retain the previous committed data, and report
  cancelled rather than presenting the new requested location as ready.
- `dispose()`: cancel and drain preparation, release committed bytes and reject
  future operations. Repeated disposal is safe.

Committed data remains intact if any fetch, integrity check, timeout or cancellation
fails. Only after all required and selected-prefetch sources pass does the new window
replace it atomically. Old unreferenced arrays then become reclaimable. Failed staging
arrays are released when the operation settles; no texture/collider disposal is claimed
because this layer does not create either resource.

Optional prefetch yields to the **combined old plus new** source-byte allowance. If
holding the old window and preparing even the new mandatory neighbourhood cannot fit,
the loader rejects with `transition-source-budget` before starting downloads. It does
not silently discard the old window or pretend the new location is ready. The future
host must pause and explicitly choose a fresh loading session or a smaller admitted
asset set. This failure is preferable to an unbounded transactional memory peak.

The suggested origin remains data only; it is not applied to flight state. Collision
installation, renderer replacement, actor relocation, safe origin rebasing and eventual
flight readiness still need a separate atomic integration step.

## Functional verification

```sh
node authoring/fpv-worlds/regions/verify.mjs
node authoring/fpv-worlds/regions/verify-source-window.mjs
```

The second command starts a temporary loopback HTTP server and exercises native fetch
with a synthetic regional manifest. It checks streamed SHA verification, source sharing,
concurrency, copy isolation, all-or-nothing replacement, corrupt/truncated/oversized
responses, rejected redirects, cancellation/supersession, stalled-response timeout,
combined source-budget failure, successful eviction and idempotent disposal. Files are
synthetic bytes, not decoded scenes; no network map is admitted and no FPS is measured.
Additional unit-suite coverage remains in D6.

Next: define and admit concrete regional terrain/collision payloads, produce actual
region content, implement detached scene/collider preparation with measured decoded
resource limits, then integrate the unscored regional free-flight host and qualification.
