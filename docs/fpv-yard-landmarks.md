# Container Yard frontage composition

The four perimeter frontages now differ in building heights, spacing and setback.
Container group spacing reinforces the tower depot, storage, tank sheds and truck
service sides. All 58 existing placements and licensed models are retained.
This changes presentation outside flight bounds, not gameplay geometry or rules.

Browser verification covers all three catalogue arena sizes, including Snake
chase and School. Every imported scene's 98,880 vertices remains outside flight
bounds. Five other imported environments remain byte-identical. Sampled overview
calls stay 61; triangle counts remain unchanged per course. No sustained FPS claim.
Evidence: `evidence/fpv-yard-landmarks-browser.json` and accompanying PNG.
Reproduce with `node scripts/prepare-fpv-yard-landmarks-verification.mjs` and the
browser harness at `docs/evidence/fpv-yard-landmarks-harness.html`.

Development package passes: 94 files, 15,384,159 bytes; SHA-256
59c0ac33426c2bae6c085595d000edcc26d63b4550ca1c17b28dea1a0fa1660a.
Existing acceptance/texture/workshop checks: 29/30 pass. The unchanged shared-theme
enamel motif check still finds 16 unique patterns for 17 recipes; it is not waived.
Additional unit coverage, device performance and public deployment remain pending.


## Current-main refresh — 3 October 2026

Candidate `ec760db263041be23f60f4450381dc4ec88ec402` integrates main
`a1cb86c85cd52db7256ad2ed16c30c8f40f90c32`, including approved capacity, the
shared-theme motif fix, Stadium and the replacement Woodland tree-forms PR #1006.
Both delivery histories are retained. Only the original Yard placement changes
remain in the mirrored scenery template/runtime; their source text matches exactly.

All 30 existing acceptance, texture and workshop checks pass. Changed-file lint,
syntax, formatting and diff checks pass. All three source-bound optional package
admissions pass with committed-input verification, ZIP member equality and two
byte-identical builds. World Studio is 102 source/runtime package files and
15,556,716 bytes within its 104-file/16-MiB limits; these are admission counts,
not the earlier development-package counts. The admission receipt remains
`publicEligible: false`. See `evidence/fpv-yard-landmarks-main-admission.json`.

The frozen browser fixture compares that exact main with the candidate; its
27-file committed module closure and original-source hashes are retained in
`evidence/fpv-yard-landmarks-main-source.json`. Current-main browser review passes
all three arena cases: each retains 58 placements, 98,880 vertices outside the
flight bounds, 61 sampled draw calls and unchanged triangles. The five unaffected
environment GLBs remain byte-identical. Before/after views were inspected by the
agent. See `evidence/fpv-yard-landmarks-main-browser.json` and
`evidence/fpv-yard-landmarks-main-comparison.png`. Earlier browser measurements
above retain their original candidate identity.

The bounded sparse checkout omits unrelated global content assets. Full
`npm run validate` stops in localization at absent
`game/content/packs/neon-reference-pack.json`; it is not reported as passing.
Normal current-head CI must complete full validation. The detailed local receipt
is `evidence/fpv-yard-landmarks-main-qualification.json`. No new unit coverage,
sustained device performance or public deployment is claimed.
