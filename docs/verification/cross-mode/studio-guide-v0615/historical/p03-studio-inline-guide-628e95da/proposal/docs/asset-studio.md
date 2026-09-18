# Asset Studio

Asset Studio is the local presentation workbench at `authoring/asset-studio/`. It edits the versioned asset registry and theme bundles. It does not write player saves, change gameplay rules, publish a release, or upload files to a service. Save locally and export a `.rltheme` bundle to transfer work or submit it for review.

## In-page guide

Open **Studio guide** in the footer for the select → prepare → provenance → stage → inspect/save/export workflow without leaving the workspace. The native disclosure works before the Studio module is ready. Its script-owned **Close guide** action appears only after mounting; Close or Escape from inside the guide collapses it and returns owned foreground focus to its summary. Escape outside it retains the existing editor/operation behavior. The guide remains available while authoring controls are busy and uses the existing Interface typography.

Reading or closing the guide never changes prepared original/derivative bytes, crop/provenance fields, pixel undo/redo, staged history, or preview playback. A persisted history return retains the reader; terminal departure disposes only its scripted handlers. It is an in-page help surface, not a modal, navigation route or new operation owner.

Maintenance prompt: “Open Studio guide while an upload is prepared and while sprite encoding is pending. Read and close it using the actual summary, Close and Escape; verify the operation remains current, subsequent saved original/derivative bytes match, crop/provenance and real pixel undo/redo survive, and preview playback intent is unchanged. Escape outside the guide still cancels the operation. Check Plain/Large text, portrait and short landscape, and closing a scrolled reader in a native browser separately from modeled DOM tests.”

## Workspace and revisions

The first visit opens the registered Field Kit source inventory. The baseline assets are labelled **source**, not finished production artwork. The inventory reports missing, source, produced, and reviewed counts separately. Filter by theme, screen, interaction state, media kind, readiness, or text. Selecting a theme stages a presentation selection; it does not change game type or campaign rules.

Every validated change appends immutable asset, theme, or collection records. **Save local revision** atomically saves the complete workspace in the isolated `revealline-presentation-studio-v1` IndexedDB database. **Undo draft** and **Redo draft** operate on unsaved workspace changes. A successful save clears this temporary undo stack. **Reset to saved** returns to the latest saved workspace. It never deletes earlier asset records from that saved workspace. Asset history can bind an earlier revision in a new theme revision.

An edited pixel document must be prepared or explicitly discarded. A prepared upload must be staged or explicitly discarded before switching assets or saving. Browser navigation warns about prepared or staged work. A second tab cannot silently overwrite a newer local generation: a stale save fails and keeps the in-memory workspace available for export. Export it before resetting/reloading. If IndexedDB is unavailable or corrupt, the default inventory still works in memory and remains exportable; saving stays blocked until a successful reload. No repair action clears player or Studio storage automatically.

## Preview and inspection

The inspector shows saved/current and working-draft assets beside one another. Available views are native pixels, enlarged pixels, alpha, and field context. Transparency view maps alpha to grayscale. Geometry overlays show the occupied bounds, pivot, rotor envelopes, and nine-slice interior. Overlay markings are inspection aids, never baked into exported pixels.

Image and media files use their real bytes. Font uploads are decoded with the browser font engine and expose an English/Ukrainian specimen. Audio files have browser playback controls. Drone recipes use the registered role artwork, `paintCharacter`, and `advanceAnimation`, with paused, playing, and reduced-effects controls. Enemy, pickup, terrain, trail, and feedback recipes use actual game drawing helpers. Sound recipes use an explicitly activated `Soundscape` audition with Stop. Component states and screen backdrops have scoped title/dialog or control specimens, including nine-slice image placement. These are **bounded previews**, not a full simulation of every game state or proof that an asset is production ready. Source audio auditions remain procedural recipes, not uploaded recordings. Field context uses `BoardPainter` over an independent normalized built-in mission fixture. Selected material/pickup slots are placed only in that authoring fixture. The fixture is advanced through the simulation API and then held; cosmetic playback does not advance a live run. Current and draft images are passed through scoped renderer overrides. Picture source recipes resolve through the code-owned current-art catalog: exact source originals are verified, while real procedural sources retain their exact theme, level, and labelled seed. Loading is lazy after picture selection, cancellable on preview replacement, and has a Retry action. Field context uses the exact source level when available and explicitly labels an alternate inspection board otherwise. **Show picture viewer** uses the game’s actual gallery painter and the original contain/cover policy. These read-only previews never install a chapter or rewrite an earned-picture pin.

