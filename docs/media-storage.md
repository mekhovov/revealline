# Opt-in still-media storage

The bounded P5 storage slice adds a rich still-image document to the existing managed database. It preserves original audio and the `.rlsound` API, and retains enough exact owner context to hydrate picture history after a pack is removed and the page restarts. No game host, renderer, gallery, build, production-art import or release opts into it yet.

This implements stored media history, not an earned Collection receipt. A record or historical owner never installs a campaign, grants a picture, awards a score or supplies proof of completion. Live-run asset pins, durable earned receipts, history pruning, garbage collection and combined media-backup publication remain subsequent work.

## One database and explicit adoption

`createManagedMediaStore({richStillMedia:true})` opens version **3** of the existing `revealline-soundtrack-v1` database. Its six stores remain `metadata`, `audio`, `mediaRecords`, `mediaBlobs`, `managedState` and `reservations`. The new version gates the richer media-row format; no extra database, renamed audio store, row-copy migration or rewritten MP3 is needed.

Default behavior remains explicit:

- Ordinary `createSoundtrackStore()` uses the legacy v1 adapter.
- `createManagedMediaStore()` without the opt-in opens v2 and retains generic byte-library behavior.
- A future host adopting rich media must create **one v3 manager and supply it to both** `createStillMediaStore({managedStore})` and `createSoundtrackStore({managedStore})`. Opening separate v1/v2 audio access after v3 adoption is incompatible.

The default host has no new adoption call. After any database upgrades to v3, browsers reject old v1/v2 opens with `VersionError`; an already-open older manager yields on `versionchange` and cannot resume writes using its old version. Current managed-store errors direct the user to the newer game and recovery export. Older released readers retain their original browser/error wording. There is no automatic downgrade, database deletion or promise that an older release can still use the upgraded database. Exporting `.rlsound` through a compatible v3 audio adapter remains supported, with unchanged original bytes and format.

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

`legacy` preserves the entire prior v2 generic byte-reference document exactly. Generic originals may be audio, unknown source data or other binary media; they are never invented into image records. Once rich state exists, the manager refuses a generic-byte replacement, including through its low-level API. Existing unexplained physical files remain retained and counted for recovery under the manager's existing policy.

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

- `read({signal})` returns `{generation, document, assets}`. A generic v1/v2-era media row becomes an empty rich document **in memory** with its references under `legacy`; reading does not rewrite the database row. Rich history is reconstructed from retained owners. All required referenced originals must exist and verify before the read succeeds.
- `prepare(library, assets, options)` owns metadata and complete asset input before asynchronous decoding, validates new assignments against the supplied current catalog, retains previous owners/history/legacy references and prepares a branded complete update. The asset table has exactly `{sha256,blob}` rows, deduplicated by hash, with no extras or missing originals.
- `commit(prepared,{expectedGeneration,reservation?,signal?,otherManagedBytes?})` delegates to the existing manager and returns its new `{generation,library}` row. Here `library` is the rich storage document; use `read()` for the fully verified adapter snapshot. The optional deprecated `otherManagedBytes` can only refuse a commit; it cannot replace shared accounting.
- `readBlob(hash,{signal})` exposes the manager's original Blob lookup. That low-level lookup alone is not a decode or integrity certificate; normal verified history uses `read()`.
- `close()` closes an adapter-owned manager. When borrowing a shared manager, it closes only that adapter. It prevents late `read`/`prepare` publication, but does not cancel a commit already delegated to the shared manager. A host that needs cancellation must pass its operation's `AbortSignal`. Cancellation after an actual committed transaction remains successful; it cannot undo durable work.

All still-image originals pass `prepareStillAsset`: bounded signature/header checks, complete decoding, exact natural dimensions and SHA-256 over original bytes. Files sharing one hash decode once per verification pass. Node tests inject the decoder explicitly; a production non-browser host must supply a real decoder. The browser default retains its bounded timeout and object-URL cleanup. Retained generic bytes are hash-checked without pretending they are images. There is no source-image conversion or compressed-audio album decode.

## Atomicity and limits

Media and audio have independent generations but share one serialized six-store transaction scope, quota ledger, physical-hash inventory and reservation pool. Before the final write, the manager rechecks the actual current row's generation and all immutable rich history/owners/legacy references. A prepared object from another snapshot cannot overwrite changed history merely by guessing the current generation.

The existing bounds remain unchanged: **256 MiB committed plus staging**, **64 MiB per generic source**, **2 MiB total rich metadata including owner snapshots**, at most **512 unique referenced files per media-domain transfer**, four concurrent reservations and a 15-minute lease. Still originals retain the smaller 4 MiB image limit; selected posters retain 1920 × 1080. The rich library's existing asset/revision/assignment caps also apply. These are ceilings, with additional JSON structural/string limits; the owner snapshots consume real metadata capacity rather than receiving a separate uncounted allowance.

Existing files with matching verified hashes are reused without staging another physical copy. Media references protect shared originals when audio removes its own reference. Reported browser storage headroom can refuse a write, but remains advisory; a real quota/write failure aborts the whole IndexedDB transaction. Existing rows and blobs survive, and only this operation's reservation is released. Other operations and unknown originals remain intact. No cap is increased to accept a candidate.

The manager now associates open/upgrade callbacks with the specific attempt. A blocked request fails visibly and, if it becomes unblocked later, aborts its abandoned upgrade. Cancel/close before upgrade likewise prevents a later silent schema change. A failed attempt cannot clear a newer opening handle. An upgrade that has already committed cannot be retroactively downgraded by a later cancellation. Concurrent callers sharing an opening attempt may need to retry after that attempt is cancelled.

There is no data repair during schema upgrade. If stored metadata or image bytes are invalid, subsequent validated access fails and preserves raw data for recovery. Upgrading the database version alone does not certify the health of every historical row. Missing/corrupt referenced images reject a rich read rather than silently dropping their history. This conservative complete-read boundary may require a future recovery/export UI; it does not yet implement one.

## Verification scope and next work

The focused suite uses the existing finite IndexedDB model plus real schema, hash, image-preparation and `.rlsound` APIs. It covers v1/v2 upgrades, unchanged raw audio rows and export bytes, explicit shared v3 audio, old-version refusal, blocked/late-cancelled opening, restart after pack removal, full owner/roster identity rejection, missing/corrupt originals, stale writers, shared reservations, quota refusal, atomic rollback, delayed preparation and post-commit cancellation. Decoder and IndexedDB/browser lifecycle seams are modeled; this is not an actual browser disk/quota or multi-tab qualification claim.

Before host adoption, qualify a real browser upgrade with existing MP3s, blocked old tabs, native export/reimport and interrupted writes. Then add deliberate whole-host manager selection, recovery UI and actual gallery rendering with safe old-art fallback. Durable earned receipts, live-run pins, undoable complete media bundles, pruning/garbage collection, optional binary download readiness and final-frame/story playback remain separate milestones. The [still identity contract](media-presentation.md) and broader [media design](media-library-design.md) retain their limits.
