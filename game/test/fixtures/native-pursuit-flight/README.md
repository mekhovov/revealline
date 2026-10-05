# Native pursuit completion witnesses

These twelve fixed control streams complete the six current Native Pursuit playlist samples in Self-level and Acro. They use each sample's authored seed, geometry, finite population and objective. Refuge Return and Meeting Yard use their explicit r2/v2 successors; the other four retain r1/v1. Historical recordings are unchanged.

| Sample                           | Seed | Native ticks in each mode |
| -------------------------------- | ---: | ------------------------: |
| Runner Court                     | 9801 |                       326 |
| Burst Lanes                      | 9802 |                       416 |
| Refuge Return · Committed routes | 9803 |                       983 |
| Switchback Crossing              | 9804 |                     1,061 |
| Meeting Yard · Committed routes  | 9805 |                       812 |
| Armor Windows                    | 9806 |                     2,230 |

All routes use the native Gentle response, retain 100 hull health and finish with zero solid/protected contacts and zero shots. The native catch path records legal body contact separately from damage contacts. Armor Windows catches Brace during recovery and approaches Shield from an exposed side/rear. Refuge completes with its optional courier still active.

`manifest.json` pins current playlist ownership, course revision and seed, exact recipe digest, generator bytes, compressed CSV bytes, expanded input identity, runtime/backend, response, rules and final state identity. Each CSV row contains `repeat,roll,pitch,yaw,throttle,actions`; inputs are native quantized controls. The test expands and hashes these fixed bytes, starts the unchanged native course, records consumed controls, restores through native replay halfway through, and compares both completed recordings with an independent native replay. No imported actor coordinates or mutable state are installed.

The controller in `generate.mjs` reads current native positions, velocity, attitude and visible pursuit phase/facing, then submits ordinary flight controls. It predicts an interception point from previously observed motion. It never mutates the world, actors, armor, score, objective, physics or random state. Shield approaches use altitude and a lateral route before descent; a failed head-on attempt is not converted into a success by changing protection.

From the repository root:

```sh
node game/test/fixtures/native-pursuit-flight/generate.mjs --check
node --test game/test/fpv-native-pursuit-completion.test.mjs
```

An intentional route replacement uses `--write`, followed by review of the fixture and manifest diff. Normal regression tests never regenerate or adapt their inputs.

These are **software-generated completion existence witnesses**, not human flight demonstrations. They prove these accepted recipes, response settings and seeds only. They do not establish intuitive controls, enjoyable interception, phone/gamepad performance, artistic quality, every seed, or public-release qualification. They also do not create six new layouts: these behavior samples share the existing training yard.
