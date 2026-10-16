# Sampled Survivor / Riy balance qualification

Runtime source: 14649912ba3f94d335b5bbc94ce6ce92d522a1a8. Each recorded runtime hash was checked against this committed version.

Completed 48 configurations and 232 outcome records. All 121 pre-interruption records are unchanged. Runtime hashes match throughout recovery.

| Mode / policy | Active wins / 6 configs | Standard / Veteran wins (3 each) | First choice (s) | Evolution (s) | Largest inter-choice gap (s) | Peak visible | Shield blocks |
|---|---:|---:|---:|---:|---:|---:|---:|
| survivor / fan-shield | 6/6 | 3/3 · 3/3 | 15.45–19.25 | 39.85–70.57 | 72.15 | 318–593 | 0–3 |
| survivor / echo | 3/6 | 3/3 · 0/3 | 15.45–19.25 | 41.45–77.33 | 94.35 | 248–846 | 0–4 |
| survivor / echo-shield | 4/6 | 2/3 · 2/3 | 15.45–19.25 | 41.45–82 | 125.43 | 490–995 | 1–4 |
| survivor / systems | 2/6 (1 early losses) | 1/3 · 1/3 | 15.45–19.25 | — | 56.48 | 294–550 | 0–0 |
| riy / fan-shield | 6/6 | 3/3 · 3/3 | 18.68–19.88 | 64.5–102.55 | 60.42 | 308–441 | 1–5 |
| riy / echo | 2/6 (1 early losses) | 1/3 · 1/3 | 18.68–19.88 | 71.45–106.4 | 89.53 | 323–727 | 0–4 |
| riy / echo-shield | 5/6 | 3/3 · 2/3 | 18.68–19.88 | 71.45–106.4 | 95.75 | 513–959 | 1–7 |
| riy / systems | 3/6 | 2/3 · 1/3 | 18.68–19.88 | 65.58–98.27 | 61.35 | 246–490 | 0–0 |

Active means the ordinary-input review pilot keeps steering and using available boost/Focus. No-input, wall, tiny-circle and repeating-orbit branches continue resolving earned upgrade menus but issue no Focus commands. Automatic replacement may move the drone.

Unattended/repetitive-route wins: 0. Early active losses are reported separately, not treated as completed mature-build probes.

## Findings for the next tuning review

- The sampled anti-idle check passes: 46 no-input continuations and 138 simple repetitive routes all lose, while active flight wins in 31 of the 48 configurations. This establishes available active routes and rejects these sampled exploits; it does not prove all stationary builds are impossible.
- The first choice is consistently earned within 15.45–19.88 seconds. Primary-first Survivor policies evolve in 39.85–82 seconds, including earlier than the intended 70–100-second window. Riy evolves in 64.5–106.4 seconds. Survivor systems deliberately spends its ten-choice budget on Pulse, Side Burst and Scanner, leaving primary at rank 2; the absent evolution is a policy tradeoff rather than a blocked draft.
- Late progression still needs review. Maximum gaps between earned choices range from 56.48 to 125.43 seconds across policies, and some final choices occur after 300 seconds. Therefore the intended frequent-reward cadence and final-choice window of 240–270 seconds are not uniformly demonstrated. Any further XP tuning needs a new paired matrix, because earlier power also changes idle survival.
- Fan + Shield won all six sampled configurations in each mode. Its broad clearing leaves fewer enemies and produces faster clears on this pilot. Echo rewards rearward placement and return passes, but its weaker immediate coverage leaves larger crowds; the trail/burst Riy variant exchanges crowd damage for local slowing and concentrated priority-target attacks. Systems gives up Shield for Scanner and additional combat/chain coverage, demanding more movement. These are observable mechanics and route outcomes, not human preference rankings.
- Active-route damage totals are 4,380 contact, 160 lane, 40 fan and 80 ground: approximately 94% is contact. The pilot predicts warnings, so low ranged damage does not establish that human players find them obvious or easy. Shield blocks range from zero to seven per sampled active run, with none on Scanner policies.
- Peak visible populations reach 995 in Survivor and 959 in Riy, above the planned 600–800 surge envelope; one Riy route reaches the 2,500-alive pool cap. These runs need native density/performance review before claiming the full envelope is qualified. Reducing cosmetic work must preserve enemies and outcomes.

## Interpretation and limits

- Three encounter/seed combinations per difficulty; seeds and airframe counts are coupled to configurations, not independently crossed.
- Checkpoints 120/180/240 rotate across configurations. Named no-Focus Riy regressions separately cover default mature builds at 210 and 240.
- Reported build names are card-selection policies. Final earned builds are included for inspection; the same label is not proof of identical cards.
- Riy echo and echo-shield resolve to the same trail/burst/Shield policy and extend airframe coverage; the matrix represents three distinct squad directions, not four. Survivor echo-shield excludes Pulse while echo permits it.
- Active outcome includes losses before checkpoints in the per-build configuration denominator; those early losses have no mature unattended counterparts.
- First/evolution timing and choice-gap ranges include all 48 original active prefixes, never duplicate cloned branches.
- Damage totals and skill outcomes describe this predictive automated pilot, not human difficulty or enjoyment.
- The pilot does not measure screen readability, frame rate, host pause/slow-resume UX, or human build preference.

The JSON companion contains each earned build, first/evolution timings, exact largest-gap cards and configuration, density peaks, boosts, armor breaks and damage by cause. Numerical differences are observations from these routes, not causal proof that one build is stronger.

Recovery used compact gzip, temporary-file writes, flush and atomic rename. The original interrupted receipt, original log, three failed-resume logs and exact original harness remain preserved separately. Repeated disk exhaustion required the final six configurations to send a complete checksum-protected gzip receipt through the tool output pipe with a 256 MiB Node heap cap; that exact receipt was then saved atomically once space was available. No result was reconstructed from a log summary. See balance-matrix-recovery.json for receipt, harness and runtime hashes.
