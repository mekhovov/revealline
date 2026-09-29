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

The earlier 179-scene accelerated pass is retained for its earlier source. A fresh finite browser observation, hidden-page verification, physical inputs/native/audio and three unfamiliar viewers remain separate acceptance gates. Neither these passing focused tests nor a future completed observation removes the release hold.

## Fresh browser run in progress

A separate two-hour observation started at **03:30:56.950 UTC** on the frozen runtime above, after the bounded Worker diagnosis ended. The [handoff](browser-observation-handoff.md) identifies the owned tab/server and exact collection procedure. The [saved running report](browser-observation-running.json) is explicitly incomplete: it is evidence only through its recorded elapsed time, with terminal checks pending. Periodic observer-only persistence is active. Music Pause survived Next level, and explicit demo Pause held the displayed position while music kept its playing intent; watching was resumed. No completed duration or hidden-tab result is claimed.
