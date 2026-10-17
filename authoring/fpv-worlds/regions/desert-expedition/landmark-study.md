# Desert Expedition: close-range rock compositions

This is a separate `landmarks-r1` source revision of the existing 16.384 × 16.384 km natural terrain study. All 2,048 terrain payloads, the lattice, and the six authored starting poses remain byte-identical to `natural-r1`. It adds close-range practice features near those starts; it does not claim that the whole landscape is populated or finished.

The six compositions deliberately offer different lines:

| District | Composition | Flight study |
| --- | --- | --- |
| Crescent dunes | Three unequal windstones and a low foot rock | A low weaving line that keeps the dune horizon open |
| Dry wash | Unequal bank-side towers and downstream talus | A rising passage with a clear approach and exit |
| Salt basin | One isolated pale natural arch and two cairns | A straight opening crossing above the flat playa |
| Sunrise escarpment | Staggered ribs following the toe slope | A climbing weave between unequal silhouettes |
| Mesa corridor | One broad broken crown with separate step and talus | A five-point orbit with a clear outside margin |
| Rocky plain | Four individually spaced tors and low scree | A close-range slalom beyond the terrain's broad saddles |

These are authoring clearance/flight studies, not scored missions or a player autopilot. The original broad terrain routes remain available. No Library pin, immutable delivery or existing saved revision is replaced by this source change.

## Source and licensing

The rock triangles come from loafbrr's [Canyon terrain asset](https://opengameart.org/content/canyon-terrain-asset), published under CC0. The already-preserved source and license receipt are in `../canyon-badlands/source/`. Exact GLB: 945,596 bytes, SHA-256 `0b24bb22f0089767990d58401e516ec1853380eda6a33802036a377f8519d623`. Only named visual meshes are used; collision proxies, Godot add-ons and preview HDRI are excluded.

The generator centres, scales and rotates those triangles, quantizes to integer millimetres, and uses the same positions/indices for the canonical scenery GLB and collision payload. Composition colours intentionally replace the source palette; no texture or source-shading preservation claim is made. The formations use single restrained colours rather than repeated artificial height bands. Their base planes are below every enclosing 16 m terrain sample, without flattening or displacing terrain.

## Reproduce and verify

Use Node with authoring-only `@gltf-transform/core@4.5.1` and `gltf-validator` available. No package or runtime dependency is added by this source preparation.

```sh
node authoring/fpv-worlds/regions/desert-expedition/prepare-landmarks.mjs NATURAL_SOURCE NEW_OUTPUT
node authoring/fpv-worlds/regions/desert-expedition/verify-landmarks.mjs NATURAL_SOURCE NEW_OUTPUT > NEW_OUTPUT/landmark-verification.json
node authoring/fpv-worlds/regions/desert-expedition/verify-desert-flight.mjs NEW_OUTPUT landmarks
```

The generator refuses an existing output directory and verifies the original terrain manifest hash. Six populated scenery cells use the existing explicit sparse companion contract; the other 1,018 cells remain verified empty. No runtime limit is widened. Payload and manifest bytes total 47,835,247; the generator also reserves 1 MiB for a future descriptor beneath the unchanged 64 MiB delivery ceiling.

The source verification checks all retained terrain bytes, canonical GLBs, exact collision, original and new route margins, all starting points, grounding, exposed rock contacts, local geometry budgets and disposal. Controlled-command verification uses the production session in Self-level and Acro, including settling, pause isolation and deliberate rock contacts. Measurements are in the adjacent receipts; native art acceptance and package/Library admission are separate gates.

## Appearance review

Use the existing authoring scenery preview with `views=desert-landmarks`, `ground=desert`, `lighting=urban`, the new scenery manifest and its terrain companion. This exposes six close-range views; it does not alter production camera or flight controls. The opt-in Desert terrain treatment remains unchanged.

Remaining quality work includes native composition review, better regional density where justified by flight routes, and any additional scenery refinement that review identifies. This is a bounded composition increment, not a final realism, endless-world, device-FPS or hours-of-varied-play claim.
