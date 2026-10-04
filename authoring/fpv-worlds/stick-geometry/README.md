# Observe native stick display sizes

The Worlds HUD previously read each stick's `clientWidth` on every host frame. Candidate `34ddde3ed0416f0e90aae8170101bd6a6c8d08e2` keeps the exact integer padding-box radius (`clientWidth × 0.34`) and samples it when the display size changes. Initial/source/display changes still measure synchronously. An owned native ResizeObserver handles other element/viewport changes and repositions the latest displayed axes before presentation. The absent-observer fallback retains the prior per-frame measurements. Physics, recordings, input pickup and Academy's separate display implementation are unchanged.

This is a Worlds-only change of **+937 original-source bytes**. Its current CSS contract is fixed border-box dimensions, fixed border and no padding. Default content-box observation is not a guarantee for arbitrary future padding-only CSS changes; those require reviewing invalidation. Touch pickup continues using its separate native bounding rectangle. Both stick axes still use width, including nonsquare diagnostic cases.

## Accepted source evidence

The source fixture uses the exact 102-member admitted `0b54fd0fdf8fe06dc900024a8b59713340b09bb3` player. All 95 baseline inputs equal main `21826c460e80fa4e7fa47ec8e6ba9f98f75beea4`; the candidate has one declared, hash-bound host overlay. These are source-browser results, not a package-admission claim.

- Native geometry r4: **1,338/1,338 checks**, 46 cases each for baseline, candidate and an explicitly absent-ResizeObserver candidate. EN/UK, keyboard/touch/device-unavailable display, compact/expanded/setup, phone/landscape, learning layout, genuine nonzero recorded controls, fractional/nonsquare border-box probes, and trusted native fullscreen enter/exit passed. The candidate's 43 callbacks ended with one disconnect and zero retained targets. Every host released all registered renderer resources; warnings/errors/dropped observations were zero.
- Exact-source manual function comparison: **2,400 checks** across 200 EN/UK × Mode1–4 × source × integer-width cases. Synthetic controls exercise display mapping only; this is not a flight proof or physical-device test, and adds no permanent unit coverage.
- Native timing r4: **372/372 checks**, eight 5,000.1–5,002.2 ms windows, each with 601 host callbacks. Candidate steady windows performed zero stick width reads and zero resize callbacks; setup callbacks occurred outside the windows. Baseline performed 601 width reads per stick in each window.

Mean measured **host RAF plus ResizeObserver callback** milliseconds per host callback:

| Scene and phase | Baseline | Candidate |
| --- | ---: | ---: |
| Industrial Yard, fixed Ready pose | 1.706 | 1.249 |
| Industrial Yard, verified native playback | 1.678 | 1.181 |
| Natural Reservoir, fixed Ready pose | 1.652 | 1.101 |
| Natural Reservoir, verified native playback | 1.663 | 1.281 |

These are bounded paired callback observations, a 0.382–0.552 ms difference. They are **not whole-browser/frame CPU, GPU elapsed, input latency or FPS**: avoiding a forced read can move layout into normal browser rendering outside these callbacks. Getter/draw/clone timings are nested, not independent costs. Order was A-yard/B-yard/B-Reservoir/A-Reservoir, one pair per scene rather than repeated same-scene ABBA. Native playback started one tick apart and reached equal final ticks (Yard255, Reservoir253); no clock or input was substituted.

All accepted timing boundaries retained canvas1530×948, viewport1024×720, DPR2, Authored/Balanced/FPV/Self-level/keyboard and actual operations/ukrainian profiles. Ready state and corresponding registered-resource counts matched. Yard playback created the same projectile resources in both variants; Reservoir internal texture counts also matched. Every owner disposed its registered geometries/materials/textures to zero. No focus/visibility loss, resize event, error, warning or dropped observation occurred. Maximum native RAF gap was10.4 ms. Supported LoAF/longtask observers reported no qualifying entries starting in the windows; that does not mean no jank. Browser-reported Chrome154/MacIntel/14 logical CPUs does not identify or qualify physical hardware or exclude other processes.

## Retained failed fixtures

All original receipts, screenshots and r1–r4 fixture sources/manifests remain losslessly archived:

1. r1's observer omitted the beginner catalogue; the course lookup failed before its UI launch.
2. r2 captured the old134px radius immediately after a viewport change and an unchanged-source dispatch. r3/r4 explicitly retain that pre-delivery state and verify native RO corrects118px/40.12px before the following native RAF. No claim of synchronous viewport updates is made.
3. r3 incorrectly expected the right Mode2 roll/pitch stick to use the left throttle-down offset after fullscreen. Corrected r4 compares both axes against captured native input; the production candidate did not change.
4. The initial timing run stopped when candidate canvas1530×948 changed to1531×951. Presets/focus/visibility stayed unchanged, but the old observer lacked enough viewport detail to establish the cause. r4 kept the strict canvas guard and added boundary geometry/viewport metadata. Its success does not establish or fix the earlier cause.

See [the audited results](evidence/native-r4/audit.json), [exact fixture manifest](evidence/native-r4/fixture.json) and [lossless archive manifest](evidence/native-r4/archive.json). The archive contains43 individually hashed files and round-trips3,546,160 original bytes into624,044 bytes. Original authoring/runtime files are not rewritten through immutable hardlinks.

## Reproduction and package qualification

`prepare.mjs` takes an absolute repository path, full source revision and a new output directory. It refuses replacement, verifies committed95 inputs, hashes102 immutable baseline members and declares the single candidate overlay. It deliberately pins the retained local0b54 player/inventory and longer-session r16 data fixture paths; those exact artifacts must be restored before reconstructing it. `functional.mjs`, `timing.mjs` and `probe-host.mjs` are the exact r4 browser sources. Serve the prepared folder on a fresh localhost origin; use **Compare native stick geometry**, then **Measure eight native windows** on `timing.html`. The native fullscreen checkpoint requires entering and exiting via the public Home toggle, then the outer Continue; Escape may only close Home. Export receipt textarea values in bounded chunks.

Full `npm run validate`, 15 existing radio/Worlds appearance controls, and all-three/two-byte-identical optional-package admission passed at clean `d73f573e492978fdbded369d4b009e78d644f296`. Its runtime is byte-identical to the source-browser candidate. The independently rechecked 95 original inputs total16,742,575 bytes, leaving34,641 bytes under the unchanged16MiB ceiling. The exact102-member Worlds stage passed223 checks and reused99 immutable files; ZIP SHA256 `2d383026a18b6394d25d0c43837e251b571c3348ae62b6457a6d248a65aea455`. See [source-bound admission evidence](evidence/admission-d73/manifest.json). The [unmodified admitted-entry smoke](evidence/admitted-8978/manifest.json) passed Home/briefing/Ready/Arm, active18.6s, Pause, Expanded+Touch settings, deliberate Continue, then pause42.1s and Compact+Keyboard restoration. Settings changes/close retained pause, with zero console warnings/errors. This is not flight completion or a new physical-touch test. This does not claim a default full-game build or final D6 coverage. No package limit, proof guard, catalogue row or merge authorization is changed. The human main merge hold remains in force; the focused PR remains a draft until normal publication is permitted.

The narrow rationale follows [browser guidance on avoiding forced layout](https://web.dev/articles/avoid-large-complex-layouts-and-layout-thrashing) and [ResizeObserver's native before-paint delivery](https://developer.mozilla.org/en-US/docs/Web/API/ResizeObserver). These references explain the method, not a promised latency gain.
