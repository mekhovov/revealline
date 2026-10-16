# Native SIM soldier geometry — industrial roster v3

The native renderer now has twelve family rigs in each of the three existing casts. This is original Three geometry built through the current renderer's registered `part()` function and borrowed, host-owned materials. No raster textures, downloaded models, skeletal runtime or additional simulation format is introduced.

## Runtime ownership

Adoption requires all of: `artReview=industrial-roster-v3`, effective `military-field/r1`, the exact `builtin:military-field-soldier` enemy binding, a native hostile patrol/sentry with `fireEveryTicks: 0`, and membership in the selected Contact Hunt population or its admitted optional Courier population. The family must be one of the ten native pursuit counterparts. Existing legacy Hunt lookout/patroller counterparts also use this explicit presentation choice.

Guard and Relay Warden have native geometry available to review, but neither is added to native pursuit. Existing armed non-Hunt actors keep their previous rig. The artwork adds no weapons, armor rules, damage, targets or objectives. Historical art choices, nonmilitary collections and Company/custom enemy bindings retain their original paths.

The renderer preserves the actor's accepted position and heading, specialist protection rings and exact turn/intent cue. A warned Shield keeps its current protected front. Brace recovery visibly opens its plate only during the native recovery phase. Pursuit warning/burst phases never imply aiming or firing. An accepted rendezvous survivor changes to the Runner rig through the existing family-change rebuild.

## Family and cast treatment

| Family          | Native distinguishing equipment and pose                      |
| --------------- | ------------------------------------------------------------- |
| Lookout         | Twin binoculars, stationary scan and raised observation pose  |
| Patroller       | Patrol pack, transverse bedroll and measured gait             |
| Runner          | Narrow torso, light harness and canteen                       |
| Sprinter        | Compact headset, light belt, warning crouch and fast gait     |
| Courier         | Offset satchel, clasp, strap and bounded bag swing            |
| Guard           | Broad vest and paired equipment pouches; review geometry only |
| Refuge seeker   | Shelter roll, hood and pack; warning gesture                  |
| Switchback      | Scarf collar and articulated scarf tip; warning gesture       |
| Rendezvous pair | Handset, radio pack, antenna and meeting gesture              |
| Shield bearer   | Frontal plate and viewing slot aligned with native heading    |
| Brace trooper   | Reinforced shoulders, rear pack and hinged recovery plate     |
| Relay warden    | Command pack, receiver and map case; review geometry only     |

Field kit has symmetrical vest pouches. Worn field kit has exposed forearms, an uneven pouch and a repair patch. Winter kit adds a parka collar, hood flaps and wider sleeves. All use the existing shared actor palettes and the same `industrial-soldier-kit.mjs` equipment identities as the overhead art and destruction treatment.

Pose sampling is a pure function of accepted simulation tick, movement, blocked/active state and current phase. It neither advances a private clock nor changes the actor root. Repeated draws, Pause and reconstruction at the same tick reproduce the same joints. Reduced effects stops gait, scan, breathing and equipment cycles while preserving static warning/recovery poses and protection readability.

## Measured source checks

`game/test/industrial-native-soldiers.test.mjs` exercises 12 families × three casts × three quality settings and 32 phase/tick samples per rig. Its twelve cases cover geometry distinction, registered resource ownership, bounds, same-tick/seek reconstruction, Reduced effects, current-facing Shield behavior and exact historical/custom admission boundaries. They also compare native satchel and shield paints with the shared live/debris kit and exercise four author-valid aspect ratios. Two cases execute the production renderer on the actual Armor Windows course with its accepted world theme profile, checking v3 dispatch, authored/historical/custom boundaries and exactly-once scene-replacement/disposal ownership.

| Quality         | Observed meshes per rig | Maximum geometry array storage |
| --------------- | ----------------------: | -----------------------------: |
| Low             |                   25–28 |                   27,024 bytes |
| Balanced / High |                   29–32 |                   35,568 bytes |

All 36 family/cast geometry signatures differ at each quality, independently of names, colors and UUIDs. At the measured radius of 0.3 m and height of 1.8 m, standing geometry reaches at most 1.181906 radii horizontally. Sampled poses reach at most 1.652705 radii; their vertical range is 0.016699–0.968370 of actor height. The same strict bounds also cover the sampled native-valid radius/height pairs (0.1/0.2, 0.1/5, 2/4 and 2/5 metres), with leg joints supporting boot corners above ground throughout those sampled phases. These are cosmetic extents, not collision dimensions or a proof over every possible authored value. The storage figures count geometry position/normal/UV/index arrays; JavaScript objects, renderer buffers and materials are additional. No image textures are allocated by the rig builder.

The twelve focused regressions pass on Node 22.22.2. The 24 related existing machinery, native vehicle and native Hunt regressions also pass. Scoped lint and formatting pass. Full source-bound checks, optional package admission and any live browser observations belong to the parent integration receipt; they are not inferred from these structural checks.

## Native review path and limits

Open FPV Worlds through its normal installed-runtime entry with the explicit v3 art choice and Military Field appearance. Appearance query parameters are defaults: existing personal choices remain authoritative. If Follow game resolves to Original mission visuals, select **Settings → World appearance → Military Field** before starting the review attempt. In Missions, select the native pursuit courses: Runner Court, Burst Lanes, Refuge Return, Switchback Crossing, Meeting Yard and Armor Windows. They retain native Start/Pause/Retry, self-level/acro choices and their original objective/seed ownership. Refuge Return includes the optional Courier; Armor Windows exposes the Shield and Brace states. Open the paused Enemy field guide for the accepted population and native counters. World Studio Preview uses the same renderer for accepted authored courses.

Human recognition, camera-distance readability, 320/360/390 px devices, controller handling, worst-case twenty-actor frame time and GPU memory remain qualification work. Twelve constructed rigs do not imply twelve native gameplay policies. This evidence does not promote the opt-in artwork to a public default or certify campaign completion routes.
