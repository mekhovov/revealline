# Overflight rebalance qualification

Runtime candidate: `ca03d7d7d84dcf50bbab6d2734a6d09097e27ed6`. This revision preserves early power while making position, heading, target priority and changing encounters matter. See [implementation map](IMPLEMENTATION.md), [approved scope](PLAN.md), [Raid results](raid-README.md) and [boundary correction](BOUNDARY-CORRECTION-REVIEW.md).

## Delivered

- Explicit Survivor V3, Riy V2 and Hunt V3 content with balance revision `overflight-balance.v3`; legacy authored projects retain their rules and Studios offer an upgraded copy.
- Body-clear escape checks, attack-shape-aware replacement, immediate steering after menus and deliberate boost/Focus release.
- Committed standoff attackers, continuing attacks during arrival relief, bounded ground patches and varied pursuit/flanking formations.
- Rear-anchored Echo, preserved Fan/charged Pulse roles, useful bounded shield recovery and stored Overdrive.
- Separate Riy Sweeper/Breaker progression, directional coverage, visible Focus candidate and bounded approach/engagement.
- Raid rear weak points, multiple distinct boosted passes per opening, linked guards, capped Marathon refits and authored provisional Time Attack medals.
- Shared compiled parameters in native play, animated cards and Studios; separate results identities and damage causes.
- Latest-main menu integration repaired: operation choices remain on Home and all five choices are reachable in both directions by keyboard/controller.
- Surviving crossing/flank packs resume pursuit after reaching a boundary instead of accumulating against it. Initial passes remain committed; legacy movement is unchanged.

## Reproduced unattended win

Riy front, Standard, seed 17031991, three airframes, earned Echo build, Focus disabled:

| Rules / continuation | Result |
| --- | --- |
| Legacy, active | Win at 322.43 s |
| Legacy, no input after 210 s | Win at 334.57 s |
| Final candidate, active | Win at 418.28 s |
| Final candidate, no input after 210 s | Loss at 222.42 s |
| Final candidate, no input after 240 s | Loss at 250.17 s |

The revised build uses the legal squad slots. No-input continuations still resolve earned drafts and remain unattended after replacements. Exact earned states, source hashes and damage causes are retained.

The original 48-configuration matrix belongs to `14649912b`: 31 active wins and zero wins across 184 unattended/repetitive continuations. It exposed boundary accumulation, prompting the final correction. That receipt remains preserved as pre-correction evidence.

## Final balance matrix

The completed final-source matrix contains **48 configurations and 236 outcomes: 19 active wins and zero wins across 188 unattended/repetitive continuations**. One active prefix lost before its assigned checkpoint and therefore has no mature unattended counterpart. The two disjoint 24-configuration executions share all twelve runtime hashes, matching `ca03d7d7`; the merger verifies unique configurations, complete route sets and exact checkpoint coverage. All forty outcomes from the earlier eight-configuration follow-up reproduced exactly.

| Mode / selection policy | Active wins / 6 | Standard wins / 3 | Veteran wins / 3 |
| --- | --- | --- | --- |
| Survivor Fan + Shield | 6 | 3 | 3 |
| Survivor Echo + Pulse | 0 | 0 | 0 |
| Survivor Echo + Shield, excluding Pulse | 2 | 1 | 1 |
| Survivor systems / priority | 1 | 1 | 0 |
| Riy Fan / broad Sweeper / burst Breaker | 4 | 2 | 2 |
| Riy Echo / trail Sweeper / burst Breaker | 1 | 1 | 0 |
| Riy Echo + Shield policy label | 1 | 0 | 1 |
| Riy systems / broad Sweeper / chain Breaker | 4 | 2 | 2 |

Riy's two Echo policy labels select the same trail/burst/Shield build, with different airframe coverage; they are not two distinct squad techniques. Seeds are tied to encounter sets, while airframes and 120/180/240-second checkpoints rotate with configuration index. These are sampled configurations, not an independently crossed difficulty/build/seed/airframe study. Every continuation still resolves legally earned drafts. The four continuation routes are no input, tiny movement, pushing against a wall and a small repeated orbit.

There were **zero spawn deferrals** across the final active routes, with peaks of **1,242 alive and 1,005 visible** actors. The prior boundary accumulation no longer saturates the entity pool in these cases. Full per-build timing, damage causes, shield usage, peak populations and earned states are in [the final matrix report](FINAL-BALANCE-MATRIX-REVIEW.md), `balance-matrix-final-analysis.json` and the source-bound compressed receipts.

