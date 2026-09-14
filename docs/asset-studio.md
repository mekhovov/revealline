# Asset Studio

Asset Studio is the local presentation workbench at `authoring/asset-studio/`. It edits the versioned asset registry and theme bundles. It does not write player saves, change gameplay rules, publish a release, or upload files to a service. Save locally and export a `.rltheme` bundle to transfer work or submit it for review.

## Workspace and revisions

The first visit opens the registered Field Kit source inventory. The baseline assets are labelled **source**, not finished production artwork. The inventory reports missing, source, produced, and reviewed counts separately. Filter by theme, screen, interaction state, media kind, readiness, or text. Selecting a theme stages a presentation selection; it does not change game type or campaign rules.

Every validated change appends immutable asset, theme, or collection records. **Save local revision** atomically saves the complete workspace in the isolated `revealline-presentation-studio-v1` IndexedDB database. **Undo draft** and **Redo draft** operate on unsaved workspace changes. A successful save clears this temporary undo stack. **Reset to saved** returns to the latest saved workspace. It never deletes earlier asset records from that saved workspace. Asset history can bind an earlier revision in a new theme revision.

An edited pixel document must be prepared or explicitly discarded. A prepared upload must be staged or explicitly discarded before switching assets or saving. Browser navigation warns about prepared or staged work. A second tab cannot silently overwrite a newer local generation: a stale save fails and keeps the in-memory workspace available for export. Export it before resetting/reloading. If IndexedDB is unavailable or corrupt, the default inventory still works in memory and remains exportable; saving stays blocked until a successful reload. No repair action clears player or Studio storage automatically.

## Preview and inspection

The inspector shows saved/current and working-draft assets beside one another. Available views are native pixels, enlarged pixels, alpha, and field context. Transparency view maps alpha to grayscale. Geometry overlays show the occupied bounds, pivot, rotor envelopes, and nine-slice interior. Overlay markings are inspection aids, never baked into exported pixels.

Image and media files use their real bytes. Font uploads are decoded with the browser font engine and expose an English/Ukrainian specimen. Audio files have browser playback controls. Drone recipes use the registered role artwork, `paintCharacter`, and `advanceAnimation`, with paused, playing, and reduced-effects controls. Enemy, pickup, terrain, trail, and feedback recipes use actual game drawing helpers. Sound recipes use an explicitly activated `Soundscape` audition with Stop. Component states and screen backdrops have scoped title/dialog or control specimens, including nine-slice image placement. These are **bounded previews**, not a full simulation of every game state or proof that an asset is production ready. Source audio auditions remain procedural recipes, not uploaded recordings. Field context uses `BoardPainter` over an independent normalized built-in mission fixture. Selected material/pickup slots are placed only in that authoring fixture. The fixture is advanced through the simulation API and then held; cosmetic playback does not advance a live run. Current and draft images are passed through scoped renderer overrides. Picture source recipes resolve through the code-owned current-art catalog: exact source originals are verified, while real procedural sources retain their exact theme, level, and labelled seed. Loading is lazy after picture selection, cancellable on preview replacement, and has a Retry action. Field context uses the exact source level when available and explicitly labels an alternate inspection board otherwise. **Show picture viewer** uses the game’s actual gallery painter and the original contain/cover policy. These read-only previews never install a chapter or rewrite an earned-picture pin.

Requirements include all usage screens and states, exact frame size, alpha policy, byte budget, palette, dependencies, and geometry. The complete machine-readable slot contract is visible beside the human-readable explanation.

## Replacing an asset

1. Select a slot and choose an accepted PNG/JPEG/WebP image, WOFF2/TTF/OTF font, or WAV/OGG/MP3 audio file. The format must match the slot. The original must fit the presentation system's global byte and decoded-dimension limits.
2. For an image, adjust the original-image crop rectangle. **Center crop to slot** selects the appropriate aspect ratio; **Prepare derivative** creates a separate PNG at the exact slot frame size using the registered sampling rule. The source file and its original dimensions remain intact. Download the original at any time.
3. Inspect or edit the normalized pivot, rotor anchors, and nine-slice metadata. **Apply geometry to preview** runs the full binding validator before updating the preview. Frame dimensions and required hub count remain constrained by the slot. Occupied bounds are measured from visible pixels. **Edit current raster metadata** creates a new revision over existing bytes without recropping.
4. Enter the actual creator, source, license/rights statement, and effective prompt. The Studio requires these fields and does not infer rights from an upload or an AI-generated image.
5. **Validate and stage replacement** checks the schema, geometry, dimensions, alpha requirement, byte budget, file headers, content hashes, and complete byte table. An empty transparent sprite is rejected. Font files also pass the browser font decoder. A failed check leaves the candidate editable and the prior workspace intact.
6. Inspect the comparison, then save locally or export. Candidates enter the **produced** stage; successful technical validation alone does not establish a reviewed release. After performing real review, enter concrete evidence in revision history and use **Record reviewed revision**. This appends an immutable reviewed revision without overwriting the candidate.

