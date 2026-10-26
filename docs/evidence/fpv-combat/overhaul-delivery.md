# FPV SIM overhaul — delivery log

> Current consolidated status, remaining gates and estimates: [FPV SIM current plan](../../fpv-sim-current-plan.md). Historical figures below retain their recorded source scope.

Working branch: `codex/fpv-flight-widgets-world-picker`. This work remains in the isolated `go_test_radio_fix` checkout. No publication or push has been requested.

## Latest flight-continuity follow-up

The [20 October boundary follow-up](overhaul-seamless-boundary.md) removes forced pauses when leaving and returning to a regional encounter and fixes a terrain-residency deadlock. Aircraft flight continues with the existing roster held in place; accepted flight-only intervals remain recoverable and replayable. Actual Railway Valley flying passed exit, return and firing without rearming. Existing physical terrain and outer-map admission remain enforced.

## Latest visual follow-up

The [20 October combat-settings follow-up](overhaul-combat-settings.md) makes Full gore state and its individual controls visible, fixes silent recovery/playback actions, and verifies file pickers, native recovery and installed regional playback. It passes 273 targeted automated checks plus actual browser journeys.

The [20 October organic-detail follow-up](overhaul-organic-detail.md) adds richer body parts, layered wounds, stronger sprays and contact-bound blood pools, and records the missing Realistic pack found in the user's local SIM. Its new visual evidence supplements the earlier phase reports below. Earlier performance figures do not qualify these additional visual details automatically.

## Implementation and acceptance are separate

| Phase | Implementation | Evidence and remaining gates |
| --- | --- | --- |
| 1 — Shared correctness and immersion | Swept fragment settling and saved poses; independent destruction preferences; military actors; close adjustable Chase and FPV props | Targeted settling/recovery checks and both package closures pass; representative visual evidence is retained. Final sustained performance remains separate. |
| 2 — Weapons and resources | Four weapons, two equipped slots, three payloads, three ammo presets, health/assistance, pickups, pad service, extra radio bindings, Strike | Runtime and host checks pass within their documented scopes. Physical radio, complete map/loadout economy and subjective feel remain separate. |
| 3 — Character destruction | Twelve-region Current recipes; revised optional r2 military art with connected regions and caps; shared Studio preview | The 51-scene roster/settings matrix and r2 lifecycle checks are recorded. Human visual acceptance and sustained full-app r2 performance are not established by those fixtures. |
| 4 — Catalogue and Studio | Versioned encounters, shared selectors, production authoring, stable-ID import, preview controls | All 7,420 catalogue cases pass admission, three accepted steps, recovery and replay on the final geometry source; complete navigation/objective and human economy qualification remain separate. |
| 5 — Survival | Timed and Endless, 64/96/128 requested populations, local pursuit and formations, elites/final encounter, supplies/challenges | Four full-app runs completed (10–14 minutes); strict 60 FPS at larger populations, resource economy and human play quality remain open. |
| 6 — Release | Automated and browser checks underway | Performance thresholds and five-player formative sessions; release approval remains dependent on these gates |

## Confirmed checks during integration

Reports overlap; their counts must not be added into a unique test total.

