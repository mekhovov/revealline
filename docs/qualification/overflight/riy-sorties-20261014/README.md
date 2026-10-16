# Riy complete-sortie comparison — 14 October 2026

Both escort policies complete all six Standard encounter/build combinations using the ordinary flight pilot and earned upgrades: **12/12 full sorties**, without fixture population or forced power. Focus increases escort damage to elite/final targets in every pair, while completion time and crowd kills vary. Its advantage is target allocation; pressing it is not necessary to complete the underlying Survivor sortie.

## Comparison

Seed 17031991, three airframes, balanced flight profile, front/crossing/mixed. Fan/Shield has no pulse; Systems uses its normal ranked preferences. Both policies use the same adaptive `tight` pilot, not an identical recorded trajectory: changed world state can change subsequent steering and card offers.

The Focus policy considers an eligible guarded, armored, elite or final target at 10 Hz, issuing a command only when cooldown is ready. The Follow policy issues none. Neither receives direct damage/stat changes. Escort actions use the native combat APIs, and all gameplay ticks and upgrades are processed through the existing run.

| Encounter / build     | Follow clear | Focus clear | Escort elite/final damage, follow → focus | Commands |
| --------------------- | -----------: | ----------: | ----------------------------------------: | -------: |
| Front / Fan–Shield    |      323.18s |     322.02s |                                 402 → 552 |       36 |
| Front / Systems       |      328.18s |     324.28s |                             497.4 → 814.8 |       34 |
| Crossing / Fan–Shield |      321.23s |     322.68s |                                 330 → 534 |       36 |
| Crossing / Systems    |      321.68s |     318.97s |                             472.8 → 599.0 |       34 |
| Mixed / Fan–Shield    |      324.78s |     328.38s |                                 330 → 570 |       38 |
| Mixed / Systems       |      328.37s |     324.75s |                             261.6 → 764.2 |       40 |

Damage attribution measures elite/final hull immediately before and after the escort step, including a defeated target's remaining hull. It excludes the leader's preceding damage. Escort kill attribution similarly measures the native kill-count difference across that step. It does not claim that other attacks or altered routes made no contribution to the final outcome.

Focus damage increases by 1.27–2.92× across these pairs. In two pairs the focused sortie finishes slightly later. Crossing Fan/Shield makes the cost particularly clear: escort crowd kills fall from 272 to 213 while goal damage increases from 330 to 534. Other pairs do not always pay that same cost; all raw summaries, five-second position samples, upgrade choices and shot counts remain in `sorties.json.gz`.

## Stationary safety

All four stationary probes lose despite three airframes and automatic earned-card choices:

| Difficulty |          Follow |           Focus |
| ---------- | --------------: | --------------: |
| Standard   | loss at 101.58s | loss at 101.60s |
| Veteran    |  loss at 68.12s |  loss at 66.82s |

The Focus stationary policy still uses the command when eligible. This verifies that these two escorts do not make simply parking an automatic winning strategy for the tested preset. It does not exclude every possible exploit.

## Checks and reproduction

- `tests.tap`: 7/7 Riy simulation/presentation tests pass.
- `audio-tests.tap`: 18/18 destruction vocabulary, settings and Overflight feedback tests pass.
- `reaction-policy-tests.tap`: five selected humanoid admission, shuffle, preferences, launch and warning-priority tests pass; five unrelated tests are explicitly skipped by the name filter.
- The run receipt binds all measured simulation/project/pilot sources by SHA-256; bindings were unchanged between start and finish.
- Scoped ESLint and repository-style formatting checks pass for the qualifier.

```sh
node docs/qualification/overflight/riy-sorties-20261014/verify.mjs
node --test game/test/overflight-riy.test.mjs
```

The qualifier replaces only this packet's generated sortie receipt. This is headless reachability and behavior evidence. Native input, authoring, package, rendering and lifecycle verification are separate. Human enjoyment, physical-device and GPU qualification are not claimed.
