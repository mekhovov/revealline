# Source still-picture workshop

The source-only page at `authoring/still-media/` supports original PNG/JPEG upload, exact map/world assignment and isolated preview through the opt-in v3 store. It does not replace pictures in live flights, saves or Collection, or award completions. No generated artwork is automatically imported. This slice does not add the page to the release build allowlist.

Serve the repository with the existing source CLI and open `/authoring/still-media/` on that same localhost address. `file://` fails visibly. Different hosts, ports or protocols select different browser storage; they cannot inspect the first origin's saved files.

## Explicit real storage

Page load does not open media storage. **Open local media** explicitly opens the real same-origin `revealline-soundtrack-v1` database at version 3. One `createManagedMediaStore({richStillMedia:true})` is shared by `createStillMediaStore` and `createSoundtrackStore`; it is not a disposable authoring database or a separate budget. Default game startup is unchanged.

The page explains the upgrade before the action. MP3 metadata and original bytes remain intact, but older v1/v2 audio readers cannot reopen v3. Export music in the older game first if needed, then close old tabs. Blocked opens fail visibly and require explicit retry after blockers close. Future-version errors require a newer compatible workshop. Nothing deletes or downgrades the database. Closing this page's connections cannot undo a committed schema upgrade or save.

**Prepare soundtrack backup → Download soundtrack** uses the compatible v3 audio adapter and existing `.rlsound` verifier. A visible native download link preserves browser keyboard/touch activation, without auto-clicking or claiming disk completion. Its one prepared Blob URL remains available to retry until replaced or closed. It excludes still images. Corrupt shared metadata can prevent even audio export; errors preserve data and never substitute an empty library or promise unavailable recovery.

## Exact installed ownership

The catalog reads only `revealline.packs.dev.v1`, the source game's explicit **dev** pack channel, plus its base campaign/classes/themes. Install an intended pack in the source game first, then close that game. This workshop does not discover historical profiles, install packs, read progress or write the asset database. Only an actual `null` pack read means no installed packs; corrupt/unreadable data fails.

Reads use the source game's existing writer and backup Web Locks and reject pending backup tokens/journals. Browsers without Web Locks refuse editing. Before final media commit, the same locks are held while the exact original pack-library value is compared again. Changed packs require reload/review; independent media CAS rejects another media writer. These locks protect participating game/backup writers, not arbitrary direct database modification.

Selectors list authored Standard contexts once. The actual execution catalog resolves Standard/Gentle to their common authored presentation tuple: base campaign key, map ID, authored level revision and registered theme ID. Challenges, standalone practice and absent owners cannot receive new assignments. Historical owners/images remain stored after pack removal; this panel only previews currently installed contexts and is not an archived Collection viewer.

## Upload, preview and save

1. Open local media and wait for complete saved-original/catalog verification. Read failure disables editing without creating an empty replacement.
2. Select a chapter, map and world. Choose one original PNG/JPEG and enter credit, source declaration and description. These declarations are not automatic rights certification.
3. **Preview chosen file** checks signature/header, dimensions, full decoding and SHA-256 before isolated display. It writes no storage. Keep the original externally; no cropping, resizing or reencoding is performed.
4. **Save assignment** prepares the complete candidate, retains original history/owners, and commits under both source-catalog and media-generation guards. Quota/write refusal preserves old saved bytes, draft and preview. Notification failure or late cancellation cannot undo a committed save.
5. Reload verified state, or preview a saved revision and explicitly select it. **Use authored picture** removes only the assignment. **Preview authored picture** displays that map's fallback. Originals/history remain; Delete, pruning and GC are not implemented.

The preview uses separate `BoardPainter.drawGallery` rendering with one decoded image/fit pair. It stages before publishing pixels, retains the prior same-context preview on failure and clears it on explicit context change. Stale loads/cancellation/disposal cannot overwrite newer previews. Managed stills use `contain`/nearest; legacy backgrounds retain validated fit. Live painters, actors, collision cues, celebrations and Collection painters are unchanged.

Existing controller navigation operates native controls and dialog focus. Back closes the active editor/dialog; it never starts a game. Native file dialogs may blur without invalidating the selected file; genuinely hiding the page cancels its pending context. File picking and text entry rely on browser/OS controls, with no controller virtual keyboard. Modeled inputs do not certify physical hardware.

## Bounds and remaining gates

Limits stay at 4 MiB per still, 8,192 pixels per side and 16 megapixels for source images; an assigned poster must be at most 1,920 × 1,080. Shared committed-plus-staging storage remains 256 MiB; rich metadata including owners 2 MiB; image records 512; retained presentation revisions 256. Append-only history consumes these limits. Reads verify all referenced originals sequentially and are cancellable, without a per-file progress meter yet.

Focused tests use actual schema/store/hash/export APIs with finite IndexedDB, injected decode and DOM/device boundaries. They check lazy shared v3 access, original MP3 export equality, exact-context/CAS refusal, failed writes, cancellation, native navigation and preview cleanup. Actual browser upgrade, native files, decoded visual quality and physical-device qualification remain separate parent-run gates.

Live adoption still needs versioned run/session presentation pins and earned-receipt reconciliation across profile localStorage and media IndexedDB. The strict v3 document has no receipt/pin fields; do not append them silently. Story playback, durable earned pictures, `.rlmedia` complete backup, optional binary/offline downloads and safe pruning remain subsequent work. See [storage](media-storage.md), [still identities](media-presentation.md) and [the broader media design](media-library-design.md).
