# Warehouse racing demonstrations

World Studio adds 16 examples for the eight Warehouse challenges, covering
Self-level and Acro. The existing 56 Academy, Woodland Park and Ukrainian
Courtyard recordings are unchanged. Players can now watch 72 demonstrations
across 36 challenges; worlds without recordings keep their normal flight action.

The Warehouse examples demonstrate directed gates, switchbacks, orthogonal
turns, altitude changes, rival spacing and moving freight. Each recording
completes its exact original route with full health and zero contacts. Durations
are 24.20–59.88 seconds. At horizontal speeds of at least 1 m/s, every recording
faces forward throughout its travel; 99.33–100% of distance lies within 45° of
its heading.

The recorded pilot settles 4 m before each gate, then crosses toward a point
1.8 m beyond the plane. Its line sits 0.9 m above the gate centre to leave room
for the physical pace rival. Warehouse 07 returns at 6.2 m above the moving
freight lanes, then descends onto the original landing pad. These are recorded
control inputs. The course geometry, objectives, actors, collisions and flight
model are unchanged.

The existing playback controls provide mode selection, pause/resume, restart,
half speed, FPV/chase views and **Fly this challenge**. Watching stays separate
from completion records, medals, playlist progress and personal-best comparisons.
Availability requires an exact normalized course fingerprint; starting playback
also replays the proof against its exact runtime, response, rules, conditions and
final-state identity.

## Reproduction

`authoring/fpv-worlds/demonstrations/generate-warehouse.mjs` is a portable offline
authoring tool. Its README documents the recipe. Running the installed generator
in a fresh Node process reproduced all 16 complete course/proof artifact hashes
exactly. Independent Node replay confirmed completion, full health and zero
contacts. The 24 legacy and 32 existing v2 proof hashes were compared after
integration and remain exact.

`warehouse-provenance.json` retains source/runtime hashes, generator identity,
per-artifact and per-proof hashes, heading measurements and reproduction/browser
evidence. The new proof data totals 717,446 bytes. The generator is excluded from
the shipped player runtime; there is no gameplay autopilot.

## Player verification

- All 16 new proofs replayed in the final packaged Chromium runtime to complete
  with health 100 and zero contacts. The catalogue presents 36 example links;
  Stadium and the other unrecorded worlds receive no demonstration action.
- Central Aisle completed in visible playback. Restart, Self-level/Acro selection,
  half speed and **Fly this challenge** worked without creating a completion record.
- Central Aisle and Beam Circuit were inspected in FPV and chase views. The gate
  markers remain readable, the pace rival has separation, and the orthogonal
  approach slows before turning. Existing sector UI correctly labels these as
  playback with no personal-best comparison.
- The packaged application reloaded offline, retained all 36 example links and
  completed Warehouse 01. Ukrainian copy and playback controls fit a 390×844
  viewport without horizontal overflow. No JavaScript page errors were observed.
- Focused lint, syntax, whitespace and dependency-closure build checks passed.
  The separate playtest contains 75 files and 10,900,786 bytes.

Final built-browser findings are recorded in the provenance manifest. Browser
presentation, physical-device performance and unfamiliar-player readability have
different acceptance scopes: the Chromium walkthrough validates the interactions
and visible routes described there, while physical-device and broader player
qualification remain outstanding. The remaining 48 mode-specific demonstrations
and final-phase unit coverage are separate work.
