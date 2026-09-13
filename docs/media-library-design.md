# P5 — managed pictures and victory stories

## Current source contract

The still-image slice is implemented and passes exact-source and bounded source-browser checks. It is not yet a frozen/public P5 release, and video/GIF/story playback is not implemented. [Current qualification and receipt hashes](feature-delivery-workflow.md#current-still-integration-evidence) distinguish those gates; the broader [production plan](production-plan.md) retains every unfinished target.

| Layer           | Implemented contract                                                                                                                                             | Remaining boundary                                                                                                                                   |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Shared storage  | One explicitly adopted rich IndexedDB **v3** manager for audio and stills; 256 MiB committed-plus-staging ledger, immutable originals, validated retained owners | Real quota/blocked-tab stress, cold offline recovery and next-edition delivery; older v1/v2 readers may refuse this origin after upgrade             |
| Still authoring | Native PNG/JPEG import, full decode/hash, preview, exact map/theme assignment, explicit `.rlmedia` review/restore/download                                       | No video, GIF, scrubber or runtime story; `revealline-media-presentation.v1` requires `story:null`                                                   |
| Live flight     | All-theme immutable picture choices; selected decode before first tick; image/fit staged together; `xonix-session.v3` preserves A after assignment B             | Missing managed originals keep restoration paused; no implicit replacement                                                                           |
| Collection      | `xonix-library.v3` first-earned receipt and completion in the **same guarded profile write**; later better B does not replace A                                  | Retained owner allows managed still viewing after pack removal; replay needs exact installed content; actual removed-pack browser check remains open |
| Transfer        | Game-data JSON carries pins/receipts/packs/saved flight; `.rlmedia` carries referenced still/generic originals/history; `.rlsound` carries audio                 | These are separate reviewed files, not one atomic all-in-one backup                                                                                  |

Read [still identity](media-presentation.md), [storage](media-storage.md), [live flight](flight-pictures.md), [first-earned receipts](picture-receipts.md), [Collection](earned-picture-view.md), [binary originals](media-bundle.md) and [game-data recovery](full-backup.md) for the actual APIs. Retained owners are exact normalized campaign/roster context, not installations or awards. Packaged game and workshop channels use the same exact `release-${buildInfo.version}` label, including any leading `v`. The workshop accepts HTTP 404 as source `dev`; a failed/malformed workshop build-info read does not silently select that fallback.

Originals are append-only and committed before an attempt can use them. Victory does **not** write an IndexedDB receipt, acquire a pending presentation lease or reconcile a second receipt transaction. Completion and its first-earned choice use one guarded player-profile write. The shared store's import reservations are a separate storage-budget mechanism. Pruning/GC and durable cross-store receipt leases are unimplemented; do not add them from the historical proposal below.

## Next video and story slice — proposed

Start with one owned short clip and one exact map/theme. This is a new versioned contract and a later gate, not permissive fields added to the existing still-only v1 schema. The user examples folder is currently empty; create a labeled original test clip and retain its source/encoder recipe, without claiming a supplied video was inspected.

1. **Import and probe bounded original bytes.** Validate actual container/codec support, finite dimensions/duration and chosen source limits before large allocations. Preserve the original, hash it, decode sequentially, and keep one active probe/capture per tab. Unsupported, corrupt, oversized or cancelled work preserves the prior candidate. A selected segment is not a smaller encoded file; publication limits apply to actual derivative bytes.
2. **Select and verify the poster.** Keep the requested seek time separate from the observed decoded-frame timestamp. Seek through visible controls, await an available decoded frame, record `requestVideoFrameCallback`'s `mediaTime` when available, then capture/decode/hash and preview the resulting PNG. Save those exact PNG bytes as the poster; do not reconstruct it by seeking during later wins. A fallback may record an approximate playhead observation, but must label the missing frame-level evidence rather than copying requested time into an observed field. Handle zero/already-selected positions, timeout, abort, overlapping scrubs and late callbacks without publishing stale frames.
3. **Choose a separate story segment.** Poster time and finite story start/end are independent. The default is the ending/key frame as the earned image, followed by playback from the story's beginning. Preserve derivatives' parent hashes, real encoding/tool facts and dimensions; publish only after a real supported decode and bounded-byte check. GIF needs a controlled decoder or recorded conversion path, not an unpausable animated image.
4. **Keep playback outside progression.** Record the real win once, reveal the pinned still, optionally Play the story, then return to that exact still. Provide Play/Pause, Skip and replay from Collection with the same keyboard/controller/touch navigation. Hidden pages pause presentation; returning focus cannot resume flight. Failed playback, missing optional video, skip and repeated replay never grant awards or replace the earned still. Reduced-motion mode must retain a usable static reward. Story/music/effects volume and listening intent need separate ownership.
5. **Qualify the whole selected story.** Use actual native file selection and downloads, poster preview, legal win, skip/replay and exact return image. Verify fresh-origin paired transfer and prepared cold offline playback separately. Include keyframe spacing, variable frame rate, nonzero media timelines, repeated seek, missing optional story, cancellation, autoplay denial and stale owner generations. Record browser/codec support; simulated events and successful capability probes are not actual playback evidence.

Assigning `currentTime` requests a seek; it is an approximate playhead value and does not identify an arbitrary exact frame. A video-frame callback provides a presented frame's `mediaTime`, but may arrive a display refresh late. The implementation should use that observed metadata plus the saved PNG, without promising frame-number or millisecond precision it has not measured. [MDN currentTime](https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/currentTime), [MDN requestVideoFrameCallback](https://developer.mozilla.org/en-US/docs/Web/API/HTMLVideoElement/requestVideoFrameCallback).

Our proposed accessible story controls apply the guidelines' same-input menu access, readable controls, player-paced text, replayable narrative and independent audio settings. Static rewards and optional motion preserve access when animation is uncomfortable. The precise Play/Skip/Replay sequence above is our design, not an existing capability or a quotation from the guidelines. [Game Accessibility Guidelines](https://gameaccessibilityguidelines.com/full-list/).

## Historical design record

The following is preserved from the initial P5 proposal and v0.25 handoff. Its sample schemas, v1→v2 rollout, proposed cross-store earned receipts/leases, backup inventory and unimplemented APIs are **not current instructions**. The current contracts above supersede them. Its old `currentTime` rounding rationale is also superseded by the current MDN guidance linked above. No old release or evidence has been rewritten.

<details>
<summary>Initial P5 proposal and historical v0.25 storage boundary</summary>

Design status: **shared storage is prepared source, excluded from v0.25; video authoring and rewards are not implemented**. The prepared manager passes 73 affected storage/audio checks against the final R2 host helper, including 22 store cases and archived v0.24 adapter compatibility against a modeled IndexedDB. Real-browser migration/quota/recovery and the complete media journey remain open. Audited 2026-09-13 against the v0.24/P3 foundation and the active P4 working tree. This document refines P5 in [the approved roadmap](implementation-roadmap.md); it does not change the gameplay, score or replay contracts.

The first deliverable is one complete journey: **import an owned short video → choose a still and story segment → assign to an exact map/theme → earn the picture through a real win → watch/skip/replay its story → export/import the original bytes**. Build shared storage first so audio and video cannot each claim a separate 256 MiB allowance.

## 1. Existing seams and gaps

| Existing component                                                                        | Keep                                                                                                    | P5 extension                                                                                                                                                                           |
| ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Authoring media CLI](../authoring/media/README.md), `mediaVersion: 1.0.0`                | Byte-identical originals, hash-addressed files, provenance, reviewed derivatives, role/variant bindings | Explicit compiler into runtime media records; the CLI currently inspects raster headers and registers separately produced derivatives, not video decoding, conversion or AI generation |
| [Runtime image configuration](assets-and-configuration.md), [packs](library-and-packs.md) | Static PNG/JPEG/WebP data URLs, decode-before-install, strict provenance and limits                     | Optional media sidecar; leave old pack versions and embedded bytes unchanged                                                                                                           |
| `game/app.mjs` `visuals()`                                                                | Per-level overrides over pack defaults                                                                  | Resolve a pinned presentation revision over the same fallback before starting a run                                                                                                    |
| [Player library](../game/library.mjs)                                                     | Run-authorized completion, score separation, gallery keys                                               | Separate earned-media receipts; no video callback can award a completion                                                                                                               |
| [Collection](../game/ui/library-panel.mjs)                                                | Paging, difficulty grouping, missing-pack recovery, presentation-only celebration                       | Independently retained earned stills, optional story player, missing-video status                                                                                                      |
| [P3 soundtrack library](soundtrack-library.md)                                            | MP3 records, playlists, player transport, original binary `.rlsound` archive                            | Route its storage adapter through the shared budget authority; preserve its public model and binary format                                                                             |
| [Existing JSON backup](full-backup.md)                                                    | Its exact legacy scope and recovery journal                                                             | A separate media archive initially; later a coordinated game-plus-media archive, explicitly versioned                                                                                  |

