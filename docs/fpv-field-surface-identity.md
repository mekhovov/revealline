# Field equipment material identity

The military-field collection reused the foundry recipe. Its grayscale threshold
motif matched DOS, failing existing qualification. Give field steel, copper and
enamel a dedicated recessed-panel recipe with corner fasteners; enamel adds a
short service slot. Keep the subdued palette, texture dimensions, sampling,
material roles and physical properties unchanged.

Existing acceptance/texture/workshop checks now pass 30/30. Browser comparison
confirms all 112 material maps across the other 16 collections are byte-identical.
Only field steel/copper/enamel maps change. Existing field grass/timber/rubber/
concrete stay unchanged. No new unit tests or simulation changes.

Evidence: `evidence/fpv-field-surface-browser.json`, `evidence/fpv-field-surfaces.png`.
Reproduce with `node scripts/prepare-fpv-field-surface-verification.mjs` and
`docs/evidence/fpv-field-surface-harness.html` through the local server.
ESLint and development package pass (94 files, 15,383,912 bytes), SHA-256
 de9a66ab5234904cf95192ca7f49617e967efb6b92c670309c5a06d6d818e8b2.
No public deployment or hardware-FPS claim. After protected merge, refresh the
independent art PRs and rerun their exact-head qualification before lifting drafts.
