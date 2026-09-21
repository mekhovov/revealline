# Whole-Journey pressure route assessment

Source policy: `journey-arcade-v2`; explicit difficulty catalogue:
`journey-difficulty-v2`. Candidate project revision:
`pressure-v2-629ea4ba0500d271`. All83 Solo candidates, including12 Remixes,
three presets and both steering policies: **498 cases**.

This is a broader successor to the83-route Standard-only comparison, not a
replacement for its historical evidence. No maps, physics, published editions,
save identities, assets or release pins were changed by this assessment.

Current follow-up: [five additive refinement packets now cover498/498 ordinary
cases](journey-middle-pressure.md), preserving the312 successes below and adding
new paths for every previously unresolved identity. The tables and186 unresolved
count below describe the **original bounded reuse search**, not current route
coverage. Short clears, optional goals, teaching, Team and human balance remain
open; the original failures are retained as evidence rather than erased.

## Method and limits

`node --import ./.cache/read-source-git.mjs scripts/assess-journey-pressure.mjs [chapter|all]`

Full checkouts can omit the read-only sparse fixture adapter. The command prints
JSONL and never writes or publishes content. Each original preset/steering route
must reproduce its historical simulation identity, final checkpoint and lossless
clear before it supplies evidence. For each stronger-pressure case, try its own
route followed by the two other preset routes for the same mission/steering mode.
Each template tries initial delays0,60,120,180,240,360,480,600,900,1200 ticks. No
interior inputs, claimed cells, enemies or objectives are injected or changed.

The first no-loss success is freshly replayed, with input truncated exactly at
victory. Attempts stop at the first life loss, even if an extra-life pickup could
hide that loss in the current life count. Failed attempts are explicitly
`life-lost` or `route-exhausted`, not “impossible.” At most30 templates/timings
per case is a bounded reuse search, **not exhaustive path planning**.

Seed1 only; all authored bonuses remain present. A no-pickup route collected
zero bonuses; it is not a separately compiled bonus-removed test. Clear seconds
include initial waits. Tick-resolution exposure estimates count a tick if the
craft was cutting before or after that engine step; they are not human reaction
measurements. First coverage completion may precede later erosion, so time since
that event is a review flag, not a proof of monotonically finished coverage.

## Results

Assessment plus shared pressure-catalogue regression cohort: **47/47 tests** on
Node20.19.5 and Node22.22.2. Tests replay every selected clear, compare every
recorded metric/checkpoint, run each equal independent race, and reproduce the
final attempted route for every unresolved case. All498 original historical
identities/checkpoints were checked by the assessment command. Changed JavaScript
passes ESLint, Prettier and whitespace checks. This offline-only change adds no
new native, Team gameplay, human acceptance or deployment evidence.

- **312/498** no-loss clears, each with exact fresh replay and corresponding equal
  independently simulated paired-board race.
- **303/312** collected no bonuses;9 Border cases collected at least one.
- **27/83** missions have a route in all six preset/steering cases.
- **186 cases remain unresolved** by this bounded search.
- Six missions have no passing case: Cooling Loop, Crossbar Depot, Livewire Remix,
  Read the Lock, Long Wave and Returning Light. This does not prove unsolvability.
- Gentle154/166, Standard82/166, Expert76/166. These are reuse-search success counts,
  not player win rates or a quantitative difficulty ranking.

| Campaign | Cases | No-loss clears | Zero-pickup clears | Unresolved |
|---|---:|---:|---:|---:|
| horizon | 60 | 41 | 41 | 19 |
| border | 42 | 31 | 22 | 11 |
| signal | 42 | 30 | 30 | 12 |
| neon | 42 | 32 | 32 | 10 |
| rover | 42 | 30 | 30 | 12 |
| fracture | 42 | 26 | 26 | 16 |
| phase | 42 | 27 | 27 | 15 |
| livewire | 42 | 7 | 7 | 35 |
| relay | 42 | 25 | 25 | 17 |
| crosswind | 42 | 23 | 23 | 19 |
| sentinel | 30 | 27 | 27 | 3 |
| apex | 30 | 13 | 13 | 17 |

