# FPV implementation continuation — approved 1 October 2026

This plan supersedes the original remaining-work estimate in
`fpv-worlds-implementation.md`. Keep the completed native UI, radio calibration,
fullscreen and existing simulation/content contracts. Direction: grounded
realism, primary Acro learning, optional self-level assistance and consistent
main-game presentation. All activities remain immediately selectable.

## Approved continuation — 3 October 2026

### Continuous phase progression

The owner explicitly directs continuous implementation: when an item is complete,
verify it, publish its focused PR and immediately start the next approved item.
When a phase is complete, start the next phase without requesting another go-ahead.
CI, merge queues and deployment continue independently; keep unfinished work on a
separate branch and use native stacks for actual dependencies. Player feedback and
physical-device qualification remain nonblocking and honestly recorded as pending.
If a dependency blocks one item, progress another approved independent item.
Stop only when the approved backlog is complete, the owner requests a pause, or no
safe useful work remains without essential user input. Do not expand scope beyond
the approved plan to keep work running.

The owner approved implementation with **world quality first**, polishing all
14 existing worlds before the main learning/usability phase, followed by creator
tools and four distinct new worlds. This ordering supersedes the older delivery
order below. Additional unit coverage remains deferred to D6; functional build,
browser, replay, import/export and offline checks remain part of each increment.
Physical-device and novice feedback do not block development and are not claimed
as completed.

| Phase | Working estimate | Reviewable result                                                                                                                                                          |
| ----- | ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D0    | 1 week           | Publish verified controls/art PRs #986/#987 through protected checks; repair shared offline capacity; establish rendering baseline and complete Snake outcome verification |
| D1    | 3–5 weeks        | Finished Container Yard and Woodland Park; reusable industrial/natural assets and measured quality tiers                                                                   |
| D2    | 5–7 weeks        | Remaining 12 worlds in six pairs: Stadium/Garage, Hangar/Meadow, Courtyard/Warehouse, Airfield/Quarry, Campus/Railworks, Orchard/Solar Park                                |
| D3    | 2–3 weeks        | 60 optional Adventure demonstrations, 28 eligible alternate School demonstrations, evidence-based coaching, continuous practice and touch/controller polish                |
| D4    | 1–2 weeks        | Editable sweeper/hairpin/chicane/climb/split-level templates, clearance guidance, divergent-mode routes and industrial/natural starter projects                            |
| D5    | 6–8 weeks        | Mountain Reservoir, Harbor Docks, Old Town Canals and Festival Grounds; eight distinct challenges and 16 mode-specific demonstrations per world                            |
| D6    | 1–2 weeks        | Deferred unit coverage, full regression and recorded qualification limits                                                                                                  |

Estimate: 19–28 working weeks plus three contingency weeks, assuming two developers
and an environment artist. Each complete increment receives a focused PR;
independent work continues while CI runs. Use native stacks only for dependencies.
D5 targets 18 worlds and 228 authored challenges (196 current plus 32 planned); authored counts are not player
acceptance or measured performance claims.

Preserve Three.js, existing physics/replays, world identities, asset licenses and
retained dependencies. Gameplay geometry changes need explicit content revisions.
Quality presets must preserve collision, relevant sight lines and objective actors.
Measure frame times, loading and resource disposal before claiming performance.
No multiplayer, online publishing or universal commercial-map conversion is added.

### D4 starter-project checkpoint — 4 October 2026

The first D4 increment supplies [ten editable industrial/natural starter projects](../authoring/fpv-worlds/starters/README.md):
sweeper, hairpin, chicane, climb and split level, with one course per project,
independent Self-level/Acro routes, EN/UK guidance and bounded nominal clearance.
Twenty ordinary-control flights and independent replays complete in 55,804 ticks
with zero hard contacts. The unchanged 102-member admitted player passes 237
browser checks covering all ten ZIP identities, two numeric editor workflows,
four original replays, a trusted spatial drag, Undo/Redo, export/reimport and
native IndexedDB reopening. See the [exact receipts and limits](../authoring/fpv-worlds/starters/evidence/README.md).

This authoring-only increment adds zero runtime source bytes and no catalogue
entries; counts remain 196 challenges / 14 worlds and package limits stay exact.
Complete D4 next with explicit spatial route-mode selection across edits,
ordering, history and source overrides. Separate actual localhost offline
qualification passes cached reload, keyboard editing, Undo/Redo, installation,
reopening and original/edited revision restoration with the serving origin down.
Device-wide offline, browser restart and storage-eviction qualification remain open.
Edited copies do not inherit the original routes' flight/clearance evidence.
D5's four new worlds and D6's additional unit coverage remain subsequent work;
physical-device, unfamiliar-player and sustained-performance acceptance stay open.

### Optional Adventure examples checkpoint — 4 October 2026

The D3 data-only Adventure increment converts all 60 retained authoring proofs
into an optional Library-import JSON: both modes for each of 30 challenges,
with the original 178 bundled examples and all core download inputs unchanged.
The converter passes 992 checks and 120 exact original/transport replays; the
actual admitted host passes 395 checks covering all 60 imports/lookups and
persistence plus 12 complete rendered replays across both modes and six worlds.
All original zero-contact and six reduced-health duel outcomes are retained.
See [evidence and limits](fpv-adventure-optional-examples.md). Public availability
requires protected merge and a working download link; it is not implied by local
qualification. Historical failed fixture runs remain visible.

The observed explicit World-host disposal ordering defect is the next narrow
independent fix: shell teardown removes the menu hint target before menu
navigation cleanup. It is not fixed by the data change. Then continue the
separate 28 alternate School examples, audit one evidence-based optional lesson
recommendation, and improve optional-example discoverability in Library without
automatic download or core precaching. Existing section-watch, longest-section
practice, live height/speed/tilt hints and touch/controller flows remain delivered
features to preserve, not duplicate. Broader D3 work and D4–D6 remain open.

### Optional alternate School checkpoint — 4 October 2026

The 28 remaining eligible alternate School examples are qualified as explicit
optional imports: original Self-level lessons 01–12 in Acro, and non-skill
intermediate/advanced lessons 27–42 in Self-level. The 14 foundation alternates
already exist; the 16 Acro-skill lessons retain only unscored Self-level practice.
All 28 new recordings complete, independently replay, and import/replay again
with zero contacts and full health. The actual retained admitted player passes
393 checks and 30 playbacks, including two recorded sections, with unchanged
progress and no errors. The 178 built-in recordings and all production code stay
unchanged. See [School archive qualification](fpv-school-alternate-examples.md).

