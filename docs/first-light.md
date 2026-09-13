# FPV Front · First Light

P2's first wide Arcade chapter is `fpv-arcade`, campaign `fpv-first-light` revision 1. The three maps use 72 × 36 cells, a 1152 × 576 logical canvas, continuous steering and independently replaceable 2:1 original artwork. Legacy maps retain their own simulation versions and 4:3 canvas.

| Map             | Target | Main pressure                                                       | Reward                       | Music arrangement                       |
| --------------- | ------ | ------------------------------------------------------------------- | ---------------------------- | --------------------------------------- |
| Orchard Window  | 60%    | Two moving field threats and a perimeter patrol                     | Ukrainian spring orchard     | Orchard Circuit · 108 BPM synthwave     |
| Split Courtyard | 70%    | Three threats around staggered walls and open crossings             | Blue-hour brick courtyard    | Courtyard Afterglow · 120 BPM synthwave |
| Night Signal    | 80%    | Three threats, perimeter pressure and a telegraphed horizontal lane | Carpathian night observatory | Night Carrier · 126 BPM synthwave       |

The chapter introduces Arcade with one FPV Scout loadout. Scan shows headings; Boost changes flight speed. The existing seven-role Tactical packs remain independently available. This chapter does not advertise the P4 classic roles or pickups before those mechanics exist. The three procedural arrangements are distinct track recipes, not three of the promised 24 finished/auditioned audio tracks.

## Play and author

In the main game choose **First Light · New FPV chapter**, or Missions → Pack → FPV Front · First Light. Switching stays within the game session, preserving soundtrack ownership. The campaign starts at the next unlocked map. A saved flight remains available through Continue; selecting a new map begins a separate attempt.

Development link: <http://localhost:8767/game/?pack=fpv-arcade&campaign=fpv-first-light&level=orchard-window>. Source links change with development; validated release URLs are recorded in the roadmap.

In Playground choose **Load fpv arcade**. Immediate and Grid + buffer, level JSON, walls, enemies, art, music recipes and class presentation remain editable. The editor, gallery, Replay Theater and couch canvases derive dimensions from each versioned map, including when switching back to a legacy map. The original pixels are not stretched into square boards.

The reusable source lives in `authoring/library/fpv-arcade/pack-source.json`. PNG originals and generation brief/provenance records live alongside it. Replacing a PNG and rebuilding updates only its map's presentation; changing gameplay requires a reviewed content revision before publication.

```sh
node scripts/build-first-light-pack.mjs --write
node scripts/build-first-light-pack.mjs
node scripts/game-cli.mjs inspect-goals --pack game/content/packs/fpv-arcade.json
node scripts/verify-first-light.mjs
node scripts/verify-first-light.mjs --gentle
```

`build-first-light-pack` validates file type, size, 2:1 dimensions and distinct hashes before embedding. Its default command checks source and runtime byte equivalence without changing files. Original artwork is outside the runtime build; the pack embeds only its three display images. P5 will provide broader media-library import/derivatives and optional downloads.

## Verification and limits

`game/replays/first-light-routes.json` pins six legal command routes, one per map and turning policy. Each is replayed under the exact shipped level/class hashes with replay v5 and a complete checkpoint. Seed 1 routes finish with all three lives at roughly 15.4, 23.2 and 17.1 seconds; they establish solvability, not a human difficulty curve or minimum completion time. No deliberate waiting is required. Blind unchanged-direction runs fail and encounter actual damaging contacts on all three maps.

`game/replays/first-light-gentle-routes.json` independently pins six Gentle routes under the derived campaign identity and Gentle policy version. They finish with five lives. The legacy 58-route Gentle oracle remains byte-for-byte unchanged; combined coverage checks require all 32 currently installed maps in both turning modes.

The actual solo-host test installs a wide fixture through the normal pack handler, wins, then selects a legacy pack and verifies the native bitmap and layout ratio change. The fixture removes threats solely to isolate the host transition; shipped winning routes separately exercise the real threats. Renderer/editor/gallery/theater regressions cover rightmost columns, coordinate scaling and preserved old versions.

Real browser source checks confirm actual image decoding, opaque concealment, tap/release flight, contact/recovery and explicit pause. Source viewport checks at 390 × 844, 320 × 640 and 844 × 390 preserve the whole wide arena without horizontal overflow, with visible 44 px or larger controls and reachable briefing actions. These are browser layout checks, not physical device certification. Human assessment, additional seeds/play styles and release artifact checks are tracked separately. A successful automated route does not establish that the game is fun or that hardware/controllers have been certified.

The renderer uses the pinned Phaser canvas texture/scale APIs, cross-checked against installed 4.2.1 source and [Phaser's ScaleManager documentation](https://docs.phaser.io/api-documentation/class/scale-scalemanager). Session audio follows [browser `play()` permission behavior](https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/play); preferences cannot bypass activation requirements.
