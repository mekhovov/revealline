# Pictures belong to a flight

The new solo host opts into stored still-image assignments. Its source and bounded source-browser gates pass; frozen/offline/public qualification remains open. It is not a video implementation. Core movement, capture, collision, score authority and recorded input stay unchanged.

A fresh campaign attempt prepares all of its installed themes once. Each choice names either the original pack artwork or an exact managed presentation revision, asset ID and SHA-256. The first simulation tick waits for that choice and for complete decoding of the selected original. The still is passed to the painter as one image/fit binding; actor rigs, terrain, the opaque black mask and capture effects keep their existing paths.

Changing the admin assignment from A to B affects a fresh attempt. The current attempt, its saved continuation and its victory still use A. Cosmetic theme changes use that attempt's already-recorded choice for the new theme; image and theme are staged before publication. Body, terrain treatment and reduced effects never choose a new picture. Failure, redeployment and closing a cut keep the same choices.

Start may wait for storage or image decoding. Pause, a newer selection, backgrounding or closing the page cancels pending start intent. Returning focus never resumes flight. Explicit Resume retains the existing saved direction and buffered turn, while Boost and actions still pass the normal neutral barrier. A failed image read leaves the flight paused. For a fresh attempt only, **Use original pack artwork** explicitly selects authored artwork for all themes; this does not claim the unavailable storage was read successfully. A saved managed attempt never silently takes that fallback.

## Ownership and integration

- `game/ui/flight-pictures.mjs` owns one attempt's choices and currently decoded image slot. It performs no simulation, profile or award writes. Its caller owns pause/resume intent.
- `game/ui/picture-identity.mjs` derives exact Standard/Gentle owners from trusted current content and verified retained media owners. It normalizes levels and the effective class roster before comparing ownership. Backup factories use their own included packs, never unrelated installed worlds or a Gentle execution relabeled as an authored base.
- `game/ui/presentation-image.mjs` authenticates the selected original, checks its complete decoded dimensions and releases aborted or superseded candidates. The painter never opens storage or releases these bindings.
- `game/app.mjs` freezes choices on preparation, gates start, stages restored flights, supplies `backdrop`, adds pins to suspension and submits first-earned pins in the existing completion/profile transaction. The same exact picture remains during victory.
- `game/ui/first-flight-entry.mjs`, `game/attempt-file.mjs` and `game/attempt-export.mjs` pass the optional pins/catalog through their existing verification and lock boundaries. Entering training does not downgrade the parent save. Training, dated challenges and imported practice use their legacy presentation; training creates no new managed choices, receipts or progress writes.
- Collection receives `pictureMedia({signal}) -> {store,metadata}`. Its async backup preparation can capture `resolveMediaIdentityCatalog(metadata)`, a synchronous resolver over the backup's prospective content. JSON backups carry identities; the separate `.rlmedia` bundle carries original image bytes.

Old v1/v2 saved flights keep their original artwork and format; current assignments are not applied retrospectively. New pinned saves use `xonix-session.v3`. A missing managed original rejects staged restoration before replacing the currently displayed run/image. The original saved file can still be retained for recovery. Collection first-earned handling is a separate consumer of the same historical pins.

## Shared storage

The solo host explicitly opens one `createManagedMediaStore({richStillMedia:true})` and injects it into both soundtrack and still adapters. The still service exists even when file-audio playback is unavailable. Normal picture preparation reads metadata plus the selected original, never all image albums. Existing audio track bytes, playlists, generations and playback remain under the same bounded manager.

The database is shared across editions on one origin. v3 preserves existing originals and does not downgrade or delete an older store. Older tabs may need to close to permit the upgrade; older v1/v2 readers may then report a newer-store error, while their built-in game/music remains usable. Use the new edition's `.rlsound` and `.rlmedia` exports for recovery. This is an explicit new-edition adoption, not a change to frozen releases. The existing 256 MiB shared budget and original-byte formats remain unchanged.

## Verification and remaining qualification

Focused modeled-host checks exercise real app/input/core/session/library/store code with bounded DOM, IndexedDB and Image boundaries: both turning policies' A→assignment B→saved A restore→Resume→win/first-earned A→fresh Retry B, pending decode at tick zero, background cancellation, missing-original retention, old v2 legacy behavior, explicit new-attempt fallback, training without new writes, pinned current-attempt export and First Flight handoff, and a complete pinned JSON backup using raw installed plus normalized historical owners.

The nine new host cases and seven helper cases pass on Node 22.22.2 and Node 20.19.5. Initial affected runs passed 124 cases, then exposed 14 outdated timing/session-version expectations in a 205-case batch; all 19 cases in those three files passed after adapting to asynchronous start and v3 saves. Historical replay/session fixtures were unchanged. The later c8ae918 full run retained two old UI-wording failures; after correction, exact 2aa passes **all six gates and 2,707/2,707 tests**, closing the aggregate gap. Actual source-browser native A/B assignment, saved A, legal wins/first-earned A, paired originals/JSON recovery and shared audio are now recorded separately. See [receipt hashes and remaining gates](feature-delivery-workflow.md#current-still-integration-evidence); these results do not certify cold offline recovery, frozen/public delivery or physical devices.