Orchard #1021 is merged and has an actual public Authored/Touch render, arm and
pause observation at descendant main `a087facd9`, with no warning/error logs.
Solar #1022 was superseded by replacement #1025; its integration review and
protected CI/deployment remain separate. These are bounded surface improvements,
not complete-world artistic or hardware acceptance.

Continue D3 with the independent optional Adventure examples, lifecycle repair
and one evidence-based gate-section lesson recommendation with deliberate return
to the prior challenge. Preserve timing provenance, exact dependencies, selected
controls and playlist bookmarks. Broader art/performance and coaching remain
open; D4 creator, D5 four worlds, and deferred D6 unit coverage follow. Counts stay
**196 challenges / 14 worlds / 58 School lessons / 374 School steps**; D5 targets
**228 challenges / 18 worlds**.

### Campus facade checkpoint — 4 October 2026

Quarry #1016 is merged at `47d2019dced85d80671b2d780da662f50ea11c20`.
Campus now has a qualified bounded facade increment on that main baseline:
full-height solid Pixel panes and quiet storey/corner articulation on the four
existing closed buildings, preserving roofs, bridge, collision and shared Theme
ownership. Source and admitted-package browser checks each pass **136 checks /
56 identical image pairs**. CPU qualification passes **780 checks / 138 scenes**
both before and after integration, and ten authenticated recordings replay
through **53,982 ticks**. All three admissions pass two identical builds; the
complete 102-file admitted player renders the facades and passes
arm/pause/continue with empty warning/error logs. See [Campus qualification](fpv-campus-facade-levels.md).
Publish through protected exact-head checks; local acceptance is not public or
hardware qualification and does not certify the complete world's art.

Continue D2 with the independently audited Railworks wagon framing increment,
then Orchard/Solar Park. No Railworks runtime is included here. Keep D1
performance work separate, followed by D3 examples/coaching, D4 creator, D5 four
worlds and D6 deferred additional unit coverage. Counts remain **196 challenges,
14 worlds, 58 School lessons and 374 steps**; D5 targets **228 challenges / 18
worlds**. These art increments add no challenges or installed demonstrations.

### Quarry continuation checkpoint — 4 October 2026

Courtyard #1012 and Warehouse #1014 are merged and now have actual public-player
render/arm/pause observations at marker `0aeb0c2b4342715ba9a19b976114d7d905fed7bd`,
with empty warning/error logs. Coastal lighthouse #1015 has merged normally at
`287eec95c81687fb8a6d176f750f7c65a60e1fe3`: source/package browser
qualification with 97 checks and 56 image pairs, ten fresh retained-proof replays / 41,868 ticks, three package
admissions and the complete 102-file local admitted player are documented there.
The public marker now matches that merge; actual Lighthouse approach render,
arm through 0.2 seconds and pause-to-menu passed with empty warning/error logs.

Quarry's qualified bounded increment improves the six existing rock solids with
world-aligned authored strata and fine fractures. It changes no collision volume,
route or geometry, and creates no additional texture set. Pixel, shared Themes
and unsupported creator layouts retain their prior finish. The accepted revision
retains fine grain and broken seams; source/package browser qualification each
passes 116 checks / 56 image pairs, ten fresh retained-proof replays cover 41,643
ticks, all three package admissions pass two identical builds, and the complete
102-file admitted player renders/arms/pauses. The unrelated imported Courtyard
control uses disclosed equal GLTF material construction order; original 176/27-pixel
failures remain in the [qualification record](fpv-quarry-strata.md). Publish this
focused increment through protected checks; no finished-world or hardware claim
follows from surface detail alone. Continue the remaining D2 worlds before
D3 examples/coaching, D4 creator, D5's four worlds and D6 additional unit coverage.
The catalogue remains 196 unique challenges / 14 worlds: 60 original, 30 Adventure,
48 Snake Hunt and 58 School, with 374 authored steps. D5 still targets 228 / 18.

### Coastal lighthouse qualification — 4 October 2026

Courtyard #1012 and Warehouse #1014 are merged; current integration includes main
`0aeb0c2b4342715ba9a19b976114d7d905fed7bd`. The bounded Coastal airfield lighthouse
finish now has accepted harbour/lantern views, 97 source and 97 packaged browser
checks with 56 identical image pairs, ten fresh retained-proof replays through
41,868 ticks, all three source-bound package admissions and an actual complete
102-file admitted-player render/arm/pause. See [qualification](fpv-coast-lighthouse.md).
Publish this focused increment through protected checks, then continue Quarry on
a separate branch. The count remains 196 challenges / 14 worlds; this art pass
adds neither a world nor an installed demonstration. D5 still targets 228 / 18.
Physical-device observations and broader finished-world claims remain separate.

### Latest delivery priority — 3 October 2026, evening

This checkpoint supersedes the dated pending statuses below; older evidence remains historical.

**World quality remains first.** Source-budget repair **#1011** and Woodland grove
composition **#996** are merged. The public marker at `e40809f25ea8` and an actual
Clearing check-in render/arm/pause verify the grove increment live. Hangar, Garage,
Stadium and Yard also have actual public launch evidence. Meadow **#1010** is
live at public marker `e98df020d`, with Turn and travel render/arm/pause verified.
Woodland material correction **#1001** is merged at `25700b699`; its public
acceptance remains separate from that earlier marker.

1. Complete protected publication of **#1012** Courtyard closed façades and
   **#1014** Warehouse exterior composition, preserving exact-head admission.
   Keep ready patches focused while independent work continues. Source repair
   recovered 42,301 bytes without changing generated syntax trees or 24 packed
   recordings; no package limit was raised.
2. Continue the next **Airfield/Quarry** art pair after the qualified Warehouse
   increment. Warehouse #1014 retains 29 courses/four bounds, 18 installed
   recordings, 57 licensed placements, indoor routes and closed collision bounds.
3. Finish the remaining **D2 world pairs**, then D3 examples/coaching, D4 creator
   tools, D5 four new worlds, and D6 deferred unit/regression qualification.
