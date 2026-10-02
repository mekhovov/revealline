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
no separate selector, preference or theme factory. Preserve Woodland #964's
independent bark/floor work when reconciling main.

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
