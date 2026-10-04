# Scene readiness: bounded local qualification

The host now calls `renderer.draw` only after its existing `sceneReady` gate is true. Menu and device polling, real-clock pause protection, audio, HUD, recovery, and deliberate arming continue through their existing paths. Asset loading, shader preparation, camera behavior, quality levels, collision, physics, recordings, rewards and package limits are unchanged. The change adds 116 original source bytes and no runtime files.

This is a readiness correction, not a claim of uniformly faster graphics or sustained device FPS. Compilation and first-draw work still exist, and some work moves to the first ready frame.

## Source and environment

- Baseline: `a90fc81807dd43c4d5ee873cd0028daff1bc3a6e`; host SHA256 `add5a9fa33e2fc44f21aa76e2f8b607134074b8bd16f1196ea737051e9c05120` (257,295 bytes).
- Candidate: `977d7b8dbc5d2ba6a6f51f8373c20291fbf9f0dd`; host SHA256 `00bd26e073ccf8285422d77b43ab3fe39980cbee191227fffc3487264ede75eb` (257,411 bytes).
- Integrated candidate: `53d3364fe29ced8a4ee22a4a32a96662877d336b`, containing an ordinary merge of main `ade4bfc2dd2934668889bf622e87a48cf1b52c03`. The same host hunk is the only runtime diff against that main. Integrated host SHA256 `4d5ace26dab0ab93c223c420fcafea6313a8855bc22bf7ea95d6d7b2bb5d3a51` (260,687 bytes).
- Local machine: Apple M4 Pro, 48 GiB, macOS 26.7.1. The browser reports Chrome 154, 14 logical processors, 1280×654 viewport, DPR 2, WebGL 2 and parallel shader compilation support. The reduced macOS/Intel user-agent string is retained verbatim in the receipts; it is not a hardware inventory.

The source fixtures reuse the complete 102-member admitted d41 player and explicitly overlay only the pinned host. Their original package manifest is baseline provenance, not admission of the overlay. A historical descriptor uses the generic phrase “current-main source overlay”; the explicit candidate commit above is authoritative. One visible player runs at a time. Native clocks, visibility/focus and production guards remain enabled. The rendererFactory observer records bounded method spans and CPU/GL submission durations without cloning the full application snapshot every frame. Sampling snapshots occur only at deliberate checkpoints.

## Initial matched observations

Baseline r2 and candidate r3 use byte-identical observer and workload scripts. Each passed 143 checks, with 18 correctly attributed visible/focused draw windows, no warnings/errors or dropped observations, and zero registered graphics resources after disposal. Yard, Woodland and School retain the exact recorded state and resource details, excluding only uploaded renderer geometry/texture/program counts. Actor positions, appearance identities, effects, material-binding diagnostics, draw calls and triangles match. This is not a pixel or shader-object comparison.

| Local observation, milliseconds | Baseline r2 | Candidate r3 |
| --- | ---: | ---: |
| `loadScene` median / maximum | 62.1 / 131.0 | 16.1 / 33.8 |
| `prepare` median / maximum | 14.8 / 50.7 | 26.6 / 72.5 |
| Public Fly to observed Ready median / maximum | 113.3 / 319.9 | 98.5 / 235.7 |
| Quality to observed Ready median / maximum | 32.7 / 46.3 | 33.3 / 76.5 |
| Retry to observed Ready median / maximum | 91.0 / 134.2 | 97.1 / 112.1 |
| Draw CPU/GL submission maximum | 84.7 | 30.7 |
| RAF gap p95 / maximum | 18.4 / 217.5 | 20.2 / 153.2 |

Baseline submits 26 draws during pending scene loading and 28 during preparation; candidate submits none. The largest baseline draws occur during loading. Candidate first-ready Yard draws cost roughly 26–30 ms, versus about 1 ms after baseline has already drawn during preparation. Overlapping asynchronous spans cannot be added or interpreted as isolated parser/compiler costs. Earlier seconds-long historical stalls were not reproduced by this bounded workload.