The original active pilot switches goals to nearby individual pickups. Three additional qualification-only, latched lure-and-return controllers tested Survivor Echo + Pulse on Standard/front/seed 17031991 with three airframes. All three lost, at **292.02, 390.23 and 338.70 seconds**. The compact route earned all ten upgrades and destroyed 3,790 of 3,809 spawned enemies, but the final tank remained. All attempts, including losses, are preserved in [the Echo return report](ECHO-RETURN-REVIEW.md). They used ordinary inputs and earned upgrades without changing runtime values. **A successful Echo + Pulse completion remains unproven**; the separate Echo + Shield and Riy wins do not close that build's acceptance gap.

## Correctness and integration evidence

- Original combined Overflight/Raid/offline suite: **359/359**, with full output in `unit-suite.log.gz`.
- Post-boundary core/balance/Riy/legacy integration: **83/83**.
- Post-main Home/settings, keyboard/controller/touch, password gate and offline dependencies: **134/134**.
- Scoped lint and diff checks pass. New focused tests are registered in the industrial feature registry.
- Raid matrix: **216/216** ordinary routes (including **54/54** baseline-kit routes), **9/9** Time Attack routes, and **8/9** five-contract Marathon routes. The failed Marathon route is retained. All Marathon builds stay at eight invested ranks or fewer.
- Independent final review found no confirmed blocking correctness defect in protection, Focus cancellation, legal drafts, weak-point contacts, armor limits, record partitioning or legacy compatibility.

These test totals overlap; they must not be added into a unique-test count.

## Native lifecycle and media

- `native-soak.json.gz`: 30-second warm-up plus a 900-second native renderer soak. All 1,500 simulated / 700 visible actors remained accounted for. Local cadence 120.13 Hz, p95 10.1 ms, p99 12.1 ms. Raw slow intervals are retained. Concurrent command-line work makes this a lifecycle observation, not one of the three restarted trials.
- Atlas: 883 frames; **16,908,544 base RGBA bytes (16.13 MiB)** plus a separately accounted retained canvas copy of the same size. Within the 32 MiB base budget.
- `native-ten-restarts.json`: ten native same-mission restarts preserve one gameplay canvas and the same atlas allocation.
- Context receipts show actual loss/restoration preserving the sortie and requiring explicit resume. That intentional interruption invalidates its timing trial.
- `native-trial-1-interrupted.json.gz` is an **invalid** early trial: one foreground stall caused 0.0145 s of dropped catch-up time. It is retained and does not count as a passing benchmark.
- `riy-echo-active.webm` and `riy-echo-stop120.webm` compare earned Echo play with no-input continuation. These native captures use the saved Interceptor handling profile (80 hull), not the balanced 100-hull simulation fixture. The unattended native run loses shortly after 120 s.
- `survivor-sweep.webm` shows lateral clearing; its result contains ten upgrades, 2,568 kills, no lost airframes and 80 hull damage.
- Final-source `riy-active-final.webm` and `riy-idle-final.webm` show the matched native comparison. Controls stop at 120 seconds; the unattended run loses at 134 seconds, while active play remains alive past 296 seconds. `riy-gameplay-final.jpg` shows the active battlefield with diagnostics closed.
- `survivor-priority-final.webm` shows the earned Scanner/Pulse/Side Burst build; `upgrade-choice-final.jpg` shows current → next upgrade geometry.
- Earlier clips, soak and lifecycle captures predate the boundary/menu follow-up. `native-media.json` pins media hashes, source revisions, packet spans and scope.
- Clip capture records the battlefield canvas, not HTML upgrade cards/HUD. Screenshots provide those UI views. The saved master mute preference was respected, so recordings do not qualify audio quality.

## Final native performance

Three separately restarted final-source reference trials passed on the available M4 Pro. Each used a 30-second warm-up and two-minute measurement, 1,500 simulated / 700 visible enemies, 1920×1080 viewport at DPR 1 and a 960×540 backing canvas. No recording, build or route simulation ran concurrently. All three have zero dropped simulation time; every foreground stall remains in the raw measurements.

