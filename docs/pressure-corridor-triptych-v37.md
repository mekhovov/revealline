# Ukrainian pressure corridor triptych — `whole-spatial-v37`

Status: implemented candidate in PR #735; balance review and release pending.

This copy-on-write successor to `whole-spatial-v36` adds blocking geometry to
three advanced missions while preserving their established pressure systems.
Enemy roles, warning and commitment timing, gates, terrain, foundations,
objectives, bonuses, pictures, progression and every earlier edition remain
unchanged.

| Mission                             | Cultural vocabulary                                                    | Route decision                                                                                                  |
| ----------------------------------- | ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Pressure ladder                     | Hutsul diagonal-braid records inform staggered cadence only            | Repeated short upper feints after each lock, or a longer slow-field route to establish the far landing          |
| Cooling loop                        | Polissia woven-curtain records inform separated-band organization only | Build an erosion-resistant permanent loop, or neutralize a lethal bank and maintain its faster earned route     |
| Switchback exchange (`relay-remix`) | A museum towel record informs separated-rhombus organization only      | Open the compact western connector first, or cross the wider eastern court before expanding the roamer's domain |

The layouts are original gameplay geometry. No source textile, ornament,
symbol, motif, palette, meaning or coordinates are copied. Walls remain
blockers and never act as reclaimed return surfaces.

## Acceptance boundary

- The three maps retain a single communicating field region.
- Gentle, Standard and Expert preserve the prior authored actors, rules,
  objectives, bonuses and equal Versus boards.
- Relay gates and their stable coverage denominator remain unchanged.
- A stationary craft survives the first 180 fixed ticks in every changed
  mission and preset after the actual gameplay tuning path is applied once.
- `whole-spatial-v36` and every older route keep their pinned snapshots.
- The edition is opt-in and remains balance-review-pending until human route,
  fairness, cultural and retry-quality review.

Automated verification establishes structural and deterministic behavior, not
enjoyment or cultural authenticity.

## Effective first-return evidence

`game/test/pressure-corridor-effective-routes.test.mjs` exercises two bounded
opening approaches per mission, with Gentle/Standard/Expert, immediate/Grid +
Buffer steering and seeds 1 and 917. It prepares the resolved level through
`applyGameplayTuning(level, resolveGameplayTuning(preset))`, matching gameplay
at default admin settings, rather than treating authored speeds as runtime speeds.
The tuning revision is `gameplay-pressure.v4`.

| Mission             | First return tested                           | Deliberate input window                                                                                     |
| ------------------- | --------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Pressure ladder     | Short upper landing via the inner shoulder    | Wait 0 ticks on Gentle or 120 on Standard/Expert; move left to the inner upper approach, then up to closure |
| Pressure ladder     | Lower landing through the slow-field approach | Wait 0/300/240 ticks on Gentle/Standard/Expert; descend through the slow field, then turn right to closure  |
| Cooling loop        | Northern permanent landing                    | Move up to closure                                                                                          |
| Cooling loop        | Western permanent landing                     | Move left to closure                                                                                        |
| Switchback exchange | Upper relay opens the west connector          | Move up through the relay to the north landing                                                              |
| Switchback exchange | East relay opens the east connector           | Move right on the foundation, then turn up through the second relay                                         |

These are **first returns, not full clears or the two complete strategic routes**.
Waiting is recorded legal input, not an enemy pause or edited simulation. A
frontier patrol catches several naive immediate departures in Pressure ladder;
observed failures are not erased by finding another route. The tested windows
show feasible alternatives, not that every departure is safe or human-readable.

The matrix checks no lost life, no collected bonus, a completed/stopped craft,
deterministic replay and equal real Versus boards. Relay cases also check the
chosen objective, exact opened connector and stable coverage denominator.
It does not establish a complete cooling-bank/erosion decision, a full
interceptor warning/commit/recovery interaction, mastery, realistic duration,
mobile controls, or enjoyment. Those remain acceptance work before default
promotion.

## How to review the prepared edition

Use the candidate host, or its frozen release **after publication**:

- Solo: `game/?journey=whole-spatial-v37`.
- Versus: `game/couch/?journey=whole-spatial-v37`.
- Open **Choose mission**, then search for **Pressure ladder**, **Cooling loop**,
  or **Switchback exchange** (the displayed name of `relay-remix`).
- Previous edition: substitute `whole-spatial-v36` in the same host path.

The ordinary Solo/Versus default remains v25. Studio's current edition selector
and curated prior-edition cards do not yet expose all of v35–v37. These direct
review paths do not imply that the candidate is already public, default, or fully
balance-qualified.
