# Expanded final-source earned checkpoint review

**Status: executed after the parent’s go; see [results](EXPANDED-MATRIX-RESULTS.md).** The full batch completed in 159.45 seconds; the preparation protocol below is retained. This is a bounded diagnostic extension, not a change to runtime mechanics or an enjoyment assessment.

## Scope and coverage

The manifest contains **12 earned active baselines and 48 planned continuations**. It uses the second and third layout of each of the six worlds, with one Survivor and one Riy run per world. The prior final-source Loading Loop Fan/Shield regression remains in `FINAL-SPEED-FIX.md`; these cases add new layouts, seeds and later completion checks.

- Six Survivor and six Riy baselines; two of each build preference in each mode.
- Fan, Echo and Systems: four baselines each. These are draft preferences; only actual earned upgrades are recorded as the build.
- Seeds 101303, 202604 and 303907: four baselines each.
- Standard/Veteran: six each; one/three airframes: six each. Each difficulty × airframe pairing has three baselines.
- Checkpoints 60, 120, 180 and 240 seconds: twelve planned branches each.
- Parked and eight held headings: four branches per policy, one at each checkpoint. Shuttle, tiny-circle, wall and orbit: three branches per policy. Every policy appears in both modes.

**Coverage is balanced and rotated, not a full Cartesian or complete pairwise combinatorial matrix.** There is one policy at each checkpoint of each baseline, and one mode per selected layout. Actual coverage may be lower when an earned run dies before its requested checkpoint. `expanded-earned-plan.json` lists the exact dimension counts and mode/policy and checkpoint/policy pairs.

| # | Mode | Layout | Build preference | Seed | Difficulty / airframes | Branches at 60 / 120 / 180 / 240 s |
|---|---|---|---|---|---|---|
| 0 | survivor | Shelterbelt Gaps | fan | 101303 | standard / 3 | park / heading-0 / heading-1 / heading-2 |
| 1 | riy | Supply Orchard Edge | echo | 303907 | veteran / 1 | heading-3 / heading-4 / heading-5 / heading-6 |
| 2 | survivor | Dispatch Junction | echo | 202604 | veteran / 3 | heading-7 / straight-shuttle / tiny-circle / wall |
| 3 | riy | Loading Loop | systems | 101303 | standard / 1 | orbit / park / heading-0 / heading-1 |
| 4 | survivor | Split Compound | systems | 303907 | standard / 1 | heading-2 / heading-3 / heading-4 / heading-5 |
| 5 | riy | Receiver Gardens | fan | 202604 | veteran / 3 | heading-6 / heading-7 / straight-shuttle / tiny-circle |
| 6 | survivor | Floodgate Yard | fan | 101303 | veteran / 1 | wall / orbit / park / heading-0 |
| 7 | riy | Twin Docks | echo | 303907 | standard / 3 | heading-1 / heading-2 / heading-3 / heading-4 |
| 8 | survivor | Haul Switchbacks | echo | 202604 | standard / 3 | heading-5 / heading-6 / heading-7 / straight-shuttle |
| 9 | riy | Reclaimer Court | systems | 101303 | veteran / 1 | tiny-circle / wall / orbit / park |
| 10 | survivor | Glasshouse Ruins | systems | 303907 | veteran / 3 | heading-0 / heading-1 / heading-2 / heading-3 |
| 11 | riy | Irrigation Courts | fan | 202604 | standard / 1 | heading-4 / heading-5 / heading-6 / heading-7 |

## Policy definitions

| Policy | Input after the checkpoint |
|---|---|
| Park | No steering, boost or Focus. Retains the earned release heading. |
| Heading 0–7 | One fixed direction: east, southeast, south, southwest, west, northwest, north, northeast. |
| Straight shuttle | Hold the checkpoint heading for three seconds, reverse for three seconds, repeat. |
| Tiny circle | Rotate steering at 9 radians/s from the checkpoint heading; ideal unobstructed radius is roughly 20 units at baseline speed. |
| Wall | Choose the nearest active cover surface or arena boundary once at the checkpoint and hold the direction toward it. Log that surface, target and heading. No subsequent steering or target changes; breakable cover can cease blocking this route. |
| Orbit | Rotate steering at 0.8 radians/s; ideal unobstructed radius is roughly 225 units at baseline speed. |

