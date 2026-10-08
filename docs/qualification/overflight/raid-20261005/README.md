# Overflight: Raid / Проліт: Наліт — implementation review

This candidate adds objective-driven contact hunting to the existing Overflight player. It is ready for functional and design review. The implementation and automated evidence do **not** complete the hardware, pacing or player-testing acceptance gates.

Implementation commit: `e4162d2124eb8543d631ef7341bb89a807f3c4a7`. [Draft PR #1118](https://github.com/mekhovov/revealline/pull/1118) is stacked on the existing presentation PR #1117. The [implementation receipt](implementation-receipt.json) binds every changed source file. The simulation reports were produced before committing; their source hashes were checked against this commit. Follow-up `3b52dd926` clears a stale screen-reader announcement on Retry; **28 focused tests pass** ([TAP](ui-followup-tests.tap)). The simulation and renderer did not change.

## Delivered behavior

| Phase                        | Implemented                                                                                                                                                                                                 | Evidence boundary                                                                                                                                                |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| H0 — contact foundation      | Deterministic 60 Hz contact combat, moving-body swept intersections, exposed infantry, directional shields, brace recovery and segmented machinery; shared native appearance and renderer                   | Core regression tests cover contact ordering, damage and rewards. Native images show the cues; images cannot establish readability in motion.                    |
| H1 — hunting loop            | Finite packs and committed routes, three objective sectors, bounded boost refunds, score chains and stored Rush; earlier survivors remain active                                                            | Automated pilots use ordinary steering, boost and earned upgrades. Their success establishes reachability under those inputs, not human enjoyment or difficulty. |
| H2 — complete Raid           | Three encounter sets, seven objectives including the final tank, six guaranteed and two optional drafts, nine upgrade families with two ranks, airframes, results and separate time/score records           | Native gameplay, animated card and results screenshots are included. First-player pacing, build preferences and long-term replayability require playtesting.     |
| H3 — creator and integration | Separate Raid project/package identities; shared native host, profile ownership, appearance, audio, settings and resources; visual route editing, save/load, import/export, installation and native preview | Automated round-trips and a browser author/preview/install/import smoke pass. Actual browser download completion and hardware qualification remain open.         |

Raid uses the shared soldier/machinery roster, selected drone, atlas, effects and remains. It introduces no separate sound mixer, theme owner or application shell. The new Community family keeps Survivor and older Hunt formats distinct. Shared native project ownership preserves local copies when a Community edition is offloaded.

The compiler validates complete formation bounds, exact shared-resource closure, finite population capacity and conservative camera overlap for guard routes. It accounts for surviving earlier packs so later sectors cannot silently exceed the visible specialist budget. Invalid authoring reports a specific error instead of hiding actors or changing combat outcomes.

## Review paths and artifacts

With the repository server running on port 8887:

- Native Raid: `http://localhost:8887/game/overflight/raid.html`
- Creator Studio: `http://localhost:8887/game/studio/raid.html`
- Explicit automated review: append `?reviewBuild=objectives`, `?reviewBuild=sweeper`, `?reviewBuild=pursuer` or `?reviewBuild=breaker`. These runs cannot set player records.
- Controlled capacity fixture: append `?fixture=raid-reference&diagnostics=1`. Keep its evidence separate from ordinary gameplay.

Screenshots:

- [Native hunting](native-hunt.jpg), [upgrade comparison](native-upgrade.jpg), [results](native-result.jpg).
- [Authored Studio project](studio-authored.jpg), [native embedded preview](studio-native-preview.jpg), [installed native launch](studio-installed-native.jpg), [imported project](studio-imported.jpg).

A native gameplay clip reached recording-ready state, but the browser download helper timed out. A saved, reviewable gameplay recording is still outstanding; the screenshots do not replace the motion review required by the plan.

The [Studio smoke receipt](studio-smoke.json) identifies the exact authored project and package. The test changed the title, moved the first leader's route point from X=405 to X=415 with keyboard controls, saved and reloaded it, ran the native preview, installed it and launched the installed content. A file-chooser import restored the same title and route. The canonical exporter/importer produced the same package identity as the browser installation.

The [local import fixture](studio-roundtrip.raid.json) was constructed from the project source observed in the Studio and its exact dependency closure. It is **not** presented as a successfully downloaded browser file. The in-app browser's download event and download helper both timed out. The export UI now retains a direct download link and reports “Package prepared” without claiming completion.

DOM snapshots accompany the Studio images. [Captured browser console output](studio-browser-console.json) includes a `MutationObserver.observe` error without a source URL. Its origin was not established by this smoke test; this report does not claim an error-free console.

## Reproducible checks

**321 tests pass** across Raid, Survivor, Community, shared mode controls and offline closure ([TAP](tests.tap)). Repository validation, scoped ESLint, Prettier and diff checks pass ([validation](validation.txt)). One additional unrelated Community art-cohort test could not run because its tracked source PNG is omitted by the sparse checkout; the broader attempt reported `ENOENT`, and the final available cohort excludes that test file.

Run the relevant focused suites from the repository root:

```sh
node --test game/test/overflight-raid-*.test.mjs game/test/raid-project.test.mjs game/test/raid-community.test.mjs game/test/overflight-project.test.mjs game/test/overflight-community.test.mjs scripts/test-offline-core-closure.mjs
node scripts/qualify-overflight-raid.mjs --matrix --output .cache/raid-qualification.json
```

The automated matrix covers the three encounter sets and objective-focused / pack-hunting builds. Its report includes source hashes, chosen cards, sampled run state and outcomes. The qualification script's CPU timing is **not** a browser render benchmark.

All **12/12 upgraded route combinations** complete in **20.35–53.58 seconds** ([report](route-matrix.json)). All **6/6 baseline-kit routes** complete in **22.13–63.35 seconds** ([report](baseline-capability.json)). That is not evidence for the intended **4–7 minute first-player completion** target. Fast objective routes are allowed, but the large difference must be reviewed with actual players before declaring pacing complete. Do not add an artificial waiting timer or kill quota merely to make a recorded duration match the target.

The [900-second deterministic simulation soak](simulation-soak.json) completes 54,000 fixed steps with exactly 537 active / 200 visible actors, 7,475 kills/recycles and 1,012 projectiles. Effects, projectile and attack pools stayed within their limits. This exercises simulation lifecycle and pool behavior. It is **not a GPU soak**, a graphics-context recovery test, or proof of stable browser memory over 15 minutes.

## Local browser qualification

The [three independent trials](local-trials-report.json) pass on an **M4 Pro MacBook Pro, 48 GB RAM, macOS 26.7.1, AC power, default power mode**, using the in-app Chromium browser (Chrome 154 user agent). Each uses a fresh 30-second warm-up and a 120-second measurement, 1920×1080 viewport, DPR 1 and 960×540 backing. This is **not the Iris Xe or M1 acceptance run**.

| Trial | Render FPS | p95 ms | p99 ms | Frames over 33.3 ms |
| ----- | ---------: | -----: | -----: | ------------------: |
| 1     |     119.83 |    9.2 |    9.9 |                  0% |
| 2     |     118.16 |   10.4 |   12.9 |                  0% |
| 3     |     117.81 |   11.1 |   13.8 |             0.0354% |

Raw intervals, simulation/submission samples and resource samples are retained in the three losslessly compressed `local-trial-*.json.gz` files. Foreground stalls remain in the measurements. All samples preserve 537 active / 200 visible actors and one canvas. Atlas storage is 16,908,544 base RGBA bytes (16.13 MiB), below the 32 MiB base budget; retained atlas canvases account for another 16,908,544 bytes. This is not a claim about total GPU/process memory. Audio master was muted by the existing shared preference.

The [native lifecycle smoke](native-lifecycle.json) verifies graphics restoration followed by explicit Resume and ten retries, each retaining one canvas and clearing old HUD announcements. These checks are separate from the frozen performance records. Target-device lifecycle and a 15-minute **rendered** soak remain open. [Separate diagnostics image](native-diagnostics.jpg).

## Open acceptance gates, in priority order

1. **P0 — Human contact and pacing review.** Run the specified five-player test, including two newcomers and two runs per player. Check whether players can distinguish exposed, guarded and machinery contact, plan intercepts, explain upgrade effects, and choose between score and objective routes. Tune meaningful resistance and encounter placement from those observations. The five-player requirement is currently **unqualified**.
2. **P0 — Reference hardware performance.** Execute the three measured trials on the specified Iris Xe laptop and additional M1 Air Chrome/Safari coverage, with exact browser/OS versions, power mode, backing resolution and quality recorded. The Iris Xe and M1 acceptance gates are **unqualified**. Keep the separate 1,500-actor regression fixture and ordinary hunt measurements distinct; record videos outside measurement trials.
3. **P1 — Physical controls and presentation.** Review a physical gamepad, keyboard transitions, pause/upgrade release gating, audio/music listening, warnings above effects and reduced-effects readability. Physical-gamepad qualification remains **open**; synthetic input tests cannot replace it.
4. **P1 — Browser lifecycle and portability evidence.** Complete the 15-minute GPU/browser soak, repeated retries and explicit context-loss/restoration run on the target environments. Verify a real exported file downloads and imports in a fresh profile. Record the explicit cross-mode reuse demonstration; Raid currently reuses existing shared effects and introduces no new standalone art assets. The browser download gate remains **open**, despite passing canonical package round-trips and file-chooser import smoke.
5. **P2 — Follow-on formats.** Time Attack, bank-or-continue Contract Marathon, online ranking and character-specific mechanics remain deferred. Reuse the accepted Raid foundation after the preceding gameplay and integration review.

Publication is a separate delivery action. This report distinguishes implemented functionality from accepted performance, usability and release readiness.
