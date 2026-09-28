# Civilian FPV practice

Open `optional-practice/civilian-fpv/index.html` in a local preview, or use Flight
practice from the FPV Home/Controller Lab when its independent package is published.
Local Home links explicitly identify source previews as unqualified. The historical
`civilian-flight` assisted overhead gym keeps its own installation and transcripts.

## Play and radio setup

Choose a drill, mode and movement source. All twelve drills are available. Keyboard
uses W/S pitch, A/D roll, Q/E yaw and Up/Down for persistent manual throttle; P pauses.
Touch offers Mode 2 sticks. USB radio setup shows devices and raw channels first:
select device → identify each axis → record travel → measure centres → verify the
animated sticks → save. Full-travel radio throttle maps its endpoints to 0–100%; a
spring-centred gamepad is labelled separately and its centre is 50%.

Stick diagrams do not remap channels. Calibration does not add sensitivity curves.
The separate response page previews a linear/cubic blend, maximum angular rate
(degrees/second), maximum self-level tilt (degrees), and response duration (50 Hz
steps). This is an original simulator response profile, not a Betaflight import.

Initial arm requires low throttle and neutral attitude controls. Pause, focus loss,
disconnection, a changed device or profile clears live input. Airborne resumption
requires matching the saved controls; reset returns to launch disarmed. A latched
arm switch must first be observed off and then deliberately on in the foreground.
A saved profile is reverified when selecting the device. Storage failure is visible;
export before leaving a session that could not be saved.

## Authoring and rewards

Open Controls → Course Studio. Guided controls edit bilingual objectives and
explanations, ordered volumes, directional gates, landing criteria and hold durations.
The optional exact demonstration must replay successfully against that course.
Advanced JSON and a bounded Studio bundle preserve explicit practice reward data.
Changed courses and reward bindings require new immutable revisions. Previewing or
watching an example never earns; return explicitly to Try for an ordinary attempt.

The notebook uses the shared reward model/store and knowledge reader. Its v2 evidence
contains exact model/course/mode/response identities and a verified attempt digest;
it never fabricates arcade clears. Proofs live in separate records under the simulator
namespace of the existing profile database. Backup/import transfers proofs and
recomputes outcomes. Twelve distinct drills, each in either allowed mode, unlock the
main notebook; twelve in Acro unlock a separate distinction. Repetition cannot fill
a missing drill. The wing cosmetic changes presentation only.

Imports verify cooperatively and offer Cancel. Closing a notebook interrupts pending
work; cancelling retains the pasted backup and earns nothing from that import.
An accepted live completion verifies asynchronously while Next/Retry stays usable.

## Model and replay contract

`civilian-quad-fixed.v1` executes 50 steps/second. Position is integer millimetres,
velocity is millimetres/second, angles are hundredths of a degree and quaternions
use a scale of 1,000,000. Checked-in rotation values and bounded integer operations
control authoritative state; Three.js floating-point camera rendering is cosmetic.
World +X is right, +Y is up and forward is −Z. Positive pitch tips forward, positive
roll tilts right and positive yaw turns right. Gravity, tilted thrust, drag and
momentum remain active in both modes. Self-level seeks attitude targets; Acro seeks
angular rates. Neither is a hidden position or altitude hold.

A directional gate requires starting strictly on its approach side and crossing its
plane through the inclusive opening; swept rational tests handle between-step
crossings. Hold ticks must be consecutive. Landing records impact speed/attitude,
so settling after a hard impact does not turn that landing into a valid one. Primitive
obstacles use stable ID order and conservative swept contacts. Each frame stores
four quantized controls; 36,000 frames fit a full twelve-minute attempt. The recorder
refuses overflow instead of truncating proof.

Run `npm run practice:test` for focused automated checks. Numeric portability can be
repeated with `scripts/verify-fpv-portability.mjs`, a separately installed Playwright
module path, a source server URL and output JSON path. The renderer is admitted as
exact upstream Three.js 0.186.1 core/module files and MIT licence. The optional runtime
and applicable source archive each retain the 8 MiB/64-file limits. Playwright and
its browsers are test tools and are not game dependencies.

`node scripts/observe-fpv-runtime.mjs /absolute/path/to/playwright/index.mjs /tmp/fpv-observation.json`
builds an isolated temporary runtime with production-style headers, checks twenty
drill/reset cycles and four viewport layouts, samples final-circuit frame pacing,
then verifies actual WebGL context loss during active practice. It uses installed
Chrome and removes its own temporary host. The report pins both runtime and harness
bytes; its scoped measurements do not establish radio hardware or learning transfer.