## Concrete redesign priorities

1. **Late Sentinel shortcuts:** Twin Receivers clears in9.96–10.06seconds and Relay
   Perimeter in12.15–13.75seconds across all six cases. Moving enemies faster has
   not fixed this structural pacing problem. Rework spatial/objective ordering in
   explicit successor editions; do not merely inflate coverage.
2. **Livewire route/window review:**35/42 cases unresolved, including four maps
   with no passing case. Examine opening approaches, lane overlap and closure
   windows using new route search before deciding between timing and geometry
   changes. Preserve readable tells; do not assume difficulty requires faster
   warnings.
3. **Crosswind/Apex pressure paths:** Long Wave and Returning Light have no passing
   case; Apex has17/30 unresolved. Investigate marked-speed-field return routes and
   established mechanic combinations, not hidden handling changes.
4. **Post-objective tails:** Relay Remix takes39.3–52.9seconds after all required
   objectives in its passing Gentle routes; Nested Relays30.2–37.7seconds in several
   routes; Bank the Crossing24.8–35.1seconds. Relay capture can intentionally start
   a useful next route, so these timings flag possible cleanup, not proven boredom.
   Observe the remaining decisions before cutting coverage or moving objectives.
5. **Every other unresolved case:** create genuinely new routes or revise the
   authored encounter; rerun all six configurations after any change. Keep
   successful old routes as edition-specific evidence, not universal scripts.

This audit does not accept any mission for release, establish a gradual human
difficulty curve or replace multi-seed, physical-device, native feedback, Team,
bonus-removed, full-host or human enjoyment checks.

## Per-mission route coverage

Numbers are passing routes /2 steering policies for each preset. A2/2 is technical
feasibility only; it is not design acceptance. Exact inputs, metrics, failed-attempt
summaries and identities are in
`game/test/fixtures/journey-pressure-route-assessment.json`.