School's opaque guide is dismissed through public Start followed immediately by Pause; recorded sample ticks remain zero. This is a separately timed warm-state transition, not an untouched disarmed course load. Diagnostic r1 lacked correct-course draw attribution while that guide covered the scene; its School timings are excluded. Its truncated transport export is retained separately from the complete receipt.

## Repeated warm quality comparison

The immutable ABBA fixture uses fresh sequential hosts in A/B/B/A order, two courses, three quality levels, one warm cycle and four measured cycles: 96 predeclared observations. It observes the native status mutation separately from the first subsequent correct-course draw. Native status timing includes observer delivery. Previous hosts are awaited and disposed before the next host is created.

ABBA r1 passed its functional checks, but all four timing blocks fall within the conservatively retained 08:28:23–08:30:17 UTC interval of another task's unintended 198,705,152-byte Git lazy fetch, index-pack/repack and ENOSPC failure. Its timing conclusions are excluded. No source or fixture was changed in response.

The clean repeat r2 ran with other owned commands, generation and heavy work held. It passed **587/587 checks**, retained all 96 samples, reported no warnings/errors/drops, and matched all 48 paired logical state/resource observations. Baseline blocks each submitted 15 draws while loading/preparing; candidate blocks submitted zero.

| Warm observation, milliseconds | Baseline A (48) | Candidate B (48) |
| --- | ---: | ---: |
| Status-ready median / p95 / maximum | 79.9 / 96.3 / 101.9 | 60.8 / 99.0 / 110.6 |
| Dispatch to first post-prepare draw end median / p95 / maximum | 98.1 / 141.6 / 149.8 | 85.3 / 133.1 / 162.1 |
| First post-prepare draw CPU median / p95 / maximum | 33.5 / 50.6 / 56.5 | 26.9 / 55.5 / 60.5 |

