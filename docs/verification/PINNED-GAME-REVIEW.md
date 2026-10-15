# Pinned source browser review

`scripts/serve-pinned-game-review.py` serves two exact Git commits on separate
loopback origins. It avoids a second full checkout or release build when comparing
native browser scenes. Both origins use the same transport and the same two
candidate Journey observer files. All game and asset responses come from their
own pinned Git tree; working-tree and generated-build fallbacks are absent.

```sh
python3 scripts/serve-pinned-game-review.py \
  --repo /absolute/path/to/repository \
  --baseline FULL_40_CHARACTER_BASELINE_COMMIT \
  --candidate FULL_40_CHARACTER_CANDIDATE_COMMIT \
  --observer-ref FULL_40_CHARACTER_CANDIDATE_COMMIT \
  --out /absolute/path/to/new-receipt-directory
```

Use distinct, reviewed source commits. The helper prints the two observer URLs
and writes `binding.json` with commit/tree/observer/helper pins. Each origin has
a bounded request receipt containing the exact offered blob hash and byte range.
A response-prepared record establishes bytes offered by the helper, not confirmed
browser consumption. Save the browser's own observer JSON and endpoint screenshot
separately. Stop the helper after review.

Only regular Git blobs under the explicit game/authoring/site/optional-practice/
vendor source roots are eligible. Test, hidden and traversal paths, symlinks,
moving refs and out-of-bound reads fail. The helper listens only on `127.0.0.1`,
accepts GET/HEAD with its exact Host, serves no-store responses and refuses
service-worker registration. It caps blob/cache/log sizes and concurrent readers.
It never changes engine state, input, time, runtime modules or asset bodies.

This is **source review**, not release packaging, offline installation or
cross-version cache qualification. Generated manifests and build-only routes may
be unavailable. It cannot establish a published edition's source or capacity.
The source's ordinary game saves remain local to each temporary origin.

For a comparison, keep the browser, viewport, mission, settings and input protocol
equivalent. Record actual focus, input and HUD observations. Disclose different
activity, random outcomes, background machine load and unavailable counters.
The observer's frame intervals include scheduling and observation overhead;
one pair cannot establish a regression, improvement, memory leak or worst-case
budget. An initial scene with no gameplay input does not qualify sustained play
under pressure.

Run `node --test scripts/test-pinned-game-review.mjs` for the bounded real-Git
transport checks. The unchanged observer has separate tests in
`scripts/test-journey-performance-observer.mjs`.
