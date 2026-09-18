# Still-picture workshop

The [optional story-authoring extension](story-workshop-authoring.md) adds video inspection, exact saved-poster bindings and separate `.rlstory` transfer only when a compatible story adapter is injected. The existing host and its v3/default behavior remain unchanged; this is a source capability for later coordinated host adoption, not a delivered story journey.

The standalone page at `authoring/still-media/` supports original PNG/JPEG upload, exact map/world assignment and isolated preview through the shared v3 store. The integrated solo host freezes all world choices when preparing a fresh attempt. Assignments do not alter existing saved flights or first-earned Collection receipts, and the workshop never awards completions. No generated artwork is automatically imported. The game Settings links to the workshop for its exact edition; its build inclusion has an independent verification gate. See [flight picture adoption](flight-pictures.md) and [earned pictures](earned-picture-view.md).

Serve the repository with the existing source CLI and open `/authoring/still-media/` on that same localhost address. `file://` fails visibly. Different hosts, ports or protocols select different browser storage; they cannot inspect the first origin's saved files.

## Explicit real storage

Page load does not open media storage. **Open local media** explicitly opens the real same-origin `revealline-soundtrack-v1` database at version 3. One `createManagedMediaStore({richStillMedia:true})` is shared by `createStillMediaStore` and `createSoundtrackStore`; it is not a disposable authoring database or a separate budget. The integrated solo game also opens a shared v3 manager for pictures and audio. Older frozen audio readers may report a newer-store error after this upgrade; their data is retained, but cross-version audio playback is not guaranteed.

The page explains the upgrade before the action. MP3 metadata and original bytes remain intact, but older v1/v2 audio readers cannot reopen v3. Export music in the older game first if needed, then close old tabs. Blocked opens fail visibly and require explicit retry after blockers close. Future-version errors require a newer compatible workshop. Nothing deletes or downgrades the database. Closing this page's connections cannot undo a committed schema upgrade or save.

**Prepare soundtrack backup → Download soundtrack** uses the compatible v3 audio adapter and existing `.rlsound` verifier. A visible native download link preserves browser keyboard/touch activation, without auto-clicking or claiming disk completion. Its one prepared Blob URL remains available to retry until replaced or closed. It excludes still images. Corrupt shared metadata can prevent even audio export; errors preserve data and never substitute an empty library or promise unavailable recovery.

## Exact installed ownership

The default host reads module-relative `game/build-info.json` before creating a media manager. Its exact `version` selects `release-${version}`; a leading `v` is preserved to match the game host. Only an actual HTTP 404 selects source **dev**. Network/server failures, invalid JSON, missing/invalid version and cancellation stop opening; they never silently select dev. A packaged workshop must include the same edition's build information and content. The source path still works with its existing dev keys.

`attachStillMediaHost({channel})` and `createStillAuthoringCatalog({channel = 'dev', ...})` also allow an explicit bounded channel. `stillAuthoringKeys(channel)` accepts dev or a numeric three-component release version with optional leading v. The four exact keys are `revealline.packs.${channel}.v1` and `revealline.library.${channel}.v1.{writer,backup-lock,backup-journal}`. No profile scanning, closest-version guessing or channel normalization occurs. All channels share the same origin's media database; these selected keys bind installed-game ownership and writer/recovery coordination.

Install an intended pack in that exact game edition first, then close that game. This workshop does not install packs, read progress or write the asset database. Only an actual `null` pack read means no installed packs; corrupt/unreadable data fails.

Reads use the source game's existing writer and backup Web Locks and reject pending backup tokens/journals. Browsers without Web Locks refuse editing. Before final media commit, the same locks are held while the exact original pack-library value is compared again. Changed packs require reload/review; independent media CAS rejects another media writer. These locks protect participating game/backup writers, not arbitrary direct database modification.

Selectors list authored Standard contexts once. The actual execution catalog resolves Standard/Gentle to their common authored presentation tuple: base campaign key, map ID, authored level revision and registered theme ID. Challenges, standalone practice and absent owners cannot receive new assignments. Historical owners/images remain stored after pack removal; this panel only previews currently installed contexts and is not an archived Collection viewer.

## Upload, preview and save

1. Open local media and wait for complete saved-original/catalog verification. Read failure disables editing without creating an empty replacement.
2. Select a chapter, map and world. Choose one original PNG/JPEG and enter credit, source declaration and description. These declarations are not automatic rights certification.
3. **Preview chosen file** checks signature/header, dimensions, full decoding and SHA-256 before isolated display. It writes no storage. Keep the original externally; no cropping, resizing or reencoding is performed.
4. **Save assignment** prepares the complete candidate, retains original history/owners, and commits under both source-catalog and media-generation guards. Quota/write refusal preserves old saved bytes, draft and preview. Notification failure or late cancellation cannot undo a committed save.
5. Reload verified state, or preview a saved revision and explicitly select it. **Use authored picture** removes only the assignment. **Preview authored picture** displays that map's fallback. Originals/history remain; Delete, pruning and GC are not implemented.

