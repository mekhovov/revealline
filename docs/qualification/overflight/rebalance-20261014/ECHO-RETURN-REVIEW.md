# Survivor Echo lure-and-return qualification

Runtime: ca03d7d7d84dcf50bbab6d2734a6d09097e27ed6. All three receipts match all twelve current-runtime source hashes from the final matrix. The controller is qualification-only and does not alter runtime code. The executed controller is preserved in probe-echo-return.executed.mjs.gz.

The controller replaces only the original pilot's nearest-pickup/fallback goal with a latched outward leg, two turning waypoints and a return toward an existing salvage cluster. It retains the original threat scorer, ordinary steering/boost actions and final-tank aiming. Upgrades are earned through the unchanged Echo policy. No health, XP, damage, positions, cooldowns or inventory are granted. The first controller call is checked for no simulation mutation; route memory remains outside the run.

Each attempt uses Survivor V3, Standard, front, seed 17031991 and three airframes. Presets were fixed before the executions; all three attempted outcomes are retained. No further presets were tried.

| Route | Outward leg / turn width | Result / time | Choices | Evolution | Peak alive / visible | XP collected / on ground |
|---|---|---|---|---|---|---|
| medium | 360 / 140 | lost / 292.02s | 8 | 103.52s | 1538 / 900 | 1423 / 1268 |
| compact | 280 / 100 | lost / 390.23s | 10 | 78.70s | 790 / 604 | 3524 / 1824 |
| wide | 420 / 180 | lost / 338.70s | 8 | 137.20s | 1405 / 1091 | 1651 / 2741 |

The compact route reached all ten upgrades and defeated 3,790 of 3,809 spawned enemies. At loss, the final tank was still alive, with nineteen enemies remaining. It entered the last thirty seconds with twenty hull on the final airframe; all 300 hull damage across its three airframes came from contact. The medium and wide routes never reached their ninth choice and left substantial salvage on the map. There were zero spawn deferrals in every attempt.

## Interpretation

Latched route goals materially change the outcome: the compact route clears most of the encounter instead of dying during a larger unresolved crowd. However, all three attempts lost, so this does not establish a viable Echo+Pulse completion route. The 0/6 original-pilot results remain intact and should not be hidden by the alternate-controller investigation. Echo with Shield has two completion routes in the final matrix, and the separate mature Riy Echo/no-Focus regression has a completion route; those are different builds.

The remaining issue is completion reliability and late progression for this precise control-heavy build, not evidence that additional blanket damage is required. A human lure-and-return review or further specifically justified route study is needed before changing gameplay values. Do not describe this probe as proof of enjoyment, human difficulty, input-device feel or rendered performance. No unattended branches were run because none of these active attempts won.
