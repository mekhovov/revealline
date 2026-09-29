# Finite browser observation and Worker follow-up — completed

This finite workflow has ended. Do not reopen or restart the observer from this handoff. The earlier [interrupted run](../browser-observation-handoff.md), all preliminary reports and the real-Worker watchdog failure remain preserved.

- Checkout: `/Users/oleksandr.mekhovov/.codex/worktrees/community-admission/go_test`.
- Frozen production and harness source: `55c5ec57cc1ed478b44e065951073c0bdd3c3ead`.
- Runtime/test candidate head before this evidence update: `279d6b67f66a7add88df66ab09e4995e7bdc775a`.
- Existing held draft: [PR #781](https://github.com/mekhovov/revealline/pull/781), branch `codex/local-experience-review-20260929`. Inspect its current remote head before any future continuation; preserve newer owner work and fast-forward only.
- No version allocation, merge, release, Pages publication or hold removal occurred.

## Completed browser capture

The actual Legacy game with **FPV Front · Pressure Lines · 5.0.0** was observed from **2026-09-29T03:30:56.950Z** through automatic finalization at **05:31:01.342Z**. The [exact final JSON](browser-observation-final.json) contains 7,204.141 monotonic wall seconds, 1,430 samples and 345 events. Its 204 served-source records and three hashed game-localStorage entries are unchanged. Read the [final review](browser-final-review.md) and [derived summary](browser-final-summary.json) for scene rotation, measured hidden intervals, music intent, memory and all limitations.

Final JSON: **3,193,397 bytes**, SHA-256 `2c943ad9352dcb1022f0c9cc93bf9c1d07fcdad5d8119214a719201452a4cc1e`. It was collected through supported CUA DOM APIs in chunks smaller than 80,000 characters, with matching before/after report markers. No download-event wait was used. Parallel read-only chunk requests made stable collection possible as the report grew. The changing-report read at the 04:55 heartbeat was discarded after three attempts; this was not a game failure.

The report is **not a clean playback acceptance pass**. After one visible return, 33 unpaused visible/unfocused samples retained the same Orchard Crossing board and timer for **158.0978 seconds**. Observer callbacks continued and gameplay progression became observable after re-hiding. Visible RAF starvation is a source-informed hypothesis only. No code was changed to hide the finding.

Observer-only IndexedDB persistence failed at elapsed **6,720.5555 seconds / 05:22:57.506 UTC** with `DataError: Failed to write blobs (IOError)`. Local report and tiny probe writes then failed with `ENOSPC`; no partial report replaced the prior successful local snapshot. The complete DOM report was retained in memory until disk space became available. Its exact bytes and the [6,932.6251-second failure checkpoint](browser-observation-checkpoint-io-failure.json) were then saved and verified. The [retention/cleanup receipt](browser-final-retention-cleanup.json) preserves hashes and operational limits. No unrelated files/processes were changed to obtain space. The final IndexedDB slot was not retested or claimed durable.

Earlier visible Pause checks, 56.4496 minutes of measured hidden execution, source/storage stability and the final completion flags remain useful evidence. They do not establish audible output, hidden explicit-Pause preservation, physical inputs, OS freeze/native behavior, resource leak freedom, unfamiliar-viewer comprehension or release qualification.

## Owned resources released

Only after final JSON had been saved and hash-verified:

- The task-owned in-app-browser **tab 34 / browser 1**, at `http://127.0.0.1:8820/game/test/browser/demo-watch.html`, was closed.
- Python server **PID 57077 / exec session 67109** was verified as `python3 -m http.server 8820 --bind 127.0.0.1` with this checkout as cwd, stopped through its session, and confirmed to leave no port 8820 listener.
- The user's port 8779 game and shared checkout were untouched.

No per-browser Worker/listener counters or post-close heap sample were obtained. Closing owned resources is not general leak proof. The old tab handle and server session must not be reused as running resources.

## One final Worker regression

The existing command ran **once** after observer cleanup, from **05:32:57.847 to 05:36:08.291 UTC**, without other task-owned heavy checks:

```sh
node --expose-gc scripts/soak-demo.mjs --simulation-seconds 7200 --report docs/verification/demo-qualification-2026-09-29/loading-recovery/worker-final-qualification.json
```

[Raw report](worker-final-qualification.json), [log](worker-final-qualification.log), [review/source comparison](worker-final-review.json): exit zero, 179 scenes (92 recorded / 87 live), 179 exact recording verifications and pause checks, 7,251.975 simulated seconds in 190.435 wall seconds. Both steering policies visit twelve eligible sources. There are zero deaths, unexpected errors, preparation failures or remaining player/Worker/listener counters; 29 safe-plan-exhaustion handoffs are expected. All 64 source hashes are unchanged. The 205 unique browser/Worker inventory paths match frozen Git source and the current tree.

The one-second watchdog, limits and assertions were unchanged. No retry was made. This accelerated pass neither erases the earlier watchdog failure nor resolves the browser visible-return anomaly.

## Follow-up boundary

Retain the draft and release hold. The next implementation investigation is the visible/unfocused scheduling boundary; any correction needs evidence tied to its new source. Continue physical-device/audio/native and three-viewer acceptance separately using the [worksheet](../viewer-device-checklist.md).

Report the finite outcomes and final evidence head to the already-authorized release coordination chat. Pause `finish-demo-browser-observation` after reporting and stop its recurring work; do not start another observation from this automation. No further observer/server cleanup remains.