The preview uses separate `BoardPainter.drawGallery` rendering with one decoded image/fit pair. It stages before publishing pixels, retains the prior same-context preview on failure and clears it on explicit context change. Stale loads/cancellation/disposal cannot overwrite newer previews. Managed stills use `contain`/nearest; legacy backgrounds retain validated fit. This preview never changes a live painter, actor, collision cue or Collection record. The solo/Collection integration separately uses exact pinned originals.

Existing controller navigation operates native controls and dialog focus. Back closes the active editor/dialog; it never starts a game. Native file dialogs may blur without invalidating the selected file; genuinely hiding the page cancels its pending context. File picking and text entry rely on browser/OS controls, with no controller virtual keyboard. Modeled inputs do not certify physical hardware.

## Portable originals: prepare, download, review, restore

Inside the modal, **Prepare originals download** performs a fresh full store read and `.rlmedia` verification. It prepares one retained Blob URL and focuses the visible native **Download originals** link. There is no automatic click. Native keyboard, pointer/touch or controller activation requests the download; only the browser can confirm the destination and disk completion. The same prepared copy supports retry. Repreparation, draft/context changes, review, cancellation, close, hiding or disposal invalidate it and revoke its URL.

For import, choose one `.rlmedia` file, then choose an assignment policy:

- **Keep current assignments; add missing bindings** gives destination assignments priority and adds only missing bindings.
- **Use the bundle's exact assignment set** replaces the assignment set, including removing destination bindings absent from the file. It retains all original assets, immutable revisions, owner histories and generic references.

**Review chosen originals backup** verifies the complete binary file, its exact retained owner history and every referenced original. It prepares a merge against a fresh verified target read. The visible review reports target generation, policy and resulting original/revision/assignment counts, without writing any data. Changing the file, policy or installed context invalidates the review. An explicit **Restore reviewed originals** commits only that reviewed candidate under catalog locks and the existing media CAS. Concurrent edits, missing/corrupt original bytes, immutable-ID collisions, budget limits and write/quota errors refuse before or roll back the whole transaction. A successful transaction cannot be undone by a late Cancel; the UI directs a fresh **Reload saved media and installed maps** to verify the result.

Restore does not clear the already inspected canvas on failure or success; the user reloads and explicitly previews the saved binding. That canvas may therefore still show the prior preview until a new preview is chosen. Neither assignment policy deletes retained history. The source file remains available to repeat review. Restoring an old file with the exact-assignment policy can restore older bindings; it cannot erase originals added since then, and is not a general history/GC Undo.

`.rlmedia` contains every referenced still and retained generic original plus exact owner metadata. It excludes audio-only files, player profiles, saved flights and installed pack payloads. It is an originals backup, not complete game-data backup by itself. Use the game's separate backup/transfer workflow and `.rlsound` alongside it where needed. Imported removed-pack owners retain provenance/history without installing content or granting an earned picture. See [binary bundle validation and bounds](media-bundle.md).

## Bounds and remaining gates

Limits stay at 4 MiB per still, 8,192 pixels per side and 16 megapixels for source images; an assigned poster must be at most 1,920 × 1,080. Shared committed-plus-staging storage remains 256 MiB; rich metadata including owners 2 MiB; image records 512; retained presentation revisions 256. Append-only history consumes these limits. Reads verify all referenced originals sequentially and are cancellable, without a per-file progress meter yet.

Focused tests use actual host/panel/schema/store/hash/bundle APIs with finite IndexedDB, injected decode and DOM/device boundaries. They check all-original restore/export equality including retained generic bytes, both assignment policies, no-write review, catalog/CAS refusal, corrupt bytes, quota rollback, cancellation/allocation cleanup, release/dev channel authority and unchanged MP3 recovery. The actual shared controller router prevents a held Review Confirm from applying Restore; native Enter is left unprevented and its browser default is explicitly modeled. File choosing/text entry still needs the browser/OS controls. Actual new binary UI downloads, upload/review/restore, decoded visual quality and physical-device qualification remain parent-run gates. Earlier workshop upgrade/image/audio browser evidence does not certify this newly added binary journey.

Runtime pin/receipt models and original acquisition APIs are integrated in the solo host and Collection; the standalone workshop remains a separate authoring surface. The strict v3 media document has no receipt/pin fields; do not append them silently. Paired game-data/original recovery, stories, optional binary/offline downloads and safe pruning need their own complete host gates. See [storage](media-storage.md), [still identities](media-presentation.md) and [the broader media design](media-library-design.md).
