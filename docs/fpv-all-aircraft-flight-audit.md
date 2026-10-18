# All-aircraft flight audit

Audit date: 2026-10-18. This report distinguishes complete catalog startup coverage from longer sampled flights. It verifies that the implemented simulator uses the selected numerical aircraft and controller configuration. It does not establish measured whole-aircraft fidelity, physical-radio compatibility, or successful completion of every mission.

## Course and learning qualification

The course tests use the production Rapier aircraft simulation, with gravity, full aircraft collision geometry, the authored course terrain and moving actors, and the production Academy/World mission adapters. They run the current `civilian-quad-aircraft-regional.v2` backend at 500 Hz, committing mission intervals at 50 Hz. The `regional` suffix here denotes the terrain-backed solver; these are authored courses, separate from the streaming Regional host.

### Exhaustive startup coverage

All **13 aircraft × 216 catalog entries × 2 flight modes = 5,616 startup combinations passed**. The 216 entries comprise 12 standalone Academy lessons, 146 World entries, and 58 Beginner/learning entries. Catalog entries can share a course ID; this is a count of launches, not a count of distinct maps.

Each combination prepares its complete terrain, arms, and advances one accepted mission interval in Acro and Self-level. Checks include successful initialization, finite physical motion, correct aircraft collision radius/support height, matching physical/mission clocks, and unscored practice policy. These are startup checks; they must not be described as sustained flights or completed lessons.

The existing course suites also passed edited battery/camera-payload launches, mission motion integration, recovery identity and historical-backend compatibility. Result: **28 tests passed** in `fpv-aircraft-course-matrix.test.mjs` and `fpv-aircraft-course.test.mjs`.

### Sampled takeoff and control flights

Every aircraft flew 14 sampled courses in both modes: 2 Academy, 8 World, and 4 Beginner courses. That is **364 flights**, each **3.6 simulated seconds**, across **130 distinct host/course pairs**: all 12 Academy lesson IDs, 82 World course IDs, and 36 Beginner lesson IDs.

The World sample includes coast, quarry, rooftops, orchard, solar farm, rail depot, woodland, warehouse, container yard, courtyard, garage and stadium environments, along with native-pursuit, snake-hunt and World-hosted Academy courses. Beginner samples include initial control lessons, obstacle lessons and advanced maneuver lessons. Oversized aircraft keep their dimensions; passing a takeoff check does not imply that an aircraft fits every later opening in the course.

Sampling is reproducible. For zero-based aircraft index `i` in `listAircraftPresets()` order, the seeds are `8307 + i` for Academy, `9181 + i` for World, and `14071 + i` for Beginner. The sampler advances unsigned 32-bit state using `state = (1664525 * state + 1013904223) mod 2^32` and removes the selected `state mod remaining.length` entry, without replacement. The catalog arrays and sampler are in the committed test.

Each flight settles at zero throttle for 0.4 seconds, climbs at the aircraft's calculated hover throttle plus 0.04 for 1.6 seconds, then uses its hover throttle. At 3 seconds it receives a 0.2-second roll/pitch/yaw command, followed by 0.4 seconds of release. All sampled flights:

- Remained active with synchronized mission and physical clocks and finite motion.
- Rose more than 0.1 m above the authored spawn and remained upright.
- Rotated in the requested roll, pitch and yaw directions.
- Slowed yaw rotation after release.
- Passed exact equality checks against the actual solver's accepted mass, inertia, rotor geometry, propulsion, complete PID/filter configuration, rates and selected assist mode.

### Independent configuration effects

An additional **156 flights** compare four configurations for every aircraft in each of Academy, World and Beginner practice: the catalog setup, 10% greater mass/inertia, doubled Actual yaw center sensitivity, and half the yaw proportional gain. All use identical input sequences and the baseline's throttle, so the changed behavior cannot be explained by a different input script.

All comparisons passed: increased mass reduced climb; changed rates increased both requested and achieved yaw rotation; lower yaw P changed transient tracking while leaving requested yaw unchanged. Full solver-record equality also verifies the unmodified gains, filters, electrical limits, geometry and other settings. These checks demonstrate active configuration plumbing and physical response, not just correct picker names.

### Aircraft results

