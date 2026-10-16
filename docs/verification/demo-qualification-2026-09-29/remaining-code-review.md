# Remaining demo qualification work

The original read-only review below examined `5f2d442e08833f535e8249f3e7b4fa6351fcf17c` on 29 September 2026. Its findings were follow-up work, not implemented fixes or reproduced browser failures. That review changed only qualification documentation/evidence and started no observation.

**Follow-up status:** all three scoped code/coverage gaps are addressed in `55c5ec57cc1ed478b44e065951073c0bdd3c3ead`. The historical findings remain below, followed by their new evidence. This closes the listed implementation work; it does not close the two-hour browser/native, physical input/audio/device, or unfamiliar-viewer qualification gates. Earlier interrupted and preliminary evidence remains unchanged.

## Bound scene loading — addressed

### Historical finding

`game/demo-catalog.mjs:112` and `:173` await catalogue and replay fetches with a cancellation signal but no deadline. `game/demo-director.mjs:93` awaits preparation indefinitely. A request that neither succeeds nor rejects can therefore leave unattended playback in loading indefinitely; the bot planning watchdog covers a different operation.

A future scoped correction should impose a bounded preparation deadline, abort the request, release any adapter that arrives after cancellation, and use the existing failure rotation. It must preserve explicit Pause/Next/close generations and avoid starting music. Test a permanently pending request with a controlled clock, a late success after timeout, user cancellation and successful fallback. The current cancellation test releases its deferred fetch before observing rejection and does not cover a permanently pending source.

### Implemented follow-up

`game/demo-loading.mjs` supplies a shared 15-second default deadline. Catalogue/replay fetch and body consumption share one deadline; cache discovery is bounded separately. The director bounds complete scene preparation, including player and picture preparation, and releases late results. The host abort listener immediately releases already-owned player/painter resources even if a media decoder never settles. Session failure rotation and replay-only fallback for failed bots remain in effect. A timeout cannot override newer Pause, Next or close ownership. These are per-operation bounds; a suspended browser can defer the callback, and several sequential operations can take longer than one deadline.

[Loading/replay/source/director tests](loading-recovery/loading.tap) passed **44/44**, including never-settling fetches and bodies, a shared fetch/body budget, hung cache fallback, delayed results after cancellation, timer/listener cleanup, paused fallback and exhausted-source unavailability. The [actual host/background/audio/Confirm/edition-runtime cohort](loading-recovery/host-offline.tap) passed **42/42**. It includes real app tests that release a pending scene painter on both the deadline and Back before its decoder settles. Controlled-clock background cases and offline inventory assertions do not qualify real OS background scheduling or a newly built native executable.

## Exercise the byte limit directly — addressed

### Historical finding

The library's 32 MiB check and eviction loop exist in `game/demo-library.mjs:169–179`. Current count-eviction tests insert thirteen small recordings, then assert the result is below the byte cap; that does not force byte-based eviction. Add valid near-limit recordings whose combined serialized UTF-8 size exceeds the limit, and a single oversized item. Verify the newest valid entry survives, oldest entries are evicted atomically, an oversized item does not change prior bytes, and concurrent writers preserve the same bound. This is a coverage gap, not evidence that the existing cap fails.

### Implemented follow-up

[Library tests](loading-recovery/library.tap) passed **18/18**. Three added direct-cap cases use valid, strictly verified recordings through the production library/storage adapter with a modeled IndexedDB transaction boundary. The byte-eviction fixture begins at **33,548,899 bytes** and the next admission would reach **33,554,507 UTF-8 bytes**, exceeding the **33,554,432-byte** cap while its JavaScript string length is only **33,553,907**. It therefore distinguishes byte accounting from code-unit/count-only accounting. The newest admission survives and the oldest item is removed before the twelve-recording limit would require it.

The rejection case uses one oversized aggregate library document whose individual replay files remain valid and below their parser limit, instead of an artificially padded invalid replay. It rejects before any storage `put` and preserves the previous document exactly. Two concurrent production-library writers both survive, with every observed commit remaining under the byte cap. These tests establish adapter behavior under the finite ordering/rollback model; they do not claim real-browser quota exhaustion or physical-device durability.

## Retain incomplete observation checkpoints — addressed

### Historical finding

The harness enables report download only after stopping (`game/test/browser/demo-watch.mjs:743–754`), while pagehide releases its resources (`:769–775`). The lost browser attachment prevented collection of the complete in-memory trace. A future harness revision should expose bounded, explicitly incomplete checkpoints during observation, kept separate from the game's saves and profiles. It should include elapsed time, diagnostics, samples and the starting inventory while marking terminal source/storage checks as unavailable until actually collected. Do not infer the cause of the lost tab from this code review.

