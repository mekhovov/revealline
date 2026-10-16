# Tactical remaster catalogue review

The official catalogue remains 240 missions across 35 chapters. All 240 now have
literal construction-family and focal-assembly descriptors. Fourteen official
missions have changed accepted gameplay recipes; 226 retain their established
gameplay while receiving the shared presentation remaster. No new mission names,
mirrored layouts or larger quotas are counted as additional content.

## What changed

| Mission                                                   | Concrete tactical improvement                                                                                                                                            |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Orchard Post                                              | An L-shaped runner route around the glasshouse ties the interception to unloading and the short return.                                                                  |
| Runner Valve                                              | The committed east-side route makes the cable-held shortcut useful for interception.                                                                                     |
| Refuge Cargo                                              | A refuge route through the aisle creates a choice between the fixed east dock and the two interception ends.                                                             |
| North–South                                               | Complementary pair endpoints make wrapping a deliberate interception shortcut.                                                                                           |
| Silent Parcel                                             | The antenna changes posts only during recovery, changing the useful cargo approach without moving a live transmission.                                                   |
| Watch the Aim                                             | A short guard recovery route prevents repeated camping of one safe flank; the new post receives a fresh warning.                                                         |
| Freight Flank                                             | The shield uses the cargo aisle, connecting facing, flanking and loaded turning room.                                                                                    |
| Pressure Elbow                                            | A committed east-side runner makes holding the plate shortcut an interception decision.                                                                                  |
| Border Watch / Contour Orbit / Wake Watch / Ricochet Line | Each introduction finishes after three distinct demonstrations instead of six repetitions of the same single policy; mixed-policy successors retain their longer quotas. |
| Loaded Excavation                                         | Recessing the far side of marked stone lets erosion open the promised direct delivery passage.                                                                           |
| Harvest Rendezvous                                        | A committed cross-aisle sprint connects both deliveries to one readable timing decision.                                                                                 |

The first six prototype encounter IDs and their Solo/Team modes are exported from
`classic-catalogue-remaster.mjs`. All visual directions use those same accepted
missions; the comparison does not substitute different geometry or gameplay.

## The complete review record

`catalogue-review.json` contains one entry per official mission: its authored
central decision, starting approach, accepted-catch/objective pressure, a static
turning-space observation, focal assembly and concrete differences from the
previous mission. These briefs preserve the existing individually authored
mission descriptions rather than assigning the same generic instruction to an
entire enemy family.

This is a reproducible recipe and geometry review. The suggested turning area is
not a promise of safety from cable, moving enemies or hazards. The review does not
claim that all 240 missions have been observed in a player study or that a textual
distinction proves enjoyment.

All six worlds have three construction families. Of the 240 missions, 203 have an
authored focal anchor occupying a real contiguous 2×2 wall area. The remaining 37
are open or use thin structures; their descriptors explicitly omit the solid
landmark anchor so rendering cannot add a false obstacle. Open Loop remains
completely obstacle-free. Focal footprints are cosmetic metadata, outside recipe
identity, and renderers must still clip holes and eroded cells.

## Verification

- 54 accepted winning journals cover the nine tactical revisions in Solo and Team
  at normal, slow and fast pace, level seed 17 and hazard seed 17.
- Thirty editorial journals verify Loaded Excavation’s revised geometry and four shortened introductions across all mode/pace setups.
- A further 12 journals cover the mobile-jammer mission at hazard seeds 73 and
  2026 across the same six mode/pace combinations.
- The previous Release A/B fixture verification remains intact. Current-record
  capacity tests substitute remastered journals only for changed official
  recipes; old journals are not silently relabelled as new evidence.
- Original 144-mission review and proof checks remain intact; ten operation revisions and four field introductions retain their predecessor recipes in the archive.
- `review-snake-remaster.mjs --check` checks that the review still corresponds to
  the catalogue. `qualify-snake-remaster.mjs --check` verifies retained journals
  against current accepted recipes.

Solvability is evidence of a working route, not proof of beauty, difficulty
calibration or fun. Player-rated pacing and presentation remain part of the
optional comparison feedback; none is reported as completed here.

## Local trace review

`review-snake-traces.mjs` restores all 66 verified tactical journals through the shared
match `onStep` observer and writes `trace-review.json`. It counts every accepted
catch, including simultaneous Team catches, without relying on capped recent
event arrays. Ordinary target movement does not reset the no-change interval;
encounter phases, intentions, reception and accepted objective events do.

Across these particular winning routes, the largest repeated capture location
held two catches; the largest concentration was 50%. The longest interval without
an encounter/objective change was 21 moves, or 5,880 ms at slow pace, in Team's
Watch the Aim route. None crossed the initial review thresholds of three catches
at one cell with at least 50% concentration, or 24 moves / 6,000 ms without change.

These are review signals only. This tactical subset covers nine revised missions and one
winning route per setup. The separate `catalogue-trace-review.md` covers all 240
missions; neither report samples all possible player strategies.
A result below the thresholds does not establish that a mission is enjoyable.
The thresholds are explicit in the report and should be reconsidered when
observed player behaviour supplies better evidence.