| Aircraft                | Catalog ID             | Startup combinations | Sampled flights | Configuration-effect flights |
| ----------------------- | ---------------------- | -------------------: | --------------: | ---------------------------: |
| BETAFPV Air65 II Racing | `air65-ii-racing-2026` |              432/432 |           28/28 |                        12/12 |
| BETAFPV Meteor75        | `meteor75-analog-2022` |              432/432 |           28/28 |                        12/12 |
| BETAFPV Meteor75 Pro    | `meteor75-pro-matrix`  |              432/432 |           28/28 |                        12/12 |
| BETAFPV Meteor85        | `meteor85-analog`      |              432/432 |           28/28 |                        12/12 |
| Happymodel Mobula8      | `mobula8-analog-2023`  |              432/432 |           28/28 |                        12/12 |
| BETAFPV Pavo20 Pro II   | `pavo20-pro-ii-o4-4s`  |              432/432 |           28/28 |                        12/12 |
| GEPRC SMART35           | `smart35-analog`       |              432/432 |           28/28 |                        12/12 |
| iFlight Nazgul ECO XL5  | `nazgul-eco-xl5-v11`   |              432/432 |           28/28 |                        12/12 |
| iFlight Mach R5 Sport   | `mach-r5-sport-2050`   |              432/432 |           28/28 |                        12/12 |
| HGLRC Rekon7 PRO        | `rekon7-pro-o3`        |              432/432 |           28/28 |                        12/12 |
| iFlight Chimera7 Pro V2 | `chimera7-pro-v2-o4`   |              432/432 |           28/28 |                        12/12 |
| iFlight Helion Pro      | `helion-pro-o4`        |              432/432 |           28/28 |                        12/12 |
| Holybro X650 V2         | `holybro-x650-v2`      |              432/432 |           28/28 |                        12/12 |

No course-physics defect was reproduced by these tests. The added sustained-flight and configuration-effect suite passed **28 tests in 86.8 seconds** on the local qualification machine. Combined with the existing course suites, this portion passed **56 tests**. Formatting and lint checks also passed.

### Reproduce

```sh
node --test game/test/fpv-aircraft-course-matrix.test.mjs game/test/fpv-aircraft-course.test.mjs
node --test game/test/fpv-aircraft-course-flights.test.mjs
```

The new suite is also included by the existing `npm run practice:test` aircraft-test wildcard. These checks do not replace later pilot comparisons, bench/flight-log validation, long-session endurance checks or physical-device testing.

## Physical model audit

An additional 41 targeted checks passed for component accounting, SI units,
inertia and rotor geometry, allocation/desaturation, current and voltage sag,
propulsion interpolation, drag direction and historical input compatibility.
An independent all-catalog calculation found no inconsistent mass totals,
wheelbase diagonals, hover moments or power bounds. Installed mass spans
25.9 g–3.2 kg; calculated hover throttle spans 31.8–49.7%, and calculated
thrust-to-weight spans 3.04–7.09.

All 13 current presets still use estimated propulsion coefficients rather than
measured propulsion tables. Motor KV is source metadata; it does not imply a
measured motor/propeller map. Inertia, drag, motor response, reaction torque and
electrical coefficients retain their engineering-estimate labels. Using those
distinct values consistently is verified here; exact agreement with each real
aircraft is not.

## Interactive browser observations

On the published build preceding these additional fixes, direct keyboard flights
confirmed upright takeoff and steering for:

- Saved Helion Pro in the randomly selected **Canopy windows** course.
- Saved Helion Pro in **Your first Acro takeoff**, with the workbench explicitly
  reporting the setup as used by the current flight.
- Air65 II and X650 V2 drafts in **Your first Acro takeoff**: 1.0 m and 0.9 m
  above ground respectively after takeoff and a short steering command.
- Mach R5 Sport draft in **Alternating doors**, Pixel warehouse: 0.7 m above
  ground, upright, with the expected strong climb at 41% throttle.

These are short manually operated browser checks, not completed routes or
identical-input performance comparisons. The saved public setup was not changed.
No console errors were reported during those flights.

### Learning preview ownership correction

The actual learning flight already used the selected physical aircraft. However,
the guide's interactive control lab silently continued the Legacy reference
model when the player moved keyboard, touch, controller or radio controls.
It therefore did not demonstrate the selected aircraft's rates or PID tune.

For a physical setup, the guide now labels examples **Reference aircraft · watch
only** and offers **Practice with [setup name]**. That explicit action uses the
already-prepared selected-aircraft flight, including its frozen rates, controller
and camera. Incidental input cannot arm the host or take over a Legacy sandbox.
Recorded examples and historical Legacy practice retain their original behavior.

