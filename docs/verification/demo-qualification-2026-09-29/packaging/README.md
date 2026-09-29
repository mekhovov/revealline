# Initial packaging failure and repair investigation — 2026-09-29

The subsequent lossless repair and successful **14/14** recompilation are documented in [the final qualification](final/README.md). The initial failure evidence below is retained.

This is a local development build labelled **0.142.3**, not a release-admitted, published or signed package. The package and build-config versions were read unchanged from this candidate.

The sequential focused cohort passed **15/15**: boot build 3, edition runtime 9, offline core closure 3. TAP and timings are recorded alongside `cohort.json`. Commands were:

```sh
node --test game/test/boot-build.test.mjs
node --test game/test/edition-runtime.test.mjs
node --test scripts/test-offline-core-closure.mjs
node scripts/check-menu-editions.mjs /private/tmp/revealline-demo-editions-qualification-20260929-3vaq5o0d/editions
```

The unmodified `scripts/check-menu-editions.mjs` compiled the first seven editions, then **failed** on `droneaid-nl-community`: its offline inventory contains **693 files / 67,318,557 bytes**, exceeding the unchanged **67,108,864-byte (64 MiB)** limit by **209,693 bytes**. The six following editions were not attempted by that run. This is not an all-14 pass. `editions.log` preserves the original error and preceding successes.

`source-before.json.gz` and `source-after.json.gz` cover **1,068 actual compiler, engine and selected-content inputs** (128,445,769 bytes), with **no source changes** across this run. `edition-audit-partial.json` independently reads back 36 required paths per successful edition (252 exact checks): Demo Worker and playback, audio, background clock, analog rendering, catalog and all twelve replay variants. Packaged bytes match their offline inventory and the captured source bytes; the browser qualification harness is excluded. Per-edition manifests are retained under `edition-inventories/`.

The failure inventory in `dutch-budget-failure.json.gz` was collected by a temporary in-memory Node loader which only enriched the thrown Error with the already-computed inventory. It neither changed production files nor bypassed the limit. `dutch-budget-delta.json` compares it with the historical v0.142.1 artifact. The net increase is 1,573,338 bytes; this comparison spans multiple features and is not a measurement of Demo alone.

A potential zero-content-loss repair is measured in `lossless-feasibility.json`: the supplied 880,307-byte DroneAid PNG encodes to a **493,598-byte lossless WebP** (386,709 bytes saved), with **exactly identical decoded RGBA and dimensions**. Both original source bytes and production paths remain unchanged in this measurement. No derivative or production change was written; adopting it requires a new candidate and fresh packaging evidence. Removing all frozen Demo data would save only 147,659 bytes, insufficient to meet the limit, and is not proposed. The FPV wordmark remains referenced by boot, shell and packaged controller pages and is not safe to omit.

No native staging, real-device execution, release admission or publication was performed by this cohort. Temporary output ownership is recorded in `locations.json`.