### Implemented follow-up

The harness now exposes a bounded current JSON report every five-second sample and attempts recovery persistence every 15 seconds, plus explicit export/lifecycle saves. Its dedicated observer-only IndexedDB database holds two slots of at most 8 MiB each: the latest incomplete checkpoint and last finalized report. One in-flight and one newest queued serialization bound write retention; storage operations have a five-second timeout. Recovery displays previous evidence without starting observation or operating the game. Terminal comparisons remain pending on incomplete reports, and a source mismatch or failed final inventory cannot become a valid completed observation. Storage failure leaves current DOM/download evidence available. Explicit cleanup never clears a game save/profile database.

[Checkpoint tests](loading-recovery/checkpoints.tap) passed **8/8**, covering actual harness mounting against modeled browser boundaries, reload recovery without steering, redacted storage, separate final/preliminary slots, cancellation/disposal, timeout and quota behavior, late database open cleanup, and deferred final-save/Clear ownership. Review found two save-order races during development; the final implementation and regression test prevent a new run from replacing a queued final report or racing a pending Clear.

The retained Chromium 154 local browser smoke provides separate real reload evidence:

| Report                                                                              | Captured elapsed time | Samples | Status                              |
| ----------------------------------------------------------------------------------- | --------------------- | ------- | ----------------------------------- |
| [Before-reload DOM JSON](loading-recovery/browser-checkpoint-before-reload.json)    | 20.3111 s             | 5       | Incomplete; terminal checks pending |
| [Recovered periodic checkpoint](loading-recovery/browser-checkpoint-recovered.json) | 15.239 s              | 4       | Incomplete; terminal checks pending |

The [recovered-panel screenshot](loading-recovery/browser-recovered-checkpoint.png) records the recovery UI. Independent inspection confirmed both JSONs parse, are within their budgets, contain no raw game storage keys/values in their storage snapshots, and share the exact starting inventory/storage snapshot. The recovered samples/events are the exact earlier prefix of the before-reload report. All **204 starting source entries / 17,222,640 bytes** match the current checkout's bytes at `55c5ec57cc1ed478b44e065951073c0bdd3c3ead`.

The **5.0721-second newer tail was not recovered**. This proves recovery of the earlier periodic checkpoint, not guaranteed pagehide-write persistence or recovery of every latest sample. Both reports correctly retain `sourceInventoryStable:null`, `observationValidForPinnedSources:false`, `observationComplete:false`, `releaseQualified:false`, and pending terminal source/storage checks. The starting hashes matching a later read do not substitute for a terminal inventory collected by that interrupted observation.

Both short reports show zero captured diagnostics and attachment failures, with all recorded visibility samples foreground. Their embedded development page reports the placeholder build label `__REVEALLINE_VERSION__`; this was source-server observation, not a version-stamped distribution. Music transport labels are not proof of audible output. Neither report completes its selected 30-second smoke duration, a two-hour observation, hidden/native execution, physical input/device testing, or human comprehension review.

### Separate finalized-report reload smoke

A subsequent [automatic-finalization run](loading-recovery/browser-finalization-smoke.json) reached **30.4143 seconds / eight samples** and stopped for `requested-duration`. Its 204 initial/final source entries agree; source and storage terminal checks are complete, storage hashes are unchanged, and no diagnostics, attachment failures or long gaps were recorded. After an actual reload and selection of **Last finalized report**, the [recovered report](loading-recovery/browser-finalization-recovered.json) is **byte-identical**: 92,933 bytes, SHA-256 `39823715c1231167cc85bffdf184fd51340e6ea321f765b51859aa2b28982330`. The [recovered final-report screenshot](loading-recovery/browser-finalization-recovered.png) records the UI.

Independent readback confirmed exact report equality, both terminal checks, and all 204 final source hashes against the current checkout. The report truthfully sets `observationComplete:true` for its chosen 30-second smoke, while retaining `mode:short-smoke-not-qualification` and `releaseQualified:false`. It establishes short automatic finalization and final-slot recovery separately from the interrupted checkpoint evidence; it does not satisfy the two-hour, hidden/native, physical-audio/device or human-viewer gates.

## Evidence boundary

The automated cohorts above total **112 passing tests** (44 loading, 18 library, 8 checkpoint, 42 host/offline), with no failures or skipped cases in the retained TAP files. They are scoped regression results, not a new full repository suite, production/native build, two-hour observation, or release admission. The original interrupted run and prior qualification receipts remain historical evidence under their original source scopes; this follow-up does not retroactively complete or relabel them.