Current runtime still-image guards are 4 MiB original bytes, 6 MiB encoded per image, 20 MiB combined encoded, 8,192 pixels per side and 16 megapixels per image. Packs additionally cap combined decoded images at 32 megapixels and JSON at 24 MiB. GIF/animated WebP/APNG are not accepted as static runtime images. These limits remain intact for old formats.

Collection currently stores picture metadata, not independently archived image bytes; viewing requires its source pack. Existing gallery records are keyed by campaign/map/theme, while level revision and source pack are recorded as metadata. P5 must not promise that old gallery entries already preserve their original pixels.

`docs/research/videos-examples/` exists and contains **zero files**. No supplied clip has been decoded or assessed. Use a clearly identified owned fixture; inspect user examples when files become available.

## 2. Records and presentation identity

Use bounded plain-data formats. Reject unknown versions/fields, non-finite times, duplicate IDs, cycles, executable values, path traversal and external playback URLs. Binary records reference SHA-256 hashes; object URLs are temporary runtime handles and never serialized.

| Proposed record                    | Required information                                                                                                                                                                                                                                                     |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `revealline-media-asset.v1`        | `id`, `kind` (`image`, `video`, `gif`), `role` (`original`, `poster`, `runtime`), `blobHash`, exact `bytes`, detected `mime`, decoded dimensions, optional duration; bounded title/author/source/rights; derivative parent hash and actual tool/settings when applicable |
| `revealline-media-presentation.v1` | Immutable `id` and integer `revision`; exact `identity`; required poster asset; optional story; fitting/sampling and authored accessibility description                                                                                                                  |
| `revealline-media-library.v1`      | Asset records, immutable presentations and mutable assignments; no player achievements                                                                                                                                                                                   |
| `revealline-earned-media.v1`       | Profile channel, existing gallery key, verified run ID, exact presentation ID/revision, poster hash, optional story reference and completion time                                                                                                                        |
| `revealline-media-bundle.v1`       | Versioned archive manifest, exact media library, optional unchanged P3 soundtrack library, sorted blob table, export scope and any explicit omitted optional files                                                                                                       |

