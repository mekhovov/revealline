# Military character art, revision 2

This is a new immutable appearance revision. Revision 1 remains unchanged for existing references.

The revision reuses the licensed rig, textures, movement clips and military wardrobe from r1. A deterministic authoring script repartitions existing rigid damage geometry into twelve connected regions, creates cut-plane closures and assigns equipment to its owning region. Olive uniform vertex colours preserve face, skin and texture detail. All 36 family/cast combinations share these resources.

The character model remains an adapted existing art asset; it is not a newly sculpted photorealistic anatomical model. Close-range artistic approval and full application performance qualification remain release gates.

Run `node authoring/library/fpv-character-art/r2/authoring/repartition.mjs` only when developing a new revision. Published revisions must not be regenerated in place. `provenance.json` identifies the exact inputs, builder and outputs.

Browser admission and presentation evidence is in `docs/evidence/fpv-combat/overhaul-art-browser.json`; screenshots inspect cut regions and a 128-actor mixed roster. This evidence is not a 1080p full-game frame-time qualification.
