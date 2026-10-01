# FPV Flight School

Flight School now contains **26 lessons with 122 guided steps**: a recommended **14-lesson Acro course**
and the original **12 optional self-level fundamentals**. The Acro sequence reuses
the two existing Acro lessons and adds 12 distinct tasks. Players see a control,
study an illustrated drone response and practise it in the existing simulator.
The original 12 Academy drills, their demonstrations and the other 48 challenges
remain unchanged. The combined catalogue contains **86 authored challenges**
across the same eight worlds. A definition count does not certify art polish or
unfamiliar-player acceptance.

The original school is published for review in PR #905, following the native
simulator UI in PR #904. The additive Acro curriculum is a further focused
increment. Its integration, PR and public deployment are tracked separately;
this document does not claim completion of the broader P0–P8 implementation plan,
all content qualification or release readiness.

## Recommended Acro course

| Sequence | Stable ID   | Skill                                                    |
| -------: | ----------- | -------------------------------------------------------- |
|        1 | beginner-15 | Four controls, deliberate arming and small takeoff       |
|        2 | beginner-16 | Thrust, climb and controlled descent                     |
|        3 | beginner-13 | Rate control: the tilt stays (original course unchanged) |
|        4 | beginner-17 | Active levelling and low-speed hover                     |
|        5 | beginner-14 | Straight line, braking and landing (original unchanged)  |
|        6 | beginner-18 | Roll and lateral braking without yaw                     |
|        7 | beginner-19 | Yaw heading versus actual travel                         |
|        8 | beginner-20 | Height control while tilted and moving                   |
|        9 | beginner-21 | Coordinated right and left turns                         |
|       10 | beginner-22 | Two loops joined as a gentle figure eight                |
|       11 | beginner-23 | FPV horizon, landmarks and remaining drift               |
|       12 | beginner-24 | Three ordered directional gates                          |
|       13 | beginner-25 | Deliberate small upset, recovery and precise landing     |
|       14 | beginner-26 | Solo route with both turns, gates, braking and landing   |

The primary Acro course has 71 guided steps. The exported `ACRO_LESSON_ORDER` is the recommended sequence; stable IDs are not
display numbers. `SELF_LEVEL_LESSON_ORDER` identifies the optional original 12.
The player app chooses FPV and Gentle while flying a recommended Acro lesson,
then restores the player's previous camera, mode and response on exit. The main
progress bar, Continue and Next lesson actions use this 14-lesson sequence. The
original 12 self-level lessons appear in a separate collapsed optional section,
with their own completion count and Next sequence. Existing
lesson metadata remains intact to avoid silently changing historical content.
All newly authored lessons default to Acro/FPV and have EN/UK step instructions,
explanations and tips. The coach identifies the selected learning track, shows
its actual sequence number and offers the control explorer in either track's
first lesson.

## Original course and player experience

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
previous mode, camera and response preferences are restored when leaving the
course. Gentle response applies during lessons; controller calibration is
preserved. Saving a new response in radio setup updates the preference restored
on exit while the active lesson keeps Gentle response. School
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

`world-catalogue.mjs` exports `BEGINNER_LESSONS` and `BEGINNER_CATALOGUE`. Metadata
uses zero-based stable indices and numeric estimated durations. Original IDs
`beginner-01` through `beginner-14` preserve their course bytes and
`fpv-beginner:654387e76ace406c` identity. New `beginner-15` through `beginner-26`
courses have a separate additive `fpv-acro-school` identity. The old Academy and
world identities remain unchanged. Every coach step maps one-to-one to a real
`FlightCourse.v2` objective. `beginner-coach.mjs`
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

## Additive Acro physics evidence

Run `node scripts/qualify-fpv-acro-school.mjs --output docs/evidence` to reproduce
the Acro authoring evidence. The script supplies ordinary normalized commands
from each grounded spawn, records the actual quantized commands, and independently
replays every completed attempt. It changes no runtime state, response constants
or course objective while flying. All 14 primary lessons completed with zero
contacts and full health using the unmodified Gentle profile.

[The new receipt](evidence/fpv-acro-school-physics-20261001.json) binds the source
hash, exact pack identities, proof hashes and final-state identities.
[The complete recorded commands](evidence/fpv-acro-school-demonstrations-20261001.json)
are retained so this evidence is replayable after local scratch files are gone.
These are demonstration sessions and cannot earn player completion. All 14 are
also installed in the existing `world-demonstrations.mjs` dependency and exposed
by each primary lesson's Watch demonstration action. Playback defaults to half
speed, with quarter-, half- and normal-speed choices. Recorded controls are
labelled separately from the coach's illustrative example; live input cannot
change the recording. Playback uses the actual course and physics, verifies the
complete proof before showing it, and never grants lesson progress. Use
`--install-demonstrations` with the qualification command to regenerate the
installed additive rows without replacing the existing world demonstrations.
The original physics receipt remains unchanged. Pilot completion times do not
estimate a beginner's learning time; unfamiliar-player and physical-radio
acceptance remain separate required observations.

Public delivery is tracked in [PR #905](https://github.com/mekhovov/revealline/pull/905),
which follows PR #904 in protected native stack #902. Exact-head checks and
deployment verification remain required as described in
[continuous delivery](fpv-continuous-delivery.md). A local playtest or
successful physics replay is not evidence of a live public release.
