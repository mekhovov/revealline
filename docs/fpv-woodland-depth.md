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
