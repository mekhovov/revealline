# Versioned presentation and asset framework

The framework describes and transfers a complete visual configuration independently of game rules, campaign identity, saved flights and earned pictures. It does not modify the older `xonix-themes.v1`, pack or replay transports. The first production scope is FPV; other worlds retain catalog coverage without requiring three new art collections.

`game/presentation/catalog.mjs` supplies 293 semantic slots: 138 shared screen, control, font, audio and FPV component slots plus 155 exact current map/world picture owners. The 56 FPV picture-owner slots are required for the FPV scope; the other picture owners are optional. The source inventory includes the base campaign, active and playable archive pack indexes, optional chapters and external chapters. `inventoryCurrentPictures()` in the compiler rebuilds the owner list, and its regression check rejects an outdated `current-pictures.mjs` snapshot. These are ownership slots, not 155 newly made pictures or unique layouts.

Every default binding is explicitly a **source-stage registered component**. This establishes complete configuration coverage, not finished artwork, uploaded fonts, working recipe adoption, listening approval or browser qualification. `presentationCoverage()` reports missing, source, produced and reviewed slots separately. A reviewed stage requires explicit evidence, which remains a recorded claim to inspect, not automated artistic approval. Recipe assets cannot claim to be produced raster/audio work.

## Records and APIs

`model.mjs` exports `FORMATS`, `LIMITS`, the registered recipe IDs, token defaults, the individual record validators and these operations:

```js
const document = createDefaultThemeBundle();
const accepted = validateThemeBundle(candidate, {
  previous: document,
  expectedRevision: document.revision,
});
const resolved = resolvePresentation(accepted, {
  themeId: 'fpv',
  collectionId: null,
});
const draft = {
  format: FORMATS.draft,
  baseRevision: accepted.revision,
  tokens: { textSize: 22 },
  bindings: {},
};
const preview = resolvePresentation(accepted, { draft });
const successor = proposeDraft(accepted, draft, {
  expectedRevision: accepted.revision,
});
```

These functions return owned, deeply frozen data and do not write storage. Optional arguments must be omitted rather than represented by `undefined` in imported JSON. Theme IDs are stable identifiers rather than an enum of four worlds.

| Record            | Required fields                                                                                                                                                                                                          |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| ThemeBundle       | `format`, `id`, `revision`, `slots`, `assets`, `themes`, `collections`, `selection`                                                                                                                                      |
| PresentationTheme | `format`, `id`, `revision`, `name`, `parent`, `tokens`, `bindings`                                                                                                                                                       |
| AssetSlotSpec     | `format`, `id`, `revision`, `label`, `group`, `screens`, `kinds`, `recipes`, `required`, `dimensions`, `alpha`, `sampling`, `states`, `requirements`, `prompt`, `budget`, `palette`, `geometry`, `dependencies`, `owner` |
| AssetRevision     | `format`, `id`, `revision`, `kind`, `description`, `provenance`, `file`, `recipe`, `geometry`, `quality`                                                                                                                 |
| AssetCollection   | `format`, `id`, `revision`, `name`, `themeId`, `requiredSlots`, `bindings`                                                                                                                                               |

References are always `{id, revision}`. Selection holds exact `base` and `theme` references plus `collection: null` or an exact collection reference. A theme's parent is `null` or an exact reference. Tokens are a closed list of bounded colors, safe font family names and numerical presentation settings. Bindings map semantic slot IDs to exact asset references. A collection must supply its entire declared required set before any of it can resolve.

Resolution order is base inheritance, selected theme, selected collection, then local draft. Required slots and dependencies must resolve. `proposeDraft` creates a new immutable theme revision and advances the document once; if a collection was active it materializes the collection plus final draft into that successor and leaves the old collection unchanged. The storage owner must compare the expected document revision again inside its transaction. A successful pure-data preparation does not reserve a storage revision.

Validation against `previous` retains every earlier slot, asset, theme and collection record exactly, permits only the next revision of an existing identity, and advances the bundle by one. Current v1 slot specifications are immutable; a changed slot contract needs a new stable ID. Derivative parents must exist, and dependency/derivative/inheritance cycles fail. Imported executable properties, prototypes, accessors, arbitrary recipe IDs, source file paths and arbitrary CSS are not accepted as runtime instructions.

## Geometry, sources and review

An image asset has `file: {sha256, bytes, mime, width, height}`, `recipe: null` and this geometry:

```json
{
  "frame": { "x": 0, "y": 0, "width": 32, "height": 32 },
  "pivot": { "x": 0.5, "y": 0.5 },
  "occupiedBounds": { "x": 0.125, "y": 0.125, "width": 0.75, "height": 0.75 },
  "rotorAnchors": [],
  "nineSlice": null
}
```

Frame coordinates are integer source pixels. Pivot, occupied bounds and rotor anchors are normalized **inside the selected frame**. A rotor anchor contains `{x, y, radius, blades}`; its entire rotating envelope must fit the frame. `imagePresentation()` converts anchors into the existing center-relative rig convention without modifying presets or contact radii. Nine-slice borders are `{left, top, right, bottom}` in pixels and must leave a nonempty center. An explicitly bounded static frame can select artwork from a sheet, but this format provides no animation timeline or frame-sequence playback.

Slot dimensions constrain the selected frame, while the original file can contain a larger bounded image. Geometry validators check bounds, dimensions, required motor counts, nine-slice presence and per-slot byte budgets. Occupied bounds and palette declarations support review; hashes and metadata do not prove actual alpha coverage, palette fidelity, readable silhouettes or correct motor placement. The sprite editor/real rendered preview must measure and inspect them before recording review evidence.

