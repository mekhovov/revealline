# Regional Overview depth precision

The exact Coaster review-r2 player package (source `856fefeabee5ea5cf2d9953151a9c7b72245bd19`) passed normal download, saved flight, deliberate arm/pause, camera/mode changes, starting-point restart and reload retention on origin 9112. Its distant Overview failed visual review: broad triangular interference appeared across roads and plazas. FPV remained readable. The old package and immutable source remain preserved; that visual gate is not waived.

## Cause and correction

The regional camera inherited the close-flight 0.035 m near plane while Overview viewed a 768 m resident area with a 2,000 m far plane. The original plaza is 80 mm above the terrain. At its central viewing distance the two layers are separated by only about 0.040 of one theoretical 24-bit depth step. Their vertices are not coplanar.

The shared camera frame now has an explicit regional Overview option. It derives a conservative near plane from the camera's horizontal distance outside the admitted resident-cell prism and the diagonal-frustum cosine. The result retains a fourfold visibility margin and is capped at 10 m. The corresponding theoretical plaza separation is at least 11.61 depth steps in the tested layouts. These are CPU projection calculations, not a measured GPU depth-buffer format or a visual acceptance claim.

FPV, Chase, editor and ordinary course views retain their exact original near plane/projection. Entering a new course or regional session resets the close-flight near plane. Camera changes and resize recompute the projection only when needed. The calculation allocates no per-frame objects. No geometry, materials, terrain heights, collision, flight policy, saved source, recording, proof or package budget changes.

## Verification

`node authoring/fpv-worlds/regions/verify-overview-depth.mjs /path/to/preserved/coaster-supported-r5`

The verifier extracts the actual current and pinned pre-change shared camera functions. It checks 2,016 exact unchanged camera/aircraft comparisons, 144 regional layouts across 128/256/512 m cells, four aspect ratios and shifted/negative origins, and 17,412 visible boundary points including tall foreground cases. It verifies every source collision payload's byte count/hash, then checks 488,896 actual immutable Coaster vertices; 488,770 visible vertices remain inside the near/far depth range. Twenty-four actual starting-point/aspect combinations improve 80 mm plaza separation by more than 100 times. Cycling back to close views or ordinary hosts restores the original projection exactly.

The existing preview-bound checks also pass for all three cell sizes. ESLint and whitespace checks pass. Detailed results are in `fpv-regional-overview-depth-verification.json`. Native corrected Overview review and a new exact cloud player package remain pending.

## Preserved baseline package evidence

Cloud run `38714621234`, artifact `11962905765`, source `856fefea`, package revision `55af0535144f8b9abd8afb898be52af3ba2a4caadb2f7aa5258e6e2825afd959` completed both optional and broader company qualification. Independent retrieval verified all 15 top-level checksums, six complete ZIP inventories/budgets and three finished runtime import closures. Worlds has 162 runtime ZIP files / 17,489,364 bytes and 164 source ZIP files / 17,532,975 bytes within its unchanged 164-file/20 MiB envelope.

The exact extracted runtime verified all 203 actual immutable HTTPS responses and 36 production sessions across six starts, two flight modes and three visual tiers, with geometry parity and zero owned resources after disposal. That technical evidence is recorded in `fpv-coaster-supported-package-qualification.json`; it does not supersede the failed native Overview art gate. Offline flight, physical-controller coverage and final representative park-art quality were not established by this review.
