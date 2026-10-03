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
in `evidence/fpv-woodland-depth-main-source.json`; browser review is pending.
Earlier measurements retain their original baseline and are not relabelled.

Full `npm run validate` cannot finish in the bounded sparse checkout because
unrelated `game/content/packs/neon-reference-pack.json` is absent. It is not
claimed locally; normal current-head CI must establish that gate. Sustained
named-device frame times, human artist acceptance and public deployment remain
unverified and are not inferred from the functional results.
