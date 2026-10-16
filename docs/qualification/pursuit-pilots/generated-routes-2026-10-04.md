# Generated native pilot completion routes — 4 October 2026

These new regressions establish that specific accepted Living Routes pilot recipes can be completed with legal controls. They complement the historical exported recordings; they do not replace them or claim human play, artistic approval, other seeds, device accessibility or release qualification.

The fixtures cover all 32 declared pilot cases: twelve Capture, eighteen Snake and two native SIM cases.

Three additional contact-specific witnesses cover Crossing Post Solo/Versus at Standard/seed 1 and Pincer Yard Team at Standard/seed 17. They supplement the 32 baseline cases rather than introducing new missions or seeds.

| Pilot            | Exact cases                                                  | Native completion                                                                                                                                                        |
| ---------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Crossing Post    | Solo and Versus; Gentle, Standard and Expert; seed 1         | Native capture clears in 4,965 / 2,737 / 5,012 ticks. Both Versus boards actually clear; neither collision nor timer victory substitutes for completion.                 |
| Pincer Yard      | Team; Gentle, Standard and Expert; seed 17                   | Native wins in 2,076 / 1,151 / 1,518 ticks. Both seats close territory. Gentle and Expert include ordinary recovery, so these routes do not qualify no-damage mastery.   |
| Relay Rendezvous | Team; Gentle, Standard and Expert; seed 17                   | Both seats capture separate anchors, lower the shield and capture the exposed core in 949 ticks without a knockdown. Native stronghold completion remains authoritative. |
| Cable Cutoff     | Solo, Versus and Team; Slow, Normal and Fast; seed 17        | Solo and both Versus boards clear in 123 movement steps. Team clears in 93 steps with 7 and 5 catches.                                                                   |
| Shield Window    | Solo, Versus and Team; Slow, Normal and Fast; seed 17        | Solo and both Versus boards clear in 139 movement steps. Team clears in 99 steps with 4 catches each.                                                                    |
| Low Pass Depot   | Self-level and Acro; native pace, Gentle response; seed 9601 | Both routes consume 1,540 native ticks, catch all three patrols, retain 100 health and have no solid contacts or shots.                                                  |

## Provenance and checks

`game/test/capture-pilot-completion.test.mjs` uses fixed controls with the accepted native Solo, Duel and Team engines. It pins the current recipe, classes, seed and source ownership, records consumed input and verifies the resulting native recordings. The Relay route wins through its actual stronghold objective; it does not replace that objective with territory coverage. These completion routes do not establish contact-catch mastery or human cooperation quality.

`game/test/capture-pilot-contact-completion.test.mjs` supplies the missing direct-interception evidence. Crossing Post catches its Patroller at tick 498 and Courier at tick 865, then clears at tick 1,322 with all three lives; both actual Versus boards reproduce that route. Pincer Yard credits the Refuge contact to seat 1 and Switchback contact to seat 2, then clears at tick 1,661 with both seats closing territory. Its one native keeper downing and capture rescue preserve reserves, so it is not a damage-free mastery witness. All three cases retain the unchanged accepted recipe, score exactly 200 Hunt points from two contacts and zero enclosure kills, and reconstruct their native recordings through the pilot verifier. No player or actor state is injected.

`game/test/classic-snake-pilot-completion.test.mjs` replays fixed direction strings through the public match input and step interfaces. It pins the official accepted recipe identity for every pace, restores the match halfway through, finishes the unchanged quota, and verifies the exported native session through `verifyPursuitPilotRecording`. Both Versus boards must complete; a collision victory is insufficient. Both Team seats contribute. The runs use neither supplies nor bonus catches.

`game/test/fpv-pilot-completion.test.mjs` consumes compact, hashed control fixtures under `game/test/fixtures/pursuit-pilot-flight/`. Native flight physics, the recorder, replay and the same pilot verifier must agree. The manifest pins course bytes, response, input identity and terminal proof. The checked-in test replays fixed controls rather than regenerating a route that could silently adapt to changed gameplay.

The inputs were software-generated. No actor positions, cable, geometry, objectives, phases, armor, scores or random state are injected. A successful route at a fixed seed demonstrates existence, not that every route is fair or that players understand the intended interception. Human review must still assess readable intentions, specialist vulnerability, control difficulty, useful cooperation, enjoyment and replay value.

All four regression files are included in the source-bound industrial gameplay phase. Test execution receipts identify the actual source, runtime and results; this document is not a replacement for those receipts. Studio browser round-trips, physical devices/controllers, EN/UK readability and public delivery remain separate acceptance work.
