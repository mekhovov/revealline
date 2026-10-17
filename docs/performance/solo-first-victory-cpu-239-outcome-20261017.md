# First-victory CPU profile on 239: failed route, retained attribution

[Run 39054542080](https://github.com/mekhovov/revealline/actions/runs/39054542080), job 117459771015, failed on 2026-10-17. Tooling was `92ff7ef800e542617b4fc3efad96bd07ce6cbecb`; the admitted runtime remained `239c574ecddd5bb6d5896e621d9edc53e7f6a313`, tree `1ac7f17971498d2a8be19085f00a9f732db42798`, package artifact `12107584924`. The remote full package/archive/source checks passed. No local full package or browser was used.

This was one Chromium attribution observation at fixed CPU factor 2.42, not a newly calibrated host or a timing qualification. Runtime 239 excludes the subsequent replay initialization/record/publication admission and lazy Library changes shipped with tooling 92ff. The prior e1cc checkout failure remains unchanged and contains no native finding.

## Observed failure and retained correctness

The public first-return route reached victory at tick 645, three lives. The ArrowDown release was invoked at route-relative 5362.331 ms and exceeded the unchanged 100 ms keyboard deadline. The route failed after 5461.006 ms. No retry occurred. The report retains the invoked release and held-key state; final browser/process cleanup does not turn that action into a successful input observation.

The partial public replay is 5,563 bytes and passes strict same-engine Chromium reconstruction, including the full recorded checkpoint. Node portability separately reports an enemy-state mismatch. The original `failed-scenario-partial-play` scope, failed native recipe, and failed profile-completion gate remain. Actual profile bytes are retained despite that gate: stop reason is `scenario-failure`, rather than the required successful `actions-ended`.

All four intake/native command owners closed; the native command exited 1 with no forced cleanup, ambiguity, violation, or survivors. There were no page errors or failed responses. The independent ZIP-only source/replay/owner reader confirmed these facts.

## Actual terminal work

Application markers on the page's performance clock place victory at 23170.7 ms, terminal work at 23179.4–23270.3 ms (90.9 ms), and the enclosing update at 116.7 ms, with 12 ms simulation and 5 ms HUD. The binary journal independently retains a 120 ms measured work window, a 140 ms native task, and the 133.3 ms running-to-picture interval. These overlapping observations must not be added together; previous-phase interval attribution is not callback execution time.

The 23.309-second CPU profile contains 23,694 samples and 6,154 nodes. Distinct descendants of the terminal app update identify:

| Sampled subtree                                 | Weighted sample estimate | Source evidence                                                                                                               |
| ----------------------------------------------- | -----------------------: | ----------------------------------------------------------------------------------------------------------------------------- |
| `campaignKey → normalizedLevel → validateLevel` |                30.916 ms | `game/library.mjs:124`, terminal call at profiled `game/app.mjs:11765`                                                        |
| Journey clear `record`                          |                 4.704 ms | `game/journey/profile.mjs:759`                                                                                                |
| `exportReplay → authoritativeCheckpoint`        |                26.491 ms | `game/replay.mjs:490`; checkpoint contributes 25.397 ms, including 17.249 ms under checksum                                   |
| Performance `capture → verifyPerformanceRecord` |                24.184 ms | `game/journey/performance-store.mjs:197`; record inspection contributes 13.653 ms and async-verifier initialization 10.531 ms |

These are estimates from the retained sample deltas, not exact function durations or additive child/parent timings. Eight tiny negative deltas totaling −15 µs are preserved, not clamped. The analyzer's initial nonnegative-delta assertion was retained as `analyze-v1.py`; the corrected reader reports those values explicitly. There is no explicit CDP-to-page clock synchronization, so profile offsets and page markers remain separate. The unique terminal branch, stack ancestry, and call order support attribution without claiming exact clock alignment. Native raster, GPU, worker, and scheduler costs are not fully observed.

Read-only comparison with 92ff finds that the campaign validation and synchronous replay export still exist. The performance prefix is addressed by the later initial-verifier and per-record admission fixes; envelope admission covers a later path. The 92ff terminal code also reuses one gameplay identity instead of computing it twice. This source comparison is not a measured 92ff speedup.

## Evidence

Original ZIP-only retention: `.cache/solo-followup/cpu-239-outcome/39054542080/12109315891/retained/`. Artifact `12109315891` is 456,596 bytes, SHA-256 `b01c4c4218ba7b450029cdd5823deb4bff5ae761379d3ad5ae0dd2f6f7a2b895`; all 35 members (2,664,339 decoded bytes) passed full CRC/size/SHA readback. No duplicate member expansion was needed.

Within the ZIP, the report/profile/journal/replay share the prefix `solo-linux-first-victory-cpu-239-first-victory-cpu-profile-chromium/evidence/first-victory-cpu-profile-chromium-candidate/`:

| Member                        |   Bytes | SHA-256                                                            |
| ----------------------------- | ------: | ------------------------------------------------------------------ |
| `report.json`                 |  323744 | `777c9902e92643b5ad37d504f5a355e91f61541e6b06b116319b0f5aa44c0258` |
| `report.json.cpuprofile`      | 1490210 | `b50f205df3c6ca919a98453dd0faf1da3da6fbd5673018de4d6fe2cf8efb21ee` |
| `report.json.hitches.d01.bin` |    3288 | `7bea4c03aea9c90e020ad27fd292a92ff775368a3df7bd9c68733697a6a34e0b` |
| `report.json.replay.json`     |    5563 | `4838ac9ddc0a76d57f48f1404991121911bf32cbace9ce051b45e1b050871e9a` |
| `command.json`                |   25716 | `4ae20d29696196a8b3a8b7891b0ce2ea65593c99f9892efb85cd1ea213850b0c` |

Independent analysis: `.cache/solo-followup/cpu-239-outcome/terminal-analysis.json`, 32,805 bytes, SHA-256 `88837f226e0bdc58050dba54bd32fff8d3953715f20cc3fea24996c457c94a86`. Separate peer readback: `39054542080/12109315891/peer-source-replay-owner.json` under the same cache root, 3,152 bytes, SHA-256 `17e58e8958dcc7559c552d3e8d9476802777b2d7e7c807d9a603d6de910df744`.
