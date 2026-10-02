# Warehouse surfaces and readable storage bays

C5 continues the approved environment art pass. Six existing solid storage blocks
in Pixel Warehouse currently share generic metal corrugation, and perimeter
surfaces stretch the same texture over walls with very different dimensions.
This increment improves those surfaces across the ten existing Warehouse
challenges; it does not add levels or change flight handling.

## Scope

Keep the six `rack-*` volumes visibly closed. Painted steel panels, restrained
joints and quiet bay identification should help pilots recognize aisles without
suggesting nonexistent openings. Reuse the existing opaque faces and label
planes. Apply consistent metre-scale UVs to the Warehouse shell. Preserve the
Pixel palette and nearest filtering, all obstacle geometry/collision, lighting,
fog, floor markings and active-objective colours.

The 76×70m and 88×88m layouts include moving rivals/crossing hazards,
`beginner-36`'s 2.5m stack and beam beginning at 5m, and `beginner-38`'s divider.
Their authored routes and recorded attempts remain the source of gameplay truth.

## Research and shared ownership

The Three.js [texture documentation](https://threejs.org/docs/pages/Texture.html)
describes UV mapping, repeat/wrapping and sampling. Use world dimensions for
consistent scale while keeping bounded texture sizes; do not increase sampling
cost merely to hide stretched coordinates. Its [standard-material documentation](https://threejs.org/docs/pages/MeshStandardMaterial.html)
provides the existing albedo/normal/roughness presentation model. New graphics
remain original procedural artwork with no downloaded asset or runtime decoder.

Themes #955 owns shared appearance/material factories. Keep this increment to
narrow surface recipes and UVs beneath semantic steel/enamel/concrete ownership;
no separate selector, preference or theme factory. Woodland #964 is now merged; its bark/floor work is preserved in this
combined candidate.

## Qualification boundaries

Functional verification accompanies this increment. Additional unit coverage
remains in H/R7. Inspect actual Three.js geometry, transforms, opaque rays, GLB
loading, Pixel and linear filtering, low/balanced/high presets, FPV/chase/overview
and below/above-beam views. Compare all other environments, sampled draw costs,
resource ownership and repeated disposal. Frozen package admission and actual
player demonstration completion are separate from source-only checks.

A synthetic view matrix does not qualify physical devices, sustained FPS, novice
learning or production-art acceptance. Public availability requires the merged
source's deployment marker and an actual public simulator launch. Exact receipts
and publication identity will be appended after verification.

## Completed source qualification — 3 October 2026

The final candidate includes merged main `fe6ff1b7a2585aa969b945d5fcb7699aa6b04460`.
It reuses the storage surfaces' three maps for panel bodies and six numbered
flush plates. School beams, stacks and dividers sample a plain region of that
same atlas. All four sides have outward-readable labels. No mesh, triangle,
material or texture was added; label UV buffers add exactly 1,152 bytes.

- [CPU/resource receipt](evidence/fpv-warehouse-surfaces-cpu.json): 76 existing
  texture outputs, 85 preset cycles and 96 label-orientation assertions pass.
- [Merged-main parity](evidence/fpv-warehouse-surfaces-merge.json): the four
  Warehouse extent/profile cases remain exact against the pre-merge candidate.
- [Actual source browser](evidence/fpv-warehouse-surfaces-browser-source.json):
  307 checks and 159 image pairs pass, including 13 unaffected environments,
  actual imported scenery, geometry/opaque rays and disposal/resource plateaus.
- [Route replay](evidence/fpv-warehouse-surfaces-route.json): all 18 Warehouse
  recordings across ten courses replay through 44,168 ticks, with zero contacts
  or blocked actors. Closest sampled continuous-segment clearance is 1.831m to
  solid scenery, 0.299m to a racing rival and 1.242m to a freight hazard.

The browser matrix uses Chrome 154 in the Codex in-app browser on this Mac,
640×360 CSS canvases at DPR 2. It measures equivalence and ownership; it is not
sustained frame-time or hardware qualification. The existing 178-result broader
replay receipt is still bound by exact input hashes, not claimed as a fresh rerun.

Final production SHA256: renderer `2e0896fa2b5acc3b71a05b729e277b48f16aaa57b43b960c12406d495de88346`;
world visuals `02eb4dc0c156316bf7634fad51d61365e48e4a5dac81ad62a032b1efc2e0172d`.
Frozen package and publication evidence follow separately.

## Frozen package and player

Candidate `16a45583d98d9461f7f5d10b97dfe4f85c967e9f` passes all three optional
package admissions, committed-input and ZIP-member verification, and two
byte-identical builds. [Package receipt](evidence/fpv-warehouse-surfaces-package.json):
Academy35files/545,596bytes; FPV68files/3,840,015bytes;
World Studio100files/14,094,801bytes, within unchanged guards.
[Packaged WebGL](evidence/fpv-warehouse-surfaces-browser-package.json) independently
passes307 checks/159 image pairs with no captured console errors.

[Actual player](evidence/fpv-warehouse-surfaces-player.json) completes Moving
freight at52.0s with health100 and no captured errors, then opens a fresh
attempt ready/paused at zero throttle. The dedicated Warehouse, normal reviewed
player and continuous-school playtests include C4+C5 and use92files/13,937,482bytes;
ZIP SHA256 `74b5128681f8cc3905f5dee518ec22734e183aa1b1814b07cb60f669eff9d793`.
These localhost builds are available for feedback; publication is separate.

Two package attempts hit local disk exhaustion before output creation. Removing
superseded task-generated verification snapshots and a redundant old SIM-entry
build restored space; source, handoffs, qualified archives and user playtests
were preserved. The subsequent frozen package and browser qualification passed.