Crops retain their source as a separate immutable asset and link the derivative through provenance. Historical originals and derivatives remain in subsequent exports. A metadata-only revision retains the previous record as its provenance parent. Font/audio originals remain the immutable source bytes of their file asset.

## Pixel editor

The single-layer editor is available for image slots up to 128 × 128 pixels. Start blank or load the current raster frame. It supports pencil, eraser, flood fill, straight line, outline and filled rectangles, color picker, palette swatches, opacity, rectangular selection/move, horizontal and vertical flip, 90-degree rotation, exact color replacement, and 64-step pixel undo/redo.

Pointer dragging draws a stroke or defines a shape. The keyboard canvas uses arrow keys to move the cursor and Space to apply the selected tool. For a line, rectangle, or selection, the first Space anchors the start and the second ends it. Escape cancels an anchor/selection. **Discard pixel edits** clears only the transient editor; unprepared pixel changes block switching assets and warn before navigation. Ctrl/Cmd+Z undoes pixels; Shift+Ctrl/Cmd+Z redoes them. Moving a selection outside the frame is rejected instead of silently clipping pixels.

**Prepare edited sprite** sends the pixel document through the same PNG preparation, provenance, geometry, and staging flow as an upload. Rotating a nonsquare sprite may require recropping to its slot dimensions. Larger artwork is edited externally and uses the original-preserving crop controls.

## Tokens, collections, and AI briefs

Theme tokens expose registered colors, font names, readable type scales, spacing, borders, corners, and motion scale. **Validate and stage tokens** rejects unknown or out-of-range values. Tokens apply to bounded Studio previews, not to player settings or deterministic gameplay.

Inventory checkboxes form a coordinated collection. **Select required** includes all registry-required slots; individual checkboxes permit a smaller explicit set. **Stage selected collection** validates that every selected slot has a compatible binding before selecting the collection atomically. This is presentation grouping, separate from the gameplay identity of a future theme.

The three copyable AI briefs cover a new variation, editing an attached current asset, and replacing a collection. Each includes the selected theme, current revision, palette/tokens, exact dimensions, usage states, requirements, provenance guidance, and geometry contract. Collection prompts append every selected member contract; when nothing is selected they include the current asset and its dependencies. Clipboard failures select the complete text for manual copying.

**Import collection** fully validates a `.rltheme` header, manifest, file hashes, and decoded images before staging. Imported records are namespaced and adopted as a complete collection; existing and imported byte tables are merged and verified together. A malformed/incomplete import changes nothing. **Export .rltheme** includes the selected presentation, immutable history, original media, and derivatives. It requires a staged workspace rather than silently excluding an unprepared upload.

## Release verification

Unit tests in `game/test/asset-studio-helpers.test.mjs` exercise crop bounds, normalized occupied-pixel measurement, and combined inventory/readiness filtering. `game/test/asset-studio-fixture.test.mjs` verifies every enemy role resolves to a normalized built-in mission, selected terrain/pickup fixtures remain valid, and preview runs are isolated and leave source packs unchanged. Core model, bundle, session, persistence, and sprite behavior have independent tests in `game/test/`. Browser release checks should cover upload → crop → stage → save → reload → export → import, geometry rejection/recovery, all pixel tools, keyboard focus, portrait and short-landscape layouts, unavailable storage, and a stale save from two tabs. Do not mark a source recipe or candidate as fully reviewed solely because these technical checks pass.

The phase source check exercised a new 64×64 sprite, pixel undo/redo, invalid-pivot rejection and recovery, staging, draft undo/redo, atomic local save, reload, restoring the original through history, and the Export action in the in-app browser. The single-pixel QA fixture remains historical data in that local test workspace and is not a production asset. Unit coverage verifies corrupt imports, byte round trips and stale saves. Native file-dialog upload/download acceptance and physical touch/controller checks remain separate release checks.

A full required-slot edit experiment retained 194 separate changes in 196 theme records and a 914,810-byte manifest. Successors inherit exact predecessors and store changed bindings/tokens. Byte and history limits still apply; an imported bundle cannot silently compact or rewrite earlier records.
