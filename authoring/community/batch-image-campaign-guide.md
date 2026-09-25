# Build a campaign from several pictures

Phase 2 extends the picture creator with a batch review workflow. It keeps the one-picture path from Phase 1: choosing one file still opens the compact single-level review. Choosing two or more files opens the ordered campaign review described here.

## Select and order pictures

1. Open the [Picture campaign creator](../../game/creator/).
2. Choose several PNG, JPEG or static WebP files at once, or drop them on the selection area. Each file has the same 4 MiB and 16-megapixel limits as a single-picture campaign. The creator prepares one full-size image at a time so a large selection does not decode every source simultaneously.
3. Enter the collection name and choose a pacing option. Pacing guides deterministic template selection; it does not use the picture filename or encoded bytes to change map geometry.
4. Review the initial natural filename order. For example, `picture2.png` appears before `picture10.png`. Files with the same visible name remain in their selection order.
5. Use **Move up** and **Move down** to set the campaign play order. Use **Remove** for an item that does not belong in this draft.

## Generate and review

1. Choose **Generate included levels**. Each card moves through waiting, preparation, and its own validation result. The progress indicator reports the current item and total. **Cancel preparation** stops after the active operation releases its resources; completed cards remain reviewable.
2. Review the prepared picture, editable title, selected template variant, and validation result on every card. A successful result means the generated configuration has matching automated route evidence. It is still not a human quality rating.
3. If one item fails, use **Regenerate** after correcting the source or changing the generation choice. You can also clear **Include in campaign**. Failed included items block bulk approval; excluded failures do not.
4. Changing fitting, pacing, or the collection name invalidates prepared results because those settings affect reviewed bytes or generation choices. Generate the included items again.
5. Check the readiness and capacity messages. The estimate shows the likely portable pack size and staging space. The final storage check still occurs against actual prepared bytes.

## Handle a large campaign

- If the capacity message says the selection does not fit, use **Split into smaller packs** to accept the suggested grouping. The grouping preserves the current order. The creator then shows one **Review part _n_ of _total_** button per exact part.
- Open one part at a time. Each button revalidates that part against the current immutable review, then exposes its own install and download actions. Finish installing or downloading it before reviewing the next part.
- Exclude unneeded cards, then choose **Remove excluded items** to make that decision permanent in this draft.
- The creator never silently drops a picture. A split or removal is an explicit creator action.
- Keep a source backup before clearing browser storage. Capacity estimates are advisory; an interrupted or refused write must leave the reviewed work available for download.

## Approve, install, and share

When every included card passes, the readiness message reports that the campaign can receive one bulk approval. **Approve included campaign** binds that exact order, collection settings, prepared projects, media hashes, and validation evidence. Later edits invalidate approval for the changed bytes.

After approval, install the campaign for ordinary Custom progression or download the scoped `.rlpack`. The portable campaign contains only its required runtime derivatives and editable gameplay. Source originals belong only in the separate private source backup, and player progress remains separate from both files.

The Phase 2 acceptance record must cover 1-, 12-, and 50-picture selections, duplicate filenames, portrait pictures, failed and excluded items, cancellation, capacity splitting, reload recovery, and actual install/play continuation before this workflow is advertised as released.

## Integration status

The batch review controller is isolated in `game/creator/batch-ui.mjs`. Its `prepareItem`, `approveBatch`, `capacityFor`, and `onSplit` functions are injected so the UI never invents package semantics. Production intake is enabled only with the exact-byte `batchApprovalAdapter`: each review card owns its prepared one-mission bundle and normalized image result, and the adapter revalidates the combined campaign before issuing one approval. It keeps selected runtime derivatives and private originals in separate dependency closures. The package limit is 24 MiB; approval stays disabled when the current selection needs an explicit split or removal decision.
