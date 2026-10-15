# Canyon arrival region: commanded flight and immutable delivery

This increment qualifies the accepted rounded Canyon terrain and licensed landmark
composition through the production regional session, then preserves its exact source
pair in an immutable delivery. It adds no Library row and changes no runtime physics,
source mesh, collision surface, flight rule or material.

## What the region contains

The delivered pair is **384 × 384 m**, a complete 3 × 3 grid of 128 m cells in each
layer. The separate original 768 × 768 m terrain study is preserved but is not part
of this bundle. Twenty-seven licensed rock formations and their grounded smaller
landmarks surround the arrival basin, gorge, twin spires, needle bend and ridge crown.
The approved rounding is from #1271; the existing sediment material from #1274
remains a separate trusted runtime presentation choice. Rejected earlier drainage
experiments remain preserved and are not used.

The source remains deliberately stylized and visibly coarse in places. This is a
bounded representative preview, not a finished realistic landscape, an 8 km region,
or evidence of hours of uninterrupted flight.

## Actual flight verification

`verify-commanded-flight.mjs` pins both exact source manifests and uses
`createRegionalSession`. It submits normal quantized controls through the existing
response curve and production physics. It never changes pose, velocity or attitude
during flight. Controlled scenario starts are explicit; the single authored basin
spawn is separately checked in both modes.

- Fourteen routes pass: basin circuit, gorge approach, twin-spire climb, ridge arch,
  ridge skyline approach, needle passage and arrival landmarks, each in Self-level
  and Acro.
- The route set advances **34,798 actual physics ticks with zero contacts**. Whole
  polylines retain one session across successive waypoints. The basin performs
  six in-flight origin changes and the gorge two in each mode without becoming inactive.
- Maximum measured cross-track error is 0.388 m; height error is 0.334 m. The
  verification pilot explicitly anticipates the four-metre climb between the spires;
  the original flat-route pilot initially lagged that climb and was corrected
  without weakening the corridor bound or changing flight physics.
- The ridge opening is flown at 85 m. A separate 89 m flight hits its solid crown;
  the twin-west rock also stops commanded flight. These four solid-contact cases
  check both modes and retain the approach-side position.
- Both authored-start cases remain paused with zero ticks/contacts. Arming before
  preparation fails. Pausing retains the entire snapshot, and disposal releases
  all owned geometry and textures.

The existing source verifier also passes unchanged: 18 canonical GLBs, 2,247
clearance sweeps, 27 grounded formations and 27 real rock hits. The verified pair
uses 673,464 geometry bytes. The complete visual and collision source bytes remain
identical to the accepted rounded source.

## Immutable delivery

Path: `authoring/fpv-worlds/regions/canyon-badlands/delivery-rounded-r1`.

- Strict format `FPVRegionalDelivery.v1`; identity
  `canyon-arrival-landmarks-study`, delivery revision `rounded-r1`.
- Descriptor: **6,790 bytes**, SHA-256
  `5cd92029c88179e94231b4ec4f799372b075cd187421e9feec3fb6ee2eabf6d0`.
- Payload: **38 files / 1,173,350 bytes**, or **1,180,140 bytes including descriptor**.
- Terrain manifest SHA-256:
  `9fad494a6dc1e974695e9fa218b99e74f1676d2589303c7ececea8728b106239`.
- Scenery manifest SHA-256:
  `a72ba600c11eba60486b645ca40967802498deb28e46dece02b10b3f04e0c30f`.

The actual runtime downloader verifies all 39 descriptor/payload responses through
a local file adapter. Each payload is byte-compared with the accepted source. The
existing preparation boundary suite covers deterministic output, corruption, unsafe
paths, invalid UTF-8, mismatched paired identities/cells/spawns and preservation of
existing output. Its generic fixture retains its historical Urban descriptor ID;
the separate Canyon runtime check verifies the actual Canyon descriptor above.

The CC0 source receipt and original upstream notice are preserved beside the
payload, together with source and commanded-flight evidence. Only the descriptor's
declared closure is downloaded; no undeclared texture, HDRI or Godot addon is used.

## Remaining admission gates

Normal Library discovery and trusted Canyon presentation require a separate exact
descriptor pin. Native combined-player download, storage/reload, deliberate flight,
pause/recovery and exact package checks must precede admission. This source proof
does not replace those checks or establish device FPS, GPU completion, offline
availability, browser-restart recovery or long-session endurance. All existing
delivery, residency and player-package budgets remain unchanged.
