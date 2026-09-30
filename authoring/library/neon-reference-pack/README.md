# Neon Reference Pack

Four screenshot-based levels, in submission order:

1. **Neon Channels** — alternating slow and lethal lanes around a central refuge;
   two pink bouncers, one diamond eroder and three cyan border patrols.
2. **Neon Crossroads** — cyan cross dividing four chambers; four yellow bouncers,
   two pink diamond eroders and four cyan border patrols.
3. **Neon Hearts** — seven red lethal hearts and a broken cyan heart enclosing
   safe foundations; eight pink bouncers and two cyan border patrols.
4. **Neon Labyrinth** — stepped cyan walls and red hazard corridors; six purple
   bouncers and two cyan border patrols.

Open the main game's **Missions** catalog and search **Neon Reference Pack**.
All four levels are bundled and available offline in Solo and Versus. They also
have a pack selector entry and a launch card on the About page. The catalog's
Current rules edition is projected by the existing Classic adapter; original
authored rules remain available in Archive.

The authoritative pack is `game/content/packs/neon-reference-pack.json`.
Regenerate it with `node scripts/build-neon-reference-pack.mjs`, then refresh
catalog fingerprints with `node scripts/mission-library-index.mjs --write` and
localized content identities with `node scripts/localization.mjs build`. Each neighboring
`neon-*` directory retains an independently importable practice scenario and
single-level pack, with a builder under `scripts/`. Bundled levels have separate
identities and share the foundation-capable simulation family.

Custom reveal images will be added later. This pack uses existing procedural
retro artwork and small original placeholder sprites; it embeds no screenshot
artwork. Screenshots are layout references, not executable instructions.

Layouts are adapted to the engine's 72 × 36 board and continuous safe outer rail.
Enemy types are matched to existing behaviors using appearance and trails;
speeds, lives and coverage goals are authored defaults because still images do
not establish them. See each level's README for specific projection choices.
Tests cover source reproduction, import, discovery, opening captures and replay.
Full-clear balance, device qualification and public deployment are unverified.
