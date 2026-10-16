# Versioned FPV skill objectives

This is the implemented data contract in
`optional-practice/civilian-fpv/world-model.mjs`. Courses may compose the following
objectives with existing `gate`, `hold` and `land` steps. All listed fields are
required, including explicit `null` where permitted; there are no omitted-field
defaults. Exact-key validation rejects extra fields and imported executable data.

## Common contract

Every skill target contains `type`, `min:{x,y,z}`, `max:{x,y,z}` and `maxTicks`.
Coordinates are safe integer millimetres within±100,000; each minimum is strictly
below its maximum. `min.y` is at least500mm. `maxTicks` is 1–5,000 at 50Hz. Angles
are integer centidegrees, angular rates centidegrees/second and speeds
millimetres/second. Zone membership is inclusive at its boundaries.

Both the previous and current tick must be airborne, inside the zone and free of
new contacts. Leaving it, touching a surface or exceeding the attempt window
resets the criterion to its entry conditions. A pause advances neither physics
nor skill progress. The actual world attempt retains its ordinary36,000-tick
limit; the unscored learning view has its separate existing lifecycle.

`worldCourseRequiresAcro(course)` detects skill targets in either mode array.
`createWorldFlight` rejects self-level for such courses. The four versioned type
names participate in normalized course identity and recorded dependencies; the
existing model identity and normalization of older courses remain unchanged.
Older snapshots do not acquire a skill field.

## `rotation-v1`

| Field         | Allowed value                       |
| ------------- | ----------------------------------- |
| `axis`        | `pitch`, `yaw`, `roll`              |
| `direction`   | `1` or `-1`                         |
| `angle`       | 9,000–72,000, in multiples of 9,000 |
| `maxReverse`  | 0–9,000                             |
| `maxOther`    | 0–72,000                            |
| `tolerance`   | 300–3,000                           |
| `entryUp`     | `upright`, `inverted`, `any`        |
| `settleTicks` | 1–250, no greater than`maxTicks`    |
| `maxAngular`  | 100–9,000                           |

Entry requires the specified body-up pose within`tolerance` and low angular rate
on every body axis. Progress uses the actual integrated signed body-axis
increments, with bounded opposite travel and absolute travel around other axes.
Sequential quarter-turn quaternion checkpoints are relative to the captured
entry orientation; quaternion sign equivalence is respected. Completion requires
the requested accumulated angle, final relative pose and angular rate no greater
than`maxAngular` for`settleTicks`. An upright endpoint alone cannot satisfy a
full roll; oscillations cannot accumulate unrestricted rotation credit.

Positive control-axis directions follow the flight integrator: right roll,
forward pitch and right yaw. Each new target captures its own actual entry pose;
this permits a half-roll followed by an inverted-entry pitch movement without
resetting the aircraft.

## `attitude-v1`

| Field        | Allowed value                    |
| ------------ | -------------------------------- |
| `up`         | `upright` or `inverted`          |
| `tolerance`  | 300–4,500                        |
| `ticks`      | 1–250, no greater than`maxTicks` |
| `maxAngular` | 0–9,000                          |
| `maxSpeed`   | 0–60,000                         |

The actual body-up vector must remain within the requested angle from world up
or down while total velocity and every angular rate satisfy their bounds for the
whole dwell. The inverted school exercise is brief falling recognition, not
inverted hover. Use a subsequent rotation and recovery/landing target to verify
safe exit.

## `path-v1`

| Field              | Allowed value                                    |
| ------------------ | ------------------------------------------------ |
| `plane`            | `xy`, `xz`, `yz`                                 |
| `center`           | Bounded integer`{x,y,z}` vector                  |
| `entryUp`          | `upright`, `inverted`, `any`                     |
| `entryBearing`     | `null`, or−18,000–18,000                         |
| `entryTolerance`   | 300–3,000, for entry pose and bearing            |
| `maxAngular`       | 100–9,000                                        |
| `radiusMin`        | 1,000–50,000                                     |
| `radiusMax`        | At least`radiusMin+100`, no greater than 100,000 |
| `direction`        | `1` or`-1`                                       |
| `sweep`            | 18,000–72,000, in multiples of 9,000             |
| `maxReverse`       | 0–9,000                                          |
| `noseToward`       | Boolean;`true` allowed only for`xz`              |
| `headingTolerance` | 0–9,000                                          |
| `axialMin`         | −50,000–50,000                                   |
| `axialMax`         | At least`axialMin`, no greater than50,000        |
| `axialTolerance`   | 0–10,000                                         |
| `coupled`          | `null`, or the rotation object described below   |

The first plane character is the horizontal coordinate of the angular calculation,
the second its vertical coordinate. Positive winding moves from the positive
first axis toward the positive second axis; for`xz`, this is+X→+Z. This is a world
path direction, not a direct left/right stick command.