| Campaign / mission ID | Gentle | Standard | Expert |
|---|---:|---:|---:|
| horizon / choose-your-share | 2/2 | 2/2 | 2/2 |
| horizon / courtyard-return | 2/2 | 0/2 | 0/2 |
| horizon / first-return | 2/2 | 2/2 | 2/2 |
| horizon / horizon-remix | 2/2 | 0/2 | 0/2 |
| horizon / island-outpost | 2/2 | 2/2 | 0/2 |
| horizon / long-way-home | 2/2 | 1/2 | 2/2 |
| horizon / nearby-shore | 2/2 | 0/2 | 0/2 |
| horizon / stepping-stones | 2/2 | 2/2 | 2/2 |
| horizon / two-bays | 2/2 | 0/2 | 0/2 |
| horizon / two-keepers | 2/2 | 2/2 | 2/2 |
| border / behind-the-patrol | 2/2 | 2/2 | 2/2 |
| border / border-remix | 2/2 | 1/2 | 1/2 |
| border / long-rail | 2/2 | 2/2 | 2/2 |
| border / new-frontier | 2/2 | 2/2 | 2/2 |
| border / return-pocket | 2/2 | 1/2 | 2/2 |
| border / second-landing | 2/2 | 0/2 | 0/2 |
| border / turn-the-corner | 2/2 | 0/2 | 0/2 |
| signal / cool-the-crossing | 2/2 | 2/2 | 2/2 |
| signal / dry-spine | 2/2 | 0/2 | 0/2 |
| signal / garden-refuges | 2/2 | 2/2 | 2/2 |
| signal / neutral-ground | 2/2 | 0/2 | 0/2 |
| signal / signal-remix | 2/2 | 2/2 | 2/2 |
| signal / soft-crossing | 2/2 | 2/2 | 2/2 |
| signal / wide-approach | 2/2 | 0/2 | 0/2 |
| neon / dogleg-return | 2/2 | 0/2 | 2/2 |
| neon / folded-corner | 2/2 | 0/2 | 2/2 |
| neon / four-quarters | 2/2 | 0/2 | 0/2 |
| neon / inside-out | 2/2 | 0/2 | 2/2 |
| neon / neon-remix | 2/2 | 2/2 | 2/2 |
| neon / side-door-bays | 2/2 | 2/2 | 2/2 |
| neon / staggered-circuit | 2/2 | 2/2 | 2/2 |
| rover / between-the-rows | 2/2 | 2/2 | 2/2 |
| rover / broken-yard | 2/2 | 0/2 | 1/2 |
| rover / rover-remix | 2/2 | 2/2 | 2/2 |
| rover / sorting-yard | 2/2 | 0/2 | 0/2 |
| rover / split-berths | 2/2 | 0/2 | 0/2 |
| rover / stepped-return | 2/2 | 2/2 | 1/2 |
| rover / wake-the-yard | 2/2 | 2/2 | 2/2 |
| fracture / bank-the-crossing | 2/2 | 2/2 | 2/2 |
| fracture / first-fracture | 2/2 | 2/2 | 0/2 |
| fracture / five-anchors | 2/2 | 0/2 | 1/2 |
| fracture / fracture-remix | 2/2 | 1/2 | 0/2 |
| fracture / island-reserve | 2/2 | 0/2 | 0/2 |
| fracture / staggered-reserve | 2/2 | 2/2 | 2/2 |
| fracture / two-districts | 2/2 | 0/2 | 0/2 |
| phase / crossed-bands | 2/2 | 2/2 | 2/2 |
| phase / dogleg-transfer | 2/2 | 0/2 | 0/2 |
| phase / phase-remix | 2/2 | 0/2 | 0/2 |
| phase / pressure-ladder | 2/2 | 2/2 | 0/2 |
| phase / return-in-reserve | 2/2 | 1/2 | 0/2 |
| phase / signal-channels | 2/2 | 2/2 | 2/2 |
| phase / two-ways-home | 2/2 | 1/2 | 1/2 |
| livewire / cooling-loop | 0/2 | 0/2 | 0/2 |
| livewire / cross-the-afterglow | 2/2 | 0/2 | 0/2 |
| livewire / crossbar-depot | 0/2 | 0/2 | 0/2 |
| livewire / livewire-remix | 0/2 | 0/2 | 0/2 |
| livewire / read-the-lock | 0/2 | 0/2 | 0/2 |
| livewire / split-junction | 2/2 | 0/2 | 0/2 |
| livewire / switchyard | 2/2 | 1/2 | 0/2 |
| relay / first-link | 2/2 | 1/2 | 0/2 |
| relay / nested-relays | 2/2 | 2/2 | 2/2 |
| relay / relay-remix | 2/2 | 0/2 | 0/2 |
| relay / second-approach | 2/2 | 2/2 | 0/2 |
| relay / spiral-stores | 2/2 | 2/2 | 2/2 |
| relay / three-compounds | 2/2 | 0/2 | 0/2 |
| relay / watchpost-exchange | 2/2 | 0/2 | 0/2 |
| crosswind / compass-array | 2/2 | 0/2 | 1/2 |
| crosswind / crosswind-remix | 2/2 | 0/2 | 0/2 |
| crosswind / long-wave | 0/2 | 0/2 | 0/2 |
| crosswind / outer-loop | 2/2 | 2/2 | 1/2 |
| crosswind / read-the-arrows | 2/2 | 0/2 | 0/2 |
| crosswind / survey-markers | 2/2 | 2/2 | 2/2 |
| crosswind / windbreak-weave | 2/2 | 2/2 | 1/2 |
| sentinel / crown-audience | 2/2 | 2/2 | 1/2 |
| sentinel / first-relay | 2/2 | 2/2 | 0/2 |
| sentinel / relay-perimeter | 2/2 | 2/2 | 2/2 |
| sentinel / sentinel-remix | 2/2 | 2/2 | 2/2 |
| sentinel / twin-receivers | 2/2 | 2/2 | 2/2 |
| apex / apex-remix | 2/2 | 0/2 | 2/2 |
| apex / crossing-complete | 2/2 | 1/2 | 0/2 |
| apex / final-broadcast | 2/2 | 1/2 | 0/2 |
| apex / home-signal | 2/2 | 0/2 | 1/2 |
| apex / returning-light | 0/2 | 0/2 | 0/2 |
