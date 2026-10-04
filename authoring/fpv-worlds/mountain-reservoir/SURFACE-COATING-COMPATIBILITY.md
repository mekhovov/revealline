# Fixed opaque coating capability (v1)

The visually accepted source prototype is frozen at
`024022adfedceb374a7f7e1667182ae5a663990b`. Its runtime helper is isolated in
`3c7fb413380835937d0ca211ed5ef36d04b223fc`. Neither commit is an admitted or
publicly deployed host revision. The candidate must not be advertised as
compatible with the older 248b admitted host underlying the static fixture:
that fixture explicitly replaces two renderer modules.

The accepted r13 extras prototype is superseded by one canonical material
extension payload in the r14 compatibility candidate:

```json
{
  "extensions": {
    "REVEALLINE_surface_coating": {
      "version": 1,
      "kind": "opaque-finish"
    }
  }
}
```

A capable host accepts only those two payload keys/values, on opaque materials retaining
depth testing and writing. It applies fixed polygon offset factor/units -1/-1.
No imported numeric state, transparent rendering, new collision or change of
physical surface is implied. Theme replacements preserve the fixed bias and
its ownership. Untagged materials remain unchanged.

The document must list `REVEALLINE_surface_coating` exactly once in both
`extensionsUsed` and `extensionsRequired`. Marked materials may be used by
triangle, triangle-strip or triangle-fan primitives; point/line coatings are
rejected. `alphaMode` must be absent or `OPAQUE`, base-color alpha must be one,
and transmission factor must be zero. Unknown versions/kinds, extra fields or
missing/duplicate capability declarations fail validation. Numeric depth state
cannot be supplied in the payload. The old `extras` hint is no longer a runtime
interface; its immutable r13 fixture remains historical.

## Import, preparation and host support

An older host ignores unknown glTF extras and would still import this pack. Its
canonical terrace faces and decorative finish can therefore fight at distant
depth precision. Documentation alone cannot make that degraded behavior safe to
call compatible. The current FPVWorldProject.v1/FPVWorldPack.v2 schema has no
enforced minimum-host capability field.

The implementation uses the existing unknown-required-extension refusal path.
`validateWorldSurfaceCoatings` is the shared schema validator for import and
actual loader boundaries. The loader plugin resolves material identities through
its own associations, including flat-normal/vertex-color clones, and applies the
fixed finish before Theme replacement. It does not merely silence an unknown
extension warning. The offline glTF-Transform adapter retains the same material
extension through deduplication and preparation; there is no second extras copy.

The validator lives in the existing pure `world-themes.mjs` module, shared by
Academy and Worlds. The first compatibility prototype imported `world-content`
from the renderer; review caught that this would pull Worlds-only authoring
dependencies into Academy. The corrected tree preserves the exact transitive
module lists for all three entries: civilian-flight 25, Academy 45 and Worlds 69.
Academy still does not reach `world-content` or `content-definitions`. This
static import audit is distinct from the pending all-package admission. The
corrected runtime touches four existing files; the earlier generated build
receipt's three-file count is historical metadata and is not an admission claim.
The corrected shared-module implementation passes the same 63 manual contracts;
both receipts are retained.

This is a qualified CPU prototype, not an admitted or published host. It adds no geometry,
material, map, batch or new visual style. The required marker changes asset and
pack identity, so final sixteen proofs must bind to that final identity. The
accepted r13 source fixture and its exact old identity remain historical proof
of the rendering appearance, not proof of the final import gate.

The current manual pass checks 63 contracts using the real GLTF loader: PBR and
unlit material association, vertex colors, malformed/unknown declarations,
opaque-only handling, Theme sharing and exactly-once disposal. The historical
248b host rejects the actual source/prepared GLB, `.rlpack` and editable ZIP with
`Unsupported required extension: REVEALLINE_surface_coating`. Current import,
export and reimport retain exact prepared bytes and the complete project. The
unmarked r11 source still prepares to its exact accepted 1,209,268-byte GLB
`c1e38623b8c982dff083ddbf5c73e5befc906571a4e69fc5980dd1e0e47d463b`.

The r14 source is 1,236,672 bytes, with the complete r13 geometry/image binary
payload unchanged. Its candidate pack identity is
`98dc5237b8e809029a0c08f414f36689c7a58313f911a84971d3ed0429477714`.
The independent face/asset qualifier passes 562 checks. Fresh sixteen proofs,
actual final host import and package admission remain pending the separate
source-capacity prerequisite and the assigned qualification lane.

Before publication, record the exact first admitted capable host SHA and published
release in the distribution README. Link the previous r11 pack as the explicit
older-host alternative; never suggest that unknown extras implement the finish.
Library discovery must not claim the new revision works in an older host.
The legacy generic rejection may suggest offline preparation, but preparation
must preserve the required marker: stripping it is not a compatibility repair.

The helper does not change alpha, depthTest/depthWrite, shadowSide, castShadow,
receiveShadow or geometry. Its three fixed polygon-offset fields apply to the
marked visible material. The pinned Three shadow renderer creates its existing
depth/distance materials and does not copy those three fields from the visible
material; no custom shadow material is introduced. Actual grazing/shadow views
remain the evidence for appearance, separate from that source audit.
