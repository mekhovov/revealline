# Railway valley ground presentation — pending native review

This separate, opt-in `railway-expanse` terrain treatment follows the 4.096 km
`districts-r1` source from PR #1363. The existing 384 m Railway material stays
unchanged. The normal Library does not admit this new profile yet.

Industrial yards receive aggregate, real hall footprints receive concrete, the
quarry has paler exposed stone, and timber sidings use compacted earth. Ballast
shoulders follow the actual rail alignments only where terrain reaches the track
plateau. The raised viaduct does not paint a false railway on the valley floor.
Natural slopes and the low river corridor use restrained rock/gravel transitions;
this is dry ground treatment, not simulated water.

All positioning uses global metre coordinates plus the current origin, retaining
surface continuity across cell changes. Fine grain and slab joints fade below
pixel size. Performance omits noise samples; Balanced and Quality add bounded
near detail. No images, extra vertices, displacement or physics are introduced.
Live quality changes retain the same material owner and invalidate its shader once.

## Completed functional evidence

- Both exact reviewed source manifests are pinned by SHA-256.
- Six district windows × plain/Performance/Balanced/Quality: 24 comparisons retain
  exact vertex, normal, UV and index digests, source resource ownership, support,
  ground strike and clear approach results.
- Largest observed ownership is 3,156,260 bytes, unchanged from plain terrain.
- Disposal leaves no groups or geometry/texture/reservation bytes.
- Twenty live tier transitions across Canyon, Urban, original Railway and the new
  Railway profile pass the existing production-renderer verification.
- Main and optional package policies explicitly include the new module. The
  regional closure contains 24 modules (excluding its catalogue); the source-file
  allowance changes 162→163 for this one file, with the byte budget unchanged.
- Syntax, scoped lint and formatting checks pass.

Raw evidence is in
`authoring/fpv-worlds/regions/railway-valley/ground-receipts-r1/parity.json`.
Reproduce with `node authoring/fpv-worlds/regions/railway-valley/verify-expanse-ground.mjs /exact/source`.
The shared scenery preview adds seven fixed district views with `views=railway-expanse`;
use `ground=plain` or `ground=railway-expanse` for a same-camera comparison.
The flight authoring preview exposes an explicit new appearance choice.

## Still required

Native shader compilation and same-camera visual review in all three tiers,
actual player flight, Library admission tied to an exact descriptor, full package
closure and public launch remain open. CPU source verification cannot establish
GPU correctness, finished artwork, target-device frame rates or full-world acceptance.
The material is original procedural artwork, with no new asset license dependency.

## Implementation references

[Three.js material cache keys](https://threejs.org/docs/pages/Material.html)
identify the three shader variants; repeated selection of the same tier does not
invalidate a program. [Renderer preparation](https://threejs.org/docs/pages/WebGLRenderer)
remains in the existing production preparation path, after scene lighting is set.
These references guide implementation; they are not performance measurements.
