# Phaseworks Ukrainian cultural routes · successor v20

Status: implementation candidate. The stacked cultural-route work is rebased onto `main` at
`e3ed95c73`. Local route enrollment and the focused content, replay, Versus, selector, Studio and
default-host checks below are complete on this candidate. Merge, frozen-build qualification,
public delivery and human cultural/balance review remain open. This document is not release
evidence.

## Scope

This bounded successor redesigns three Phaseworks identities and preserves their exact v19
editions in the unified selector:

| Mission | New spatial decision | Preserved behavior |
| --- | --- | --- |
| **A return in reserve** | Cancel the first visible pursuit at the short central band, or make a longer exposed approach and bank the lower reserve as a stronger future return. | Pursuer, two keepers, perimeter patrol, impact policy, quota, objectives, bonuses and art. |
| **Two ways home** | Establish the shorter west stepped return, or feint through the centre and close at the east network after the pursuer commits. | Pursuer, keeper, frontier patrol, impact policy, quota, objectives, bonuses and art. |
| **Dogleg transfer** | Use the central dogleg and wall screen for a short close, or bank the outer compartment before working through the lower hazard. | Pursuer, two keepers, impact policy, quota, objectives, bonuses and art. |

The successor changes authored walls, foundations, terrain, spawn placement and actor attachment
only where the new topology requires it. Existing physics, difficulty catalogues, objectives,
bonuses, timed bonuses, coverage targets and presentation remain stable. Foundations close cuts;
walls block movement and sensing but never become return ground.

## Cultural source boundaries

- The [Ivan Honchar Museum's Krolevets woven towel record](https://honchar.org.ua/en/collections/detail/1846)
  documents geometric ornament, shaft weaving and a long textile format. A return in reserve
  borrows alternating long-band rhythm only. It does not copy the towel, an ornament, weave
  draft, palette, meaning or source coordinates.
- The [museum's Hutsul embroidered shirt record](https://honchar.org.ua/en/collections/detail/1471)
  lists geometric ornament, diagonal cross stitch, Hutsulian braid and diamond-producing
  techniques. Two ways home borrows diagonal alternation only. It does not copy the shirt, a
  stitch chart, braid, diamond motif, palette, meaning or source coordinates.
- The [museum's Kosmach pysanka record](https://honchar.org.ua/en/collections/detail/1706)
  documents wax-resist layering and geometric/floral classifications arranged within one bounded
  surface. Dogleg transfer borrows layered compartment organization only. It does not copy the
  egg, ornament elements, symbols, palette, wax sequence, meaning or source coordinates.

These records support cultural context and broad compositional vocabulary. They do not establish
gameplay balance, permission to copy an object or universal symbolic meanings.

## Verification performed so far

- Copy-on-write isolation for artwork and greybox factories.
- Exact preservation of policies, rules, role counts, objectives, bonuses, timed bonuses and
  presentation.
- Deliberately disconnected permanent returns and valid effective runtime topology on Gentle,
  Standard and Expert.
- Two deterministic approaches per mission, both steering modes and two seeds.
- Safe idle openings on every preset, replay stability and equal paired Versus boards.
- Public-command lifecycle proof for immediate and Grid + Buffer steering: warning, fixed
  commitment, a turned return, capture-stop and finite recovery.
- A fresh tuned Standard route clears A return in reserve in six captures at 98.33% without a
  life loss; the fixture resolves the authored Next to Two ways home.
- 175/175 focused candidate, registration, history, Studio, Solo/Versus host and selector checks.
- Exact v19 Phaseworks cards remain independently launchable; v20 owns separate progress and
  suspension keys.

The Team remote-host cohort recorded 12 passes and one inherited failure in the blur-interruption
chooser-close assertion. The equivalent Escape path, v20 metadata inventory and cross-mode
handoffs pass. This suite is not represented as passing.

## Current plan status

Completed as source candidates, not public releases: Border v12, Border/Signal v13, early-route
v14, Signal v15, Neon v16/v17, Rover v18, Fractured Grid v19 and this Phaseworks v20 slice. All
prior editions remain selectable.

Remaining, in order:

1. Review and merge the stacked PRs in dependency order; qualify and publish each accepted
   cumulative release through the sole publisher.
2. Redesign Livewire, Relay and Crosswind around crossing windows, objective ordering, permanent
   shortcuts and directional-route tradeoffs.
3. Redesign Sentinel and Apex around distinct shield approaches and capstone combinations without
   arbitrary per-level physics.
4. Build the separately authored Team progression and remaining Ukrainian/FPV studies around
   complementary captures.
5. Run whole-Journey pacing, accessibility, performance, physical-device and human cultural/
   balance qualification.

The next three-mission campaign slice is estimated at 16–28 implementation hours before release
serialization; review and public promotion time is additional. Until human testing establishes
readable failures, distinct challenge and enjoyable retry behavior, these candidates remain
**balance pending**.

## Remaining gates for this slice

- Run final validation, changed-file lint, formatting and diff-integrity checks on the exact commit.
- Review and merge the cultural route PR stack in order, then allocate a release only through the
  sole publisher.
- Qualify the frozen build and verify the actual public Pages deployment.
- Conduct human cultural, readability and balance review.
