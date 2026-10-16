# World gameplay comparison — 14 October 2026

These are deterministic automated public-input policies with earned drafts, not human playtests. No healing, damage changes or injected mature builds were used. The source-bound gameplay artifacts record the base commit, source hashes and settings; source identity, rather than only the unchanged branch HEAD, identifies each working-tree trial. External hardware and five-player testing remain skipped.

## Measured issue and bounded correction

The old Freight Depot flank family list contained runner/courier/scout-car. Its entire ordinary arrival mixture therefore used fast flank movement (96 units/s), while the authored combination lacked its promised radar standoff attacker. The revised list is patroller/courier/radar-truck. It restores a slower pursuit front, a smaller fast courier contingent and a bounded specialist. Spawn counts, primary damage, health, armor and reward quantities are unchanged. A dedicated regression verifies the role mixture and unchanged arrival budget.

This is an authored encounter correction. It is not evidence that every supported build is now balanced. Rear-trail Echo previously completed Field Crossing on both tested paths (Survivor 369.7/388.2 seconds, Riy 394.9/399.1), so an indiscriminate damage increase was not justified. Depot's repeated Riy Echo losses remain an explicit review finding.

## Baseline-kit Raid reachability

Earlier working-tree checks completed all three world encounters with no upgrades and no damage using the existing objective pilot. `raid-baseline-worlds.json` retains its pre-reconciliation source hashes; this was not rerun against final revision `a539ccde4`. These highly efficient times show reachability at that revision and do not establish ordinary first-completion timing.

| World | Outcome | Seconds | Completed objectives | Damage |
|---|---|---:|---:|---:|
| field-crossing | won | 24.2 | 7 | 0 |
| freight-depot | won | 22.8 | 7 | 0 |
| relay-ruins | won | 23.4 | 7 | 0 |

## Depot before correction

| Seed | Mode | Build | Route | Outcome | Seconds | Damage | Collected/earned salvage |
|---|---|---|---|---|---:|---:|---:|
| 17031991 | survivor | fan | tight | won | 338.0 | 280 | 4096/4760 |
| 17031991 | survivor | fan | figure-eight | lost | 302.2 | 300 | 3222/3669 |
| 17031991 | survivor | echo | tight | lost | 258.6 | 300 | 1395/2415 |
| 17031991 | survivor | echo | figure-eight | lost | 230.0 | 300 | 1095/2068 |
| 17031991 | riy | fan | tight | lost | 351.1 | 300 | 3626/4856 |
| 17031991 | riy | fan | figure-eight | won | 375.6 | 140 | 4170/5568 |
| 17031991 | riy | echo | tight | lost | 305.6 | 300 | 1827/3326 |
| 17031991 | riy | echo | figure-eight | lost | 355.0 | 320 | 2064/4328 |

## Depot after correction

| Seed | Mode | Build | Route | Outcome | Seconds | Damage | Collected/earned salvage |
|---|---|---|---|---|---:|---:|---:|
| 17031991 | survivor | fan | tight | won | 336.8 | 200 | 4281/4741 |
| 17031991 | survivor | fan | figure-eight | won | 350.0 | 160 | 4724/5317 |
| 17031991 | survivor | echo | tight | won | 405.7 | 160 | 4406/5367 |
| 17031991 | survivor | echo | figure-eight | won | 394.3 | 220 | 3823/5809 |
| 17031991 | riy | fan | tight | won | 388.4 | 140 | 4482/5918 |
| 17031991 | riy | fan | figure-eight | won | 383.5 | 200 | 4280/5607 |
| 17031991 | riy | echo | tight | lost | 274.3 | 300 | 1708/2344 |
| 17031991 | riy | echo | figure-eight | lost | 238.7 | 300 | 1201/2012 |
| 17 | survivor | fan | tight | won | 338.5 | 100 | 3548/3852 |
| 17 | survivor | echo | tight | lost | 313.9 | 300 | 1824/3052 |
| 17 | riy | fan | tight | won | 376.4 | 200 | 4323/5341 |
| 17 | riy | echo | tight | lost | 248.7 | 300 | 1495/1850 |

Survivor Echo on seed 17 also completed using the figure-eight route in the follow-up diagnostic (426.6 seconds). This demonstrates route sensitivity and does not guarantee other pilots or seeds complete.

## Riy Echo diagnostic limits