4. Keep **D1 performance tuning** active alongside art: production source and
   package qualification pass functional/resource checks, but preparation/load
   and frame-interval outliers remain unresolved. Do not claim sustained FPS.

Current authored content remains **196 challenges, 14 worlds, 58 school lessons
and 374 school steps**. Art increments add no levels. D5 targets 228 challenges
and 18 worlds. The original 120 and recommended-mode School 58 recordings remain
installed; optional Adventure/alternate-mode examples belong to D3.

| Area                    | Verified increment                                                                                                                                                                                  | Remaining                                                                                                    |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| D0                      | Core 72 MiB/Company 80 MiB capacity and lossless optional-source repair #1011                                                                                                                       | Existing canonical audio-warning arbitration failure remains recorded separately                             |
| D1                      | Field materials #999, tree forms #1006, Yard frontage #998, Woodland groves #996 and material correction #1001 are merged; historical source/package production and cached-player evidence retained | Material public acceptance; unresolved long-stall investigation; broader art and actual-device qualification |
| D2: Stadium/Garage      | Stadium #1004 and Garage #1009 public render/arm/pause verified                                                                                                                                     | Broader art/performance acceptance, without blocking next work                                               |
| D2: Hangar/Meadow       | Hangar #1008 and Meadow #1010 public render/arm/pause verified                                                                                                                                      | Broader art/performance acceptance remains separate                                                          |
| D2: Courtyard/Warehouse | Courtyard #1012 and Warehouse #1014 are ready with scoped source/package and actual-player evidence                                                                                                 | Exact-head protected publication, public deployment and broader world polish                                 |
| D2: later pairs         | Existing reusable surfaces and landmarks retained                                                                                                                                                   | Airfield/Quarry, Campus/Railworks and Orchard/Solar cohesive art passes                                      |
| D3–D6                   | Existing teaching, creator/import, replay and recovery features retained                                                                                                                            | Optional examples/coaching; creator templates; four new worlds; deferred unit coverage and final regression  |

**D1 evidence:** historical combined candidate `e572026ba` passes 90 configurations
across three rounds (270 views), 60 Pixel/shared-Theme controls and 14 lifecycle
and resource gates in both source and admitted package. Comparison finds zero
semantic discrepancies across 72,680 leaves. Local server-unavailable reload,
Woodland/Yard selection, arm and pause pass. This is functional browser evidence,
not physical-radio, airplane-mode, novice or sustained hardware-performance proof.

The bounded [D1 transition profile](fpv-d1-transition-profile.md) completed 36
preparations and six imports on the same historical e572 source. It did not
reproduce the earlier 15–17 second waits (maxima 77.4/11.2 ms). Measurable course
setup/quality/probe costs and all long tasks are retained; the original stalls
remain unresolved and no production optimization or FPS claim follows.

**Courtyard evidence:** the first visual review rejected overlapping window marks
although its numerical matrix passed. The corrected final source and package each
pass 261 checks/163 pairs with matching records. These matrices use the production
renderer with procedural fallback scenery; the separate normal player launch
covers imported scenery, backed by the GLB integration audit. Preserve the rejected
revision and the distinction between these checks.

**Warehouse evidence:** ready #1014 at `b5a7a3b5a` retains 437 checks/221 image
pairs and the actual admitted-player launch on frozen `102fcd`; integrated
`860ad` admission leaves 35,925 original-input bytes of headroom. These scoped
receipts do not replace fresh exact-head CI or public deployment verification.

Player feedback, actual iPhone/TX15/Steam Deck sessions and human art acceptance
remain pending and nonblocking. No guard, replay identity or gameplay geometry
changes are implied by these art increments. The local combined-art branch stays
verification-only. Use the delivery log for exact current PR heads and status.

See [the complete D1 qualification](fpv-d1-production-qualification.md) for exact candidate, package, archive and timing records.

### Verified continuation checkpoint — 3 October 2026

The 72 MiB shared-core change #989 and controls #986/#991 are merged. D1 art is
published in focused PRs #992, #993, #996, #998, #999 and #1001; publication and
public deployment are separate from local evidence. The combined Woodland/Yard
candidate was functionally reviewed across 15 arena/preset cases, with identical
collision data and stable resources through 15 cleanup cycles. A resolved-theme
bug in #1001 was corrected so all five supported Pixel profile forms retain the
existing unlit imported material. This evidence does not finish D1 art acceptance
or establish sustained frame times on named devices.

The next independent D2 increment adds readable closed stand facades and a static
scoreboard to Stadium's three canonical solids. Its implementation preserves all
21 associated recorded demonstrations and the 14 Snake Stadium layouts; source
and package qualification is recorded in `fpv-stadium-structures.md`. Garage is
the next bounded environment task. Continue D1 publication repairs in parallel,
then the remaining D2 world pairs before D3–D6. No new dependency stack is needed
for the Stadium increment, which starts from current main.

### Qualified art delivery checkpoint — 3 October 2026

The catalogue remains **196 challenges / 14 worlds**. D5 targets **228 challenges
in 18 worlds** (196 current plus 32 planned), superseding historical 216-count
estimates. Stadium and Container Yard have verified public deployment identities
and actual-player launches. Hangar #1008 is merged with public acceptance pending;
Garage #1009 is merged with public acceptance pending. This focused Meadow PR carries
qualified source/package rendering and actual-player evidence; these bounded art
increments do not claim that the larger world-quality phase is finished.

Continue the remaining D1 groves #996 and material response #1001 publication,
then the rest of D2 world pairs. Follow with D3 optional examples/coaching,
D4 creator tools, D5 four new worlds, and D6 deferred unit coverage and full
regression. Keep independent implementation moving while protected CI/publication
runs. Human, physical-device and final artist acceptance remain explicitly open.

### Approved capacity change

The owner explicitly approved raising the shared-core offline budget from
64 MiB to **72 MiB** with installation, update and rollback verification. Company editions use the separately enforced **80 MiB** package budget. Keep the
2,000-file guard, content integrity checks and protected release requirements.
Retain lossless compression and keep new large worlds/assets in optional packs.
The three optional SIM packages remain **64/72/104 files and 8/8/16 MiB**.
This approval does not alter unrelated media, backup, archive or source-file limits.

## Current delivery order — 3 October 2026

The owner has explicitly made player-feedback sessions **nonblocking for further
implementation**. Continue functional browser, replay, import/export and package
verification; keep novice, physical-device and artist acceptance honestly pending.
No session or hardware measurement is inferred from an automated fixture. The
historical phase tables below are superseded by this current order.

