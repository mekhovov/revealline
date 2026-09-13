# Still-originals binary bundles

`game/media-bundle.mjs` provides `.rlmedia` export, validation and explicit target-store restore. It is a data API; no game or workshop imports it yet, and no download button, runtime picture adoption, saved-flight pin or earned receipt is added by this slice.

The file contains the complete **referenced still-domain inventory**: rich metadata, exact historical campaign owners, every immutable still asset/presentation, assignments, and referenced generic bytes retained from v2. Original PNG/JPEG and generic payload bytes are never resized, cropped, reencoded or base64 encoded. Audio-only originals, player profiles, saved flights, installed packs and unreferenced database blobs are outside this format. Keep the corresponding game-data and `.rlsound` files; this is not a complete game backup.

## Binary contract and limits

The first eight bytes are `RLMDB1\r\n`. A four-byte unsigned big-endian length follows. That length selects a UTF-8 JSON manifest with exact fields `{format, document, assets}`. `format` is `revealline-media-bundle.v1`; `document` is the existing strict `revealline-still-storage.v1` record. `assets` is an ascending SHA-256 table of `{sha256, bytes}`. Raw payloads follow in exactly that order, without padding or trailing bytes.

Exports use canonical JSON and sort hashes. Multiple metadata IDs may share one original; its payload appears once. Imports require every referenced hash and no extra payloads. Structural/header/owner validation precedes image decoding. All original lengths, hashes and image facts must match; static PNG/JPEG imports require a real decoder by default. Generic retained bytes are hash checked and never represented as verified images.

Limits are unchanged: 256 MiB for the whole binary file including its manifest/header; 2 MiB for the rich metadata including owners; at most 512 combined asset hashes. The transport manifest allows another 64 KiB for that finite table. Still images remain limited to 4 MiB each, 8,192 pixels per side and 16 megapixels, and assigned posters to 1,920×1,080. Retained generic sources remain under the manager's 64 MiB per-source bound. Store commits additionally enforce actual shared audio/media committed-plus-staging usage within 256 MiB. A file fitting the transport cap does not guarantee room to merge it into a destination.

Only the bounded header/manifest and one original at a time need an ArrayBuffer. The file and returned raw payloads are owned native Blob slices. The API does not decode a whole album/image library into a retained canvas or PCM buffer. The injected decoder in tests establishes the code boundary, not browser image quality.

## API and review

```js
const file = await exportMediaBundle(saved.document, saved.assets, { signal });
// Present an explicit native download action; these APIs do not click links.

const imported = await importMediaBundle(chosenFile, { signal });
const review = await prepareMediaBundleRestore(imported, {
  store, // Existing still adapter sharing the same explicit v3 audio/media manager.
  assignmentMode: 'preserve',
  signal,
});
// Show exact review.document, original count/bytes and assignment policy.
const committed = await commitMediaBundleRestore(review, { signal });
```

Import verification does not access a database. Preparing a restore reads and verifies the destination through the supplied store; that store may perform its explicitly authorized database opening/upgrade. Review makes no media-domain writes or staging reservations. It is branded in memory, binds the specific store object and expected media generation, and cannot be reconstructed by copying its JSON. Commit does not reread the chosen file or resolve current installed content.

`assignmentMode:'preserve'` keeps destination assignments and adds only currently unassigned identities from the file. Explicit `'restore'` adopts the file's complete assignment set, including removals. Both modes retain all destination originals, presentation revisions and historical owners. Identical immutable entries deduplicate; conflicting IDs/revisions or an absent older revision that violates the existing increasing-revision rule refuse during review. They are not renamed, skipped or silently rewritten. Imported historical owners validate the stored media; they do not install packs, unlock maps or award completion.

The manager repeats actual-current-row history checks within its serialized write transaction. A newer media writer invalidates the review. Reported browser quota, actual shared staging budget, transaction failure or abort before commit preserves the prior authoritative records. Only that operation's staging reservation is released. Abort after the transaction completed cannot turn a successful save into a claimed rollback. Closing a borrowed store follows its existing lifecycle convention; pass the operation signal to cancel in-flight work.

## Retained generic-history portability

Every current generic ID→hash remains immutable. Verified new IDs may be added, so a bundle containing rich stills and generic originals can restore its full referenced inventory into a fresh v3 store. Import unions both reference sets, deduplicates identical entries and rejects an existing ID with a different hash before domain mutation. An empty incoming set preserves the destination's references. Neither assignment restore nor Undo removes these references or their originals.

The same monotonic rule runs before staging and inside the existing serialized transaction, even for a preparation from another store. A rich-to-generic downgrade remains forbidden. Generic bytes are hash verified, not automatically certified as images or MP3 tracks. A hash already held by the audio domain is reused and remains retained if audio later relinquishes it. No DB version, store count or quota was changed. Conflicting identities, insufficient capacity or missing originals still make a destination restore fail; never present such a refusal as a completed backup restore.

## Backup ordering and Undo

Use verified media restore before adopting game-data files that reference those originals. Existing profile/session/pack recovery remains a separate operation. If game-data import later fails, say that the newly imported originals remain retained; this API does not claim cross-store atomic rollback.

Undo can explicitly restore an earlier assignment set using a new current-generation review, while keeping all later originals/history. A stale review cannot be reused after a successful commit. Neither ordinary import nor Undo deletes history or reclaims bytes. GC, durable earned receipts and live-session pins are separate versioned runtime work.

Focused tests cover binary corruption and strict owners, original-byte round trips, removed-pack restart hydration, assignment restore/Undo, immutable conflicts, cancellation, stale writers, quota/transaction refusal, original MP3 preservation and generic-reference portability. They use finite modeled IndexedDB and injected decoders. Real browser upgrade, native download/file import, decoded image inspection and runtime/Collection adoption remain unqualified here.

See [storage](media-storage.md), [still identity](media-presentation.md) and the [source workshop](still-media-workshop.md).
