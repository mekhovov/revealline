# Bounded demo loading and recoverable observation

Production and harness source: `55c5ec57cc1ed478b44e065951073c0bdd3c3ead`. This is a continuation of held draft [PR #781](https://github.com/mekhovov/revealline/pull/781), with no version allocation, release admission or publication. Historical failures and partial runs in the [parent record](../README.md) are preserved.

## Implementation

Catalogue transport/body reading, the personal-cache read and each complete scene preparation have independent 15-second deadlines. A hung cache falls through to curated sources; it cannot preempt that fallback with a competing outer discovery deadline. Scene failures are quarantined for the session and use the existing reviewed-replay fallback. Cancelled preparations dispose partially created players and painters immediately. Late values are disposed once and cannot revive a cancelled session or override Pause.

The local observation harness now exports an explicitly incomplete report at each five-second sample, periodically persists it in an observer-only IndexedDB database, and stores the last finalized report separately. Recovery never resumes or operates the game. Each slot has an 8 MiB limit; stored game data is represented by hashes, and terminal checks remain pending until performed. Slow/blocked/quota-failed observer storage leaves the live DOM export usable.

Cache tests use genuine verified winning inputs and losslessly expanded input runs. The byte-eviction candidate is **33,554,507 UTF-8 bytes** (75 over 32 MiB), despite being 525 JavaScript code units below the limit. Twelve candidate rows distinguish byte-driven eviction from the independent count cap. Atomic rejection and concurrent writers preserve prior recordings. No production cache limit was raised and no replay was padded with invalid data.

## Focused checks

| Evidence                                     | Passed | Scope                                                                                      |
| -------------------------------------------- | -----: | ------------------------------------------------------------------------------------------ |
| [Loading](loading.tap)                       |     44 | Deadline, abort, late cleanup, fallback, source matching and ordinary build inventory      |
| [Library](library.tap)                       |     18 | Existing library and transaction tests plus real byte-boundary eviction/atomic writers     |
| [Observer checkpoints](checkpoints.tap)      |      8 | Incomplete/final persistence, bounded storage, recovery and lifecycle ownership            |
| [Mounted host and offline](host-offline.tap) |     42 | Actual app preparation cancellation, watching/background/audio/Confirm and edition closure |

The initial 112 tests passed without skips. The subsequent [director rerun](joined-watchdog-director.tap) passed 16 tests, including one new joined watchdog/fallback case and 15 already counted above: **113 distinct tests**, not 128. Scope overlaps behaviorally, but each cohort lists distinct test files. Input and visibility events in Node are modeled; those tests do not establish physical devices or hidden browser execution. Scoped ESLint, Prettier and whitespace checks passed for the implementation.

```sh
node --test --test-concurrency=1 game/test/demo-loading.test.mjs game/test/demo-director.test.mjs game/test/demo-sources.test.mjs game/test/demo-recordings.test.mjs
node --test --test-concurrency=1 game/test/demo-library.test.mjs game/test/demo-library-indexeddb.test.mjs game/test/demo-library-size.test.mjs
node --test game/test/demo-watch-checkpoints.test.mjs
node --test --test-concurrency=1 game/test/demo-loading-host.test.mjs game/test/demo-host.test.mjs game/test/demo-background.test.mjs game/test/demo-audio-host.test.mjs game/test/demo-confirm-host.test.mjs game/test/edition-runtime.test.mjs
```

## Actual browser recovery

The actual Legacy game was opened inside the local observer in Chromium 154 on macOS. Browser actions used the ordinary Settings → Help & Extras → Watch demo controls. Evidence was read from the DOM textarea in bounded chunks and saved exactly, without download-event waiting.

- [Pre-reload DOM report](browser-checkpoint-before-reload.json): 20.3111 elapsed seconds, five samples, explicitly incomplete.
- [Recovered incomplete report](browser-checkpoint-recovered.json): 15.239 elapsed seconds, four samples, the exact earlier prefix from periodic persistence. The newer 5.0721-second tail was not persisted. Source/storage terminal checks remain pending and no complete-duration result is claimed.
- [Automatic finalization smoke](browser-finalization-smoke.json): requested 30 seconds, stopped automatically after **30.4143 elapsed seconds**, eight samples, zero diagnostic/attachment failures or long gaps. All 204 served files remained unchanged, and sampled localStorage hashes were unchanged.
- [Final report recovered after another reload](browser-finalization-recovered.json): byte-identical **92,933 bytes**, SHA-256 `39823715c1231167cc85bffdf184fd51340e6ea321f765b51859aa2b28982330`. The actual game remained at Home, Demo was closed, Start observation enabled and Stop disabled. No observation was resumed.

All sampled parent/child visibility states were visible. These are short checkpoint/finalization proofs, not two-hour qualification, hidden-tab proof, physical audio output, device acceptance, human viewing quality or general leak freedom. Reloads intentionally ended these short test sessions; they are not appended to the earlier interrupted long run.

![Recovered final report with the game at Home](browser-finalization-recovered.png)

## Packaging

The [in-memory Dutch edition receipt](dutch-edition-memory.json) and [executed helper](check-dutch-edition-memory.mjs) compile the largest `droneaid-nl-community` edition through production code, validate full code closure and verify every offline row against actual compiled bytes. There are 697 compiled files and 694 offline files. The **66,937,284-byte** offline inventory remains **171,580 bytes below the unchanged 64 MiB cap**. The new loading module and all three importer edges are present with exact source bytes. No large output tree was emitted.

The mounted edition tests additionally exercise the new module in standalone and public offline inventories. Earlier full web/native/14-edition receipts remain pinned to their earlier source; no new native device launch is claimed here.

## Worker regression and remaining gates

The [new real-Worker report](worker-regression.json) and [log](worker-regression.log) preserve a failed attempt on this source: **746.842 simulated seconds in 23.837 elapsed seconds**, 20 completed scenes (11 recorded, nine live) and 20 exact recording verifications. The next Courtyard Exits source reached the existing one-second planning watchdog. All 21 players and ten Worker owners were disposed, with zero remaining workers or listeners. The strict harness stopped rather than treating this as a qualified scene. The fault initiated selection of a reviewed replay, but the fail-fast assertion disposed the director before adoption; the resulting replay AbortError is cleanup, not a second independent preparation failure. Four earlier safe-plan-exhaustion handoffs had completed successfully.

A [CPU snapshot taken after failure](host-load-after-worker-failure.json) observed several busy Node processes and other host activity. It is not contemporaneous tracing or proof that scheduling caused the deadline. No unrelated process was stopped, and the production watchdog was not weakened.

Read-only comparison confirms that bot, Worker, core, replay and bundled data hashes match the earlier pass. The newly bounded preparation timer is cleared on successful adoption and did not issue this runtime watchdog error; this same seed also completed a clean 5,799-tick scene earlier in the failed attempt. Timing variability is plausible but unproven. A joined regression now runs the real bot player with a deliberately stalled modeled Worker, fires its unchanged 1,000 ms watchdog, and verifies that the director adopts an exactly verified recording, advances it, disposes the bot and ignores an already-queued late reply. This proves fault recovery under controlled timing; it does not erase the real-Worker timeout. A bounded [instrumented diagnostic](courtyard-worker-diagnostic.json), using the [retained wrapper](courtyard-worker-diagnostic.mjs) around unchanged production Worker code, completed exactly five Courtyard seed-2 runs under immediate steering. All five won at tick 5,799, 74.048% coverage, zero deaths and exact replay verification. Across 45 requests there were no timeouts: request p95 618.380 ms / worst 772.253 ms, planner compute p95 478.825 ms / worst 627.949 ms. Parent event-loop per-run p95 was 11.379–12.902 ms, with a 101.908 ms maximum. Source hashes remained unchanged, and every Worker/listener shut down. This narrow repetition did not reproduce the failure; it does not determine the historical cause, replace the failed long regression or establish either-policy multi-seed qualification. The watchdog stayed at 1,000 ms.

The earlier 179-scene accelerated pass is retained for its earlier source. The browser duration below is now complete, with an unresolved visible-return anomaly and an observer-storage failure. Physical inputs/native/audio and three unfamiliar viewers remain separate acceptance gates. Neither passing focused tests nor a completed duration removes the release hold.

## Completed browser observation with limitations

A separate observation started at **03:30:56.950 UTC** and finalized automatically at **05:31:01.342 UTC** on unchanged production/harness source. The [exact final report](browser-observation-final.json) records **7,204.141 monotonic elapsed seconds**, 7,204.392 calendar seconds, **1,430 samples and 345 events**. All 204 served-source hashes and the three sampled game-localStorage entries are unchanged. There are no observer attachment failures, child navigations, long sampling gaps or dropped observations. This is actual browser wall time, not accelerated simulation time.

The [final review](browser-final-review.md) records an unresolved **158.0978-second visible/unfocused interval** with an unchanged unpaused Orchard Crossing board, timer and canvas checksum. Observer sampling continued; progress resumed after the page became hidden again. A visible requestAnimationFrame scheduling stall is a hypothesis, not an established cause. The two-hour duration therefore does not establish uninterrupted playback or release qualification.

At elapsed **6,720.5555 seconds**, observer-only IndexedDB checkpoint persistence failed with `DataError: Failed to write blobs (IOError)`. Local file writes also failed with `ENOSPC`. Sampling and automatic finalization continued. The final DOM report was retained in memory until disk space became available, then saved atomically and verified before cleanup: **3,193,397 bytes**, SHA-256 `2c943ad9352dcb1022f0c9cc93bf9c1d07fcdad5d8119214a719201452a4cc1e`. The [failure checkpoint](browser-observation-checkpoint-io-failure.json), [last successful running snapshot](browser-observation-running.json) and [retention/cleanup receipt](browser-final-retention-cleanup.json) remain separate. No unrelated files or processes were changed to recover disk space; the reason space became available was not determined. Recovery from the failed IndexedDB slot was not retested.

The harness reports `observationComplete:true` and `observationValidForPinnedSources:true` because duration, inventory, attachment and localStorage checks completed. Those flags do not reject diagnostics or stale gameplay presentation. Its `releaseQualified:false` remains authoritative about the harness's scope. Music Pause survived Next level, and explicit demo Pause held the displayed position while music kept its playing intent in the early visible checks; no physical audio or hidden explicit-Pause acceptance is claimed.

The task-owned observer tab and verified port 8820 server were closed only after exact evidence was saved. No browser Worker/listener counters or post-close heap snapshot were available, so resource closure is not proof of general leak freedom. The user's port 8779 game was untouched. The [handoff record](browser-observation-handoff.md) preserves the finite workflow and remaining follow-up.

The [independent interim review](interim-review.md) binds a separately preserved 621.3938-second snapshot: both live maps appear three times, watching progresses in 56 visible-but-unfocused samples, and nine paused-demo samples keep the same board checksum while music reports playing. It records no diagnostics or long gaps in that interval. That early snapshot has no hidden-page samples. A [later review](hidden-observation-review.md) separately preserves two genuinely hidden intervals totaling 337.0316 seconds, with recorded/live rotation and progressed boards after return. Final source/storage checks were still pending in those interim reports; the final report above completes them. Audible track boundaries and hidden explicit-Pause preservation remain unproven.

## Current-head hosted checks

Both [hosted acceptance](https://github.com/mekhovov/revealline/actions/runs/36517720087/job/109243636026) and [candidate compilation/ZIP validation](https://github.com/mekhovov/revealline/actions/runs/36517720180/job/109243636410) passed at exact head `279d6b67f66a7add88df66ab09e4995e7bdc775a`. The [GitHub receipt](pr781-279d6b67-ci.json) retains completion times, draft state and release hold. The skipped staging job is not a pass or publication. The [complete candidate log](pr781-279d6b67-candidate.log.gz) is stored losslessly with [original/compressed hash and byte counts](candidate-log-receipt.json). CI does not resolve the visible-return anomaly or replace remaining background/native, physical or human-viewer acceptance.

The [CI scope receipt](current-edition-ci-scope.json) extracts the current candidate summary from log lines 3649–3674: **all 14 catalog editions compiled twice**, original ZIP members verified, 14 presentation receipts verified, and `publicEligible:false`. The production compiler enables offline generation and code-closure validation; its unchanged 2,000-file and 64 MiB limits therefore apply. This log supplies aggregate success, not per-edition byte/hash inventories. Neither this candidate job nor hosted community-service acceptance runs native stage/verify. Desktop/iOS staging evidence remains pinned to the earlier `c5e3419ee` source, and no native launch is claimed.

## Final single Worker follow-up

After final browser evidence was saved and the task-owned tab/server closed, the one authorized [real-Worker regression](worker-final-qualification.json) ran from **05:32:57.847 to 05:36:08.291 UTC**, exiting zero. Its [log](worker-final-qualification.log) and [independent review receipt](worker-final-review.json) preserve **179 scenes: 92 recorded and 87 live**, **7,251.975 simulated seconds in 190.435 elapsed seconds**, 179 exact recording verifications, 179 pause checks and zero deaths. Both immediate and grid-center steering visited all twelve eligible sources. There were 29 expected safe-plan-exhaustion handoffs, no unexpected errors or preparation failures, and zero remaining player/Worker/listener counters after disposal.

The unchanged one-second planning watchdog, limits and strict assertions remained in force. This follow-up ran once, without concurrent task-owned heavy checks or interruption of unrelated processes. All 64 Worker inventory hashes remained stable. An independent comparison of the 205 unique browser/Worker paths matches both Git source `55c5ec57cc1ed478b44e065951073c0bdd3c3ead` and the current tree. This pass does not explain or erase the earlier real-Worker timeout, qualify browser rendering/audio/devices, or resolve the visible-return stall. The finite observation workflow is finished; see its [completion record](browser-observation-handoff.md).
