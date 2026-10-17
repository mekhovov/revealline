# Aircraft presets and continuous practice — 17 October 2026

This is the implementation and acceptance record for the approved realistic-aircraft
plan. The first release prioritizes twelve playable aircraft, editable setups,
all-environment unscored practice, and flying independently of recording capacity.
It supplements the earlier rates/profile/Betaflight compatibility work; it does not
replace historical simulation or recording identities.

## First-release behavior

- Open **Aircraft, rates & throttle** from Settings, Hangar, preflight, or pause.
  Select a reference aircraft to create an independent editable setup. Reopening a
  saved setup preserves its edits; selecting a reference does not mutate a shared
  rate profile. Default selection applies SIM-authored Actual rates; **Keep my
  current rates** preserves portable profiles and the exact Legacy response.
- Starter center sensitivity is 100°/s and expo is 25%. Maximum rates are 600°/s
  for whoops, 500°/s for cinewhoops and long-range, 800°/s for freestyle, 900°/s
  for racing, and 300°/s for the X650. These are SIM defaults, not factory tunes.
- Battery depletion is off. Installed battery mass, voltage sag and propulsion
  limits remain active. Capacity is not a recording-duration control. Explicit
  saved preferences and historical backends retain their earlier behavior.
- Every catalog aircraft is available in Academy, World, Regional, lesson, course,
  and draft practice, in Acro and self-level. Practice remains unscored. Mission
  objectives continue to operate; reaching the final objective does not force an
  exit. Aircraft-class course filters are optional clearance recommendations;
  **All courses** restores the complete list and never resizes an aircraft.
- Battery and additional physical-camera payload edits update mass, center of
  gravity, and inertia from a pinned component baseline. Cosmetic camera tilt and
  vertical FOV do not change physical mass. Physical coefficients and controller
  gains remain under Advanced. Custom mass positions and coefficients are estimates.
- Flight duration is unrestricted. At accepted 50 Hz mission boundaries, the
  recorder rotates roughly 60-second segments (earlier for byte/event limits),
  retaining at most three recent segments within its budget. The visible interval
  is the authoritative saved range; it is not a promise of a complete session.
- Recent clips and checkpoints can be exported. Automatic recovery writes one
  bounded, atomic IndexedDB checkpoint slot per host, at most every five seconds.
  The pause menu reports the last durable point. Quota/write failures retain the
  prior durable point and do not end or alter the flight. Import verification is
  cancellable and leaves the current attempt unchanged on rejection.

## Frozen reference catalog

The table lists the chosen component revision and calculated installed reference
mass, including the listed battery. Some reference pack masses are estimates;
field-level evidence in the catalog distinguishes them from manufacturer figures.
These aircraft are representative examples, not a sales ranking or an endorsement.

| Aircraft / frozen variant | Prop diameter / wheelbase | Default battery | Installed mass |
| --- | --- | --- | --- |
| Air65 II Racing, 2026 analog, 30000 KV | 31 / 65 mm | LAVA II 1S 320 mAh | 25.9 g |
| Meteor75, 2022 analog, 19500 KV | 40 / 75 mm | BT2.0 1S 450 mAh | 37.68 g |
| Meteor75 Pro Matrix, analog, 21000 KV | 45 / 80.8 mm | LAVA II 1S 580 mAh | 44.6 g |
| Meteor85 analog, 11000 KV | 50.8 / 85 mm | LAVA 2S 450 mAh | 69.95 g |
| Pavo20 Pro II, O4 Pro, ELRS, 5500 KV | 55.88 / 93.9 mm | LAVA II 4S 580 mAh | 171.2 g |
| SMART35 analog, 3850 KV | 88.9 / 155 mm | Storm 2.0 4S 850 mAh | 226.4 g |
| Nazgul ECO XL5 V1.1 analog, 1800 KV | 127 / 245 mm | 6S 1400 mAh reference | 652 g |
| Mach R5 Sport European canopy, 2050 KV | 127 / 210 mm | 6S 1400 mAh reference | 525 g |
| Rekon7 PRO O3, HQ DP7×4×3, 1350 KV | 177.8 / 324 mm | 6S 3000 mAh reference LiPo | 1029 g |
| Chimera7 Pro V2 O4, HQ 7.5×3.7×3, 1250 KV | 190.5 / 327 mm | 6S 8000 mAh Li-ion | 1621 g |
| Helion Pro O4, 900 KV | 254 / 414 mm | 6S 5600 mAh reference | 1903 g |
| X650 V2, MN4014 330 KV, Gemfan 1555 | 381 / 650 mm | 6S 10000 mAh reference | 3200 g |

The immutable source records and component evidence live in
[`aircraft-presets.mjs`](../optional-practice/civilian-fpv/aircraft-presets.mjs).
Installed assemblies already include motors, propellers, electronics and their
named camera system. Battery and explicitly absent receiver mass are added once.
Pavo uses the camera-equipped 116.2 g figure before its battery, not the 72.6 g PNP
configuration. X650 freezes the documented MN4014 revision. Descriptions and links
stay in catalog metadata; recordings retain bounded numerical behavior.

## Physics and compatibility

`AdvancedAircraft.v2` uses the new `civilian-quad-aircraft.v1` backend and its
Regional variant. Coupled controller, motor and rigid-body calculations run at a
fixed 500 Hz, with mission logic at 50 Hz. Rendering and controller-device polling
remain independent. Frequency never follows graphics quality.