Main now includes Themes #955/#967, Warehouse #966, capacity repair #968,
running enemies #969 and recorded section replay #972, alongside the completed
controls, school, section practice, ghosts, reimport and original demonstrations.
The Follow/Observe editor #975, shared-theme texture quality #974, WebAssembly
CSP repair #976 and pack-removal recovery #977 are now merged. Public deployment
remains distinct from local functional verification.
The current catalogue is **196 challenges / 14 worlds / 58 school lessons / 374
school steps**. Installed demonstrations total **178**: all 120 original
mode-specific recordings plus 58 recommended-mode school examples. The 60
Adventure authoring proofs are separate; they are not installed demonstrations.
Main Snake content now adds 48 challenges within the same 14 worlds, including
12 tasks added after the earlier 184-challenge checkpoint. Fourteen
optional matching Self-level foundation examples are merged as PR #979; they do
not add challenges or increase the default installed-example count.

| Order                  | Reviewable increment                                           | Working estimate                                | Required functional evidence                                                                                    |
| ---------------------- | -------------------------------------------------------------- | ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Complete / merged #972 | Watch a recorded section, then practise from its exact entry   | Delivered                                       | Verified prefix and end boundary, accurate labels, pause/reconnect and no rewards from playback/practice        |
| Complete / merged #975 | Visual Follow/Observe objective inspector                      | Delivered                                       | Author, move subject, edit criteria, export/reopen and reimport without losing settings                         |
| Merged and live #977   | Pack-removal impact and recovery guidance                      | Source/package verified; public launch verified | 90 browser checks in each build, exact restore and preserved recording/session/playlist evidence                |
| Parallel               | Stadium, then yard/garage art using shared Themes materials    | 3–5 days per bounded batch                      | Readability, collision/visibility parity, resource disposal and source/packaged rendering                       |
| Merged #979            | 14 optional Self-level foundation examples; Adventure next     | 117 browser checks per build                    | Correct mode/revision, complete replay and bounded optional delivery                                            |
| 5                      | Further distinct practice worlds and moving-subject challenges | 3–5 days per pair                               | Authored routes/objectives, both-mode access and verified demonstrations                                        |
| Last                   | H/R7 deferred unit coverage and broad qualification            | 5–10 days, excluding external sessions          | Required regression, replay/storage failures, named-device performance and separately recorded human acceptance |

These are planning estimates, not elapsed-work promises. Hardware and player
sessions remain an acceptance backlog and can inform later revisions, but no
implementation row above waits for them. Current file caps are **64/72/104** and
byte caps **8/8/16 MiB** for the three optional packages. Keep all guards and
release authority unchanged. Lossless capacity repair #968 is merged; continue
checking current capacity because optional admission does not establish
whole-edition capacity.

Publish complete, verified increments separately. Start independent branches on
current main; use a new native stack only for genuine dependencies. Closed stacks
#889, #902 and #957 remain closed. Public marker plus an actual player launch are
required before calling any newly merged feature live.

## Remaining phases and delivery order

| Phase | Scope                                                                             | Working estimate         | Target    |
| ----- | --------------------------------------------------------------------------------- | ------------------------ | --------- |
| R0    | Reconcile stacks, correct transactional reimport, verify public entry             | 2–3 days                 | Week 1    |
| R1    | Truthful shared drone guide in both SIM hosts                                     | 3–5 days                 | Week 1–2  |
| R2    | 14 primary Acro lessons, 12 optional self-level lessons, installed demonstrations | 8–12 days                | Week 3–4  |
| R3    | Shared menu navigation, HUD scale, sound groups and clear result actions          | 3–5 days parallel        | Week 3–4  |
| R4    | Material/lighting tiers, three detailed quads, safe shader preparation            | 8–12 days parallel       | Week 3–5  |
| R5    | Art and animation across all eight worlds                                         | 10–15 days               | Week 5–8  |
| R6    | Original 120 demonstrations, compatible ghosts, targeted practice                 | 4–6 days partly parallel | Week 6–8  |
| R7    | Deferred unit coverage, full regression and human/device qualification            | 5–10 days                | Week 8–10 |

These estimates assume two developers, an environment artist and recurring
player sessions, with two additional contingency weeks. Re-estimate after the
first realistic environment benchmark and novice sessions. An authored challenge
or machine-verified proof is not human/content-art acceptance.

## Contracts and acceptance

- Preserve original lesson IDs, course identities, recordings, rewards and
  playlist revisions. Twelve new Acro lessons plus the two existing introductions
  produce 26 learning challenges and 86 total. Temporary Acro/FPV/Gentle settings
  restore the player's previous flight preferences on exit.
- Teaching follows observe, practise, feedback, independent flight. Use actual
  command recordings, slow playback, clearly labelled example controls, optional
  explanations and real objective progress. Observe at least five first-time
  players across radio/keyboard before novice acceptance.
- The shared drone guide reads state only: applied command, full quaternion,
  thrust direction, heading and measured travel. Keep Off/Compact/Learning,
  persistent preferences, safe pause/reconnect and Mode 1–4 stick layouts.
- Performance/Balanced/Quality caps remain DPR 1/1.5/2, no/1024/2048 dynamic
  shadows. Presets retain identical gameplay fog, sight lines, collision, target
  readability and replay results. Pixel materials keep nearest filtering.
- Reuse Kenney scenery and main-game UI assets. Record author/license/changes/
  hashes for any new material or environment resources. Poly Haven/ambientCG are
  candidates until selected, optimized and actually shipped. No new decoder is
  implied by this work.
- Polish hangar/meadow, courtyard/woodland, warehouse/stadium, then yard/garage.
  Keep imported-world disposal, animation tied to simulation time, shader
  preparation before arming and cosmetic preference preservation.
- R6 retains exact challenge/mode compatibility for PR #913 ghosts. Original
  demonstrations remain 120; school proofs are separate. Results should offer
  retry, section practice, demonstration and playlist continuation without locks.
- Functional checks accompany every increment. New unit coverage stays in R7.
  Preserve 8 MiB/64-file Academy and 16 MiB/96-file World Studio package policies,
  archive limits and all publication guards. Name actual devices before reporting
  sustained 60/30 fps or memory measurements.

