# Demo counter reference — e025

This is one instrumented functional observation of an earlier performance candidate, before the Demo presentation correction. It is **not** CPU, frame-time, energy, heat, physical-device, or performance-gate qualification. Development work was active concurrently.

- Artifact source: `e0252ff8f6b7f5ac84721fd5994c74e8469fb271`; version `0.151.1`.
- Archive SHA-256: `1f9d32378ca8552248f1e38c697f6bda8ac2cc1b2e5a47ad5e4f27e34fb4a909`.
- Build-info SHA-256: `8c7286ba0cabaaee1afec6677c9c79929c189ecff3f33cb55d3a326e769470c5`; exact production CSP checked.
- Browser: owned headed Chromium `155.0.8059.80`, 1280×800, fresh private profile, `connectOverCDP(noDefaults:true)`.
- Raw attempt: `.cache/solo-followup/demo-counters-e025-01/attempt02.json`; SHA-256 `8baaf956b67d0bc4682bf44697786e7357af7947323fe4f9c90e4f6b7f9f2fcb`.
- Driver: `driver-v2.mjs` in the same directory; SHA-256 `83658759c3af1b117f247e17c593530014e48f07326796b837eea19db8c3a867`. Plan: `plan-v2.json`; SHA-256 `9b1f7c238a89a92916de500bd1a49f57cd60cb49692106f8ad3de99b8f97c921`.

Each counter starts at zero for its window. Separate audio snapshots are explicitly lifetime totals. The namespace is assigned twice; the corrected observer confirms one Game and one frame subscription. A canvas `drawImage` call is a submission count, not GPU completion.

| Window                                   | Requested seconds | Demo paints | Covered game composites | Demo attribute mutations | Data-scene writes | Demo tick change |
| ---------------------------------------- | ----------------: | ----------: | ----------------------: | -----------------------: | ----------------: | ---------------: |
| home-menu-before-demo                    |                 1 |           0 |                       1 |                       54 |                 0 |                — |
| watching-parent-covered                  |                 3 |         361 |                     361 |                    13021 |               722 |              361 |
| spectator-paused-parent-covered          |                 3 |         361 |                     361 |                     6137 |               361 |                0 |
| spectator-paused-details-open            |                 2 |         241 |                     241 |                     4097 |               241 |                0 |
| practice-awaiting-fresh-steer            |               1.5 |         181 |                     181 |                     7240 |               362 |                0 |
| practice-paused                          |                 2 |         241 |                     241 |                    10122 |               482 |                0 |
| practice-native-hidden                   |                10 |           0 |                       0 |                        0 |                 0 |                0 |
| practice-returned-before-explicit-resume |               1.5 |         181 |                     181 |                     7602 |               362 |                0 |
| spectator-after-return                   |                 2 |         241 |                     241 |                     8194 |               482 |              241 |

Watching produced two control-refresh witnesses per paint; paused spectator and practice still repainted unchanged boards. The covered menu scene correctly reported stopped motion and paused CSS animation; no menu WebGL draws occurred in the Demo windows. These counts identify avoidable calls without estimating their cost.

Pause/Resume, takeover waiting for fresh input, explicit practice Resume, Return to spectator, and preservation of the suspended ordinary Solo checkpoint passed. The public ordinary replay before and after Demo was byte-identical, SHA-256 `d7941c57ff575fb25f2131110ab3be2a6b1dd1c676fa4c9e58a15e8854c38fa7`, and strict same-engine replay verification passed after the observed browser closed. No page errors occurred.

Actual native hidden and returned-visible/focused boundary states were observed; practice remained at tick 507 across 10.006 seconds hidden and after return until explicit Resume. The generic 64-event focus ring filled before tab activation, so a separate hidden→visible event sequence was not retained. This is desktop tab visibility evidence, not OS or iPhone suspension.

Default-muted watching and pause windows created no audio contexts or sources. One AudioContext appeared between the hidden and returned-paused windows; its call site was not captured. No buffer, oscillator, or media playback started anywhere in the observation.

Play from beginning reached the ordinary `mode-leave-dialog` consent handoff. The diagnostic did not confirm it or establish new-flight reset completion. Observation browser closed at `2026-10-16T10:54:56.582Z`; the separate verifier completed at `2026-10-16T10:54:57.937Z`.

Attempt 01 remains unchanged and failed before entering Demo: Watch Demo had moved into public Settings → Extras. Its unguarded constructor wrapper also doubled only its Phaser frame counters; those counters must not be used. Raw SHA-256: `032fb3f583fa0957fa66394bd8e6cce2db9e9be7eccb434e3ffb1ed759adcd4a`.

The corrected candidate, complete public fresh-flight handoff, visible-Demo CPU attribution, and quiet matched cohorts remain pending. The prospective 15487 build was aborted; its touch/raster templates were never executed. Detailed scope and all nine raw windows are retained in the adjacent `analysis.json`.
