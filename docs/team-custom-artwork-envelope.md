# Custom Team artwork envelope

The `.rlteam` reader, staging adapter and Team picture resolver provide a separate in-memory source for local Team reveal pictures. They do not change historical pack or level formats. The resolver checks catalogue identity and theme compatibility. The Team host accepts these bundles in its existing pack picker and adopts the source together with its prepared picture. This source integration still requires native-browser and release qualification.

## Transfer and validation

The format is `revealline-team-presentation-envelope.v1`, with MIME `application/vnd.revealline.team-presentation`. Bytes contain ASCII `RLTEAM1\n`, a four-byte big-endian manifest length, UTF-8 JSON, then raw image bodies sorted by their lowercase SHA-256 hashes. No compression, extra fields, fetched URLs, trailing bytes or unreferenced images are supported.

The closed manifest has `format`, unchanged `pack`, canonical `packSha256` and `presentation`. The presentation contains `id`, `revision`, exact `theme` including nullable collection, `levels` and `assets`. Every historical pack level has one mapping with its exact `levelId`, typed `levelRevision`, canonical `levelSha256` and `pictureSha256`. Every unique referenced image has `sha256`, `bytes`, `mime`, `width`, `height` and display-only `provenance` (`kind: user-supplied`, `attribution`, `source`). Provenance is a user claim, never production approval.

The reader checks the complete legacy pack, every mapping and body hash, image headers and a mandatory real decoder before returning a source. It decodes one picture at a time and releases each qualification image. The accepted pack and receipt are frozen; private Blob slices and mapping tables are not exposed for mutation.

| Limit                                 | Contract                                                                                                                                    |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Legacy pack                           | Existing 1 MiB / 24-level rules.                                                                                                            |
| Raw and encoded manifest              | 2 MiB; JSON depth 18, 200,000 nodes, arrays 4,096 entries, strings 8,192 code units. Closed fields impose narrower limits.                  |
| New presentation/theme/collection IDs | Existing `stableId`, at most 80 characters; safe integer revisions 1–1,000,000. Historical level IDs and revisions retain legacy semantics. |
| Provenance                            | Nonblank attribution at most 512 code units and source at most 2,048.                                                                       |
| Whole input file                      | 32 MiB admission ceiling before body reading. A valid file is at most 26 MiB + 12 bytes.                                                    |
| Images                                | At most 24 unique bodies and 24 MiB total; each at most 4 MiB, full-frame 1152×576 PNG/JPEG.                                                |
| Import ownership                      | One accepted context and one pending or ready candidate. No queued readers.                                                                 |

Two validated original containers occupy at most 52 MiB + 24 bytes in retained file references. Admission of a not-yet-validated maximum-size file alongside an accepted container can reach 58 MiB + 12 bytes. These are reference/payload bounds, not measurements of browser memory. Temporary buffers, exported Blobs retained by callers and native allocations after decoder timeout remain separate. Measure actual browser memory and startup cost before public qualification.

## Adapter use

`game/coop/presentation-envelope.mjs` exports the format constants and:

- `readCoopPresentationEnvelope(file, { decodeImage, signal, onProgress })`: validate and return the opaque `{ pack, receipt }` owner. A decoder is mandatory and returns an owned `{ image, release }` handle.
- `readCoopPresentationPicture(owner, level)`: obtain the exact image descriptor and native Blob slice for an unchanged accepted level.
- `exportCoopPresentationEnvelope(owner)`: return original bytes without canonical rewriting or pixel conversion.
- `disposeCoopPresentationEnvelope(owner)`: idempotently retire source access and owned Blob references.

Host integration should use `createCoopPresentationImport` from `game/couch/coop-import-source.mjs`. Its default decoder is the existing bounded Team browser decoder. `prepare` validates a candidate without replacing `current()`. After host readiness and compatibility checks, `commit(candidate)` replaces the accepted owner atomically. `cancel` retires a candidate while preserving accepted content; `retire(owner)` releases only the exact accepted owner without abandoning an active validation; `dispose` closes the importer. `exportCurrent()` returns the accepted original.

Status callbacks report `manifest`, `checking-picture` with measured completed/total asset counts, and `ready`. A cancelled reader may remain `pending()` while a native read/hash or bounded decoder finishes. Keep the UI explicit about that state. A concurrent `prepare` rejects without retaining another input or changing the pending request; after settlement the player can deliberately retry. Qualification decoding does not receive the user abort signal, so cancellation cannot prematurely abandon its returned promise. Late results are checked and released before readiness. Native allocation drainage after timeout still requires browser observation.

Commit rejects foreign, forged, cancelled, already disposed or stale owners. A second commit of the same accepted owner is also rejected, leaving current content intact. A failed import or status callback must never retire an accepted source. No API writes player saves, media databases or the production registry.