## Continuous publication

Publish each completed, functionally verified feature as a focused PR. Native
stack #902 contains the school/guide dependency chain; #889 holds remaining
original demonstration content. Inspect live membership and exact heads before
acting. Independent repairs can target main. Do not mix graphics WIP into ready
teaching PRs, retarget native members manually, remove holds without their
required evidence, or change global release authority. Verify both the public
deployment identity and a successful simulator launch before calling work live.

The execution checkpoint and current next item live in
`fpv-continuous-delivery.md`; read its latest entry rather than historical tables.

## Player feedback revision — controls lab and rear reference

The 1 October screenshots expose mirrored front-view roll, side-view pitch that
resembles roll, a separate illustration that does not follow live input, and
legacy green surfaces. Prioritize these R1/R3 corrections before further art.

| Increment         | Implementation                                                                                                                                             | Estimate                      | Verification gate                                                                                               |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Controls teaching | One quaternion-based rear-reference diagram in lessons and both flight hosts; distinguish front/rear, pitch depth, bank, yaw and measured travel.          | 1–2 working days              | Positive/negative pitch and roll, yaw, inverted Acro, unchanged replay.                                         |
| Live controls lab | Explicit Example / Try controls; isolated Gentle simulation, keyboard, calibrated USB radio/gamepad and touch controls; reset, stop and visible ownership. | 1–2 working days              | Real flight remains paused, no rewards/recording mutations, release on blur/menu/exit, Mode 1–4.                |
| Input and shell   | Larger labelled gimbals, main-game navy/amber/cyan tokens, keyboard/controller/radio menu navigation, fullscreen throughout menus/lessons/flight.          | 1–2 working days, parallel    | Every menu and nested dialog, select/range controls, neutral/release gates, EN/UK, mobile, fullscreen fallback. |
| Publication       | Frozen package admission, committed-input/replay checks and packaged-browser acceptance; focused PR in native stack 902.                                   | After each verified increment | User playtest URL rebuilt; no claim of physical-radio or novice acceptance without observation.                 |

The diagram remains an observer. Its camera follows heading to keep the view
behind the drone without locking physics or hiding Acro inversion. The amber
front marker and rotating ground/start-heading reference distinguish yaw from
bank. Near vertical, retain the last usable camera heading. The lab advances only a separate unscored simulation; it never
arms or changes the paused lesson. Native fullscreen may require a pointer or
keyboard gesture; controller activation must offer a clearly labelled full-window
fallback when the browser rejects native fullscreen.

Research decisions:

