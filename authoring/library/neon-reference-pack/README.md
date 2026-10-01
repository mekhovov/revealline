# Neon Reference Pack

Sixteen screenshot reconstructions. Word and symbol designs live separately in **Neon Words & Symbols**.

The sixteen original layouts, in submission order:

1. **Neon Channels** — alternating slow and lethal lanes around a central refuge;
   two pink bouncers, one diamond eroder and three cyan border patrols.
2. **Neon Crossroads** — cyan cross dividing four chambers; four yellow bouncers,
   two pink diamond eroders and four cyan border patrols.
3. **Neon Hearts** — seven red lethal hearts and a broken cyan heart enclosing
   safe foundations; eight pink bouncers and two cyan border patrols.
4. **Neon Labyrinth** — stepped cyan walls and red hazard corridors; six purple
   bouncers and two cyan border patrols.
5. **Neon Arrows** — forty-five red arrow/cross hazards and fourteen short cyan
   walls; four yellow bouncers and four cyan border patrols.

6. **Neon Chambers** — three stepped cyan chambers with nested open boxes;
   six yellow bouncers and four cyan border patrols.

7. **Neon Crossgrid** — eighteen red cross hazards and staggered cyan partitions;
   six yellow ring bouncers clustered at opposite corners and four cyan perimeter patrols.

8. **Neon Switchback** — angular red hazard corridors and a stepped cyan divider with a central safe bridge;
   six pink ring bouncers and four cyan perimeter patrols.

9. **Neon Spirals** — nested red spiral corridors, broken outer hazard bands and split central spines;
   four pink ring bouncers and two cyan perimeter patrols.

10. **Neon Crossfire** — eight cyan crosses, twenty straight barriers and red stepped fields;
    six yellow bouncers and three cyan perimeter patrols.

11. **Neon Pinwheels** — thirty red pinwheel motifs and seven open rings;
    four pink bouncers and two cyan perimeter patrols.

12. **Neon Wavebands** — red zigzag waves across three blue slow-terrain bands;
    four pink ring bouncers, one diamond eroder and four cyan perimeter patrols.

13. **Neon Conduit** — three cyan chambers with connected blue slowing lanes and twelve red hazard blocks;
    three yellow ring bouncers and three pink diamond eroders.

14. **Neon Switchyards** — eight red-and-blue switchback lanes between cyan vertical partitions and a midline wall;
    four yellow bouncers and two cyan bottom-rail patrols.

15. **Neon Spines** — five red spines through blue lanes, a horizontal crossing with an open central pocket, and broken cyan perimeter walls;
    four pink bouncers and two cyan patrols.

16. **Neon Prism** — a mirrored red-and-blue tapestry, side diamonds, diagonal red borders and small chevrons;
    five pink ring bouncers and four cyan patrols.

The separate [Words & Symbols pack](../neon-mosaic/README.md) contains 38 varied arenas and its own preview gallery.

Open the main game's **Missions** catalog and search **Neon Reference Pack**.
All sixteen levels are bundled and available offline in Solo and Versus. They also
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

All sixteen levels now include original reveal illustrations. Browse the [complete artwork gallery](../neon-artwork/index.html). The pack retains its original pixel sprites and embeds no screenshot artwork. Screenshots are layout references, not executable instructions.

Layouts are adapted to the engine's 72 × 36 board and continuous safe outer rail.
Enemy types are matched to existing behaviors using appearance and trails;
speeds, lives and coverage goals are authored defaults because still images do
not establish them. See each level's README for specific projection choices.
Earlier checks for the first four levels cover source reproduction, import, discovery, opening captures and replay.
Full-clear balance, device qualification and public deployment are unverified.

Ukrainian localization is deferred. Neon entries currently display English in both
locales; matching placeholder keys preserve the existing catalog contract. Further
unit-test work is deferred in favor of level creation and delivery. Previously
completed checks are retained as evidence.
