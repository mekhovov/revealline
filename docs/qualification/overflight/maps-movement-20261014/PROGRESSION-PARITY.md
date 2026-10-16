# Battlefield progression parity

Runtime fix: `07ed466251d66515757cfb44204592823bc0122c`. Qualification candidate after merging current main and pushed work: `e708ce99f0fc930406c15233d89d5598360b366d`.

## Confirmed defect and bounded correction

The V4 battlefield constructor bypassed the older world application path to preserve coordinated encounters. That also bypassed the accepted world progression settings. New Survivor and Riy battlefields therefore used late thresholds **750 / 1,150 / 1,750 / 2,400** instead of **700 / 1,000 / 1,400 / 1,900**.

The correction restores the accepted values only in `createOverflightProject()`'s new V4 battlefield branch. Riy delegates construction to it. The first six thresholds remain **12 / 45 / 100 / 180 / 300 / 480**. No health, speed, damage, attack geometry, spawn budget, salvage reward or collection rule changes. Existing authored projects are not reconstructed: importing, compiling and making explicit version-upgraded copies preserve their supplied thresholds.

This resolves an unintended progression increase, not the entire late-game collection problem. Earlier earned Echo runs had large pools of uncollected salvage and poor attack approaches in addition to the elevated thresholds. Their collected/earned/ground totals conserved value. No lost-salvage defect was found in those retained runs; the earlier long choice gaps cannot all be attributed to this constructor bug.

## Identity and persistence

Compiled gameplay identity hashes the thresholds, while visual identity excludes gameplay. The existing record context includes gameplay identity. Revised built-ins therefore receive new record keys without replacing earlier authored results or changing artwork identity. The separate `records.mjs` correction admits `overflight-balance.v4` in saved-record validation; previously the run-context constructor accepted V4, but persistence validation allowed only V1–V3.

For Standard Loading Loop, with seed 101303, three airframes and slow resume enabled:

| Mode | Prior project | Revised project | Prior record key | Revised record key |
|---|---|---|---|---|
| Survivor | `a6d7b43988db4792` | `fb4d718b1f67cac9` | `7b6e5ebcfc56b001` | `ba132308d8c0fda7` |
| Riy | `7b35283aef479c94` | `b12800a6a85a58f3` | `0f0e6cf8db013e4a` | `2001b96ced93e8a7` |

All four retain visual identity `f17fbcbbdc5d4666`.

## Regression checks

The new tests first failed against the pre-fix constructor. After correction, 29 targeted tests passed across battlefield, world and record suites; lint passed for the changed source and new test. The new regression covers all 18 layouts and three difficulties in both Survivor and Riy; equality with accepted V3 world progression; unchanged legacy defaults; explicit authored/imported thresholds and upgrade copies; distinct gameplay identities; unchanged visual identity; durable save, disposal and reopen of old and revised V4 records together.

## Evidence boundary

The retained `expanded-earned-*`, `pilot-bias-*`, `systems-airframes-*` and earlier native recordings continue to describe their recorded pre-fix progression. They are not relabeled as final-candidate balance evidence.

The new `progression-parity-*` run uses the same twelve locked earned baselines and 48 requested branches. Configuration changes are limited to source/provenance filenames and the candidate commit. The 33-file simulation dependency audit finds only the three-line constructor addition changed from `ed46c2b72e1735940acd70337f4ca5826506b1cc`. Record validation is outside that simulation dependency closure. Separate six-route comparisons preserve the previously chosen pilot variants; there is no seed/loadout search or automatic grant.

Native measurements recorded before this fix remain correctly labeled to their own source; they cannot show its progression effect.

## Locked earned-run matrix

[Summary](progression-parity-summary.json), [aggregate](progression-parity-aggregate.json.gz), [configuration](progression-parity-config.json), [source provenance](progression-parity-provenance.json).

All **47 available unattended continuations lost**; no unattended completion, draft failure or simulation-time cap. One requested checkpoint is unavailable: the Veteran/one-airframe Floodgate Yard Fan baseline died at 212.63 seconds, before its 240-second branch. Both modes cover all 13 policies: parked, eight held headings, straight shuttle, tiny circle, wall hold and orbit. Each policy continues after replacement airframes and automatically resolves earned drafts. Maximum continuation was 66.03 seconds. The longest interval without damage or a shield use was 39.75 seconds / 260 kills during an early wall hold; that run still died at 115.17 seconds. Brief dominance remains possible and is reported rather than hidden.

The twelve active baselines remain **two wins / ten losses**. First six earned card IDs, times and ticks match the prior evidence exactly in all twelve cases. The revised final choices are attainable, but these outcomes do not establish that every automated route is viable or that ordinary-player difficulty is correct.

| Case | Mode / build | Difficulty / airframes | Outcome | Choices | Largest choice-to-choice gap |
|---|---|---|---|---:|---:|
| 0 | Survivor / Fan | Standard / 3 | Won 321.08 s | 10 | 53.35 s |
| 1 | Riy / Echo | Veteran / 1 | Lost 243.60 s | 9 | 47.87 s |
| 2 | Survivor / Echo | Veteran / 3 | Lost 317.57 s | 10 | 53.05 s |
| 3 | Riy / Systems | Standard / 1 | Lost 241.68 s | 10 | 50.18 s |
| 4 | Survivor / Systems | Standard / 1 | Lost 299.32 s | 10 | 40.02 s |
| 5 | Riy / Fan | Veteran / 3 | Won 397.38 s | 10 | 54.38 s |
| 6 | Survivor / Fan | Veteran / 1 | Lost 212.63 s | 9 | 44.17 s |
| 7 | Riy / Echo | Standard / 3 | Lost 304.75 s | 9 | 47.32 s |
| 8 | Survivor / Echo | Standard / 3 | Lost 339.50 s | 10 | 67.35 s |
| 9 | Riy / Systems | Veteran / 1 | Lost 245.55 s | 10 | 40.30 s |
| 10 | Survivor / Systems | Veteran / 3 | Lost 320.98 s | 10 | 36.38 s |
| 11 | Riy / Fan | Standard / 1 | Lost 328.53 s | 10 | 49.52 s |

