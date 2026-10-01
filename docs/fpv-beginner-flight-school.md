# FPV Flight School

Flight School adds a complete beginner learning sequence to World Studio: **14
lessons with 59 guided steps**, including 12 self-level fundamentals and two
optional introductions to Acro. Players see a control, study an illustrated drone
response and practise it in the existing simulator. The original 12 Academy
drills, their demonstrations and the other 48 challenges remain unchanged. The
combined catalogue contains 74 authored challenges across the same eight worlds.

This is a focused feature increment on `codex/fpv-beginner-flight-school`, stacked
on the native simulator UI in PR #904. Its own PR and public deployment are
pending at the time of this checkpoint. It does not claim completion of the
broader P0–P8 implementation plan, all content qualification or release readiness.

## Course and player experience

Every lesson is immediately available. Progress suggests a next lesson without
locking the course, existing worlds, playlists or challenges. Players can repeat
any lesson, revisit its explanation and continue at their own pace. Lesson cards
show the practice mode, step count and an estimated learning duration; those
estimates include reading and practice, rather than authoring-pilot timings.

| Lesson                        | Main skill                                                  | Guided steps | Practice mode |
| ----------------------------- | ----------------------------------------------------------- | -----------: | ------------- |
| 01 · Meet your drone          | Four control axes, deliberate arming and a first small lift |            3 | Self-level    |
| 02 · Up, down, under control  | Throttle, climbing and gradual descent                      |            3 | Self-level    |
| 03 · Find your hover          | Position, speed and altitude corrections                    |            3 | Self-level    |
| 04 · Turn the nose: yaw       | Heading changes without confusing yaw with roll             |            5 | Self-level    |
| 05 · Forward with pitch       | Forward tilt, acceleration, levelling and drift             |            4 | Self-level    |
| 06 · Slide with roll          | Sideways movement while retaining heading                   |            4 | Self-level    |
| 07 · Brake, do not chase      | Counter-tilt, controlled reversal and settling              |            5 | Self-level    |
| 08 · Keep height while moving | Coordinating horizontal movement with thrust                |            4 | Self-level    |
| 09 · Your first corner        | Slowing, turning the nose and taking a new straight         |            5 | Self-level    |
| 10 · See through the goggles  | FPV viewpoint, horizon and landmark approaches              |            4 | Self-level    |
| 11 · Three friendly gates     | Ordered directional openings and gentle corrections         |            5 | Self-level    |
| 12 · Your first solo route    | Lift, travel, turn, gate, hover and landing                 |            6 | Self-level    |
| 13 · Acro: the tilt stays     | Rate control, centred sticks and active levelling           |            4 | Acro          |
| 14 · Acro: your first line    | Small rotations, braking and a controlled landing           |            4 | Acro          |

The training spaces use the existing hangar and meadow presentation, broad target
volumes and wide openings. All lessons start on the ground and finish with a
landing. Their collision damage is disabled; physical movement, contact and
landing conditions still use the normal runtime. These lessons introduce neither
combat actors nor hazards.

Each real course objective has one corresponding explanation, instruction,
reason and practical tip in English and Ukrainian. The guide presents large stick
diagrams, a drone-motion illustration and plain-language axis descriptions.
Lesson 01 lets players inspect each control separately. Practice displays the
current instruction and live telemetry; reopening the explanation pauses flight.
Illustrative movement is labelled as an example, with distinct example and actual
input indicators. It is not a recorded demonstration or an autopilot command.

## Controls, modes and progress

Radio diagrams use the selected calibrated Mode 1–4 layout. Radio preview is
read-only: observing a connected controller in the guide does not arm the drone
or advance its simulation. Keyboard and touch retain their existing mappings.
The guide explains that paused keyboard/touch indicators show the last flight
input; their real movement begins during practice. Keyboard throttle remains at
its chosen position after releasing an arrow key, and Shift provides finer
adjustments.

The course distinguishes thrust, attitude, heading and momentum. Self-level
returns toward a level attitude without holding altitude, position or speed.
Acro commands rotation rate and requires deliberate levelling. Centring the stick
does not erase drift in either mode. Height, speed, tilt, target dwell time and
actual course advancement drive the feedback; the guide never declares an
objective passed because an animation finished.

Lessons temporarily choose their teaching mode and starting camera. The player's
previous mode and camera preferences are restored when leaving the course, and
controller calibration and the existing response profile are preserved. School
completion requires a verified practice recording in that lesson's recommended
mode and exact content revision. Replays, demonstrations and editor previews do
not earn completion. Without persistent storage, the current session can still
show verified completion; portable recording backups remain available through
the existing Library.

Interrupted lessons use the existing exact-dependency, recorded-command recovery
path and deliberate resume checks. Existing focus-loss, radio-reconnect,
throttle-pickup and fullscreen/menu pause protections continue to apply. Course
progress and an interrupted attempt are separate concepts: completing a lesson
is durable only where its verified recording can be retained.

## Implementation and evidence

`world-catalogue.mjs` appends `BEGINNER_LESSONS` and `BEGINNER_CATALOGUE`. Metadata
uses zero-based lesson indices, numeric estimated durations, stable
`beginner-01` through `beginner-14` IDs and a distinct beginner content identity.
The old Academy and world identities remain unchanged. The metadata's 59 coach
steps map one-to-one to real `FlightCourse.v2` objectives. `beginner-coach.mjs`
observes host state and input; `world-app.mjs` owns flight creation, input,
verification, progress and recovery.

[The physics evidence receipt](evidence/fpv-beginner-physics-20261001.json) records
all 14 recommended-mode completions and independent replays with the unmodified
Gentle response profile. Every run used the actual fixed 50 Hz runtime, finished
with zero contacts and retained full health. The receipt binds the curriculum
file hash, beginner pack identity, response, proof hashes and final-state
identities. Its controlled-input authoring pilot establishes that every objective
is reachable and replayable. It does not establish that a novice will find the
course easy or finish in the pilot's measured time.

Functional verification remains required during implementation. New unit-test
coverage is deferred to the final qualification phase, as requested; no new unit
suite was added for this increment. Browser checks, radio lifecycle checks and
unfamiliar-player feedback are distinct from the physics receipt. First-time
player observation, physical-radio acceptance on the final build, sustained
hardware performance and broad release qualification must be reported separately
before claiming those outcomes.

Public delivery is tracked in [PR #905](https://github.com/mekhovov/revealline/pull/905),
which follows PR #904 in protected native stack #902. Exact-head checks and
deployment verification remain required as described in
[continuous delivery](fpv-continuous-delivery.md). A local playtest or
successful physics replay is not evidence of a live public release.