The automatic Riy pilot dispatches both escorts whenever a candidate is available. Restricting Focus to elite/final targets preserves more rear coverage and extends one run from 274.3 to 329.5 seconds, but did not establish a Depot completion. Contact caused all 300 damage in that run; it was not a boss durability stall. Replacing Shield with Scanner also failed all four sampled route/seed combinations below.

| Seed | Mode | Build | Route | Outcome | Seconds | Damage | Collected/earned salvage |
|---|---|---|---|---|---:|---:|---:|
| 17031991 | riy | echo-scanner | tight | lost | 234.6 | 300 | 1367/2010 |
| 17031991 | riy | echo-scanner | figure-eight | lost | 234.3 | 300 | 1303/1714 |
| 17 | riy | echo-scanner | tight | lost | 279.9 | 300 | 1839/2109 |
| 17 | riy | echo-scanner | figure-eight | lost | 276.2 | 300 | 1723/1967 |

At this stage Riy Echo in Depot was not qualified. The later temporary route diagnostic below establishes two successful approaches on one seed, while cross-seed robustness and native readability remain unproven. Automated failures alone do not prove that a skilled adaptive player cannot complete it.

## Unattended control sample

After earning each build for 180 seconds, the pilot supplies no input and continues auto-resolving drafts. Replacement airframes remain enabled. All four tested Depot branches lose; brief stationary safety is allowed and these checks do not constitute the full three-world/difficulty/seed matrix.

| Seed | Mode | Build | Route | Outcome | Seconds | Damage | Collected/earned salvage |
|---|---|---|---|---|---:|---:|---:|
| 17031991 | survivor | fan | default | lost | 200.9 | 300 | 1309/1442 |
| 17031991 | survivor | echo | default | lost | 189.9 | 300 | 1038/1164 |
| 17031991 | riy | fan | default | lost | 200.9 | 300 | 1338/1564 |
| 17031991 | riy | echo | default | lost | 187.8 | 300 | 887/961 |

## Evidence and follow-up

- raid-baseline-worlds.json: three baseline-kit Raid runs.
- echo-route-diagnostics.json.gz: original Field Crossing/Depot route comparisons.
- depot-bounded-flank-comparison.json.gz: corrected Depot composition, two seeds.
- depot-focus-and-idle-diagnostics.json.gz: Focus policy, second-seed Survivor alternate route and unattended samples.
- depot-echo-scanner-diagnostics.json: support substitution diagnostic.
- overflight-depot-composition.test.mjs: authored role mixture regression (one test passed).

The final 99-case world matrix is reported below with stable source bindings. Earlier matrices remain historical evidence and must not be labeled results for the newer composition. Renderer throughput, audible sound quality and native world readability are separate qualifications owned by the main review pass.

## Final source-bound matrix

The final 99-case run completed with unchanged simulation source hashes (sourceStable:true). It started at c375324951b4b510e8dd5a1814289da287300d2d; the evidence writer recorded end HEAD fb1ede1e761dd04403d9a694df46bd968f42b7a8 after a source-only merge that left those bindings unchanged. Of 27 active cases, 24 won. All 72 repetitive/unattended cases reached 180 seconds and lost; none completed unattended.

The three active losses were:

| World | Mode | Build | Seconds | Remaining tank hull |
|---|---|---|---:|---:|
| freight-depot | survivor | systems | 365.9 | 2340.5 |
| freight-depot | riy | echo | 238.7 | not reached |
| freight-depot | riy | systems | 238.5 | not reached |

The 18-case additional-seed/difficulty/airframe artifact is bound to c375324951b4b510e8dd5a1814289da287300d2d, also sourceStable:true. All 18 reached their intended 120/240-second checkpoint and lost after movement stopped. This comprises Veteran/Fan/one-airframe checks in every world and both Survival/Riy modes at both checkpoints, plus Standard/Echo/one-airframe seed 42 checks at 120 seconds. The main matrix uses Standard/three airframes and seed 17031991. It is a bounded regression sample, not an exhaustive claim about all custom projects or seeds.

Existing figure-eight route alternatives for both failed Systems combinations also lost on seeds 17031991 and 17. Separate temporary lure/return diagnostics preserve each policy and its earned cards/trajectory; they do not alter or replace the fixed 99-case matrix.

## Temporary lure-and-return reachability check