Five of six course/quality median slices improve; Woodland Low regresses (status-ready 49.8→78.1 ms). Tail results are mixed. These are descriptive observations from one local workload, not significance estimates, universal latency improvements, GPU elapsed timings or sustained FPS. Fresh documents do not flush OS/GPU caches. Long Animation Frame support was feature-detected; zero delivered entries is not proof that no long frames occurred. See the primary [Chrome LoAF documentation](https://developer.chrome.com/docs/web-platform/long-animation-frames) and [Three renderer API](https://threejs.org/docs/pages/WebGLRenderer.html) for the distinction between observation, compilation and renderer counters.

## Readiness and recovery

Source readiness r2 passed **141/141 checks**. A fixture requests one real `WEBGL_lose_context` loss during first renderer creation. The native first `loadScene` rejects; Arm remains disabled and no intermediate scene is drawn. Native restoration and public Retry produce the correct Yard scene and both actors. Root visually inspected the visible stacks/actors. Low/High/Balanced, chase camera/FOV and real canvas layout resize pass. Coast follows its actual fallback scene path.

An ordinary keyboard flight advances 15 native-clock ticks, is deliberately paused and saved, then is resumed through the public Library after a fresh host reopens native IDB. The complete recovered state equals the saved state, including exact course, ticks, position, orientation and velocity. Both host disposals release all registered graphics resources. The expected native loss appears only in its method span; unexpected warnings and errors are empty.

The source fixture's relocated host caused one broken shell brand URL because production explicitly resolves that URL against `window.location`, independently of the fixture's `<base>`. This is retained in its screenshot and is not a production regression or admitted visual claim. The admitted fixture places its separate observation HTML at the native directory depth; all package members remain unchanged.

The exact integrated admitted package then passed **141/141 checks**, with the same 35 functional check names and 106 frozen-file checks. Warnings/errors/drops are empty; both disposals release registered resources. The entire saved state again equals the native reopened state. Root visually confirmed the correct restored Yard, both actors and the now-resolved brand image. `source-package-comparison.json` records scenario equality; source overlays and admitted-package provenance remain distinct. The admitted receipt is 1,219,578 bytes, SHA256 `68698cbd5a33f64f144c6de1164b39b4c4fe1cf488deb34b05659701ea871c31`.

## Validation and package admission

Full `npm --logs-max=0 run validate` passed on integrated commit 53d3364fe2: EN/UK, 12,928 messages and 8,991 references, default content validation, presentation metadata and all generated FPV projections. The initial missing sparse localization inputs are preserved as an environment failure. Repair used 1,901 independent APFS clones (831,163,929 logical bytes), verified every target Git blob, and fetched no objects or fallback bytes. No validation rule was changed.

The existing appearance host suite passed 11/12. Its pre-arm focus assertion also fails against the unchanged ade4 host (exact existing case, 11 others skipped); the temporary diagnostic copies were removed. That case never dispatches an animation frame, so this draw guard does not execute there. Both failures are retained; no passing result, extra coverage or unrelated focus repair is claimed.

Command: `GIT_NO_LAZY_FETCH=1 node scripts/bundle-optional-practice.mjs --out /private/tmp/fpv-scene-readiness-53d3364fe2 --packages civilian-flight,civilian-fpv,fpv-worlds`.

All three packages passed source-bound admission, two identical builds, committed-input verification and ZIP-member verification. Worlds has **95 original inputs / 16,772,304 bytes**, leaving **4,912 bytes** below the unchanged 16 MiB source limit. It has **102 admitted members / 15,566,142 bytes**, below the unchanged 104-file limit. Package revision: `0e9bae1de779fb6d3767f930a48f4e43a00f7a055785cc169426238a60fc3313`. Its archive and source inventory hashes are pinned in the admission and staging receipts. Staging reuses 98 immutable files and writes 1,138,079 changed bytes. This does not publish a public package or alter an active release pointer.

## Reproduction and evidence

`evidence/archives.json` records compressed and original byte lengths and SHA256 hashes. Gzip streams are deterministic (mtime zero); screenshots retain their original bytes. Exact frozen HTML and observer/workload scripts accompany the receipts, including diagnostic/unrun versions. Repository scripts were subsequently formatted and given explicit lint globals; archived frozen scripts remain the checksum authority for the completed source measurements.

- `scripts/prepare-fpv-current-performance.mjs ADMITTED_D41_PLAYER NEW_DIRECTORY [--readiness]` builds the explicit host source overlay at a compatible recorded source commit; it refuses unrelated input changes or replacement of a frozen directory.
- `scripts/prepare-fpv-quality-abba.mjs BASELINE_FIXTURE CANDIDATE_FIXTURE NEW_DIRECTORY` verifies and reuses the pinned A/B files, allowing only the host bytes to differ.
- `scripts/analyze-fpv-current-performance.mjs RECEIPT NEW_ANALYSIS` and `scripts/analyze-fpv-quality-abba.mjs RECEIPT NEW_ANALYSIS` reproduce descriptive summaries and refuse output replacement. Quantiles use the lower sample at `floor((n-1)*p)`.
- Existing `authoring/fpv-worlds/mode-editor/stage-admitted.mjs` verifies the actual admission/envelope/archive and stages immutable members. `scripts/prepare-fpv-current-performance.mjs STAGED_PLAYER NEW_DIRECTORY --admitted-readiness` requires its exact sibling staging receipt and every member checksum, uses no overlays, and preserves native URL resolution.

Browser checks retain normal native clock and lifecycle guards. They do not establish controller/mobile hardware usability, offline behavior, full proof completion, storage eviction resistance, pixel fidelity across hardware, sustained thermal behavior or the full deferred D6 qualification.

At publication preparation, main `feeaf4d077b075c1c767c2bab388ce346281ff87` differs from the integrated ade4 base only in DeepWiki/tooling files and a new `ai:inventory` package script. A bounded GitHub compare/blob read confirms none of the 95 admitted input paths changed and package version remains 0.142.4. That comparison is retained without downloading the unrelated partial-clone history. Normal expected-head branch update and protected checks still apply.
