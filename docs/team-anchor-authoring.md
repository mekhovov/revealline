# Editable Team relay anchors

Relay Yard's available and captured anchors have separate slots: `team.anchor.available` and `team.anchor.captured`. Both accept a registered recipe or a centered 24×24 transparent image. These are Team objective decorations, not ordinary pickups. The fixed square, identity label and captured checkmark remain game-owned. Labels sit beside registered decoration so their readability plate cannot cover it at small sizes.

## Local authoring workflow

1. Open Asset Studio. On an older workspace, choose **Add Team presentation slots**. This stages one new document/theme revision and retains every old record. It does not publish or change player saves.
2. Search `team.anchor`. Select available or captured. Choose **Field context → Couch Team → Relay Yard**. Use **Initial field** for available anchors and **Anchors captured** for captured anchors. An inactive state is explicitly reported; previewing does not alter simulation rules.
3. Upload a transparent 24×24 source, or create it with the pixel editor. Keep the pivot centered and omit letters/checkmarks. Enter creator, source and rights, then validate and stage the replacement. Original bytes and previous revisions remain available.
4. Inspect Native size, enlarged pixels and both states in context. Confirm the marker and labels remain legible over light/dark revealed artwork. A source recipe or uploaded image is not automatically reviewed production art.
5. Save a local revision, export `.rltheme`, and re-import to verify the prepared files. When importing this newer collection into an older workspace, first add its Team objective slots. Undo draft reverses staged upgrades/imports; a successful save retains immutable history and clears draft undo.
6. Adopt the verified bundle through the release pipeline and run exact-source/public checks. Browser upload alone never replaces public game assets.

Historical themes lack these optional slots and keep their existing recipe/placement. An advertised raster must have a prepared 24×24 centered frame; malformed or unavailable prepared images fail before adoption, preserving the previous painter. Artwork changes no anchor coordinates, capture rules, collision, Support/rescue behavior or timing.

## Qualification boundary

Local tests cover immutable upgrade/partial registration, malformed geometry, actual Team initial/captured/completed states, unchanged runs and export/import original bytes. Native testing covers the explicit upgrade, Undo/Redo, upload, save/reopen, real Relay Yard previews, disk export, re-import/Undo and 390px layout. The first visual pass found opaque labels obscuring artwork; moving labels beside registered decoration corrected it. One test decoder fixture initially supplied width/height instead of naturalWidth/naturalHeight; its correction preserves image validation.

This is an authoring/runtime feature, not new approved campaign artwork. Relay core state authoring is described in [Team core authoring](team-core-authoring.md). Emitter, Support, rescue/recovery slots, full compatibility/physical-device qualification and release acceptance remain separate gates.
