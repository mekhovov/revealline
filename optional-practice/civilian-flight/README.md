# Optional civilian flight gym

This is a separate, simplified **assisted kinematic practice model**, not the
arcade game engine or a model of a particular aircraft. Commands select planar
velocity, yaw rate and climb rate. Neutral holds position. There is no inertia,
gravity, battery, motor model, radio setup or real aircraft connection. Floor and
boundary contacts are constrained, not simulated crashes. Completion is evidence
that a fictional route was followed in this model, not real flight proficiency.

The twelve bilingual drills cover lift/return, a steady point, forward/back,
lateral movement, a square, compass turns, turn/travel, height changes, slalom,
figure eight, two small landing pads and a synthesis tour. All checkpoints must
be reached in order; altitude and heading tolerances matter. Hold requirements
use fixed model steps. There is no deadline or campaign progression reward.

## Play and author

Serve the repository and visit `optional-practice/civilian-flight/`. Choose a
drill and Start. WASD/arrows control planar movement relative to the nose; Q/E
turn it; R/F climb/descend. Space/Escape pauses. Touch buttons work while held.
Keyboard controls belong to the focused gym. Leaving focus, hiding the page or
losing a selected gamepad pauses and clears input. Resume requires an explicit
action and fresh input. A standard-mapped four-axis gamepad can be selected;
unsupported/missing pads fall back to keyboard and touch. The illustrated Mode 2
assignment is specific to this educational model, not a universal channel map.

Controls & authoring contains JSON export/import. A catalogue has a versioned
model identity, civilian scenario, bounded gym, 1–24 drills with English/Ukrainian
copy, a floor spawn and 1–32 ordered checkpoints. Geometry is centimetres;
heading is clockwise degrees from the top of the diagram. Each checkpoint
declares radius, altitude tolerance, optional heading/tolerance, consecutive
hold ticks (20 ticks/second), and whether a settled floor landing is required.
Unknown/executable fields and out-of-bounds fixtures are rejected before import.

The practice transcript records bounded normalized inputs and exact catalogue
identity. `replayPractice` recomputes outcomes without accepting a completion
flag. A recording is bounded to 12,000 command segments or 72,000 model ticks;
reaching that storage bound pauses with an explicit request to reset the attempt.
Successful route results live only in this page visit; no Journey, reward,
profile, edition selection or shared game save is modified. Catalogue and
transcript JSON can be copied for explicit transfer. Reading/authoring pauses
practice. Canvas failure retains a text position/target interface. There are no
ambient motion effects, shake or flashing; model motion is necessary feedback.

## Separate optional distribution

`node scripts/build-optional-practice.mjs <new-output-directory>` creates a
development-only site and deterministic ZIP. It admits only this app's explicit
files and named shared validation/input/i18n dependencies. It projects validator
messages for English/Ukrainian instead of carrying unrelated edition catalogues.
`optional-package.json` lists exact byte counts and SHA-256 values, source
classification, package identity and unqualified engine references. The builder
can accept exact commit/tree references, but still requires release qualification.

The unchanged default/core build does not include `optional-practice/`. This
archive has its own 8 MiB/64-file bound and does not increase the existing core or
edition budgets. The release pipeline must explicitly admit/publish the optional
artifact; building it does not promote it. No core or edition compiler was changed.

In a built HTTPS/localhost package, Prepare offline registers a worker scoped to
this app directory and verifies every dependency before activation. Cache names
include the app path and immutable package revision. Removal unregisters only
that exact scope and removes only its cache prefix; game/edition caches and all
origin-wide storage remain untouched. A browser may control install presentation;
the manifest has an explicit separate app ID. Real multi-device installation and
controller evidence are deferred, not inferred from automated tests.

The optional builder reuses RevealLine's original deterministic 192/512-pixel
installation icons. The generated icons belong to this package's own verified
file list and worker cache; no other installation supplies them at runtime.

The distinction between stick assignment and flight-mode response follows
[ArduPilot's transmitter-layout documentation](https://ardupilot.org/copter/docs/common-radio-control-calibration.html)
and [PX4's flight-mode documentation](https://docs.px4.io/main/en/flight_modes_mc/manual_stabilized).
The gym's assisted rules are authored simplifications, not assertions about those
flight controllers. Real device calibration and operational flying are excluded.

# Directory and offline guide

Open [the bilingual player guide](guide.html) for choosing an app, first flight,
offline preparation, home-screen installation, updates, removal and recovery.
Use the maintained in-app control guide for exact input bindings.
Maintainers: [register and publish packages](../../docs/flight-practice-maintainer.md).

The package's `preview.png` is an actual local gameplay screenshot captured from
RevealLine source plus the SIM owner's startup correction on 2026-10-02. It is
not generated artwork and contains no privately imported world. Underlying
artwork/code retains the asset licenses documented in this package's inventory.
