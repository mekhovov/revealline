# Coordinated movement and fixed-lane diagnostic

Source checkpoint: `b10ac4cc02a435eead18169674eb0009dbf7b59d` (14 October 2026). Each JSON records the individual simulation source hashes before and after its run. Both final reports have `sourceStable: true`. The machine's temporary workspace disappeared during implementation; source edits were recovered from their exact session history into the persistent worktree, then these final checks were rerun.

## Result

The final bounded comparison covers Broken Crossroads and Loading Loop, Single Drone and Riy, seed `17031991`, Standard, three airframes, earned Fan/Shield-policy choices. The public-input pilot plays to 120 seconds. At that checkpoint each run either continues active flight, parks, holds one cardinal direction, or shuttles along its last heading. Drafts are resolved throughout, including after replacement; no upgrades, health, positions or damage are injected.

- All four active cases reached the 240-second observation limit.
- All four parked cases lost at 134.82–151.22 seconds. Their longest intervals without hull damage or shield consumption were 4.05–6.77 seconds.
- All twenty fixed-heading/shuttle cases lost at 138.08–173.63 seconds. Their longest safe intervals were 2.73–22.30 seconds.
- Successful active clearing still buys relief: one active Loading Loop case had the full 120-second observation window without damage/shield consumption. This is not classified as a balance failure merely because it was successful.

Reports: [active/park](fixed-lane-initial.json.gz), [fixed headings/shuttle](fixed-lane-headings.json.gz). The traces include position, heading, kills, damage, shields, salvage earned/collected, direct-path reachable salvage, nearby approach sectors and attack/motion deferrals.

## A reproduced exploit and its fix

Before the final cover-clearance fix, Loading Loop / Riy / held south input stopped against the north side of the central cover at approximately `(1179.57, 391)`. It survived to 240 seconds, killed 1,224 enemies during a 119.45-second safe interval and deferred 11,040 warnings. The escape check inflated the terrain collision radius by two units: every escape consequently started inside the inflated cover even though the physical hull was outside it.

Warning admission now uses the physical hull for terrain sweeps. It still checks harmful bodies, full attack geometry and the slowest supported flight speed. The same input loses at 147.95 seconds, with a longest safe interval of 6.22 seconds. This fixes an inadmissible-attack loop without changing health, damage, movement speed or rewards.

The before-fix evidence is retained in [the original heading comparison](fixed-lane-headings-before-cover-fix.json.gz). It is historical evidence, not the final source result. The final comparison also includes a finite split-pack correction: the first two coordinated members take opposite sides, rather than both taking the same side of a six-member indexing pattern.

## Correctness coverage

The focused suite covers 93 tests across coordinated movement, core Survivor/Raid behavior, rebalance, terrain, boundaries and variety. The twelve new tests cover:

- Raid actors' actual finite velocities and harmful contact semantics.
- Committed-leg endpoint prediction.
- Split approaches at unchanged speeds, including an eight-member Raid pack; legacy trajectories remain unchanged.
- Crosscut warning, snapshot aim and bounded commitment.
- Standoff relocation and immediate stopping for an actual attack warning.
- Deferring a new movement leg or shield facing that would close the final warned exit.
- Raid convoy arrival, firing stop, recovery and departure.
- Deterministic flank/support traces without consuming combat randomness.
- Timed bent escapes around cover.
- A hull resting against cover retaining a legal outward escape.

See [test output](movement-tests.txt). Source lint passed for all owned movement and diagnostic files.

## Evidence boundaries and remaining work

This is a bounded 120–240-second diagnostic, not full-sortie qualification. It does not establish ordinary-player enjoyment, full baseline-kit completion, six-world/18-layout balance, all three build techniques, Veteran difficulty, one-airframe behavior, other seeds, later checkpoints or rendered performance. Tiny circles, arbitrary orbits and diagonal held directions are available through `--extended` but are not part of these final 28 cases. The complete challenge matrix remains required.

Direct-path reachable salvage is a deliberately conservative metric; a pickup reachable through a bent route can be counted as blocked. The review pilot is a correctness instrument, not an ordinary-player difficulty model. Crosscut preparation timing at distant arrivals still needs native review: its bounded commitment can finish before reaching the player. No speed increase was added to conceal this.

Run the default eight-case diagnostic with `node docs/qualification/overflight/maps-movement-20261014/fixed-lane-probe.mjs report.json.gz`; add `--lanes` for the twenty heading/shuttle cases or `--extended` for all available policies. Run from the repository root and keep simulation sources unchanged during measurement.

Raw JSON evidence is stored as lossless gzip; decompression reproduces the original report bytes.

## Expanded earned-checkpoint matrix — initial instrument

[The retained complete matrix](earned-matrix-initial.json.gz) covers 36 earned baselines: the first layout of every world, Survivor/Riy and three seeds. Fan/Echo/Systems, Standard/Veteran and one/three airframes use the explicit balanced rotation in the probe. Each available baseline branches at 120, 180 and 240 seconds into a rotating park, shuttle or tiny-circle policy. Branches continue through loss/win, with a 720-second cap counted as inconclusive. This is pairwise dimension coverage, not every combination.

Initial result: **13 active wins, 23 active losses; 91 unattended losses, 17 unavailable checkpoints, no unattended wins or caps.** The longest safe unattended interval was 29.67 seconds. All initial source hashes remained stable. A missing checkpoint is not a pass.

| World | Active wins / six | Available unattended losses | Unavailable checkpoints |
| --- | ---: | ---: | ---: |
| field-crossing | 3 | 18 | 0 |
| freight-depot | 1 | 13 | 5 |
| relay-ruins | 2 | 17 | 1 |
| river-port | 2 | 9 | 9 |
| chalk-quarry | 3 | 17 | 1 |
| orchard-strongpoint | 2 | 17 | 1 |

These active losses cannot all be blamed on automation. The Shunting Yard / Echo / Veteran / one-airframe baseline had a 0.63-second wall hold without damage, but died from contact while moving in open ground at 119.23 seconds; its [exact input/position trace](pilot-wall-failure.json.gz) is retained.

The review pilot nevertheless had two independent defects: it could plan paths through solid cover and predicted V4 coordinated enemies from obsolete pursuit steering. A clean obstacle fixture reproduced ten seconds of wall holding and no salvage; the corrected policy collected the same salvage in 1.88 seconds with no blocked choices. A moving-body fixture also verifies actual-velocity avoidance. The correction changes only review automation, not gameplay rules. The 23 failed configurations and their associated branches are being rerun separately; their initial outcomes remain above.

[Probe source](earned-checkpoint-matrix.mjs) supports `--part=0/2` for a deterministic batch and `--cases=6,7` to rerun exact case IDs. Reports are lossless `.json.gz`. The fixture tests are in `game/test/overflight-review-pilot-terrain.test.mjs`; [combined pilot/movement test output](pilot-and-movement-tests.txt) records 14 passing tests.