- [Xbox UI navigation guidance](https://learn.microsoft.com/en-us/xbox/accessibility/xbox-accessibility-guidelines/112) supports consistent directional focus, digital-only paths, visible confirm/back hints and predictable return behavior.
- [EdgeTX USB joystick documentation](https://manual.edgetx.org/color-radios/model-settings/model-setup/usb-joystick) describes configurable axes/buttons. Reuse normalized calibrated controls; do not hardcode TX15 channels or assume arm switches are menu buttons.
- [Liftoff's virtual mentor](https://www.liftoff-game.com/news/virtual-mentor-reveal) is an example of guided simulator onboarding. Here, pair the explanation with immediate, clearly separated practice.
- [MDN fullscreen documentation](https://developer.mozilla.org/en-US/docs/Web/API/Element/requestFullscreen) documents asynchronous requests and user activation requirements; preserve an explicit exit and safe pause on transitions.

No additional unit coverage is introduced here. R7 and the original outstanding
art, original demonstrations, main-game integration qualification and human/device
acceptance remain in scope. Completion evidence belongs in the delivery log.

### Implementation status — 2 October 2026

The controls teaching, live controls lab, directional stick HUD, theme palette,
SIM menu navigation and fullscreen increment is implemented in
[#929](https://github.com/mekhovov/revealline/pull/929), following #926 in native
stack #902. Its final refinement follows current heading to keep the camera
behind the aircraft; real yaw stays visible against the ground reference.
The independent Solo TX15 full-menu preset is in
[#928](https://github.com/mekhovov/revealline/pull/928). See the latest delivery
checkpoint and feature notes for qualification and exact publication heads.
Existing holds, CI, protected merging and public deployment remain separate gates.
Physical radio, unfamiliar-player and sustained hardware acceptance remain open.
The R4–R7 art, original demonstration and qualification backlog is unchanged.

### Player feedback refinement — 2 October 2026

This replaces the earlier **Example / Try controls** selector with automatic
input takeover. Implement the current feedback as one focused child of #929:

| Work                                                | Estimate                    | Acceptance                                                                                                                                               |
| --------------------------------------------------- | --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Full-travel looping examples and automatic takeover | 1 working day               | Both signs in Acro/self-level; real slow example commands; normal-speed keyboard/touch/calibrated radio; no host progress changes; safe pause/reconnect. |
| Four-prop schematic and ground motion               | 1 working day, parallel     | Independent illustrative motor signs; tick-based animation; real-position ground and height; full attitude and reduced motion.                           |
| Peripheral gameplay aids                            | 0.5–1 working day, parallel | Small transparent HUD, larger touch targets, uncluttered objectives, desktop/mobile/fullscreen and both hosts.                                           |
| Functional qualification and focused publication    | After the increment         | Actual browser input/lifecycle checks, original lesson replay, frozen package admission and rebuilt player URL.                                          |

See `fpv-motion-teaching.md` for the behavior and its motor-mix limitations.
These estimates cover the feedback refinement only; the R4–R7 art, content,
deferred unit coverage and human/device qualification backlog is retained.

### Player feedback refinement — endless practice, 2 October 2026

The next focused R1/R3 increment removes automatic timeout and contact stops
from manual controls-lab practice and adds a drone-centred fullscreen practice
view. Estimate **1–2 working days**, including functional qualification and
focused publication. The practice volume remains bounded to ±80 metres
horizontally and 0–80 metres vertically; ground and boundary collision remain.

Use a lab-only unscored runtime option with proof creation disabled. Normal
attempt limits, course identities, recorded inputs and reward contracts remain
unchanged. Retain focus/stall/disconnect pauses and explicit reset/replay.
The dedicated view presents a larger rear-follow quaternion schematic, wider
ground, compact corner gimbals, optional touch buttons and EN/UK controls.
Fullscreen fallback must remain usable, and leaving practice must preserve any
application fullscreen session that was already active.

Current local evidence comprises 14 browser coach checks (including more than
13 simulated minutes), 27 model checks including the original 24 demonstration
proofs, replay of all 14 Acro school demonstrations and 16 browser diagram checks.
The final production-host browser run passed 19 input/isolation checks. All
three optional packages passed frozen-input admission and reproducibility, and
the rebuilt player URL was launched; no public live, physical-radio or human acceptance is claimed.
See [FPV endless controls practice](fpv-endless-practice.md) for behavior and
limits. R4–R7 estimates and scope, including deferred unit coverage, are unchanged.

### Player feedback refinement — readable stick motion, 2 October 2026

Deliver as a focused child of Pro/Master school #940: quieter motor arcs,
short truthful stick trails and direction cues in both SIM hosts, constant
whole-lesson playback pace, and an explicitly separate hollow movement guide
for recorded examples. Keep live controls unsmoothed, preserve replay identities,
and clear presentation history on pauses, seeking, loops and ownership changes.
Estimate: **one working day**, including browser verification and publication.
See [Readable FPV stick motion](fpv-readable-stick-motion.md) for the implementation,
research and qualification boundaries. R4–R7 art, device/player acceptance and
deferred unit coverage remain unchanged.

## Reviewed continuation — World Adventures, 2 October 2026

This checkpoint supersedes the earlier catalogue counts and historical hold
summaries above. The active branch contains **58 learning lessons (46 Acro and
12 optional self-level)**, the original 60 challenges and a newly verified
**30-adventure expansion**, totaling **148 challenges in 14 worlds**. See
[World Adventures](fpv-world-adventures.md) for the full route/actor contract,
research, content allocation and qualification boundaries.

| Area                                      | Reviewed state                                                                                                                            | Remaining concrete work                                                                                                            |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Shared UI, radio, teaching and fullscreen | Native presentation, continuous school, handheld flight, controller actions, radio Arm/Reset and stored profiles implemented through #945 | Physical iPhone/Steam Deck/radio acceptance and novice observations; coordinate protected integration                              |
| School                                    | 58 authored lessons and installed recommended-mode examples                                                                               | Five first-time player sessions, revise confusing steps, final curriculum/art acceptance                                           |
| World art                                 | #946 improves original eight worlds, actor models, materials, repeated scenery and projectile disposal                                    | Themes integration, artist-authored detail and measured device budgets                                                             |
| New worlds and activities                 | Six distinct arenas, 30 challenges, real follow/observe scoring, six revision-pinned playlists                                            | Protected publication and player feedback; optional example-library delivery                                                       |
| Creator reliability                       | Reimport correction #922 is merged upstream                                                                                               | Integrate its reviewed behavior into the current dependent player branch through coordinated stack update; preserve parallel edits |
| Ghosts and original demonstrations        | #913 is merged; native content stack #889 is fully merged/closed, including #896                                                          | Integrate upstream content into the dependent player branch, finish preserved Garage16 handoff, verify original120 total           |
| Deferred qualification                    | Functional verification continues with every item                                                                                         | R7 unit coverage, broader regressions and actual hardware/player acceptance                                                        |

Do not repeat the old claim that stack889 or #922 is still held. On this review,
stack902 has open members #939 → #940 → #941 → #942 → #943 → #944 → #945 → #946;
inspect live membership before any subsequent publication or rebase. Current
source keeps only its already integrated original demonstrations; a merged PR is
not proof that this worktree's built player includes its changes.

### Next delivery sequence and working estimates

1. **World Adventures publication:** finish frozen-package and packaged-player
   qualification, focused child PR after #946, then refresh the normal local URLs.
   Implementation/functional checks are complete in this increment; CI/merge timing
   is external and has no guaranteed ETA.
2. **Coordinated upstream integration:** 1–3 working days, depending on conflicts.
   Recovery refs and exact remote-head leases, linear stack, preserve every active
   branch. Verify reimport, ghost compatibility and all retained examples again.
3. **Themes and environment refinement:** 3–5 working days per reviewed art batch,
   parallel with gameplay feedback. The Themes chat owns shared appearance contracts;
   avoid a competing theme/preferences layer. Add details based on flight readability,
   not decorative density alone.
4. **Further world variety:** after this six-world pack receives player feedback,
   a closed stunt circuit and observatory ridge are the next researched candidates.
   Estimate 3–5 working days for a verified pair with distinct routes/subjects;
   detailed custom art is additional. They are planned candidates, not shipped maps.
5. **R6 completion:** 4–6 working days for remaining original demos, bounded optional
   adventure examples and targeted retry/section flow after dependencies integrate.
6. **R7:** retain 5–10 working days for deferred unit coverage and release qualification.
   Human sessions and named-device measurements must actually occur; automated
   replay/WebGL receipts do not satisfy them.

The earlier 8–10 week remaining-release estimate is not a measurement of work
already elapsed. Re-estimate after coordinated integration and the first physical
handheld/novice session; no reduced release ETA is claimed from authored counts.

## Approved item-by-item continuation — 2 October 2026

This sequence supersedes the earlier dependency and next-item summaries. The
owner approved implementation after the status review. Current main includes
all of closed native stacks #889 and #902, reimport #922, ghosts #913, World
Adventures #947 and offline SIM integration #933. No coordinated integration of
those already-merged features remains. Start independent increments on current
main; create a new native stack only when a second dependent PR needs it.

| Item | Priority and scope                                                                    | Working estimate              | Completion gate                                                                        |
| ---- | ------------------------------------------------------------------------------------- | ----------------------------- | -------------------------------------------------------------------------------------- |
| A    | Reliable section practice: recorded entry state, scoped UI and safe fallback          | 1–3 days                      | Every checkpoint, actual host controls/results and frozen packages                     |
| B    | Input/device reliability: stall safety, radio/controller actions, handheld ergonomics | 2–4 days plus device sessions | Controlled browser cases plus separate actual TX15, iPhone and Steam Deck observations |
| C    | Themes integration and one or two hero environments                                   | 3–5 days per art batch        | Shared appearance contracts, readable flight lines and measured budgets                |
| D    | School comprehension and tuning                                                       | 3–5 days plus player sessions | Five first-time players and experienced-pilot feedback                                 |
| E    | Remaining original demos and repeat-play flow                                         | 4–6 days                      | Garage16, original120 total, exact playback and bounded delivery                       |
| F    | Creator usability and offline recovery                                                | 3–5 days                      | Real edit/reimport/export workflow and offline device checks                           |
| G    | Further maps after feedback                                                           | 3–5 days per pair             | Distinct authored activities, verified routes and art acceptance                       |
| H    | Final qualification and deferred unit coverage                                        | 5–10 days                     | Regression, hardware/performance and release evidence                                  |

A is merged in [PR #951](https://github.com/mekhovov/revealline/pull/951); see
[section-practice behavior](fpv-checkpoint-practice.md). Publication and exact
deployment state belong in the latest delivery checkpoint. B's callback-stall
and focused-button pause increment is merged and publicly verified as
[PR #952](https://github.com/mekhovov/revealline/pull/952);
see [lifecycle behavior and verification](fpv-world-lifecycle.md). It freezes
before device actions or physics and requires deliberate resume. Physical-device
and handheld sessions remain pending; this increment does not complete all of B.
E's Garage increment is published in
[PR #954](https://github.com/mekhovov/revealline/pull/954),
with source and packaged playback qualification complete. See
[Garage demonstrations](fpv-garage-demonstrations.md). Its focused PR and public
deployment remain separate gates in the delivery log. The approved C art/Themes
work can proceed while physical-device and unfamiliar-player sessions are pending.

The catalogue remains 14 worlds / 148 challenges. This branch installs
120/120 original plus 58 school demonstrations; the 60 Adventure authoring proofs
are separate. Main/public counts remain at 104 originals until this increment merges.
Additional unit coverage stays in H/R7, with functional checks on every increment.

### Approved A–H continuation checkpoint — 2 October

A's checkpoint practice (#951) and B's lifecycle/keyboard-pause repair (#952)
are merged and their public player launches are verified. E's Garage16
increment (#954) completes the120 original demonstration set plus58 school
proofs; it is published but held by a whole-edition size-check failure.
C1's Hangar surface/UV refinement is complete and locally qualified, awaiting
focused publication behind E. Broader C art/shared Themes integration, B actual
hardware qualification, D player sessions, F creator workflow, G feedback-led
map growth and H deferred unit/regression/device work remain. The current
package file caps inherited from #930 are64/72/104; byte caps remain8/8/16MiB.
Follow the latest delivery log for exact heads and publication evidence.

### C2 continuation — 2 October 2026

Garage #954, Hangar #956 and capacity repair #958 are merged. Stack #957 is
closed; neither a Garage demonstration handoff nor a stack rebase remains.
All original 120 demonstrations plus 58 school recordings are present on main.
The touch-flight and unrestricted mode-choice increment is published separately
as #959; its required admission and physical-device acceptance remain separate.

C2 now replaces the meadow's evenly spaced tree ring with four irregular
exterior groves across its 43 existing challenges. It changes composition only,
with the same geometry/material counts and at least ten metres of exterior
clearance. The source passes 147 browser checks across 45 rendered comparisons
and replays all 178 recordings. Detailed foliage, realistic asset production and
named-device frame-time measurements are still required; this does not close C.

Next independent art work is C3: coordinate #955's shared appearance/material
roles, then refine courtyard/woodland flight landmarks and surface scale in a
separate branch. Keep #959 and the completed C2 PR isolated while publication
runs. D's novice sessions, B's real TX15/iPhone/Steam Deck acceptance, F's creator
and device-offline qualification, feedback-led G map growth, and H's deferred
unit coverage remain open. Authored counts remain 148 challenges and 14 worlds.

### C3 courtyard continuation — 2 October 2026

Touch #959 is merged and its actual public launch is now verified. Meadow C2 is
published as #960; publication is independent from the new C3 courtyard branch.
C3 connects the existing facade modules into three-bay terraces with deliberate
alleys, keeping all139 scenery placements and the original asset library. Actual
GLB verification passes124 checks/59 image pairs with no increased draw calls in
the sampled views. Frozen admission/publication follows; physical-device and art
acceptance remain open. Authored counts stay148 challenges/14 worlds. Continue
woodland/shared-theme asset qualification after this focused increment; preserve
#955's appearance ownership and the deferred H/R7 unit-coverage phase.

### C4 woodland continuation — 2 October 2026

Meadow #960 and Courtyard #961 are merged and verified in the public SIM on
main descendant e48adf318. C4 now replaces the woodland's fine timber grain with
root-aligned bark and adds quiet soil/moss/leaf detail to its existing ground.
All six opaque trunk silhouettes, collision, routes and exterior scenery remain.
Source verification passes211 checks/105 image pairs; package admission passes
all three optional applications. See [woodland qualification](fpv-woodland-surfaces.md).
Broad realistic-model production is still open; this is a surface refinement.

A separate lossless picture-catalogue capacity repair is published as #963; it
removes a recurring whole-edition size failure without dropping content or
changing guards. It is independent of woodland and Themes #955.

Next concrete C item is Warehouse/Stadium surface-scale and landmark readability,
coordinated with #955 shared material ownership. Existing counts stay148 authored
challenges/14worlds and178 original/school demonstrations. B physical hardware,
D novice sessions, F creator/device-offline qualification, feedback-led G maps
and H/R7 deferred unit coverage remain pending.

C4 is now published as #964 with all three optional packages qualified against
merged main #883/#965. Public deployment is still pending. C5 is split into a
focused Warehouse storage-surface/UV increment followed by Stadium display and
stand surfaces, keeping solid collision and Pixel readability. See the latest
delivery-log checkpoint for exact candidates, capacity #963 and open human/device
qualification. Keep unfinished C5 separate from the ready woodland PR.

### C5 Warehouse continuation — 3 October 2026

Woodland #964 and capacity repair #963 are merged. C5 improves the six closed
storage blocks and Warehouse shell surfaces across all ten existing courses,
including the two larger school layouts. Geometry/collision, visibility,
lighting, Pixel filtering and objectives stay exact. Shared maps avoid new
texture allocations; six readable bay labels use existing planes (+1,152 UV
bytes). Source WebGL passes 307 checks / 159 comparisons, all18 Warehouse
recordings replay, and all13 other environments remain unchanged.
See [C5 qualification](fpv-warehouse-surfaces.md) and the delivery log for package,
PR and public status. This surface increment does not close broader C art work.

Next: C6 Stadium's static scoreboard and stand surfaces, then yard/garage.
Keep Themes #955's shared factory/semantic ownership. Counts remain148 challenges,
14worlds and178 original/school demonstrations. B physical TX15/iPhone/Steam Deck,
D player sessions, F creator/device-offline, feedback-led G maps and H/R7 deferred
unit coverage remain open.

### FlightDivision inspection and implementation order — 3 October 2026

This checkpoint supersedes the catalogue counts and next-item order immediately
above. Main `cf0b62e53` includes recovery #981 and Theme Studio #982. It has
184 challenges in 14 worlds, including 58 school lessons; the original/school
demonstration total remains 178. The prepared 60 Adventure examples still need
their own player-delivery qualification. No new world is counted for an art pass.

The owner requested implementation after a logged-in inspection of
[FlightDivision](https://www.flightdivision.com/sim). Its actual settings,
free-flight environment, drone Gear screen and first lesson were inspected.
The useful immediate references are its two-hand keyboard grouping, readable
quad construction, coherent industrial materials, clear structural silhouettes
and short contextual lesson instructions. Public marketing statements about
training transfer and physics are not independent qualification evidence.

Deliver the following focused increments in this order, with independent
branches where their code has no dependency:

1. **Two-stick keyboard layout:** W/S throttle, A/D yaw, arrows pitch/roll;
   Space arm/pause and R reset through existing safety gates. Keep Classic
   selectable and share the preference/hints across both hosts and the lab.
   Gate: actual-browser input, replay/menu isolation and frozen package admission.
2. **Drone and Container Yard presentation:** shaped carbon frames, larger swept
   props, recognizable battery/camera details, corrugated closed containers and
   door hardware. Reduce repeated meshes; preserve Pixel styling, collider bounds,
   theme ownership and physical profiles. Gate: before/after WebGL views,
   collision/visibility equivalence, resource disposal and package admission.
3. **Full environment art foundation:** carry the same surface scale, material
   discipline, lighting and flight-line composition into Stadium/Garage, then
   terrain and richer authored scenery. A small procedural refinement does not
   establish parity with FlightDivision's complete world production. Establish
   a representative finished environment before estimating the remaining batch.
4. **Remaining examples and repeat play:** ship the prepared optional Adventure
   demonstrations, keep section practice/ghost compatibility and improve relevant
   next actions. Follow with distinct map additions once the art pipeline is
   proven; user feedback remains nonblocking.
5. **Final qualification:** additional unit coverage, sustained named-device
   frame times, physical radio/handheld and novice acceptance. Continue functional
   verification on every preceding increment. Do not mark pending human/device
   observations passed merely because browser fixtures succeed.

The first two increments are under active implementation. Their focused PRs and
qualification receipts determine completion; public availability additionally
requires deployment identity and a real player launch. They do not replace the
larger remaining art work with an unsupported same-quality claim. Reuse existing
licensed resources and original geometry; this inspection does not establish
redistribution permission for FlightDivision's proprietary models or textures.

### D1 graphics ownership checkpoint — 4 October 2026

The bounded environment-light reuse and graphics-loss recovery increment is
locally qualified at `06d154e76` on published main `47d2019d`. Full validation,
63 manual checks, 30 existing checks, three reproducible source-bound admissions
and the actual 102-file editor loss/restoration smoke pass. The final editor
preserves its existing reload requirement; flight Retry has separate actual-host
evidence. See [the qualification](fpv-environment-light-reuse.md) for exact
candidate bridges and the retained v5 imported-image discrepancy.

Proceed with protected publication, then follow deployment identity and an
actual public launch. The earlier 15–17 second pauses remain unreproduced; this
increment does not close sustained named-device performance, broad image
determinism, remaining art acceptance or deferred D6 unit coverage.

### D2 Railworks checkpoint — 4 October 2026

Campus #1018 is merged at `96ef08777` and its public player was observed rendering
the authored facades, arming and pausing. D1 environment-light ownership and
graphics recovery #1019 is merged at `a46aded0b`; that source merge is distinct
from public deployment qualification. The independent Railworks increment is
qualified on that main: eight existing closed wagons gain subdued flush framing
and stiffeners, reusing their accent batches. It preserves collision, original
maps, Pixel/shared themes and retained recordings. The wagons remain box-like;
this is bounded visible progress, not comprehensive realistic world completion.
See [Railworks qualification](fpv-railworks-wagon-frames.md) for exact candidates
and the source/package evidence.

The catalogue remains **196 challenges / 14 worlds / 58 school lessons / 374
school steps**. Continue the remaining D2 art work with the independent Orchard
and Solar increments and broader world polish, then D3 examples/coaching, D4
creator, D5's **228 challenges / 18 worlds** target and deferred D6 unit coverage.
Functional qualification continues at each increment. Browser checks do not
close named-device timing, physical controls or complete-world artistic goals.

### Solar and optional School examples checkpoint — 4 October 2026

Railworks #1020 is merged at `bf167a4fd`. The independent Solar increment is locally
qualified on that main: photovoltaic cells and aluminum-colored framing belong
only on the existing banks' upper faces; sides and backs stay solid and quiet.
The final canonical-profile guard preserves same-ID theme edits. Geometry,
collision, resource counts, Pixel/shared themes and retained recordings remain
unchanged. See [Solar qualification](fpv-solar-panel-frames.md) for original-source
and final-package attribution, actual browser/player evidence and limits. These
bounded increments do not close broader world-model realism or artistic polish.

The next independent D3 School batch is **28 optional alternate examples**:
`beginner-01`–`12` in Acro and `beginner-27`–`42` in Self-level. Eligibility follows
actual step types and `worldCourseRequiresAcro`, not a nonexistent `step.skill`
property. Exclude the fourteen already optional foundation Self-level examples
and sixteen Acro-skill lessons that allow only unscored Self-level practice.
Preserve the **178 bundled examples** and distribute new proofs through the
existing optional archive importer. The sixty Adventure examples are separate
work. Functional replay and actual import/playback qualification precede claims
of completion; this checkpoint does not say the new batch has been generated.

Content remains **196 challenges / 14 worlds**. Continue the approved D3 examples
and coaching work, D4 creator, D5's **228 challenges / 18 worlds** target and D6
unit coverage, while retaining broader art, named-device performance and physical
control acceptance as separate unfinished goals.