An evidence-only policy holds attack/collection goals for a committed pass and scores actual compiled rear-payload footprints against crowds. It returns for salvage only when the pass ends. At 360 seconds, when regular spawning ends, it switches to the existing review pilot for the final tank approach. It uses ordinary steering, boost, Focus and earned cards; simulation, production pilot, damage and rewards are unchanged. The policy and complete one-second input/position/health/armor traces are retained in lure-route-policy.mjs and depot-lure-boss-transition.json.

| Mode/build | Seed | Pass length | Result | Seconds | Damage |
|---|---:|---:|---|---:|---:|
| riy/echo | 17031991 | 2.2 s | won | 440.2 | 260 |
| riy/echo | 17031991 | 1.2 s | won | 433.7 | 200 |

Both wins demonstrate a viable Riy Echo route on seed 17031991. Their 7.2–7.3-minute completions continue beyond Survival/Riy’s six-minute regular-spawning cutoff. The separate 4–7-minute first-completion target belongs to Raid; no claim of ordinary-player timing or enjoyable difficulty follows from these Riy runs. The same return policy without the final approach switch survived 480 seconds but had not won, so crowd survival and final-target approaches are separate findings. Earlier failed policies remain in their own artifacts.

The best of these policies was applied unchanged to second-seed Echo and the other failed Systems cases:

| Mode/build | Seed | Result | Seconds | Damage |
|---|---:|---|---:|---:|
| riy/echo | 17 | lost | 297.9 | 300 |
| survivor/systems | 17031991 | lost | 292.0 | 300 |
| riy/systems | 17031991 | lost | 307.6 | 300 |

These failures remain unresolved. In particular, the current Survivor Systems draft invests in Pulse3, Side Burst3 and Scanner3 while leaving the primary at rank2; its collection policy also does not deliberately approach marked threats. This is a legal loadout, but is not a complete demonstration of the plan's early priority-target technique. Before tuning global damage, review an intentional marked-target route and draft order. No production policy was added or changed for this experiment.

## Faithful priority-target technique and final limits

The original Systems fixture is a deliberately legal module-heavy stress build. It is retained separately from the requested priority technique. An additional evidence-only draft prioritizes early Fan evolution, Scanner and directed Side Burst or burst Breaker. The route first earns the kit, then approaches marked/support/standoff threats; it does not send the starter after machinery before progression is available. This corrects an early diagnostic policy that delayed the first Survivor draft to 55 seconds. All failed traces remain available.

| Mode | Seed | Route | Result | Seconds | Damage |
|---|---:|---|---|---:|---:|
| survivor | 17031991 | Earn kit, then marked-target passes | won | 357.2 | 280 |
| riy | 17031991 | Earn kit, then marked-target passes | lost | 309.5 | 300 |
| riy | 17031991 | Earn kit, then 220-unit leader stand-off during Focus | lost | 271.6 | 300 |
| riy | 17031991 | Earn kit, then 270-unit leader stand-off during Focus | lost | 286.2 | 300 |

The successful Survivor route earned Fan4, Side Burst3, Scanner3 and Slow Field1. Its first choice was 19.25 seconds, evolution 58.43 seconds and Scanner 77.67 seconds. Victory at 357.23 seconds and 280 damage establishes one viable priority-technique route on seed 17031991. It does not establish cross-seed difficulty or an ordinary player success rate.

The Riy priority draft earned Fan4, broad Sweeper3, burst Breaker3 and Scanner3; evolution was 49.8 seconds and Scanner 116.32 seconds. Its direct approach and both stand-off alternatives failed, predominantly to body contacts. Therefore Riy priority-technique completion in Depot remains unqualified by these diagnostics. No global damage buffs, changed enemy health or production-pilot modifications were made to force a pass. Native adaptive-route review remains needed.

Final outcome: the fixed 99-case matrix and 18-case extension reject all 90 sampled unattended/repetitive completions. Separate public-input routes establish Depot Survivor sweep/echo/priority completion and Riy sweep/echo completion on seed 17031991. Riy priority completion, second-seed Riy Echo robustness, and human readability/enjoyment remain review limitations. The late module-heavy Systems failures remain visible stress evidence, not silently reclassified as passes.

Additional evidence: [priority policy source](priority-route-policy.mjs), [initial priority attempts](depot-priority-technique.json), [earned-kit comparison](depot-priority-earned-kit.json), and [Riy stand-off alternatives](depot-priority-squad-standoff.json). All policy files are qualification artifacts only.