## Retained picture resolution

Pass the opaque owner as `artworkSource` alongside the usual `pack`, `levelId`, `themeId` and `attemptId` in a Team picture request. The resolver authenticates that live owner before reading its metadata, requires an exact match between its pack and the requested pack, and includes the complete presentation receipt in request identity. Both Retry selection and confirmation also require the same owner object: reimporting identical bytes creates a new owner and therefore needs a deliberate fresh attempt.

The receipt must match the prepared theme ID, revision and collection exactly. A theme is supported only through an exact existing binding or the explicit historical-import theme policy. Reserved registered pack namespaces additionally require the exact code-owned pack revision and full canonical pack hash. Changing another level or metadata in the same pack cannot borrow that identity. These checks do not change the existing generic fallback policy for historical JSON.

Local pictures read their verified native Blob through the owner. They do not call the compiled asset reader or impersonate a reviewed asset slot. The shared resolver still rechecks byte count, MIME, hash, image header, actual decode dimensions, cancellation and lease ownership before replacing an accepted picture. The choice identifies `sourceKind: local-import` and its `presentationReceipt`; the host must label it as locally supplied. Painter geometry, contain fitting and nearest sampling remain unchanged.

Disposing the owner invalidates its future requests and confirmation. Keep the accepted owner alive throughout its attempt, Retry and Next, and retire it only when a replacement is fully adopted or its host is disposed. The host shares one adoption decision between the source manager and picture resolver. Pack, picture and source remain paired through selection, Start, Retry, Next and lobby return.

## Team host behavior

The existing **Open a Team pack or artwork bundle** control accepts historical `.json` and new `.rlteam` files. The extension or registered MIME selects the container reader; the reader independently validates its magic and complete contents. A malformed custom bundle never falls back to generic scenery. This is an advanced local authoring/import workflow; normal catalogue play has no file-picker requirement.

The selected pack stays available while its replacement is read, all images are checked and the first picture is prepared. Status reports the operation and actual image count. **Cancel import** invalidates custom adoption. While a native validation is finishing, file selection and Retry remain disabled and the status explains the wait; no extra reader is queued. Once it settles, **Retry pack** rereads the file into a fresh source owner. Historical JSON retains its existing **Stop waiting** behavior.

After exact theme/content checks, the host renders the tentative setup with Start guarded. It commits source ownership and clears the old operation in one synchronous step. Cancellation or failure before that step restores the previous pack, artwork and selection together. Later callbacks cannot roll back a committed import or overwrite a newer replacement, Reset or Start. Reset returns to starter content and releases the former local owner. A same-byte reimport creates a new owner and is still a deliberate fresh selection.

The selected pack is labelled **Local artwork**. Start remains explicit. Retry retains the accepted owner and picture; Next prepares the exact successor from the same imported pack. Settings and lobby return preserve this ownership without writing Solo progress, the media database or a persistent Team save. Closing the page releases both source contexts and decoded pictures. Reload requires importing the bundle again.

## Remaining browser and release checks

Before public acceptance of `.rlteam`:

1. Verify the integrated host supplies the actual code-owned bindings and supported theme policy to the resolver. Its reserved-namespace checks preserve gameplay identity for cosmetic artwork; changed gameplay under a reserved identity requires an explicit fork.
2. Keep locally supplied artwork visibly distinct from reviewed release assets. Preserve the compiled asset reader and its quality requirements, and expose an actionable error when exact theme/collection compatibility fails.
3. Retain the source discriminator and complete receipt through artwork selection, Start, Retry, Next and lobby return. Stage new pack and picture together; failure/cancellation keeps old results usable.
4. Reuse historical JSON intake independently. Invalid custom artwork must not silently become generic artwork. Normal catalogue play must not require a file picker.
5. Qualify real decoding, ordinary input, capture/Retry/Next, invalid replacement, cancellation, page disposal and offline reimport. Reload still requires reimport; persistent Team saves are deferred.

Focused tests use native File/Blob input, modeled image handles, complete in-memory PNG fixtures and actual Team simulation routes for capture, win, Next and Retry. They prove parser, byte, host ownership and cancellation contracts, not native image decoding, public availability or whole P08-A completion. The final integrated source still needs the six source gates, applicable production/build checks, immutable publication and public verification.

Maintenance prompt: “Preserve the closed historical schemas and exact original bytes. Maintain the integrated custom Team source through actual host selection and retained attempts, enforcing code-owned namespace and theme checks. Reproduce changed pixels under the same IDs, malformed payloads, stale/reentrant callbacks, cancel while decoding, failed replacement and exact export. Report modeled checks, native browser journeys and deployed/offline verification separately.”