Every entry and re-entry requires a valid radius, body-up pose and low angular
rate. A non-null`entryBearing` additionally requires the authored starting point.
Use it for a Split-S or powerloop so failure cannot restart halfway around the
path. Null allows an intentionally arbitrary orbit start.

Progress follows actual position and signed winding with ordered quadrant
crossings, bounded reversal and a swept inner-radius check. A movement exceeding
2,000mm in one tick is rejected as discontinuous; the ordinary fixed integrator
moves at most about 1.04m per tick. When`noseToward` is true, the projected horizontal
nose must face the centre within`headingTolerance`; a near-vertical nose fails.
A spin in place is not a spatial orbit.

Axial travel is displacement from entry on the world axis omitted by the plane:
`xz`→Y,`xy`→Z,`yz`→X. During winding it must stay within:

```text
axialMin × progress / sweep − axialTolerance
    ≤ displacement ≤
axialMax × progress / sweep + axialTolerance
```

Final displacement must be inside the exact`axialMin`/`axialMax` range. Both zero
disable this displacement condition; they do not enforce constant height. The
common zone still bounds all axes. Thus flat orbits need a narrow Y zone, beam
loops need a narrow sideways corridor and a travelling barrel needs a nonzero
signed Z range. Centre coordinates outside the selected plane do not determine
radius or substitute for those constraints.

A non-null`coupled` object contains exactly`axis`, `direction`, `angle`,
`maxReverse`, `maxOther`, `tolerance` from`rotation-v1`, plus
`phaseTolerance`1,000–9,000. Its rotation must pass the same intermediate/final
pose checks and remain coupled to path progress:

```text
abs(rotationAngle × sweep − winding × angle)
    ≤ phaseTolerance × sweep
```

A flat orbit followed by an in-place roll cannot satisfy a coupled loop or
barrel. Linear entry speed is not globally constrained by this target; author
approach crossings and following recovery holds where needed.

## `crossing-v1`

| Field                          | Allowed value                                           |
| ------------------------------ | ------------------------------------------------------- |
| `axis`                         | `x`, `y`, `z`                                           |
| `at`                           | −100,000–100,000                                        |
| `direction`                    | `1` or`-1`                                              |
| `minA`, `maxA`, `minB`, `maxB` | Integer−100,000–100,000; each minimum below its maximum |
| `minSpeed`                     | 0–30,000                                                |
| `forwardTolerance`             | 0–9,000                                                 |

A/B are the remaining axes in X/Y/Z order; a Y crossing uses A=X and B=Z. The
movement must start strictly on the approach side and reach or pass the plane in
the requested direction. Integer interpolation checks the actual crossing point
against the aperture. Velocity along the normal must reach`minSpeed`, and the
actual nose-forward component must align within`forwardTolerance`. A tolerance
of 9,000 permits a perpendicular nose, as used for the upright upward-pop exercise.
Tighter authored dive tolerances reject an upright fall as a nose-down dive. A subsequent hold or landing verifies
recovery separately.

## Runtime feedback and editing

Skill-bearing courses expose`state.skill` for the current target: index,
entry/active/complete status, reason, attempt ticks, dwell, captured entry pose,
start-axis position, rotation progress and path progress. Consumers must match
`skill.index` to`state.step`; an earlier completed target can remain in the
snapshot briefly. The shared`practiceSkillFeedback` observer translates this
state into EN/UK instruction, numeric progress and recovery hints. Rendering,
stick visualization and wall-clock playback speed never determine success.

Reset reasons include`airborne-clearance`, `outside-zone`, `time-window`,
`rotation-purity`, `missed-attitude`, `path-envelope`, `path-direction`,
`path-axial-progress`, `rotation-path-phase` and`ambiguous-path`; entry waiting
also reports`enter-zone`, `entry-attitude` or`entry-bearing` where applicable.

Creator placement and reimport support translation of the whole criterion:
zone, path centre, crossing plane and aperture move together. Rotation or scale
changes to skill anchors are rejected atomically rather than silently changing
their world-axis meaning. Explicit overrides remain preserved. The runtime
validator and exact import/export identity apply to all edited criteria.

## Qualification and limits

[Model evidence](evidence/fpv-skills-model-20261002.json) covers 21 runtime probes,
6 semantic counterexamples, all16 real Pro/Master routes and 90 v2 plus 24 v1
replays. [Boundary evidence](evidence/fpv-skills-schema-boundary-20261002.json)
records 20 validation checks; [content integration](evidence/fpv-skills-content-integration-20261002.json)
records 14 creator/geometry checks. Exact source hashes accompany each receipt.
The [school implementation report](fpv-pro-mastery-school.md) separates browser,
publication and outstanding human/device qualification. No new unit suite or
real-world piloting certification is claimed by this schema.
