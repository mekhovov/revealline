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

Source-capacity PR #1085 merged normally as `5bd8f36d7767dcd9dda740865b4d8f19ddbe7c28`; this capability is an independent follow-up on main. The helper is authored in
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

Candidate `b51e17a83f2d3aad99f7076c3e0ae84f1122aeda` integrates the updated capacity
parent `63fbe26be3ecde48a13e9c0ef8f3c7fff2fa8956`, including current Library main.
The capability files remain byte-identical to the reviewed runtime-only source;
the three static entry closures are still unchanged. Full Node 22 validation and
all three source-bound package admissions pass with two byte-identical builds.
Worlds retains 102 members and 95 original inputs, totaling 16,739,037 source
bytes with 38,179 bytes below the unchanged 16MiB ceiling. The admitted-path
addition is 3,399 bytes after the existing lexical projection.

The existing content/Theme checks pass 29 and the texture-loader checks pass four.
The first texture-file invocation could not start because two authoring fixture
assets were absent from the sparse checkout. Exact Git-hash APFS copies restored
those files; that affected file alone then passed. Both logs are retained, along
with all original admission manifests, inventories and checksums under
`evidence/qualified-b51/`. No new unit coverage was added.

The complete admitted player is staged through 90 immutable links and 1,689,021
new bytes, with no source overlay. Its fixed-camera fixture uses the unpublished
r14 required-extension model and accepted r11 comparison model; those content
files are not part of this runtime change. Nine actual packaged-renderer views
pass the bounded visual review with no errors and successful resource disposal.
Inspected overview/grazing, low/high approach, Pixel/shared replacement and
landing views show no depth fighting. The two exact poses shared with the
historical r13 prototype (close FPV and overview) retain identical pixel hashes;
the other views are not described as matched parity. This is not complete-world
art or hardware acceptance. The unmodified admitted player's visible Library
chooser then installed the exact required pack as eight challenges. Rock terrace
climb opened Ready, deliberately armed to Flight active, paused, continued and
paused again. This is an import/render/control check, not course completion or
offline qualification. An initial hidden-input targeting timeout was a tool
interaction issue; the normal visible chooser succeeded.

Protected publication remains pending. The older direct-loader prototype and its
rejected prepare-boundary assumption are preserved separately
at `530ad2d9606c9b5493e1dbfbf7e64b51d9339ab3`.

## Current-main integration

Candidate `364fb78c3dc7e268b84b0a13349af32864bca802` normally merges that current main. Of the 95 original admitted inputs, 93 retain their b51 bytes. The renderer adds only the already-qualified context-loss guard (+98B); the host adds the paused first draw and preserves ghost visibility in Settings (net +218B). The incoming changes equal main exactly, and every coating-specific line and other capability module retains its reviewed bytes. Collision, recordings, material ownership and the coating appearance path are unchanged.

The integrated manual contract passes 87 checks, the existing content/Theme/texture files pass 33, and the generated visual projection is byte-identical to its canonical source projection. Fresh all-three package admissions verify committed inputs, ZIP members and two identical builds. Worlds remains 102 files / 95 inputs, totaling 16,739,353 raw source bytes with 37,863 bytes available. Small build-startup failures from missing sparse build dependencies are explicitly retained; exact Git-hash/APFS source materialization resolved them before the successful build. See `evidence/integration-364/manifest.json`.

The earlier complete validation and actual admitted nine-view/native import evidence remain historical b51 receipts, not re-labelled as a new current-main browser run. No new full validation or full browser matrix was needed for the disjoint, independently-qualified incoming changes. The first locally admitted capable sources are b51 and364; public deployment support remains pending until protected publication and public verification.
