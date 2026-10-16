# Team relay equipment artwork

Five original pixel sprites replace the generic Team anchor/core decorations in the FPV production collection. Their integer-pixel source is `game/presentation/team-equipment-art.mjs`; `scripts/produce-field-kit-theme.mjs` encodes the PNGs and records source hashes, bounds, provenance and immutable revisions.

| Slot                    | Frame | Readable state                              |
| ----------------------- | ----- | ------------------------------------------- |
| `team.anchor.available` | 24×24 | Raised amber mast, receiver, three feet     |
| `team.anchor.captured`  | 24×24 | Lower mast, two cyan ports, side couplers   |
| `team.core.shielded`    | 64×64 | Raised antenna, closed protective shutters  |
| `team.core.exposed`     | 64×64 | Open side shutters, three amber signal bars |
| `team.core.secured`     | 64×64 | Folded antenna, cyan service windows        |

These are stationary radio equipment, not flying enemies or ordinary pickups. Silhouettes change with state; colour is supplementary. Assets use binary transparency, a transparent outer margin, a centered pivot, no rotors and only the registered Team slot palette. Frames describe artwork, not collision or capture geometry.

The painter retains anchor boundaries, labels and core warning outlines. Authored core images receive a thin center ring instead of the old opaque dot, which obscured their shutters and signal stack. Recipe and historical presentations retain their dot. Labels remain live game text. Completed-field picture presentation intentionally hides objective bodies; inspect the secured body in Native size as well as the underlying secured-state painter test.

## Production and review

Generate through the existing production command and explicit Team history adapter. Do not rewrite historical records or copy a local preview's provisional theme revision into a release. Regenerate the final merged collection, verify original picture payloads, and admit its exact revision through the existing artwork review process.

These five assets enter as **produced**, not automatically reviewed. Other Team recipes keep their independent source/review state. Review native pixels plus 16/20/24/32 CSS-pixel specimens over dark and light backdrops; inspect Relay Yard initial, anchors captured, core exposed and completed states in Studio and actual play. Check reduced effects and short landscape separately. Retain the warning outline and SHIELD/CAPTURE/SECURED labels. Physical-device checks, full simulation compatibility, offline preparation and public release qualification remain separate acceptance evidence.

Tests check exact slot palette, alpha, dimensions, byte budget, independent PNG decoding, deterministic output, distinguishable silhouettes, production bindings, immutable history and nonmutating painter behavior. A green asset test is not approval of the complete Team theme.