| Trial | Rendered frames/s | p95 | p99 | Worst frame | Frames over 33.3 ms |
| --- | ---: | ---: | ---: | ---: | ---: |
| 1 | 119.83 | 9.9 ms | 12.3 ms | 68.3 ms | 0.0209% |
| 2 | 119.99 | 9.5 ms | 10.0 ms | 18.2 ms | 0.0000% |
| 3 | 119.80 | 11.3 ms | 13.9 ms | 38.1 ms | 0.0070% |

See `native-performance.json`, the three compressed raw receipts and `local-hardware.json`. This is local acceptance, not Iris Xe/60 Hz certification. An additional valid 1280×720 trial is retained separately after discovering the new tab's default viewport; it does not replace any 1080p trial. The earlier invalid stalled trial also remains preserved.

## Creator and offline

Automated integration covers authoring/compilation, export/import into a fresh profile, native adapters, legacy coexistence and offline dependency closure. The UI-authored Riy package `creator-riy-export.json` changes its title and Breaker range to 190, and was validated and played in Studio preview.

The final `ca03d7d7d` canonical package validated successfully. Its 172 inventoried runtime files match committed Git blobs; the complete 3,192-file manifest pins all packaged bytes. The UI confirmed the selected chapters ready offline. The authored Riy package imported into a fresh local origin, re-exported byte-for-byte, and launched natively. After the owned package server was stopped and the origin confirmed unreachable, imported Riy advanced to its first draft at 22 seconds. Raid, Survivor and Snake also launched and advanced offline. See `canonical-offline.json` and the native UI receipts. These are short offline runs, not storage-eviction or full-sortie endurance evidence.

The earlier `14649912b` build and failed offline download during disk exhaustion remain preserved as superseded evidence.

## Tuning and evidence boundaries

- **Implementation is complete; balance acceptance is partial.** The named unattended-win exploit is no longer reproduced, ordinary active completion routes exist in both modes, and the final matrix has no unattended wins or population-pool deferrals. Those results do not establish reliable completion for every intended build or an enjoyable human difficulty curve.
- **First follow-up: establish an Echo + Pulse completion route and review its cost of making return passes.** It won none of six original-pilot configurations or three explicit return-route attempts. The compact return route shows strong clearing but still fails the final encounter. Review route readability and survivable approaches before changing damage, XP or contact rules; do not treat a stronger pilot as proof of ordinary player enjoyment.
- **Next: late collection and progression pacing.** The final matrix's longest earned-choice gap is 126.68 seconds. Large uncollected salvage piles remain conserved, so globally lowering thresholds would also accelerate already successful Fan builds. Initial choices occur at 15.45–19.88 seconds; Survivor evolutions range from 39.85–82 seconds and Riy evolutions from 64.5–101.25 seconds. The early Survivor end of that range and late collection stalls need a pacing review against the intended progression windows. Tenth-choice timing includes only runs that earned ten choices.
- **Next: crowd composition and build parity.** Some peaks exceed the intended 600–800 visible design envelope, up to 1,005 in the matrix and 1,091 in the extra return probes. This is a composition target, not an actor-hiding limit. Fan's 6/6 Survivor wins and the weaker control/priority policies warrant comparison on matched routes; they do not justify universal stat changes by themselves. Final native performance results must be read separately.
- Automated pilots establish reachable routes and expose exploits. They do not establish human enjoyment, ordinary first-run difficulty or valid medal timing. Raid's very fast expert routes are valid and are not used to set medals.
- Previously waived Iris Xe/Windows, M1 Safari, physical controller/phone and five-player trials remain **skipped, not passed**.
- Available native hardware: Apple M4 Pro (Mac16,7), 48 GiB RAM, macOS 26.7.1 (25G241), Codex Chromium 155, approximately 120 Hz. This is not a certification of the Iris Xe/60 Hz target.

## Preservation and Git

Parent PRs #1163 and #1171 merged while this work proceeded. Main `c4042d563` was merged without rewriting pushed history; this PR targets main. At final review, main had advanced to `d8bca5ac2`; a read-only merge check succeeded with no conflicts. The tested runtime stays pinned to `ca03d7d7` rather than relabeling unrelated later main changes as tested.

Disk exhaustion repeatedly interrupted evidence writes. Atomic compressed receipts, original prefixes and failed logs preserve the history. Safe recovery used disposable HTTP/compiled caches, independent APFS copies of byte-identical committed files and lossless filesystem compression of closed historical logs. Paths, logical contents and modification times were preserved and hashes verified; no source, commits, unfinished changes or history were deleted. Private log paths remain in a local cleanup receipt rather than this repository.
