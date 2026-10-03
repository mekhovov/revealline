# Classic reveal paintings

23 original pixel-art paintings replace the remaining procedural backgrounds:

- First Signal: 12 landscape and radio-relay scenes.
- Night Shift: 3 neon arcade scenes.
- Living Threads: 3 Ukrainian garden and textile scenes.
- Fieldcraft: 4 workshop, drone and infrastructure scenes.
- Sentinel Relay: 1 island observatory scene.

Open `index.html` to review every picture and its level link. The links target the matching source edition and work on GitHub Pages after this change is deployed.

The review gallery loads online on demand. Its duplicate source images are excluded from the game's bounded offline cache; runtime pictures remain in the base sidecar and downloadable chapter packs.

`prompts.json` preserves the exact prompts used with OpenAI's built-in image generation tool, one call per image. `manifest.json` records the generated original filenames and SHA-256 fingerprints as well as the shipped JPEG dimensions, sizes and fingerprints. The full-resolution originals remain in the generating workspace's image output directory. The optimized, uncropped 1024×768 paintings are committed in `backgrounds/` and embedded into the runtime packs.

The same level painting serves all selectable actor themes. The artwork follows the setting and obstacle composition, while actor skins continue to come from the selected theme. No geometry, enemy placement, objectives, campaign revisions or progress identities change.

The base campaign's paintings live in `game/content/base-artwork.json`, using the existing pack format as a presentation-only sidecar. It is loaded by Solo, Versus, the level editor and the still-image workshop; it is not installed as a duplicate playable campaign. Its campaign fingerprint must match the canonical base campaign. The other paintings live in the four existing packs, now version 1.1.0.

To regenerate bindings after an intentional asset change, update its manifest fingerprint, then run:

```sh
node scripts/refresh-classic-artwork.mjs --write
node scripts/mission-library-index.mjs --write
node scripts/generate-current-art.mjs --write
node scripts/generate-picture-baselines.mjs --write
```

`node scripts/refresh-classic-artwork.mjs --check` verifies fingerprints and exact bindings without rewriting them. The game content validator also checks the base sidecar against the live campaign.