- **Final broad integration run: 604 passed, no assertion failures, one timed-out regional endurance check.** That check ran under catalogue-worker contention; all four full-session checks subsequently passed in isolation, including the 36,017-tick regional endurance case (128.16 seconds). Radio signals in those tests are simulated. The earlier 584/584 run is retained as historical evidence; see [regression summary](overhaul-regression-summary.json).
- **142/142 historical checks:** original world runtime, aircraft adapters, Advanced workers/terrain/storage and demonstration encoding. Log: `/tmp/fpv-overhaul-history-regression.log`.
- **29/29 host lifecycle checks and 153/153 separate existing UI checks:** accepted-step snapshot reuse, asynchronous ownership, replay cleanup, archive-prefix forwarding, health visibility across overlays, result configuration labels, combat 2×/4× playback and preset-specific resupply guidance. See [final coverage audit](overhaul-final-coverage-audit.md) and [ammunition review](overhaul-ammunition-review.md).
- **12 isolated autosave and seven focused host checks:** complete large-save fallback, fresh-host Continue, legacy saves, failed transaction preservation and asynchronous ownership. Actual browser fallback and refresh → Continue restored the complete 7,180,077-byte save: 42,134 ticks, 1,730 defeats, 4,194 shots, and both 1,024-record presentation arrays. No file reimport was used. See [large-save browser proof](overhaul-large-autosave.json).
- Runtime, replay, archive and admission evidence is maintained in [runtime qualification](overhaul-runtime-qualification.md).
- **7,420/7,420 catalogue cases:** all 371 exact entries, both physics backends, paired recovery and fresh replay. The strict merge checks complete inventory coverage and 17 matching source fingerprints. See [final matrix](overhaul-catalogue-matrix.json).
- **51 production visual scenes:** all 36 family/cast identities, eight Blood/Brutal/Remains combinations and three impact samples. See `overhaul-visual-matrix.json`. These are rendering inspections, not human quality scores.
- **128-actor Realistic fixture:** all living actors represented with shared poses and no Current-art fallback. See `overhaul-crowd-art-browser.json`.
- Actual browser recovery of an older 96-population save passes after waiting-slot migration. See `overhaul-app-96-recovery-fixed.json`.
- Actual Realistic download and three repeated browser attempts complete without page errors. See `overhaul-app-lifecycle.json`.
- Short archive capture/export/playback/Continue browser cycle passes; precise minute-length scope is in [archive browser checks](overhaul-archive-host-browser.md). The final actual browser playback also verified the complete **42,134-tick** archive (842.68 simulation seconds), including the prefix outside the live recovery window; see [long archive replay](overhaul-long-archive-replay.json).
- **11/11 package checks** passed. [Package measurement](overhaul-package-measurement.json) includes both runtime and source closures. Worlds source reaches the 210-file ceiling.
- **54/54 presentation and batching regressions:** whole-cluster budgets, independent effect settings, grounding/recovery, ring ordering and resource ownership pass after the final rendering fix. The packed projection matches fresh deterministic generation byte-for-byte; see [final source checks](overhaul-project-validation.json).
- Changed-source lint passed. English/Ukrainian localization passed with 13,799 messages and 7,441 references. Full validation is blocked by intentionally omitted sparse-checkout authoring inputs; see [validation limits](overhaul-project-validation.json).

## Package and workspace status

Source was remeasured after the 20 October boundary follow-up. The [latest package receipt](overhaul-seamless-boundary-packages.json) supersedes the earlier package sizes:

| Package | Runtime files / bytes | Source files / bytes |
| --- | ---: | ---: |
| Flight gym | 95 / 3,751,549 | 97 / 3,786,409 |
| Academy | 145 / 11,959,312 | 147 / 12,001,261 |
| Worlds | 208 / 19,139,698 | 210 / 19,189,924 |

All current package envelopes pass. Worlds reaches its source-file ceiling; its source-input byte headroom is 639,683 bytes. Academy's source-input byte headroom is 129,929 bytes. Synthetic candidate admission is not publication approval.

At the user's request, [safe cache cleanup](safe-cache-cleanup.md) removed 526,050,425 bytes of recognized disposable cache entries. Projects, Git history, uncommitted work, installed dependencies and saved application/browser data were preserved.

The [player guide](player-guide.md) and [local preview notes](overhaul-release-notes.md) describe the delivered controls and behavior. A [human qualification checklist](overhaul-human-playtest.md) is ready for the deferred radio check and five-player sessions; all participant results remain pending.

## Performance and catalogue status

Reference: Apple M4 Pro, 14 logical CPUs, 48 GiB memory, headless Chrome 155 with ANGLE Metal, 1920×1080. Timing uses isolated automated browser runs, not the user's radio session.

Before snapshot-copy optimization, the 20-actor ten-minute run met 60 FPS. The 64-actor run averaged 55.11 FPS and the partial 96-actor run averaged 45.7 FPS. **Those large-population runs did not meet the 60 FPS gate.** Profiling found repeated full-state copies; accepted-boundary snapshot reuse now reduces this work. New timings must qualify the changed build.