Example presentation shape (identifiers below are illustrative):

```js
{
  format: 'revealline-media-presentation.v1',
  id: 'orchard-window-story', revision: 1,
  identity: {
    campaignEdition: '<original authored campaign key>',
    levelId: 'orchard-window', levelRevision: 1, themeId: 'fpv'
  },
  poster: {
    assetId: 'orchard-ending-png', fit: 'contain', sampling: 'nearest',
    capture: {
      sourceAssetId: 'orchard-original-video',
      requestedSeconds: 7.2, observedSeconds: 7.2,
      timingEvidence: 'video-frame-callback'
    }
  },
  story: {
    assetId: 'orchard-runtime-video', inSeconds: 0, outSeconds: 8,
    posterSourceSeconds: 7.2,
    sourceRange: { originalAssetId: 'orchard-original-video', inSeconds: 0, outSeconds: 8 },
    audio: 'muted', returnToPoster: true
  },
  description: 'A signal tower lights the orchard at night.'
}
```

The poster can come from a different source time than the story segment. `capture` is optional for uploaded stills; `observedSeconds` is nullable when the browser cannot report a decoded-frame timestamp. Store the timing evidence honestly. The saved PNG is the authoritative final picture, regardless of later seek precision or codec differences. Returning to it means showing those exact saved bytes, not seeking the video again.

Assignment key is the canonical tuple `[campaignEdition, levelId, levelRevision, themeId]`, using the same original-edition resolution as P3 `soundtrackContext()`. Gentle/Standard variants share art when they derive from the same authored edition. Difficulty and Arcade/Tactical score identities remain separate. Any intentional mode-specific artwork needs an explicit future identity extension, not accidental use of the current score key.

An assignment references `{presentationId, revision}`. Editing a poster, segment or rights record creates a new presentation revision and switches the assignment atomically. A run resolves and pins its revision before play; changes in another tab cannot change the picture halfway through that run. Per-map assignments win over an explicit theme default; otherwise use the existing per-level/pack background. Campaign content production will supply exact assignments so fallback does not disguise missing required pictures.

Do not add fields to strict historical gameplay-pack records. A media sidecar names the exact installed campaign/level identity and is validated against it. A later pack compiler can emit gameplay JSON plus the sidecar and blobs without changing deterministic rules, seeds, checksums or replay versions.

## 3. One shared storage authority

### Database and compatibility

