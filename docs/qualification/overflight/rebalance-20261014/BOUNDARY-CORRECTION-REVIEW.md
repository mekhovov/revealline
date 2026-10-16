# Boundary correction: focused qualification

Runtime: ca03d7d7d84dcf50bbab6d2734a6d09097e27ed6. All twelve recorded runtime hashes match this commit.

Crossing and flank packs now complete their committed approach when they first reach a world boundary, then use normal pursuit. The initial pass remains committed, existing sprinter bursts finish, and enemies remain alive. Legacy rules do not change.

The prior 48-configuration receipt is preserved as balance-matrix.json.gz and remains evidence for commit 14649912b. The current follow-up covers eight selected configurations, forty route outcomes and two separate no-Focus checkpoint pairs; it is not a repeated full matrix.

| Mode / policy | Set · difficulty · frames | Active result (s) | Peak alive / visible | Tenth card (s) | Longest choice gap (s) |
|---|---|---|---:|---:|---:|
| survivor / fan-shield | front · standard · 3 | won 334.28 | 611 / 379 | 251.62 | 60.58 |
| survivor / echo | front · veteran · 1 | lost 204.62 | 311 / 248 | not reached | 44.8 |
| survivor / echo-shield | mixed · standard · 3 | won 388.67 | 1071 / 905 | 351.38 | 126.68 |
| survivor / systems | crossing · veteran · 3 | lost 317.68 | 797 / 444 | 234.53 | 44.68 |
| riy / fan-shield | front · veteran · 3 | won 392.08 | 964 / 489 | 272.33 | 55.4 |
| riy / echo | crossing · standard · 3 | won 412 | 957 / 601 | 284.22 | 55.63 |
| riy / echo-shield | front · veteran · 3 | lost 324.55 | 1096 / 731 | not reached | 96.13 |
| riy / systems | mixed · standard · 1 | won 321.63 | 715 / 486 | 260.1 | 62.57 |

Five active routes win; all 32 unattended, wall, tiny-circle and repeating-orbit continuations lose. No follow-up configuration exhausts the enemy pool or defers spawns. The same eight configurations had seven active wins before the correction: returning packs create real additional pressure.

## Named mature-build regression

Riy front / Standard / seed 17031991 / three airframes / Echo-trail-burst-Shield, Focus disabled: continued active flight wins at 418.28s. At 210s the earned build has primary 4, Sweeper 3, Breaker 2, Shield 1, seven choices and 25 hull with three airframes; no new input loses at 222.42s. At 240s it has Breaker 3, eight choices and 5 hull with three airframes; no new input loses at 250.17s. Upgrade menus continue resolving and replacement never re-enables input.

## Density diagnosis and impact

The previous saturated Riy Veteran/front trail route spent 1.92s at the 2,500-enemy pool cap. By 390s, 2,116 of 2,122 surviving enemies were within 5 units of the arena boundary; only 4 were visible. Fixed committed velocities were accumulating against clamps, rather than forming an active horde. The observation replay reproduced the entire original final summary.

After correction, that route peaks at 1,096 alive / 731 visible with no spawn deferrals; boundary counts are zero at 240s and 270s. It loses at 324.55s instead of winning at 395.38s. The geometry issue is fixed, but a player now needs a better return/priority route. The wider follow-up still reaches 905 visible in one mixed Survivor Echo route, so the 600–800 design envelope is not a strict cap or a native performance qualification.

## Remaining tuning question

No XP thresholds, damage, health or spawn rates were changed. The corrected Veteran trail run earned 4,829 XP but collected 2,144, leaving 2,685 on the map. Some choice gaps remain 96–127s and tenth choices occur after 350s. This is primarily a return-pass collection observation: the automated pilot targets nearby individual salvage, not safe valuable clusters. Review collection visibility and a deliberate return route before reducing global thresholds; a blanket threshold cut also gives already-successful Fan builds their final power much earlier.

Before claiming broad final balance, repeat the remaining configurations after this correction, review late salvage collection, and use native performance evidence for the actual dense routes. No additional runtime change is hidden in these receipts.

Validation: 83 scoped tests passed, including both committed patterns at all four boundaries, unchanged legacy motion, deterministic return and retained initial approach. Scoped lint is clean.

Exact before/after samples, checkpoint hull/build states, full hashes and replay commands are in boundary-correction-metadata.json and the compressed receipts. Generated observations use observe-density.mjs and never grant upgrades or alter the simulated run.
