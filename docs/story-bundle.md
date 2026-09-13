# Exact optional story transfer

This isolated P5 slice adds `.rlstory` framing and a complete-inventory restore transaction to the [opt-in v4 story store](story-media-storage.md) at `582ab5d8dc17a5e06c8af56c39a3977bab27cfcd`. It prepares original video recovery for the later win → optional story → Collection journey. It does not adopt v4 in any host, add an earned-story receipt, choose a current assignment, change a build/version, or provide a new browser preview. Existing JSON game-data, `.rlmedia` and `.rlsound` formats remain exact.

The subsequent isolated [authored-binding model](authored-story-bindings.md) adds explicit logical-v2 selections and matched binary-v2 dispatch. This guide preserves the original v1 transfer layout/evidence; both old and new files retain the same byte, codec and paired-recovery boundaries.

## Contents and authority

A bundle contains the strict `revealline-story-storage.v1` descriptor history, its explicit available-original hash list, the retained still metadata/owners needed to interpret those descriptors, and each available original video's exact bytes. It contains **no poster image bytes, audio originals, progress, saves, packs or awards**. The still metadata is context for validation; importing `.rlstory` never installs that context into a destination. Recover the exact still context and poster originals through `.rlmedia` separately.

Source-license and authoring provenance handling is unchanged. Binary transfer preserves exact descriptors and original bytes; it does not authenticate ownership, grant permission, or attach a new rights claim. Keep the original authoring source/license/provenance records with their existing owner. Hash verification establishes byte identity only.

An intentionally detached video has a retained descriptor but no entry in `originals`; its absence is explicit and exportable. A video declared available must be present with the exact SHA-256 and byte length. Export refuses missing/corrupt available originals rather than silently shrinking the inventory. Export does not require a working local video codec, so the original can still be rescued on an incompatible device.

The picture pin binds the exact **authored** identity, presentation ID/revision and poster asset ID/hash. It is not an execution or award identity. A current picture B, copied JSON capability, same-named pack or unrelated owner cannot replace retained A. The existing strict still `story:null`, sessions, 8 KiB flight pins and first-earned picture receipts remain unchanged. A future explicitly versioned host/receipt contract must freeze story selection at the correct attempt/first-earned boundary; this file cannot retroactively award a story.

## Binary layout

| Offset             | Encoding                           | Meaning                                                                                   |
| ------------------ | ---------------------------------- | ----------------------------------------------------------------------------------------- |
| 0–7                | ASCII `RLSRB1\r\n`                 | Distinct story signature; existing soundtrack/still signatures are not accepted.          |
| 8–11               | Unsigned 32-bit big-endian integer | UTF-8 manifest byte length.                                                               |
| 12 onward          | UTF-8 canonical JSON on export     | Exact keys `{format,document,still,assets}` with `format:'revealline-story-bundle.v1'`.   |
| After the manifest | Consecutive original bytes         | One original per `assets:[{sha256,bytes}]` entry, ordered by ascending lowercase SHA-256. |

Import accepts bounded valid JSON whitespace; export uses deterministic canonical JSON and sorted binary assets. Descriptor/history ordering remains part of the retained document. There are no implicit paths, network URLs, offsets, compression or archive extraction. Duplicate/unordered hashes, unknown keys/versions, malformed UTF-8, mismatched sizes/hashes, truncated data and trailing bytes reject before a restore is offered.

The complete file is at most **256 MiB**, including its 12-byte header and manifest. The manifest is at most **2 MiB + 64 KiB**; validated still and nonempty story documents together still share the existing **2 MiB** allowance. The extra manifest allowance covers framing and the asset table, not extra stored metadata. At most **512 original entries**, each at most **64 MiB**, are allowed. Existing descriptor bounds remain: one finite MP4/WebM segment, `0 ≤ start < end ≤ verified duration`, source at most **120 seconds / 1920×1080**, and **8 KiB** per descriptor. No limit is raised.

## API stages

`game/story-bundle.mjs` exports:

| Operation                                                                 | Result and side effects                                                                                                                                                                                                                     |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `exportStoryBundle(document,assets,{still,signal})`                       | Owns JSON/native Blobs before awaits; validates complete original hashes/lengths; returns a native bundle Blob. No codec, database or download action.                                                                                      |
| `inspectStoryBundle(blob,{signal})`                                       | Validates the bounded file, retained metadata relationships and all exact original bytes. Returns an immutable plain inventory; **not** a playback/import capability.                                                                       |
| `importStoryBundle(blob,inspectionOptions)`                               | Also silently inspects every available native video through the existing `prepareVictoryStory` path and compares all source facts. Returns a private imported capability. No database writes.                                               |
| `prepareStoryBundleRestore(imported,{store,signal,...inspectionOptions})` | Requires that capability and an explicit v4 story adapter. Stages one complete destination merge; returns an immutable review with expected generation, merged document, available-original count and conservatively reserved source bytes. |
| `commitStoryBundleRestore(review,{signal})`                               | Consumes the review once and performs the adapter's single final generation-checked transaction.                                                                                                                                            |
| `cancelStoryBundleRestore(review)`                                        | Discards that review and attempts to release only its lease.                                                                                                                                                                                |