Nonimage assets use `geometry: null`. Recipe assets use `file: null` and `recipe: {id: registeredRecipeId}`. File assets use `recipe: null`. A font or audio file has null width/height. Provenance is `{creator, source, license, prompt, parent}`, where parent is null or an exact prior asset reference. Quality is `{stage: 'source' | 'produced' | 'reviewed', evidence: []}`. Originals remain immutable; editing creates a new asset revision or a parent-linked derivative. A new derivative's alpha, crop and anchors must be rechecked.

The model limits metadata to 2 MiB, transfers to 32 MiB, individual files to 4 MiB, images to 1920 pixels per side and 2,073,600 total pixels. Slot budgets can be lower: small sprites default to 128 KiB and fonts to 2 MiB. The exact saved-picture pipeline additionally retains its own 1920×1080, contain/nearest contract. New FPV art needs asset/presentation revisions, not new map or campaign identities. Owner slots are authoring destinations, not an automatic rewrite of existing saved/earned picture pins.

## Transfer, compiler and runtime seam

`exportThemeBundle(document, Map<sha256, Blob>)` creates a `.rltheme` Blob containing an `RLTHM1` header, bounded canonical manifest and sorted original byte payloads. `importThemeBundle(blob, {decodeImage, previous, expectedRevision, signal})` returns `{document, assets, imagesDecoded}` only after complete validation. Payload hashes, byte counts, declared formats, dimensions, duplicate entries, truncation and trailing bytes are checked; the manifest never supplies fetch URLs or executable code. By default imports use actual browser image decoding. Nonbrowser callers must inject a decoder or explicitly select header-only validation with `decodeImage: null`, whose result is not marked decoded. Font loading, alpha measurements and audio playback are separate checks.

`compilePresentation(document, assets)` in `scripts/compile-presentation.mjs` deterministically returns a file map with `runtime.json`, `theme.css`, `manifest.json` and selected hash-named `assets/<sha256>.<approved-extension>`. Historical/unselected originals stay in the authoring bundle instead of being copied into the player output. No timestamps, arbitrary source paths or executable content enter compilation. The current CLI reports structural/hash/header qualification; browser review remains necessary.

```sh
# Read-only compile/check of the default registry:
node scripts/compile-presentation.mjs

# Emit a new review artifact; existing directories are never overwritten:
node scripts/compile-presentation.mjs --out .cache/presentation-review-1

# Explicit local manifest and content-addressed originals:
node scripts/compile-presentation.mjs --manifest candidate.json --assets originals --out .cache/presentation-review-2

# Prepare an exported Studio bundle for review using the same validator:
node scripts/compile-presentation.mjs --bundle candidate.rltheme --out .cache/presentation-review-3
```

The CLI accepts only ordinary bounded input files. Output is restricted to a new directory under the project's `.cache`; files are exclusively created and asset names are derived from verified hashes. The export is a preparation artifact: it does not publish defaults, mutate Git, upload originals or edit the public game. Integration into the release build requires the normal explicit build allowlist and deployment gates.

`presentationCSSVariables()` maps tokens to the shared `--fk-*` Field Kit vocabulary and existing palette aliases. `canvasPresentation()` supplies the equivalent renderer palette and selected immutable asset descriptors. `applyPresentation()` applies a fully computed style set and returns cleanup that preserves later unrelated changes. These adapters own presentation only; host adoption, image URL lifetimes, cancellation, glyph loading and actual rendering remain host responsibilities.

`inspectProductionAdapter()` provides a validated read-only projection of the existing production-register v1 document and its slots/history. It does not mutate that register, translate its approvals into new approvals or load its referenced files.

## Verification

```sh
node --test game/test/presentation-system.test.mjs
node node_modules/eslint/bin/eslint.js game/presentation/model.mjs game/presentation/catalog.mjs game/presentation/current-pictures.mjs game/presentation/bundle.mjs game/presentation/runtime.mjs scripts/compile-presentation.mjs game/test/presentation-system.test.mjs --max-warnings 0
```

Tests cover owner-inventory freshness, complete/default and future-theme resolution, strict data boundaries, geometry and budgets, stale writes, immutable histories, collection atomicity, byte-preserving transfers, corrupt/missing/trailing payloads, decoding/cancellation, theme-to-CSS/canvas mapping, source-versus-production counts and deterministic compiler paths. They use explicit decoder fixtures; they do not establish native-browser art quality or deployment.

## Exact current-art preview

`current-art.mjs` and generated `current-art-sources.mjs` connect all 155 owner slots (56 FPV) to 62 actual procedural scenes and 93 pinned originals. The read-only adapter loads only after an explicit preview request and accepts cancellation. Local original PNGs are hash-checked; a missing local source can fall back to the corresponding validated built-in/optional pack or registered external pack and paired media. User bundle fields never select fetch locations. Unavailable originals remain unavailable, and external descriptors without board geometry do not invent it. This adapter does not open player or studio databases. Regenerate trusted locators with `scripts/generate-current-art.mjs` when the code-owned catalog changes and run its freshness tests.

The format permits up to 1,024 immutable theme revisions within the 2 MiB manifest budget. Studio successors can inherit their exact predecessor and retain only changed tokens/bindings, rather than duplicating a full collection in every historical record. The source-stage inventory remains a foundation: production defaults and player runtime adoption follow in the FPV presentation phase.
