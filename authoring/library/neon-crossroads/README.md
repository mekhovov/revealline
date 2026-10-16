# Neon Crossroads

A separate playable level reconstructed from the second user-supplied screenshot
on 30 September 2026. Neon Channels remains unchanged.

With `node scripts/game-cli.mjs serve --port 8770` running, open
<http://127.0.0.1:8770/authoring/library/neon-crossroads/> and choose **Play Neon Crossroads**.
The launch page supports both turning policies. `scenario.json` imports into
Playground; `pack.json` is a standalone single-mission pack.
Regenerate with `node scripts/build-neon-crossroads.mjs`.

The cyan cross is implemented as solid walls, two cells thick, separating four
equal chambers. Three nonoverlapping rectangles form the cross. Walls stop both
player and field enemies; they are not safe return surfaces. Start at bottom
center and move sideways to reach a chamber. The outer safe rail remains passable.
No slow terrain, lethal terrain, pickups or extra interior objects were added.

| Reference appearance | Existing role                | Starting placements (72 × 36 grid)                                          |
| -------------------- | ---------------------------- | --------------------------------------------------------------------------- |
| Yellow orbs          | Bouncer                      | Upper-right: (39.3,12.3), (56.2,13.6); lower-left: (11.5,19.5), (25.3,19.8) |
| Pink diamonds        | Eroder                       | Upper-left: (9.1,7.2); lower-right: (60.8,25.1)                             |
| Cyan sparks          | Border patrol                | Top: (13,0.5), (59,0.5); sides: (0.5,23), (71.5,23)                         |
| Yellow player        | Scout, direction-only Arcade | (36.5,35.5)                                                                 |

The screenshot supplies layout, silhouettes and approximate positions. Its grid
is projected onto the runtime's 72 × 36 grid; exact velocities and behavior cannot
be established from a still. Motion directions follow visible trails where possible.
The solid-wall interpretation and existing eroder/patrol mechanics are explicit
choices. The 75% goal, three lives and untimed play are authored defaults.
Original procedural sprites are embedded in each import, with cyan tiled walls,
yellow orbs, pink diamonds and cyan sparks. The existing retro reveal art and
runtime role badges remain. No original screenshot pixels or music are embedded.

Checks cover both import schemas, reproducible artifacts, four equally sized
seeded chambers, wall collision, a legal 348-cell capture without loss of life,
and exact replay verification in both turning modes. Browser launch and rendering
were inspected separately. Full-clear balance and physical devices are unverified.