The adapter's new `stageRestore({document,assets},{signal,...inspectionOptions})` is also a public lower-level preparation seam. It always owns and validates its inputs and performs native inspection; direct use is not a byte-only bypass. Decoder factories in `inspectionOptions` are trusted application/test capabilities, never JSON fields. Default import and staging require real native inspection. A correctly hashed file or declared MIME alone does not establish playable codec support.

A future native UI should use Prepare → explicit visible Download, retaining the prepared Blob URL until replacement/disposal; preparing bytes is not proof of disk completion. For recovery, native file selection → Import/inspect → Review → explicit Restore should expose the complete proposed history and video count, cancellation and missing-original guidance. This slice intentionally supplies no UI or database choice.

## Destination merge and failure behavior

Restore resolves every incoming descriptor against the destination's retained still metadata. It never adopts the bundle's still document or guesses from the currently installed pack. Before staging an available incoming video, it verifies the destination's exact poster original; missing/corrupt poster bytes refuse before video inspection. Detached incoming histories may remain explicitly unavailable with valid retained metadata. Every later acquisition still verifies the actual poster and video again.

Local and imported descriptor histories are united by exact `(id,revision)`; any conflicting immutable revision rejects the **whole** update. Local available-video hashes are retained even when absent from the imported bundle. Imported exact originals can repair missing or corrupt local video bytes without changing the descriptor. Restore neither evicts content nor infers deletion from missing references. Explicit removal remains the existing store operation.

One reservation covers incoming source bytes plus proposed row metadata before decoding. It is deliberately conservative even if a hash can be reused. Near capacity, a repeated or duplicate restore may therefore refuse even when the final deduplicated inventory would fit; idempotent content does not guarantee staging headroom. The final serialized CAS checks destination generation, exact retained identities, all physical media/audio rows, combined metadata, other reservations and the unchanged **256 MiB committed-plus-staging** budget. There is no temporary second database. Complete native inspection precedes the synchronous transaction: a second video's failure, stale review, expired lease, quota refusal or transaction abort cannot publish a partial imported story set. Unrelated audio/still data and reservations remain owned by their existing domains.

Cancel/close cleanup is best effort if storage becomes unavailable; a retained lease expires at the existing **15-minute** deadline and a later successful operation can remove its row. Cancellation cannot undo a completed commit. A copied/serialized/imported review or a review from another store cannot substitute for the private capability. No automatic retries or installs occur.

## Read-only CLI

```sh
node scripts/story-bundle.mjs inspect /absolute/path/owned.rlstory
```

The CLI opens one ordinary local file with a bounded fixed-size read and checks its size/modification time again after reading. Non-regular files reject; a FIFO does not block awaiting a writer on the supported POSIX path. It does not extract files, write IndexedDB, fetch URLs, import a story, or decode video. A successful JSON report uses `status:'METADATA_AND_ORIGINAL_BYTES_PASS'` and `codec:'NOT_TESTED'`, with the complete file SHA-256 and each available original's size/hash. Treat it as byte/metadata evidence, never browser codec, earned ownership or complete paired-backup evidence. Concurrent hostile filesystem replacement is not a separately qualified durability guarantee.

## Recovery and the remaining playable slice

A fresh destination needs compatible game data/pack identities as applicable, exact still owners/posters from `.rlmedia`, videos from `.rlstory`, and custom audio separately from `.rlsound`. These are four distinct inventories, not one renamed complete backup. The paired still/story sequence is not a cross-file transaction; the **story merge itself** is atomic. A refused story restore leaves successfully restored still data intact and offers no false story success.

Explicit v4 uses the original shared database. **Old v3 readers can receive `VersionError` after upgrade.** Future ordinary/practice/course audio and authoring hosts must migrate together to their one current shared manager, with managed practice pictures still disabled. Recover old `.rlmedia`/`.rlsound` originals through that manager; do not delete/downgrade the database or promise frozen clients keep reading it.

Remaining work is one native authoring upload/segment/poster binding, new versioned attempt and first-earned story authority, current-manager adoption, and a real win that records once before optional Play/Skip and returns to the exact poster. Collection Replay must not award again. Native paired download/fresh-origin restore, autoplay refusal, focus pause, volume/music restoration, server-stopped playback, build/offline inventories and archived-client recovery require separate acceptance. Physical-device codec and comfort coverage remains open.

## Verification boundaries

Focused tests retain the actual owned 75,767-byte diagnostic MP4 and a second byte-distinct MP4 made by appending an empty `free` atom. SHA-256, Blob ownership, binary framing, actual filesystem CLI reads and the existing original bytes are real; native video metadata/image dimensions and IndexedDB transactions use the project's injected models. The tests exercise full two-source paired recovery, exact re-export, target poster refusal, original repair, immutable conflicts, original/history union, stale/cancelled/expired reviews, timeout/second-source failure, quota/write rollback and legacy format rejection. They do not establish native browser decoding, disk download activation, browser durability, cold offline playback, host integration or a public release.

Initial evidence is retained separately: the first new signature accidentally matched `.rlsound` and the legacy-format test caught it; the new story signature was corrected without changing any old format. A later second-source negative fixture changed dimensions after its metadata event and therefore did not exercise a mismatch; it was corrected to deliver wrong metadata before the event. Final source/test hashes and exact test counts are recorded in `.cache/story-bundle/` after independent review. No whole-suite, build, release or browser gate is claimed for this isolated transfer slice.