Requirements include all usage screens and states, exact frame size, alpha policy, byte budget, palette, dependencies, and geometry. The complete machine-readable slot contract is visible beside the human-readable explanation.

## Studio Interface

Open **Interface** for Theme/Plain text, Standard/Large size and Reduced effects. Host body/control/secondary roles use 18/16/14px, or 22/20/18px in Large. These choices update the existing shared display record and existing controls; they do not stage a theme, rebuild a draft, replace prepared media or write player saves. Interface controls remain available during an authoring operation. A failed preference save keeps the visible session-only choice and reports it beside the controls.

Host instructions and actions retain their readable roles even when the draft preview uses different theme tokens. Selected-font and authored-component specimens retain their own identity. Font samples use the selected file: display at least 40px/600, UI at 400/500/600 and numeric at 500, with English/Ukrainian strings. A shared font file retains one registration with compatible requested weight ranges; failed loading or widening offers Retry without discarding a still-usable registration. Those behaviors do not prove glyph coverage or approve an uploaded font.

The system reduced-motion preference caps the saved choice. The checkbox retains the user's raw choice and an explanation identifies an active system cap. Preview changes affect owned frames only; clearing the cap resumes retained Playing with a reset clock, while Paused and Reduced remain still. Text changes do not restart the animation or audio. Persisted navigation may rebuild the existing owned preview views; changing an Interface control does not.

A successful foreground inventory selection retains the replacement selected button on desktop if its activating button owned focus. At widths up to 700px, selection keeps the existing Inspector handoff. A rejected prepared-upload or dirty-sprite selection leaves the original button and work in place. This scoped correction does not fix cold Back filter/selection restoration or focus after a successful mutation disables its own action; those remain separate P04 work.

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

## Current release collection

A new workspace loads the compiled release assets. Existing local drafts remain unchanged. **Load release collection** stages the current release through the same immutable, namespaced collection path as an import; save it or undo it explicitly. The compiler includes an editable `studio.json` plus every retained hash-addressed asset. Its fixed-path loader verifies the complete candidate before staging and never accesses player saves. See [production and adoption](field-kit-production.md).

Copied edit prompts now include the selected asset's actual geometry and full production brief, so a custom pivot, rotor layout or prepared-scene palette is not replaced by the baseline slot defaults. Collection prompts carry those current requirements for every selected member.

Complete collection round trips reuse identical immutable asset revisions already present in the workspace. New or conflicting imported revisions are namespaced, and derivative links follow the imported history. Corrupt files or a true combined-budget overflow fail before the current workspace changes.

## Medium-specific generation briefs

Copied briefs distinguish images, fonts and audio. Image requests retain exact frames, transparency, pivots and rotor anchors. Fonts request real licensed WOFF2 bytes and actual English/Ukrainian cmap, axis and metric checks, including Ґґ Єє Іі Її and 200% browser zoom. Short audio cues request mono 48 kHz / 16-bit PCM WAV, at most one second, with clean envelopes; music requests a seamless 4–16-bar OGG/MP3 loop with a retained lossless source. Record measured duration, peaks, encoded bytes and an actual audition alongside existing music. Those are candidate requirements, not a claim that the existing procedural soundtrack consists of uploaded recordings.

The generated effective contract replaces the legacy generic pixel-art brief for font/audio slots while retaining their immutable IDs and original records. A custom current production brief is preserved. Palette tokens identify the collection without pretending that colors are audio parameters. Sound remains supplementary, with explicit activation, mute, volume and Stop behavior.

## Revise a procedural recipe

Recipe-only rotor, trail and effect slots request a reviewable change to registered source code or supported theme tokens and related body anchors. They do not accept PNG uploads or executable content in `.rltheme` bundles. Recipe metadata stores only a registered ID; new behavior or a new recipe requires implementation and review. Keep prior source/revisions and validate the actual runtime, pause and reduced-motion behavior. All three copy actions retain the current custom production brief.

Offline previews keep their dependencies local where possible. Player and rotor specimens use core presets plus the selected asset. Complete picture-owner metadata creates that exact inspection run directly. Generic fixture metadata is separate from downloadable picture originals; an unavailable exact owner is reported rather than replaced by another mission.
