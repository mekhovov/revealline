# Appearance runtime continuation — 2026-10-02

This pass continues draft PR #955 from `5fbceaae5c9544af69f570f3a29771b42362aba2`.
It closes specific runtime and recovery gaps from the
[previous continuation](../appearance-continuation-2026-10-02/README.md).
It does not complete the whole-game redesign or qualify a release.

## Completed

- **Distant gate cues:** compatible SIM collections show paired light/dark corner
  brackets on the active gate. They sit outside the existing frame, extend at most
  120 mm outward and leave its aperture, position and physics unchanged. The
  geometry is static, depth-tested and shared. Authored appearance retains its
  original gate. See [implementation and checks](sim-gate-cue-review.md).
- **Embedded World textures:** the shared GLTF loader now decodes images through
  the existing image permission. Failed textures reject the candidate scene
  before replacing the accepted scene. Flight, spatial editing and the marking
  viewer share this path; no security policy or vendor file changes were needed.
  See [runtime and package checks](world-texture-runtime.md).
- **Replay recovery:** import feedback appears beside Verify, using shared danger
  styling and one live announcement. Hidden Cancel controls restore focus safely;
  phase, pending status and Escape guidance update with the language. The source
  tests cover delayed success, failure, cancellation and newer-focus ownership.
  See [the scoped review](replay-recovery-review.md).
- **Independent asset inspection:** the exact retained marking GLB rendered in
  Khronos' independent viewer with zero validation errors or warnings. Ordinary
  rendering preserved the masked pad corners; base-color inspection showed the
  five-step calibration wedge. This is a static comparison with different
  lighting, not a matched-exposure or flight-distance qualification.
  See [the renderer receipt](independent-marking-render.md).

## Actual browser evidence

The SIM fixture verifies 35 files, including the working changes over the source
HEAD above. Its source digest is
`b432063ee5d9107dc88b8e0e2b3f2655f14a209ae81b712ea1ddad29a91e2562`.
In the Training Hangar, the distant Dnipro gate corners and active number were
discernible at Low, Balanced and High. Industrial passed the near/far Balanced
inspection, with all corner marks outside its aperture. Switching to Authored
removed the new marks. These are bounded fixed-view judgments, not all scenes.

The idle authored → theme → theme → authored Balanced comparison passed both
pairs: themed p95 **10.3 ms**, authored **10.3 / 10.2 ms**, ratios **1.000 / 1.010**.
[The full receipt](sim-gate-balanced-timing.json) retains resource counts and
explicitly leaves physical-device and GPU timing qualification open. No other
WebGL fixture or heavy local checks ran during this measurement.

The prepared World-package inspection loaded the retained embedded PNG in both
the actual renderer and spatial editor. Authored, Industrial and Dnipro views
preserved the explicitly unbound imported markings. Corrupt-image rejection and
pending cancellation retained the accepted scene; exact reload recovered.
[Runtime observations](packaged-texture-runtime.json) record unchanged original
course data and resource counts. This imports an isolated test asset; it does
not bind the kit into an installed collection or run a flight proof.
The first combined check found that this new inspection page lacked the shared
theme bootstrap. That was corrected without exempting the page. A second
immutable fixture adds only the bounded shared inspection chrome; its actual
World package revision remains identical. The themed page then loaded the exact
texture successfully at 390-pixel width with no horizontal overflow. The
[final-page receipt](packaged-texture-shared-chrome.json) and
[screenshot](packaged-world-shared-chrome.png) record that follow-up.

Replay `{}` rejection kept Verify focused and input intact. The error was visible
next to Verify at 1280×720 and 390×844, with no narrow horizontal overflow.
Changing to Ukrainian updated the message wrapper and phase. Loading the example
recovered; stepping reached tick 1, and Escape paused and focused Return to
Workshop. Validator diagnostic details remain in English. A real malformed
Studio file import also kept both workspaces and file-input focus; Reload saved
recovered with Undo/Reset disabled. No Studio production change was needed.

English and the normal viewport were restored. Existing access gates and content
security policy were kept. Saved screenshots show actual browser output.

## Automated checks

The initial 49-file cohort passed 408 of 409 cases, exposing only the new
inspection page's missing shared bootstrap. Its output is retained as
`focused-tests-initial.tap`. The final rerun passed **409/409** cases across all **49 files**, with zero
failures, skips or cancellations. `checks.json` and `focused-tests.tap` record
the exact tested source hashes. Focused subsystem
counts in the linked reports overlap this cohort and must not be added to it.
The preview workflow uses the same explicit file list, then builds the full game
and separate Worlds archives on the published head. Full local builds remain
deferred with less than 400 MiB of free disk.

## Remaining work, in priority order

| Priority     | Item                                           | Completion gate                                                                                                                                                                                                        |
| ------------ | ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P1           | Adopt one reviewed production marking revision | Review mip-safe gutters and sampling, bind an immutable successor collection, and fly the actual gate/pad route. Retain old recording dependencies. Independent rendering and packaged decoding are now evidenced.     |
| P1           | Complete SIM readability and device acceptance | Add deliberate occluders, inspect orientation and grazing shimmer, cover environment/preset combinations, and measure target-device p95 and sustained resource switching. Fixed Hangar views do not close this matrix. |
| P1           | Finish Industrial input/error acceptance       | Complete remaining actual dialogs, physical touch/controller and screen-reader journeys. Localize Replay validator diagnostics through a defined error contract.                                                       |
| Release gate | Fresh offline installation and recovery        | Use final-head CI archives to test fresh game/optional-package installation and recovery, preserving source identity. Current package bounds alone do not prove this journey.                                          |
| P2           | Expand bespoke Industrial assets               | After the representative production revision passes, produce and review drone, vehicle, surface and scenery assets with protected semantic bounds.                                                                     |
| P2           | Deepen and qualify the additional families     | Prioritize Vyshyvanka and Dnipro, then Desktop 98, DOS, Tryzub, Orchard and Neon. Functional families still need full art, input and readability acceptance.                                                           |

The separate Woodland, Warehouse/Stadium and capacity workstreams are not copied
into this pass. No merge, deployment, release allocation or whole-game sign-off
is implied.