The first baseline catalogue sweep was interrupted by disk exhaustion after exposing Canal City restore failures. The next complete sweep covered all 371 entries and 7,420 cases: 7,390 passed; 30 Standard restore cases failed at three Hillside Town starts. The complete reports are preserved in `catalogue-pre-hillside-fix`. A bounded geometry-proof correction passes all three pinned starts, six focused regressions and nine historical restore scenarios. The final full sweep now passes **7,420/7,420**, including all 60 cases at the three repaired Hillside starts. All 17 source fingerprints match, the strict merger succeeds, and all twelve workers exited before browser timing began.

Final isolated runs use Current art, High graphics, Full gore, native `stadium-01`, scripted hover/yaw/fire, Balanced ammunition, invulnerability and one-hit enemies. CPU is synchronous animation-callback work; it excludes asynchronous worker work. GPU timing samples the actual flight-view render call, including its internal passes, and excludes the browser compositor and other contexts.

| Requested population | Wall-clock duration | Average FPS | Frame p95 | CPU p95 | GPU p95 |
| --- | ---: | ---: | ---: | ---: | ---: |
| 20 | 600.2 s | 60.00 | 16.7 ms | 5.7 ms | 1.942 ms |
| 64 | 600.2 s | 59.75 | 16.8 ms | 9.3 ms | 2.354 ms |
| 96 | 601.0 s | 59.47 | 16.8 ms | 12.3 ms | 2.330 ms |
| 128 | 840.3 s | 58.61 | 16.8 ms | 15.4 ms | 2.422 ms |

All four completed without page/resource errors or flight suspension. GPU samples were valid with no disjoint readings, lost contexts or query errors. **The strict whole-run 60 FPS gate remains unmet at 64, 96 and 128 requested actors.** Frame p95 near the refresh interval does not override that result; the 128 run's frame p99 was 33.3 ms.

Population varies during combat. The 20-target Continuous run ranged from 0–20 living actors and recorded 36 defeats, 3,630 shots, a full impact ring and 36 destruction records; its largest accepted burst was two defeats. Separate no-Fire intervals held exactly 64 actors for 60 seconds, 96 for 55 seconds and 128 for 60 seconds. Their averages were 59.99, 60.00 and 59.67 FPS respectively. These intervals do not establish ten minutes at each full living population.

The Survival runs recorded 652, 865 and 1,730 defeats. Maximum mixed-material defeats in one accepted step were 48, 70 and 75. The 128 run filled both 1,024-record cosmetic rings while retaining the full defeat count. These are accepted gameplay events under the stated assistance settings, not a claim about unassisted game balance.

The 14-minute run crossed the live recording window: its paused end was tick 42,134, with live recovery beginning at 6,000. A complete 15-segment archive retained ticks 0–42,134. Restoring the bounded recovery retained 1,730 defeats and 4,194 shots. The first full archive playback attempt exposed a hidden speed selector; pausing also exposed an oversized local recovery save. After fixing replay visibility, actual browser playback verified the complete 42,134-tick chain with no errors and `accepted-dynamics-v1` physical-boundary verification. Selected 4× playback took 360.29 wall-clock seconds; selected speed is not a claim of sustained literal 4× throughput. See [long archive replay](overhaul-long-archive-replay.json). Actual large-autosave fallback also passed refresh → Continue, preserving the full gameplay and presentation counts. Visible presentation returned with 767 settled pieces and 38 marks; culled/pending fragments are not all revalidated by that observation. See [large-save browser proof](overhaul-large-autosave.json). The original failed receipt remains in [full-app results](overhaul-app-stress-final.json).

Before the final batching/order repair, the corrected controlled renderer comparison completed eight 75-second measurement windows, with fixed 128-actor workloads, both full logical rings, scheduled mixed-material bursts and continuously enabled Full gore in On windows. It uses a native scene and a synthetic regional floor; it does not exercise production regional admission, aircraft physics or the complete application.

| Controlled scene / art | CPU p95 Off / On | Observed difference | GPU p95 Off / On |
| --- | ---: | ---: | ---: |
| Native / Current | 3.0 / 4.8 ms | +1.8 ms | 2.482 / 2.667 ms |
| Native / r2 | 2.5 / 5.9 ms | +3.4 ms | 4.680 / 5.733 ms |
| Synthetic regional / Current | 1.9 / 4.6 ms | +2.7 ms | 1.231 / 1.392 ms |
| Synthetic regional / r2 | 2.4 / 5.7 ms | +3.3 ms | 3.388 / 4.365 ms |

