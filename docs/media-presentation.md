# Still-image presentation identity

This is the bounded P5 foundation for changing a map's picture without changing its gameplay identity. Three independent modules validate static media, resolve exact assignments and prepare original image bytes. They are not adopted by the game, renderer, gallery, pack importer, build or storage manager yet. No production pictures are automatically installed. Generated originals remain authoring source.

The existing campaign, core, replay, session, score and player-library formats remain unchanged. In particular, do not attach media fields to an authored level: the normalized level participates in `campaignKey`. Even changing a level's theme ID or revision would change that identity. Presentation revisions belong in the separate document described here.

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

`validateMediaLibrary(candidate, {identityCatalog, previous})` checks the entire candidate before returning it. On each subsequent adoption, supply the previously accepted library. Every prior asset and presentation revision must remain byte-for-byte equivalent as canonical JSON; a new revision must increase and cannot move an existing presentation ID to another map/theme. Only assignments may be changed or removed. This prevents delete-and-reuse within the retained history. It does not create a persistent anti-rollback ledger: callers must retain and supply the actual prior library, including across future reload/import workflows. History pruning/compaction is not implemented.

New presentation records require installed exact contexts. Previously validated, unchanged records can remain archived when their pack disappears. Their presence does not permit rendering them under a different context or authoring a new revision without reinstalling that exact context.

That retention currently requires the branded **in-memory** `previous` library. After a restart, validating stored/exported JSON with `previous:null` fails if its owning pack is uninstalled; supplying unvalidated JSON as `previous` is also rejected. Future storage adoption must supply a validated historical owner catalog or implement an explicit unavailable-history hydration contract before it can preserve Collection across pack removal and restart. There is no persistent receipt retention or history pruning/garbage collection in this foundation.

## Image preparation

[`prepareStillAsset(blob, {id, provenance}, {decodeImage, signal})`](../game/media-still.mjs) returns `{asset, blob}` after:

1. Owning and validating metadata before asynchronous work, checking the native Blob/File brand and byte size without invoking caller getters.
2. Reading an immutable Blob slice; determining PNG/JPEG from its signature, independent of filename or declared MIME; applying the existing bounded static image-header validator before any image allocation.
3. Requiring successful complete decoding and natural dimensions equal to the header, then hashing the original bytes with SHA-256.
4. Rechecking cancellation after asynchronous boundaries, returning an immutable metadata record and byte-exact Blob with the detected MIME. No resizing, recompression or storage write occurs.

The default browser decoder owns one temporary object URL and releases it on success, failure, cancellation or its 15-second timeout. Node has no automatic header-only fallback. A non-browser host must explicitly inject `decodeImage(blob,{signal})` that resolves `{naturalWidth,naturalHeight}` from a real decoder. This is trusted host code; a stub returning dimensions proves only the modeled test boundary. An injected decoder owns its resource/timeout policy. Cancellation prevents late publication even if an injected decoder finishes after cancellation.

The header guard is deliberately not a full pixel decoder. For example, JPEG dimensions alone cannot establish complete scan data. Browser decode failure or a header/natural-dimension mismatch rejects the operation and leaves the caller's previously accepted state untouched. This foundation does not publish a prepared-state capability to a storage manager or validate an already persisted blob against a manifest; those integrations remain separate.

## Resolution and fallback

[`createPresentationResolver(library, identityCatalog)`](../game/media-presentation.mjs) accepts only validated in-process catalogs. `resolve(request)` returns one of:

- `{kind:'still', identity, presentation, asset}` for an exact assigned context. The metadata does not assert that the underlying file is available or browser-ready.
- `{kind:'legacy', reason:'unassigned'}` for known context without a binding.
- `{kind:'legacy', reason:'unavailable-context'}` when the exact execution/map/theme is absent.

Malformed requests reject instead of invoking getters or coercion. A legacy result means the future host retains its existing pack/level/theme artwork exactly. The host must likewise retain old art when bytes are missing, hashing fails or decoding fails; never create a blank replacement or grant another award. No host adapter implements this promise yet. A future live host must also snapshot the selection at a safe presentation boundary and keep earned-presentation receipts separate from existing strict gallery/profile records. Changing a picture must not record another completion, score, achievement or mastery.

## Bounds and deferred integration

| Bound                  | This foundation                                                                                            |
| ---------------------- | ---------------------------------------------------------------------------------------------------------- |
| Metadata               | At most 2 MiB, with additional bounded nodes/strings/depth                                                 |
| Records                | 512 assets, 256 retained presentation revisions, 512 assignments                                           |
| Original still         | Existing 4 MiB per file, 8192 per side, 16 million pixels                                                  |
| Selected poster        | At most 1920 × 1080; originals outside that size may be stored as metadata but cannot be assigned directly |
| Binary storage/network | None implemented here                                                                                      |

These are import/model bounds, not a new storage quota. The current opt-in managed store has a shared 256 MiB committed-plus-staging ceiling and generic byte records; its `sourceBytes` bound is 64 MiB and metadata bound is 2 MiB. Ordinary soundtrack storage still defaults to its legacy adapter. Rich media metadata, receipts, references protecting earned assets, schema migration, actual optional-binary bundles, backup/restore, cache readiness and browser adoption require their own reviewed milestone. Existing gameplay JSON, pack, installed-content and offline caps are unchanged. Do not put new binary media into an existing pack JSON to bypass that work.

The authoring CLI's older `mediaVersion:1.0.0` document is a separate source-art contract. There is no implicit conversion or automatic runtime discovery of `authoring/library/fpv-pressure-art`. Use a future explicit compiler/import boundary with exact hashes, bounds and reviewed ownership.

## Verification and next gate

Focused tests use explicit injected fixtures, real legacy/Classic cores, Standard/Gentle and both turning policies. They compare real winning replay/checkpoints, campaign/board identities, original hashes and existing profile export bytes while resolving distinct still revisions. Separate tests exercise context removal, collisions, immutable history, missing assignments, hostile getters, format/pixel/byte rejection, decoder failure, cancellation and modeled browser object-URL cleanup. No generated production art, old fixture rewrite, host/browser run, database upgrade or physical-device claim is part of these checks.

Next: review this API, then implement an explicit preparation/adoption/storage boundary with original audio preservation and atomic backup tests. Only after that should a host consume validated pictures, verify real decode and partial-reveal contrast, preserve collected records, and qualify offline/browser/device behavior. The [media design](media-library-design.md) and [production plan](production-plan.md) retain the broader unfinished scope. [Reusable authoring/review prompts](../authoring/prompts/media-presentation.md) describe this bounded foundation without adding CLI registry IDs.
