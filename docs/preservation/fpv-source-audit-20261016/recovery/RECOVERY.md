# FPV shared-volume preservation — recovery entry point

The human priority on 2026-10-16 is preserving every application source change, asset and original verification result on GitHub before the alex shared volume can be permanently disconnected. **Backup verification is IN PROGRESS. Do not retire the volume yet.**

## Durable source and evidence

- Unpublished primary-checkout source and working snapshot: https://github.com/mekhovov/revealline/pull/1547 (Draft; snapshot is not a claim of merge/readiness).
- Library evidence and original-package manifest: https://github.com/mekhovov/revealline/pull/1550 (Draft; exact feature parent is b65d80f716b8db646bfdf5f714892f1c0f6409b0).
- Additional source snapshots and comprehensive source-ref audit: https://github.com/mekhovov/revealline/pull/1551 (Draft; audit still active).
- Backup release numeric ID 414505790, tag fpv-development-preservation-20261016. It is a **draft development backup**, not a player release. Use authenticated GitHub API/CLI to retrieve its assets.

## Local recovery files that do not require the share

- This directory: /Users/oleksandr.mekhovov/.codex/fpv-volume-preservation-20261016
- recovery/pre-preservation-fpv-handoff.md is the byte-verified historical development handoff.
- recovery/plans/ contains byte-verified copies of the three current delivery plans.
- app-files.jsonl and inventory-state.json are the live read-only application-data inventory. Incomplete until complete=true.
- bulk-pack-lane/ owns content-addressed pack and portable restore receipts. No completed backup claim until every selected source object has durable coverage and readback/restore validation.
- saved-dependencies/gltf-validator-2.0.0-dev.3.10 replaces the known local validator dependency formerly linked into the share. Its 9 files were copied and SHA-verified.

## Preservation boundaries

Preserve unfinished source, all local commits/refs/reflog-only work, original failures, original packages, assets and verification evidence. Do not publish unrelated personal/company migration backups, browser profiles, player storage, credentials or raw Git configuration. Never delete, reset, force-push, overwrite or repopulate player data to obtain a pass. Application work remains Draft until independently qualified.

The current backup lanes are source/ref/reflog audit (storage_lifecycle_recovery), original package archive preservation (library_qualification_recovery), and deduplicated file archive/portable restore (listing_evidence_review). Reconcile their current heads and manifests before continuing. Do not resume feature development or claim the share is disposable while coverage remains incomplete.

## Development work after preservation

Use the copied handoff and plan review for remaining FPV gates. Main last reconciled at2169552a0571b9d62bce116054f1e21aabd10fa1. Public storage connection/visibility failures, current-head full-player Library verification, native School/controls, two-hour endurance, final art and broader D6 are still open. No renderer/endurance is active. Do not weaken gates or treat source/HTTP/software/synthetic checks as public/native/physical acceptance.
