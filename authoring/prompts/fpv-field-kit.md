# FPV Field Kit authoring requests

Use the [approved contract](../../docs/fpv-redesign-design.md), [interactive atlas](../design-atlas/index.html) and [phase register](../../docs/fpv-redesign-execution.md). These examples evolve with the implemented release. Phase 1 integrates the shared fonts and component states across existing pages and canvas labels. The asset studio has its own subsequent release boundary.

## Review one screen

> Compare the current mission browser with the Field Kit atlas at desktop, portrait phone and short landscape sizes. Preserve chapter identity, remembered selection, lock reasons and return focus. Show the actual current screen beside the proposed hierarchy. Record clipped controls, text contrast, keyboard focus and the distinction between locked and unrevealed artwork. Do not count a mockup as an implemented screen.

## Create an original asset candidate

> Create an original north-facing FPV Scout body for Reveal Line's Field Kit theme. Production target: 64×64 transparent PNG, center pivot (32,32), four motor hubs at (16,16), (48,16), (16,48), (48,48). Show a readable camera, battery, frame and antenna. Leave propeller blades to the runtime rotor layer. Use ink #070B12, panel #101923, text #F3F0DB, cyan #78DCE8, amber #F4BF62 and supporting neutral tones, with at most twelve opaque colors. Use crisp pixel clusters and binary alpha; no text, logo, blur, baked glow or background. Keep attachments inside the frame. Preserve the approved silhouette in variations. Retain the unmodified generated source and a separate prepared PNG; verify actual dimensions, alpha, anchors and readability at 20/24/32 CSS pixels. Record failures honestly and do not replace player saves or earned pictures.

## Review bilingual typography

> Check the actual shipped Handjet, Exo 2 and IBM Plex Mono WOFF2 files against English and Ukrainian text, including Ґґ Єє Іі Її and ʼ ’. Use Handjet only for large display accents. Inspect Continue flight / Продовжити політ, Mission complete / Місію завершено, І l 1, О O 0, 01:24 and 85% in Standard/Large text and at 200% zoom. Report structural glyph coverage separately from visual reading and clipping. Do not claim Ukrainian translation has shipped.

## Extend the shared interface

> Add this screen to the Field Kit interface using the three shared CSS files, in fonts/tokens/components order after legacy styles, and body.field-kit. Keep the existing game-shell class and modal/input ownership. Use Exo 2 for controls and instructions, Handjet for static display titles at least 40px, and Plex Mono for aligned counters. Cover focus, pressed, selected, disabled and error states. Preserve 44px targets, Large text and readable canvas plates. Test the real nested return route and confirm that closing a menu does not resume a flight.

## Validate and compile a collection

> Import the attached `.rltheme` through the current `game/presentation/bundle.mjs` validator. Preserve original payload bytes and every immutable record; reject missing required members, dependencies, stale revisions, malformed frames/rotor anchors and conflicting hash facts before adoption. Resolve the selected FPV theme and collection through the shared compiler. Compile to a new `.cache` directory using `node scripts/compile-presentation.mjs --bundle candidate.rltheme --out .cache/fpv-collection-review`. Report source/produced/reviewed coverage honestly. Inspect decoded images at native size, English/Ukrainian font specimens and affected gameplay screens before recording review evidence. Keep historical owner pins and player storage unchanged. Submit the complete source, provenance and generated runtime manifest through the exact-source release workflow; a browser upload alone is never a public release.

## Use the local Asset Studio

> Open `authoring/asset-studio/`, choose the exact slot and inspect its requirements and current original. Use New variation, Edit current asset or Replace collection to copy a complete brief. Upload or create a sprite, prepare an exact frame, validate geometry and provenance, then compare native and field previews. Stage the replacement, save a local immutable revision, and export `.rltheme`. Use Asset revision history → Bind this revision to restore an earlier asset without deleting its successors. Keep review evidence concrete and distinguish a produced candidate from a reviewed asset. Import must remain atomic, reject stale edits, and preserve every original byte; the public game changes only through a compiled GitHub release.

## Preserve title and mission flow

> Extend the implemented five-action title and mission gallery using `field-kit-flow.css`, `game-shell.mjs` and `mission-gallery.mjs`. Preserve saved continuation destination, mission selection/page, lock reasons, earned-picture privacy, medals and controller return focus. Keep one Deploy action in preparation, device-aware hints and the existing held-input protections. Use the prepared landscape/portrait scenes, real DOM text, and shared typography. Inspect desktop six-card paging, tablet two columns, narrow single column, Large text, and the short-landscape setup panel. Store source art unchanged; new scene derivatives require exact dimensions, crop/sampling metadata, source/derivative hashes and release verification.


## Keep optional chapters independent of authoring and Couch

> Review the current build's declared optional chapters without changing their original bytes or the 64 MiB core limit. Reject a required startup dependency on an unavailable optional Arcade R5 request. Verify Couch can still start and pause a base map and can read an explicitly installed chapter through its existing exact-original reader, without changing solo progress. In Asset Studio, preserve the declared generic context when optional fixture metadata is unavailable; complete exact-owner inputs should fetch no unrelated pack, and incomplete owners must report unavailable. Test rejected requests and HTTP failures, preserve online behavior, and report generated-cache verification separately from native offline play. Never rewrite a frozen release to apply this integration fix.
