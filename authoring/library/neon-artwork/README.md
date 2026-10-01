# Neon reveal artwork

All **54** Neon arenas have distinct original reveal illustrations: **16** in Neon Reference Pack and **38** in Neon Words & Symbols. The images are embedded in both bundled packs and all editable practice scenarios, so reveal play does not require a separate image download.

Open [the artwork gallery](index.html) to review the complete set. [prompts.json](prompts.json) records the built-in image-generation tool, effective prompt, source-generation filename, delivery dimensions, byte size and SHA-256 for every picture. Delivery JPEGs are 1024 × 512, optimized at quality 85. Together they occupy 16,258,240 bytes before pack encoding.

Reference illustrations echo the layouts through canals, crossroads, gardens, labyrinths, spirals, waves and crystalline structures. Word images retain their readable lettering. Cultural illustrations draw on the [recorded research references](../neon-mosaic/references.json) and are artistic interpretations rather than reproductions of museum objects. The Örnek tulip is specifically inspired by Crimean Tatar ornament.

`scripts/neon-reveal-artwork.mjs` loads each image into the existing background override; the game reveals that picture as territory is captured. Pixel sprites, terrain, walls, enemy placements and gameplay rules are retained.

After replacing an image, update its manifest dimensions and hash, then run its `scripts/build-neon-<id>.mjs` builder (or `scripts/build-neon-mosaic.mjs` for words and symbols), both pack builders, `scripts/build-neon-artwork-gallery.mjs`, `scripts/mission-library-index.mjs --write`, and `scripts/localization.mjs build`.

Validation for this artwork update: all 54 image hashes and dimensions match their manifest; every bundled level and practice scenario embeds its matching JPEG; both pack schemas and all 54 scenario schemas pass; gameplay data matches the previous commit. The mission catalog fingerprints and content registry were regenerated. Unit tests and Ukrainian translation were skipped as requested. Browser preview verification was not completed because browser permission was declined.
