# Regional movement and origin prototype

This authoring-only increment connects verified regional terrain to an actual
moving flight body and two camera views. It does **not** make regional maps
available in the player catalogue. `playerReady` remains false, terrain
`flightReady` remains false, and the separate model identity is
`regional-authoring-flight-prototype.v1`. No recordings, rewards, challenges,
scoring or production collision policies are changed. The subsequent shared-air
extraction reuses the production equations without changing historical results.

## What can be reviewed

Serve the repository and generated Canyon sources from one local HTTP origin,
then open:

```text
/authoring/fpv-worlds/regions/flight-preview.html?manifest=URL_TO_CANYON_REGION_JSON
```

The manifest parameter fills the field; **Load region** starts verification. Use
**Arm**, then ↑/↓ to adjust throttle, W/S for pitch, A/D for roll and Q/E for
yaw. Arming focuses the canvas without changing input. Space arms and P pauses.
The small Camera selector provides Chase and FPV. This is an engineering preview
with keyboard input, not a replacement for shared SIM controls. Loading, focus
loss and hidden tabs pause. Region transitions explicitly pause before movement;
**Prepare terrain**, then deliberately **Arm** to continue. Preparation lowers
the preview throttle and clears held keys. At the outer extent or ceiling, use
**Reset**.

The preview uses the pinned Three.js renderer and existing verified source
coordinator. The manifest fetch is bounded to 8 MiB and 30 seconds, omits
credentials and rejects redirects. Scene/collision bodies retain their stricter
per-asset limits and hashes. The source directory must allow same-origin
fetching or explicitly support CORS. Canonical terrain remains unchanged; no
scenery, textures or arbitrary mesh are added.

## Movement and origin ownership

The body owns integer global position, velocity, fixed-point quaternion, angular
rates and accepted tick count. A proposed 50 Hz movement does not mutate that
state until:

1. The whole 220 mm collision sphere remains within the region extent and
   ceiling.
2. The required neighbourhood and chosen local origin match the verified window.
3. A conservative Rapier sphere sweep reports known terrain along the path.

Missing terrain, a changed local origin, unknown coverage or outer bounds reject
the candidate before pose, momentum or simulation time changes. Loading failure
leaves the body frozen. Successful preparation verifies support below the
current body on the staged terrain, before replacing the previous visual or
provenance, then swaps the terrain origin and both drone/camera poses
synchronously with no intervening await. Global pose, velocity, orientation,
angular rates and tick count are unchanged by that reframe. The camera and drone
use the same local frame. The coordinator accepts an optional copied support
pose (integer position plus 1–2,000 mm radius), not a callback or alternate
geometry. Invalid pose admission leaves the old visual frame and provenance
retained but disables query readiness. The terrain query world remains isolated
from all existing game physics.

Only the current terrain group is attached. Previous windows remove/dispose
themselves; required decoded cells are limited to nine and committed plus staged
geometry remains within the existing 2 MiB allowance. Cancellation invalidates
pending generations; disposal cancels loading, waits for cleanup and removes the
prototype root. Readiness never arms the drone: throttle must be down and
rotation controls centred explicitly. No hidden scoring or qualification path
exists.

## Shared physics boundary

The prototype, Academy and World Studio flight models now call the same
`advanceFlightAir` transition in `civilian-fpv/model.mjs`. The temporary force
port from the first prototype has been removed. Integer equations, operation
rounding and historical model identities are preserved; each production host still
owns validation, collision, boundaries, tick progression, lesson acceptance and
recording authority.

The manual verifier compares every position delta, velocity, angular rate and
quaternion against the full existing `createFlight` host for Acro and
self-level, with neutral and mixed rotation plus changing throttle, across four
80-tick traces. The historical demonstration/checkpoint fixtures separately
guard against both hosts drifting together.

Collision deliberately uses a conservative sphere stop, zeroing velocity at
contact. It does not implement production sliding, landing acceptance,
pre-impact speed, damage, obstacles, actors or motor dynamics. Sharing the
free-air transition is not collision parity or production player integration.

Origin migration currently covers terrain, the drone pose and the camera anchor
because those are the only live objects in this harness. A production
transaction must also cover actors, effects, audio, interaction targets,
renderer caches and all other world owners. The explicit pause at each
local-origin change is a safety boundary, not seamless streaming or a completed
long-flight experience.

## Functional receipts

```sh
node authoring/fpv-worlds/regions/verify-flight-prototype.mjs
node authoring/fpv-worlds/regions/verify-flight-prototype.mjs http://127.0.0.1:9011/region.json
```

Node v20.19.5, shipped Three.js and Rapier 0.21.0:

- Exact sampled free-air parity in Acro/self-level with throttle and rotation
  changes.
- Flat-terrain run: 2,196 accepted ticks, four cell crossings, five local
  frames; final global position `(514654, 148787, 192000)` mm. Every transition
  preserves body state exactly; local plus origin reconstructs the same global
  position. Scene children remain bounded to drone, camera anchor and one
  terrain group.
- Injected unavailable sources freeze all body state for 100 attempted ticks.
  Recovery remains disarmed and rejects elevated throttle before explicit
  neutral arming.
- A 15 m descent contacts the terrain without tunnelling below its surface.
- Ceiling rejection preserves the prior complete pose and tick count.
- Cancelled preparation and repeated disposal cannot advance or arm the body.
- Canyon source run: 1,398 accepted ticks and two crossings, final global
  position `(304090, 224598, 100000)` mm, no contacts. It consumes the actual
  generated manifest and hashed canonical assets, rather than caller-substituted
  terrain.

The Canyon receipt used the original 768 × 768 m representative from #1216,
manifest SHA-256
`0828de82c5e29fbf61b79dc17b9dea419227faa3ee044cde23fc8b128d15aeb8`. Six local
movement scenarios plus the optional Canyon run are functional development
checks. All 12 verified-source coordinator scenarios also pass, including
below-terrain pose rejection preserving the prior visual/provenance and caller
mutation isolation. Browser review confirmed terrain loading, deliberate arming
focusing the canvas, keyboard throttle input (69 accepted ticks / 52% throttle)
and P pausing.

These checks are not GPU/frame-time, hardware input, mobile, long-session memory
or release qualification. Counters exclude engine/GPU overhead; snapshot copying
and the review camera are not performance-qualified. Additional unit coverage
remains in D6.

## Remaining before actual regional free flight

1. Integrate production collision contracts with regional terrain without
   changing legacy recordings, course identities or scoring. The free-air
   transition is shared.
2. Integrate bounded terrain preparation with the real player renderer/input
   lifecycle; atomically relocate every live world owner and resume only under
   explicit safe rules.
3. Admit scenery/material profiles and matching collision, with asset rights,
   visibility, corridor/clearance and representative visual-quality checks.
4. Complete streaming failure/retry/offline recovery, frame-time and memory
   measurement, controller/touch/browser coverage, long flights and
   release/package qualification.
5. Only then enable regional catalogue entries and describe them as playable.
   The 3 GiB stable free-space floor still applies to full package
   qualification. The authoring preview stays outside player packages; shared
   model changes follow normal player release qualification.