Upgrade the existing **`revealline-soundtrack-v1` IndexedDB database from version 1 to version 2**; retain its name for continuity. Keep its `metadata` and `audio` stores and original blobs. Add `mediaRecords`, `mediaBlobs`, `assetIndex`, `reservations`, `mediaReceipts`, and `managedState`. All P3/P5 writers use one manager. No second independently writable video database and no caller-supplied `otherManagedBytes` authority.

`assetIndex` maps hash to physical store, byte size and references. Existing MP3 bytes stay in `audio`, avoiding a duplicate-copy migration. New non-audio bytes use `mediaBlobs`. The shared index prevents double counting a hash or deleting a blob still needed by another record, staged import, live presentation lease or earned poster. Metadata and reservation overhead also count.

Schema upgrade inventories actual stored Blob sizes and bounded metadata in its upgrade transaction, then builds the ledger without modifying preserved audio. Full hash/MP3 validation runs afterward, outside the transaction, before writes become ready. Corrupt or unsupported existing records remain counted and recoverable; block mutations with a repair/export message instead of dropping them. An existing over-budget installation opens for recovery/export and deletion only. Failure aborts the upgrade; do not erase or recreate the database.

New code opens v2. v0.24's existing `onversionchange` handler closes its v1 connection; a later `open(name, 1)` cannot write v2. If an old connection blocks upgrade, show “Close older game tabs to upgrade media storage,” cancel this attempt and retry deliberately. Old immutable game releases remain playable with their built-in soundtrack fallback, but cannot administer the upgraded local library. This is an explicit compatibility limitation, not a reason to keep a second writable v1 database. `.rlsound` files remain portable to v0.24 and later. Test this with the actual archived v0.24 store. Browser schema changes notify open connections through [IndexedDB versionchange](https://developer.mozilla.org/en-US/docs/Web/API/IDBDatabase/versionchange_event).

### Budget and concurrency protocol

The managed ceiling is **256 MiB total across audio, original images/video/GIF, runtime derivatives, posters, metadata, retained Undo data and staging reservations**. The static game-shell precache remains within its separate 64 MiB budget. Existing legacy embedded-image/profile stores retain their documented limits; this is not a claim that total origin usage is 256 MiB. New optional media bundles must use this manager rather than writing an uncounted second Cache API copy.

