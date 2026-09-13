# Opt-in still-media storage

The bounded P5 storage slice adds a rich still-image document to the existing managed database. It preserves original audio and the `.rlsound` API, and retains enough exact owner context to hydrate picture history after a pack is removed and the page restarts. The new source game and edition-matched workshop explicitly share this v3 manager with audio. Live pins and first-earned Collection are integrated above it; frozen/public P5 delivery remains pending. Source-art folders are not automatically imported. See [current evidence](feature-delivery-workflow.md#current-still-integration-evidence).

This store implements media history, not progression. A record or retained owner never installs a campaign or awards a picture/score. [Live pins](flight-pictures.md) and [first-earned receipts](picture-receipts.md) use its precommitted immutable originals; completion and receipt persist in one guarded profile write without an IDB write at victory. History pruning/GC and a single combined game-plus-media archive remain unimplemented.

## One database and explicit adoption

`createManagedMediaStore({richStillMedia:true})` opens version **3** of the existing `revealline-soundtrack-v1` database. Its six stores remain `metadata`, `audio`, `mediaRecords`, `mediaBlobs`, `managedState` and `reservations`. The new version gates the richer media-row format; no extra database, renamed audio store, row-copy migration or rewritten MP3 is needed.

Default behavior remains explicit:

- Ordinary `createSoundtrackStore()` uses the legacy v1 adapter.
- `createManagedMediaStore()` without the opt-in opens v2 and retains generic byte-library behavior.
- The integrated host creates **one v3 manager and supplies it to both** `createStillMediaStore({managedStore})` and `createSoundtrackStore({managedStore})`. Opening separate v1/v2 audio access after v3 adoption is incompatible.

The new source host opts in deliberately; historical/default library callers do not upgrade implicitly. After any database upgrades to v3, browsers reject old v1/v2 opens with `VersionError`; an already-open older manager yields on `versionchange` and cannot resume writes using its old version. Current managed-store errors direct the user to the newer game and recovery export. Older released readers retain their original browser/error wording. There is no automatic downgrade, database deletion or promise that an older release can still use the upgraded database. Exporting `.rlsound` through a compatible v3 audio adapter remains supported, with unchanged original bytes and format.

## Rich document and historical ownership

[`media-storage-record.mjs`](../game/media-storage-record.mjs) validates exactly:

```js
const document = {
  format: 'revealline-still-storage.v1',
  owners: [{ campaign, themeIds }],
  library, // revealline-media-library.v1
  legacy, // retained revealline-managed-bytes.v1 document
};
```

`owners` contains at most 104 unique base campaign identities, with at most 64 unique theme IDs each. It includes complete effective class recipes and normalized effective level defaults. Snapshotting asserts that materializing those defaults leaves `campaignKey` exactly equal to the installed base key. It changes no authored campaign or pack file. Omitting the saved roster is rejected: future defaults must not silently reinterpret old owners.

The real difficulty/campaign/level/class validators check these snapshots, including version families, map IDs, mechanics, rosters and derived Standard/Gentle identities. Matching syntactic keys alone is insufficient. The still library's exact map/revision/theme tuples must resolve from those owners. The retained context has no picture data, theme artwork, music, host state or installation side effects.

`validateStoredStillMedia(rawOrJSON)` owns and validates the whole document. `createStoredStillIdentityCatalog(document)` reconstructs the exact context for historical lookup without relying on currently installed packs. This closes the foundation's restart-hydration gap for this new storage document. Plain `validateMediaLibrary` still has its original in-memory `previous` contract; callers do not bypass it by relabeling arbitrary JSON as validated history.

On new preparation, the current execution catalog must authorize every new picture revision. Already retained history can remain when that catalog is empty. Owner campaigns cannot change or disappear; their theme-ID sets may only grow. Asset and presentation history stays append-only under the foundation's immutable rules. Assignments can change or be removed without deleting originals.

`legacy` preserves every prior v2 generic ID→hash exactly. Verified new generic references may be added through [still-originals bundle restore](media-bundle.md); removal, replacement and ID collisions remain forbidden. Generic originals may be audio, unknown source data or other binary media; they are never invented into image records. Once rich state exists, the manager refuses a generic-byte replacement, including through its low-level API. Existing unexplained physical files remain retained and counted for recovery under the manager's existing policy.

## Adapter API

[`createStillMediaStore`](../game/media-store.mjs) accepts `{managedStore, decodeImage}` or creates its own explicitly opted-in manager from `{indexedDB, estimate, now, decodeImage}`. A supplied manager must advertise the rich v3 mode.

```js
const manager = createManagedMediaStore({ richStillMedia: true });
const audio = createSoundtrackStore({ managedStore: manager });
const stills = createStillMediaStore({ managedStore: manager });
const current = await stills.read({ signal });
const prepared = await stills.prepare(candidateLibrary, completeAssetTable, {
  executionCatalog,
  previous: current.document,
  signal,
});
await stills.commit(prepared, {
  expectedGeneration: current.generation,
  signal,
});
```

- `readMetadata({signal})` returns this store's branded `{generation, document}` snapshot after exact owner/history validation, without allocating all originals. Metadata is not proof that each blob exists.
- `readAsset(snapshot, assetId, {signal, decodeImage?})` accepts only that store's metadata snapshot and authenticates one selected original: bounded bytes, SHA-256, actual header, full decode/dimensions and matching record. It fails explicitly for a missing original. The live/Collection drawable layer additionally stages an owned image/fit binding and releases cancelled decodes.
- `read({signal})` returns `{generation, document, assets}`. A generic v1/v2-era media row becomes an empty rich document **in memory** with its references under `legacy`; reading does not rewrite the database row. Rich history is reconstructed from retained owners. All required referenced originals must exist and verify before the read succeeds.
- `prepare(library, assets, options)` owns metadata and complete asset input before asynchronous decoding, validates new assignments against the supplied current catalog, retains previous owners/history/legacy references and prepares a branded complete update. The asset table has exactly `{sha256,blob}` rows, deduplicated by hash, with no extras or missing originals.
- `commit(prepared,{expectedGeneration,reservation?,signal?,otherManagedBytes?})` delegates to the existing manager and returns its new `{generation,library}` row. Here `library` is the rich storage document; use `read()` for the fully verified adapter snapshot. The optional deprecated `otherManagedBytes` can only refuse a commit; it cannot replace shared accounting.
- `readBlob(hash,{signal})` exposes the manager's original Blob lookup. That low-level lookup alone is not a decode or integrity certificate; use `readAsset()` for a selected authenticated original or `read()` for the complete verified inventory.
- `close()` closes an adapter-owned manager. When borrowing a shared manager, it closes only that adapter. It prevents late `read`/`prepare` publication, but does not cancel a commit already delegated to the shared manager. A host that needs cancellation must pass its operation's `AbortSignal`. Cancellation after an actual committed transaction remains successful; it cannot undo durable work.

All still-image originals pass `prepareStillAsset`: bounded signature/header checks, complete decoding, exact natural dimensions and SHA-256 over original bytes. Files sharing one hash decode once per verification pass. Node tests inject the decoder explicitly; a production non-browser host must supply a real decoder. The browser default retains its bounded timeout and object-URL cleanup. Retained generic bytes are hash-checked without pretending they are images. There is no source-image conversion or compressed-audio album decode.

## Atomicity and limits

Media and audio have independent generations but share one serialized six-store transaction scope, quota ledger, physical-hash inventory and reservation pool. Before the final write, the manager rechecks the actual current row's generation and all immutable rich history/owners/legacy references. A prepared object from another snapshot cannot overwrite changed history merely by guessing the current generation.

The existing bounds remain unchanged: **256 MiB committed plus staging**, **64 MiB per generic source**, **2 MiB total rich metadata including owner snapshots**, at most **512 unique referenced files per media-domain transfer**, four concurrent reservations and a 15-minute lease. Still originals retain the smaller 4 MiB image limit; selected posters retain 1920 × 1080. The rich library's existing asset/revision/assignment caps also apply. These are ceilings, with additional JSON structural/string limits; the owner snapshots consume real metadata capacity rather than receiving a separate uncounted allowance.

Each physical Blob store also retains its existing 512-row read bound. The final write transaction now checks that prospective count, including unexplained retained originals and cross-domain reuse, before inserting files. A 512-reference import alongside an unrelated retained original therefore refuses; 511 plus that original fits. It does not remove unexplained files to manufacture room or commit a state the next read would reject.

Existing files with matching verified hashes are reused without staging another physical copy. Media references protect shared originals when audio removes its own reference. Reported browser storage headroom can refuse a write, but remains advisory; a real quota/write failure aborts the whole IndexedDB transaction. Existing rows and blobs survive, and only this operation's reservation is released. Other operations and unknown originals remain intact. No cap is increased to accept a candidate.

The manager now associates open/upgrade callbacks with the specific attempt. A blocked request fails visibly and, if it becomes unblocked later, aborts its abandoned upgrade. Cancel/close before upgrade likewise prevents a later silent schema change. A failed attempt cannot clear a newer opening handle. An upgrade that has already committed cannot be retroactively downgraded by a later cancellation. Concurrent callers sharing an opening attempt may need to retry after that attempt is cancelled.

There is no data repair during schema upgrade. If stored metadata or image bytes are invalid, subsequent validated access fails and preserves raw data for recovery. Upgrading the database version alone does not certify the health of every historical row. Missing/corrupt referenced images reject a complete `read()` rather than silently dropping history. The metadata/selected-asset paths let a host validate owners and request only the needed original; they do not claim an incomplete bundle is a complete export. Existing `.rlmedia` restore and explicit missing-original guidance are available, but arbitrary corrupt-history repair or partial salvage export is not implemented.

## Verification scope and next work

The focused suite uses the existing finite IndexedDB model plus real schema, hash, image-preparation and `.rlsound` APIs. It covers v1/v2 upgrades, unchanged raw audio rows and export bytes, explicit shared v3 audio, old-version refusal, blocked/late-cancelled opening, restart after pack removal, full owner/roster identity rejection, missing/corrupt originals, stale writers, shared reservations, quota refusal, atomic rollback, delayed preparation and post-commit cancellation. Decoder and IndexedDB/browser lifecycle seams are modeled; this is not an actual browser disk/quota or multi-tab qualification claim.

The initial tests remain model evidence. The integrated exact 2aa source now passes six gates/2,707 tests, and actual source-browser native originals/paired game-data recovery plus shared-v3 MP3 transport pass at their [recorded scope](feature-delivery-workflow.md#current-still-integration-evidence). Blocked older tabs, real quota/interrupted writes and concurrent-tab stress still need their own browser evidence; frozen/cold-offline/public P5 gates remain open. Missing managed originals fail explicitly without silently selecting pack art. `.rlmedia` transfer, live pins and earned Collection are now implemented; pruning/GC and video/story playback remain later work.