The local browser confirmed that keyboard input leaves the reference example in
watch mode, and the explicit Meteor75 practice action starts with zero throttle.
The resulting flight climbed upright to 0.9 m and responded to a roll command.
Automated checks cover keyboard, touch, controller and radio guards, Ukrainian
labels, retained Legacy interaction and saved custom Meteor75/Helion configurations
in both flight modes.

## Regional coverage and corrections

The Regional matrix uses pinned, verified map data and real collision meshes for
Urban Earthworks, Canal City, Alpine Highlands, Lunar Basin, Canyon Expanse and
Tropical Coastal Districts. Every aircraft flies each region in both modes,
rotating through **32 distinct authored starting points: 156 three-second flights**. The
actual solver must retain the exact aircraft, complete controller and rate
configuration, remain upright, climb, and respond to yaw and roll. This is
coverage of six map families, not every downloadable edition or an exhaustive
flight through each region. An additional **52 Regional configuration runs**
compare baseline, edited rates, edited PID gains and edited battery mass for all
13 aircraft. Commands, actual rotation and lift respond to the respective edits.
The geometry fixture verifies pinned manifest/asset hashes and byte counts.

The expanded tests reproduced and corrected four Regional faults:

1. Automatically facing the region centre could produce a negative heading,
   rejected by the unsigned-heading contract. Computed headings are now
   normalized into one turn; malformed explicit headings still fail validation.
2. Dense aircraft terrain inherited the reference quad's 128-collider limit.
   Aircraft regions now use the existing bounded aircraft collision format when
   needed. Previously admitted smaller frames retain their original identities.
3. Pausing during speculative terrain prefetch could make recording/checkpoint
   capture fail with cancellation. Saving now waits for commit/rollback and
   tolerates only an aborted prefetch with a consistent, admitted terrain frame.
   Actual worker/preparation errors still propagate.
4. Recovery could reconstruct a different terrain window around the restored
   drone, changing collider ordering and the continuation hash. New aircraft
   recovery wrappers record the last committed grid origin and verify the exact
   reconstructed frame before adoption. Older wrappers remain supported.

The Canal highwalk case restores the exact 142-collider frame. Rejected movement
leaves physical and recording state unchanged; checkpoint restoration and
repeated continuation agree exactly. Malformed or valid-but-wrong origins are
rejected without replacing the live flight or terrain. Existing historical
backend restoration remains covered. The targeted Regional/terrain suites passed
**50 tests** before the complete suite run.

The local browser also launched Meteor75 from Canal City's **High pedestrian
bridge**, flew upright with a pitch correction, saved a 10-second checkpoint and
successfully restored it while remaining paused. No console errors occurred.

```sh
node --test game/test/fpv-aircraft-regional-matrix.test.mjs
node --test game/test/fpv-aircraft-regional.test.mjs game/test/fpv-advanced-regional.test.mjs game/test/fpv-advanced-terrain.test.mjs game/test/fpv-advanced-terrain-storage.test.mjs
```

## Deployed-browser follow-up

The first release was verified on GitHub Pages at `7e9575053aa5`, including exact
published source-byte checks. The selected-aircraft learning entry and takeoff
worked. A further live check exposed an intermittent cancellation while restoring
a paused Regional checkpoint: a browser callback delayed by more than 250 ms
called the flight's pause method again, which cancelled the detached recovery.

The World host now discards elapsed time for an already paused or disarmed
session without invoking pause again. Running flight still freezes after a
stall. Explicit cancellation, blur, visibility loss and graphics interruption
retain their existing ownership. Academy's deferred-launch safeguards remain
unchanged; its course-session pause does not cancel the recovery verifier.

The Canal highwalk is an **air start**, not a ground takeoff: Meteor75 starts at
approximately 11 m above the world's datum, with the canal floor at −3 m.
Keyboard throttle rises by 35 percentage points per second, while this preset's
calculated hover is about 49.7%. A slow ramp therefore permits a substantial
initial fall. Reproduction with real terrain distinguishes this from a missing
aircraft configuration: immediate 60% throttle climbs upright; continuing the
keyboard ramp above hover arrests the fall. The deployed Meteor75 draft also
climbed upright at 71% throttle and responded to steering. No automatic throttle
or physical-constant changes were introduced to hide gravity or input behavior.

```sh
node --test game/test/fpv-world-recovery-stall.test.mjs
```
