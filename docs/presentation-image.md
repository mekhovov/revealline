# Runtime picture acquisition and drawing seam

This is an opt-in API slice. The ordinary game and Collection do not import it
yet. It adds no profile/session/replay field, database version, assignment,
installation, receipt, award or storage write. [Saved choices](presentation-pins.md)
and the separately implemented receipt model retain identity; this slice obtains
one verified drawable for an already validated choice.

## Read only the selected original

Use the same explicit v3 manager for the audio and still adapters. The new
`store.readMetadata({ signal })` returns a frozen, store-branded
`{ generation, document }`. It validates the complete bounded still metadata and
historical owners using the existing hydration rules, but issues only one
`mediaRecords.get('library')`: no Blob scan, decode, quota reservation or write.
Metadata success does **not** prove every stored original is present or intact.
The existing admin `store.read()` still scans and verifies every referenced
original and refuses missing or corrupt inventory.

`store.readAsset(snapshot, assetId, { signal, decodeImage? })` requires that
store's original metadata snapshot and its exact registered asset ID. Copied or
foreign snapshots reject. It reads only that SHA through keyed gets in `audio`
and `mediaBlobs`; a duplicate physical hash rejects even if its bytes agree,
matching the full inventory contract. It checks native Blob size, SHA-256,
static PNG/JPEG header facts and complete decoded dimensions against the saved
record. Hash/header mismatches fail before the drawable decoder is allocated.
It returns the owned `{ asset, blob }` after validation, without replacing bytes.

An older snapshot remains usable after an assignment edit because the existing
write contract retains immutable asset/history rows. It does not silently adopt
a later assignment or claim the old generation is still the current one. A
missing original produces a recovery error asking for its `.rlmedia` originals.
Unrelated missing originals do not block a selected valid image; administrative
export and writes retain their full verification boundary.

The manager's additive `readDomainMetadata(domain, { signal })` and
`readSelectedBlob(hash, { signal, maxBytes })` provide these bounded keyed reads.
`readSelectedBlob` checks placement/native type/size, **not** the content digest;
the still adapter checks the digest before use. Old `readDomain`, `readBlob`,
usage/reservations and all serialized write/quota checks retain the full path.
Both physical 512-row limits and the shared 256 MiB committed/staging budget are
unchanged. Reads are not a new ledger-repair or garbage-collection operation.

Closing a still adapter prevents publication after an awaited read/decode; a
borrowed manager remains open for its other adapters. Pass an operation signal
to cancel work immediately. The existing v3 opening/blocked/version-change
behavior is reused. Old readers still receive a truthful VersionError instead
of a downgrade or data deletion. Host adoption must explain that users can open
the compatible newer media tools and export their originals/audio; merely
retrying an immutable old reader cannot make it support v3.

## Own the decoded image as one binding

`acquirePresentationImage({ pin, metadata, store }, options)` takes one strict
saved picture choice and the metadata snapshot. The host must first validate
execution-to-authored ownership through the saved-flight or retained receipt
catalog, including Gentle and removed-pack identities. This helper does not
infer execution ownership from a matching map, theme, hash or key prefix.

It checks the exact presentation ID/revision, complete authored identity,
poster asset and hash against that snapshot. It never resolves today's
assignment. A `legacy` choice returns `null`, selecting the host's existing
authored background path for that exact map/world. A missing still revision or
original is an explicit error; it never silently substitutes newer art. The host
must show the recovery state and make any authored-fallback choice explicit.

For a managed choice, acquisition returns one frozen binding:

```js
{ image, fit: 'contain', sampling: 'nearest', pin, release }
```

`image` is fully decoded before publication. Image and fit travel together.
`release()` is idempotent and releases the drawable/source URL. A caller must
keep the binding alive while any consumer uses it, and release it afterward.
There is no global cache or reference-count system; use separate acquisitions
for independently lived consumers, or retain a shared lease until all finish.
The current still format continues to require contain/nearest.

Default browser acquisition creates one temporary Blob URL after verified
bytes/header checks, waits for load plus complete `Image.decode()`, and retains
the URL until release. Failure, abort, supersession and timeout release it.
Allocation-time abort is rechecked before assigning `src`. A decoder that
returns after cancellation has its late image disposed. The default timeout is
15 seconds; `decodeImage(sourceURL, { signal })` is a trusted host/test seam
returning an **owned drawable**, unlike preparation decoders that return only
dimensions. `URLImpl` and `ImageClass` are optional host/test adapters.

## Stage a swap for the exact consumer context

`createPresentationImageSlot()` owns a single consumer's active binding. It has
`setContext`, `load`, `current`, `clear` and `dispose`. The explicit context is:

```js
const context = { runId, executionKey, levelId, levelRevision, themeId };
slot.setContext(context);
await slot.load({ pin, metadata, store }, { context, signal });
const backdrop = slot.current();
```

Call `setContext` synchronously before drawing a different attempt, execution,
map revision or world. A changed context immediately cancels pending work and
releases the previous binding, exposing that context's authored fallback rather
than another map's picture. An equal context retains it. The requested context
is checked again on `load`, so delayed metadata preparation for an old attempt
cannot start acquisition into a newer same-map attempt.

Within the same context, a new load cancels the previous candidate but keeps the
current image until a successful decode atomically replaces the binding. A
failed or externally aborted replacement keeps the prior image. Superseded or
disposed requests return `false`; current failures reject, and successful swaps
return `true`. Each request has its own generation and cancellation controller.
No await separates publication from releasing the previous binding. A legacy
choice intentionally publishes `null`; `clear`/`dispose` release all owned work.
Cosmetic body changes need not change the context and do not reload this image.

The renderer accepts `draw(..., { backdrop })` as an optional predecoded image
and fit override. It owns no lease or identity and never calls `setLook` for this
binding. Absent/null backdrop preserves the old background path. Existing
`drawGallery` can receive the same `image` and `fit` explicitly. Future visible
Collection canvases must stage their drawing before resizing/copying the visible
canvas; the existing Collection host has not yet been changed by this slice.

## Verification boundary and remaining integration

Focused tests use the actual managed adapter, owner validation, pin resolver and
image acquisition with a finite modeled IndexedDB and explicit PNG fixture.
They cover keyed-read counts, no writes/full scans, full-admin refusal,
immutable snapshots, duplicated physical placement, missing/corrupt originals,
header/dimension mismatch, complete decode, prompt abort and late cleanup,
same-context swap failure, supersession and changed attempt/world/execution.
Renderer checks record real painter operations with modeled Canvas/Image; they
do not certify browser raster or GPU behavior.

No test here proves a browser disk upgrade, physical-device performance, profile
receipt persistence, live app wiring, Collection retention or a complete game
backup. Next adoption must wire exact pins before the first tick, retain the
first-earned receipt separately from better scores, resolve receipts through
their retained owners, and pair `.rlmedia` originals with game-data transfer.
It must test missing-media recovery, save/load and first-earned art after later
assignment changes, old-session/gallery fallback, native download/restore,
Undo, actual browser rendering and offline continuation. Existing standalone
full admin reads and `.rlsound` recovery remain available throughout.
