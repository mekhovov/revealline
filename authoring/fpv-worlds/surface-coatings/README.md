# Required opaque surface coating

This bounded material capability supports an opaque decorative finish over an
existing physical face. It introduces no collision, transparency, geometry,
material owner, texture, batch or style. Asset revisions using it are separate
content changes and must be independently qualified.

The glTF material must contain exactly:

```json
{ "extensions": { "REVEALLINE_surface_coating": { "version": 1, "kind": "opaque-finish" } } }
```

The document must list the name exactly once in both `extensionsUsed` and
`extensionsRequired`. Only opaque materials on triangle, triangle-strip or
triangle-fan primitives qualify. Base-color alpha must be one and transmission
zero. Unknown keys, versions, kinds, missing/duplicate markers and alpha modes
fail validation. Imported data cannot supply numeric renderer state.

The shared pure validator lives in existing `world-themes.mjs`. It runs at import,
before actual GLTF scene construction and before offline NodeIO transformations.
The last boundary matters: NodeIO otherwise drops unregistered material payloads
when `extensionsUsed` is missing. The adapter preserves the one canonical payload
and its required status through deduplication and preparation.

The loader uses its own material associations, including cloned flat-normal and
vertex-color variants. It sets only `polygonOffset=true`, factor `-1`, units `-1`
on existing opaque materials retaining depth test/write. Theme variants preserve
these three values and include them in their cache identity. Original and Theme
material owners retain the existing disposal path. Unmarked materials retain
their defaults. Existing shadow-depth materials are unchanged; no custom shadow
material or shadow state is introduced.

Older hosts reject the required extension. They must not be instructed to strip
the marker or treat an unknown `extras` hint as support. The first capable
admitted/published host revision must be recorded before advertising compatible
content. The historical Reservoir r13 source preview established the bounded
appearance of the same fixed bias, but is not a package or final required-asset
qualification. No Reservoir asset is published by this runtime change.

The branch depends on source-capacity PR #1085. The helper is authored in
`world-visuals-source.mjs`; the existing admitted `world-visuals.mjs` is refreshed
with `scripts/refresh-fpv-world-visuals.mjs`. No file allowance or size ceiling
changes. Static entry closure remains exact against the capacity parent:
civilian-flight 25 modules, Academy 45, Worlds 69. Academy does not import
Worlds-only content/definitions.

The manual qualifier uses a tiny original triangle fixture with shared and plain
materials. It exercises the actual GLTF loader, offline preparation, legacy
refusal, pack/ZIP round trips, Theme sharing and exactly-once disposal. Its 87
checks pass on the capacity-based source. No browser, hardware, flight or package
admission claim follows from that CPU result.

```sh
node authoring/fpv-worlds/surface-coatings/qualify.mjs LEGACY_PLAYER NEW_OUTPUT_DIRECTORY
node scripts/refresh-fpv-world-visuals.mjs --check
```

Full validation, all-three source-bound package admission, supported-player
WebGL checks and publication remain pending. The older direct-loader prototype
and its rejected prepare-boundary assumption are preserved in the separate
Reservoir branch at `530ad2d9606c9b5493e1dbfbf7e64b51d9339ab3`.
