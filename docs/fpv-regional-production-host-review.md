# Regional free flight in the production host — bounded review

This increment connects the verified regional session to the existing Worlds flight host. It is an explicit, unscored review entry, not a public catalogue admission or a qualified downloadable region.

## What is connected

- The existing production keyboard, touch, controller and calibrated radio input ownership, pause menu, camera selector, drone renderer, settings and Retry controls drive the regional session.
- The prior regional modules move into the shared optional SIM runtime; authoring imports remain compatibility re-exports. Their flight, support, collision, source verification, atomic terrain/scenery ownership and local-origin equations do not change.
- Regional presentation metadata has its own `FPVRegionalFlightPresentation.v1` format. It never passes as a World.v1 course, emits scored proofs or expands the existing World coordinate envelope.
- Same-origin HTTP(S) manifest inputs are bounded to 8 MiB, reject redirects and credentials, and retain the existing strict manifest and per-asset verification. Preparation has a 30-second timeout and ownership checks across asynchronous work.
- Launch, reset, mode change, failed source loading and recovered loading remain paused. Streaming retains the last accepted pose and requires deliberate resumption after the verified successor is ready. Cancelled preparation cannot become armable during renderer compilation.
- The renderer uses the existing camera/drone frame with the verified local origin. Overview frames only the loaded area. The session owns and disposes its regional geometry; the renderer detaches it before releasing renderer-owned resources.
- The regional HUD is a compact unscored status, without a fake goal band, success ring, enemy lifetime score, best-flight comparison or demonstration. Retry remains available in the shared pause menu. Resume opens that menu when regional arming is unavailable, including at the declared boundary.

## Explicit review entry

Serve a prepared terrain manifest and optional matching scenery manifest on the same origin as the game, then open:

`optional-practice/fpv-worlds/index.html?regionalReview=/region/terrain/region.json&regionalScenery=/region/scenery/region.json`

The query is opt-in. It adds no region to the normal map catalogue and installs no scene source assets. The paired Urban earthworks `mixed-r1` fixture was used for this review; materials remain the plain verified source presentation.

## Verification

- Existing flight model, boundary and World runtime tests: **28/28 passed**.
- Real paired-source host-session verification: both Acro and self-level; 80 accepted commanded ticks per mode; source failure, disarmed retry, cancellation, pose/momentum retention, disposal, same-origin restrictions and no scored identity.
- Existing regional movement verification: **6 cases passed**, including four cell crossings/five origin recentres, failure recovery, terrain impact and ceiling rejection.
- Existing mixed-owner verification: **8 cases passed**, including corruption in either layer, staged cancellation, attachment rollback, combined budgets and two commanded origin crossings.
- Shared view comparison: **2,240 historical frames**, four origin-relative views and 45 disposed owned objects passed. This checks camera/aircraft output, not GPU performance.
- Scoped production lint and JavaScript syntax checks passed. No physics/proof fixtures were changed.
- Native browser source review: explicit Arm and keyboard throttle caused descent/climb; Pause, Chase/FPV, Self-level/Acro change and Retry worked. Mode change and Retry returned to 3 m, zero throttle, paused. Touch throttle climbed to the declared ceiling, then paused with arming unavailable; menu Restart returned to paused launch. The compact unscored HUD and Retry group were reviewed.
- An emulated **390 × 844** browser viewport had a 386 × 704 paused canvas and full flight view while active, with corner sticks and Pause/View controls clear of the compact status. This is not iPhone or controller hardware verification.

## Package boundary and remaining work

The shared contact/support helpers are now explicit dependencies in the Academy/Worlds package policy. The regional entry adds 18 exact shared module paths. `optionalRuntimePaths` measures **143 Worlds runtime paths (before launcher/templates)**, **90 / 104 Academy files**, and **83 / 96 civilian-flight files**. The Worlds file envelope increases from the latest main’s 138 to 156 (18 exact regional modules); its **20 MiB byte limit is unchanged**. The exact builder structure adds ten launcher paths: 153 manifest dependencies, 154 runtime ZIP entries including package metadata, and 156 source ZIP entries including two reviewed templates and source inventory. These structural counts are not a completed package build/admission result.

Exact cloud package closure, archive hashes, frozen-package browser checks and offline recovery still require qualification of the published candidate. The regional runtime deliberately retains `playerReady: false`; broader device/controller testing, source delivery/install design, authored quality acceptance and normal catalogue promotion remain outstanding. Existing World.v1 recordings, identities and scoring stay separate.
