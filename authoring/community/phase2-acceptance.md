# Phase 2 acceptance — implementation candidate

Status: implementation is isolated on `codex/creator-phase2-integration`. It has no allocated release version and must not be advertised as released before Phase 1 publication, Phase 2 browser acceptance, PR review, immutable freeze, release and public Pages verification finish.

## Automated evidence completed

- The `creator-layouts.v2` registry contains six authored layout families with two bounded variants each. Deterministic selection, legacy Phase 1 compatibility and all six difficulty/steering route configurations pass focused tests.
- Batch-core tests cover 1-, 12- and 50-picture preparation, natural order, duplicate names and bytes, deterministic regeneration, explicit failed-item exclusion, reorder, campaign grouping, checkpoints, cancellation and explicit capacity splits. Full-size hashing and image preparation report at most one active item.
- Batch-review tests cover multi-file selection, editable titles, reorder, exclusion, regeneration, removal, cancellation, 24 MiB package-capacity choices, focus retention and object-URL cleanup. Production intake uses an exact-byte adapter that revalidates the displayed one-mission preparations as one ordered campaign.
- Bundle integration tests cover 1-, 12- and 50-mission round trips, authored continuation order, exact media closure, forged per-mission evidence, stale approval, immutable installed editions, complete source-backup recovery and split-package closure.
- The 14 batch UI and full bundle-integration cases pass together after the adapter landed. A final combined run with every neighboring Phase 1 creator test remains required before review; counts in a pull request or release record must describe that exact final revision rather than adding results from different commits.

## Built-in browser evidence completed

- Native multi-file selection on local origin `8786` chose two existing PNG sources. The page exposed natural order, per-card thumbnails, distinct verified template variants, a 24 MiB package estimate and one bulk approval.
- Exact batch approval saved creator checkpoint 1, prepared a 3.89 MiB two-mission campaign and installed immutable edition `3402e044d78e9e6462033c3fc95f5783fb131bfb5700e35e02cca20990a615a3`.
- Ordinary Custom play completed the first mission legally at 100% / 23,800 points, showed its exact earned picture and offered **Next level**. Next started the second mission with the same selected difficulty and steering. Its legal completion reached 100% / 21,640 points, showed the second picture and changed continuation to **Back to my creations**.
- Reloading the original creator URL restored its two-mission local source checkpoint and private-backup action. The actual downloaded `.rlpack` is 4,082,072 bytes, SHA-256 `0b3a3943ff8e8d64149d3260fb331afd6d0f680d952082b066065f5c10b21904`, with two missions, two payloads and no trailing bytes.
- The actual downloaded `.rlsource` is 9,614,330 bytes, SHA-256 `83ab8ce8be1f709cd8d5e6968e116761415ff78eb2de42b589b4a89abd395f45`, with two missions, four payloads, two original hashes and no trailing bytes.
- On previously unused origin `8787`, native file selection imported the downloaded `.rlpack`, reproduced the exact full edition identity, approved it locally and installed both missions. The downloaded `.rlsource` also imported and saved as a local two-mission checkpoint. This verifies a separate origin, not a separate browser profile.

## Browser and release gates still required

- Select real 1-, 12- and 50-image batches through the built-in browser. Include duplicate visible names, duplicate bytes, a portrait image, a deliberately unsupported item and a batch large enough to require an explicit split decision.
- Confirm natural ordering, manual reorder, each pacing choice, per-item regeneration, failure exclusion, cancellation and reload recovery. Watch browser memory while full-size work remains serial.
- Repeat the actual download/install journey for a 12-picture batch and capacity handling for a 50-picture batch. The completed two-picture transfer is evidence for the path, not a substitute for those volume gates.
- Reload an unfinished middle mission and verify every earned picture remains bound after another reload. Install a changed edition alongside it and confirm attempts and rewards do not migrate.
- Inspect exported manifests and payload hashes. Confirm the share pack contains required derivatives only, the source backup contains the selected retained originals, duplicate payloads are deduplicated, and neither file contains player progress or unrelated media.
- Exercise explicit package splitting at capacity, failed installation recovery and concurrent-tab stale-state refusal. Browser quota estimates remain advisory.
- Run the repository's current hosted gates, review and merge the Phase 2 PR, freeze the next unused version, inspect and upload the frozen artifact, publish its release and selector, then verify the public version and artifact hashes.

The user directed this delivery to use the Codex built-in browser. Firefox, Safari and physical mobile remain untested until separately qualified and must not be inferred from this record.
