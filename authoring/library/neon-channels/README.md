# Neon Channels

Playable reconstruction of the user-supplied arena screenshot from 30 September 2026.

Run `node scripts/game-cli.mjs serve --port 8770`, then open
<http://127.0.0.1:8770/authoring/library/neon-channels/> and choose **Play Neon Channels**.
The ordinary game opens in practice mode. The launch page offers both turning modes.
`scenario.json` is also importable into Playground; `pack.json` is a standalone
single-mission pack. Neither replaces an existing campaign or saved flight.

The source recipe is `scripts/build-neon-channels.mjs`; regenerate with
`node scripts/build-neon-channels.mjs`.

The measured picture has approximately 92 × 46 tiles. Rectangle edges are scaled
and rounded to the supported 72 × 36 board. All seven blue slow regions, six red
lethal regions, two small stepped revealed islands and the central upper/lower
revealed shells are represented. Revealed ground uses safe foundations, not walls.
The player starts at the lower-left corner. Two pink bouncers, one central pink
diamond eroder and three cyan border patrols retain the pictured relative positions.
The sprites are original procedural pixel shapes; no screenshot artwork is embedded.

Interpretations and limits:

- The screenshot establishes appearance and positions, not behavior. Blue = slow,
  red = lethal, spheres = bouncers, diamond = eroder and cyan sparks = border patrols
  use the closest existing Classic mechanics. Velocities are authored approximations
  consistent with the visible pink trails, not measured source-game timings.
- The engine requires a continuous permanent safe border. The screenshot's small
  black border gaps are therefore not simulated as openings.
- Safe foundations approximate the existing revealed shapes; they are permanent
  return surfaces, not a restoration of the screenshot's unknown capture history.
- The underlying reveal illustration uses the existing procedural retro theme.
  The screenshot's partly visible illustration is not reconstructed.
- The 75% target, three lives and untimed play are authored defaults.

Validation: scenario and pack schemas, regenerated artifact equality, two legal
corridor captures without losing a life, and exact replay verification in both
turning modes. The native browser launch and rendered terrain/enemy layout were
inspected. Full-clear balance, physical devices and public deployment remain unverified.
