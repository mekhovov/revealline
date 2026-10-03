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
