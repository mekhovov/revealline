# Homeward Skies source assets

This directory holds the original three-picture chapter source. `pack-source.json` is a small editable runtime-pack recipe with an empty generated `levelVisuals` array. `backgrounds/homeward-01.png` through `homeward-03.png` are reviewed original 4:3 illustrations, retained exactly as generated. `prompts.json` preserves the effective prompts, author/source declaration and visual-review notes.

Run these commands from the repository root:

```sh
node scripts/build-homeward-pack.mjs --write
node scripts/verify-homeward.mjs --record
npm exec -- prettier --write game/content/packs/homeward-skies.json game/replays/homeward-routes.json game/replays/expansion-routes.json
node scripts/build-homeward-pack.mjs
node scripts/verify-homeward.mjs
```

The builder uses exact original PNG bytes to produce `game/content/packs/homeward-skies.json`; it never rewrites the originals. Default mode verifies that the generated pack still agrees with the source recipe and artwork. Each background remains independently replaceable by level ID. Source PNG files are for authoring; the portable runtime JSON carries its own images and needs no external image URLs.

Keep attribution and prompts with any revision. Artwork changes need visual inspection and complete browser decode before adopting a pack. Rules and actor geometry are separate recipe fields and have their own legal-input proof fixtures; an image replacement must not secretly change them. The built-in engine intentionally supports a finite set of declarative rules and abilities.

See [the chapter guide](../../../docs/homeward-skies.md) for installation, measured equipment benefits, the all-class fallback policy, source hashes, export/watch commands and evidence limits. The geometry curriculum transparently adapts the first three Fieldcraft challenges; these new images and narrative do not constitute new behavior primitives.