**On that pre-repair revision, forced-Ultra r2 exceeds the +3 ms CPU target in both scenes.** Current art passes this particular renderer comparison. Enabled samples rendered 745–1,536 settled pieces, up to 512 moving pieces, and 69–92 marks; periodic restoration and culling explain variations. Full logical rings are not a claim that every retained object is visible simultaneously. No browser, art-identity or support-response errors occurred. The earlier fixture with invalid attachment coordinates is preserved as invalid evidence and excluded. See [controlled results](overhaul-effects-workload-final.json) and [performance qualification](overhaul-performance-qualification.md).

The long full-app timings above predate the replay-control, durable-autosave and final presentation batching/order fixes; renderer/runtime fingerprints are embedded in the report. Full-app Realistic, Advanced and regional timing, complete boundary-crossing stress, and human gameplay quality are not established by the native Standard workload or the controlled renderer fixture.

## Final rendering follow-up

A shorter High-detail diagnostic exposed a real presentation defect: r2 living actors rendered correctly, but complete r2 remains exceeded the draw-call budget and silently used Current art. The runtime now batches each opaque body region with its damage cap, retaining all twelve regions, original UVs/normals, masked hair and equipment. Budget pressure defers whole logical clusters while preserving the selected authored appearance. The downloaded art revision is unchanged.

Actual browser checks pass for all 36 identities individually, eight representative preference combinations, shader linking and three rebuild/dispose cycles. This smoke report records the pre-format source hash; the final packaged diagnostic is recorded separately. Each individual identity shows one complete twelve-region authored cluster within High's 24-call limit. The mixed fixture renders four complete authored clusters at 23 calls; it does not claim that every retained cluster is visible. Additional derived buffers total 6,581,322 bytes; combined living-crowd and effects resources remain within the 128 MiB decoded / 160 MiB GPU limits. See [browser evidence](overhaul-cap-batching-browser.json).

Ring ordering now caches exact world-camera and ledger membership changes and computes each distance once when sorting is required. Full mark quotas no longer query invisible impact support. These changes preserve both logical rings and support revalidation. The generator also now uses a valid formatting width before its existing lexical projection; this fixes a Prettier infinite-allocation path exposed by the shader literals.

The final packaged native/r2 diagnostic uses four 30-second measurement windows, with five seconds of warmup per condition. It imports the regenerated application bundle and records both final source hashes. The two enabled phases each emitted all 18 scheduled burst groups across warmup plus measurement, kept both 1,024-record rings, and stayed within their draw budgets.

| Final native r2 detail | CPU p95 Off / On | Observed difference | GPU p95 Off / On |
| --- | ---: | ---: | ---: |
| High | 2.7 / 3.8 ms | +1.1 ms | 4.552 / 5.217 ms |
| Ultra | 2.4 / 4.3 ms | +1.9 ms | 4.709 / 6.748 ms |

Both short CPU comparisons are below the 3 ms target. High samples show 3–5 complete authored clusters and Ultra 11–31; the whole retained ledger is not simultaneously visible. No page, shader, support, appearance or GPU-query failure was found. One unattributed console HTTP 404 remains in the measured receipt; a separate five-second bootstrap check reported no failed resources and did not identify that earlier 404. These results qualify this short renderer comparison only. They do not replace the earlier ten-minute renderer experiment or the longer whole-application performance gates. See [final packaged comparison](overhaul-effects-batching-diagnostic.json).

## Qualification limits

- Revised r2 uses the existing adapted character model with improved military clothing, equipment and destruction geometry. It is not a newly commissioned photorealistic sculpt.
- Local pursuit uses admitted routes, supported positions, body sweeps and separation. The catalogue pass checks admission, three accepted steps, recovery and replay. Complete route navigation and objective completion require separate gameplay qualification.
- Earlier evidence in this directory applies to earlier builds unless a new report explicitly identifies this overhaul revision.
- The user has deferred the new physical-radio check. Earlier confirmation of flight and Fire does not qualify the added payload/reload/switch commands.
- No five-player study, subjective satisfaction score, or final performance threshold is claimed without recorded evidence.

The local preview remains unpublished. Larger-population frame-rate targets, sustained Realistic effect cost on the final revision, the unmeasured full-app workloads and human/device qualification remain open release gates.
