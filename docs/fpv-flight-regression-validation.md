# FPV flight regression validation

Date: 2026-10-18. Baseline: workbench release PR #1575, merge
`b7f65a138d34c8a62d58246f3be9de86564c4279`.

## Confirmed regressions

The published aircraft controller accumulates integral correction while the
aircraft is supported on the ground. Holding roll at zero throttle, centring it,
then taking off can therefore invert an otherwise level aircraft. The reproducer
holds roll for 15 seconds before releasing and raising throttle. Meteor75 and
Helion Pro reproduce the inversion in both Acro and self-level.

The correction has a new aircraft backend identity, `civilian-quad-aircraft.v2`
(and its Regional equivalent). It resets integral correction only during actual
upward ground support. Airborne zero-throttle control and P/D/feedforward remain
active. Explicit v1 playback retains the original controller policy.

The live-site browser reproduced the published failure with a Meteor75. With the
local correction, the same keyboard sequence—Right for 15 seconds, release,
then W for 1.7 seconds—remained upright at 60% throttle and began climbing without
horizontal drift. A further eight seconds of flight and a brief pitch input also
remained upright. These are specific browser observations, not broad device or
pilot qualification.

The same ground-input takeoff also passed in the local Academy host: upright,
climbing and without lateral drift. In World, an unsaved Helion draft retained
its testing session through a self-level-to-Acro change and Retry, flew with
throttle and a brief roll input, then returned to the same unsaved editor draft.

With a saved Helion setup, testing an unsaved Meteor75 draft correctly starts
the Meteor. A subsequent mode change, retry or related host restart can load the
saved Helion configuration instead. This changes aircraft, controller, rates and
camera during what the player understands to be the same draft-testing session.
The fix preserves the complete accepted draft across these restarts without
saving it to the setup library. An explicit normal launch or exit ends the
draft session. Saved preferences and historical flight configurations remain
separate.

Related review found camera ownership risks: World preference changes serialize
the draft camera controls into general settings, and standalone camera controls
target the selected saved setup even while another setup is being tested. Draft
camera changes now stay within the temporary test session.

## Independent checks

| Check                                                | Scope and result                                                                                                                                                                                                                                       |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Preset selection → workbench draft → Apply & restart | Meteor75 and Helion Pro: delivered aircraft, controller and response exactly match their catalog configuration.                                                                                                                                        |
| Reopen and save unchanged                            | Both presets: identical persisted library bytes; no gain conversion, rounding or extra revision.                                                                                                                                                       |
| Effective settings resolution                        | Saved numerical controller, aircraft and rate values are copied; catalog revisions do not rewrite saved setups.                                                                                                                                        |
| Combined self-level controls                         | Both presets; roll/pitch 0.18 or 0.5 with yaw zero or the same input, three-second hold then four-second release, gravity enabled and no floor. All eight cases stayed upright and settled within 0.6° roll/pitch. Peak individual tilt was below 22°. |
| Existing qualification coverage                      | Numerical response and wall-contact comparisons use zero gravity. The earlier all-catalog gravity test ran for only 0.4 seconds and checked finite position, not sustained control. Replay identity proves repeatability, not flyability.              |

The combined-control probe used production simulation, catalog starter rates and
the calculated hover throttle. It did not compensate throttle for banking or
claim altitude hold. No source physics or gain values were changed for it.

## Flight-screen observations

- Acro retains tilt when rotation controls are centred. The existing drone
  response panel explains this and labels an inverted aircraft.
- Unrestricted practice can remain active after an inverted ground contact.
  Retry is available; the two-stick keyboard layout also provides R while the
  viewport has focus. No automatic flip or physical recovery assistance exists.
- The free-flight objective can still say “Explore freely” in that situation.
  There is no dedicated inverted-ground recovery prompt.
- Aircraft identity and control mode are not persistent flight HUD fields; the
  mode selector is hidden with immersive controls. A silent restart configuration
  change is therefore difficult to recognize from the flying view.

## Limits

These checks establish configuration integrity and specific simulated control
behavior. They do not establish real-aircraft fidelity, physical-radio quality,
pilot acceptance, or the entire browser/device matrix. A reusable controller tune
is copied in SI units without automatic scaling; using a tune from another
aircraft remains explicitly marked as untested for that aircraft.

## Fix qualification

The new control suite passes all 30 tests. Its 143 production-simulation cases
cover all 13 catalog aircraft with gravity and actual ground contact:

| Cases                     | Requirement and result                                                                                                                                  |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 13 sustained hover        | Settled vertical acceleration remains below 0.1 m/s² in magnitude; neutral attitude remains level.                                                      |
| 26 neutral takeoffs       | Acro and self-level take off after supported motor startup, stay within 8° of upright and finish below 0.1°/s rotation.                                 |
| 78 axis/release responses | Every roll/pitch/yaw axis responds in both modes. Release arrests rotation below 4°/s; self-level returns within 1°. Acro retains attitude as intended. |
| 26 ground-input releases  | After 15 seconds of roll input at zero throttle, centring and taking off stays upright for all aircraft in both modes.                                  |

Each aircraft passes all 11 cases above. Absolute mean hover acceleration during
seconds 3–5 is shown separately; the requirement is below 0.1 m/s². This measures
simulated force balance after motor startup, not real-aircraft agreement.

| Aircraft                | Hover acceleration (m/s²) | Cases |
| ----------------------- | ------------------------: | ----: |
| BETAFPV Air65 II Racing |                   0.00957 | 11/11 |
| BETAFPV Meteor75        |                   0.00188 | 11/11 |
| BETAFPV Meteor75 Pro    |                   0.02453 | 11/11 |
| BETAFPV Meteor85        |                   0.02091 | 11/11 |
| Happymodel Mobula8      |                   0.00891 | 11/11 |
| BETAFPV Pavo20 Pro II   |                   0.00143 | 11/11 |
| GEPRC SMART35           |                   0.01552 | 11/11 |
| iFlight Nazgul ECO XL5  |                   0.00583 | 11/11 |
| iFlight Mach R5 Sport   |                   0.00632 | 11/11 |
| HGLRC Rekon7 PRO        |                   0.02362 | 11/11 |
| iFlight Chimera7 Pro V2 |                   0.01479 | 11/11 |
| iFlight Helion Pro      |                   0.04573 | 11/11 |
| Holybro X650 V2         |                   0.07308 | 11/11 |

Additional tests preserve four pre-fix Meteor75/Helion v1 hashes, prove identical
airborne and wall-contact state across v1/v2, retain airborne zero-throttle
integral behavior, and verify v1/v2 replay, recovery and worker dispatch for both
the reference arena and Regional backend.

Review identified a separate version-selection issue in the course and Regional
host recovery wrappers: they initialized the latest solver before restoring an
older checkpoint. Both now initialize the recorded backend while retaining the
host's aircraft, controller, response and environment. Tests restore real v1
packets into newly created v2 hosts, remain paused, then match the original v1
continuation. Unsupported versions and a mismatched terrain-backend family are
rejected without replacing the live session. Backend and configuration identity
checks remain active; a restore does not import arbitrary session options.

Both complete course/Regional session suites pass: 23 tests, including the new
historical recovery cases, all-aircraft/all-mode session entry, terrain rollback,
paused recovery, archive ownership, cancellation and corrupted-checkpoint rejection.
The host regression tests separately cover temporary draft retention and unchanged
persisted library/camera bytes across Academy, World and Regional restarts.
