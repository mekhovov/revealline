# Woodland depth composition — 3 October 2026

Primary Kenney scenery now groups its existing forty trees into four groves per
edge. Tall rear trees sit farther from the flight boundary; smaller near trees
provide foreground silhouettes. Existing benches retain their positions. Models,
licenses, physics, collision, objectives and course identities are unchanged.
This is a bounded composition increment, not completed environment production.

## Verification

Browser receipt: `evidence/fpv-woodland-depth-browser.json`; comparison:
`evidence/fpv-woodland-depth.png`. Reproduce with
`node scripts/prepare-fpv-woodland-depth-verification.mjs`, serve the checkout,
and open `docs/evidence/fpv-woodland-depth-harness.html`.

Both Woodland arena sizes load through GLTFLoader; all 16,080 vertices per scene
remain outside flight bounds. Each keeps 52 placements. Five other imported
world GLBs are byte-identical to baseline 3d04f9ab04980a8c51d3c28512ace7e024ebae51.
Sampled draw calls change 24→30 for the smaller scene and remain 22 for the larger
scene because composition changes visibility. No sustained FPS/device claim.

World Studio development package: 94 files, 15,382,549 bytes; SHA-256
2b45af16375375004fe2066489c90f59458c106276aca40a30ba5f4dce43a8a0.
ESLint passes. Existing acceptance/texture/workshop checks: 29/30 pass; the
unchanged shared-theme enamel uniqueness check reports 16 distinct motifs for
17 recipes. This failure is not waived. No additional unit coverage was added.

This branch is independent of #992/#993. Integration must preserve #993's
per-tree rotation arguments when combining the nearby layout changes.


## Current-main refresh — 3 October 2026

Candidate `fabb417ec23e1fcaaabf90cd0c102a9f9335efed` integrates main
`b3167a8f89c09286a424996ba4f7e3dca4a351b2`, retaining Yard #998, replacement
Woodland tree forms #1006, shared-theme correction and Stadium. Both delivery
histories are preserved. The focused scenery diff changes only Woodland grove
placement and size; the rotated footprint calculation and `retro(..., gap, 0,
turn)` arguments remain. The template/runtime match exactly, and the shared
renderer/visual modules remain byte-identical to that main. #1001 is not included.

All 30 existing acceptance, texture and workshop checks pass, along with syntax,
changed-file ESLint, formatting and whitespace checks. A functional catalogue
comparison verifies 18 other imported environment/arena GLBs remain byte-identical.
Both Woodland bounds retain 52 placements, twelve exactly unchanged benches and
clear placement bounds. This is functional qualification, not new unit coverage.

All three source-bound optional package admissions pass, with committed-input
identity, ZIP member equality and two byte-identical builds. World Studio is
102 package files / 15,557,392 bytes under unchanged 104-file / 16-MiB limits.
The admission is explicitly `publicEligible: false`. See
`evidence/fpv-woodland-depth-main-admission.json` and
`evidence/fpv-woodland-depth-main-qualification.json`.

The frozen browser fixture uses a 27-file closure read from the committed
candidate and compares it with the exact main above. Source hashes are retained
in `evidence/fpv-woodland-depth-main-source.json`. The browser comparison passes
both arena sizes with 52 placements and 16,080 clear imported vertices each;
views were inspected. Woodland-08 visibility changes sampled calls 24→30 and
triangles 2,594→2,746. Beginner-40 stays at 22 calls / 2,342 triangles. No unchanged
draw-count or sustained FPS claim is made. See the new main-browser receipt and
main-comparison image. Earlier measurements retain their original baseline.

Full `npm run validate` cannot finish in the bounded sparse checkout because
unrelated `game/content/packs/neon-reference-pack.json` is absent. It is not
claimed locally; normal current-head CI must establish that gate. Sustained
named-device frame times, human artist acceptance and public deployment remain
unverified and are not inferred from the functional results.


### Published Hangar integration

The branch then integrated main `ea596d80ba26decc4e7691e4a5c34bd3461fcda6`
(Hangar #1008), producing candidate `039be4e7c776734dedcaa724a7e2d9821220406b`.
The scenery template/runtime and shared renderer are byte-identical to the frozen
browser candidate above. The inherited visual-module change is Hangar wall
construction inside the indoor branch plus its helper; Woodland never enters
that branch. The browser evidence stays explicitly tied to `fabb417ec`, supported
by this integration audit rather than relabelled as a new browser run. See
`evidence/fpv-woodland-depth-hangar-refresh.json`.

All 30 existing checks and all three source-bound admissions pass again. The
World Studio package is 102 files / 15,561,800 bytes with committed
inputs/ZIP members verified and two identical builds. See the Hangar-admission
receipt. Exact-head protected CI and public deployment remain separate gates.
