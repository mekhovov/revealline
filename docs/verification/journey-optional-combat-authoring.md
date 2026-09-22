# Optional combat D2b — shared authoring and greybox evidence

Date: 2026-09-21. Follows the independently approved
[authoring specification](../superpowers/specs/2026-09-21-combat-authoring-design.md)
and [D2a runtime](journey-optional-combat-runtime.md). Local reviewed implementation,
not a player-facing release or a claim that the whole optional-combat feature is done.

## Implemented

- Additive actor catalogue v8 preserves every v1–v7 recipe. Optional scout/sentry
  roles share the existing authored actor list and 24-actor mission budget.
  Strict explicit combat flags work with MissionDesignV1–V4; unsupported Team
  data, including disabled combat, fails closed. Ordinary field keepers remain
  separate and alone retain field regions.
- One compiler resolves measured/standard/brisk speeds and preset movement/rest
  pressure once. Optional actors never inherit arbitrary instance physics.
  Disabled inspection shows authored speed and zero active speed separately.
- Copy-on-write Prepare and Enable/Disable commands preserve maps/assets,
  unrelated missions and published editions. Changed dependency revisions,
  exact no-ops, undo/redo and invalid rollback are tested.
- Studio uses shared actor CRUD, exact sentry timing, explicit edition controls,
  colour-independent scout/sentry markers and inactive slashes/labels. Static
  capture inspection lists affected optional actors and initial remote auto-fill
  warnings without changing keeper connectivity or advancing simulation.
- Enabled live gameplay preview is centrally blocked until D2c renders readable
  actors and shots. Static inspection, validated candidate export and disabled
  previews remain available. The separate three-study inspection does not Apply,
  enable public content or award Journey progress automatically.
- Review found and fixed an older encounter-editor catalogue downgrade: editing
  a Sentinel now retains a newer catalogue containing its exact recipe. Tests
  cover old upgrades, v7 retention and disabled empty combat on the same or an
  unrelated mission. No D2a combat simulation change was needed.

## Three original interaction studies

These are shared-framework Solo/Versus greyboxes with foundations, walls and
retaining keepers, not completed art or public campaign additions. Each specifies
its route decision, lesson, counterplay, capture consequence, mastery, difficulty
facets and 45–120-second duration hypothesis. None requires a timer, bonus or
elimination objective.

| Study           | Spatial decision                                                                     | Seed1 clear seconds: Gentle / Standard / Expert, immediate then Grid |
| --------------- | ------------------------------------------------------------------------------------ | -------------------------------------------------------------------- |
| Workshop sweep  | Direct scout contact versus enclosing it while avoiding ordinary keepers             | 27.55 /26.85;24.75 /29.35;20.75 /27.85                               |
| Sentry detour   | Wall-screened approach versus changing route after locked aim                        | 40.15 /40.65;43.35 /22.95;38.75 /53.95                               |
| Two-bay service | Remove the northern threat versus improve a southern return; both bays stay retained | 43.55 /43.75;40.35 /49.75;54.15 /60.75                               |

The first Two-bay draft cleared in14.35–21.35seconds. An additional ordinary
keeper in each bay made return placement matter across more cuts; the final
unpublished draft was then reprobed. This is a geometry/pressure hypothesis,
not proof of better enjoyment. Workshop and Sentry still have short routes and
preset inversions; do not pad quotas or impose waits to force a target duration.

## Verification

**219 tests pass on Node20.19.5 and Node22.22.2**, one full final invocation per
version. This includes69 newly added D2b cases and150 prior cases (including all45
D2a cases), not219 new tests. Scoped ESLint, Prettier and whitespace checks pass.
Independent review approved code and route evidence after the catalogue fix.

The43-case route file covers21 recorded paths: all18 mission/preset/control
combinations at seed1, plus one Standard/immediate seed2 path for each mission.
Each path is checked with combat on and off:

- **42 no-loss clears and matching public-input replays**, with exact pinned
  checkpoints, no pickups and equal on/off coverage. Combat cannot retain territory.
- **42 real paired-board races**, both independently owned runs clear together
  with equal checkpoints and no lost life; no shared combat state.
- Contact and capture removals are actually observed. Sentry Standard/Grid/seed1
  fires with204 exposed live-projectile ticks; Standard/immediate/seed2 fires
  with234. Neither hits the craft and both later end with capture removal.
- Other paths can cancel warning or bypass optional actors. Workshop Standard/
  immediate/seed1 removes neither scout. This is explicitly not proof every route
  teaches the mechanic or achieves optional mastery.
- Seed2 changes optional actors' private random paths and removal observations;
  ordinary keeper trajectories and the chosen clear times remain unchanged.
  Three seed2 samples are not an exhaustive seed balance pass.

Recorded public inputs live in `game/test/fixtures/combat-candidate-routes.json`;
exact events/checkpoints in `combat-candidate-observations.json`. The helper uses
public step/record/replay calls, never injected capture, removals or victories.
The route finder is a bounded omniscient feasibility search, not a human player.
An initial parallel Standard/Grid Two-bay process returned empty output; its
terminal retry produced the pinned5970-tick clear. No failed result was counted.

## Research recheck and next gates

Primary pages rechecked on2026-09-21:
[Xposed Reloaded](https://store.playstation.com/en-us/concept/10002881/) emphasizes
simple controls, challenging territory revelation and backgrounds;
[AirXonix's developer rules](https://www.axysoft.com/airxonix/) distinguish interior
balls, filled-ground mines and bonuses;
[Mike Stout's attack-design article](https://www.gamedeveloper.com/design/enemy-attacks-and-telegraphing)
argues for communicating avoidable attacks before damage. Application here is
an original design inference: preserve route/capture decisions, distinct domains,
locked warning and counterplay rather than merely increasing every speed.
These sources do not verify Reloaded's exact timings or guarantee addictiveness.

1. D2c: pixel actors, locked aim, projectile/impact cues, bounded scrap, captions/
   sound, reduced-effects options and persistent restart-or-next player preference.
2. Native Studio authoring/Undo/inspection and live preview after readable D2c;
   this increment claims automated Studio checks only.
3. Refine short/bypassed encounters, optional mastery routes, final art, multi-seed
   and human failure-understanding/enjoyment testing. Passing a route is not balance.
4. D2d: explicitly versioned Team semantics and joint/controller qualification.
5. Reviewed host integration, release-owner version allocation, immutable release,
   exact-source Pages checks. No deployment was performed by this increment.

The original soundtrack remains paused; this work does not resume it.
