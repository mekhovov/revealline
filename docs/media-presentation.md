# Still-image presentation identity

This guide defines the strict still-image models used by the integrated P5 source host, renderer, saved flights, Collection and edition-matched still workshop. Static assignments change pictures without changing gameplay identity. The source and bounded browser gates now pass; frozen/public P5 acceptance remains open. No source-art folder is automatically imported. See [current evidence](feature-delivery-workflow.md#current-still-integration-evidence).

Campaign, core, replay and score authority remain unchanged. The host explicitly adds `xonix-session.v3` picture pins and optional `xonix-library.v3` first-earned receipts; old session/library branches retain their original behavior. Do not attach media fields to authored levels: normalized levels participate in `campaignKey`. Picture revisions belong in the separate document below.

## Exact ownership and lookup

[`createMediaIdentityCatalog`](../game/media-library.mjs) accepts the output of [`createExecutionCatalog`](../game/campaign-contexts.mjs). It snapshots bounded own data and independently checks each execution campaign against `createDifficultyContext(baseCampaign, difficulty)`, including the actual execution key, base key and policy version. Themes come from that installed wrapper. Challenges are rejected. Missing themes produce no bindings; arbitrary names and ID prefixes never imply ownership.

A presentation's identity contains exactly:

```js
const identity = {
  baseCampaignKey, // verified authored campaign key, never a guessed pack ID
  levelId,
  levelRevision, // authored STRING revision
  themeId, // exact installed theme ID
};
```

`identityCatalog.resolve({executionKey, levelId, levelRevision, themeId})` receives the actual execution map revision, including Gentle's derived revision. It returns the verified authored tuple or `null`. Thus Standard and Gentle can share a picture while their score/replay partitions stay distinct. Supplying the authored revision with a Gentle execution key is rejected as an unknown context. `identityCatalog.has(identity)` checks a full authored tuple.

Each map/theme pair needs an explicit assignment. No wildcard, theme fallback, campaign-name match or cross-pack image lookup is provided. Rebuilding the identity catalog after installed content changes is an explicit caller responsibility; existing resolvers hold their original snapshot.

## Data contracts

`validateStillAsset(record)` accepts an exact owned record:

```js
const asset = {
  format: 'revealline-still-asset.v1',
  id: 'orchard-fpv-original-1',
  sha256,
  bytes,
  mime,
  width,
  height,
  provenance: {
    kind: 'original', // original | licensed | user-supplied
    credit: 'Creator or attribution',
    source: 'Traceable source/prompt record',
  },
};
```

Metadata is a declaration, not evidence that bytes exist, that an image decodes, or that usage rights have been reviewed. Strings are data only; the modules fetch no source URLs. Keep actual originals, effective prompts and provenance records separately. IDs and SHA-256 refer to the unchanged file bytes. Two asset IDs may reference the same hash, but their byte length, MIME and dimensions must agree.

A presentation contains exactly:

```js
const presentation = {
  format: 'revealline-media-presentation.v1',
  id: 'orchard-fpv-picture',
  revision: 1, // positive INTEGER, at most 1,000,000
  identity,
  poster: { assetId: 'orchard-fpv-original-1', fit: 'contain', sampling: 'nearest' },
  story: null,
  description: 'Description of the earned still',
};
```

Only static PNG/JPEG and `contain`/`nearest` are supported in this first contract. GIF, WebP, animation, alternate sampling, video, remote media, playback instructions and inline image bytes are rejected. `story:null` is required. The future story contract must keep the chosen still timestamp independent of the finite story segment: an ending/key frame can be the revealed picture, followed by the whole story from its beginning and a return to that earned still. This version does not implement that workflow.

The library has exactly `{format:'revealline-media-library.v1', assets, presentations, assignments}`. Each assignment is `{identity, presentationId, revision}` and must point to a known revision with precisely the same identity. Duplicate asset IDs, presentation ID/revisions or assignment identities reject the whole candidate. All accepted data is deeply frozen and owned.

`validateMediaLibrary(candidate, {identityCatalog, previous})` checks the entire candidate before returning it. On each subsequent adoption, supply the previously accepted library. Every prior asset and presentation revision must remain byte-for-byte equivalent as canonical JSON; a new revision must increase and cannot move an existing presentation ID to another map/theme. Only assignments may be changed or removed. This prevents delete-and-reuse within the retained history. It does not create a persistent anti-rollback ledger: callers must retain and supply the actual prior library, including across reload/import workflows. History pruning/compaction is not implemented.

New presentation records require installed exact contexts. Previously validated, unchanged records can remain archived when their pack disappears. Their presence does not permit rendering them under a different context or authoring a new revision without reinstalling that exact context.

At the pure model boundary, retention requires a branded `previous` library or an exact trusted owner catalog; arbitrary stored JSON cannot mint either. The integrated [v3 storage document](media-storage.md) persists validated historical owners and verifies referenced bytes so history can hydrate after restart without an installed pack. The [identity adapter](../game/ui/picture-identity.mjs) combines exact installed and retained owners, comparing effective normalized levels and rosters rather than names or raw omitted defaults. Retained owners validate pictures; they do not install gameplay content.

The live host pins one all-theme selection per attempt and writes [first-earned receipts](picture-receipts.md) alongside completion in one guarded player-profile write. Originals are immutable, append-only and committed before flight preparation. No cross-store receipt transaction, pending receipt lease or garbage collector is implemented. [Collection](earned-picture-view.md) can display an earned managed original with a removed pack, while replay waits for exact gameplay content.

## Image preparation

[`prepareStillAsset(blob, {id, provenance}, {decodeImage, signal})`](../game/media-still.mjs) returns `{asset, blob}` after:

1. Owning and validating metadata before asynchronous work, checking the native Blob/File brand and byte size without invoking caller getters.
2. Reading an immutable Blob slice; determining PNG/JPEG from its signature, independent of filename or declared MIME; applying the existing bounded static image-header validator before any image allocation.
3. Requiring successful complete decoding and natural dimensions equal to the header, then hashing the original bytes with SHA-256.
4. Rechecking cancellation after asynchronous boundaries, returning an immutable metadata record and byte-exact Blob with the detected MIME. No resizing, recompression or storage write occurs.

The default browser decoder owns one temporary object URL and releases it on success, failure, cancellation or its 15-second timeout. Node has no automatic header-only fallback. A non-browser host must explicitly inject `decodeImage(blob,{signal})` that resolves `{naturalWidth,naturalHeight}` from a real decoder. This is trusted host code; a stub returning dimensions proves only the modeled test boundary. An injected decoder owns its resource/timeout policy. Cancellation prevents late publication even if an injected decoder finishes after cancellation.

The header guard is deliberately not a full pixel decoder. For example, JPEG dimensions alone cannot establish complete scan data. Browser decode failure or a header/natural-dimension mismatch rejects the operation and leaves the caller's previously accepted state untouched. Storage preparation and acquisition are separate reviewed layers: the [rich store](media-storage.md) authenticates originals for commit, and [presentation-image](../game/ui/presentation-image.mjs) verifies persisted bytes and complete drawable dimensions before host adoption.

## Resolution and fallback

[`createPresentationResolver(library, identityCatalog)`](../game/media-presentation.mjs) accepts only validated in-process catalogs. `resolve(request)` returns one of:

- `{kind:'still', identity, presentation, asset}` for an exact assigned context. The metadata does not assert that the underlying file is available or browser-ready.
- `{kind:'legacy', reason:'unassigned'}` for known context without a binding.
- `{kind:'legacy', reason:'unavailable-context'}` when the exact execution/map/theme is absent.

Malformed requests reject instead of invoking getters or coercion. A deliberate legacy choice keeps exact pack/level/theme artwork. Fresh attempts stage their selected managed image before the first tick; missing bytes or failed decode preserve the working run/backdrop and leave flight paused. Only a fresh attempt offers an explicit authored-art fallback. Saved managed pins and earned receipts never substitute today's assignment or generated art when originals are missing. Theme and image/fit adopt together; later assignment changes affect fresh attempts. Viewing, resolving or restoring media never awards another completion, score or achievement. See [live pictures](flight-pictures.md) and [first-earned display](earned-picture-view.md).

## Bounds and integration

| Bound                  | This foundation                                                                                            |
| ---------------------- | ---------------------------------------------------------------------------------------------------------- |
| Metadata               | At most 2 MiB, with additional bounded nodes/strings/depth                                                 |
| Records                | 512 assets, 256 retained presentation revisions, 512 assignments                                           |
| Original still         | Existing 4 MiB per file, 8192 per side, 16 million pixels                                                  |
| Selected poster        | At most 1920 × 1080; originals outside that size may be stored as metadata but cannot be assigned directly |
| Binary storage/network | Separate rich-v3 store and explicit `.rlmedia` transfer                                                    |

These are model bounds, not a new storage quota. The source host explicitly shares one rich-v3 manager between audio and stills, with the existing 256 MiB committed-plus-staging ceiling, 64 MiB generic source limit and 2 MiB metadata bound. Legacy soundtrack callers still default to their old adapter; frozen editions are unchanged and older readers may refuse an origin upgraded to v3. `.rlmedia` stores originals/history, game-data JSON stores pins/receipts, and `.rlsound` stores audio. Existing gameplay JSON, pack, installed-content and core-offline caps remain unchanged. See [paired recovery](full-backup.md#paired-originals-and-exact-picture-ownership).

The authoring CLI's older `mediaVersion:1.0.0` document is a separate source-art contract. There is no implicit conversion or automatic runtime discovery of `authoring/library/fpv-pressure-art`. Use an explicit compiler/import boundary with exact hashes, bounds and reviewed ownership.

## Verification and next gate

Initial foundation tests use injected fixtures, real legacy/Classic cores, Standard/Gentle and both turn policies. They compare real winning replays/checkpoints, identities, original hashes and legacy profile bytes while resolving still revisions, plus hostile data, bounds, decoder failure and cancellation. Those original results are model evidence; they did not themselves certify host/browser adoption.

The integrated exact-source 2aa suite now passes all six gates/2,707 tests. The separate source-browser receipt verifies real native original transfer, saved/earned A after assignment B, JSON Undo and shared-v3 audio; its [scope and pins](feature-delivery-workflow.md#current-still-integration-evidence) remain explicit. Frozen/offline/public P5 and device checks still precede delivery. The [next video/story proposal](media-library-design.md#next-video-and-story-slice--proposed) requires a new schema; this version still requires `story:null`. [Reusable prompts](../authoring/prompts/media-presentation.md) add no CLI registry IDs.