All branch policies disable boost and Focus. Their steering continues after replacement, with no health, position, upgrades or resources injected. Timed patterns use the simulation clock, so upgrade pauses cannot advance them. Terrain and collision may prevent a mathematically circular route; that is part of the observation. Inputs are refreshed every six simulation ticks and immediately at branch start.

## Earned state and acceptance

The runner drives the existing public review pilot until completion, defeat or the 720-second cap, cloning the complete state at each reached checkpoint. The clone preserves pools, grid buffers, enemy/projectile state, randomness, replacements, cooldowns and earned drafts. It verifies clone equality and independent player/grid references. It never loads a presumed mature build. Both the exact checkpoint build and selected-card history are stored; later cards continue through the existing legal selection interface.

Each available branch runs until defeat/completion or the cap. A win with at least 90 seconds remaining at branch start fails the unattended-completion gate. Defeat passes that specific gate only. A time cap, invalid draft or wall-clock interruption is inconclusive. A checkpoint not reached is unavailable. Neither unavailable nor unrun cases count as passes. The runner retains active losses, including losses on open ground; it does not tune gameplay or repeatedly alter the pilot to turn them into wins.

Five-second samples and final state include position, heading, airframes, hull, kills, damage, shield blocks, salvage earned/collected, direct-path reachable salvage, nearby enemy sectors and movement/warning deferrals. The longest interval without hull damage or a consumed shield is also recorded with its kills and collected salvage. Direct-path reachable salvage does not imply safe collection, and excludes possible bent routes.

## Source identity, durability and execution budget

- Expected runtime candidate: `ed46c2b72e1735940acd70337f4ca5826506b1cc`. The runner traces and hashes all relative local imports from the actual Survivor/Riy simulation and pilot entry points (33 dependency files at preparation). A read-only comparison confirmed all 33 match the candidate. Against prior combat commit `3bb1b0dc66ae77baf59d0e89ab9edf257a244d10`, only `worlds.mjs` changed: it adds `createOverflightGroundPresentation`, a cosmetic helper for other modes with no callers in this simulation dependency closure. Removing that addition reproduces the old file byte for byte; existing construction, validation, combat and random streams are unchanged. `expanded-earned-provenance.json` records all prior/candidate/current hashes and this bounded equivalence finding. It does not relabel prior native captures as measurements of the candidate. The manifest, provenance and runner receive their own hashes.
- Start and end Git heads and every dependency hash are recorded. Later documentation-only commits may change HEAD without changing runtime identity. Any actual source change yields `sourceStable: false`; it must be assessed before accepting the result.
- Save a losslessly compressed report by atomic rename before simulation, after each baseline and after every branch. Previously completed results survive an interruption. Existing report files are never overwritten.
- Default total wall-clock budget is 900 seconds, with a 720-second per-run simulation cap. A budget stop produces partial evidence with not-started/not-run/inconclusive entries. There is no promise all 60 runs will finish in that budget on a contended machine.
- Expected local runtime is roughly 5–15 minutes based on the earlier bounded and earned matrices, but this remains an estimate. Start with one worker; no parallel workers during benchmark trials. Sharding is available for explicit scheduling after benchmarks.

Prepare/inspect without running simulation:

```sh
node docs/qualification/overflight/maps-movement-20261014/expanded-earned-matrix.mjs --plan
```

After the parent gives the execution go:

```sh
node docs/qualification/overflight/maps-movement-20261014/expanded-earned-matrix.mjs --run --output=docs/qualification/overflight/maps-movement-20261014/expanded-earned-final.json.gz > docs/qualification/overflight/maps-movement-20261014/expanded-earned-final-output.txt 2>&1
```

A bounded subset uses `--cases=0,1`; explicit shards use `--part=0/2` and distinct output names. `--wall-budget=<seconds>` can lower the total budget, never exceed 900 seconds. Neither option changes the authored cases. Do not silently replace failed seeds or unavailable checkpoints. If a remaining subset needs another invocation, preserve the first report and use a fresh output filename.

## Preparation checks

- Runner syntax check passed.
- No-simulation plan validation passed: all thirteen policies are planned in both modes; all four difficulty/airframe pairings are represented.
- Static runtime dependency closure resolves all 33 files and matches candidate `ed46c2b72`; the prior-to-candidate cosmetic helper addition was reviewed separately.
- No headless simulations, runtime edits or heavy workers were started during preparation.

A successful unattended gate is not proof of balanced ordinary-player difficulty, sound/visual readability, browser frame cadence or enjoyable routes. Those remain separate review evidence.
