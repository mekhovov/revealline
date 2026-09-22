# Pressure catalogue successor — implementation evidence

Scope: versioned authoring/compiler candidate, **not public deployment or final
balance acceptance**. See the [revised specification](../superpowers/specs/2026-09-21-journey-pressure-and-variety.md).

## Implemented

- Immutable `journey-difficulty-v2`, selected explicitly by project. Existing v1
  remains the default for historical imports and direct compiler callers.
- Gentle/Standard/Expert moving multipliers1/1.4/1.75; attack rest multipliers
  1.25/0.85/0.65;5/3/2 lives. Craft handling, warnings, active attacks and Sentinel
  CORE OPEN/transition/initial grace are unchanged. Gentle deadlines non-failing.
- Shared Solo/Versus/Team actor compilation, execution catalogues and Journey
  resolution select the pinned catalogue. Team still rejects unqualified mechanics.
- Studio shows effective movement and cadence from those same functions, including
  Sentinel rest and core-open duration. No arbitrary per-actor physics controls.
- Copy-on-write `withPressureDifficulty` revisions project/mission/campaign/pack
  identities, retains geometry/assets and refuses unregistered catalogues.
- `inspectPressureDifficulty` lists exact actors, domains, units, cadence, facets,
  diagnostics and unfulfilled qualification for every mission/mode/preset.
- Shared CLI supports `--pressure` and explicit `--pressure-candidate` JSON output.
  Neither command writes/publishes a project or silently enrolls it in gameplay.

## Route probe: stronger does not mean balanced

`node --import ./.cache/read-source-git.mjs scripts/probe-journey-pressure.mjs`

The sparse-checkout adapter reads only exact Git fixtures; full checkouts can omit
it. The probe replays all83 historical Standard/immediate/seed1 routes and checks
their original simulation/checkpoint hashes before comparing the successor.

- 83/83 old routes reproduced no-loss clears with exact identity/checkpoint.
- 12/83 of those SAME routes still clear without loss under pressure-v2.
- 71 require new route investigation. This does **not** establish that71 maps are
  impossible or too hard: many routes depend on enemy phase at an exact tick.
- Four retained no-loss clears finish below15 seconds: First Return3.45s,
  Choose Your Share7.05s, Twin Receivers9.9583s, Relay Perimeter12.15s.
  Short teaching demonstrations may be intentional; the latter two late Sentinel
  maps are structural pacing risks and need redesign/measurement, not speed alone.

Promotion remains blocked until new bonus-independent routes, safe departures,
multiple seeds/delays, objective/coverage cleanup, native readability and human
balance are qualified. Do not replace historical fixtures with the failed paths
or call this whole-library balancing complete.

The subsequent [all-preset route assessment](journey-pressure-route-assessment.md)
now covers498 cases across83 missions, three presets and both steering modes.
Bounded reuse/retiming of historical legal routes finds312 no-loss clears with
fresh replays and equal paired-board races;303 collect no pickups.186 cases still
need new routes or redesign. This does not contradict the12/83 result above,
which reused only each mission's unmodified Standard/immediate input sequence.

## Verification

Initial compiler/catalogue/Studio/replay regression cohort:44/44 Node20; expanded
CLI cohort46/46 Node22. Broader final cohort with save/restore, legacy Sentinel
labels and Team route regressions:58/58 on each of Node20 and Node22.
All83 Solo candidates resolve498 mode/preset manifests and12 Team candidates36.
Old simulation identities remain separated; Solo/Versus are equal; new encounters
replay and restore exactly. Final touched-code ESLint and diff whitespace checks
passed. No failed technical check is being waived for promotion.

One regression during development: the old Sentinel panel's fixed-cadence label
was unnecessarily changed. Restored that label for v1 and show difficulty-sensitive
rest wording only for v2; subsequent Node20 cohort passed.

Timed bonus schedules, new cultural/workshop layouts and additional enemy roles
are specified next increments, **not implemented by this change**. Physical
controller/touch, native v2 Studio screenshots, live two-player balance, final human
acceptance and GitHub Pages remain outstanding.
