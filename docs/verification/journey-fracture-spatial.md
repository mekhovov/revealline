# Two Districts spatial study — not yet qualified

The independently reviewed [design](../superpowers/specs/2026-09-21-two-districts-spatial-design.md)
is implemented as `fracture-spatial-review`, revision `district-spatial-1`.
Initial source `bd4b0e91`; the Studio database retry fix follows at `cc9f6c81`.
Old Fracture and whole-pressure editions remain unchanged. No enrollment or
public release is claimed; **optional-mastery feasibility is still unresolved**.

## Implemented difference and verification

Two asymmetric reclaimed islands, four open baffles and two familiar keepers
supplement the existing center spine, eroders and frontier. Slow/lethal fields,
77% quota, zero required objectives, player handling, preset recipes and warnings
are unchanged. The authoring metadata records the added role and proposed higher
threat-density facet; this rating is not a human balance finding.

There are exactly two initial retained regions, each with an eroder and keeper;
no empty chamber auto-fills. The three reclaimed components have260/22/20 usable
departure cells.190 interior foundation cells never score;2078 field cells are
earnable. Disconnected foundations are intentional and reported by the compiler.

All six preset/control immediate Left returns close at126ticks (1.05seconds),
securing0.433% without loss. All six seed1 idle probes survive10seconds. The four
old Standard/Expert17–25second paths remain exact historical controls, but no
longer clear this geometry. Shared rules and the other six Fracture levels remain
unchanged; Solo and Versus compile to the same level.

Fresh public-input clears, public replays and equal independent races cover all
six configurations plus six seed2 and six seed1/180tick-delay samples: **18/18**.
All collect zero bonuses, keep the coverage denominator fixed and protect
foundations against erosion and scoring. Seed2 repeats deterministic actor paths
where no randomized recipe is involved; it is not evidence of broad variation.

Base clear seconds / closures (immediate; Grid + Buffer):

| Preset | Immediate | Grid + Buffer |
|---|---:|---:|
| Gentle |46.45s /7|65.65s /14|
| Standard |35.25s /4|35.65s /4|
| Expert |56.25s /11|39.55s /5|

Delayed samples range35.95–65.65seconds. Different routes and eroder timing mean
these times do not rank preset difficulty. The remaining35–40second optimized
clears are still pacing review flags; no mandatory minimum wait was introduced.

The candidate/compiler/Studio/probe cohort passes34/34, and route packet19/19,
on Node20.19.5 and22.22.2. Following the descriptive role/density correction, the
29 directly affected candidate/route tests were rerun with identical simulation
identities/checkpoints. Lint, formatting and whitespace pass.

## Native observation and storage issue

Exact-source local8821 Studio first loaded `bd4b0e91`. Inspect left the previous
draft active; Apply opened a separate project slot. Undo is intentionally local
to a project, so cross-project restoration is tested through saved checkpoints,
not by pretending a project switch is an Undo entry. The spec correction received
independent approval.

The initial disposable session encountered a closing IndexedDB connection, and
the original `my-journey` checkpoint was absent after reload. It was not treated
as successfully persisted or recovered. The stale connection cache was reproduced
in failing tests, then fixed in `cc9f6c81`; see [storage evidence](studio-closed-storage-retry.md).
On that exact source, a freshly saved baseline checkpoint1 was restored after
editing the study; the study separately restored checkpoint4. Within-study
Apply/Undo/Redo restored the corresponding source without changing the other slot.

Native map inspection confirmed the asymmetric islands, four baffles, both terrain
areas and four retaining actors across two regions. Expert preview reached Engine
ready; a real Left tap closed on the western island at0.4%, retained both lives,
stopped steering on closure and paused at21seconds. No browser warnings/errors
were reported on the fixed-source page. This is a first-return observation, not
a full native clear or physical controller/touch test. The later role/density
metadata correction does not change its simulation identity.

## Required follow-up before qualification

- **0/18 current routes meet optional mastery.** All close cuts in both districts,
  but leave part of the eastern lethal field unclaimed. Ten also repair erosion.
  This does not prove mastery impossible; the area-greedy probe does not prioritize
  hazard neutralization. Find targeted legal-input mastery routes across all six
  configurations, or revise the eastern baffle/anchor approach if needed. Do not
  remove the goal, make it mandatory or claim it complete from ordinary clears.
- Verify useful island returns during later play, readable eroder/frontier pressure,
  and that each district offers distinct decisions without repetitive cleanup.
- Human pacing/understanding/retry, additional native play, device/accessibility,
  final pictures/actor presentation, host qualification, independent integration
  review and Pages deployment remain. Greybox availability in Studio is not release.
