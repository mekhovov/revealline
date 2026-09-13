# Optional persistent story originals

This isolated P5 foundation extends the [reviewed story preparation/player](victory-story-playback.md) at `36a5efd8e535d02cf5af7a162d44362dae7406a8`. It supplies persistent, authenticated video originals and immutable story history for a later complete win → optional story → Collection journey. It is not adopted by the game, workshops, first-earned receipts, saved flights, build inventory or v0.34. No story is awarded or played by opening this store.

The subsequent isolated [`.rlstory` transfer slice](story-bundle.md) adds complete binary original export/import and one atomic `stageRestore` merge. The original storage-stage evidence below remains scoped to this foundation; host adoption and earned-story authority are still pending.

The subsequent [authored-binding model](authored-story-bindings.md) adds deliberate logical-v2 selection inside the same opt-in database v4. Old logical-v1 reads remain unchanged; no current host or earned receipt adopts that choice yet.

## Explicit storage version

`createManagedMediaStore({storyMedia:true})` explicitly opens version **4** of the existing `revealline-soundtrack-v1` database. It also provides the rich-still capability. Default manager callers still request v2; `richStillMedia:true` without the story opt-in still requests v3. The optional record validator is loaded lazily after a v4 request, so those existing paths do not fetch the new story modules.

The upgrade adds only `storyRecords`. Audio stays in `metadata`/`audio`, still metadata in `mediaRecords`, and videos share `mediaBlobs` with still/generic originals. `managedState` and `reservations` remain the common ledger. Upgrade creates missing stores without rewriting old records, generations or original bytes. There is no second database, uncounted video cache or automatic host migration.

**An old v3 client can receive `VersionError` after this explicit v4 upgrade.** All domains in a future adopted page—including practice/course music—must use its one current shared manager. Do not promise that frozen clients continue reading the shared origin database. Recover old `.rlmedia` and `.rlsound` originals through the current manager; do not delete or downgrade the database. Existing release-specific game/profile channels are a separate authority and are unchanged here.

The existing connection yields on `versionchange`; blocked/aborted opening must not finish a delayed upgrade after reporting failure. These constraints correspond to the platform's [version-change notification](https://developer.mozilla.org/en-US/docs/Web/API/IDBDatabase/versionchange_event). Publication still needs actual archived-client and native-origin checks.

## Separate immutable records

The one `storyRecords['library']` row is `{generation,library}`. Its strict library is:

```js
{
  format: 'revealline-story-storage.v1',
  stories: [/* validated revealline-victory-story.v1 descriptors */],
  originals: [/* unique available original-video SHA-256 strings */]
}
```

Each descriptor retains its exact ID/revision, authored picture pin, original hash/length/MIME/decoded dimensions/duration, one explicit start/end segment and static description. The existing descriptor remains an optional sidecar; `media-presentation.v1` still requires `story:null`. Existing 8 KiB flight pins, sessions, first-earned picture receipts and legacy backup formats are not extended or reinterpreted.

Story revisions are append-only immutable identities. A matching ID/revision with different source, segment, description or picture rejects. Different revisions are distinct; there is no implicit “latest” lookup or assignment-based replacement. The same source hash cannot carry conflicting inspected facts.

Validation rebuilds the owner catalog from the stored still document after restart. Binding uses the exact historical authored identity, presentation ID/revision and poster asset ID/hash. This identity is **not an execution/award identity** and does not independently distinguish Standard from Gentle. Future host/receipt adoption must establish that separate execution-to-authored ownership. Removed installed packs need no invented current theme or reinstallation just to resolve the retained poster.

`originals` records explicit video availability. Removing a source detaches it from every story that uses that hash but keeps every descriptor. A missing or detached original cannot silently become a new video. Re-adding the exact original restores availability without changing identity. Physical bytes are deleted only when that explicit detachment relinquishes the hash and neither audio nor still/generic metadata retains it. Unexplained old originals remain counted and preserved. This is not automatic garbage collection.

## API and ownership

`game/story-media-store.mjs` exports `createStoryMediaStore({managedStore?,decodeImage?,...managerOptions})`. A supplied manager must have the explicit v4 capability; otherwise the adapter owns a new explicit v4 manager. Await `close()` when disposing an owned adapter.

| Operation                                                  | Contract                                                                                                                                                                                                                                                     |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `readMetadata({signal})`                                   | Validates/rebrands persisted history against retained still owners; returns `{generation,document}` without claiming playable codec support.                                                                                                                 |
| `stage({descriptor,blob},{signal,...inspection})`          | Owns caller JSON/native Blob before awaiting. Reserves shared capacity, verifies the actual historical poster, then authenticates every available video through `prepareVictoryStory`. Returns an immutable store-specific review; publishes no domain data. |
| `commit(review,{signal})`                                  | Explicitly consumes that prepared review and its reservation. Rechecks generation, retained identities, all domains and physical budgets in the final serialized transaction.                                                                                |
| `cancel(review)`                                           | Discards the review, cancels pending native inspection and attempts to release its lease and returned allocations; cleanup is best effort when storage is unavailable.                                                                                       |
| `acquire({id,revision,picturePin},{signal,...inspection})` | Reads that exact revision, verifies the actual poster and selected native video, and returns the existing branded `prepareVictoryStory` result for the player. It never chooses today's assignment.                                                          |
| `removeOriginal(sha256,{expectedGeneration,signal})`       | Explicit atomic availability detachment, preserving descriptor and all other-domain references. No decoder is required to remove an unavailable/corrupt original.                                                                                            |
| `exportInventory({signal})`                                | Returns `revealline-story-inventory.v1`, generation, document and sorted native `{sha256,blob}` video assets. Checks every available original's hash/length; does not require codec playback for recovery.                                                   |
| `close()`                                                  | Cancels operations and attempts to release their reservations. Closes only a manager created by this adapter; an injected shared manager remains usable.                                                                                                     |

