---
id: persistence-and-replays
title: Persistence and replays
importance: high
filePaths:
  - game/app.mjs
  - game/storage.mjs
  - game/profile-writer.mjs
  - game/library.mjs
  - game/profile-database.mjs
  - game/journey/profile.mjs
  - game/backup.mjs
  - game/backup-storage.mjs
  - game/replay.mjs
  - game/core/versions.mjs
  - game/replay-player.mjs
  - game/sessions.mjs
  - game/test/replay.test.mjs
relatedPages:
  - runtime-data-flow
  - content-and-authoring
  - operations-and-configuration
  - testing
---

# Persistence and replays

RevealLine separates release/channel library and suspended-attempt slots from IndexedDB asset packs and Journey progress. Replays reconstruct simulation from recorded commands; suspended attempts build on that verification, while complete-backup import coordinates several stores with a recovery journal. [game/app.mjs:705](../../game/app.mjs#L705) [game/storage.mjs:1](../../game/storage.mjs#L1) [game/journey/profile.mjs:262](../../game/journey/profile.mjs#L262) [game/replay.mjs:558](../../game/replay.mjs#L558) [game/sessions.mjs:296](../../game/sessions.mjs#L296) [game/backup-storage.mjs:167](../../game/backup-storage.mjs#L167)

## Storage and writer authority

Normal solo storage uses `localStorage`; a studio preview can substitute its own adapters. Library, pack, and suspended-slot keys incorporate the selected channel, while authored Journey attempts use a route-provided session key. Large asset records use the `assets` store in `revealline-assets-v1`. [game/app.mjs:384](../../game/app.mjs#L384) [game/app.mjs:705](../../game/app.mjs#L705) [game/storage.mjs:6](../../game/storage.mjs#L6)

The host claims a company-edition or library writer lease. `claimProfileWriter` requests an exclusive, immediately available Web Lock and holds it until release; missing locks or an occupied lock produce a nonwritable, session-only result. The host releases on page hide. This guard requires participating writers and explicitly does not cover legacy clients. [game/app.mjs:744](../../game/app.mjs#L744) [game/profile-writer.mjs:7](../../game/profile-writer.mjs#L7) [game/profile-writer.mjs:66](../../game/profile-writer.mjs#L66) [game/app.mjs:831](../../game/app.mjs#L831)

Library saves additionally check backup-lock ownership and storage generation. Ordinary writes merge against a baseline; replacement creates a new generation, preventing an older tab from restoring deliberately removed records. Journey progress instead uses profile-scoped IndexedDB transactions in `revealline-journey-v1`, including picture, stars, and performance sidecars, and exports its own Journey backup formats. [game/library.mjs:858](../../game/library.mjs#L858) [game/library.mjs:889](../../game/library.mjs#L889) [game/library.mjs:917](../../game/library.mjs#L917) [game/profile-database.mjs:2](../../game/profile-database.mjs#L2) [game/journey/profile.mjs:303](../../game/journey/profile.mjs#L303) [game/journey/profile.mjs:762](../../game/journey/profile.mjs#L762)

## Backup preparation and recovery

The `xonix-backup` family contains library, packs, and a session or explicit `null`; v2 additionally contains an external-chapter index and requires its compatible preparation capability. `prepareBackup` snapshots input before asynchronous validation and produces a frozen, branded prepared result without adopting live state. [game/backup.mjs:82](../../game/backup.mjs#L82) [game/backup.mjs:112](../../game/backup.mjs#L112) [game/backup.mjs:253](../../game/backup.mjs#L253)

For the legacy storage path, `commitBackup` requires exclusive coordination, journals original values, writes packs and session, replaces the profile, then clears the journal and lock. Failure attempts rollback; incomplete recovery retains recoverable metadata. Startup recovery precedes ordinary reads. External-index imports take a separate companion path, and mixed external/legacy journal states are rejected for automatic recovery. [game/backup-storage.mjs:171](../../game/backup-storage.mjs#L171) [game/backup-storage.mjs:214](../../game/backup-storage.mjs#L214) [game/backup-storage.mjs:252](../../game/backup-storage.mjs#L252) [game/backup-storage.mjs:295](../../game/backup-storage.mjs#L295)

## Recordings and suspended attempts

The recorder copies level/options, compresses repeated commands into run-length segments, and preserves input-release boundaries. Export requires matching run identity, tick count, simulation versions, and no accumulator remainder. The budgets are 30 minutes at 120 Hz and 32 MiB; supported solo replay versions are selected from version tuples, spanning v3–v10. [game/replay.mjs:29](../../game/replay.mjs#L29) [game/replay.mjs:389](../../game/replay.mjs#L389) [game/replay.mjs:423](../../game/replay.mjs#L423) [game/replay.mjs:441](../../game/replay.mjs#L441) [game/core/versions.mjs:3](../../game/core/versions.mjs#L3)

Verification replays every fixed tick and compares section checksums, summary, and tick count. Ordinary replay playback requires a successful verification; the reviewed-demo entry has a narrowly qualified enemy-checkpoint exception. Transport pause preserves recorded latches. Tests explicitly distinguish equal summaries from unequal authoritative state. [game/replay.mjs:558](../../game/replay.mjs#L558) [game/replay.mjs:589](../../game/replay.mjs#L589) [game/replay-player.mjs:28](../../game/replay-player.mjs#L28) [game/replay-player.mjs:58](../../game/replay-player.mjs#L58) [game/replay-player.mjs:174](../../game/replay-player.mjs#L174) [game/test/replay.test.mjs:73](../../game/test/replay.test.mjs#L73)

Session restoration verifies campaign identity and replay outcome, rejects terminal attempts, checks installed rules and presentation pins, then reconstructs the recorder. The local slot is limited to 2 MiB; oversized or failed saves preserve the previous attempt and suggest file export. [game/sessions.mjs:296](../../game/sessions.mjs#L296) [game/sessions.mjs:362](../../game/sessions.mjs#L362) [game/sessions.mjs:40](../../game/sessions.mjs#L40) [game/sessions.mjs:383](../../game/sessions.mjs#L383)

## Evidence

- [game/profile-writer.mjs:15](../../game/profile-writer.mjs#L15): writer lease acquisition.
- [game/backup-storage.mjs:167](../../game/backup-storage.mjs#L167): journal boundary.
- [game/replay.mjs:441](../../game/replay.mjs#L441): recording identity checks.
- [game/sessions.mjs:320](../../game/sessions.mjs#L320): verified reconstruction.

## Coverage and limits

Queries: `lease`, `writer`, `indexedDB`, `backup`, `replay`, `generation`. The 13 evidence files above were read selectively, following host adapters into storage, backup, and verification. Managed-media internals, portable backup sets, native migration, co-op/FPV recordings, and every historical format were not exhaustively traced. Quota failures, crash recovery, browser locking, and test outcomes remain **UNVERIFIED** here; tests were read, not executed.

## Related

[Runtime data flow](runtime-data-flow.md) · [Content and authoring](content-and-authoring.md) · [Operations and configuration](operations-and-configuration.md) · [Testing](testing.md)
