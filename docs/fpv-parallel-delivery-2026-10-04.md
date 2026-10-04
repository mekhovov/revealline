# FPV — researched parallel delivery plan, 4 October 2026

The owner approved resuming continuous implementation after the priority review,
with independent work in parallel and focused PRs/native stacks where needed.
The owner subsequently rebalanced the allocation: finish publication first; put the
main engineering effort into performance, Library delivery and integrated reliability;
put art/content effort into Reservoir and a representative quality standard. Deliver
Festival, Harbor and Canals one at a time after that, followed by D6. This is the
current execution order for the remaining approved D0–D6 scope.
Historical receipts remain in the delivery log; older pending lists, counts and
estimates are not current instructions. Functional verification accompanies every
increment. Additional unit coverage stays in D6. Hardware and novice feedback
remain pending and nonblocking, never passed by implication.

## Current execution checkpoint

Library's dedicated-worker transport, responsive menu/language controls and
pre-arm focus repair are merged; public entry and the intentionally empty Library
index were verified at `8e5ad71e9b791b7c16bae1cb308026ed3e18d5c2`. Warm-frame
readiness #1084 is merged and publicly launched at
`1a1a82d5e6617a53239218642eda3aa70e817fe3`. Public personal-best access #1086
is merged at `5cde6dbc97c3067b6023d2bf7fd97fe251805347`; its public deployment
has not yet been checked. Source-capacity preparation #1085 is merged at
`5bd8f36d7767dcd9dda740865b4d8f19ddbe7c28`, recovering 41,026 original source
bytes without a behavior or limit change. That main input set has 41,262 bytes
of reserve; the separately qualified language fix leaves 41,157 bytes.

The language/menu action-ownership fix is now qualified: 433 native source checks,
283 exact admitted lifecycle checks, full validation, 16 existing checks and all
three/two-identical package admissions. Its earlier failed run remains retained.
Publication follows the normal capacity-only main bridge and protected checks;
see [the exact evidence and boundaries](../authoring/fpv-worlds/language-phase/README.md).
Next engineering work is the measured HUD/layout candidate under browser
qualification, then continued integrated reliability. No hardware-FPS conclusion
is drawn from these bounded observations.

Reservoir's required coating capability is qualified and awaiting its focused
publication. The r14 pack has passed 16 ordinary-flight/replay proofs and bounded
native import/flight views; representative terrain rooting and hut quality remain
open. The production Library index stays empty intentionally until the required
world-quality and publication gates are met. Preserve the research gates below
and the sequence Reservoir → Festival → Harbor → Canals → D6. Earlier estimates
and pending lists below describe their original checkpoints, not a reversal of
this delivered state.

## Starting position

The delivered catalogue contains 196 authored challenges, 14 worlds, 58 School
lessons and 374 steps. There are 178 bundled demonstrations, with separate
optional Adventure 60 and alternate School 28 archives. Templates and example
archives add no levels. D5 remains four additional worlds, eight challenges and
sixteen mode-specific demonstrations each: 228 challenges and 18 worlds when
finished, not when initial scenes exist.

Native UI, radio/profile/actions, controller navigation, touch response, mode
choice, continuous School playback/practice, drone/stick teaching, actors/combat,
ghosts, coaching, reimport/recovery, templates and mode editing are implemented.
Qualify and improve their combined experience instead of building duplicates.
Fourteen bounded art increments have shipped; complete scene-quality acceptance
and sustained performance are still open. No same-quality-as-commercial-SIM or
real-device qualification claim follows from feature counts.

Imported exact-pack example lookup #1060 and multi-course editing #1063 are merged;
public deployment and actual SIM launch were verified on ade4bfc2. Shared-shell
source preparation #1065 is merged and its bf9b0290 deployment/flight entry was
verified. Scene-readiness #1067 merged at 29e23a11; Reservoir #1066 merged at 94548aa2.
Reservoir's eight-course/16-example functional package is published, but production
Library registration and representative art acceptance remain separate work.
Verify each newest deployment and player entry before claiming the new change live.