If storage is unavailable during cancellation or close, a retained reservation expires at its existing 15-minute lease deadline; a later successful store operation can remove its row. No background deletion or guaranteed immediate release is promised.

`inspection` uses the existing trusted native decoder factories/timeout interface; these are host capabilities, not fields read from JSON. A shape-compatible fake preparation is rejected. Actual Blob ownership, source headers, SHA-256 and native metadata must agree. Unsupported containers/codecs, mismatched duration/dimensions and invalid/out-of-range segments remain explicit errors. Inspection never calls audible playback. Merely validating stored JSON does not establish a playable codec; every `acquire` prepares the original again.

The export inventory is an **in-memory typed inventory, not a new downloadable bundle format**. It excludes poster originals, progress, packs and audio. `.rlmedia` still exports its existing still/generic domain; `.rlsound` still exports audio; JSON game data still exports pins/receipts. These strict formats are unchanged. A future versioned story-transfer file must add framing, complete inventory checks, original ownership, native Prepare → Download and explicit restore review without pretending that JSON serializes Blobs. Restoring videos also needs the exact historical still document/originals, normally recovered separately through `.rlmedia`.

## Unchanged limits and atomicity

The shared committed-plus-staging limit remains **256 MiB**, each original **64 MiB**, each physical audio/mediaBlob store **512 rows**, and at most **four** live reservations with **15-minute** leases. All surviving physical rows—including unexplained originals—count. Video descriptors retain the existing **120-second, 1920×1080** limits; each descriptor is at most **8 KiB**. Story history has at most **512 descriptors**, further constrained by metadata size. The still and story documents together use the existing **2 MiB** media-metadata allowance; the empty v4 story history adds no separate document allowance. Ledger/row overhead remains included in total used bytes.

Staging conservatively reserves the supplied video's byte length plus proposed row metadata before inspection, even when the same hash might later be reused. It never relaxes the shared budget to make a large catalog fit. The final transaction deduplicates verified physical originals, rechecks generation and all reference sets, and accounts for actual new bytes. Story changes cannot evict audio, stills or another operation's reservation. Original validation precedes the final synchronous write transaction; a transaction abort rolls back staged bytes and metadata together. The platform defines abort as rolling back its transaction's changes ([MDN](https://developer.mozilla.org/en-US/docs/Web/API/IDBTransaction/abort)). Cancellation after a completed commit reports success; it cannot retroactively turn committed data into a refusal.

Removal can proceed when the selected video bytes are missing or corrupt, because it needs the valid identity history rather than a decoder. Export refuses missing/corrupt **available** originals instead of silently omitting them. Native acquisition still rejects codec/decode errors even when an export hash is correct; media loading can fail through the browser's [error event](https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/error_event).

## Required next vertical slice

1. Define an explicit new attempt/first-earned story authority that freezes an optional exact descriptor revision/original/segment alongside the existing poster. Old v1 still-only records remain still-only; adding a story later must not retrofit it onto an old earned receipt.
2. Adopt the current shared manager consistently across ordinary, practice/course audio and authoring pages through an explicit new edition. Practice remains non-awarding and has no implicit managed-picture selection. Verify older saved runs through the new host and actual old clients after the origin upgrade.
3. Add one native authoring selection and versioned original-transfer flow. Restore old `.rlmedia`/`.rlsound` exactly, restore the selected video, and prove a fresh-origin paired recovery. Keep original files distinct from future optimized runtime derivatives; do not raise caps to accommodate the planned catalog.
4. Execute one real win: retain exact poster A, record its win/optional story once, offer optional Play/Skip, play the selected segment, return to the same A, and replay from Collection without duplicate awards. Preserve saved A after assignment B, missing-original recovery, reduced-motion static default, focus pause/explicit return, autoplay refusal, cinematic gain and music lease cleanup.
5. Only then opt into build/offline inventories and qualify frozen/public/native behavior. Native codecs, disk downloads, cold recovery, physical devices and human comfort remain separate acceptance evidence.

## Verification scope

Focused tests use the existing in-memory IndexedDB transaction model and the real owned 75,767-byte MP4/header/hash. Native metadata/decode events and image dimensions are explicitly injected. They exercise persistent rows, restart, immutable A/B history, exact legacy binary exports, CAS/reservations, rollback and removal rather than only rendering a video-shaped element. The delayed-return reservation regression uses an injected, borrowed manager; it does not qualify every owned-manager shutdown race. This does not establish actual browser IndexedDB durability, video codec coverage, a disk story backup, cold offline playback, earned-host adoption or any public release.

The exact final test counts and source hashes belong in the isolated `.cache/story-media-storage/` receipt after review. Initial and corrected test runs remain separate; the first combined-metadata fixture was below the limit and was enlarged rather than changing the limit. No release/full-suite run is requested for this foundation.
