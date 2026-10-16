# Pro and Master Flight School

2 October 2026. The implemented school now has **58 lessons and 374 guided steps**:
46 primary Acro lessons and 12 optional self-level fundamentals. The complete
selectable catalogue contains 118 challenges. This increment supplies the final
16 lessons and 115 steps; the preceding 16 Experienced/Advanced lessons are in
[PR #939](https://github.com/mekhovov/revealline/pull/939). All lessons remain
immediately available; tier order and prerequisites are recommendations.

Implementation and integrated browser verification are complete locally. Frozen
package admission and publication are recorded below as they finish. Protected
merge and verified public deployment remain separate gates; local evidence does
not mean the feature is live.

## Authored content

| IDs   | Tier   | Distinct tasks                                                                                                                  |
| ----- | ------ | ------------------------------------------------------------------------------------------------------------------------------- |
| 43–46 | Pro    | Full roll both ways; forward/backward flip; yaw360 both ways; inverted recognition and recovery.                                |
| 47–50 | Pro    | Split-S descending reversal; Immelmann climbing reversal; nose-first dive and pullout; full spatial powerloop around a beam.    |
| 51–54 | Master | Travelling barrel; landmark orbit in both directions; two-turn climbing corkscrew; half-roll/inverted-yaw/recovery combination. |
| 55–58 | Master | Loop into roll; Split-S into orbit; racing line with roll/dive zones;17-step combined route ending on a physical3m platform.    |

Every lesson has EN/UK titles, instructions, explanations, recovery tips and an
actual complete recording at the existing **Gentle 240°/s response**. Spawns are
on the ground and endings require real supported landings. The last route takes
5,285 fixed ticks (105.7 simulated seconds) in its demonstration; it retains real
movement between all 17 objectives. No state injection, teleport or changed
physics is used to manufacture completion.

The separate content identity is `fpv-skills-school:ccdbc4f61adad55a`. The previous
42 lesson objects and catalogue identities remain unchanged. Skills are Acro-only:
the runtime rejects self-level for any course containing a skill objective, and
player entry points select the appropriate mode. Existing course/proof formats
and the flight model identity remain compatible.

## Criteria, teaching and creator support

The [versioned objective contract](fpv-skill-objectives.md) measures signed body
rotations with intermediate quaternion attitudes, brief attitude holds, spatial
winding and direction-aware plane crossings. Coupled paths require rotation and travel
to develop together. Authored corridors keep beam loops near the real structure;
flat landmark orbits enforce their stated height range. A flip beside the beam,
a yaw spin in place or an orbit 10m above the instructed band does not qualify.

The continuous coach uses complete recorded flights: watch, take control, finish
the current objective and continue without a menu between steps. Checkpoint
practice remains unscored; watching or taking over a demonstration cannot create
a complete scored medal. Numeric progress is read from the current runtime
criterion only. EN/UK hints explain entry, direction, clearance, timing and path
reset reasons. Existing gate/hold/landing displays remain unchanged.

The shared schematic shows the real attitude and motion, bounded airborne zones,
path direction and actual crossing apertures. The world renderer draws matching
rotation, attitude, path and crossing cues. Creator moves and reimports translate
all dependent geometry together; unsupported rotation or scaling of skill
anchors is rejected atomically. Export/import round trips retain exact criteria.
The 10-inch quad/motor presentation and continuous controls foundation belong to
[PR #938](https://github.com/mekhovov/revealline/pull/938); they are not counted as
new lessons or claimed again as this increment's graphics work.

## Recorded evidence

| Evidence                                                                       | Result and scope                                                                                                                                                                                                                                                  |
| ------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Model qualification](evidence/fpv-skills-model-20261002.json)                 | All 90 v2 recordings and 24 original Academy v1 recordings replay. Previous 74 v2 proof bytes and 42 school definitions/identities survive; 121,178 legacy snapshots compared. 21 criterion probes, 6 semantic counterexamples and 16 positive skill traces pass. |
| [Schema boundary review](evidence/fpv-skills-schema-boundary-20261002.json)    | 20 bounded validator checks; malformed, nonplain, accessor/script and oversized criterion payloads rejected without executing imported code.                                                                                                                      |
| [Content integration](evidence/fpv-skills-content-integration-20261002.json)   | 14 translation, round-trip, reimport and real Three.js geometry checks; includes exact signed half-path arcs in 24 plane/bearing/direction combinations. This is not a GPU performance claim.                                                                     |
| [Continuous browser run](evidence/fpv-skills-continuous-browser-20261002.json) | 119/119 checks across 58 lessons and 374 descriptions: exact example playback, seeking, takeover, objective continuation and lifecycle.                                                                                                                           |
| [Tier browser run](evidence/fpv-skills-tiers-browser-20261002.json)            | 14/14 production-page checks: six tiers, 46-lesson primary order, progress revision matching, open access, Continue, language, focus and fullscreen.                                                                                                              |
| [Maintained authoring qualifier](evidence/fpv-skills-authoring-20261002.json)  | All 16 recordings regenerated from 35,045 ordinary command frames, exactly matching installed recordings, with zero contacts and independent replay.                                                                                                              |
| [Teaching feedback qualification](evidence/fpv-skills-feedback-20261002.json)  | 16,734 localized samples across all16 flights, four criterion types and 13 retry reasons. Observer-only behavior, stale-step exclusion and old-target behavior verified against current source.                                                                   |

The continuous browser run measured maximum synchronous open 93.5ms and
last-step seek 90.5ms on the local browser. These are operation samples, not
sustained device frame times or physical-radio latency. Receipts identify final source inputs, including corrected Ukrainian spacing,
crossing-tolerance wording and validator boundaries.

The [integrated host run](evidence/fpv-skills-host-browser-20261002.json) passes
70/70 checks: all16 new School/Fly/playlist entries, EN/UK instructions, exact
recording export, creator pack round trips, forced Acro mode with restored usual
preferences, proof archive restoration and fresh-host backup retention. The
initial run exposed local disk exhaustion and two harness defects: cross-realm
IndexedDB objects and property-order-sensitive JSON comparisons. These were
corrected in the isolated verification fixture, retaining production data
validation and checking every objective value through canonical equality.

## Reproduce the recordings

```sh
node scripts/qualify-fpv-skill-school.mjs
node scripts/qualify-fpv-skill-school.mjs --out NEW_DIRECTORY
node scripts/qualify-fpv-skill-school.mjs --lesson beginner-58 --diagnostic
```

The default writes nothing. `--out` exports normalized-source-identity recordings
and a hashed receipt into new files; it refuses to overwrite prior output and
never installs runtime content. The maintained pilot supplies ordinary inputs to
the unchanged integrator. It also compares regenerated commands with any installed
recording for the exact same course/response and fails on an unexpected change.

## Outstanding qualification

Final frozen package/build admission, protected PR publication and verified
public deployment are recorded separately below. Unfamiliar-player
teaching review, fluent Ukrainian review, physical TX15/controller acceptance,
mobile touch/device coverage and sustained graphics/performance measurements
remain human/device qualification. Additional unit coverage is deferred to the
final phase. Pro/Master are simulator curriculum names, not professional or
real-world flight certifications.

## Frozen player build

Runtime `e1db800b440bf9cc90d3c9229f4b36fff1ac5440` passes all three optional
package admissions, committed-input and ZIP-member verification, and two
byte-identical builds; [package receipt](evidence/fpv-skills-package-20261002.json).
Academy62 runtime/64 source files and World Studio94/96 remain within unchanged
policies. Both `dist/fpv-skills-school-playtest` and the existing
`dist/fpv-reviewed-player-playtest` are rebuilt from that runtime:87 player files,
13,894,752bytes, ZIP SHA-256
`83b785dd5c4ad07b8615880a581597ed35926642694fc06934ce4168da3aed7f`.
This is a local development playtest, not release or public-deployment acceptance.

Published for review in [PR #940](https://github.com/mekhovov/revealline/pull/940),
appended to native stack902 after #939. The existing reviewed-player URL was
launched and its58-lesson catalogue verified. Upstream holds remain; protected
merge and public deployment are not claimed.