Every mutation shares a short IndexedDB `readwrite` scope including `managedState`, `assetIndex`, `reservations` and all affected record/blob stores. Overlapping read/write scopes serialize across tabs. Hashing, browser decoding, user interaction and unrelated promises happen **outside** the transaction; the transaction must not be held open across them. These choices follow [IndexedDB transaction scoping](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API/Using_IndexedDB) and its [transaction lifecycle](https://developer.mozilla.org/en-US/docs/Web/API/IDBTransaction).

1. **Reserve:** after checking a local file's byte limit, acquire a random operation token and reserve a conservative upper bound for new source bytes, allowed derivative bytes and new metadata. In the shared transaction, read actual committed use and every active reservation. Reject if `committed + reserved + newReservation > 256 MiB`. No blob is written first and accounted later.
2. **Prepare:** inspect/hash/probe one file at a time; retain the File/Blob without decoding an album or all video frames. Reserve more _before_ exceeding an allowance. Imported duplicates may initially be over-reserved; reduce only after verified hash/size identity. Caller promises do not establish deduplication.
3. **Stage if needed:** atomically convert reserved capacity into actual staging bytes in the same ledger. A byte is counted once, either resident or reserved. Staged blobs are invisible to runtime assignments. The small first slice can keep its bounded original File outside IDB until commit, while still holding the reservation.
4. **Commit:** prepared capabilities contain frozen records and verified byte facts. In one transaction, recheck reservation token/expiry, expected audio and/or media generation, pinned references, metadata limits and budget; adopt blobs/records, switch assignments, increment affected generations and release the reservation. Transaction `complete` is success. A late cancel after committed success cannot report rollback.
5. **Cancel/conflict/failure:** release only this operation's staged references and reservation. Preserve the working edition and other tabs' work. On stale generation, require reload/reapply; never overwrite a newer library. Audio-only and media-only edits use distinct domain generations; both still compete against the same live ledger.

Old and replacement bytes coexist until commit. Count that peak, including Undo retention; deleting old data first to manufacture free space is disallowed. Same-hash replacement can reuse validated bytes. Automatic eviction is limited to expired staging with no committed/earned/live reference; never evict an earned poster, active playlist or original merely to pass import.

Use reservations with a 15-minute lease, renewal while actively preparing/editing, and a token check on every write. At most four simultaneous reservations; bounded metadata prevents an abandoned-operation flood. Sleeping tabs may lose their lease: they must reserve and validate again before committing. Cleanup and renewal serialize through the ledger, so an expired owner cannot commit after another tab reclaims its reservation. A backward clock jump can delay reclamation but cannot create capacity; forward expiry only cancels old work. BroadcastChannel/Web Locks may improve UI messages, but transaction checks remain sufficient without them.

`navigator.storage.estimate()` is advisory device headroom, not the ledger or a synchronization mechanism; it is explicitly approximate. Catch quota failure even below our limit. Request persistence only through a visible storage action and show its actual result; neither “stored” nor a service worker implies permanent offline availability. See [StorageManager estimates](https://developer.mozilla.org/en-US/docs/Web/API/StorageManager/estimate) and [browser quotas/eviction](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria).

## 4. Uploads, posters and controlled stories

Initial **configurable** P5 limits, separate from unchanged P3 MP3 limits:

| Resource              | Initial ceiling / behavior                                                                                                                       |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Video or GIF original | 64 MiB per file; reject before reading the full file                                                                                             |
| Source video          | Finite duration up to 12 minutes; decoded dimensions up to 3,840×2,160; local MP4/WebM only after structural inspection and actual browser probe |
| Still original        | Existing 4 MiB/static decode limits for the first slice; preserve bytes before deriving                                                          |
| Runtime story         | 30 seconds, 16 MiB, at most 1,920×1,080; target 1,280×640 and at most 30 fps in the authoring converter                                          |
| Poster                | PNG, at most 1,920×1,080 and 4 MiB; default keep full image with `contain`; no silent crop                                                       |
| GIF source            | At most 1,920×1,080, 900 frames and 30 seconds after inspection; longer sources require a separately selected bounded derivative                 |
| Catalog               | Initially 512 assets, 256 presentations, 512 assignments and 2 MiB media metadata; existing gallery/receipt cap remains 4,096                    |
| Active work           | One decode/capture operation per tab; one displayed story decoder; at most current/next GIF frame held                                           |
| Optional download     | At most 64 MiB per chapter/theme bundle, also charged against the 256 MiB shared pool                                                            |

A browser file MIME/extension or successful `canPlayType()` is not sufficient. Validate container structure/size, reject encrypted tracks and remote references, probe finite duration and dimensions, then decode beginning/selected poster/segment boundaries with timeout and cancellation. Container/frame-rate facts require a bounded parser or the conversion tool's independently verified output; metadata alone does not prove every frame decodes. Record observed support on this browser, not universal codec compatibility.

For the first slice, a source within runtime limits may serve as its own runtime asset. Longer/larger sources can be retained and previewed, but cannot be published as a story until a real bounded derivative is produced. Selecting an 8-second interval inside a 12-minute original does **not** reduce its download/decode-file size. Never silently truncate or call a metadata-only interval a transcoded clip.

Poster selection uses a muted `playsInline` video with an owned Blob URL. On scrub, cancel the previous request, set `currentTime`, await `seeked` and decoded data, and prefer `requestVideoFrameCallback` to record the displayed frame's `mediaTime`. At time zero/already-selected positions, handle an available decoded frame without waiting for a nonexistent new seek event. Feature-detect and time out; on older implementations use a labeled timestamp estimate plus visible captured preview. Avoid `fastSeek` for final selection. `currentTime` can be rounded, while frame callbacks report presented-frame timing; neither justifies promising arbitrary frame-number precision. See [seeking](https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/seeked_event), [currentTime](https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/currentTime) and [video frame callbacks](https://developer.mozilla.org/en-US/docs/Web/API/HTMLVideoElement/requestVideoFrameCallback).

Draw the accepted frame to a bounded canvas, encode PNG, reject a null result, inspect/decode/hash the actual Blob, and preview **that Blob** before Save. Preserve original source bytes and chosen crop/fit settings separately. Reset media `src`, call `load()`, remove listeners, cancel callbacks and revoke owned URLs on disposal. Encoding and origin-clean failures are real errors; local Blob ingestion avoids arbitrary cross-origin capture. [Canvas `toBlob()`](https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/toBlob) documents both null encoding results and the security exception.

Do not use an uncontrolled animated `<img>` as the final GIF player. Prefer converting GIF to a short silent runtime video with its original GIF retained. Where `ImageDecoder.isTypeSupported('image/gif')` succeeds, a worker-based optional preview can request specific complete frames and honor durations, pause, seek, cancellation and reduced motion; close every VideoFrame and decoder. This API has limited browser availability, so a tested offline conversion adapter is required for the complete cross-browser workflow. [ImageDecoder](https://developer.mozilla.org/en-US/docs/Web/API/ImageDecoder) and [frame decoding](https://developer.mozilla.org/en-US/docs/Web/API/ImageDecoder/decode) describe the relevant interfaces.

Provide an optional local CLI conversion adapter with argument-array subprocess invocation, no shell interpolation, pinned tool/version in provenance, resource/time/output caps and actual output inspection. Keep conversion separate from `media.py` original import; register a new derivative. Do not load a large transcoder into every player's browser. Browser WebCodecs alone is not a universal media converter: demuxing/muxing and codec support still need implementations. [MDN WebCodecs guidance](https://developer.mozilla.org/en-US/docs/Web/API/WebCodecs_API/Using_the_WebCodecs_API).

## 5. Wins, playback and Collection

At run start, acquire a renewable presentation lease and hold its exact poster. At win, keep the existing order: mark the simulation handled → authorize/update completion once → persist the profile → show the full saved poster → optional story → same poster/results. The actual coverage, score and replay remain unchanged. Story failure, skip, decode error, audio denial, tab close or replay never reruns completion logic.

Add an idempotent receipt/pin operation **after confirmed profile persistence**, keyed by profile channel plus gallery key and run ID. It pins the earned poster independently of optional video installation. Cross-store profile saving and media pinning cannot be claimed atomic: create a bounded pending pin while the live presentation lease still protects the poster, reconcile it on startup against the durably saved gallery/run, then finalize or release it. Failed profile persistence leaves the current reward view available with the existing save warning; it must not create a durable earned receipt. A repeated reconciliation never awards points. If a better run replaces gallery statistics later, preserve the prior earned poster revision; changing statistics does not silently replace the collectible. Additional cosmetic revision history is a later bounded UI feature.

If the gallery already has an earned receipt, replaying the map does not create another. If it has none, reconciliation requires the pending receipt's exact run ID and map identity to match the saved gallery entry; an ordinary lower-scoring replay may not replace that entry and cannot be used as evidence for a new durable receipt. Recover unmatched media separately rather than inferring a completion from file ownership.

The receipt sidecar does not extend old strict player-library JSON. Legacy gallery entries retain their pack lookup fallback; new receipts can display the earned still even after its optional story bundle is removed. A missing campaign may disable replaying its gameplay while leaving the retained still visible. A video asset can be explicitly removed from offline storage with its metadata/provenance retained; offer Reinstall when available and never mark it playable offline without bytes. Removing an original is an explicit archive-management action, not an automatic consequence of removing a runtime video.

`createVictoryPlayer` owns one video element and no score/progress API. Controls: Play/Pause, Replay, Seek, Skip/Back, captions/description where authored, and independent cinematic volume. `playsInline` is mandatory. The default story audio is muted; authored audio is opt-in. Reduced-motion users receive the poster and explicit Play. Hidden tabs pause stories and require explicit continuation; returning focus never resumes gameplay.

Bound segment playback using presented-frame timing where available and always stop/show the canonical poster at the endpoint. The fallback event clock is approximate; do not promise frame-exact audio/video trimming from `timeupdate`. Use an actually trimmed runtime derivative when a precise story ending matters. A stalled decoder times out to the poster with Replay available.

Coordinate soundtrack duck/suspend through a new scoped gain/intent adapter; retain the same playlist position. Release it on finish, skip, failure and disposal without overriding an explicit music preference changed during the story. `master × cinematic` controls story audio; `master × music` and `master × SFX` stay independent. Do not implement ducking by overwriting the saved music-volume slider. Handle rejected `play()` with a visible Play control and keep Results reachable.

## 6. Binary export, installation and Undo

Add **`.rlmedia`**, distinct from unchanged `.rlsound` and old JSON backups. Proposed binary framing: eight-byte magic `RLMDB1\r\n`, big-endian uint32 manifest length, bounded canonical UTF-8 manifest, then exact raw blobs in SHA order. Manifest fields explicitly include scope (`archive` or `runtime`), media library, optional P3 soundtrack library, optional receipt export, and `{sha256,bytes,mime}` entries. Derive offsets from checked lengths; reject duplicates, unknown records, truncated/extra bytes, hash mismatch, unreferenced payloads and overflow before adoption. No executable ZIP paths or implicit URL fetches.

An **archive** includes every referenced original, derivative, poster and custom MP3 in its selected scope; fail if any required original is missing. A **runtime bundle** intentionally omits originals/reserve art, lists omissions and is labeled a playable download rather than a complete authoring backup. Deduplicate shared hashes physically. The binary ceiling is 256 MiB including its at-most-2 MiB manifest; reserve room for import staging and runtime metadata before claiming it can install. A valid archive near that ceiling may require an empty library and still fail actual browser quota. Use Blob slices/chunks for hashing and export, not a whole-archive base64/ArrayBuffer copy.

P3 `.rlsound` import/export remains byte-compatible through `createSoundtrackStore`'s adapter. A `.rlsound` replacement mutates only the audio domain and cannot erase P5 records, earned pins or blobs with other references. Full `.rlmedia` audio+video replacement checks both domain generations and commits atomically in the shared DB. Receipt import can only attach to already validated existing completions; importing media alone never unlocks a level.

Undo keeps prior referenced bytes pinned and charged to the same budget. Calculate and display its footprint before replacement. If old+new+Undo does not fit, fail safely with archive/remove choices; do not advertise Undo while deleting its bytes. Clearing Undo is a visible action. Cancel and stale-generation failure release only uncommitted staging.

Legacy “complete JSON backup” must display its exact scope: profile, packs and flight; custom audio/video require their separate media archive. A later single game-plus-media backup needs a new outer format and the existing durable rollback coordinator extended with managed-media snapshot tokens. Stage media first; journal the intended profile/pack/media generations; commit under the profile writer lock; retain old media pins until recovery completes. Never claim one IndexedDB transaction covers localStorage and the legacy pack database. This integration is required before advertising one-file complete-game backup with media.

## 7. Small implementation slices and APIs

| Step      | Deliverable                                                                          | Gate                                                                                                      |
| --------- | ------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------- |
| **P5.1a** | Shared manager and P3 adapter, v1→v2 migration, reservation protocol                 | Existing MP3 tests plus real concurrent tabs, migration, quota/cancel/crash tests; no separate budgets    |
| **P5.1b** | Video probe, poster selection, immutable presentation records; one owned short clip  | Captured PNG matches visible selected frame, source hash unchanged, actual decoded playback               |
| **P5.2a** | Authoring dialog, exact map/theme sidecar assignment, real win and Collection player | Save/reload, genuine win, skip/replay, no duplicate awards, independently retained poster                 |
| **P5.3a** | `.rlmedia`, staging/Undo, offline chapter bundle and recovery                        | Whole-byte archive roundtrip, server-stopped playback, missing video, concurrent replacement              |
| **P5.1c** | Controlled GIF/conversion adapter, media CLI compiler and AI skill updates           | GIF disposal/timing fixtures, supported-browser video derivatives, provenance and bounded resource checks |
| **P5.3b** | Pack generation/preview and coordinated full-game binary backup                      | Authoring→install→win→collection→backup→offline journey for an original animation and uploaded video      |

Substep IDs extend the parent steps in the execution register without renaming them. First interfaces, deliberately separate from simulation:

```js
// game/managed-media-store.mjs — the sole writable budget authority
createManagedMediaStore({ indexedDB, estimate, now });
// readSnapshot({signal}) -> audio/media generations, records, usage, migration status
// reserve({domain, maxNewBytes, maxMetadataBytes, expectedGeneration, signal})
// renew(token, {signal}); release(token, {signal})
// commit(prepared, {reservation, expectedGenerations, retainUndo, signal})
// readBlob(sha256, {signal}); remove(selection, {expectedGenerations, signal})
// pinPresentation(identity, {owner, signal}); reconcileReceipts(profileSnapshot)
// usage({signal}); close()

// Existing public P3 interface remains; its implementation delegates to the manager.
createSoundtrackStore({ managedStore });
// read(), commit(prepared,{expectedGeneration,signal}), close()

// game/media-import.mjs — bounded browser preparation, no persistence
probeVideo(blob, { signal, mediaFactory, timeoutMs });
captureVideoPoster(blob, { requestedSeconds, fit, maxWidth, maxHeight, signal });
// -> {blob, hash, dimensions, requestedSeconds, observedSeconds, timingEvidence}
prepareMediaLibrary(candidate, assets, { signal, probeVideo, decodeImage });
// -> opaque, owned prepared capability; copies/snapshots all input records

// game/media-presentation.mjs — pure exact-identity resolution
resolvePresentation(library, { campaignEdition, levelId, levelRevision, themeId });

// game/ui/media-panel.mjs — native dialog; root owns host/game integration
attachMediaPanel({ document, store, getContext, onLibrary, onOpen, onClose, onError });
// open(), close(), update(), dispose(); no direct profile writes

// game/ui/victory-player.mjs — presentation only
createVictoryPlayer({ container, readBlob, soundtrackSession, onState, onError });
// open(pinnedPresentation), play(), pause(), seek(seconds), skip(), dispose()

// game/media-bundle.mjs
exportMediaBundle(snapshot, { scope, signal, onProgress }); // -> Blob
importMediaBundle(blob, { signal, probeVideo, decodeImage }); // -> prepared capability
```

Reservation handles are opaque and tied to immutable verified preparation; serialized JSON cannot mint them. Mutation APIs return the committed generation and usage, not just a boolean. Library adoption happens only after storage success. `close()` must release this adapter's ownership without closing a shared manager still in use by the other domain. Existing P3 callers retain compatibility options, but `otherManagedBytes` ceases to be a writable budget input.

Update the background-stylist and pack-reviewer skills; add a `xonix-victory-media` skill covering original import, pixel-style derivative provenance, poster/segment selection, animation timing, visual inspection, rights records and exact backup/offline checks. Example prompts must describe produced artifacts and verification, not present desired art as completed work. Bulk illustrations and 12 final stories belong to P6 after this pipeline passes.

## 8. Verification and real-browser fixture

Create an owned 8-second 1,280×640 clip with a visible frame counter/time grid and three distinct scenes. Use simple original geometric animation with a known ending image, no third-party soundtrack, and source-code/rights provenance. Produce MP4 and WebM variants with recorded encoder versions; keep the unencoded fixture recipe. A browser MediaRecorder fixture is acceptable if the actual MIME is checked and playback is verified; successful `isTypeSupported()` alone does not guarantee recording. [MediaRecorder capability checks](https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder/isTypeSupported_static).

Through real visible controls: select the file, scrub to two distinguishable times, capture/inspect the final PNG, select a different story interval, assign it to one installed map/theme, save and reload. Complete that map using actual inputs; verify full picture, story start, Skip, exact saved picture return and Collection replay. Check recorded coverage/score/gallery before and after repeated story replay. Replace the assignment and verify an existing earned poster remains unchanged.

Export `.rlmedia`, obtain the actual downloaded file, verify original and poster hashes, import into a clean test profile, and repeat playback with the server stopped after installing the shell and optional bundle. “File prepared” or a timed-out browser download event does not establish exported bytes. P3's in-app automated download capture remains unresolved; retain that limitation until a real file is obtained and reimported. Do not inject file-input state or use a different browser profile to manufacture evidence. The documented in-app browser filechooser API can select the local fixture; the root task owns that browser session.

Focused automated cases:

- Two real IDB connections reserve/import MP3 and video concurrently near 256 MiB; only capacity-fitting work succeeds. Include simultaneous audio-only metadata edits, stale generations, lease expiry/renewal races, cancellation, failed staging, quota failure and restart reconciliation.
- Actual v1 DB migration preserves every MP3 hash, playlist and selection; archived v0.24 cannot bypass the v2 ledger; failed/blocked migration preserves bytes. Corrupt legacy data is recoverable and counted.
- Malformed container, unsupported codec, oversized header/dimensions, infinite duration, truncated body, GIF frame bombs, media error, rejected play, stalled seek and stale scrub completion preserve the last working presentation. Decoder fixtures are not browser playback evidence.
- Poster export/import is byte-exact; original hashes never change; a long-source interval cannot pass runtime-size limits without a real derivative. GIF timing includes disposal/transparency and closes decoded frames.
- Pause/skip/hide/focus/dispose restore sound intent appropriately, release URLs, keep gameplay paused, and cannot call progression. Reduced motion never forces animation. Keyboard/touch/controller focus can reach every story action.
- Receipt reconciliation at every profile-save/media-pin interruption point never duplicates awards; optional video removal leaves earned posters; concurrent assignment replacement cannot change a live run's resolved revision.
- `.rlsound` remains compatible, `.rlmedia` rejects incomplete archives, Undo retains charged bytes, and legacy JSON export clearly names excluded media. Separate actual-device checks qualify iPhone/Steam Deck; resized desktop screenshots do not.

Completion of P5 requires both the automated storage/model evidence and the real authoring→win→Collection→binary roundtrip→offline journey. Attractive fixture playback alone does not close the phase.

## Public release boundary after v0.25 feedback

The P5 manager remains prepared and explicitly injectable. Ordinary `createSoundtrackStore()` now uses the retained v1 adapter in `soundtrack-store-legacy.mjs`; it does not trigger the unqualified shared-store upgrade. Supplying `managedStore` is the explicit future host integration boundary. The public usability release keeps existing MP3 bytes and archive access compatible. Migration, quota/recovery and multi-tab browser qualification remain prerequisites for making the P5 adapter the default.

</details>
