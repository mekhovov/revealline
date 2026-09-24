# Phase 2 acceptance — implementation candidate

Status: implementation is isolated on `codex/creator-phase2-integration`. It has no allocated release version and must not be advertised as released before Phase 1 publication, Phase 2 browser acceptance, PR review, immutable freeze, release and public Pages verification finish.

## Automated evidence completed

- The `creator-layouts.v2` registry contains six authored layout families with two bounded variants each. Deterministic selection, legacy Phase 1 compatibility and all six difficulty/steering route configurations pass focused tests.
- Batch-core tests cover 1-, 12- and 50-picture preparation, natural order, duplicate names and bytes, deterministic regeneration, explicit failed-item exclusion, reorder, campaign grouping, checkpoints, cancellation and explicit capacity splits. Full-size hashing and image preparation report at most one active item.
- Batch-review tests cover multi-file selection, editable titles, reorder, exclusion, regeneration, removal, cancellation, capacity choices, focus retention and object-URL cleanup. Production multi-file intake remains gated until its exact-byte approval adapter is connected.
- Bundle integration tests cover 1-, 12- and 50-mission round trips, authored continuation order, exact media closure, forged per-mission evidence, stale approval, immutable installed editions, complete source-backup recovery and split-package closure.
- Focused Phase 2 and neighboring Phase 1 creator tests, scoped ESLint, Prettier, syntax and diff checks must be rerun together after the integration adapter lands. Counts in a pull request or release record must describe that final revision rather than adding results from different commits.

## Browser and release gates still required

- Select real 1-, 12- and 50-image batches through the built-in browser. Include duplicate visible names, duplicate bytes, a portrait image, a deliberately unsupported item and a batch large enough to require an explicit split decision.
- Confirm natural ordering, manual reorder, each pacing choice, per-item regeneration, failure exclusion, cancellation and reload recovery. Watch browser memory while full-size work remains serial.
- Bulk approve the exact reviewed campaign, download the actual `.rlpack` and private `.rlsource`, install the downloaded pack on a previously unused origin, and verify every mission continues with **Next** through ordinary Custom play.
- Reload an unfinished middle mission, complete the campaign, and verify every earned picture remains bound to the immutable edition. Install a changed edition alongside it and confirm attempts and rewards do not migrate.
- Inspect exported manifests and payload hashes. Confirm the share pack contains required derivatives only, the source backup contains the selected retained originals, duplicate payloads are deduplicated, and neither file contains player progress or unrelated media.
- Exercise explicit package splitting at capacity, failed installation recovery and concurrent-tab stale-state refusal. Browser quota estimates remain advisory.
- Run the repository's current hosted gates, review and merge the Phase 2 PR, freeze the next unused version, inspect and upload the frozen artifact, publish its release and selector, then verify the public version and artifact hashes.

The user directed this delivery to use the Codex built-in browser. Firefox, Safari and physical mobile remain untested until separately qualified and must not be inferred from this record.
