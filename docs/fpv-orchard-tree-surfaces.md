# Orchard tree surface increment

The accepted source candidate `27e15dd0d5fa9e45e58f7c7ae802a0976bd5a83a` integrates
main graphics recovery and Campus (`a46aded0b`). Its only production change
replaces six existing authored trunk/crown texture maps in the five canonical
Orchard activities. The original closed geometry, UVs, collision solids, actors,
objectives, map sizes, material owners and draw batches remain exact. Broken
upright bark plates and opaque leaf groups add restrained harvest color. The
barn, survey plinth and peripheral dressing keep their prior materials.

The guard checks the canonical world/course IDs, bounds, all 32 tree IDs and
exact trunk/crown coordinates, winding and dimensions, the two remaining
obstacle IDs, and the complete authored profile. Changed tree layouts, custom
profiles, Pixel and all 17 shared visual collections retain their earlier
surfaces. The five activities retain their existing guide/cart/route and plinth
behavior. No cards, fruit meshes, gaps or silhouette changes are introduced.

## Current qualification

The final source SHA-256 is
`7313e7328635ac5d662eae9676b8d75fbbd9de848ffe461a4deb35aebadf7417`.
The [manual qualifier](../scripts/qualify-fpv-orchard-tree-surfaces.mjs)
passes **378 checks / 89 scenes**. Its [complete v2 receipt](evidence/fpv-orchard-tree-surfaces-cpu-v2.json)
compares real-Three geometry/UV bytes and all scene content outside the six
allowed map images, including every shared kit, Pixel, custom-layout/profile
rejections, other-world controls, determinism, quality transitions and
exactly-once owner disposal. Scene scope remains 86 geometries, 93 materials,
18 textures and six instance batches. Raw texture storage remains 1,179,648,
4,718,592 and 18,874,368 bytes at low/balanced/high; existing Pixel stays64px.

All **30 existing** acceptance, world-texture and workshop checks pass on v2.
ESLint, format and diff checks pass. Full npm validation passed during the
v1-to-v2 surface/preview refinement, including every byte-identical generated
module and asset check. Final focused checks bind v2; its unchanged generator
and localization inputs do not need a repeated full validation solely for these
texture calculations. The [checkpoint](evidence/fpv-orchard-tree-surfaces-checkpoint.json)
states the exact scope.

Root reviewed the [close bark](evidence/fpv-orchard-bark-v2-review.png),
[crown face](evidence/fpv-orchard-crown-v2-review.png) and
[avenue](evidence/fpv-orchard-avenue-v2-review.png). The bounded surface improvement
is accepted: broken plates and broad leaf groups read more clearly, and the
route and guide remain readable. Simple closed tree forms remain; this is not
a claim of a complete realistic world. The frozen actual-WebGL source matrix
is running. Package admission, package browser and actual-player observations
are still pending.

## Original recordings and resource boundaries

A fresh replay of all ten authenticated original Orchard recordings passes
**237 checks / 39,525 ticks**, with exact course/runtime/final identities,
zero contacts, full health and no final blocked actors. Ten real Rapier worlds
were created and each freed once, with at most one live. [Complete replay](evidence/fpv-orchard-tree-surfaces-replay.json)
and the [executed probe](evidence/fpv-orchard-tree-surfaces-replay-probe.mjs)
retain every result. Replay ran on the first surface candidate
`58c5eae096873e51b614dae134d7c35445944cbb`; all 69 other bound runtime/shared
inputs remain byte-identical in v2. Only world-visuals texture math changed.

The [lossless authenticated inputs](evidence/fpv-orchard-authenticated-replay-inputs.json.gz)
retain original member text, archive and manifest hashes. Decompress with gzip;
the checkpoint records the raw and compressed hashes and sizes. No controls or
proof outcomes were generated. One-second path samples are not a continuous
swept-clearance proof. Collision-world cleanup is not a measured GPU or process
memory plateau.

## Retained first visual review

V1 was not accepted: foliage looked finely speckled and bark lacked broad
structure at flight distance. Its [bark](evidence/fpv-orchard-bark-v1-review.png),
[crown](evidence/fpv-orchard-crown-v1-review.png), [CPU receipt](evidence/fpv-orchard-tree-surfaces-cpu-v1.json)
and [frozen harness](evidence/fpv-orchard-tree-surfaces-harness-v1.html) remain
separate. No functional source matrix was run on v1. V2 moved the inspection
poses to roughly1.5m from bark and2m from a crown face and added broader leaf
groups and staggered broken plates without changing existing geometry or owners.

No hardware FPS, new flight demonstration, universal imported-image determinism,
public deployment or complete-world art acceptance is claimed. The browser
Courtyard control explicitly preconstructs the original material dependencies
in source order equally on both sides and restores temporary hooks; this does
not alter production loading. New unit coverage remains in D6.
