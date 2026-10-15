# Coaster Gardens exact package qualification

The cloud package at `b2df189aa8ceab7cf37c17defe554718cbedb80a` (Draft #1392) passes the bounded package and production-session checks below. This does **not** accept its scenery for player admission: native review of the immutable composition-r1 source found an isolated unsupported loop and insufficient ground/context quality. That source and pin remain unchanged; the Library PR remains Draft while a new source revision is developed.

## Exact candidate

- Run: [38698936975](https://github.com/mekhovov/revealline/actions/runs/38698936975); artifact `11955500930`.
- Source tree: `886d0c7478f05b716b89fe806f4ee5e31eb4d046`.
- Package revision: `ec3d7a5f850f2e348fb29aa5e3303de5c7a3d85aa39bfeda35d69ce0f9b256ca`.
- Whole artifact SHA-256: `17d54ae7e99165252c99508f54188196a2a0edb6c0b6f9471e54f468843963a3`.
- Worlds runtime ZIP SHA-256: `5338c452e08b344701a08173e4b63208961beece04e80e2eec895e50c6d7a029`.

All 15 top-level checksums and every member of all six runtime/source ZIPs passed. Worlds contains 160 runtime ZIP members / 17,461,266 uncompressed bytes and 162 source ZIP members / 17,504,610 bytes, within the unchanged 162-file / 20 MiB envelope of this historical candidate. Runtime manifest dependencies are counted separately from archive metadata.

The exact-source finished-archive validator passed all three transitive module closures: civilian-flight 68 modules / 96 imports, Academy 81 / 152, Worlds 132 / 334. There was no source fallback.

## Production behavior against extracted package modules

The committed `verify-library.mjs` scenario was copied outside the package; only its three runtime import URLs were redirected into the unchanged extracted runtime. An external parent `package.json` supplies Node's ES-module context. Every extracted runtime member was re-compared to the frozen ZIP after the checks.

- 183 real HTTPS responses were fetched from the immutable `3b6edef381a917e7ce0b6a37054fcfc3ee7188cd` source bundle, validating the descriptor and all 182 payloads.
- Descriptor: 29,654 bytes, SHA-256 `4800da2f8a06134333fad8def9615a96c94b2fb76f7fb3ef41bfa69b4a9872b5`.
- Payload: 33,878,943 bytes; total 33,908,597 bytes. Observed download duration was 14.894 seconds on this connection, not a speed guarantee.
- All 36 production-session preparations passed: six starts × two modes × three presentation tiers. Each starts disarmed, runs 100 actual commanded simulation ticks, pauses, and releases owned resources. Geometry identity remains equal across presentation tiers.

The first closure invocation stopped because the qualification utility had not extracted sibling distribution ZIPs beside Worlds. A subsequent Node-only invocation stopped because the external harness lacked ES-module context. Both logs are retained; neither modified package bytes. The final corrected harness passed. These are tooling setup failures, not suppressed runtime failures.

## Remaining gates

No browser installation, first-flight, GPU compilation, offline storage, physical-controller or final-art acceptance is claimed for this exact package. Native source review already identified an art gap; no auto-merge or public admission follows from these package checks. The original 160 m pack and existing Library rows are unchanged.

The frozen candidate and logs are retained externally under `fpv-package-qualification-20261014/coaster-library-b2df189a` and `fpv-temp/coaster-library-qualification*.log`. The accompanying JSON records exact identities, archive inventories, closures and functional results.
