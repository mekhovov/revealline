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

## Explicit generic-history limitation

The current manager requires pre-still generic-v2 references to remain exact. A bundle carrying a generic reference absent from, or different in, the destination is valid portable **inventory**, but cannot be adopted there by this API. Review refuses before domain mutation with a specific recovery message. Keep the original bundle; do not label that refused transfer a complete restore. An empty incoming generic set can preserve a destination's existing references. Incoming references already present with identical IDs/hashes can round-trip alongside rich still history.

The smallest later policy extension would make only generic-reference additions legal while keeping every current ID/hash immutable, rejecting all ID collisions and every rich-to-generic downgrade. The final serialized transaction would enforce that monotonic rule and the same combined inventory/staging caps. Tests must cover fresh-target generic restore, shared audio hashes, concurrent foreign preparations, changed/removal IDs, and quota/abort rollback. That manager/schema-policy change is deliberately not implemented in this new-files-only slice.

## Backup ordering and Undo

Use verified media restore before adopting game-data files that reference those originals. Existing profile/session/pack recovery remains a separate operation. If game-data import later fails, say that the newly imported originals remain retained; this API does not claim cross-store atomic rollback.

Undo can explicitly restore an earlier assignment set using a new current-generation review, while keeping all later originals/history. A stale review cannot be reused after a successful commit. Neither ordinary import nor Undo deletes history or reclaims bytes. GC, durable earned receipts and live-session pins are separate versioned runtime work.

Focused tests cover binary corruption and strict owners, original-byte round trips, removed-pack restart hydration, assignment restore/Undo, immutable conflicts, cancellation, stale writers, quota/transaction refusal, original MP3 preservation and the generic-reference refusal. They use finite modeled IndexedDB and injected decoders. Real browser upgrade, native download/file import, decoded image inspection and runtime/Collection adoption remain unqualified here.

See [storage](media-storage.md), [still identity](media-presentation.md) and the [source workshop](still-media-workshop.md).