The aircraft uses a consistent COM origin, body axes, rotor layout and spin
orientation; motor allocation and anti-windup reflect available torque. Motor
lag, thrust/reaction torque, battery current/voltage limits, inertia, directional
drag, armed idle, Airmode and versioned self-level assistance affect the response.
Full body/rotor geometry is used for collision, spawn clearance and Regional
terrain transactions. Landing telemetry uses actual contact speed and tilt.
Procedural render geometry follows the physical dimensions while retaining skins.

Physical state hashes exclude recording byte counters and persistence status.
An accepted recording boundary does not reset controller, motors, battery, random
state or terrain. Rejected Regional motion restores the whole proposed mission
interval. Workers reconstruct response/assistance from serializable records.
Recovery verifies a detached worker and mission before adopting either; imported
mission motion must agree with the verified physical checkpoint.

Old backend algorithms, demonstrations, scored attempts and recording formats
remain available. A checkpoint-origin clip verifies only from its retained initial
state and is unscored; it does not certify an entire earlier session. Imported
Betaflight PID/filter settings still do not become an aircraft controller tune.

## Evidence and limits

- Launch matrix: **5,184** complete prepare/arm/first-step sessions: twelve aircraft
  × 216 Academy/World/Beginner entries × two modes. Every launch retains actual
  dimensions and finite physical state; this is not a completed-course claim.
- Edited-component launch matrix: **72** sessions cover each aircraft in two modes
  across Academy, World, and lesson hosts, including changed battery mass and camera
  payloads. The editor handoff preserves those changes without counting mass twice.
- Numerical qualification: 250/500/1000 Hz compared with a 2 kHz reference. 250 Hz
  narrowly fails the 2% response gate; 500 Hz passes all twelve. Worst response
  difference is **1.076%**, with at least **19.87×** real-time capacity on the
  local qualification machine. Contact probes include 40 m/s wall approaches.
- Node, Chrome, Firefox and WebKit on the qualification Apple M4 Pro reproduce
  identical direct/worker recovery hashes for all twelve aircraft and both modes.
  Source-pinned reports record exact versions, timing and scope:
  [numerical report](fpv-aircraft-numerical-qualification.json) and
  [browser report](fpv-aircraft-browser-qualification.json).
- Continuous-runtime tests exceed twelve minutes and cross recording boundaries,
  compare recording enabled/disabled/quota-failed trajectories, and verify
  checkpoint and Regional rejection behavior. Host tests cover physical Academy,
  World, lessons and Regional, plus historical flight/replay behavior.
- Local browser checks exercise Meteor75 selection, World/Academy takeoff, paused
  recovery from the last durable point, and the actual settings workflow.
- Offline/native package checks include all aircraft modules, source/vendor
  integrity and native staging. Native staging is not physical-device validation.
  Academy's complete source file allowance increases from 121 to 131; World's
  increases from 180 to 190. Academy runtime/source bytes gain 128 KiB over 12 MiB,
  and unprojected original inputs gain 320 KiB over 12 MiB. The installed-core
  full-locales Academy cache measured 12,686,321 bytes (27,663 bytes below its cap). World retains 20 MiB and
  native retains 32 MiB. Final release checks must continue to enforce these caps.

Numerical agreement proves consistency of this model, not equivalence to a real
quad. Mass provenance is stronger than current propulsion, inertia, drag and
controller estimates. No radio, real-pilot, mobile-device, other-architecture or
whole-aircraft flight-validation result is inferred. The user has explicitly made
unavailable hardware/logs/pilot feedback nonblocking for this practice release.

## Research carried into implementation

- [Liftoff Micro Drones release notes](https://www.liftoff-game.com/news/full-release-liftoff-micro-drones):
  avoid double-counting installed motor/propeller mass.
- [VelociDrone manual](https://www.velocidrone.com/desktop_manual): optional class
  browsing and open practice alongside constrained competition.
- [ShramkoGSFPV](https://github.com/AndriiShramko/ShramkoGSFPV): derive performance
  cards from the simulation evaluator. Displayed hover and thrust/weight use the
  active numerical configuration and loaded voltage, not copied marketing claims.
- [BETAFPV Pavo20 Pro II](https://betafpv.com/products/pavo20-pro-ii-brushless-whoop-quadcopter)
  and [Holybro X650](https://holybro.com/products/x650-development-kit): freeze
  explicit camera-equipped and motor/frame revisions.
- [UIUC propeller data](https://m-selig.web.engr.illinois.edu/props/propDB.html) and
  [quadrotor system identification](https://arxiv.org/abs/2404.07837): static thrust
  measurements have specific motor/propeller/voltage/flow conditions. They cannot
  establish high-speed drag, transients or complete flight fidelity by themselves.

## Later releases and promotion gates

The bounded recent-clip release does not claim the following later work complete:

1. Persistent multi-segment session archives, bounded archive export and cancellable
   whole-session verification. Preserve the distinction between a complete verified
   session and a clip verified only from its starting checkpoint. Ghost paths must
   remain bounded.
2. Evidence-backed propulsion tables, deterministic interpolation, explicit
   extrapolation regions and power/energy-consistent current and sag. Refine
   inertia, transients and drag when suitable bench data or flight logs are available.
3. Optional endurance challenges, fresh-battery restart and repeatable conditions.
   The existing explicit depletion option is experimental; ordinary practice stays
   unlimited and depletion-free by default. Recordings/comparison classes must freeze
   every challenge and battery rule before scored use.
4. Measured propwash/ground effect, physical-device and pilot validation, and separate
   scored-class qualification. These remain evidence gates; estimated coefficients
   are not to be relabeled as measurements to close the plan.

The release can be published for live testing once its software, numerical,
persistence, package and all-mode gates pass. Public GitHub Pages acceptance is a
separate final check and must reference the deployed source revision.