## Research and concrete changes

These are design conclusions from primary sources inspected on 4 October, not
claims that another simulator's assets or physics have been imported.

| Reference                                                                                                                                                                          | Observed workflow                                                                                           | Application to our remaining work                                                                                                                             |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [FlightDivision setup](https://www.flightdivision.com/blog/fastest-way-to-start-fpv-simulator-training)                                                                            | Browser entry, controller detection/calibration and an immediate first lesson                               | Verify the existing saved-profile-to-first-flight path; remove reproduced detours rather than adding another setup system                                     |
| [Liftoff mentor](https://www.liftoff-game.com/news/virtual-mentor-reveal)                                                                                                          | Guided instruction plus optional assisted flight/controller settings                                        | Preserve mode choice and optional assistance; validate the existing 58 lessons before growing their count                                                     |
| [VelociDrone manual](https://www.velocidrone.com/desktop_manual)                                                                                                                   | Best/previous-lap ghosts and slower replay with stick display                                               | Retain exact-mode local ghosts and section practice; qualify retry → watch → practise → return as one journey                                                 |
| [WebFPV](https://webfpv.org/)                                                                                                                                                      | Scannable tracks/maps, named gaps, road-following cars and browser-based builders                           | Deliver bounded Library discovery; give new worlds recognizable route landmarks and distinct moving-subject activities using existing components              |
| [Uncrashed](https://store.steampowered.com/app/1682970/Uncrashed__FPV_Drone_Simulator/)                                                                                            | Varied freestyle/racing environments and environment/track creation                                         | Review each new world as a coherent flying place, including approach, gaps and recovery space, rather than isolated decorative assets                         |
| [Valve handheld guidance](https://partner.steamgames.com/doc/steamhardware/recommendations) and [compatibility](https://partner.steamgames.com/doc/steamhardware/compat?l=english) | Controller access to the whole experience, appropriate prompts, readable small-screen text and offline play | Check complete browser/controller journeys at handheld dimensions; use these as design criteria, not a claim of Steam certification or native SDK integration |
| [Chrome long animation frames](https://developer.chrome.com/docs/web-platform/long-animation-frames)                                                                               | Frame-level timing can expose work hidden by individual long-task measurements                              | Add bounded, feature-detected diagnostic attribution; separate cold/warm transitions, host work, animation frames and GPU observations                        |
| [Three.js renderer](https://threejs.org/docs/pages/WebGLRenderer.html)                                                                                                             | Configure lighting before shader compilation; asynchronous compilation reduces compilation stalls           | Audit the existing preparation path and resource lifetime before changing it; optimize a reproduced cause, preserving the pinned runtime                      |

The research changes emphasis, not the engine contract: put current-player
performance back alongside art, make optional worlds discoverable, and strengthen
route/actor variety. Keep original or appropriately licensed assets with provenance.
Preserve the fixed flight integrator, existing proof versions and physics profiles.

## Parallel work and completion gates

| Lane / priority                             | Deliverable                                                                                   | Required completion evidence                                                                                                                                                                           | Then continue to                                                                  |
| ------------------------------------------- | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------- |
| Delivery — immediate                        | Finish current ready PR publication, verify deployment, and maintain this allocation          | Current-head protected checks, permitted merge, public marker and actual player launch                                                                                                                 | Next verified focused PR; never wait on unchanged CI when independent work exists |
| Performance — P0                            | Controlled current-player baseline and bounded fixes for reproduced stalls                    | Exact input provenance, one visible native-clock player, cold/warm/course/quality observations, before/after comparison, unchanged replay/visibility contracts and package admission for runtime fixes | Representative natural/industrial scenes and longer-session qualification         |
| Art/content — P1                            | Improve published Mountain Reservoir until it meets the representative quality standard below | Coherent scene and eight distinct route pairs, matching solid/support collision, final world freeze, sixteen full completion/replays, native import/editor/offline and public entry                    | Festival Grounds, Harbor Docks, Old Town Canals, one complete world per PR        |
| Discovery — P1                              | Optional first-party worlds in Library                                                        | Bounded immutable data catalogue, explicit download size/revision, cancel/retry, exact hash/native install, no partial activation, removal/recovery and honest runtime-offline status                  | Register each finished world after its publication; preserve earlier revisions    |
| Player integration — P1                     | Complete touch/controller/radio and teaching journeys                                         | EN/UK, small portrait/landscape and 1280×800 layouts, menu/flight ownership, arm/reset/pause, reconnect, settings restore, fullscreen fallback and unobstructed flight view                            | Repairs for reproduced issues, then retained D6 scenarios                         |
| Reliability — P1 before broad world rollout | Combined creator/recording/recovery flow                                                      | Multi-course/mode edit/reimport/export/reopen, exact dependency replay, rollback, interrupted/quota failures and preserved records                                                                     | Final integrated release candidate                                                |
| D6 — final                                  | Deferred unit coverage and full regression                                                    | Targeted new coverage, applicable required checks restored through the established process, resolved known diagnostics and explicit device/art limits                                                  | Stop recurring implementation when approved backlog is complete                   |

Performance, Library delivery and integrated reliability own the main engineering
allocation. Small reproduced menu/input repairs belong to integrated reliability;
do not open separate broad redesigns. Art/content works on Reservoir in parallel,
not on additional unfinished worlds. Festival remains preserved at 47f8e36e until
the Reservoir standard is demonstrated. Then complete Festival, Harbor and Canals
sequentially, including each world's proofs, import/offline checks and publication,
before starting the next. D6 follows those deliverables; functional verification
continues throughout.

Independent source/authoring work within that allocation proceeds concurrently.
On this machine, heavy builds, proof generation and active-browser performance observations are serialized
when disk or measurement interference requires it. This protects measurement
quality without blocking independent development. No per-frame recording-library
clone, suppressed pause guard or background catch-up is allowed to manufacture a
performance pass.

### World production and variety

Reservoir r8 is the published functional baseline: eight courses and sixteen final
mode-specific completion/replays, 575 CPU checks and 304 imported-player checks,
plus a true server-offline flight/editor journey. Preserve that immutable package,
examples and completion evidence. The art review found visible triangular
openings at the western terrace/ridge join, so a narrow seam repair comes first.
Keep canonical collision and route envelopes unchanged; publish any changed visual
pack as an explicit revision and requalify exact dependencies rather than replacing
published bytes. Water remains outside playable land bounds.

Installing Reservoir yields 204 challenges / 15 installed worlds; the bundled
baseline remains 196 / 14. It is the first of four additional worlds, with production
Library registration, public player entry and representative art acceptance still
separate. Art follow-ups do not add courses. Generic imported-card
Explore / Intermediate / 4 min metadata remains a bounded host follow-up,
not a claim about each Reservoir route's activity or duration.

After Reservoir, build Festival first for a readable open-racing contrast, then
Harbor for vertical industrial reuse, then the denser Canals environment. The
following allocation guides authoring within each eight-challenge commitment;
every authored challenge still needs its own verified objectives and EN/UK brief:

| World     | Eight-challenge mix                                                                                              | Distinct experience                                                            |
| --------- | ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Reservoir | Existing planned eight land routes: orientation, elevation/precision, gallery/spillway, circuit and roof landing | Terrain, grounded civil structures and approach/landing decisions              |
| Festival  | One orientation, three races, one precision, one follow, one observe and one capstone                            | Open sight lines, named event landmarks and accessible moving-subject practice |
| Harbor    | One orientation, two races, one precision, one follow, one observe, one fictional combat and one capstone        | Gantries, containers, height changes and clearly separated moving encounters   |
| Canals    | One orientation, two races, two precision, one follow, one observe and one capstone                              | Bridges, courtyards and close-proximity architectural route choices            |

Use existing deterministic actor paths, goals and limits. Follow/observe means
actual authored target behavior and verified scoring, not merely decorative
movement. Combat remains fictional game encounters; no new vehicle suspension,
water simulation or general navigation system. Both flight modes stay selectable.
Decorative detail and quality settings cannot change collision, target visibility
or objective actors. If an authored mix proves unsuitable for a scene, substitute
another distinct activity within the same eight-course scope and document why.

### Reservoir representative quality standard

This is a production gate for subsequent worlds, not a claim that functional
replays establish finished art quality.

| Order | Work and player benefit                                                                                                                  | Completion evidence                                                                                                                                                    |
| ----- | ---------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1     | Close western terrace/ridge seams so the terrain reads as a continuous solid environment                                                 | Narrow geometry repair, unchanged collision/routes, no sky holes from the fixed close-FPV and approach views, explicit new content revision                            |
| 2     | Differentiate rock, grass and gravel scale; connect fractured terrain strata; strengthen dam, intake, chute and maintenance-hut identity | Plausible surface scale and transitions, readable landmarks without HUD, no repeated generic facade pattern dominating the scene                                       |
| 3     | Add only purposeful, grounded maintenance props and varied rooted vegetation; inspect drone scale and clearance                          | No floating supports, fake traversable openings or reachable decorative solids without corresponding collision; keep flight lines readable                             |
| 4     | Compare fixed close-FPV, approach, chase and overview poses across the west terrace, intake, spillway and shoreline                      | Low/Balanced/High use the same pose; equal relevant visibility/collision, no holes/z-fighting, clear route openings; inspect Authored/shared-theme/Pixel handling      |
| 5     | Confirm total scene cost and resource lifetime, then qualify the revised world                                                           | Same-pose draw/triangle/resource observations, repeated unload/disposal, exact-dependency replay/import/offline evidence; physical-device performance remains separate |

Retain existing package limits. The initial Reservoir authoring targets stay
15,000 imported triangles, 1.2 MiB GLB and 48 colliders. Published r8 has 12,016
triangles, 1,167,804 GLB bytes, 13 materials and one texture; byte headroom is tighter
than triangle headroom. Whole-scene observations reached 198 draws / about 29.3k
triangles, so additional detail requires measured cost, not just imported-mesh totals.
The current scene has no objective actors; do not present decorative additions as
new follow/observe gameplay. No commercial-parity, physical-device or FPS acceptance
is implied by this gate.

### Engineering execution within the revised allocation

1. **Library delivery:** the dedicated-worker transport, bounded immutable paths,
   exact hashes/size/revision, cancellation and atomic installation are delivered.
   Preserve their source/admitted 208-control and combined native offline receipts;
   the earlier 195-control pre-transport run remains historical. Next establish
   actionable compatibility for older cached players before registering the first
   finished Reservoir revision, then verify the actual published row through
   Browse, download, install, selection, Watch and editing. The production index
   remains intentionally empty; fixture starter rows are not delivered worlds.
2. **Performance:** the native program trace identified 66 first-draw shadow links;
   the merged warm-frame change moves that initialization before Ready in the
   qualified Yard cases. HUD work has measured bounded callback/width-read savings
   and merged as `ecf0bafc6541c6b57ae28a530763bab221555d4f`. Neither proves a general loading/FPS gain or
   resolves every historical stall. Next use one genuinely natural presentation
   and one industrial reference at fixed poses/quality, plus a bounded longer
   load/disposal session on final integrated source. Optimize only measured costs.
3. **Integrated reliability:** focus, language access, narrow-screen menus and
   personal-best access are delivered; language/Home phase ownership is now merged.
   Creator's correction passed 294 source and 294 exact admitted native controls
   after reproducing its postcommit refresh/generation-read defects; its focused
   protected publication is next. Retain dirty course/mode, exact revisions, genuine proofs and recovery,
   including the strict fence against a separate writer. Then qualify the
   final combined Library -> select -> settings -> arm -> pause/retry -> replay ->
   editor -> offline/reopen journey. Reuse exact component receipts and target
   boundary failures; real quota/eviction and broader hardware remain unclaimed.

### Visual and input quality checks

Choose one natural and one industrial reference scene; record concrete remaining
composition, texture scale, grounded-prop, lighting and animation issues. Inspect
FPV/chase/overview and all presets, including Pixel conventions. Improve the full
scene only where the result remains readable in flight. No general increase in
texture or triangle counts is a quality gate by itself.

Controller access covers entry, selection, arming, flying, pause, reset, results
and return. Keep radio axes out of menu control while flying and retain deliberate
neutral/arm pickup. Existing touch options and optional teaching stay available;
no Acro-only lesson lock. Physical iPhone Safari/app, Steam Deck, TX15 and novice
sessions are separate pending observations, not blockers for independent code and
content work. Record browser/GPU/device identity before any performance claim.

## Capacity and publication

Retain Core 72 MiB / Company 80 MiB and the existing optional-package file/source ceilings.
Coating main `3bc7a923d` retains 37,758 original source bytes after the verified visual
projection and merged phase/coating increments, with 102/104 runtime files.
Creator's fresh all-three admission `fc3254382` includes that main plus its 323-byte
correction and retains 37,435 bytes. HUD main `ecf0bafc6` retains 37,637 bytes. Creator's normal publication merge
contains only that already-qualified 121-byte HUD difference from its admitted
source; all 95 inputs are audited, with 37,314 bytes remaining. This source bridge
is not a new combined admission; fresh protected CI remains required.
Retain the bounded receipts and admit actual final integration; use existing UI,
small data manifests and reviewed lossless preparation before proposing a limit
change. The core budget does not waive the separate World Studio ceiling.

The Library index starts empty until eligible finished content exists. A qualified
starter pack can exercise discovery in a fixture, but cannot be advertised as a
finished Reservoir. Bind downloadable rows to immutable file revisions, exact
hashes and actual sizes. Downloading a data pack does not establish that its owning
simulator runtime is available offline.

Each complete functionally verified increment receives a focused PR. Use a native
stack only for a real unmerged dependency; use current main for independent work.
Inspect live stack membership rather than copying historical stack numbers. Keep
ready PRs free of unfinished next-item changes. Cascading stack rebases require
recovery refs and explicit remote-head leases. No manual stack retargeting,
administrator merge, disabled checks or release-policy workaround. Merge only
through the permitted protected path; public means verified deployment plus an
actual launch, not merely a green PR.

## Final qualification and estimates

D6 includes original proofs/rewards, all final world examples, shared-prefab and
reimport compatibility, EN/UK presentation, input/lifecycle recovery, repeated
loading/disposal, archive/retention limits and the deferred unit coverage. The
pre-arm focus and audio-warning-arbitration diagnostics are resolved; preserve
their original failures and accepted fixes. The Academy fake-DOM mount diagnostic,
unexplained historical storage-close observation and final regression remain
distinct open evidence limits, without weakened expectations or inferred causes.

Sustained 60 fps desktop / 30 fps mobile remain targets, not achieved results. Hardware,
novice and broader artist acceptance stay explicitly pending when unavailable.
No unit coverage is claimed from browser assertions or replay receipts.

The old 19–28-week estimate covered the prior whole continuation and must not be
reported as remaining time. Re-estimate remaining production after the current
performance baseline and first fully qualified eight-course world. Until then,
use the concrete gates above and report delivered increments and blockers rather
than an unsupported completion date. Do not grow scope to keep agents occupied;
when an item/phase completes, proceed to the next approved item automatically.
