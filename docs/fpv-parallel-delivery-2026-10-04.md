# FPV — researched parallel delivery plan, 4 October 2026

The owner approved resuming continuous implementation after the priority review,
with independent work in parallel and focused PRs/native stacks where needed.
This is the current execution order for the remaining approved D0–D6 scope.
Historical receipts remain in the delivery log; older pending lists, counts and
estimates are not current instructions. Functional verification accompanies every
increment. Additional unit coverage stays in D6. Hardware and novice feedback
remain pending and nonblocking, never passed by implication.

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

Imported exact-pack example lookup #1060 merged at a90fc8180. Public deployment
and launch still need verification. Multi-course editing #1063 merged at 0a587fb2e after qualification
(197 source / 241 packaged / 160 stable-identity assertions). Its public deployment
and launch remain separate acceptance steps. Do not redo its implementation.

## Research and concrete changes

These are design conclusions from primary sources inspected on 4 October, not
claims that another simulator's assets or physics have been imported.

| Reference | Observed workflow | Application to our remaining work |
| --- | --- | --- |
| [FlightDivision setup](https://www.flightdivision.com/blog/fastest-way-to-start-fpv-simulator-training) | Browser entry, controller detection/calibration and an immediate first lesson | Verify the existing saved-profile-to-first-flight path; remove reproduced detours rather than adding another setup system |
| [Liftoff mentor](https://www.liftoff-game.com/news/virtual-mentor-reveal) | Guided instruction plus optional assisted flight/controller settings | Preserve mode choice and optional assistance; validate the existing 58 lessons before growing their count |
| [VelociDrone manual](https://www.velocidrone.com/desktop_manual) | Best/previous-lap ghosts and slower replay with stick display | Retain exact-mode local ghosts and section practice; qualify retry → watch → practise → return as one journey |
| [WebFPV](https://webfpv.org/) | Scannable tracks/maps, named gaps, road-following cars and browser-based builders | Deliver bounded Library discovery; give new worlds recognizable route landmarks and distinct moving-subject activities using existing components |
| [Uncrashed](https://store.steampowered.com/app/1682970/Uncrashed__FPV_Drone_Simulator/) | Varied freestyle/racing environments and environment/track creation | Review each new world as a coherent flying place, including approach, gaps and recovery space, rather than isolated decorative assets |
| [Valve handheld guidance](https://partner.steamgames.com/doc/steamhardware/recommendations) and [compatibility](https://partner.steamgames.com/doc/steamhardware/compat?l=english) | Controller access to the whole experience, appropriate prompts, readable small-screen text and offline play | Check complete browser/controller journeys at handheld dimensions; use these as design criteria, not a claim of Steam certification or native SDK integration |
| [Chrome long animation frames](https://developer.chrome.com/docs/web-platform/long-animation-frames) | Frame-level timing can expose work hidden by individual long-task measurements | Add bounded, feature-detected diagnostic attribution; separate cold/warm transitions, host work, animation frames and GPU observations |
| [Three.js renderer](https://threejs.org/docs/pages/WebGLRenderer.html) | Configure lighting before shader compilation; asynchronous compilation reduces compilation stalls | Audit the existing preparation path and resource lifetime before changing it; optimize a reproduced cause, preserving the pinned runtime |

The research changes emphasis, not the engine contract: put current-player
performance back alongside art, make optional worlds discoverable, and strengthen
route/actor variety. Keep original or appropriately licensed assets with provenance.
Preserve the fixed flight integrator, existing proof versions and physics profiles.

## Parallel work and completion gates

| Lane / priority | Deliverable | Required completion evidence | Then continue to |
| --- | --- | --- | --- |
| Delivery — immediate | Publish ready #1060/#1063 and maintain current plan | Current-head protected checks, permitted merge, public marker and actual player launch | Next verified focused PR; never wait on unchanged CI when independent work exists |
| Performance — P0 | Controlled current-player baseline and bounded fixes for reproduced stalls | Exact input provenance, one visible native-clock player, cold/warm/course/quality observations, before/after comparison, unchanged replay/visibility contracts and package admission for runtime fixes | Representative natural/industrial scenes and longer-session qualification |
| Art/content — P1 | Complete Mountain Reservoir as the quality reference | Coherent scene and eight distinct route pairs, matching solid/support collision, final world freeze, sixteen full completion/replays, native import/editor/offline and public entry | Festival Grounds, Harbor Docks, Old Town Canals, one complete world per PR |
| Discovery — P1 | Optional first-party worlds in Library | Bounded immutable data catalogue, explicit download size/revision, cancel/retry, exact hash/native install, no partial activation, removal/recovery and honest runtime-offline status | Register each finished world after its publication; preserve earlier revisions |
| Player integration — P1 | Complete touch/controller/radio and teaching journeys | EN/UK, small portrait/landscape and 1280×800 layouts, menu/flight ownership, arm/reset/pause, reconnect, settings restore, fullscreen fallback and unobstructed flight view | Repairs for reproduced issues, then retained D6 scenarios |
| Reliability — P1 before broad world rollout | Combined creator/recording/recovery flow | Multi-course/mode edit/reimport/export/reopen, exact dependency replay, rollback, interrupted/quota failures and preserved records | Final integrated release candidate |
| D6 — final | Deferred unit coverage and full regression | Targeted new coverage, applicable required checks restored through the established process, resolved known diagnostics and explicit device/art limits | Stop recurring implementation when approved backlog is complete |

Independent source/authoring work proceeds concurrently. On this machine, heavy
builds, proof generation and active-browser performance observations are serialized
when disk or measurement interference requires it. This protects measurement
quality without blocking independent development. No per-frame recording-library
clone, suppressed pause guard or background catch-up is allowed to manufacture a
performance pass.

### World production and variety

Reservoir r8 now qualifies all eight courses and sixteen exact-pack ordinary
demonstrations (575 CPU checks, 304 actual imported-player/editor checks). Its
native player also reloaded after the server stopped, flew Dry spillway descent
and performed an Acro-only edit with Undo/Redo offline. Land-side intake/control
gallery, dry spillway and Shoreline circuit replace the earlier provisional
island idea; water remains outside playable land bounds. This is D5 **one of
four** locally qualified worlds, pending protected publication/public entry.
The optional install yields 204 challenges / 15 installed worlds; the bundled
baseline remains 196 / 14. Historical one-course proofs are separate from final
r8 qualification. Generic imported-card Explore / Intermediate / 4 min metadata
is an existing host follow-up, not a claim about each route's activity or duration.

After Reservoir, build Festival first for a readable open-racing contrast, then
Harbor for vertical industrial reuse, then the denser Canals environment. The
following allocation guides authoring within each eight-challenge commitment;
every authored challenge still needs its own verified objectives and EN/UK brief:

| World | Eight-challenge mix | Distinct experience |
| --- | --- | --- |
| Reservoir | Existing planned eight land routes: orientation, elevation/precision, gallery/spillway, circuit and roof landing | Terrain, grounded civil structures and approach/landing decisions |
| Festival | One orientation, three races, one precision, one follow, one observe and one capstone | Open sight lines, named event landmarks and accessible moving-subject practice |
| Harbor | One orientation, two races, one precision, one follow, one observe, one fictional combat and one capstone | Gantries, containers, height changes and clearly separated moving encounters |
| Canals | One orientation, two races, two precision, one follow, one observe and one capstone | Bridges, courtyards and close-proximity architectural route choices |

Use existing deterministic actor paths, goals and limits. Follow/observe means
actual authored target behavior and verified scoring, not merely decorative
movement. Combat remains fictional game encounters; no new vehicle suspension,
water simulation or general navigation system. Both flight modes stay selectable.
Decorative detail and quality settings cannot change collision, target visibility
or objective actors. If an authored mix proves unsuitable for a scene, substitute
another distinct activity within the same eight-course scope and document why.

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
World Studio's projected combined headroom after #1060/#1063 is only 5,028 source
bytes and 102/104 runtime files. Admit every actual candidate; use existing UI,
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
loading/disposal, archive/retention limits and the deferred unit coverage. Resolve
the retained pre-arm appearance-focus and audio-warning-arbitration diagnostics
without weakening expectations or labelling a known baseline failure a new defect.

Sustained 60 fps desktop / 30 fps mobile remain targets, not achieved results. Hardware,
novice and broader artist acceptance stay explicitly pending when unavailable.
No unit coverage is claimed from browser assertions or replay receipts.

The old 19–28-week estimate covered the prior whole continuation and must not be
reported as remaining time. Re-estimate remaining production after the current
performance baseline and first fully qualified eight-course world. Until then,
use the concrete gates above and report delivered increments and blockers rather
than an unsupported completion date. Do not grow scope to keep agents occupied;
when an item/phase completes, proceed to the next approved item automatically.