The initial process hit disk exhaustion while saving case 11. Its durable [partial raw](progression-parity-final.json.gz) retains completed cases 0–10 and remains marked incomplete; the [original log](progression-parity-output.txt) retains the error. Only the same locked case 11 was rerun into a [separate raw file](progression-parity-case11.json.gz). The aggregate records both source hashes and the interruption, verifies identical configuration/source hashes, and joins those disjoint cases. It is not represented as one uninterrupted invocation. Aggregate decompressed SHA-256: `844ea8aebffdb483537abaf1d0864828aa2c94783afe5a7fc6d7fb7926a46c5a`.

Coverage rotates dimensions; it is not a Cartesian or fully pairwise sweep. Missing checkpoints remain unavailable, incomplete runs remain inconclusive, and automated survival or failure does not establish enjoyment or human difficulty. Six fixed route/Focus comparisons are recorded separately to examine the earlier Echo progression gaps.

## Six previously fixed route comparisons

[Raw](progression-parity-pilots-final.json.gz), [summary](progression-parity-pilots-summary.json), [exact configuration](progression-parity-pilots-config.json). All six complete, source hashes stable; 130.02 seconds of local worker time. Raw decompressed SHA-256: `0175b294b5134cf96dc7d10a40127b70ba4d83e26adaf276a5f92e1e5b1bcad0`.

| Fixed route | Prior outcome | Revised outcome | Revised choices |
|---|---|---|---:|
| Survivor Echo, figure-eight, Standard / 3 | Lost 346.43 s | **Won 407.13 s** | 10 |
| Survivor Systems, tight, Standard / 1 | Lost 246.38 s | Lost 238.43 s | 10 |
| Riy Echo, figure-eight / normal Focus, Standard / 3 | Won 407.52 s | **Lost 358.27 s** | 10 |
| Riy Systems, tight / normal Focus, Standard / 1 | Lost 232.15 s | Lost 220.12 s | 9 |
| Riy Echo, figure-eight / priority-only Focus, Standard / 3 | Lost 403.60 s | Lost 313.83 s | 9 |
| Riy Systems, tight / priority-only Focus, Standard / 1 | Lost 223.20 s | Lost 230.87 s | 10 |

The first six earned cards and times remain exact in every comparison. Salvage is conserved at every one-second sample, and no playing sample has enough collected salvage for an unoffered upgrade. Survivor Echo's longest choice gap falls from 101.02 to 51.15 seconds; it earns the tenth choice at 242.58 seconds and destroys the final tank. This demonstrates one valid final-source Echo completion, not universal improvement.

Riy Echo's normal-Focus route still has a **91.2-second** ninth-to-tenth gap. It earns enough total salvage for the final threshold by 234 seconds but collects it around 305 seconds. At 304 seconds it is one salvage short while 690 remains on the map, 596 on a clear direct geometric path. This is a collection/route review issue; geometric access does not guarantee a safe approach. It is not proof of missing rewards or a failed upgrade trigger.

That Riy route approaches within 300 units of the final target in only 6 of 60 one-second observations. Armor falls from 1,500 to 1,130.7; hull remains 3,500. The priority-only route never gets within 300 units during its short boss phase. The revised evidence therefore does **not** inherit the earlier Riy Echo victory. Before another balance change, review human collection routes and sustained rear-trail/escort attack placement around this layout. Do not increase damage merely to make this fixed pilot win.

The three Systems comparisons here use the one-airframe challenge. Their losses do not establish default three-airframe viability; the two previously fixed default-airframe cases are repeated separately against this source.

## Two default-airframe Systems comparisons

[Raw](progression-parity-systems-final.json.gz), [summary](progression-parity-systems-summary.json), [configuration](progression-parity-systems-config.json). Both completed on the same source, with stable dependency hashes; 38.29 seconds of worker time. Decompressed SHA-256: `bbae7eededb86d8cbdb4f6b301cc789c8cc96dc05a99f255c26aa60acf62dcf3`.

These retain the original Systems route, seed, Standard difficulty, card preferences and normal Focus. Only the challenge's one airframe changes to the default three. This is the same two-case follow-up as the earlier `systems-airframes-*` evidence, with the revised constructor values.

| Case | Prior default-airframe result | Revised result | Remaining airframes / hull | Longest choice gap |
|---|---|---|---|---:|
| Survivor, Split Compound, seed 303907 | Won 361.78 s | **Won 380.60 s** | 1 / 45 | 40.02 s |
| Riy, Loading Loop, seed 101303 | Won 326.88 s | **Won 320.75 s** | 2 / 20 | 50.18 s |

Both earn all ten choices. Their first replacements occur at exactly the corresponding new one-airframe defeat times, 299.32 and 241.68 seconds. Earned choices through those times match the one-airframe runs exactly; the first six also match the pre-fix runs. Salvage remains conserved. These provide specific final-source Systems completion examples, not a guarantee for every world or route. There were no retries with different seeds or tuning.

Operational note: the first six-route launcher exited before simulation because the aggregate had not yet been created after a local preflight assertion. Its [error log](progression-parity-pilots-preflight-error.txt) is retained. The successful run uses a new raw output after the aggregate and atomic write check were verified. Neither this launcher error nor the interrupted matrix is counted as a successful execution.
