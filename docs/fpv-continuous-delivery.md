# FPV continuous feature delivery

Updated 2026-10-04. The owner requests a verified PR after each completed feature,
with the next independent item developed while source gates and deployment run.
Additional unit coverage belongs in the final phase. Build, browser, replay,
import/export and publication verification remain part of every applicable item.

**Current checkpoint:** see “4 October — Combined online journey and publication”
at the end of this log and the active parallel delivery
plan. Earlier tables and heads are history.

## Delivery queue

| Item                                             | Branch / PR                                                                                      | Current state                                                                                                                               | Acceptance                                                                                                                                       |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| World Studio development playtest                | `codex/fpv-world-framework`, [PR #885](https://github.com/mekhovov/revealline/pull/885)          | Completed; native stack layer 1                                                                                                             | Recorded browser/build/offline evidence in `fpv-worlds-playtest-verification.json`; protected merge and actual deployed launch remain required   |
| Academy demonstrations and beginner entry        | `codex/fpv-academy-demonstrations`, [PR #887](https://github.com/mekhovov/revealline/pull/887)   | Completed; native stack layer 2                                                                                                             | 24 existing demonstrations, half-speed and replay controls; browser/offline evidence in `fpv-academy-demonstrations-verification.json`           |
| Woodland demonstrations                          | `codex/fpv-woodland-demonstrations`, [PR #888](https://github.com/mekhovov/revealline/pull/888)  | Completed; native stack layer 3                                                                                                             | Eight challenges × two modes; all 16 actual recordings complete in Node and Chromium without contacts; route-facing presentation reviewed        |
| Courtyard demonstrations                         | `codex/fpv-courtyard-demonstrations`, [PR #890](https://github.com/mekhovov/revealline/pull/890) | Completed; native stack layer 4                                                                                                             | Eight challenges × two modes; all 16 recordings complete without contacts; offline, localization and route-facing playback verified              |
| Live sector timing and personal-best comparisons | `codex/fpv-sector-deltas`                                                                        | In development above courtyard                                                                                                              | Tick-accurate sector timing, replay-verified compatible reference frozen per attempt, interrupted-flight restoration and readable EN/UK feedback |
| Remaining new-world demonstrations               | Warehouse, stadium, container yard, garage; separate coherent PRs                                | Warehouse and stadium recordings prepared outside the tracked feature branch; browser/integration verification pending; later worlds queued | Author and replay successful recordings with exact dependencies; only offer actually verified demonstrations                                     |
| World/drone presentation and player tuning       | Subsequent bounded feature PRs                                                                   | Queued                                                                                                                                      | Improve remaining art/animation/readability and mode-specific thresholds using actual player observations; keep flight handling unchanged        |
| Final qualification                              | Final phase                                                                                      | Deferred                                                                                                                                    | Additional unit coverage, full compatibility/failure matrix, named physical-device performance and human content acceptance                      |

The approved scope and production limits remain in
[`fpv-worlds-implementation.md`](fpv-worlds-implementation.md). The current 60
challenge definitions do not represent 60 fully polished, human-qualified levels.

## Publication procedure

The FPV PRs are now linked as **native GitHub stack #889**, rooted on `main`.
The existing layers are #885 → #887 → #888 → #890. New dependent items append above the
current open top; keep each feature's reviewed diff separate. The owner explicitly
requested stacked PRs on 1 October 2026.

1. Finish a coherent feature and record actual build/browser/content evidence.
   Additional unit coverage remains in the final phase. Commit only that item.
2. Create its PR against the predecessor branch, assign the existing scheduled
   planning milestone **v0.150.0 — Unified native experience** (#57), and attach
   it to this chat. Add it to the current open native stack through the GitHub
   stack API. After a stack fully merges, base the next feature on main and create
   a new stack only when another dependent feature needs one.
3. Start the next feature on a separate branch while all published layers run
   their required checks. Do not add unfinished work to a ready PR.
4. Keep the native stack linear with a cascading rebase when necessary. Freeze
   active local edits first, capture every current remote head, retain recovery
   refs, and push only with explicit per-branch leases. Never overwrite newer
   owner work or mix unrelated commits into the stack.
5. Native members inherit the trunk's branch protections. Inspect the exact
   current heads and required gates for every layer being merged. Respect holds
   and reviews. Use the protected asynchronous stack merge API for an admitted
   contiguous group; never use an administrator bypass or disable checks.
6. Follow **Deploy protected main to GitHub Pages**. Confirm the public deployment
   metadata identifies the merge or a verified descendant, and launch the actual
   FPV application before calling an item live. Open and merged PRs are distinct
   from verified player availability.

Do not manually retarget native stack members while they remain stacked. GitHub
manages the stack relationship. If the native stack cannot satisfy repository
requirements, preserve the blocked state and continue independent development;
do not silently dissolve it or weaken publication guards.

The older fastline controller still has a stale active milestone/workflow-name
assumption. Keep global release authority unchanged. Owner-authorized protected
stack publication uses the current GitHub requirements directly.

Live application: <https://mekhovov.github.io/revealline/optional-practice/fpv-worlds/index.html>.
Local `dist/fpv-worlds-playtest/` paths are not the public deployment path.

References: [GitHub stack requirements](https://docs.github.com/en/pull-requests/reference/stacked-pull-requests)
and [stack API](https://docs.github.com/en/rest/pulls/stacks).

A thread heartbeat, **Continue FPV feature delivery**, checks this queue every
30 minutes. It should preserve active agent work, avoid duplicate PRs and keep
unchanged status quiet. Record meaningful progress here and notify the owner of
completed items, verified live availability, meaningful failures or needed input.

## Latest delivery checkpoint

On 1 October, native stack #889 was cascaded onto main
`8b7c23f837fba54c353a625ae569e994a9592952` with local recovery branches and
an atomic push guarded by each captured remote head. The resulting FPV source
and asset bytes match their previously verified versions. Current published
heads at that checkpoint:

- #885: `994fb4bd80fd336ba1889dce2479705260d378fd`
- #887: `7b4524b87b86003d62fd73af055b7cc48ac0e0b5`
- #888: `5052f6e1ab5235cb329a05ea16c0dea45f2da11d`
- #890: `3ce3b98ef9b150fde0f7211a0251bb09259b5b8f`

The synchronized native layers all passed their required source workflow,
including layers whose immediate base is another feature branch. The guarded
asynchronous merge request for the top PR was then rejected with
`Required status check "release-ready" is expected.` Main had advanced to
`b89a465209a1`, leaving the stack behind. Request UUID:
`582b5a7f-ebdb-48db-8fbc-78f612811b4f`. No protection was bypassed and no PR merged.

Refresh the stack together after active edits are committed, retain recovery
refs, and require fresh checks on the updated heads. Always re-read actual heads,
reviews and holds before another protected asynchronous merge.

No FPV live deployment has been verified yet. Sector timing development continues
on its own branch while the completed layers qualify. Warehouse and stadium
recordings are prepared independently; their integration, final package and
browser/offline qualification belong in separate PRs. Native stack membership is
not a merge or deployment confirmation.
PR #885 is open at `882c96622a9c52cb93bf94f642aba1ae4fb926c4`;
[required source run 36783706645](https://github.com/mekhovov/revealline/actions/runs/36783706645)
is pending. It has no review/label holds and is mergeable once its current gate
passes. Main was `c30135d80abe79c9fef88b67c8629c0725db58cc` at this checkpoint.
Two safe expected-head updates incorporated intervening main commits. Leave the
current CI running; do not repeatedly restart it for unchanged status. Re-read
the actual remote state before any merge.

The former predecessor-only chain is now native stack **#889**. The earlier
head/run checkpoint above is historical; always read current stack heads before
acting. No FPV live deployment has been verified yet. Development continues
independently while the native layers qualify.

## Radio priority and current delivery state — 1 October

The checkpoints above are historical. PRs #885, #887, #888 and #890 have now
merged through protected native request `809d5f63-5f6f-426d-a950-9be08a730d92`,
producing main `ff1f6d1a9b4d38dc77605c0a2156a1a27747901a`. Native stack #889
still contains #892 (sector timing), #894 (Warehouse), #895 (Stadium) and #896
(Container Yard). Inspect current remote heads before further publication.

The user's immediate radio issue takes priority. Branch `codex/fpv-radio-worlds`
restores verified radios in both FPV runtimes, provides visible calibrated sticks,
preserves pause/reconnect pickup and offers compact/expanded/setup-only displays
in World Studio. The owner confirmed physical TX15 flight. Functional browser
verification covers all 60 challenges in both modes and alternate entry points;
see `fpv-radio-worlds.md` and its verification receipt. Publish this focused fix
independently of the pending demonstration stack.

Public FPV availability remains blocked: Pages run 36788512997 exceeded the
950,000,000-byte guard by 7,359,524 bytes. The preceding site had only 30,248 bytes
of headroom. Preserve the guard and all retained player content; investigate a
reviewed lossless packaging change rather than dropping assets or raising limits.
Local playtest availability and an open/merged PR are not public deployment.
The read-only size audit in `/tmp/fpv-pages-size-audit.json` identified a viable
follow-up: bounded, versioned gzip transport for retained JSON packs, with separate
transport/canonical hashes and unchanged decoded identities. Eight large core
packs save 23,181,525 bytes in byte-exact round trips. Loaders, downloads and
offline metadata need coordinated implementation and verification; do not replace
existing JSON bodies with gzip bytes or delete retained packs.

Further content-stack merges remain held for a confirmed creator reimport defect:
identical reimport can erase a local obstacle, reordered spawn anchors can move
the spawn and semantic actor/gate edits can be omitted. After radio publication,
prioritize transactional draft preservation and explicit diagnostics, then the
prepared Garage demonstrations and verified local ghost. Reproduction and staged
feature handoffs are retained in `/tmp/fpv-reimport-data-loss-20261001/`,
`/tmp/fpv-operations-readable-20261001/garage/` and the sparse worktree
`/tmp/fpv-local-ghost-20261001` (commit `a4bff27e3429d1da9a24a6f2772baf6c7ec80836`).
Do not discard these unpublished artifacts or disturb active agent work.

### Guided radio setup and fullscreen follow-up

The owner next requested a player-friendly calibration screen and immersive flight
in every level. Branch `codex/fpv-radio-setup-ux` is based on radio fix #899 and
contains that focused follow-up. Known profiles open on a live confirmation;
unknown devices get directed calibration, with advanced tools behind disclosures.
Both simulators share native fullscreen and an explicit full-window fallback.
See `fpv-radio-setup-ux.md` for the design references and verification receipt.

Published as PR **#901** against `codex/fpv-radio-worlds`, in separate native
stack **#902** with members **#899 → #901**. Existing content stack #889 stays
held for reimport correction. Parent #899 received a main merge and the additional
USB-disconnect isolation fix at `dc85a3bda021`; this feature was rebased onto that
head without rewriting the concurrently updated parent. Refresh current heads
before publication or any coordinated history change. Continue preserving prepared Garage
and local-ghost work while the publication-size repair and reimport correction
receive their own verified increments. Additional unit coverage stays in the
final phase; functional checks remain required throughout.

Final local artifacts: `dist/fpv-radio-setup-playtest` SHA-256
`d0615fa3f3929f8a979c3fb0945b2b1ac13093ee7d55b90a1c497c2be60a3faf`
and the preserved 88-demonstration `dist/fpv-stadium-demo-playtest` SHA-256
`7eaf181a223727d4071ccd26a9a909e046a9ab9c045326b790760cac622e805a`.
Known and unfamiliar radio calibration, advanced-capture transitions, fullscreen
entry points, mobile EN/UK layouts, offline flow and non-radio disconnect isolation
passed browser verification. See the committed verification receipt for scope and
intermediate/final build identities. Required GitHub checks and protected stack
publication continue asynchronously; Pages run 36790807793 also failed, so public
availability still requires the separately tracked site-size repair and a verified
deployment. Preserve stack protection and coordinate any necessary linear rebase
with current parent work, recovery refs and explicit remote-head leases.

### Native simulator UI — 1 October

The full UI increment is published as **PR #904**, branch
`codex/fpv-native-sim-ui`, based on `codex/fpv-radio-setup-ux` (#901).
Native stack **#902** now contains **#899 → #901 → #904**. It uses the main
game's FPV / LINE identity, hangar artwork, field-kit tokens, local fonts, menu
icons and three short interface cues through shared simulator presentation code.
World Studio has a focused Fly/world-selection lobby, pre-flight settings,
playlists, Workshop and Library; both hosts have clearer flight chrome,
options, fullscreen controls and radio pause/arming behavior.

Parent #901 was fast-forwarded from `bba7df8c0847` to **`72cb7b8e42a9`** to fix
its failing optional-package job. World-only loaders and their pinned vendor
hashes now stay outside Academy. Admission uses the selected package's existing
64-file/8-MiB or 96-file/16-MiB policy, with unchanged ZIP framing allowance.
The UI child was rebased on this fix; the root source and browser behavior did
not otherwise change. Preserve parent #899's existing work and inspect fresh
remote heads before any coordinated linear stack rebase or protected merge.

The final frozen native-UI candidate at `8d34dc140643` passed all three optional
package admissions, committed-input checks and byte-identical double builds.
Academy is **62 runtime / 64 source files** and World Studio **93 / 95**.
The combined Stadium package has **94 runtime / 96 source files**, meeting its
96-file cap. Do not increase caps or drop
required source/license files. Final receipts are committed in
`fpv-native-sim-ui-verification.json`; UI architecture and asset sources are in
`fpv-native-sim-ui.md`.

Final local World Studio: `dist/fpv-native-ui-playtest`, SHA-256
`ec4d82da6e89a3573f04112170660beaac9fa88ab848021a72a461e13fe53528`
(86 files, 11,946,874 bytes). Final preserved Stadium integration:
`dist/fpv-stadium-demo-playtest`, SHA-256
`db55de1a0b299f2d9174107322e575e73733febb727a2756a938982b5ce12041`
(87 files, 13,457,237 bytes), retaining all 88 demonstrations byte-for-byte.
The source localhost URL also has the redesign. Browser verification covers
responsive EN/UK views, controlled-radio and keyboard flight, safe nested
settings/fullscreen, playlists, recordings/results, GLB import, actual editor
transform dragging, offline reload and shared assets/sound. New physical-radio
acceptance, performance qualification and new unit coverage are not claimed.

At publication, the latest main Pages run remained failed (`36790807793`).
The redesign is available locally and in an open PR, not verified public live
content. Continue required checks and protected stack publication in the
background while the separately tracked site-size repair and reimport data-loss
correction receive focused increments. Preserve Garage/ghost handoffs and the
content-stack hold described above. Do not overwrite this branch with the next
unfinished item or repeatedly restart unchanged CI. Additional unit coverage
remains in final qualification; functional verification continues per feature.

### Beginner Flight School — 1 October

The completed beginner course is published as [PR #905](https://github.com/mekhovov/revealline/pull/905),
`codex/fpv-beginner-flight-school`, based on PR #904 and appended to native stack
#902 (`#899 → #901 → #904 → #905`). It adds 14 freely selectable lessons and 59
guided steps, from the four controls and first lift to a complete route and two
optional Acro introductions. The coach shows the player's selected Mode 1–4
radio layout, animated response diagrams, current-objective telemetry, and a
safe pause/explain/resume path for keyboard, touch and USB-radio flying.

All 14 recommended-mode courses completed and independently replayed against the
unchanged fixed-step runtime with zero contacts and full health; the committed
receipt records their identities and proof hashes. Browser verification also
covered lesson launch, EN/UK layouts, compact views, input layouts, guide arm
safety, persistence and proof-backed progress. Unit coverage is deferred to the
final phase. This does not claim novice-player acceptance, physical-radio
acceptance on the final build, hardware qualification or public deployment.

### Drone response overlay — 1 October

[PR #907](https://github.com/mekhovov/revealline/pull/907),
`codex/fpv-drone-response-overlay`, follows #905 in native stack #902. It adds
an optional compact airframe schematic beside the live-stick display. It shows
current heading, roll/pitch horizon, altitude, speed and horizontal motion, and
names the dominant control response. This keeps FPV-camera flying legible
without adding a persistent tutorial. Players can turn it off in Flight options
or use its close control; that preference persists.

## Reviewed continuation — creator repair, Acro school, graphics and audio

1 October 2026. The approved remaining scope and estimates are in
[`fpv-reviewed-delivery-plan.md`](fpv-reviewed-delivery-plan.md). Source publication,
functional verification and public availability are separate states. New unit
coverage remains in R7; no physical-radio, five-novice or sustained hardware
performance acceptance is claimed.

### Published increments

| Item                                  | PR / branch                                                                                 | Verified feature head                      |
| ------------------------------------- | ------------------------------------------------------------------------------------------- | ------------------------------------------ |
| R0 startup and transactional reimport | [#922](https://github.com/mekhovov/revealline/pull/922), `codex/fpv-reimport-reviewed`      | `b490f26337781b9a6b827f5348620763b8b4db41` |
| Refreshed original school parent      | [#905](https://github.com/mekhovov/revealline/pull/905), `codex/fpv-beginner-flight-school` | `6424713474403b89e81580b07d6fe7336376a5a3` |
| Refreshed original schematic parent   | [#907](https://github.com/mekhovov/revealline/pull/907), `codex/fpv-drone-response-overlay` | `86740c58bc7f0d4b347c6714a5692625a483adb3` |
| R1 accurate shared drone guide        | [#923](https://github.com/mekhovov/revealline/pull/923), `codex/fpv-shared-flight-guide`    | `1f41a99328b303f53ec0d6df9ccc613f59d093aa` |
| R2 primary Acro curriculum            | [#924](https://github.com/mekhovov/revealline/pull/924), `codex/fpv-acro-first-school`      | `17e862c2d06183aee34343fa0d547f9b5b655e9d` |
| R4 graphics foundation                | [#925](https://github.com/mekhovov/revealline/pull/925), `codex/fpv-graphics-foundation`    | `f7e347c2ad47377e7772734dc848cd12f4ecbfc0` |
| R3 separate audio levels              | [#926](https://github.com/mekhovov/revealline/pull/926), `codex/fpv-shared-audio-controls`  | `bae8729f17429cd321da45dde77b502ed26c407b` |

This delivery-only checkpoint follows #926's feature head. Always obtain fresh
remote heads before any lease, review or merge; never infer them from this table.
The root worktree is on `codex/fpv-shared-audio-controls`; all feature work and
verification evidence are committed. Native stack **#902** contains the open
linear chain **#905 → #907 → #923 → #924 → #925 → #926**. Its older #899/#901/#904
members are merged. Every newly created PR is attached to this chat. #922 is
independent on main. Native content stack #889 and the Garage/ghost handoffs are
preserved; do not assume its historical membership is current.

#905/#907 retain `release-train-hold`. Their parent refresh used recovery refs and
an atomic push with explicit old-head leases. No holds, global release authority
or protection settings were changed. If #922 merges, coordinate a cascading
rebase onto the new main with the same safeguards and preserve the feature bytes.
Do not manually retarget native members or mix the next UI feature into #926.

### Functional evidence

- **R0:** 13 actual import/reimport/pack/ZIP cases and browser preview/apply/cancel
  passed. A browser-exported editable ZIP was reopened independently: local wall,
  spawn, 6 m gate width/direction −1 and actor health 80/x −6 m survived with
  expected course identity `2e1a143094a18f30`. See
  [`fpv-reimport-preservation.md`](fpv-reimport-preservation.md) on #922. Its frozen
  `b79c04f18` candidate passed all three package admissions, committed inputs,
  two identical builds and ZIP checks. The published successor changes docs only.
- **R1:** observer-only quaternion attitude, command/thrust and measured motion
  in World Studio and Academy; Off/Compact/Learning and text preferences persist.
  Real demonstrations, EN/UK, pause/explain and World Studio 1280×720, 390×844 and
  844×390 were checked. Frozen `1f41a993` passed all three package admissions and
  reproducibility. Academy's phone-specific visual pass remains outstanding.
  See [`fpv-shared-flight-guide.md`](fpv-shared-flight-guide.md).
- **R2:** 14 primary Acro lessons, 12 optional self-level lessons, 122 guided
  steps, 14 installed primary demonstrations and 86 authored challenges. All 14
  primary recordings completed and independently replayed with unchanged 50 Hz
  physics, Gentle response, zero contacts and full health. Browser checks covered
  Acro/FPV entry, slow demonstration playback, no progress awarded for watching,
  and restoring previous flight settings. Frozen `17e862c2` passed all three
  admissions and reproducibility. Original course/evidence identities survive.
  See [`fpv-beginner-flight-school.md`](fpv-beginner-flight-school.md).
- **R4 foundation:** all 14 actual WebGL checks passed, including 216 world/
  preset/view configurations, three-material GLB import, repeated resource
  plateaus, stale preparation, abort and disposal. Verification found and fixed
  the shared shadow-uniform texture leak; zero owned scene resources remain
  after disposal. Internal Three.js LUT counters are documented, not reported as
  measured VRAM. All three drone previews and rapid paused quality/aircraft
  changes were checked. Frozen `5eea46503` passed all three admissions, committed
  inputs, two identical builds and ZIP checks. See
  [`fpv-graphics-foundation.md`](fpv-graphics-foundation.md) and committed receipts.
- **R3 audio increment:** separate interface/feedback, motors and environment
  levels persist without changing mute or activating audio. Production graph
  routing/lifecycle verification, actual EN/UK sliders, cross-host preference
  round trips and the combined Acro demonstration passed. Frozen `ce2ce2895`
  passed all three admissions, committed inputs, two identical builds and ZIP
  checks. See [`fpv-audio-controls.md`](fpv-audio-controls.md). Audible quality and
  physical hardware remain unqualified.

Academy remains 62 runtime / 64 source files; World Studio 94 / 96. The unused
Academy wordmark dependency was removed without changing package limits. World
Studio keeps that artwork. Receipts and source inventories remain available in
the named `/tmp/fpv-*-final-20261001` outputs. Regenerable ZIP copies from earlier
candidates were removed when disk space fell below 300 MiB; cleanup receipts
retain their hashes. Source, recovery refs, browser exports and player builds
were preserved. Check free space before another large build or worktree copy.

### Local player build and publication

Combined learning/guide/graphics/audio build:
`http://127.0.0.1:8789/dist/fpv-reviewed-player-playtest/optional-practice/fpv-worlds/index.html`.
It launched in the actual browser with all 26 learning challenges present.
It contains 87 files / 12,386,802 bytes; ZIP SHA-256
`95521b70c21eb07e1d46144351eff90be1c5971142b3e60c345880515222d842`.
This package does not yet include the independent #922 transactional reimport
patch; that repair was verified separately on port 8792. Integrate it through
the coordinated main refresh before claiming the combined creator flow fixed.
The preserved Stadium package still contains its 88 original demonstrations.

The actual public SIM launch failed with `lastRadioDiscovery is not defined`.
#922 contains the minimal declaration fix, also carried by the refreshed feature
parents. The Pages capacity repair #911 is already merged; do not resurrect the
obsolete gzip prerequisite. Public-marker access was blocked in the browser.
No new feature or startup repair is claimed publicly live.

At the final #922 gate snapshot all latest checks had completed: source
`release-ready`, focused, optional-package, candidate, default-capacity, assembly
and reconciliation passed. Build/test/stage were intentionally skipped, not
passed. No review or hold existed. The protected exact-head asynchronous merge
request was accepted with `bypass_rules: false`, UUID
`132f8077-b712-409c-94e1-98d5b8b632c5`, expected head `b490f2633`.
The first follow-up still reported OPEN/CLEAN with no merge commit. Enqueued is
not merged or deployed. Leave publication running and inspect on the next
heartbeat; do not repeatedly poll unchanged external work.

### Next concrete work

1. Confirm #922's protected merge and deployment identity, then launch the public
   SIM. Refresh the held native stack linearly when required, preserving recovery
   refs, active work, exact-head leases and existing review/hold requirements.
2. Start **R3 shared menu navigation and HUD scaling** on a new branch above the
   current compatible feature head. Keep paused-menu input separate from radio
   flight input; implement consistent back/Escape/focus, larger text/targets,
   clear next actions and localized recovery states.
3. Continue R4 material selection/preparation and R5 eight-world art batches.
   Current maps are procedural; no Poly Haven/ambientCG selection is claimed
   shipped. Preserve licensing and package caps. Benchmark a realistic world
   before claiming sustained 60/30 fps or choosing final detail budgets.
4. R6 still needs the original 120 demonstrations, Garage's final 16, content
   integration, exact-compatible #913 ghosts and targeted section practice.
5. R7 retains new unit coverage, full regression, five first-time players,
   final physical-radio acceptance and named-device performance/memory checks.

The 8–10-working-week continuation estimate plus two contingency weeks remains
a staffing-dependent planning baseline, not proof these remaining phases are
complete. Re-estimate after the first realistic-world benchmark and novice
sessions. Continue focused verified PRs while publication runs.

## Controls feedback checkpoint — 2 October 2026

Current branch: `codex/fpv-controls-learning-lab`, a new focused child of #926
at `a76abd56f2097552f435b79d0be09c36710eeb7f`. The remote parent and live native
stack #902 were checked again before publication: open linear membership remains
#905 → #907 → #923 → #924 → #925 → #926. Preserve existing holds. No parent was
rebased or retargeted in this increment. The completed UI/graphics/audio work,
Garage handoff, #913 ghost work and #889 content stack remain intact.

Implemented the user's screenshot corrections and live controls request:

- Shared rear-reference quaternion diagram in lesson explanations and both SIM
  hosts, with amber front, visible body depth, correctly signed roll and distinct
  pitch. Full Acro/yaw and measured movement remain truthful.
- Isolated Example / Try controls lab, schematic radio, labelled Mode 1–4
  gimbals, keyboard/touch/D-pad/calibrated-radio input, explicit stop/reset and
  safe input release. The paused lesson and recording remain unchanged.
- Larger directional flight sticks; shared navy/amber/cyan surfaces; fixed
  keyboard flight when a HUD button holds focus; truthful disabled Arm state
  while an explanation owns input.
- Keyboard, standard-controller and calibrated-radio paused-menu navigation,
  release/hold gates, editable selects/sliders, capture ownership and Back.
  Fullscreen across SIM screens, nested dialogs and lobby return; explicit
  full-window fallback and root Escape exit.

See [feature and verification notes](fpv-controls-learning-lab.md) and the updated
[delivery plan](fpv-reviewed-delivery-plan.md). Browser receipts cover 15 lab,
7 actual World Studio host, 19 menu and 15 rear-geometry checks. They use controlled
input; they do not assert physical TX15, novice or hardware-performance acceptance.
All 14 Acro proofs completed/replayed again. Final frozen package admission and
publication identities are appended below after the source commit.

The independent main-game preset is published as
[#928](https://github.com/mekhovov/revealline/pull/928), head
`b02a227ea0284a687448d4ea90992539384488d4`, branch `codex/tx15-full-radio-menus`,
based on current main `937aead7287814b7886082dda9be55f295641476`. It lives in
`/tmp/fpv-radio-menu-20261002` and does not depend on the FPV stack. An explicit
Solo preset adds guarded yaw Confirm/Back to the established tested TX15
mapping. Localization, syntax/lint/format, runtime and 12 actual-browser component
checks passed. Full game entry on port 8794 stops at its existing password gate;
full-lobby and physical-radio acceptance are not claimed. No gate was bypassed.

#922 remains OPEN at `b490f26337781b9a6b827f5348620763b8b4db41` with no merge
commit at this checkpoint. Its earlier protected asynchronous merge request is
not proof of merging or deployment. Do not enqueue repeatedly. The new controls
build is local/PR work, not claimed publicly live.

Next concrete work:

1. Finish the frozen controls candidate and append its focused PR to #902. Keep
   its source separate from further art or course changes.
2. During coordinated integration of #922, give its new dynamic reimport-review
   dialog exclusive menu navigation and guarded cancel/Back ownership. This
   modal is absent from the current branch, whose existing dialogs are handled.
3. Continue R4/R5 art and realistic materials; retain existing provenance/package
   limits and qualify a named-device benchmark. Complete R6 demonstrations,
   compatible ghosts and targeted practice. R7 retains new unit coverage and
   human/device acceptance. Never substitute controlled-input checks for those.

### Frozen controls candidate

Source `183690e94f5035fbcdd2c03c6001930c039aa182` passed all three admissions,
committed inputs, two byte-identical builds and ZIP-member checks in
`/tmp/fpv-controls-final-20261002`. The committed receipt is
`docs/evidence/fpv-controls-package-20261002.json`. Academy is 62 runtime/64 source
files and World Studio 94/96 under unchanged limits. The following evidence-only
commit leaves all runtime inputs unchanged.

The reviewed-player build is refreshed at the user's existing URL:
`http://127.0.0.1:8789/dist/fpv-reviewed-player-playtest/optional-practice/fpv-worlds/index.html#learn`.
Its 87 files total 12,444,906 bytes; ZIP SHA-256
`b758497d615673cc05930909d5f9caf8cb103a95ad42e4d667f4363a52481f38`.
The actual packaged browser launched the final lesson, correctly disabled real
arming during its guide, ran the pitch example and exited root fullscreen with
Escape. Academy's nested radio Back preserved fullscreen and root Escape exited
it. Browser console errors were absent. Local screenshots are retained at
`/tmp/fpv-controls-lab-final-20261002.png` and
`/tmp/fpv-controls-lab-mobile.jpg`.

#928's first observed CI snapshot contains an optional-practice failure and a
release-ready failure. Independent investigation is running in its dedicated
worktree; do not claim check completion or merge eligibility from its successful
component verification alone. The FPV frozen candidate above has passed its own
package admission independently.

### Final controls publication — rear view follows turns

The user's request requires remaining behind the drone after a turn. The final
refinement follows current heading in the HUD and lab instead of fixing the
camera to the starting heading. The full quaternion still drives body, pitch,
roll, thrust and inversion. The ground/start arrow rotates and a signed angle
shows yaw. Near a vertical nose the last usable camera heading is retained.
This supersedes the initial fixed-heading description above.

Final source `1b03e39d1bd9d0a6a15e196135f9edfda5aa4c7a` passed all three frozen
package admissions, committed inputs, two byte-identical builds and ZIP checks in
`/tmp/fpv-controls-follow-final-20261002`; receipt
`docs/evidence/fpv-controls-follow-package-20261002.json`. New browser projection
verification passed 27 checks, including every quarter/half turn with both pitch
and roll signs, inversion, near-vertical stability and ground bounds every 15°.
The 15 live-lab browser checks were repeated and passed. Other host/menu evidence
is unchanged. All runtime changes are in that frozen source; its following
checkpoint commit changes documentation/evidence formatting only.

The final local player ZIP has 87 files / 12,446,804 bytes and SHA-256
`1384f7f7620c255d81867b14d5f44a3e03f15201675a1b9a14c34b2db4c52e91`.
The existing reviewed-player URL is rebuilt and was launched with the final
heading-follow guide. No public deployment is claimed.

Focused [PR #929](https://github.com/mekhovov/revealline/pull/929) is attached and
was appended through the native stack API to #902 after #926. Open membership:
#905 → #907 → #923 → #924 → #925 → #926 → #929. Exact final runtime head is
`1b03e39d1`; the subsequent docs-only head is available on the PR. Preserve all
holds and exact-head checks; no rebase, manual retarget or bypass was performed.
CI was still running at the publication checkpoint. Wait for external completion
without repeated unchanged polling before any protected merge decision.

Independent [PR #928](https://github.com/mekhovov/revealline/pull/928) is now at
`17ca14565d1594e94d3c59bc9ee96b216a497853`. Its source-cap failure was reproduced
and fixed by reusing the stack's exact minimal Academy wordmark scoping change
(`72b508f53`), preserving the wordmark in World Studio and all package limits.
The corrected main-based candidate passed all three admissions, committed inputs,
ZIP members and two identical builds. Evidence remains in
`/tmp/fpv-radio-menu-20261002/.cache/tx15-optional-corrected/`; envelope SHA-256
`a0937caf8cbb98fe36803a9417be9d25a6774f6f4d2f7348f90b02a2fd297411`.
Remote CI is pending; the earlier release-ready failure belonged to a cancelled,
superseded run. No release policy/version change was made. Full lobby and new
physical-radio acceptance remain unverified.

Continue independent R4/R5 art and R6 demonstration/ghost/practice work while
publication runs. Integrate #922's dynamic reimport modal navigation during the
coordinated main refresh, as noted above. Additional unit coverage and remaining
human/device acceptance stay in R7.

## Motion teaching feedback — 2 October 2026

Development branch `codex/fpv-motion-teaching` starts from #929 at
`00e7008d89de32400f93108c5f02894d26fd6f89`. The parent remains open and its observed
optional-practice, candidate and release-ready checks succeeded. Native #902
membership remains linear through #929; existing holds are preserved.

Implemented this feedback as a separate increment: full-travel, both-direction
looping examples at explicit 0.2× teaching speed; automatic deliberate
keyboard/touch/calibrated-radio takeover; independent illustrative motor demand
and propeller phases; true-position moving ground/height; and peripheral compact
flight aids in World Studio and Academy. Expanded learning remains available.
See `fpv-motion-teaching.md` for the command-mix convention and limitations.

Functional evidence before packaging:

- Actual browser: 15 teaching checks, including all eight mode/axis examples,
  looping, touch/keyboard/radio ownership, reduced motion, and guide reentry with
  held inputs. A synthetic pointer endpoint was corrected after its first
  fractional-coordinate assertion failed; the final run passes all 15.
- Actual browser: 25 shared diagram checks for six torque signs, all four
  propeller outputs, phase/pause/seek/replay, ground movement, height, full
  inversion, compact isolation and disposal.
- Actual World Studio host: 16 checks with controlled TX15-shaped Gamepad data
  and keyboard events. Verified profile restoration while Keyboard is selected,
  no takeover from rest/jitter, deliberate takeover, no real-lesson mutation,
  disconnect/reconnect pause, menu handoff, and keyboard takeoff after preview.
- All 14 primary Acro lessons complete and independently replay with zero
  contacts and full health. The integrator, scoring and recorded inputs are
  unchanged.
- Desktop, 700 px and 390 px browser layout inspection: compact diagram128×96,
  passive gimbals50 px, touch96 px on mobile, no document horizontal overflow.
  Mobile telemetry has its own bottom strip. Fullscreen entry/exit and explicit
  pause remain functional. No physical device performance or user acceptance
  inferred from browser viewport inspection.
- Targeted ESLint, syntax and formatting checks passed. New unit coverage
  remains deferred to R7. Receipts: `docs/evidence/fpv-motion-*-20261002.json`.

Next gate: freeze committed inputs, admit all three optional packages, rebuild
and launch the reviewed-player URL, then publish a focused native-stack child of
#929. This checkpoint does not claim public deployment or physical-radio
acceptance. Preserve #928, #922, #889, graphics WIP and Garage/ghost handoffs.

### Frozen motion-teaching candidate

Runtime source `cbed6e7e8c5509e2464403c6c43dff6f2f44f683` passed all three
optional-package admissions, committed-input verification, two byte-identical
builds and ZIP-member verification. Receipt:
`docs/evidence/fpv-motion-package-20261002.json`; envelope SHA-256
`2405001ddde11227d245911a2035ab7e8f8c15b62a9b6b5d10de367b085dda80`.
Academy remains 62 runtime/64 source files; World Studio94/96. Limits unchanged.

The reviewed-player build was rebuilt and launched at
`http://127.0.0.1:8789/dist/fpv-reviewed-player-playtest/optional-practice/fpv-worlds/index.html#learn`.
Its ZIP contains87 files /12,473,373 bytes; SHA-256
`8ba1156d0105987be317e9d52289227cf4f54c5f70708b4d3de55fe3aa191e05`.
The final packaged guide visibly showed full −100% pitch, moving ground, real
height and differentiated motor demands; keyboard takeover and Replay example
were verified through its UI. Browser error log was empty. This is a local
player build, not a public deployment. Screenshots were captured locally as
`/tmp/fpv-motion-learning-final.png`.

Publish this frozen increment as a native #902 child of #929; subsequent
checkpoint/evidence-only commits do not change the frozen runtime. Continue
independent R4/R5 art and R6 demonstration/ghost/practice delivery while external
checks run. Keep existing holds, #922 reimport navigation integration and the
R7 deferred unit/human/device qualification backlog intact.

### Motion-teaching publication

[PR #932](https://github.com/mekhovov/revealline/pull/932) is published from
`codex/fpv-motion-teaching`, attached to this chat, and appended with the native
stack API to #902 after #929. Live open order at append:
#905 → #907 → #923 → #924 → #925 → #926 → #929 → #932.
No rebase, manual retarget, hold removal, merge bypass or release-authority
change was used. The frozen runtime remains `cbed6e7e8`; the next commits only
record qualification and publication. The PR retains milestone
`v0.150.0 — Unified native experience`.

Source and rebuilt reviewed-player URL are available for local testing. The
player's prior USB-radio preference was restored after touch layout inspection;
the final guide remains open. A compact touch-flight screenshot is also saved at
`/tmp/fpv-motion-flight-final.png`. Public merge/deployment and exact-head CI are
external pending gates, not new live-availability claims. Do not repeatedly poll
unchanged checks. Next independent work remains the approved R4/R5 art foundation
and R6 demonstrations/ghost/practice flow; read live stack membership before any
coordinated refresh and preserve the creator-data and original-content holds.

## Continuous lab practice and dedicated fullscreen — 2 October 2026

Current branch `codex/fpv-endless-practice` starts at #932's exact remote head
`6cebb1eaac5a7d1fe4788a153260751bfa1c5e29`. Parent source/admission/candidate
checks passed; it remains open in native #902. Open membership is still
#905 → #907 → #923 → #924 → #925 → #926 → #929 → #932. Existing holds remain.

Implemented the player's latest request as a focused child: manual lab flight
no longer stops at contact, after one minute, or at the underlying 12-minute
scored-attempt cap. Only the isolated unscored runtime bypasses expiry; it cannot
create proof bytes. Scored flight identities, physics, expiry, rewards and
recording limits are unchanged. The lab volume is ±80 m horizontally / 0–80 m
vertically. Reset during active practice continues immediately.

Fullscreen practice centres the enlarged rear-follow schematic, adds wider
ground/horizon, moves gimbals to lower corners and hides verbose explanations.
EN/UK controls, native fullscreen and a full-window fallback remain available.
Back restores the inline guide paused, preserves pre-existing app fullscreen,
and leaves the real lesson untouched. Async completion cannot override a newer
pause, focus change, session or disposal. See `fpv-endless-practice.md`.

Functional qualification on the frozen candidate inputs before package build:

- 14 actual-browser coach checks, including 39,100 simulated ticks / 782 seconds,
  ceiling/ground contacts, reset, mode transitions, disconnection, focus loss,
  delayed fullscreen rejection, explicit pause ownership and disposal.
- 19 production-host browser checks with controlled TX15-shaped Gamepad input
  and keyboard events: source ownership, fullscreen isolation, normal flight
  state preservation and actual keyboard takeoff after preview.
- 27 model checks: both modes exceed 13 minutes only when unscored; default
  expiry/identity/snapshots match parent and all 24 original proofs replay.
- All 14 primary Acro demonstrations complete and independently replay with
  zero contacts and full health.
- 16 actual-browser shared diagram checks including 1,200 quaternion poses,
  movement/height signs, expanded ground and unchanged compact/inline output.
- Desktop, portrait and short landscape inspected; final Ukrainian portrait
  390×844 has no document horizontal overflow, complete drone, corner controls
  and visible Back/Pause/Reset/Replay. Native permission denial was explicitly
  simulated in an ignored fixture; fallback works. A cropped peripheral height
  label was hidden on narrow screens; telemetry retains actual height.
- Targeted syntax, ESLint, formatting and diff checks pass. No new unit coverage,
  physical-radio, novice-player or sustained hardware performance claim.

Receipts: `docs/evidence/fpv-endless-*-20261002.json`. Next: committed-input
package admission, rebuild/launch the reviewed-player URL, and publish a focused
native #902 child of #932. Preserve #928, #922, #889, graphics WIP and Garage/ghost
handoffs. The R4/R5 art and R6 demonstration/practice backlog and R7 deferred unit
and human/device qualification remain independent next work. No public-live claim.

### Frozen continuous-practice candidate

Runtime source `0fe2bc45ae41d7ccfd691623573142cb0476e6e2` passed all three
optional-package admissions, committed-input verification, ZIP-member verification
and two byte-identical builds. Receipt:
`docs/evidence/fpv-endless-package-20261002.json`; envelope SHA-256
`be2c01f3d228eb5501a2a276e875cc4068261f88ed088489702b230acf3883aa`.
Academy remains62 runtime/64 source files; World Studio94/96. Limits unchanged.

Rebuilt and launched the actual reviewed-player URL:
`http://127.0.0.1:8789/dist/fpv-reviewed-player-playtest/optional-practice/fpv-worlds/index.html#learn`.
ZIP:87 files /12,490,158 bytes; SHA-256
`cca1bd53aceef4d2163561226968f1dfe9c11a1d631c8ad18c3e836c96fe4310`.
The packaged view visibly centres the large drone over extended ground, accepts
keyboard takeover and shows “no time limit”; Reset continues active practice.
Browser error log is empty. Final screenshot: `/tmp/fpv-endless-practice-final.png`;
Ukrainian mobile screenshot: `/tmp/fpv-endless-practice-mobile-uk.png`.

Source-browser checks also verified that a pre-existing application fullscreen
session survives entering/leaving dedicated practice. The inspected in-app browser
reported `document.fullscreenElement` absent and used the full-window fallback;
this is not a new native OS-fullscreen permission certification. Native-event
lifecycle is covered by the controlled fixture. Hardware/radio acceptance and
public deployment remain unclaimed.

The runtime is now frozen; subsequent documentation/evidence-only commits record
publication. Publish as native #902 child of #932. Continue independent approved
art/content work while exact-head CI and held-stack review remain external gates.

### Continuous-practice publication

[PR #934](https://github.com/mekhovov/revealline/pull/934) is published from
`codex/fpv-endless-practice`, attached to this chat, and appended to native #902
after #932 using the stack API. The open sequence is now
#905 → #907 → #923 → #924 → #925 → #926 → #929 → #932 → #934.
No rebase, manual retarget, hold removal, global policy change or merge bypass
was used. Runtime source remains `0fe2bc45a`; later commits contain only delivery
and qualification documentation. The scheduled milestone remains
`v0.150.0 — Unified native experience`.

The rebuilt reviewed-player tab is left open in dedicated practice with keyboard
takeover and active Reset verified. Existing USB-radio flight preference is
preserved. Local source and packaged playtest are ready for player feedback.
Exact-head CI, protected merge and public deployment are pending external gates;
no public live claim is made. Do not repeatedly poll unchanged checks. Read the
latest stack state before the next increment and continue the approved R4/R5
art/environment and R6 demonstration/ghost/practice backlog independently.

## 2 October — lesson/example alignment and display response

Player feedback exposed a curriculum mismatch: the lab's generic fallback
mapped every combined-control step to pitch and ignored step direction. The
focused child `codex/fpv-lesson-preview-response` starts at exact #934 head
`f8e3f170cdba36676bb5656d48accae56f5bd3ad`. Live native #902 membership was read;
its existing open chain remains #905 → #907 → #923 → #924 → #925 → #926 → #929 →
#932 → #934. Parent exact-head checks are successful/skipped; upstream review
holds and protected merge rules remain in force.

The new helper uses actual command-driven examples for each of 122 learning
steps across 26 lessons. Direction, task, initial/target heading, landing,
braking and lateral gate alignment now follow the lesson metadata. The original
first-lesson full-range explorer remains; other examples are clearly labelled
control techniques rather than full-route proof playback. Both EN/UK include
phase captions, including fullscreen. Independent review corrected stale ground,
climb/descent, recovery, gate-alignment and figure-eight hints. All 26 course and
pack identities remain unchanged and all 14 bundled Acro proofs replay. The
12 optional self-level lessons still lack bundled full-route proofs.

Responsiveness work samples active radio input within the lab frame, displays
current commands without waiting for the next physics tick, avoids repeated
state clones and skips covered WebGL/HUD rendering. Shared SVG geometry and
unchanged values are cached; actual quaternion/position changes remain immediate.
Gray prop surrounds and default percentages are removed, with cyan demand arcs
and independent readable prop speeds retained. The Gentle integrator and scored
recording contract are unchanged. See `fpv-lesson-preview-response.md`.

Local functional checks include all 122 physical technique profiles, 13 browser
checks spanning the curriculum and live-input layouts, 13 shared propeller checks,
14 prolonged-practice/lifecycle checks and 19 production-host checks with
controlled inputs. Final source-bound receipts, alternating component benchmark,
committed-input package admissions and rebuilt-player inspection follow below.
No unit-coverage, physical-radio, novice-player, native permission, public-live
or sustained target-hardware performance claim is made.

This player-feedback correction is inserted before the independent R4/R5 art
and R6 content backlog; R7 still owns deferred unit coverage and final human /
hardware qualification. Next: freeze the verified increment, attach a focused
native #902 child of #934 and leave upstream holds intact. Preserve #928, #922,
#889, graphics WIP and Garage/ghost handoffs. Do not poll unchanged external CI.

### Visualization measurement and curriculum receipts

Final all-step browser receipt passes **14/14 checks and122/122 steps**, including
EN/UK fullscreen phase captions and Modes1–4. All122 actual-model technique
checks pass; preparation peaks at295 of the500 permitted ticks. Lesson9's left
example reaches north from east and counter-rolls to level. The shared component
has13/13 browser checks, including immediate pose/input changes, zero SVG writes
for100 repeated identical frames, and a visible4× phase-speed difference between
20% and80% illustrative motor demand. Full lesson isolation remains intact.

Final alternating component benchmark: Codex in-app browser reporting
Chrome154.0.0.0 on macOS, viewport1002×1309, DPR2; eight workloads,32 ABBA runs,
96 measured samples per baseline/candidate workload. Mean combined coach script
cost fell from0.517 to0.411ms inline (20.4%) and0.585 to0.485ms immersive (17.1%).
Unchanged-frame SVG work fell96–97%; stationary geometry with advancing props
fell51–62%. Fully moving isolated diagram costs were approximately unchanged
inline (0.310→0.315ms) and increased0.037ms immersive (0.370→0.407ms).
RAF p95 remained9.3–9.9ms; no measured frames exceeded25ms. This is a bounded
component measurement, not physical-input latency or desktop/mobile device
qualification. Covered-world rendering savings are not included in these numbers.

Receipts: `docs/evidence/fpv-response-{lesson-audit,identity-replay,step-model,
lessons-browser,propeller-browser,endless-browser,host-browser,browser-benchmark}-20261002.*`.
The full-range explorer remains visibly slow by design; manual inputs always run
at normal speed. No change to actual physics, rates, response curves or proofs.

### Frozen package and rebuilt player

Runtime candidate `f1b8f65a82c84374a709bce4e414d1b351d41f51` passed all three
optional-package admissions, committed-input validation, ZIP-member validation
and two byte-identical builds. See `fpv-response-package-20261002.json`.
Existing package file limits are unchanged (Academy62 runtime/64 source;
World Studio94/96). The reviewed-player build has87 files /12,510,913 bytes;
ZIP SHA-256 `8e99fe737fe02921a4312c5fda5f21e837aea0d0b7b02205927d3091b4e70f7f`.

Opened the actual rebuilt player URL, selected lesson9 / step4, inspected the
corrected left-turn phase, bare props and cyan motor arcs, entered fullscreen
practice, and confirmed keyboard takeover reports continuous manual control.
Browser error log is empty. EN/UK phase captions are visible in the full-window
practice view. At390×844 the Ukrainian toolbar has four44px targets within the
viewport, its phase/status remains visible, and there is no horizontal document
overflow. The in-app screenshot capture scales that mobile tab inconsistently;
mobile bounds are DOM-verified, not a new native-device screenshot certification.
Desktop evidence: `/tmp/fpv-lesson-response-final-fullscreen.png`.

No new native OS-fullscreen permission or physical-radio acceptance is claimed;
controlled lifecycle/controller evidence and the full-window fallback pass.
The player entry is local, not publicly deployed:
`http://127.0.0.1:8789/dist/fpv-reviewed-player-playtest/optional-practice/fpv-worlds/index.html#learn`.
The user's prior USB-radio source and English locale are preserved. Subsequent
commits only record delivery evidence and publication status.

### Lesson-preview response publication

[PR #935](https://github.com/mekhovov/revealline/pull/935) is published from
`codex/fpv-lesson-preview-response`, attached to this chat and appended through
the native stack #902 API after #934. Initial published head is
`822588858dbf91a327891ad9a35919621a0bc409`; runtime remains frozen at`f1b8f65a8`.
The open stack sequence now ends #929 → #932 → #934 → #935. No rebase, manual
retarget, hold removal or merge bypass was used. Milestone remains
`v0.150.0 — Unified native experience`.

The actual rebuilt player tab is left on the corrected lesson9 left-turn lab;
Replay example starts its loop and any deliberate input takes over indefinitely.
Focus-loss pauses remain intentional. The source and packaged local player are
available for feedback. Exact-head CI, protected stack merge and subsequent
public deployment remain external gates; retain them for the next delivery
checkpoint instead of repeatedly polling. Continue independent R4/R5 environment
art and R6 remaining demonstrations/practice flow, preserving other handoffs.

## Continuous whole-lesson lab and larger props — 2 October 2026

Current feature branch `codex/fpv-continuous-school` follows #935 at
`805f55776750023c3bd74cbe87dbff583557316c`. Native stack #902 was re-read and
still ends #929 → #932 → #934 → #935; existing holds remain in force.

All26 school lessons now use a complete verified demonstration in the lab,
automatically changing instructions at actual objective transitions without
resetting the drone between steps. Whole lessons loop at the end; individual
step selection reconstructs its exact command prefix. Keyboard/touch/calibrated
radio takeover retains the current flight, and real objective completion advances
practice instructions automatically. Final completion leaves indefinite free
practice. This is explicitly unscored and cannot create a proof; a fresh recorded
lesson remains separate. Added12 self-level recordings; all prior proof bytes and
course identities remain unchanged.

The rear-view schematic now has large three-blade10-inch proportions and a slim
central body, retaining independent props and cyan demand arcs. Position-aware
practice cues show the actual target with distance and height. Fullscreen keeps
the automatically changing step number, title and instructions visible. Actual
player verification caught and fixed initialization order and keyboard focus
before publication.

Evidence under `docs/evidence/fpv-continuous-*`: all26/122 objective boundaries;
21,875 exact ordinary/practice state comparisons; free practice through39,100ticks
and recorder rejection; all46 prior bundled v2 proofs still replay;12 self-level
proofs reproduced identically by the maintained offline authoring pilot;
55/55 actual-browser whole-lesson/seek/takeover checks and18/18 geometry/target
checks. Initial measured maximum open/seek costs were30.1/27ms on this in-app
browser, not physical input latency or target-device performance. EN/UK packaged
player and responsive fullscreen instructions were inspected. Additional unit
coverage remains deferred.

The expanded [school plan](fpv-mastery-school-plan.md) defines32 new lessons:
16 current-objective navigation/precision lessons, followed by16 Pro/Master
lessons requiring versioned rotation/trajectory criteria and verified recordings.
Their drafts are prepared separately in `/tmp`; do not mix them into this ready
continuous-lab PR. Next increment starts a separate dependent branch after this
feature's publication. Preserve #928, #922, #889 and art/demonstration handoffs.

Local disk exhaustion was resolved by removing30 reproducible temporary source/
distribution ZIPs from five older `/tmp/fpv-*-final-20261002` candidates, reclaiming
164,540,751bytes. All manifests, hashes, source inventories, admission receipts,
source trees and player builds were retained. No player content or unrelated
work was removed. Public deployment is not claimed by this local verification.

### Frozen continuous-lab package

Runtime `b102350083203ac6f0f612b80c0e09eb085816ae` passes all three package
admissions, committed-input and ZIP-member checks, and two byte-identical builds;
receipt `docs/evidence/fpv-continuous-package-20261002.json`. File caps remain
unchanged. The actual rebuilt local player is87 files /12,680,675bytes,
ZIP SHA-256 `bf4312b51e84a447a5a04d1394eee9d3487336c938af998621b3d2f5a838d307`.
The reviewed-player URL is rebuilt from the same frozen runtime. Public merge
and deployment remain separate protected gates.

### 2 October — continuous school published for review

- Focused PR [#938](https://github.com/mekhovov/revealline/pull/938) published from `codex/fpv-continuous-school`, runtime `b102350083203ac6f0f612b80c0e09eb085816ae`, qualified receipt head `e71bf713e4f8502c8fd556397aad2c789713a58f`.
- Attached to this chat and appended through the native API to stack #902 directly after #935. Upstream holds and protections remain; this is review publication, not verified public deployment.
- The user’s `dist/fpv-reviewed-player-playtest` local entry and `dist/fpv-continuous-school-playtest` contain the qualified package recorded above.
- Next independent increment: 16 distinct Experienced/Advanced navigation and precision lessons, tier navigation and exact replay demonstrations, on `codex/fpv-navigation-school`. Pro/Master criterion extensions remain separate until their authored demonstrations qualify.

### 2 October — navigation school qualification

On `codex/fpv-navigation-school`, added16 authored Experienced/Advanced lessons,
137 new steps and16 complete recordings. School42/259; primary Acro30 plus12
optional self-level; full catalogue102. Corrected route/description discrepancies
found in review, regenerated only the new content identities/proof envelopes and
verified original26 identities and all prior recording bytes remain unchanged.
Final new pack: `fpv-navigation-school:5c31fce0b5a82b98`.

Model evidence:16/16 complete, zero contacts/full health, independent exact replay
and byte-identical regeneration by the maintained pilot. Browser evidence87/87
continuous lesson checks and12/12 production tier/menu checks, including exact
revision progress, Continue beyond beginner, EN/UK and fullscreen isolation. A
real duplicate tab-focus call was removed; the subsequent iframe-only history
failure was corrected in the ignored verification harness using a real URL.
No production history behavior was bypassed. Final observed max open42.6ms / seek
40.2ms are local operation samples, not physical latency or target-device targets.

The first16 new navigation lessons are ready for a focused package/PR. The next16
Pro/Master drafts remain separate and held for criterion-envelope tightening and
host/editor/renderer qualification. No unit coverage or human acceptance claim.
A further12 reproducible audio/graphics candidate ZIPs were removed to reclaim
65,264,954bytes; all manifests, source, proofs and evidence remain preserved.

Frozen navigation runtime `7240eda1bd2c57416fffbf0f2e4f73e6996ed0ec`
passes all three package admissions, committed inputs, ZIP membership and two
byte-identical builds. Receipt: `docs/evidence/fpv-navigation-package-20261002.json`.
The separate local player is87 files/13,246,555bytes with ZIP SHA-256
`0b6459a262c90f713d97a983943895121b3967dc5a67cdb323f5aa1cff164fa4`.

Navigation school published in focused PR [#939](https://github.com/mekhovov/revealline/pull/939),
attached to this chat and appended to native stack #902 directly after #938.
Qualified receipt head `b80425d55`; upstream review/protection holds retained.
Next branch: `codex/fpv-pro-mastery-school`, containing only the skill criteria,
Pro/Master lessons and required presentation/editor adapters after they qualify.

### 2 October — Pro/Master course verified locally

On `codex/fpv-pro-mastery-school`, added16 distinct Pro/Master lessons and115
steps, bringing the school to58/374 (46 primary Acro plus12 optional self-level)
and the full catalogue to118. New pack `fpv-skills-school:ccdbc4f61adad55a`.
Four versioned criteria measure real rotations, attitudes, spatial paths and
nose/velocity-qualified crossings. Hints, drawn targets, editor translation,
reimport and generic imported-course Acro selection follow those contracts.
A review corrected misleading nose-first copy for the90° upward-pop tolerance.

All90 v2 and24 legacy v1 proofs replay; previous74 proof rows,42 course identities
and121,178 legacy snapshots survive. All16 authored flights regenerate exactly
from35,045 ordinary frames, zero contacts. Final actual-browser evidence:
119/119 continuous58-lesson checks,14/14 tier checks and70/70 integrated host
checks including all new Fly/School/playlist entries, EN/UK, exact export,
creator pack import, backup and fresh-host proof retention. Geometry14/schema20
checks and16,734 localized feedback samples also pass. Local maximum synchronous
coach preparation93.5ms / last-step seek90.5ms are operation observations, not
physical input latency or sustained hardware performance.

Browser verification initially encountered disk exhaustion and fixture-only
cross-realm IndexedDB/plain-object and JSON key-order comparisons. Corrected the
fixture's native iframe storage and canonical comparison; did not loosen runtime
validation. Retained failure diagnostics under `/tmp`. Removed12 reproducible
continuous/navigation candidate ZIPs (67,855,450bytes) and13 obsolete generated
playtest ZIPs (139,323,314bytes), preserving all unpacked players, sources,
proofs, inventories and receipts. No user storage or unrelated work was deleted.

Focused runtime freeze/package admission and PR publication follow. Preserve
native stack902 linearity, upstream holds, stack889 and all unrelated handoffs.
Unit coverage, novice/fluent-UK acceptance, real TX15/controller qualification and
named-device performance remain outstanding; no public-live claim.

Frozen Pro/Master runtime `e1db800b440bf9cc90d3c9229f4b36fff1ac5440`
passes all three optional package admissions, committed input/ZIP membership and
two byte-identical builds. Receipt `docs/evidence/fpv-skills-package-20261002.json`.
The reviewed-player and skills-school local builds match:87 files/13,894,752bytes,
ZIP SHA `83b785dd5c4ad07b8615880a581597ed35926642694fc06934ce4168da3aed7f`.

### 2 October — Pro/Master published, player entry refreshed

Focused PR [#940](https://github.com/mekhovov/revealline/pull/940) is published
from `codex/fpv-pro-mastery-school`, qualified receipt head
`0ecb2469d07fd012403ebfbbd3443a5c5ec13110`, attached to this chat and appended
through the native API to stack902 after #939. Live membership was inspected;
all older open members/holds remain, with #938 → #939 → #940 as the new tail.
No manual retarget, rebase, bypass or public-live claim.

Launched the user's rebuilt reviewed-player URL, verified58 available lessons,
46 primary progression and Pro/Master entries, and marked that browser tab as the
player deliverable. Actual fullscreen orbit practice was visually inspected;
image `/tmp/fpv-mastery-immersive-practice.png`. Player catalogue image:
`/tmp/fpv-expanded-school-20261002.png`. The authoring code, local player builds
and PRs are ready for player review. Protected checks/merge and public deployment
identity plus launch remain pending separately. Do not equate local delivery
with public availability.

This request's continuous flow, larger10-inch schematic and32-lesson expansion
are implemented and functionally verified. Next concrete authorized work: inspect
current #925 graphics foundation and preserved radio-menu handoff before making
changes; continue R5 hangar/meadow environment/material polish on a separate
branch, preserving this completed school PR. Human novice sessions, fluent-UK
review, real controllers, sustained device measurements and R7 unit coverage are
still qualification work; do not fabricate them or block independent art work.

### 2 October — quieter motors and continuous readable stick cues

Focused branch `codex/fpv-readable-stick-motion` begins at #940 head
`963d55ab8475230d7bc9d32fc251770655067992`. The learning lab now uses constant
0.5× recorded playback across objectives, exact filled example markers and an
explicitly separate 80 ms hollow motion guide. Both SIM hosts share a bounded
450 ms input trail with an origin ring and latest-direction chevron. Small
counter-movements preserve their direction without amplifying input. Motor arcs
are thinner and dimmer; cyan live input stays unsmoothed. Academy diagrams are
outside its former 100 ms text-HUD throttle. See `fpv-readable-stick-motion.md`.

Current browser receipts in `docs/evidence/fpv-stick-motion-*-20261002.json`:
69/69 focused checks including all58 exact lesson replays and8 locale/layout
combinations;119/119 complete lesson/takeover/manual-progression checks;4/4 actual
Academy/World input-host checks with real renderer preparation. Synthetic key
changes reached observed host dots in9.6–32.5 ms in this local run; this is a
fixture observation, not physical-radio latency or sustained device performance.
Current receipt input hashes match the source. Focused lint, formatting, syntax
and diff checks pass; source review caught and corrected the short-reversal
arrow direction before the final browser rerun. No additional unit coverage or
new human/hardware qualification is claimed.

Disk pressure initially required removing7 task-generated reproducible candidate
ZIPs (47,825,325bytes):6 skills-final archives and1 reimport-playtest archive.
Source, unpacked players, proofs, manifests and receipts were retained; unrelated
radio/menu and graphics work is untouched. The host verification fixture needed
one escaped script terminator corrected before its successful run; production
validation was not weakened.

Native stack902 still ends #938 → #939 → #940; parent remote head unchanged.
Its current checks only show skipped unallocated-stage jobs, not passing merge
gates. Preserve all upstream holds and stack889. Next: freeze/package this
focused increment, rebuild both reviewed-player and continuous-school player
URLs, publish/attach its child PR and append through the native API. Public
availability still requires protected merge, deployment identity and actual
public launch. The remaining R4–R7 art/qualification backlog is unchanged.

Frozen runtime `21a5310a42ef520d3f788ec2d644fa464b9e2e86` passes all three
optional package admissions, committed inputs/ZIP membership and two byte-identical
builds; receipt `docs/evidence/fpv-stick-motion-package-20261002.json`.
Both local player URLs were rebuilt and launched with the new markers and58
lessons. Each has87 files/13,903,830bytes, ZIP SHA-256
`9f58693c11cff70aa2e904136b3fd23bec908af4f4603e659411634af98bf012`.
The source and built turning lesson were visually inspected; compact390px lesson
layout remains usable. Screenshot `/tmp/fpv-readable-stick-motion-20261002.png`.
No public-live or new hardware acceptance claim. Ready for focused publication.

### 2 October — stick-motion refinement published

Focused PR [#941](https://github.com/mekhovov/revealline/pull/941) is attached to
this chat and appended through the native API to stack902 after #940. Qualified
receipt head: `477d6146cae5b8f951a73cf99d3a42b24cf7b071`; runtime remains the
frozen21a5310a build above. Live membership now shows #905 and #907 merged at
02:54 and03:04 UTC respectively. Open members start #923 and continue linearly
through #941; preserve all remaining review/protection requirements.

At receipt head477d6146, candidate workflow36959354936 has optional-practice
SUCCESS, with default-capacity/candidate still running. Unallocated-stage jobs
are skipped. This is not complete merge qualification; retain external CI state
for the next delivery heartbeat rather than polling unchanged jobs. No protected
merge or public deployment of this increment was attempted or claimed.

The current request is complete locally and published for review. Next authorized
independent work remains R5 hangar/meadow art, after reconciling #925 and the
preserved radio-menu work. Keep new feature changes off this finished PR.

### 2 October — handheld flight and controller increment qualified

Current focused branch `codex/fpv-handheld-flight` begins at #941 head
`130f80f5bbeebf60620b2d1e346eea4e58c975db`. Runtime commit
`ad75299b528d082dd754233de25bccbae6be882a` makes both SIM hosts flight-first on
phones/handhelds: compact edge HUD, touch corners, paused menu, explicit return
without arming. Standard controllers support arm, reset, pause, all flight axes,
D-pad/shoulder fallbacks and World fire; the learning lab supports safe takeover.
Current-neutral UI arming and immediate post-Arm input were checked and corrected.
See `docs/fpv-handheld-flight.md` for mapping, references and limits.

Browser evidence under `docs/evidence/fpv-handheld-*`:96 actual-host layout checks,
24 actual-host controller checks,18 adapter checks,13 preview checks and119 full
school continuity checks pass. Samples/media queries are controlled; no new
physical iPhone/WKWebView, Steam Deck or radio acceptance and no new unit coverage.
The handheld package candidate passes all3 admissions, committed inputs/ZIPs and
2 identical builds, with62 Academy /94 World runtime files. Frozen candidate:
`/tmp/fpv-handheld-final-20261002`. Existing limits and gameplay contracts remain.

Landing entry work remains separate in17 uncommitted game files. The candidate
builder requires a clean whole tree, so those owned edits were snapshotted and
restored byte-for-byte around qualification. Recovery stash
`74adcf08ef4dd80c3f7c431ed3c37e01ad21fefc` remains; preservation receipt is
`/tmp/fpv-handheld-source-preservation-20261002.json`. No unrelated edits changed.
First candidate attempt correctly rejected a dirty tree; no check was bypassed.

Next: publish/attach this focused PR after #941 in native stack902, then complete
the separately reviewed fourth FPV SIM landing choice on a child branch. Keep
older native stack holds/protections and remaining R5–R7 work intact. Public
availability remains conditional on permitted merge, deployment identity and
actual public launch; these local receipts do not claim live deployment.

### 2 October — handheld/controller PR published

[#942](https://github.com/mekhovov/revealline/pull/942) is attached and appended
through the native API to stack902 after #941. No stack member was retargeted or
rebased. Both local player URLs were rebuilt with87 files/13,948,137bytes and ZIP
SHA `e49c8364280ddb87134769274447aa29795013cf260e765bdbedfc1d32dee843`.
The existing source Academy entry also has the handheld UI and controller adapter.
CI/merge/public deployment remain separate from these local results.

Next branch `codex/fpv-sim-mode-entry` carries only the completed landing change:
Solo / Versus / Team / FPV SIM, same-build World Studio availability and the
existing validated optional-package fallback. Initial browser checks found a
fixture readiness/focus cascade; the isolated repeated Versus390 rerun passes6/6
without production changes, and the full12 host/locale/width pass succeeds.
A final same-window controller launch is being qualified to avoid popup permission
requirements. Keep this work separate from the ready #942 runtime.

### 2 October — fourth SIM landing destination qualified

Current branch `codex/fpv-sim-mode-entry` depends on #942 head
`23c790154dfe35f11c4c7a7b239c7c8ead61c03a`. Frozen runtime
`e936e94f91e96286a9f6ebc28f5d91758095218e` adds the fourth shared landing
choice after Solo / Versus / Team, bounded bundled-World availability, validated
package fallback and same-window controller launch. The browser walkthrough
caught a real locale mismatch; explicit EN/UK launch preferences now reach the
World catalogue and user language changes persist in that URL.

Final evidence: `docs/evidence/fpv-sim-entry-final-20261002.json`, paired EN/UK
controller receipts and package receipt. Main build passes (2,719 files; SHA
`2750c1df69f5fd147648a4b82065d315052679a8a83eacf0855233a2c43e0ca4`), with all15
changed emitted runtime files matching frozen source. All3 optional packages pass
admission, committed inputs/ZIP members and2 identical builds. The builder's
main manifest has its normal null revision; the separate receipt records the
clean frozen commit and exact byte comparison rather than inventing a stamp.

Browser menu checks pass12/12 (3 hosts ×2 locales ×2 widths), controller-only
launch passes2/2 EN/UK, existing targeted assertions62, functional boundaries28,
locale scan and focused lint/format/syntax pass. Independent source review found
no new blocker; legacy fallback links retain their separate new-window behavior.
No new unit coverage or physical-device qualification is claimed.

Both local player paths were rebuilt with87 files/13,948,767bytes, ZIP SHA
`2c3acf4cc67c49b67a7e1bec084a6e2d8b0403cd3a8f5841b9e37eb514fc87a6`.
The actual continuous-school player was launched at390×844; the flight view and
paused menu were inspected. Screenshot `/tmp/fpv-handheld-player-final-20261002.png`.
No public-live claim. Ready to publish a focused child after #942 in native
stack902. Next independent authorized work remains R5 hangar/meadow art after
reconciling #925 and preserved radio-menu work; keep that unfinished work off
this completed landing PR. All upstream holds/protection and stack889 remain.

### 2 October — SIM landing PR published

Focused [#943](https://github.com/mekhovov/revealline/pull/943) is attached to this
chat and appended through the native API to stack902 after #942. Published
qualification head is `a8913009078022b285050612299725aaa6a2e4d1`; frozen runtime
remains e936e94 above. No member was manually retargeted, rebased or dissolved.
The live stack API now reports #923, #924 and #925 closed and open membership
starting at #926 through #943. Reconcile their merge identities before future
R5 work; do not infer public deployment from closed state.

#942's last exact-head snapshot at23c7901 remains OPEN/UNKNOWN with no listed
checks. #943 CI and publication are external follow-up; neither PR is called
merge-ready or public-live. Preserve all applicable checks, reviews and holds.
The actual refreshed player remains open safely paused; temporary viewport sizing
was reset. Additional unit coverage stays in R7, physical handheld/controller
acceptance remains unclaimed. The requested handheld/controller/landing increment
is complete locally and published for review; keep further R5 work separate.

### 2 October — lesson step input reset corrected

Current branch `codex/fpv-step-input-continuity` starts from #943 head
`41c49e73e1799486927c317e64e16431f72e1049`; no upstream edits were present or
changed. The reported lesson09 step1→2 transition retains49.3% throttle in the
recording, but pausePreview/paintLab replaced its presentation with0%. The coach
now derives example input from the actual last applied command through pauses
and explicit step selection. Manual input safety and all proof commands remain.

Production-browser evidence passes120/120 cases over58 lessons,316 natural
boundaries and316 manual seeks, including frozen SVG/readout equality, resume,
EN/UK and keyboard/radio safety. All58 canonical final proof identities pass.
See `docs/fpv-step-input-continuity.md` and its browser receipt. Focused lint,
format/syntax and independent read-only review pass. Unit coverage stays in R7.

The continuous-school local player is rebuilt:87 files/13,949,386bytes, ZIP SHA
`ee5a48f780c40db728c784b5dc7d8b77cbca4ce460e584c15999fc3cd926fb40`.
Actual turning-lesson step2 now shows49% while paused. Next: frozen optional
package qualification, refresh reviewed-player too, and publish a focused child
PR after #943 through native stack902. Preserve existing holds and external CI;
no public-live or new hardware claim. Other R5–R7 work remains separate.

Frozen runtime `a4df52c790e3c41449a3f0a48be235e8a9edf48d` passes all3 optional
package admissions, committed inputs/ZIP verification and2 byte-identical builds.
Receipt: `docs/evidence/fpv-step-boundary-package-20261002.json`. Both local player
paths now share the87-file/13,949,386-byte build and SHA above. The actual built
turning lesson's paused second step was inspected with49% retained; screenshot
`/tmp/fpv-step-input-continuity-20261002.png`. Ready for focused publication.

### 2 October — lesson continuity fix published

[#944](https://github.com/mekhovov/revealline/pull/944) is attached to this chat
and appended via the native API to stack902 after #943. Qualification head:
`674d88439da2d8e012b5e900d32b611beacca778`; frozen runtime remains a4df52c7.
No upstream member was retargeted or rebased. CI/merge/public availability remain
external follow-up; do not infer passing gates from skipped or absent checks.
The corrected player is left on the paused coordinated-turn lesson for review.
Next independent work remains the reviewed R5 art backlog, with physical-device
acceptance and R7 coverage still outstanding; preserve all older stack holds.

### 2 October — automatic radio calibration, Arm/Reset and retained profiles

Current feature branch: `codex/fpv-radio-guided-actions`, based on #944 at
`7821ffdec87971bb9b7a8e5ea298eed925c1786b`. Live stack902 still ends at #944;
no upstream ref was rewritten. The focused increment fixes EdgeTX paired-position
switch detection, promotes Arm/Reset into the guided flow, and advances stable
stick endpoints/rest positions without repeated clicks. A deliberate final
radio gesture confirms and saves. Both shared SIM hosts receive the feature.

The bounded multi-radio library preserves the original v1 key, automatically
restores an exact uniquely connected selected mapping, and retains other radios.
Backup/share JSON files, a saved-radio picker and removal are provided. Imports
are local drafts; no community mapping is automatically trusted or uploaded.
Research and player flow: `docs/fpv-radio-guided-actions.md`.

Verification: actual mounted-browser checks16/16, including one initial click
followed by the complete axis→Arm→Reset→save path; guide checks18/18; retained
library production-module checks31/31; existing focused regressions22/22.
Receipts: `docs/evidence/fpv-radio-{actions-browser,guide-browser,library}-20261002.json`.
Syntax/lint/format pass; extra unit coverage remains deferred. Browser setup
was inspected at desktop and390px with no horizontal overflow. Actual public
release and physical radio acceptance are not claimed. Next: freeze inputs,
qualify all optional packages, refresh both player URLs, publish after #944.

Frozen runtime `bb16ba61e9f0a0529cbf0438382f09494e33b15b` passes all3 optional
package admissions, committed inputs and ZIP members, with2 byte-identical
builds. Receipt: `docs/evidence/fpv-radio-package-20261002.json`. Limits remain
unchanged. Both reviewed-player and continuous-school builds are87 files,
13,986,906bytes, SHA
`d21ed535d784fb14df05cf7a685f53b68c5cd26bac1574c2f7a6fe70c824c405`.
Actual Academy and built World Studio setup launch successfully and show the
existing saved calibration without rewriting it. The desktop/mobile switch
cards and opaque scrolling header were inspected; no new hardware acceptance.
Stack902's current open members begin at #932 and end at #944. Publication is
ready as its next dependent member; upstream holds are preserved.

### 2 October — guided radio setup published

[#945](https://github.com/mekhovov/revealline/pull/945) is attached to this chat
and appended after #944 through native stack902's API. Qualification commit:
`6ed8c3b56817f826c2767ed86b3f21d531c3f79a`; frozen runtime stays bb16ba61e.
Both local playtests are current and the reviewed-player radio setup is left
open. CI, protected merging and public deployment remain external follow-up;
no upstream member was retargeted and no existing hold was lifted. Next: inspect
exact PR heads/checks before permitted protected publication, obtain physical
Arm/Reset acceptance, and continue the independent R5 art backlog. Preserve R7
unit-coverage deferral and all prior learning/content acceptance limitations.

### 2 October — eight-world environment art increment

Current feature branch: `codex/fpv-environment-art-pass`, based on #945 at
b49979e17. Runtime commit b1bea780a improves all eight world surfaces and
composition, uses theme appearance slots, enriches moving actor models and
preserves exact collision/physics/course identities. Repeated trusted static
scenery uses spatial GPU batches; creator scene hierarchies remain intact.
Projectile rendering has bounded pools and actor detail follows quality changes.

Final actual-WebGL comparison passes10/10 checks/432 renderer configurations;
actor quality, replay pose and projectile lifetime pass10/10; shared geometry
and material probes pass43/43. Six GLBs have zero core-validator errors/warnings;
the validator's unsupported instancing extension is separately exercised by the
pinned loader in actual WebGL. Syntax/lint/format pass. Extra unit coverage stays
in R7. No physical-device FPS or human art acceptance is claimed.

Both existing local player paths now contain the87-file/14,018,764-byte build,
SHA8ed4759ee6c6e215fc189c701a682631a6a89293d6ebb35249f19dc05f64ff0a.
Details and research: `docs/fpv-environment-art-pass.md`. Primary checkout's
parallel Industrial Workshop/Themes work remains preserved; a user-authorized
coordination request was sent and its semantic material/session contract read.
Do not replace its renderer/material files wholesale during integration.

Next: qualify frozen packages, complete packaged-player inspection, publish a
focused child of #945 in native stack902. Last inspected open stack begins at
#934 and ends at #945; #932 has merged. Do not retarget/rebase upstream members
or infer passing checks from #945's empty current check list. Afterwards continue
shared-theme integration and artist/device acceptance, preserving R7 deferral
and earlier course/reimport/content holds.

Frozen candidate bd77622f775eb6abb6c6bd23634e28740b7356ba passes all3
optional-package admissions, committed-input/ZIP-member verification and2
byte-identical builds; receipt `docs/evidence/fpv-environment-package-20261002.json`.
Package limits remain unchanged. Actual built Courtyard welcome demonstration
completed its existing24.1s recording without awarding player progress. Quality
and camera changes prepare successfully and leave playback safely paused; the
updated paving, facades and animated civilian appear in the built player.
Screenshot `/tmp/fpv-environment-quality-player-20261002.png`. No new radio,
physical-device or sustained-FPS acceptance is claimed.

### 2 October — environment art published

[#946](https://github.com/mekhovov/revealline/pull/946) is attached to this chat
and appended after #945 through native stack902's API. Qualification head was
d556c1f2b; frozen package candidate stays bd77622f7, with runtime b1bea780a.
The stack now starts at #935 after #934 merged independently. No upstream refs
were rewritten and no existing holds were lifted. PR checks, protected merging
and public deployment remain external follow-up; no public availability claim.

The user-authorized Themes handoff was sent with the focused PR, runtime commit,
material/appearance ownership boundaries and exact integration document. Both
local player URLs remain refreshed. The packaged courtyard demo is left safely
paused with the player's original Balanced/Chase preferences restored.
Next concrete work: shared-theme integration after the Themes handoff is ready,
then selected artist-authored material/landmark upgrades and named-device
performance/readability qualification. Preserve parallel primary-checkout work,
remaining original demonstrations/reimport holds and R7 coverage deferral.

### 2 October — World Adventures implementation and qualification

Current branch: `codex/fpv-world-adventures`, based on #946 at
`bcad075c21fb0e29d0b9b673d10c4218d293f1f1`. Six original worlds and 30 authored
challenges add coastal piers, quarry terraces, campus roofs, orchard avenues,
solar lanes and railworks. Catalogue:14 worlds/148 challenges. Real follow and
observation objectives use subject motion, range, relative speed, nose alignment
and collision line of sight. New courses have a separate pack identity;
original world/school course bytes and all four original curated playlists are
unchanged. Full detail and research: `docs/fpv-world-adventures.md`.

All60 new course/mode attempts complete with identical independent replay,
253,011 recorded ticks and zero contacts. Evidence and deterministic raw proof
archive are retained under docs/evidence and authoring/fpv-worlds/demonstrations.
These authoring proofs are not yet an installed player demonstration library.
Tracking20/20, new art38/38, retained art43/43, route/actor geometry60/60 and
actual actor-editor10/10 checks pass. Final actual WebGL qualification and
frozen package admission follow before publication. R7 additional unit coverage
remains deferred. No novice acceptance, physical-radio/Steam Deck/iPhone FPS,
sustained performance or public live availability is claimed.

Reconciled upstream state: native content stack889 is fully merged/closed;
reimport #922 and personal-best ghost #913 have merged. Earlier log holds for
those items are historical. This dependent branch still needs coordinated
upstream integration, preserving newer learning/radio/art work and the Garage
handoff. Installed original proofs here remain56 plus58 school proofs; the
original120 target is unchanged. Stack902 last inspected open membership was
939→940→941→942→943→944→945→946. No upstream refs were rewritten. Primary
checkout Themes/Industrial Workshop work remains untouched.

Next: complete frozen admission, refresh both existing local player builds,
publish after #946 and append through the native stack API. Then integrate the
merged content/ghost/reimport changes and ready Themes contract, followed by
artist-authored landmarks/materials and named-device/player acceptance. CI and
public publication stay separate from local functionality; inspect exact remote
heads and checks before any protected merge.

Frozen candidate `5daeb6b5b257f2eea689bf7a8720a9455406fded` passes all3
optional-package admissions, committed-input and ZIP-member verification and2
byte-identical builds. Receipt: `docs/evidence/fpv-adventures-package-20261002.json`.
Existing size/file limits remain unchanged. Final actual WebGL checks pass13/13
across270 course/preset/camera combinations with current fog/framing bytes.
Actual built coastal and rail-depot player launch, localized EN/UK catalogue and
mission briefings were inspected. Physical-device/mobile performance is not
inferred from desktop rendering.

Both existing reviewed-player and continuous-school paths now contain the87-file,
14,069,673-byte build, SHA
`1ca658410ee5e3ec22acb39720a949619c463b0bddd92658f33855a49a4e7880`.
The separate world-adventures playtest has identical bytes. Original touch,
self-level, Balanced and Chase settings are retained after inspection. Package
qualification is local; protected CI/merge and public availability remain pending.

### 2 October — World Adventures published

[#947](https://github.com/mekhovov/revealline/pull/947) is attached to this chat
and appended after #946 using native stack902's API. Qualification head:
`f792630d5486b63526e5c9378fbd7f05958c633e`; frozen runtime/package candidate:
`5daeb6b5b257f2eea689bf7a8720a9455406fded`. Current open membership starts at
#940 and ends at #947 after #939 merged independently. Upstream #941/#942 heads
also advanced during publication; preserve those remote changes and use the
coordinated leased workflow if a future cascading rebase is required.

Both existing player URLs are refreshed. Actual reviewed-player launch shows
14 worlds/148 challenges and the six new collections; its catalogue is left
open with original EN/Touch/Self-level/Balanced/Chase preferences restored.
Screenshot: `/tmp/fpv-adventures-player-catalogue-20261002.png`. The release
remains pending protected checks/merge/deployment; no public live claim.
Next concrete item: integrate merged content/reimport/ghost changes without
losing new school/control/art work, then apply the ready Themes appearance
contract and continue landmark/art/player qualification. Preserve the Garage
handoff and R7 unit-coverage deferral. Do not repeatedly poll unchanged CI.

## Approved continuation — checkpoint practice, 2 October 2026

The owner approved the reviewed A–H delivery sequence. Managed worktree
`fpv-world-framework/go_test` now uses `codex/fpv-checkpoint-practice`, based on
main `3616200cf87fe490dabc9fa75cd50e5019b85dfb`. Recovery branch
`codex/fpv-adventures-recovery-20261002` retains the old local Adventures head.
The primary checkout remains owned by the parallel Themes workstream. Native
stacks #889 and #902 are fully merged/closed; do not append to either.

A replaces fabricated checkpoint spawns with verified command-prefix restoration,
scoped unscored results, exact retry and original-route fallback. The full school
coach stays closed. Practice cannot create a proof or replace records, medals,
playlist progress or an interrupted attempt. Controller throttle survives the
ready-to-flight transition; response changes retain the recorded section and
radio source changes match the current frozen controls.

Evidence: `fpv-checkpoint-functional-verification.json` passes all 1,331 supported
positions (716 recorded restorations / 615 fallback positions), including all
four old collision failures. `fpv-checkpoint-browser-verification.json` passes
17 actual-host checks in Chromium, using isolated browser storage and controlled
keyboard/touch/gamepad/TX15-shaped samples. All 138 v2 and original24 v1 examples
replayed unchanged. This is functional evidence, not new unit coverage, physical
radio acceptance, hardware performance or public availability.

Next independent increment B: World flight callback-stall handling and keyboard
pause on focused HUD controls. Academy already checks actual callback time;
World currently trusts only the queued animation timestamp. Prepare a separate
branch after A publication so unfinished lifecycle changes never enter A.

Garage's previously referenced temporary handoff is absent. A fresh, repeatable
16-proof replacement is preserved in `/tmp/fpv-garage-regeneration-20261002`: all
16 complete and independently replay, zero contacts, three identical authoring
runs. It is **not installed** until separate playback/package qualification.
Current installed examples remain original104 + school58.

A qualification is complete: source and packaged-host runs each pass17/17 with
zero application errors. Frozen candidate `9a13a9b1ce9316d19c3ac1f572f1bc0bfc21fcbc`
passes all three admissions, ZIP and committed-input checks and two identical
builds. World Studio remains94 source /87 runtime files. Playtest SHA256
`a72309c609044ed6969dab13d3bd9769a88d2ba752e4a11f182fb60ee10bf4e3`.
The ready feature is being published independently against main; inspect its
current PR/head and checks before merging. No new public deployment is claimed.

### 2 October — A published; B lifecycle increment qualified

Checkpoint practice is published and attached as
[#951](https://github.com/mekhovov/revealline/pull/951), head
`02ac74d42a3f332f262da06c7d3911c9301dd39e`, branch
`codex/fpv-checkpoint-practice`. Latest inspection found source release-ready and
optional-package checks passing, company candidate still running, and the branch
behind current main. Preserve exact-head gates; no merge or public claim yet.

The next branch `codex/fpv-world-lifecycle` contains only B's callback-stall and
focused-button pause repair above A. A real callback clock now freezes before
input polling; watchdog resets retain their current-clock baseline, including
arming inside controller polling. Paused simulation has no catch-up. Native
Space keeps button activation, while P pauses from a focused flight button.

Source and packaged host verification each pass69/69. The old host reproduces
the stale-timestamp defect (12/12 baseline checks). Actual rendered-player
Space/Arm and P/Menu interactions were also inspected without application errors;
original Touch/Self-level/Chase preferences were restored. See
`fpv-world-lifecycle.md` and its receipts. Controlled input samples are not
physical-device acceptance or sustained performance measurements.

Frozen runtime candidate `ed8880c7c1135e5b6e124300c88cc658f3b9fc77` passes all
three admissions, committed-input and ZIP-member checks, and two identical
builds. The player contains87 runtime files /13,424,448 bytes, SHA256
`51329637f6f02e783e5760f006bff0d158fd782f7c66929c0ddb1abafeeef748`.
New unit coverage stays in R7. Publish this focused child, creating a fresh
native stack if #951 is still open; closed stacks889/902 must not be reused.

Next independent work: install and visually qualify the preserved Garage16
proofs as their own increment (currently not installed), then continue the
approved art/Themes work while named-device and player sessions remain open.
Garage's additive candidate preserves all138 existing v2 records and adds about
251KB without changing148 challenges/14 worlds. Do not use the old school
installer against the packed registry; preserve all existing rows and identities.

### 2 October — A live; lifecycle rebased onto merged main

#951 merged as `67c8de5cc346acf955a51289625e513f59a5a06f`. The public
`main-deployment.json` identifies that exact merge. The public simulator and its
Lighthouse flight launched successfully with no application errors. Public
`world-progress.mjs` matches the merged source SHA256
`032fa513f09104efde3a3e64f09d0534d889465bba9baa771ac6f0e1d830077c`.
Checkpoint practice is now available publicly. Screenshot:
`/tmp/fpv-checkpoint-live-player-20261002.png`.

Before that merge completed, the automatic update had merged new main navigation
and startup changes into #951. Recovery refs `codex/fpv-checkpoint-prelinear-20261002`
and `codex/fpv-lifecycle-prelinear-20261002` preserve both remote heads. A linear
parent with a byte-identical tree and its rebased child were pushed atomically
with explicit remote-head leases. #951 then completed from its already-qualified
merge head; B was rebased onto the resulting main (identical parent tree). No
native stack was created or retargeted, and no newer changes were discarded.

The combined main/navigation + B build passes source69/69, package69/69 and
checkpoint17/17 browser checks. The fixture now freezes dependencies at unique
URLs and uses real HTTP frames, removing stale module-cache ambiguity. Final
frozen candidate `ca467a7cb438c9609f292856c4716262e646cac8` passes all three
package admissions, ZIP/committed-input checks and two identical builds.
Player SHA256 `f6093191d52c21e2f665fb50517272fa4dd6fb0bb50f61086d1d6ec3d3d7cc94`;
87 runtime files /13,426,571 bytes. B can now target main directly. Its
publication is separate from A's verified public availability.

### 2 October — B merged; Garage original demonstrations ready

Lifecycle PR [#952](https://github.com/mekhovov/revealline/pull/952) was published
and attached at `2fcb3a2ce003e5d0340a9df8cad78e59b9202a5a`, then merged through
the protected pipeline as `b278b0b67137ee8fa3441dd0196e634981137546`. Latest
exact-head checks pass; the automatic main update only added menu-review docs.
Both reviewed-player and continuous-school local URLs contain the qualified B
build, SHA `f6093191d52c21e2f665fb50517272fa4dd6fb0bb50f61086d1d6ec3d3d7cc94`.

The separate branch `codex/fpv-garage-demonstrations` installs the missing16
original Garage proofs. All138 previous v2 rows and decoder bytes are retained;
the current branch contains154 v2 +24 v1 =120 original +58 school demonstrations.
The14-world/148-challenge catalogue and Adventure60 authoring archive are unchanged.
The portable generator, bounded additive pack builder, provenance and compact
archive are retained in `authoring/fpv-worlds/demonstrations`.

Authoring qualification passes15/15; all154 v2 and24 v1 recordings independently
replay. All1,331 checkpoint positions pass (768 restored /563 explicit fallbacks).
Actual WebGL source281/281 and packaged279/279 checks each complete18 runs:
all 16 Garage examples in both modes plus retained original/school representatives.
The checks cover exact final state, FPV/chase, speed/pause, controlled held-input
isolation, localization and saved-record preservation. Their supplied frame
timestamps accelerate playback; they do not measure hardware performance.
Separate native-time Upper deck survey playback and FPV/chase approach views were
inspected. Human art, novice and physical-device qualification remain open.

During qualification, a false final-state mismatch was traced to cross-realm
object key ordering in the verification page; both child-local and normalized
parent hashes now match the exact proofs. Runtime physics and recordings were
not altered to satisfy the fixture. The maintained fixture also exposes deliberate
post-preparation resume and never auto-resumes unexpected in-flight pauses.

Next: freeze and publish this increment against current main (B already merged,
so no stack is needed yet), then continue C's shared Themes/hero-environment work.
Do not append to closed stacks889/902 or claim the Garage build is public before
its own protected merge, deployment identity and actual public launch.

### 2 October — Garage frozen candidate; B public launch verified

Garage runtime candidate `5d9411ba831800bc7f6ae763f46d9d4ea69fa8f7` is rebased
onto merged B/main. All three optional packages pass admission, committed-input
and ZIP checks; two builds are byte-identical. World Studio has94 admitted
source files /13,811,694 bytes and87 player runtime files /13,677,223 bytes.
The prepared player SHA256 is
`47d5b732a0b4fb5a94e1579c2fdafd70d5db64b95552eb618f69e7928c194c45`.
See `fpv-garage-package-verification.json`. This is local qualification, not
public eligibility or a release allocation.

The public deployment marker now identifies B merge
`b278b0b67137ee8fa3441dd0196e634981137546`. The actual public World Studio
and Lighthouse flight launched with enabled Arm/resume, visible world and no
application errors. Public `world-app.mjs` SHA256 matches the qualified source:
`7998ec5987f26349dab28d0870b646eed070bf3448ef42a12433743858f1912d`.
B's lifecycle repair is now live. Screenshot: `/tmp/fpv-lifecycle-live-player-20261002.png`.

Themes coordination was sent to the user-authorized Themes chat. Its active
primary-checkout appearance and cross-tab handoff work remains separate; do not
copy uncommitted files or edit that checkout. C will build on the published
shared contract once its current handoff is reviewed.

### 2 October — Garage published as #954; C starts separately

Garage is pushed and attached as [PR #954](https://github.com/mekhovov/revealline/pull/954),
branch `codex/fpv-garage-demonstrations`, published head
`8df23f7ab` (frozen runtime candidate remains `5d9411ba831800bc7f6ae763f46d9d4ea69fa8f7`).
It targets main because both preceding increments are merged. An independent
review found no blocking issue and checked157 source/provenance/archive hashes.
Both normal local playtest URLs now have the qualified Garage build
`47d5b732a0b4fb5a94e1579c2fdafd70d5db64b95552eb618f69e7928c194c45`.
No Garage public claim yet. Inspect exact remote heads/checks before protected merge.

Next work begins separately on `codex/fpv-hangar-surfaces`: a bounded visual
Hangar pass on current published SIM contracts, while the broader shared Themes
integration remains owned by its active chat. Do not add unfinished Hangar edits
to #954. If the Hangar PR is ready while #954 is open and remains dependent,
create a fresh linear native stack; never revive stacks889/902.

### 2 October — integrate new practice publishing without blocking C

Upstream #930 (practice discovery/launcher/offline) and #953 (main-game demo
routes) merged while Garage #954 was validating. Recovery refs
`codex/fpv-garage-pre-integration-20261002` and
`codex/fpv-hangar-pre-integration-20261002` preserve both local heads. Garage is
rebased on `f236bb71a`; all upstream runtime, publication and offline changes
are preserved. Warehouse/Stadium authoring guidance removed by #930's older
README was restored alongside Garage; their source/recording bytes were retained
upstream. No unrelated change was reverted.

The upstream practice-discovery policy now allows72 Academy /104 World source
files (Flight remains64), adding admitted preview/guide/navigation resources.
These inherited caps were changed by #930, not by this SIM increment. Byte limits
remain8/8/16MiB. Earlier64/96-file receipts remain historical evidence for their
frozen candidates; fresh integrated package receipts are required and recorded
separately. No release version or global release authority was changed here.

C1 is implemented and retained on the separate Hangar branch: texture/UV-only
wall panels, six-metre concrete slab alignment and subdued service strips.
Actual browser75/75 checks cover30 image pairs, three presets, camera poses,
exact meadow pixels, fixed geometry/rays and resource plateaus/disposal. All154
v2 plus24 legacy recordings replay. Its active work will be rebased after Garage
integration, preserving a linear dependency if both PRs remain open.

A temporary disk-full condition was resolved by deleting only two generated
`distribution.zip` duplicates under `/tmp/fpv-sim-entry-build-20261002` and
`/tmp/fpv-sim-entry-qualified-20261002`; extracted builds, checksum manifests,
source and recorded evidence remain. No user assets or checkout were removed.

Integrated Garage candidate `88a407579828a2b15ed5d3d1846414d6cc9de754` passes
all three fresh admissions under inherited #930 policies, committed-input/ZIP
checks and two identical builds. Admitted complete source counts are35/68/100
for Flight/Academy/World; World bytes14,064,140. Exact source runtime from the
Garage playback receipts is unchanged; new discovery/worker helpers are inherited
from reviewed #930. See `fpv-garage-integrated-package-verification.json`.

### 2 October — C1 integrated qualification and inherited edition-size gate

C1 candidate `294c9abe89e04cfb60b9e463dc88400832bace33` passes75/75 actual
browser checks again after integrating #930/#953. All178 installed proofs
replay. All three optional packages pass committed-input admission/ZIP checks
and two identical builds:35/68/100 files, World14,067,328 bytes. A separate
origin-unavailable browser check reopens the prepared launcher, reports Ready
offline and launches the Hangar with enabled Arm/resume and no application
errors. Physical devices and sustained performance remain unqualified.
See `fpv-hangar-surfaces.md` and its evidence receipts.

Garage #954 remains open at `59f20aaf0923a68b2c11f55e80641756bc9c83bd`.
Its exact-head optional-practice and release-ready checks pass, but candidate
run37034459099 fails the whole-edition guard:820 files/67,116,517 bytes,
7,653 bytes above64MiB. Do not merge or increase the guard. Next publication
step is a bounded lossless reduction followed by exact-head requalification,
then a fresh native stack if C1 still depends on open #954. C1 stays separate.

### 2 October — fresh native stack957, Garage954 → Hangar956

The first C increment is published and attached as
[PR #956](https://github.com/mekhovov/revealline/pull/956),
`codex/fpv-hangar-surfaces`, following Garage #954 in new native **stack957**.
Old stacks889/902 stay closed. GitHub concurrently merged newer main #908/#917
into the root. Recovery refs `codex/fpv-garage-pre-stack957-20261002` and
`codex/fpv-hangar-pre-stack957-20261002` preserve both original heads.
A cascading rebase onto `2f009d335` restored linearity; the Garage tree is
byte-identical to the remote merge tree, and the Hangar only adds those upstream
changes. Atomic push used explicit remote-head leases for both branches.
Root head `61b761f36da9fc014d4c9d087d868e4d7ebfd8ef`; Hangar frozen candidate
`9134e9e210356ae4187fcde55337167e215ffabb` passes all three admissions again,
committed-input/ZIP checks and two identical builds. See stack957 package receipt.

The failed edition is `droneaid-nl-community`; its engine closure contains no
optional-practice files. Current main independently reproduces the excess, so
this is an inherited publication blocker, not additional Garage/ Hangar content.
A bounded lossless soundtrack-metadata compaction is being assessed separately;
retain all media, exported data, budgets and publication authority.
C2 candidate after this checkpoint: redistribute the existing meadow tree line
into irregular exterior groves without increasing geometry/resources, pending
visual readability checks. Broader Themes integration remains separate.

### 2 October — capacity repair958 published; next art branch prepared

The independent main-edition capacity repair is published and attached as
[PR #958](https://github.com/mekhovov/revealline/pull/958),
`codex/compact-soundtrack-metadata`, candidate `d31ea2225`. Generated soundtrack
metadata saves33,560 bytes with exact unchanged values/order/strings across all
four exports. Two regenerations match. All18 production editions compile in
memory under unchanged guards; the largest is67,093,802 bytes,15,062 below64MiB.
The existing test cohort remains12pass/17fail on both baseline and candidate;
identical failure names and archive-fixture causes are recorded, not called a
suite pass. Frozen archive/CI qualification and protected merge remain pending.
This fix is independent of native stack957 and must not be merged into feature
branches by hand before checking current remote/main state.

Native stack957 remains Garage #954 → Hangar #956. After958 merges, reconcile
exact remote heads and apply a coordinated linear rebase with recovery refs and
explicit leases; preserve new main and #955 Themes work. Requalify changed
package inputs, inspect checks/reviews/holds, then use protected stack merge.
No Garage/Hangar public availability is claimed until deployment identity and
actual launch pass. A/B remain previously verified live.

Both ordinary local player URLs now contain the same qualified Hangar build:
92 runtime files/13,910,009 bytes, ZIP SHA256
`e71a5313cd6111fd49f214eb5a28206eacddeb3bc8e65cad047d185c8f6076d8`.
The reviewed-player URL launches Lift and land with visible refined surfaces
and enabled Arm/resume; screenshot `/tmp/fpv-hangar-final-player-20261002.png`.

Themes draft #955 is now published; its shared appearance ownership and
remaining qualification are preserved. A concise authorized handoff identifies
our gym-only change to `world-visuals.mjs`; do not replace either branch's full
module during integration. Next independent implementation branch is
`codex/fpv-meadow-groves`, created from the latest Hangar head without runtime
changes yet. Implement C2's same-count exterior tree composition and verify
readability/unchanged gameplay; publish as a new dependent PR only when complete.
Physical TX15/iPhone/Steam Deck, novice/art acceptance and measured FPS remain
open. Additional unit coverage stays in H/R7.

### Latest handoff — Garage merged; preserve native child rewrite

Repository automation merged Garage #954 as
`09b40cdfa996056b4c6fb4ddbf96077676da53e0` at17:07 UTC. GitHub natively
rebased the Hangar child to `49aaf950224963dd77e2d0eeb495180824d00435` and
retargeted it to main; this task did not manually retarget or dissolve a stack.
Its tree is identical to our previously published `45337fe75`.
`codex/fpv-hangar-before-native-rebase-20261002` preserves the local head;
only the unpublished delivery-note commit was replayed over GitHub's child.
Stack957 now has merged954 and open956. The independent capacity repair958
continues separately. Latest observed Hangar checks are running; no merge was
requested by this task while checks were incomplete.

Next heartbeat: inspect current heads/stack957/reviews/holds and public marker.
Verify Garage's actual public launch before calling its120+58 demonstrations
live. Resolve the independent958 pipeline, preserve any native stack rewrite,
then continue C2 on `codex/fpv-meadow-groves`. Its starting tree includes the
published Hangar change; no unfinished C2 runtime work is mixed into956.

### 2 October — touch playability and unrestricted mode choice

User-prioritized touch usability precedes C2. Branch `codex/fpv-touch-flight`
now starts on current main `fc0eaf978` after native stack957 fully merged.
Recovery ref `codex/fpv-touch-before-main-20261002` preserves its original base;
main advancement had an identical tree and preserved all local feature changes.

All148 catalogue levels keep the player's selected mode. Acro-only skill courses
permit clearly labelled unscored Self-level practice, without proof/reward/recovery
writes. Ordinary school completion names the actual mode; replay/checkpoint
selection uses matching evidence or a safe fresh attempt. Both SIM hosts and the
lab use relative thumb pickup, held throttle, shared Precise/Direct response,
independent pointers and safe pause/clear on interruption or resize. Larger edge
controls and brief labels preserve the central flight view. See
`docs/fpv-touch-flight.md` for behavior and research.

Functional browser evidence passes32/32 checks, including296 actual-host
level/mode starts, pointer ownership/cancellation, mode/replay/checkpoint
switching, zero paused touch display, and lab resize/capture-loss handling.
All178 demonstrations replay unchanged (154v2+24v1;327,795 frames). Actual player
checks cover390×844,844×390 and1280×800 layouts, EN/UK, real pointer capture in
Academy and World, and retained54% throttle after release. Browser snapshots and
receipts are `docs/evidence/fpv-touch-*`; controlled-fixture limitations are
explicit. Physical iPhone, Steam Deck/native-app, radio and novice acceptance
remain pending; no measured FPS or new unit coverage claim. Unit coverage stays
in H/R7. Frozen package admission and focused publication follow this checkpoint.

Frozen touch candidate `b4bc48365` passes all three optional package admissions,
committed-input and ZIP-member verification, and two byte-identical builds.
Source file counts35/68/100 remain within inherited64/72/104 limits; package
bytes545,596/3,825,812/14,079,797 remain within8/8/16MiB. Receipt:
`docs/evidence/fpv-touch-package-20261002.json`. Both normal local playtests are
updated:92 runtime files/13,922,478 bytes; ZIP SHA256
`6409a64a29bc5bc089a692009eeceff6eb265050773844e66ae85e154dbe50d9`.
This is a local player build; protected publication/deployment remains separate.

Touch usability is published and attached as
[PR #959](https://github.com/mekhovov/revealline/pull/959),
`codex/fpv-touch-flight`, directly against main. Old stack957 is closed; no
manual retargeting or redundant stack was created. The updated reviewed-player
URL launched the real school in Self-level/Touch with no application errors;
its phone view is captured at `/tmp/fpv-touch-final-player.png`. The player is
left paused with mode and touch-response choices available. No public-live
claim is made for959 until deployment identity and actual public launch pass.
Next independent approved work remains C2 meadow exterior composition on current
main; keep that work off this ready PR. Preserve Themes955 ownership and pending
physical-device qualification. Inspect exact remote heads before any merge.

Main advanced during publication: capacity repair958 merged as `07f227f50`.
The touch branch was linearly rebased with recovery ref
`codex/fpv-touch-before-main958-20261002`; only the upstream soundtrack compaction
and its evidence differ. Frozen candidate `80807bd78` again passes all three
admissions, committed-input/ZIP verification and two identical builds. The
final32-check browser fixture revalidates the exact unchanged62 dependency
hashes, including host `79daf2e114f95b362da70c7cd7a7f00e7174e30150f1e8f0ced7198e0caa30b0`.
Receipt: `docs/evidence/fpv-touch-package-main958-20261002.json`. The explicit
remote-head lease rejected a concurrent repository-automation update safely.
Automation had merged the same main as `3984e8185`; its tree matched our rebased
candidate apart from these new evidence records. That remote history is retained,
and this evidence is applied on top without a force-push. Recovery refs
`codex/fpv-touch-local-rebased-20261002` and
`codex/fpv-touch-automation-main958-20261002` preserve both histories.
No new native stack is needed. Public deployment and current-head checks remain
external pending work; keep the ready increment separate from C2.
Preserved-history candidate `e18d14aa7` also passes all three admissions and
reproducibility checks; the main958 receipt now names that published-history
candidate. Runtime and browser-fixture bytes are unchanged.

### C2 meadow continuation — 2 October 2026

Reconciled current main `07f227f5042364a73cbbc66cc783e40c93baea9a`:
Garage #954, Hangar #956 and capacity repair #958 are merged. Native stack957
is closed. The public marker identifies this main and Pages37043109731 passed;
this continuation has not independently launched the public player, so it makes
no new live claim. Touch/mode-choice #959 is separate at `8260a64e3`, with
required checks still running at inspection. Preserve its completed changes and
the normal reviewed/continuous playtest URLs; do not overwrite them with an
independent C2 build lacking that increment.

`codex/fpv-meadow-groves` advanced cleanly to current main and implements C2
as a placement-only change. It reuses32 tree pairs in four irregular groves,
keeps crowns at least10.1m beyond flight bounds, and preserves all geometry,
materials, routes, objectives and actor behavior. The43 field-backed challenges
share this scenery. Other13 environments compare exactly. Source WebGL passes
147/147 checks and45 image pairs; all178 demonstrations replay over327,795ticks.
Draw calls vary with newly visible scenery; no sustained FPS claim is made.

The separate local C2 build is `dist/fpv-meadow-groves-playtest`:
92runtime files/13,912,833bytes, ZIP
`e0b3f9d031ec470689145a14894300f675c72e9526b1ab9206bd2e976d43dd51`.
Frozen package admission and focused PR publication follow below. No new native
stack is needed for this independent increment. Additional unit coverage stays
in H/R7; physical device, novice and art acceptance remain open.

Themes draft #955 remains owned by the Themes chat. Its latest inspected head
`ca608cda584a44103284ba20e0a65defe0b53801` includes the Hangar fix. Integrate only
C2 placement hunks with its shared material bindings; do not copy full visual
modules or introduce a competing appearance preference. After C2 publication,
continue C3 courtyard/woodland composition and surface-scale work on a separate
branch while required CI runs.

Touch #959 subsequently merged as `1d0b359f7`. Recovery ref
`codex/fpv-meadow-before-touch-main-20261002` preserves C2's pre-integration
history. Only the delivery-log append conflicted; both histories were retained.
The two unpublished C2 commits were rebased onto current main. Frozen candidate
`1975948b32aa4c3b016cb58b987a15b1f98e5661` passes all three admissions,
committed-input/ZIP checks, two identical builds,147 WebGL checks/45 image pairs
and all178 replays again. Integrated receipts use `*main959*` names.
Final local C2 playtest has92files/13,925,302bytes and ZIP SHA256
`5dc034998be3d0c6aa7fc0f0698479bf51ccae0eb076e98f42fc9f2e53768ecc`.
It now includes the merged touch increment and can refresh normal player URLs.
The bounded WebGL workload has up to23 more visible draw calls due to closer
groves; no asset-count growth, reload leak or gameplay identity change is found.

C3's concrete independent candidate is courtyard street-front composition:
assemble the existing Kenney facade/roof modules into connected three-bay
terraces with intentional alleys, preserving model counts and exterior route
clearance. It belongs in `scenery-runtime.template.mjs` plus its regenerated
runtime/provenance, not in C2's visual loop or Themes' appearance contracts.
Review source and generated ownership before edits and publish separately.

C2 is published and attached as [PR #960](https://github.com/mekhovov/revealline/pull/960),
`codex/fpv-meadow-groves`, initially at `6386be8b3`, directly against main.
The two normal local player builds now include both merged touch #959 and C2,
with the same final ZIP identity above. Current-head CI/public deployment remain
separate; no protected gate was bypassed and no new native stack was needed.
Next work uses independent `codex/fpv-courtyard-terraces` from current main;
keep unfinished C3 out of ready #960. Preserve Themes #955 and C2 placement when
integrating branches. Do not report remaining physical-device/art qualification
or deferred unit coverage as complete.

### C3 courtyard continuation — 2 October 2026

C2 meadow composition is published separately as
[PR #960](https://github.com/mekhovov/revealline/pull/960), last inspected at
`4507c4636` with required checks running. Branch `codex/fpv-meadow-groves` and its
qualified normal player builds are preserved; no unfinished courtyard work was
added there. C3 uses independent `codex/fpv-courtyard-terraces` from current main
`1d0b359f75dfb48aa5729cdc619c2f93fe9ac65a`.

The public marker identifies this merged touch #959 revision. Actual public SIM
launch and Lighthouse approach succeed, exposing both flight modes and
Precise/Direct touch response without application errors. This now verifies #959
live; see `docs/evidence/fpv-touch-public-20261002.json`. It does not certify C2 or
C3 publicly deployed, or new physical-device/hardware acceptance.

C3 groups existing courtyard wall/roof modules into connected three-bay terraces
with uneven alleys and setbacks. All139 placements,20 batches,119 instances and
23-source-model library remain; only courtyard X/Z placement changes. Roof/floor
alignment and ≥8m building clearance pass all3 actual bounds. Small creator
sides under64m retain the old layout. Other5 prepared environments compare exactly
across11 authored bounds/theme cases. Runtime grows801bytes; two offline source
regenerations are identical and the embedded library hash is unchanged.

Actual GLB/browser checks pass124/124 with59 image pairs, no increased sampled
draw calls and stable reload/disposal counts. The real player completes Roofline
survey at50.6s. Prior178-demo replay evidence remains applicable via exact equality
of all12 bound runtime/catalogue/proof inputs; do not call this a new replay run.
See `docs/fpv-courtyard-terraces.md` and adjacent model/browser receipts. Frozen
packages/publication follow. Normal C2+touch player URLs stay untouched until an
integrated C2+C3 build is qualified. Separate C3 URL is
`dist/fpv-courtyard-terraces-playtest/optional-practice/fpv-worlds/index.html`.

Themes #955 retains shared appearance/material-role ownership. C3 is a template
placement hunk with offline-generated runtime/provenance only; preserve its
contracts and C2 meadow visuals during integration. Broad C realistic art is not
complete. Next work is woodland readability and shared-theme material/asset
qualification; do not add wide decorative canopies across narrow flight gaps
without matching authored visual/collision rules. B/D/F/G/H hardware, novice,
creator/offline, feedback-led maps and deferred unit-coverage work remain open.

C3 frozen candidate `b00fe336338cdf9a351f5851346f93c29ccdd003` passes all3
optional-package admissions, committed-input and ZIP checks, and2 identical
builds. Counts35/68/100 and bytes545,596 /3,825,812 /14,080,598 remain under the
inherited guards. Packaged WebGL repeats124/124 checks and59 comparisons.
C3 local build is92files/13,923,279bytes, ZIP SHA256
`8d82a3e83798fc79adfcf9c048ad704a5de45eae18141ad0f9de3e571a681f03`.
Source remains independent of ready #960. If960 merges first, reconcile new main
with a recovery ref, preserve both log appends, and requalify combined package
inputs before refreshing normal playtests. Native stacks are only needed if a
new feature actually depends on an unmerged one.

C3 is published and attached as [PR #961](https://github.com/mekhovov/revealline/pull/961),
`codex/fpv-courtyard-terraces`, initially at `af24f6ce3`, directly against main.
No native stack is needed: C2 and C3 change independent scenery areas. Themes was
sent the exact template/placement handoff with both PR links under the user's
existing coordination authorization. Do not overwrite its appearance work.

At final inspection, unrelated rewards #906 advanced main to `c78258e24`.
Repository automation already merged that main into meadow #960 as `989a4840e`;
its required current-head checks are running. Preserve this remote merge history,
not a force-rewritten linear approximation. Courtyard #961 is still at `af24f6ce3`
and behind new main; inspect its exact remote head before any update because the
same automation may reconcile it. No merge/live availability for960/961 is
claimed. The frozen evidence identifies the earlier candidates honestly. If new
main changes optional package inputs, repeat applicable frozen admission and
browser checks before reporting the updated candidate qualified.

Next concrete item: woodland/shared-theme asset readability. First reconcile
#955 material-role ownership and determine visual/collision rules for the six
existing tall timber-like tree colliders; avoid adding a solid-looking broad
canopy in a flyable opening. Preserve completed960/961 and normal C2+touch builds
while working on a new independent branch. Keep hardware/novice qualification
and deferred unit coverage explicitly open.

### C4 woodland continuation — 2 October 2026

#960 and #961 are merged. Public marker e48adf3185dc7536555d142fe3d1165de31c05f9
is a verified descendant of both; actual public Roofline survey launches with
Ready status and enabled arm, without captured errors. See
`docs/evidence/fpv-scenery-public-20261002.json`. No new physical acceptance.

C4 is independent on `codex/fpv-woodland-surfaces`, based on that main. It changes
only woodland bark/floor maps, trunk UVs and quiet edge presentation. All six
1×1×8m boxes, opaque silhouettes, actors, objectives, imported assets and other
worlds are preserved. A first leaf-texture draft was refined after actual flight
review to avoid bright uniformly spread marks. The final runtime SHA256 values
are visuals a724e26f05ab59d24a0fb5493eacabdd6b38690bfc0b90ddee7ae8c8117c31a1
and renderer f16d9170e59a06976f1780d0ca4e55d8c8046fcfdb5a92a313053b2c32f1d1eb.

Source browser qualification passes211/211 checks and105 image pairs, including
actual GLB loading, geometry/UV/material/ray inspection,13 other environment
regressions and three disposal cycles. There are no added sampled draw calls,
triangles or resource counts. A fixture-only Sprite ray error was corrected by
limiting rays to opaque environment meshes; no runtime workaround was required.
All19 focused woodland demos replay, and178 prior demo results remain bound by
exact input hashes. Final actual Crossing trail playback completes at49.4s.

Frozen candidate1ee7025eb9683c8d7ee0b6995cddd38b4bf6d058 passes all three package
admissions, committed inputs/ZIP members and two identical builds. The dedicated
player has92files/13,932,487bytes; ZIP SHA256
fc3ddb63c13c02f36968f75d384a2e12fee932e10c8eefe6cc126affec92fe13.
Packaged-browser qualification/publication follow; no C4 public availability
is claimed yet. Additional unit coverage stays deferred to H/R7.

The independent capacity repair is [PR #963](https://github.com/mekhovov/revealline/pull/963),
branch `codex/picture-catalogue-capacity`, published head d28ffc4c5. It saves22,377
bytes from the generated picture-owner inventory, retaining all155 records. All18
ordinary in-memory compiles pass; the formerly failing community edition also
passes frozen ZIP/admission and two builds at11b3d9e43. This does not change
content, limits or release authority. Preserve that ready branch while C4 finishes.

Themes #955 retains material ownership; reconcile these narrow surface/UV hunks
without overwriting C2 groveSlots or C3 terrace placements. Next C item is
Warehouse/Stadium surface scale and flight-line readability, then yard/garage.
Physical hardware, novice/art sessions, creator/device-offline and feedback-led
map growth remain open. Native stacks are unnecessary for these independent PRs.

C4 packaged WebGL also passes211/211 checks and105 comparisons; see the packaged
receipt. The final normal reviewed-player and continuous-school builds now include
merged C2+C3+touch and C4, byte-identical to the dedicated woodland playtest
(fc3ddb63…92fe13). Actual Crossing trail demonstration completes, and a new attempt
is left paused/ready with zero throttle. Publication is the remaining gate for
this focused surface increment; broader C and human/device work remain open.

### C4 publication and next item — 2 October 2026

Woodland is published and attached as [#964](https://github.com/mekhovov/revealline/pull/964),
`codex/fpv-woodland-surfaces`, independently against main. Latest qualified
candidate `0f6313c0c891501cf236d3cbe5473a575639201b` incorporates Neon #883 and
Pages profile #965. All three optional packages pass committed-input/ZIP
admission and two identical builds. Only source-bound manifests and generated worker identities differ from
qualified `589ddb664`; all other runtime members are identical. This preserves
rendering/controls evidence, not an installed/offline identity claim. Actual
EN/UK Crossing trail launches are recorded in
`docs/evidence/fpv-woodland-surfaces-main883-player.json`. Source/package rendering
receipts remain 211 checks / 105 comparisons each, with unchanged renderer and
world-visuals bytes. All three normal local playtests were refreshed and retain
ZIP `fc3ddb63c13c02f36968f75d384a2e12fee932e10c8eefe6cc126affec92fe13`.

Independent capacity [#963](https://github.com/mekhovov/revealline/pull/963) is on
`codex/picture-catalogue-capacity`, last pushed as `b7d2d01c5`. It preserves all
209 owners after Neon (155 original + 54 new), exact original art locators and
56 FPV fingerprints. All 18 editions compile within current limits; largest
67,103,443 bytes / 824 files, 5,421 bytes of headroom. Frozen candidate `9cb659d3c`
passes ZIP/presentation admission and two identical builds. Repository automation
then merged #965; current CI must qualify its new rolling Pages profile. Do not
present the earlier 989,957,084-byte full-default inspection as that profile's
measurement. A local disk-space failure was resolved by deleting obsolete
reproducible FPV verification outputs; source, handoffs, receipts and normal
player builds remain intact. No package guard or release authority was changed.

Inspect current remote heads before the next push: automation reconciles main.
At the last snapshot, #964's whole-edition candidate failed on the separate
capacity problem; optional admission was successful. Both PRs still need current
checks/reviews and public deployment verification. No C4 public live availability
is claimed. No native stack is needed for these independent changes. Existing
closed stacks remain closed. Themes was sent the narrow C4 hunks, both PRs and
next-item ownership constraints under the user's coordination authorization.

**Next concrete item: C5 Warehouse storage surfaces**, then a separate Stadium
pass. Warehouse's six solid `rack-*` boxes should read as closed storage modules,
with painted steel faces, restrained joints/bands and quiet bay identification.
Apply metre-scaled shell UVs to avoid stretched wall/sill/beam surfaces. Keep
Pixel palettes/filtering, geometry, lighting, collision and objective colours.
Never depict open shelves or fly-through gaps through those solid colliders.
Cover `warehouse-01…08`, `beginner-36` and `beginner-38`, both authored bounds,
all presets, views around the 2.5m stack and beam starting at 5m, resources and
non-Warehouse regression. Coordinate semantic steel/enamel/concrete roles with
Themes #955; do not add another factory or selector. Stadium's existing scoreboard
can receive a static event-display face later, without invented live lap data.

Keep C5 on a separate branch and out of ready #964. B physical TX15/iPhone/Steam
Deck acceptance, D novice/experienced sessions, F creator/device-offline work,
feedback-led G map growth and H/R7 unit coverage remain open. Catalogue counts
remain 148 challenges / 14 worlds; visuals do not create extra levels.

### C5 Warehouse ready checkpoint — 3 October 2026

Main now contains capacity #963 (`ae4624f6e`) and Woodland #964
(`fe6ff1b7a2585aa969b945d5fcb7699aa6b04460`). The independent Warehouse branch is
`codex/fpv-warehouse-surfaces`, based on current main. Additive merge conflicts in
surface constants, UV helpers and semantic dispatch were resolved preserving
both C4 and C5; an independent CPU comparison confirms Warehouse stayed exact
and all13 other environments including Woodland remain unchanged.

C5 refines existing closed storage blocks with painted steel panels and six
quiet bay numbers, and scales shell UVs in metres. School stacks/beams/dividers
use plain regions of the same atlas. No new mesh, material or texture is
allocated, and physical geometry/collision is exact. Label UVs add1,152bytes.
No apparent shelf openings are painted into solid colliders. Catalogue remains
148challenges/14worlds/178original-and-school demonstrations.

Final runtime hashes: renderer
`2e0896fa2b5acc3b71a05b729e277b48f16aaa57b43b960c12406d495de88346`; visuals
`02eb4dc0c156316bf7634fad51d61365e48e4a5dac81ad62a032b1efc2e0172d`.
Source and packaged actual WebGL each pass307checks/159image pairs. CPU passes76
prior texture outputs,85preset cycles and96label-face orientation assertions.
All18 Warehouse demonstrations replay over44,168ticks, without contacts or
blocked actors. The prior178-proof results remain bound to exact inputs, not a
new broad rerun. Actual Moving freight playback finishes52.0s/health100; the
player is left ready atzero throttle with no captured errors.

Frozen candidate `16a45583d98d9461f7f5d10b97dfe4f85c967e9f` passes allthree
optional admissions, committed-input/ZIP validation and two identical builds.
World Studio is100files/14,094,801bytes. Dedicated/normal reviewed/continuous
school local playtests use92files/13,937,482bytes and ZIP
`74b5128681f8cc3905f5dee518ec22734e183aa1b1814b07cb60f669eff9d793`.
Evidence is linked from `docs/fpv-warehouse-surfaces.md`. Two initial package
attempts exhausted local disk; obsolete task-generated snapshots and a redundant
old SIM-entry build were removed, then qualification passed. No user assets,
handoffs, limits or release authority changed.

Publish this focused independent PR against main. No native stack is needed.
Do not claim C4/C5 public availability from this checkpoint: public marker and
actual public launch still need verification. Required CI/reviews remain their
own gates; do not bypass or repeatedly poll unchanged external checks.

**Next concrete item: C6 Stadium** static event-display and stand surfaces, then
Container yard/Garage. Never invent live scoreboard results. Coordinate narrow
UV/surface changes beneath Themes #955's material factories. B actual TX15,
iPhone and Steam Deck, D unfamiliar-player sessions, F creator/device-offline,
feedback-led G maps and H/R7 deferred unit coverage remain open. No new physical
acceptance, sustained FPS or complete production-art claim is made.

C5 is published and attached as [#966](https://github.com/mekhovov/revealline/pull/966).
Initial published head was `a276d9715a4322821357a3aebea7cfbc3bfef131`; Hunt #962
then merged to main. Candidate `065026f0d3b30e23d168feb2b0d3b50811331b1d`
incorporates main `adfa2d799` and passes all three frozen optional admissions,
committed inputs/ZIP members and reproducibility. Only generated package
manifests/worker identities differ from the browser-qualified candidate; all
other members match exactly (see main962 binding receipt). Source/package
rendering evidence remains applicable; installed/offline identity acceptance is
not inferred. Fresh CI/reviews are pending. The initial preflight/optional jobs
passed while candidate/capacity/focused ran, and release-ready was failed in a
superseded cancelled run. Preserve required gates; no public C5 claim.

C6 read-only scope is now defined: `stadium-01…08` and
`beginner-32/35/42/45/57` use 76×70×18, 88×88×20 or150×150×100m bounds.
Refine the two5×8×48m solid stands and14×10×2m board with restrained concrete
panels/section bands and a fixed non-emissive venue/checker emblem. The existing
procedural seats are hidden after normal GLB load, so changing those alone would
not address the player view. Preserve the pavilion, floor markings, all route
cues, geometry, alpha and scoring rules. Beginner42's metal landing platform
must share a plain board-atlas region to avoid another texture pool. No C6
production changes are mixed into #966. Keep ready Warehouse isolated while the
Stadium branch develops. Themes received exact runtime hashes and ownership.

### Feedback-nonblocking continuation — 3 October 2026

The owner requested continued implementation without waiting for user feedback.
Human/physical-device acceptance stays pending and is not a feature-development
gate. Functional verification remains mandatory; additional unit coverage stays
in H/R7. The current order is section watch/practice, visual Follow/Observe
editing, recovery guidance, bounded example delivery and further distinct maps;
remaining environment art can proceed in parallel through shared Themes roles.

Themes #955 and Warehouse #966 are now merged; current main is `8896c4976`.
The clean independent branch `codex/fpv-section-replay` starts at that main.
Do not reuse closed native stacks. The last public marker observed is Themes
`3636201d3` with successful Pages run37077000362; no fresh Warehouse public
launch is claimed. Warehouse's edition candidate exceeded 64 MiB by216,043bytes
(67,324,907 total), despite successful optional/default-capacity checks. Preserve
that concrete failure for a separate lossless repair, without relaxing guards.

The section-watch increment must keep original course identities, verified
recorded entry state and exact commands, stop at a verified section boundary,
and offer direct practice of the same section. Playback/practice must not earn
records, medals or playlist progress. Existing partial-recording practice fallback
must stay valid; do not label an unreached section a successful demonstration.
Current counts remain148challenges/14worlds/178installed demonstrations.

Section source qualification is complete: 7/7 functional groups,154v2 proofs,
768exact recorded sections; checkpoint regression716entries/615fallbacks;
production-host source WebGL51/51 checks. Imported installed sessions now select
pinned pack scenery even when an edited draft is open. Evidence and limitations
are in `fpv-section-replay.md`. All functional checks preserve original identities,
actors and physics; human sessions remain nonblocking and pending.

Capacity is a separate focused [PR #968](https://github.com/mekhovov/revealline/pull/968),
`codex/edition-token-capacity`, initial head `1d73a5c21`. All18editions compile under
unchanged limits after syntax/token/comment/line-preserving distribution spacing.
Largest67,045,468bytes;279,439saved;63,396headroom. The section branch currently
builds on this repair so global candidate capacity can qualify both increments;
if #968 remains open when section replay is published, create a fresh native
stack for that dependency. Do not retarget an existing native member manually.

A fresh actual public Loading bay launch at Themes deployment3636201d3 reached
Ready atzero throttle with no captured errors. Warehouse8896c4976 has not yet
been identified by the public marker, so Warehouse live availability is still
unverified. Public screenshot: `/tmp/fpv-themes-public-launch-20261003.png`.

Section frozen candidate4d7bad1e2 passes all three optional admissions, exact
committed inputs and ZIP members, two identical builds, and packaged WebGL51/51.
The largest edition also passes frozen validation/reproducibility at this child
snapshot:887files/67,045,468bytes. The development dependency folder under
`authoring/fpv-worlds/node_modules` was moved temporarily into ignored `.cache`
during source eligibility inventory and restored afterward; source and guards
were unchanged. #968 has since been automatically reconciled with newer Themes
#967 at586b9cb08. Preserve that remote update and reconcile the section child
before publication; earlier renderer/package evidence does not qualify new
Themes bytes by inference.

Themes #967 was preserved through a recovery-backed child rebase. Candidate
c5b7b3771 passes all three frozen optional admissions, committed inputs/ZIP
members and two identical builds. New source and new packaged browser fixtures
both pass51/51; their receipts replace the superseded revision in the feature
documents. A second local ENOSPC during admission was resolved by removing only
this turn's superseded fixture copies and reproducible largest-edition ZIPs;
all source, frozen optional packages, metadata and qualification receipts remain.
Admission reran successfully. No limit was relaxed.

Capacity #968 has now merged as432904d7d. Section replay can target main directly;
no new native stack is necessary for an already-merged dependency. The local child
was rebased onto that main while retaining the qualified runtime bytes. A new
native stack is only needed if the next dependent feature is published before
section replay merges. Next concrete feature is the visual Follow/Observe
objective inspector, including both-mode editing and project/pack roundtrip.

### Section replay published; tracking editor started — 3 October 2026

[Section replay #972](https://github.com/mekhovov/revealline/pull/972) is published
and attached, initial headce8a434de, independently against main after capacity
#968 merged. It retains source/package51/51 browser checks and768exact recorded
sections, allthree frozen optional packages and both-mode catalogue access.
Dedicated local build is `dist/fpv-section-replay-playtest` (ZIP49c1409c…cab2d),
including merged Themes#967 and Warehouse#966. Public availability still needs
marker and actual launch verification after merge.

Next branch is `codex/fpv-tracking-objective-editor`, based on the published
section feature. Own the visual Follow/Observe inspector and narrow editor-host
wiring; do not add this unfinished work to ready#972. If#972 remains open when
this dependent feature is complete, inspect its exact remote head and append
through a new native stack. If it merges first, reconcile with current main and
publish independently. Continue functional qualification without waiting for
player feedback; keep physical/human acceptance pending and unit coverage last.

Warehouse public availability is now verified: public markerdb84d3f14 (Themes#967)
is a descendant of Warehouse8896c4976. An actual refreshed public Moving freight
demonstration reached52.0s/health100 and “Demonstration complete”, with no captured
console errors. The screenshot API returned a zero-width error on that background
tab; no fresh screenshot is claimed. This confirms player entry/playback, not
physical-device performance or new art acceptance. Section#972 remains a separate
publication gate.

Only superseded outputs from this turn were cleaned for disk headroom: the first
section source fixtures, first extracted package/browser fixture, and first frozen
candidate ZIP copies. Their committed receipts/metadata and the latest qualified
candidate/extracted player/fixtures remain intact; normal user playtest URLs and
all source assets are preserved.

### Tracking inspector source-qualified — 3 October 2026

`codex/fpv-tracking-objective-editor` now includes the native EN/UK Follow/Observe
inspector, independent per-mode criteria, exact units, actor validation and
undo/reimport-safe bindings. Generic route edits no longer change an unrelated
Acro objective after the mode arrays diverge. Source browser63/63 and exact
UI-authored two-mode replay pass (627/548ticks, zero contacts), plus shared-host
section regression53/53. Feature notes: `fpv-tracking-objective-editor.md`.

PR#972 publication checks found a real internal-radio-reset/autoplay regression.
A concurrent remote repair and newer main Themes merge were preserved. Current
published parent4bf0d072f incorporates those changes plus reset-before-pause-token
capture and playback-only pickup isolation. Existing affected checks16/16 and
source53/53 pass; protected auto-merge is requested using the repository's allowed
merge method. No check or release policy was bypassed. Old frozen receipts are
historical until the next complete candidate passes admission.

Disk pressure recurred during local writes/fetch. Only superseded generated
section fixtures and ZIP copies were removed; their manifests/committed receipts,
source and normal user playtest builds remain. A retry fetched the newer parent
without auto-maintenance; main673ac3fc4 is preserved. Source browser63/63 and
section53/53 were rerun against that integration. User feedback stays nonblocking;
physical/human qualification and deferred unit coverage remain explicitly open.

The editor has no runtime dependency on section replay. To preserve independent
publication while #972 receives concurrent main reconciliations, its three local
commits were rebased onto current main742d25225. A recovery ref preserves the
combined qualified candidate. Only the editor's two runtime files and its
qualification/docs remain in the diff; no remote branch was force-pushed and no
native stack was created. The 53-check section receipt is integration evidence
for the preserved combined candidate, not a claim that pending #972 is on main.
Fresh standalone source/package qualification follows this rebase. Next item
remains pack-removal impact and recovery guidance.

Standalone editor candidateaa05d0b93 passes all three frozen optional admissions,
exact committed inputs/ZIP members and two identical builds. World Studio99files/
14,451,645bytes remains inside104files/16MiB. Fresh source and fresh packaged
browser workflows each pass63/63, and the exact UI-authored data completes and
replays in both modes. Dedicated build: `dist/fpv-tracking-editor-main-playtest`.
The earlier combined build remains `dist/fpv-tracking-editor-playtest`; it includes
pending section replay and is preserved separately. Native stacks remain unused
because both focused features can merge independently.

### Follow/Observe editor published — 3 October 2026

[PR #975](https://github.com/mekhovov/revealline/pull/975) is published and attached,
initial head19d11689a, independently against main. Its source/package browser
workflows pass63/63 each; both UI-authored modes complete/replay; frozen candidate
aa05d0b93 passes all three optional admissions and reproducibility. Local standalone
ZIPa2a8b90c…8c9e50 is available at `dist/fpv-tracking-editor-main-playtest`.

Section replay [#972](https://github.com/mekhovov/revealline/pull/972) has now
merged at2026-10-03T01:13:01Z, final branch head61da7d890. The new editor remains
separate; no native stack was necessary. Public deployment/launch of either
new feature is not yet claimed. Next implementation: pack-removal impact and
recovery guidance on a separate branch from current main. Preserve pending
editor CI/review and current qualification receipts while progressing that item.

### Pack removal and exact recovery — 3 October 2026

Section replay #972 is merged. The independently published Follow/Observe
editor #975 remains open at last inspected remote head
`51b4a6deb972d2c599090028ecf35423bc747922`; no failed actionable checks or
holds were present in that snapshot. Preserve its newer remote commits and the
local `codex/fpv-tracking-objective-editor` recovery state. Do not infer live
availability from local completion. The public marker was last observed at
`742d25225bcd792075d2a44a3e4c813f6dff9464`, before section replay; no fresh
public launch of section replay or the editor is claimed.

Current independent branch: **codex/fpv-pack-removal-guidance**, based on main
`9546597aaeaef3149c4ef44532b4bb58ffec745e`. Pack removal now reviews exact
active/retained revisions and affected records, pins, playlists/bookmark,
interrupted flight and draft. A read-only atomic generation snapshot binds the
confirmation; a stale review requires a new choice. Exact exports refuse a hash
mismatch, bounded proof parts preserve evidence, and missing dependencies have
an exact-pack restore picker. Ordinary .rlpack imports now install the inspected
identity directly instead of silently rewriting through Creator. Original pack
files remain necessary when noncanonical archive bytes cannot be reproduced.

Final source host SHA256 is
`b65ef74310dc1c23b7c23385428211b0cb28174eead31dda6d29c4c531894e02`;
store SHA256 is
`4b8c2fe165868f38eb297d678ea5aca232d61d2dd2a05b79db9d20145f3d0cfa`.
The actual source HTTP/WebGL host passes90/90 checks, including preservation,
rollback/conflict/error paths, wrong/exact restore, paused prefix recovery,
EN/UK mobile layout and controlled controller dialog ownership. Three completed
proofs and three prefixes independently replay. The final visible Cancel lives
beside the review title; destructive confirmation follows the impact details.
See `docs/fpv-pack-removal-recovery.md` and its bound receipts. Syntax/lint/format
pass. Frozen/package qualification and focused PR publication follow; no new
unit coverage, physical hardware or human acceptance is claimed.

Next concrete content increment: matching Self-level examples for the14 primary
Acro foundation lessons, then bounded optional Adventure examples. Existing178
installed examples include no alternate-mode school recordings; the60 archived
Adventure proofs are not installed. Sixteen advanced Acro skill lessons retain
unscored Self-level practice; do not invent completable Self-level trick demos.
C6 Stadium remains the parallel art slice:13 courses/21 bundled examples;
refine the existing stand/board solids through shared Themes factories, preserve
collision and the beginner42 landing platform's plain material region. Then
continue yard/Garage art, distinct maps and final H/R7 qualification. Player
feedback remains nonblocking and pending; all existing limits/gates remain.

Pack-recovery frozen candidate `e64e53be5a144919d32c71f3cbce91666f8c4345`
passes all three optional admissions, committed-input/ZIP validation and two
identical builds. World Studio is99 source files/14,465,716bytes. Packaged actual
HTTP/WebGL qualification also passes90/90. The largest edition independently
passes frozen admission and reproducibility at895files/67,094,087bytes, leaving
only14,777bytes beneath64MiB; plan additional demo data delivery separately and
retain this guard. Authoring dependencies were temporarily moved to ignored
.cache for source eligibility and restored by an EXIT trap. Runtime hashes match
the source-qualified candidate. Publish as an independent focused PR on main;
no native stack is needed for this item. Public deployment remains unverified.

Before publication, main advanced to21dbd1014 with merged editor#975, Themes#974
and WASM CSP#976. Recovery ref `codex/recovery/pack-removal-before-main-20261003`
preserves the earlier candidate. The unpublished branch was rebased linearly;
only additive delivery-log/plan conflicts required resolution, preserving both
histories. Runtime merged without conflicts. New source and packaged browser
fixtures both pass90/90; independent completed/prefix replay passes again.
Frozen candidate4bc19760ac2f89f1bbb73de94fa909718105fa7a passes all three optional
admissions and two identical builds, plus the largest edition. World Studio is
99files/14495347bytes; largest edition67,105,391bytes leaves3,473bytes
under64MiB. Keep subsequent example data separately delivered and verify current
capacity rather than expanding any limit. Current host SHA256:
`c3f2a71d5e44ffe1e26110b6712ae1f8fb9032a78337567ecb0e945c71e6e776`. Updated receipts replace prior
candidate receipts in the feature document; earlier evidence remains in Git.

### Pack recovery published — 3 October 2026

[PR #977](https://github.com/mekhovov/revealline/pull/977) is published and attached,
initial head `c0b04f355fc9d4a12a0b69acbe565328320dce40`, independently against main.
Final source and packaged hosts each pass90/90 checks; all three optional
admissions, largest-edition admission, committed inputs and reproducibility pass.
Player build `dist/fpv-pack-recovery-playtest` was rebuilt and launched at the
Library; ZIP SHA256 `57cf8df8f86bedc8891d3cdfe22925b8023216db2babc90bc86e36c1a1c084ea`.
The preceding user Creator preview remains untouched.

The initial release-ready job in run37089297268 reports **ADMISSION hold: no
immutable release slot**. This is a publication-policy hold, not a runtime test
failure. Preflight and staging succeeded; preserve the ordinary staging/review
process and all current protection. Do not allocate a version, change the title
to impersonate a release, or bypass the gate. Main advanced independently to
7d64e9ba8 with Snake campaigns; retain this feature head and inspect current
remote state before later integration. No public deployment claim for #977.

Next independent work is matching-mode school demonstrations and bounded
optional example import/selection. Player feedback remains nonblocking; physical
radio, novice acceptance and named-device performance remain unverified.

### Matching-mode optional examples — 3 October 2026

Independent branch **codex/fpv-optional-mode-examples**, based on main7d64e9ba8.
Main Snake#973 adds24challenges; current catalogue172challenges/14worlds/58school
lessons. Original178bundled demonstrations remain byte-identical. Fourteen
Self-level foundation examples are now generated/replayed/exported/imported and
replayed again, as a260391-byte optional archive outside the core download.
Player instructions and the archive are in
`authoring/fpv-worlds/demonstrations/optional/`.

Source and immutable packaged hosts each pass109/109 actual HTTP/WebGL checks.
This uncovered and repaired appearance-derived course lookup hiding lesson
examples: lab and Watch now use their exact authored source/recorded presentation
without changing player preferences. Imported examples are replay-verified, never
award progress, preserve pins including a concurrent-tab pin, and disappear from
Watch when removed. School/catalogue Watch follows selected flight mode.

Frozen candidate d4e27bd9400b0e5b872cbf0a019a52e2b048ff25 passes all three optional
admissions, committed inputs/ZIP checks and two identical builds. World102runtime
files/14476115bytes and104sourcefiles fit unchanged limits. Required closure
cleanup commit6086768bb removes only three unreachable inherited modules from
World admission. Academy and Civilian Flight retain their original dependencies.
See `docs/fpv-optional-mode-examples.md` and its bound receipts. No unit coverage,
physical-device, offline-network, novice-session or sustained-FPS claim.

Recovery PR#977 is assigned the already authorized milestone57. Its sole automatic
unallocated hold was removed after verifying that scheduling requirement. The
remote owner merged main into that branch atdb272c51c; preserve it. Its updated
optional-package failure is the same file-count issue fixed by6086768bb. The
company edition remains independently over64MiB by25634bytes, with zero FPV
runtime modules in that engine closure. Keep the guard and publication hold;
do not change immutable assets or global release authority as a shortcut.

Next: finish focused publication/recovery package repair, then60optional Adventure
examples and Stadium/yard/Garage art. Player feedback remains nonblocking.

### Recovery merged; matching-mode examples published — 3 October 2026

Recovery #977 merged at main f0d950864df3dd0de3960d398f5f40e7457de3ac.
The owner merged the newer Snake content first; that history is preserved.
Pages run37090715866 succeeded and the public marker identifies that exact main.
Browser launch remains separately required before claiming live availability.

Matching-mode examples are published as [PR #979](https://github.com/mekhovov/revealline/pull/979),
initial head9aba53763c95a242b9a21adffacaae255c9f674a, attached to this chat and
assigned the existing milestone57. Its local player build is
`dist/fpv-optional-examples-playtest`, ZIP SHA256
`8550173bd2954b49e5e9a56314b755eae4b6a47111d6ac9618fb190926d20568`.
The optional14-example archive is imported through Library; it is not silently
installed into player records. Main recovery was merged into this independent
branch to resolve the new host conflict. Fresh combined qualification follows.

The three-module closure correction ships in #979; #977 is already closed and
will not be rewritten. Main's company edition remains25634bytes over64MiB.
Optional-package success does not imply whole-edition capacity or release readiness.

Public verification: opened the actual deployed World Studio and completed the
Starting grid Self-level demonstration at26.6s with no browser error entries.
Pages run37090715866 and public marker both identify f0d950864, which contains
#977. Recovery is therefore live; #979 remains a separate pending PR. Screenshot:
`/tmp/fpv-public-recovery-20261003.png`. This launch does not qualify company
edition capacity or physical input hardware.

### Concurrent main preserved; optional examples requalified — 3 October 2026

The owner concurrently updated #979 to a4221046c with main #978. Both remote
commits are preserved by a normal merge; no force-push or native-stack retarget
was used. Main now has184challenges (36Snake Hunt) in14worlds. The source and
runtime World archives remain within unchanged104-file/16MiB limits: frozen
candidate eee011acdc6b5ed739289b0576334ef1f1d38241 has102runtime files /
14513098bytes and104source files, all three admissions and two identical builds.

Source/package examples are being rerun with an explicit Ready-state wait before
the lab click. One early-click qualification run paused on initial reduced-motion
publication while renderer preparation finished; no timeout or proof check was
relaxed. Preserve that failed receipt at /tmp/fpv-optional-examples-source-6-failure.json.
The complete source recovery flow passes90/90 on this same runtime graph.

The latest observed company candidate after #978 is921files/67401190bytes,
292326bytes over64MiB (run37091698383). This supersedes the25634-byte observation;
no FPV package limit or whole-edition guard has been changed. A public launch was
verified at f0d950864; later main deployment must be checked separately.

Next content is prepared in /tmp/fpv-adventure-example-audit:60Adventure proofs,
byte-identical to prior qualified proof envelopes, all complete/replayed and
export/import/replayed. Six optional world archives or one combined archive are
available. They still need a maintained exporter, player instructions and actual
browser import/playback qualification before a separate focused PR. None are
silently added to the core178examples. Continue Stadium/yard/Garage art after
this bounded data increment. Human feedback remains nonblocking.

Final combined verification: source and immutable packaged examples109/109 each,
recovery90/90 each, three completed and three interrupted recordings replayed
with matching identities. The fixture now waits for the visible Ready state and
initial host frame before starting the example; production replay checks are
unchanged. Host SHA25652cbfac9012bf2a7127ec1cfd85142ead184166aadb8a97818d886623c7db8f2.
Fresh local build: `dist/fpv-optional-examples-current-playtest`,94files/
14355327bytes, ZIP6126d9fd523e62a82cc4b76a185a278cec0f03c6650f89a328b0da48a5dc5661.
This development player includes the preserved #977/#978 main work and #979.

### Optional examples merged; focused recovery-refresh follow-up — 3 October 2026

The owner merged #979 at a6775a478cd9bfcbbd968ab247af7bfa307ec570 while final
integration evidence was being recorded. The merge included remote a4221046c.
The later forward push7bfcbf032 preserved all owner commits but happened after
that closure; it does not put the final12-line recovery-read fix on main.
The follow-up therefore lives independently on `codex/fpv-example-recovery-refresh`,
merged with current main. Its runtime delta only keeps fresh example records/cache
and rendered Library available when the independent interrupted-session read
fails, then reports that error while retaining known recovery data.

An explicit native IndexedDB session-read-abort scenario is being added to the
existing browser workflow before publishing that small fix. Preserve #979 as
merged; do not reopen or rewrite it. Optional14-example delivery is already in
main, but its public deployment/launch has not yet been checked.

Follow-up candidate9ca502490094d7c9db8b5d66fae6c90d7895eea3: source and immutable
packaged examples each pass117/117, including the native session-read abort and
retained recovery checks. All three frozen optional admissions pass, exact
committed inputs/ZIP members verified, two byte-identical builds; unchanged
World102runtime/104sourcefiles and14513098bytes. Package recovery90/90 receipts
remain bound to the identical runtime files and all retained proofs replay.
Source/packaged receipts have been refreshed; no human/device/performance claim.
Only three superseded reproducible /tmp qualification bundle directories were
removed under disk pressure; their committed receipts and player builds remain.
The current frozen bundle is /tmp/fpv-example-recovery-refresh-qualified-01.

### Recovery-refresh follow-up published — 3 October 2026

[PR #981](https://github.com/mekhovov/revealline/pull/981) is published and attached,
initial head7278451eca86a18c8b0dd2948296ba27ce6eea60, milestone57. It is independent
against main because parents #977/#979 are merged; no native stack is needed.
Source/package117/117 and combined recovery90/90 evidence is committed. Current
local player remains `dist/fpv-optional-examples-current-playtest` and uses the
same qualified production host. Public launch verified #977; #979/#981 public
availability is not yet claimed. Checks were running at publication, with an
older cancelled workflow's release-ready failure superseded by the scheduled
run still in progress; do not interpret that observation as a passed gate.

Next: inspect exact current head/checks and main deployment once; preserve owner
updates. Continue the60optional Adventure example delivery from current main on
a separate branch while #981 publication runs. The generator/archives/audit are
in /tmp/fpv-adventure-example-audit; choose six world downloads, add maintained
export safeguards, run actual import/playback, then publish a focused PR. No
unit coverage or human feedback prerequisite is added. Remaining artwork is
Stadium, container yard and Garage; remaining new distinct worlds and H/R7 follow.

### FlightDivision inspection and Two-stick controls — 3 October 2026

Main #981 and #982 are merged at baseline cf0b62e53. The owner explicitly asked
to inspect the logged-in FlightDivision simulator and implement its useful
control/art qualities. Settings, free flight, Gear and first lesson were inspected
through the browser. Branch `codex/fpv-two-stick-controls` adds its two-hand key
grouping as the default, with Classic selectable and one shared local preference
for Academy, World Studio and the school lab. Space arm/pause, R reset and F fire
use existing safety/recording paths; no radio calibration or physics changes.

Source and packaged actual-browser keyboard qualification each pass25/25. The
browser found and resolved a held-Space release swallowed by menu propagation;
the release-only capture listener now safely clears its own firing key. Final
World host SHA256 is4c2aa82dd59a217ace064fa331c25a0a60dc1b2680a99839e7ea1125a0115360.
All184 normalized catalogue entries/course/pack identities match the parent.
Packaged touch/regression checks pass32/32, including368 level/mode starts.
Existing regression fixtures explicitly select Classic and now account for the
36 merged Snake Hunt challenges. Scope/receipts: `docs/fpv-two-stick-controls.md`.
Additional unit coverage and actual physical-device acceptance remain open.

The separate visual branch `codex/fpv-flight-presentation` is preserved in
`/tmp/fpv-art-20261003`. Its drone/container work is still undergoing visual
review and must not enter the ready controls PR. Supporting baseline is identical
to the controls branch; no native stack is required unless a true dependency is
introduced. Further FlightDivision-level environment production remains planned,
not completed by this first model/surface increment.

Disk pressure prevented a full app-managed worktree creation. Only reproducible
generated runtime/assets from the superseded `/tmp/fpv-sim-entry-qualified-20261002`
were removed, after checking its build marker and absence of `.git`; metadata,
receipts, source worktrees and current player builds remain. The art branch uses
a sparse Git worktree with two production files. Qualification outputs remain
bounded; do not run a whole-site build into the remaining free space.

Frozen controls candidate6562df920 passed all three optional admissions,
committed inputs and ZIP members, with two byte-identical builds. Package review
gates remain pending. World102runtimefiles /14557129bytes; Academy67files /4220778bytes.
Packaged actual-WebGL section replay additionally passes53/53. Main advanced to
4fada3958 through unrelated Social Drone #983; no FPV dependency changed.

### Two-stick controls published — 3 October 2026

[PR #986](https://github.com/mekhovov/revealline/pull/986) is attached with
milestone57. The independent controls branch was rebased onto current main
4fada3958 with recovery ref `codex/recovery-fpv-two-stick-20261003`; all optional
runtime and verification bytes are unchanged. Exact-head checks remain required.
No native stack is needed. The separate art branch commit297760213 remains
isolated pending its renderer/browser and package qualification.

Post-rebase candidate4752ae5ef again passes all three package admissions,
committed-input/ZIP-member checks and two byte-identical builds. The admission
receipt is refreshed; browser evidence remains bound to identical runtime bytes.
CI/publication continues on #986 while art work remains independent.

### FlightDivision presentation increment — 3 October 2026

The user requested comparable visual quality and keyboard controls after
authenticated browser inspection of FlightDivision. Controls are published as
[PR #986](https://github.com/mekhovov/revealline/pull/986), current observed head
e4bd6044421c58b6e878710b7fe534b2ef063820. Source/package keyboard25/25, touch32/32,
WebGL section replay53/53 and all three frozen optional admissions pass. The
post-rebase bundle at /tmp/fpv-two-stick-qualified-main-02 verifies committed
inputs/ZIP members and two identical builds for4752ae5ef; later changes are
evidence only. Classic remains available; radio/physics contracts stay intact.

The company candidate failure is inherited exactly: main4fada3958 run37099932827
and PR986 run37100775504 both report923files /67460882bytes,352018bytes above
64MiB. Scoped optional-practice succeeds. Preserve the capacity guard and all
content; no public availability is claimed while protected publication is pending.

Independent branch codex/fpv-flight-presentation-delivery carries original local
quad/container geometry, initially cherry-picked from sparse art commit297760213.
It is being refined and qualified separately from controls. The updated delivery
sequence and reference observations are in fpv-flightdivision-reference-plan.md.
Current main is4fada3958; old native stacks remain closed, and no new native stack
is needed for these independent increments.

Final visual hashes are ed102bc426eca18307b89d5ba862254edeafa63ea22c98433b9432d80eba7fa3
(world-visuals) and0949fde59ee6fd5331940c167d5eef23ff2396fdd66cf79ae610ac863d252a97
(renderer). Final source and packaged actual-WebGL runs each pass90/90 over44
rendered pairs with no context loss. Manual CPU qualification passes109/109;
Pixel remains exact and material/texture counts do not increase. Development
World package has94runtimefiles /14407506bytes, SHA256
f7068627691de0666e70856924065c09a04a97e1a4f8cf97778593385bbe79d1.

Visual frozen candidate91945d5c0 passes all three optional admissions, committed
inputs/ZIP members and two identical builds. Source validate/lint/syntax/format
pass. Packaged Container survey launches, verifies its recording and resumes
actual WebGL playback without rewards. Next publication is the focused art PR;
Stadium/Garage and the broader14-world asset pass remain planned, not completed.

### Visual increment published — 3 October 2026

[PR #987](https://github.com/mekhovov/revealline/pull/987) is published and attached,
initial head e1cf7dbe4, milestone57. It is independent of controls #986 against
main4fada3958. Packaged Container survey completed its57.3-second verified
playback through the actual WebGL player; it awarded no rewards. Art source/package
90/90, CPU109/109 and all three frozen admissions remain green. Broader world
art, named-device FPS and human qualification remain open.

A separate local integration branch may combine #986/#987 solely to build the
user's combined playtest. Do not push that merge into either focused PR. Continue
Stadium/Garage on current main or an explicit dependent branch, preserving these
ready candidates and all existing proof identities.

### D1 Woodland rendering foundation — 3 October 2026

Independent branch `codex/fpv-woodland-canopy-batching` starts from accepted main
`1aef4d70fa37c8911dbb47b4b128c253178c8b60`. It batches 66 background crowns into
24 spatial/material groups, retaining original geometry within float32 precision,
colors and placement. No course/collision/physics/input changes. #987's concurrent
Container/quad work is preserved; no dependency or native stack is needed.

Functional browser qualification passed 12 cases / 60 rendered comparisons,
including both Woodland bounds, Pixel, Meadow, three presets and shadows.
Registered Woodland geometry decreases 144→79; Balanced overview calls decrease
276→192. Twelve disposal cycles show no growing allocation. Existing package
preparation passes at 94files/14,400,550bytes. See
`docs/fpv-woodland-canopy-batching.md` for evidence and measurement limitations.
This is D1's rendering foundation, not completed Woodland art or measured FPS.

#989 capacity checks were still running at the start of this increment. Next:
qualify/publish this focused increment; continue original Woodland asset detail
and Container composition while protected CI runs. Preserve physical-device and
full-release qualification as outstanding, without waiting on player feedback.

Published as [PR #990](https://github.com/mekhovov/revealline/pull/990), head
16c5809a0de11735d4d4e6b45e7b1f7cba077856 before this log-only update. Required
CI is pending; no live deployment claim. Capacity #989 now passes focused and
default-capacity checks, but its preview and edition candidate jobs failed;
inspect those failures next without weakening admission guards.

### D1 primary Woodland composition — 3 October 2026

Continued on independent `codex/fpv-woodland-depth-composition` from main
3d04f9ab04980a8c51d3c28512ace7e024ebae51. Forty existing imported trees form layered
groves; benches and flight geometry stay exact. Actual GLTFLoader clearance and
five unaffected environment byte comparisons pass. Package admission passes at
94 files/15,382,549 bytes. Existing checks are 29/30: shared-theme enamel uniqueness
fails in unchanged code and remains outstanding. See `docs/fpv-woodland-depth.md`.
#989 is rerunning CI; preserve its externally updated fe449dcf3 head. #992 and #993
remain open. Continue Container Yard landmarks and remaining D1 materials; then
D2 world pairs. Do not count this composition pass as complete art qualification.

### D1 Container Yard frontages — 3 October 2026

Independent branch `codex/fpv-yard-landmark-composition`, baseline b43b0ce12,
changes only primary imported Yard composition. Three arena sizes pass actual
GLTFLoader vertex clearance, with unchanged sampled draw/triangle counts and
five other GLBs byte-identical. Package passes at 94 files/15,384,159 bytes.
29/30 existing checks pass; shared-theme enamel motif uniqueness remains open.
See `docs/fpv-yard-landmarks.md`. Next: isolate that existing qualification failure,
then continue primary material depth and remaining world art. D1 remains open.

### D0 approved capacity increment — 3 October 2026

Working branch `codex/fpv-d0-offline-capacity`, based on main
`4fada39581777da9ca4111f50ec3b650803cdfa8`. Preserve local combined playtest
`codex/fpv-flightdivision-combined-playtest`; do not push its integration merge
into #986 or #987. The owner approved a 72 MiB shared-core capacity; Company editions use their separately enforced 80 MiB package budget. Verification retains lossless compression and all optional SIM limits.

Implementation and current evidence: `docs/verification/fpv-d0-capacity/README.md`.
All 18 company editions fit; existing focused checks 132 passed; actual browser
72 MiB installation, staging and corrupt-update fallback passed. Publication and
physical devices are not verified. The approved D0–D6 world-quality-first order
is recorded at the top of `docs/fpv-reviewed-delivery-plan.md`.

Next: finish exact candidate preparation and publish the focused capacity PR.
Let protected CI qualify it, then refresh #986/#987 on current main without
mixing incomplete D1 artwork into either. Continue Container Yard / Woodland
rendering baseline independently. Full post-activation rollback and device
qualification remain explicitly separate from the staging/fallback exercise.

Candidate649887eed completed committed-source verification and default in-memory
preparation:67,094,501bytes/1,327files,8,402,971bytes headroom. Browser normal
activation and post-activation rollback also passed at72MiB. See core/rollback
receipts. During qualification #986 advanced externally to
cba2532f73ac078b8d013bd5341c1acd836cdeac via a main merge; preserve that work.
#987 remains e808af302f1bf1480471646240d54371feb9b607.

Refreshed onto main4074b12f7, retaining merged Neon sharing and workflow fixes.
Final runtime candidate8162e7d4d62999a630b4daf43721f613b3b3ef8f passes committed
source-bound core preparation:67,073,221bytes/1,328files,8,424,251bytes headroom.
All18editions and132focused checks pass again. Registry preserves6,297current
identities and saves308,129bytes. Browser72MiB activation/rollback evidence uses
the identical production worker; the refreshed registry also passed browser
equality. Only evidence/docs change after this candidate.

### Capacity PR published; controls merged — 3 October 2026

[PR #989](https://github.com/mekhovov/revealline/pull/989) is published and attached
in the existing milestone57; no version or native stack was allocated. #986 merged
as1aef4d70fa37c8911dbb47b4b128c253178c8b60 while publication was running. The
capacity branch was rebased onto that main with a recovery ref, preserving both
sides of the delivery-log conflict. All capacity runtime/compiler bytes match the
qualified candidate;132focused checks pass after this rebase. Source-bound core
and edition receipts remain explicitly tied to their recorded candidate, not a
claim that current-head CI or public deployment has passed.

#987 advanced externally to72818f59f502b2440eb9ae9d9b275cad1ecbc875; preserve it.
Next: let #989 exact-head protected checks run, resolve routine reported failures,
and verify deployment before calling the budget live. Continue D1 Container Yard
and Woodland baseline/art independently. Do not repeatedly poll unchanged CI.

### Capacity CI correction and independent Woodland publication — 3 October 2026

#989's default-capacity/focused jobs passed. Edition admission failed because the
candidate writer already permits selected `game/snake/index.html` and
`game/snake/play.html` entries while the admission validator did not. Align the
validator's exact entry list with the existing writer; retain all hash, inventory,
archive, size and source-eligibility checks. Two preview host tests timed out;
both pass locally with no timeout/policy changes.

29 existing admission/bundle/menu-style/win-picture checks pass. Real in-memory
`fpv-learning` and `droneaid-nl-community` candidate ZIP members pass corrected
admission (36,578,413 and 67,464,718bytes respectively). Their publicEligible flag
remains false pending normal publication qualification. No new unit coverage or
physical-device performance claim; current-head CI must rerun.

Independent D1 rendering foundation is published in PR #990 at690897542:
24 spatial/material batches replace66 individual Woodland crown meshes, retaining
silhouettes and placement. 12cases/60browser comparisons and package preparation
pass. See that PR's `docs/fpv-woodland-canopy-batching.md`. Next art work remains
Woodland natural detail/Container composition. #987 concurrent work is preserved.

### Owner directive: continue across phase boundaries — 3 October 2026

After completing and functionally verifying each increment, publish the focused
PR and immediately implement the next approved item. Completion of a phase is a
handoff into the next phase, not a stopping point or a new approval request. Keep
CI/publication separate from unfinished next-item work. This standing instruction
is now recorded in the reviewed delivery plan. D1 art remains next; the canopy
optimization alone does not complete D1.

### D1 Woodland foliage surfaces — 3 October 2026

#987 and #990 are merged. Independent branch `codex/fpv-woodland-foliage-surfaces`
starts at main a8c808a26447dcea17c82852cb07b24d3059d2cb. Original shared leaf-cluster
maps, underside shading and background bark replace flat authored Woodland tree
surfaces. Geometry, silhouette, collision, routes, actors and physics are unchanged;
Pixel/shared appearance overrides remain intact. No extra draw calls.

15 browser cases / 90 rendered comparisons pass, including all presets and
Industrial Workshop/Pixel/Meadow regression. Vertices remain exact and those
three unaffected styles remain pixel-identical. Fifteen unload cycles plateau.
21 existing checks pass; World Studio prepares at94files/14,410,935bytes. See
`docs/fpv-woodland-foliage-surfaces.md`. No physical-FPS or live availability claim.
Next: publish this surface increment and immediately continue original branching
and canopy composition on a separate branch. Do not treat this increment as D1
completion. Continue approved phases without another go-ahead.

### Yard publication and material qualification repair — 3 October 2026

Yard composition is published as draft #998, independent of Woodland #996.
Immediately continued on `codex/fpv-field-surface-identity` to resolve the shared
qualification failure. Military-field's foundry recipe collapsed to the DOS
light/dark motif. Dedicated recessed panels restore distinct identity without
changing 112 maps across the other 16 collections. All 30 existing checks and
browser map comparisons pass; package admission passes at 94files/15,383,912bytes.
See `docs/fpv-field-surface-identity.md`. Next: publish this focused repair, refresh
art PRs after protected integration, continue D1 material depth; do not call D1
complete or public availability verified. Preserve concurrent capacity/Theme work.

### Stadium surfaces qualified; remaining world order refreshed — 3 October 2026

Working branch `codex/fpv-stadium-structure-detail`, managed checkout
`/Users/oleksandr.mekhovov/.codex/worktrees/fpv-stadium-structures/go_test`.
Runtime candidate `698b6aa3092b2ca235d32e10e994134658f33db6` improves only the
three canonical Stadium stand/scoreboard solids, keeping collision bodies,
course identities, school platform and all 14 Snake Stadium layouts unchanged.
All 21 Stadium demonstrations replay to the same final identities. The new
surface/detail path adds seven bounded batches / 888 triangles, no new shadow
casters or asset files. `docs/fpv-stadium-structures.md` records full evidence.

Source and packaged browser closures each pass 484 checks / 228 image pairs,
including all qualities, camera views, Pixel/shared Themes, unchanged support
solids, ray parity, imported/fallback scenery and three stable load/disposal
rounds. Actual packaged-player selection, rendered flight, deliberate arm and
pause were verified. All three source-bound optional admissions pass, including
committed inputs, ZIP equality and two byte-identical builds. Runtime manifest:
93 files / 15,375,227 bytes; source-bound World Studio: 102 / 15,550,157 bytes.
No unit coverage added or hardware/FPS/human/public-live acceptance claimed.

D0 #989 is merged. #992 foliage surfaces merged while this work was verified.
#993 was refreshed on main in its separate repair checkout and remains draft:
29/30 existing scoped checks pass; the remaining known enamel-motif failure is
fixed by pending #999. #999 advanced externally to b6133b882; preserve that head.
#996/#998/#1001 still require refresh and current-head checks. Pixel profile
resolution in #1001 is fixed at28fd01836. A local-only combined art branch
`codex/fpv-art-combined-verification` at51e3b6d66 passed15 arena/preset comparisons
and15 GPU cleanup cycles; do not publish it as a replacement for focused PRs.

The reviewed plan now records196 authored challenges/14 worlds/58 school lessons;
32 already planned new-world challenges make the eventual target228. This count
is not a claim of artist/player acceptance. D1 acceptance/render budgets remain
open; continue independent D2 world work while publication runs. Next code item:
Garage exact-ID ramp/deck/column surface readability on isolated branch
`codex/fpv-garage-surface-detail` in the managed `fpv-garage-surfaces` checkout.
Keep `school-upper-deck`, all9 Snake Garage layouts and17 demonstrations intact.
Stadium publication status will be appended after PR creation; no new stack is
required for this independent main-based increment.

Published as [PR #1004](https://github.com/mekhovov/revealline/pull/1004), using
existing milestone57. Main advanced to ce6af3e65 (#999 merged) during publication;
the main merge preserves both delivery histories. The
prior browser/admission receipts remain tied to698b6aa30. Current integration
qualification is recorded separately; no live claim or protection bypass.

Runtime candidate70679d3ab passes30 existing visual/acceptance checks,32 functional
checks with21 exact demonstration replays, and allthree frozen optional admissions
with committed-input/ZIP verification and two byte-identical builds. The only
visual-module integration delta from the browser-qualified candidate is#999's
Military Field recipe; Stadium renderer/helpers remain identical. Main's#999merge
unintentionally removed#992 foliage code; separate#993repair restores it and keeps
that work out of the independent StadiumPR. Local player build is available at
port8834/dist/fpv-stadium-playtest-70679d3ab/optional-practice/fpv-worlds/index.html.

### D1 continued without waiting: both Woodland scenery paths — 3 October 2026

Surface increment published as PR #992 on `codex/fpv-woodland-foliage-surfaces`.
Its leaf/bark changes affect the procedural fallback; the primary World Studio
scene loads licensed Kenney assets and hides that fallback. Keep this distinction
explicit rather than claiming the fallback pass finishes the normal world art.

Immediately continued independently from main a8c808a on
`codex/fpv-woodland-tree-forms`. Primary imported trees now receive individual
orientations with recalculated safe footprints. Procedural trees receive clustered
crowns and batched forks. All new vertices stay outside playable bounds; five
other imported environment GLBs remain byte-identical. No physics/content identity
change. 15cases/90browser views plus two actual GLTFLoader scenes pass; 30 existing
checks and 94file/14,411,732byte package preparation pass. The fallback has an
explicit additional triangle cost; primary-scene sampled calls/triangles remain
unchanged. Evidence: `docs/fpv-woodland-tree-forms.md`.

Next: primary imported Woodland composition/material depth and Container Yard
landmarks, preserving #992 and this ready model increment. D1 is not yet complete;
continue into D2 when its remaining art and functional evidence are complete.

Published tree forms as [PR #993](https://github.com/mekhovov/revealline/pull/993),
implementation head 81c9bbbe8. Packaged player launch on an isolated localhost
origin completed Clearing check-in's 23.7-second demonstration with no captured
browser errors. The user's existing port-8789 recovery state was not changed.
Package SHA-256: 349f34b9b7760caec405594d7534ee0fa750d10343ef9e4ecfc3541ac230cbff.
Both #992 and #993 remain pending protected publication; no public-live or sustained
hardware-FPS claim. Continue the primary scene composition work next.

### Woodland tree forms publication refresh — 3 October 2026

Refreshed #993 from its preserved `55296ddf2` head onto main `822188e9b`,
including merged foliage #992 and current capacity rules. Retained both delivery
histories and combined foliage materials/vertex colors with the clustered crowns,
branch forks and imported tree rotations. Manual source geometry/ownership checks,
template/runtime equality, lint/formatting and 94-file / 15,388,669-byte development
package preparation pass. See `docs/fpv-woodland-tree-forms.md` and its new receipt.

Existing scoped checks remain 29/30 because main still lacks #999's shared enamel
motif repair. Keep #993 draft until that fix merges and current-head qualification
passes; do not copy the independent fix or weaken admission. Historical browser
evidence is retained separately. No fresh browser, full-art, device-FPS or public
availability claim is made by this publication refresh.

### Woodland qualification repaired after #999 — 3 October 2026

Merged main `ce6af3e65` into #993 and retained both delivery histories. The new
main had removed #992 foliage while integrating the field recipe; this refresh
restores the existing leaf/bark maps and vertex colors alongside tree forms and
keeps the independent field fix. The resolved visual module is byte-identical to
reviewed combined source `51e3b6`; imported assets/template remain unchanged from
the prior #993 refresh. World resource ownership and Pixel/form behavior retain
the reviewed implementation.

All 30 scoped existing checks, source/package module equality, lint/formatting,
whitespace checks and 94-file / 15,389,187-byte package preparation pass. The local
qualification hold is resolved; preserve the earlier 29/30 result as history.
Return #993 to ready and use protected merge-commit auto-merge only after normal
head-specific checks. No native stack, admission guard, release tag or public
deployment is changed by this refresh. See the new maince6 qualification receipt.

### Yard draft refreshed onto integrated Woodland main — 3 October 2026

#998 runtime candidate ec760db263041be23f60f4450381dc4ec88ec402 integrates main
a1cb86c85, including #1006, without replacing concurrent feature work. The existing
30 checks pass; the scenery template/runtime match. All three frozen optional
admissions pass with committed input/ZIP identity and two reproducible builds.
Frozen current-main browser review and normal full CI remain pending. The sparse
local checkout cannot run complete global validation because unrelated content
assets are omitted. See docs/fpv-yard-landmarks.md and its new bounded receipts.
Keep #998 draft until the browser review is complete; no human/device or public
acceptance is inferred.

The current-main Yard browser review then passed all three arena cases with
58 placements, 98,880 clear vertices and unchanged sampled draw/triangle counts
per scene. Five other environment GLBs remain byte-identical; the comparison
views were inspected. This completes the local draft qualification. Publish the
reviewed #998 head through normal exact-head protected CI; public deployment and
physical-device/artist acceptance remain separate.

### Review and primary Woodland lighting — 3 October 2026

#999 passed every reported GitHub check at feb04b6ad; main then advanced. Merged
current main into its branch, reran 30 passing existing checks, pushed d4408637c
and enabled protected MERGE auto-merge (repository does not allow squash).
Current-head CI must finish again. Preserve #989's external 7154c28e2 update.
#996/#998 drafts await the fix and exact-head requalification; do not claim merged.

Continued independently from e0e1db096 on `codex/fpv-woodland-material-response`.
Primary park materials were unlit; enabled PBR only for eight known natural
Woodland surfaces with explicit physical values. Three Pixel variants and five
other worlds remain byte-identical; both Woodland bounds pass actual browser
material/clearance checks. Package 94files/15,384,550bytes passes. See qualification
document. This is material response, not new high-resolution source art.

Remaining order: (1) protected fix integration and refresh ready art branches;
(2) combined D1 Woodland/Yard rendering and disposal verification, with named-device
performance still pending; (3) remaining environment pairs starting Stadium/Garage;
(4) optional examples/learning and creator improvements; (5) deferred unit/release
qualification. Feedback does not block implementation; no device acceptance is
invented. Keep finished PRs separate from new work.
inspect those failures next without weakening admission guards.

### Woodland groves refreshed after Yard publication — 3 October 2026

#996 candidate fabb417ec23e1fcaaabf90cd0c102a9f9335efed integrates main b3167a8f89,
including merged Yard #998 and replacement tree forms #1006. Preserve the rotated
footprint calculation and per-tree turn when composing groves; the shared
renderer/visual modules remain byte-identical to main. #1001 is kept separate.
All 30 existing checks and all three source-bound optional admissions pass;
18 other imported environment/arena GLBs remain exact. Frozen current-main
browser review and exact-head CI are pending. Complete global validation requires
CI because the sparse checkout omits unrelated content packs. No additional unit
coverage, hardware/artist acceptance or live deployment is claimed.

The frozen #996 browser comparison then passed both Woodland arena sizes at
fabb417ec. Both retain 52 placements and 16,080 clear imported vertices. Woodland-08
sampled calls rise 24→30 and triangles 2,594→2,746 as grove visibility changes;
Beginner-40 stays 22 calls / 2,342 triangles. Views were inspected, without a
hardware or human-artist acceptance claim. Integration of published Hangar main
ea596d80 yields 039be4e7c: scenery and renderer bytes remain exact; inherited
Hangar visual changes are inside the indoor branch and do not affect Woodland.
All 30 checks and three reproducible admissions pass again. Preserve the explicit
browser candidate identity and use protected exact-head publication.

### D1 production and cached-player evidence — 3 October 2026

Historical combined candidate `e572026ba357f3194bf47e7137a0817cacb1a640` passed
source and admitted-package production checks: 90 configurations, three rounds,
60 theme controls and all 14 lifecycle/resource gates. Full receipts are retained
losslessly as bounded gzip archives; the semantic comparison has zero differences
across 72,680 leaves. Actual admitted-player preparation, local-origin-unavailable
reload, Woodland/Yard selection, rendered arm and pause also passed. Timings retain
large unexplained pauses; no sustained hardware-performance claim follows.
See [the qualification and limits](fpv-d1-production-qualification.md).

Repair #1011 and groves #996 are merged. Public marker `e40809f25ea8` plus actual
Clearing check-in render/arm/pause establishes grove availability. Meadow #1010 is
merged at `e98df020d`; its public check remains separate. Material #1001 and
Courtyard #1012 continue protected publication; Warehouse exterior composition is
the next independent art increment. This evidence-only checkpoint changes no
runtime and does not claim the historical matrix tests newer main code.

### Bounded transition follow-up and publication checkpoint — 3 October 2026

The separate e572 v2 diagnostic completed 36 preparations/six imported loads,
with maximum preparation 77.4 ms and loading 11.2 ms. It did not reproduce the
historical 15–17 second stalls. Full source-bound receipt, both harness versions,
analysis, long-task records and the v1 summary-only limitation are preserved in
[bounded transition profiling](fpv-d1-transition-profile.md). Course setup up to
294.9 ms, quality changes up to195.5 ms and PMREM up to101.1 ms remain measured
investigation leads; no production fix or hardware-performance claim is made.

Meadow #1010 is live at marker e98df020d with Turn and travel render/arm/pause
verified. Material #1001 is merged at25700b699; public acceptance remains separate.
Courtyard #1012 and Warehouse #1014 are ready. Warehouse's b5a7a3b5a head retains
437 checks/221 image pairs, the actual102fcd admitted-player launch and integrated
860ad admission with35,925 bytes of original-input headroom. Their exact-head
checks and public deployment remain distinct gates. Continue the next approved
Airfield/Quarry pair while publication proceeds.

Documentation #1013's prior a24d82c36 head passed required preflight, focused and
release-ready checks in run37151674485; test/build were skipped, not passed.
This evidence continuation requires its own fresh exact-head checks.

### D1 environment light reuse and graphics recovery — 4 October 2026

The focused `codex/fpv-environment-light-reuse` increment is locally qualified at
`06d154e765c8332e5778bc51945799ee115353ac` on main `47d2019d`. One renderer-owned
PMREM target is reused for identical exact normalized lighting inputs. Actual
graphics loss releases scene ownership before restoration, allowing existing
flight Retry to rebuild safely. Editor/import guards preserve blank startup,
healthy course changes during asynchronous editor loading and stale-load
rejection after loss.

Full validate, 63 manual checks, 30 existing checks and all three reproducible
source-bound package admissions pass. The actual final 102-file admitted editor
passes 11 loss/restoration/control/cleanup checks. Earlier actual flight Retry
and 72-pair source/package evidence retain their exact candidate identities.
Original inputs leave 19,121 bytes below 16 MiB. See
[the complete evidence and limits](fpv-environment-light-reuse.md), including the
preserved isolated imported-image mismatch. No hardware FPS or fix for the
unreproduced long stalls is claimed. Publish through exact-head protected checks;
merge and public availability remain separate.

### Orchard authored tree surfaces — 4 October 2026

The candidate on main a46 replaces only six existing Orchard bark/leaf maps.
Original tree shapes, UVs, collision, actors, guide/cart routes and owners remain
exact. The root reviewer accepted v2 close and avenue views; the overly fine v1
textures and original screenshots remain retained. CPU378checks/89scenes and
all30existing checks pass. Ten original authenticated recordings replay exactly
through39,525ticks, with ten Rapier worlds freed once.

Source and admitted-package WebGL each pass96checks/43pairs, with exact functional,
image, draw-budget and resource results. All three source-bound packages pass two
identical builds; all 95inputs are committed and leave11,488B under16MiB. The full
102-file admitted player renders, arms0.2s and pauses0.3s with no warning/error
logs. See [Orchard qualification](fpv-orchard-tree-surfaces.md). Protected publication
and public availability remain separate; no hardware FPS or whole-world realism
claim follows. Continue independent Solar work and the next approved D3 optional
Adventure conversion audit without mixing unfinished items into this focused PR.

### Optional Adventure examples — 4 October 2026

The separate data-only increment on Orchard main `5e4abe273` delivers 60 existing
Adventure proofs as one 4,637,320-byte optional `FPVProofArchive.v2` download.
All 30 courses retain both modes; no core registry, source limit, physics or
player runtime changes. Portable conversion passes 992 checks and 120 exact
replays. Historical bf/9efa admitted-host browser evidence passes 395 checks,
all 60 import/lookup/persistence identities and 12 complete rendered examples.
The incoming Orchard surface change has its own source/package and replay
qualification; no new browser rendering on5e4 is claimed.

The full v1–v4 failed/partial diagnostics remain alongside accepted v5 evidence.
Repeated full-library diagnostic snapshots caused substantial observer overhead;
v5 forwards real renderer draws and preserves the production pause guard. The
separate explicit host-dispose ordering defect remains next. Publish through
protected exact-head checks and verify the public optional JSON link after merge.
See [complete qualification and limits](fpv-adventure-optional-examples.md).

### D4 standalone creator starters — 4 October 2026

The focused increment on School main `c907b4f7f` adds ten original one-course
industrial/natural projects: sweeper, hairpin, chicane, climb and split level.
Each has independent mode arrays, EN/UK guidance and reproducible editable ZIP,
world-pack and project exports through existing APIs. It adds no player module,
catalogue entry or optional-runtime source bytes; 196 challenges / 14 worlds and
the existing package limits remain unchanged.

Twenty ordinary-control flights and independent replays pass in 55,804 ticks
with zero hard contacts. Nominal clearance passes 314 swept segments; it is
bounded authored-path evidence. Actual browser r2 passes 237/237 checks on the
unchanged 102-member admitted `d9ad2561e` player: ten ZIP identities, two numeric
editor workflows, four original mode replays, a trusted 3D arrow drag, exact
Undo/Redo, export/reimport, retained original pack revision and online native
IndexedDB reopening. The manual upper-gate move is 3,500 mm along X. Edited
copies do not inherit the original routes' flight or clearance qualification.

The original r4 scalar-identity qualifier failure and r1 browser reopen failure
are retained. r1's fixture incorrectly borrowed the parent's native IDB factory;
r2 keeps each reader in its own JavaScript realm and verifies the prototypes and
public Edit flow. No production guard changed. See the
[starter qualification and raw receipts](../authoring/fpv-worlds/starters/evidence/README.md).

Publish this completed authoring increment independently. Continue explicit
spatial mode choice through route edits/order/Undo/Redo/source overrides in a
separate branch after runtime-capacity review. Separate localhost offline
qualification now passes on the same admitted player: actual Prepare offline,
stopped origin with two curl exit-7 probes, reload/Workshop render, native keyboard
edit, two Undo/Redo pairs, edited installation, reload, and restoration of both
the original and edited revisions. Logs are empty; the dedicated server is
restored afterward. The raw receipt and screenshots are in the starter evidence.
This is not device-wide offline, browser restart, storage eviction or public-path
qualification. Neither this increment nor browser checks close full D4, hardware,
novice or sustained-FPS acceptance. Additional unit coverage remains in D6.

### 4 October — Owner reallocation and publication completion

The owner adopted publication first, engineering concentrated on performance,
Library delivery and integrated reliability, and art/content concentrated on
Reservoir as the representative quality standard. Festival is preserved at
47f8e36e; finish Festival, Harbor and Canals one at a time after that standard,
then D6. Functional verification remains continuous; extra unit coverage is D6.
The allocation is recorded in #1069 on codex/fpv-allocation-priorities.

Completed protected publication:

- #1065 merged bf9b0290970f548738c719fbd47d57be93004be2; its marker and native
  public launch/zero-throttle arming/pause were verified.
- #1067 merged 29e23a11fa2e6226b1970855f9a6ef63b870c652. Frozen admitted
  readiness candidate 53d passed 141 actual browser checks; no general FPS gain.
- #1066 merged 94548aa26d489ecd93ec23274208fb7a6dd733e7 after exact-head
  500ee518e4a7210d3de5fce304d0f2d02a8793da checks and holds were audited.
  All 18 Reservoir tree children match qualified 34ba byte-for-byte; the latest
  ordinary merge only incorporated accepted main. No stack/bypass was needed.
- Public main-deployment.json now identifies 94548. Root reloaded the native
  public SIM, started Lift and land, armed at zero throttle and paused normally.
  Reservoir's production Library registration still remains; general SIM entry
  does not imply that a newly published optional pack is already discoverable.

Current independent candidates:

- Library worker preparation 503d62f4a77ef29b032ce55016bc2e13ad75bee8, clean
  codex/fpv-generated-worker-capacity in garage checkout. Recovers 1716 bytes;
  exact AST/tokens/comments/line endings plus generator/lint/scoped checks pass.
  Current-main integration, full admissions and admitted worker smoke remain.
- Library dedicated-worker transport a0784ea613 is preserved separately. The old
  source fixture's 195 passes predate transport; its page-fetch admission FAILED
  the existing guard. Do not reuse that evidence for actual Worker cancellation,
  transfer/hash/truncation/fault qualification or weaken the network guard.
- Menu access 7e6b2e227178aad638a980ec159a75425b6683a9, clean
  codex/fpv-library-menu-access in /private/tmp/fpv-delivery-review-20261004.
  Reachable EN/UK and 320/390px source UI checks passed; full admission remains.
- Focus runtime 58d89b606b068be706e1914c4e083a32d7e623fe and corrected fixture
  c205ffd070b753990caee0c2110fc03c38762f85 in editor checkout.
  Actual native-browser r2 passes 145/145, including trusted Tab/Shift+Tab,
  retained appearance focus/parent menu and deliberate subsequent arm.
  /tmp/fpv-prearm-focus-r2.json and PNG were saved. This is declared-source-overlay
  evidence, not current-main/package admission. Existing 16 checks also pass.
  Audio runtime unchanged; only the old diagnostic's initial-snapshot assumption
  was corrected. Admission/current-main integration/publication remain.
- Reservoir terrain-stitching branch is clean at published 34ba; Festival 47f8
  and its recovery ref remain intact. Root and art audit confirmed sky-colored
  slivers at the terrace/ridge join. Proposed narrow boundary closure adds
  34 triangles, reuses existing material and preserves collision/routes.
  FIRST WRITE FAILED ENOSPC; source SHA beea7973e6ae1e6adfa33d326ca5dfd46b525ad08aa87eb88dd864843933daa5
  remains intact. No repaired asset/proof claim.

Next performance investigation: matched Yard and actor-free first-ready actor/
camera initialization versus shader preparation, native clocks, same state/pose,
actor/program/resource counts and first/second draw. Existing timing evidence is
mixed; no cache expansion or broad physics/rendering rewrite is justified.

Storage remains an external blocker despite fluctuating df free-space figures
(116-481 MiB). Tiny source/plan writes still fail ENOSPC. Root's earlier local
delivery-log append did NOT persist; this remote checkpoint preserves the state.
All original worktrees/source/failures/published packs remain. Do not delete
unknown Git packs, repeat heavy builds or claim failed writes succeeded.
User has been asked to free at least 2 GiB. No automation state was changed.

### 4 October — Menu qualification and engineering publication checkpoint

The earlier storage-blocked checkpoint above is historical. Storage recovered and
the authorized serial source validation/admissions resumed. The owner allocation
remains publication first, then performance, Library delivery and integrated
reliability; Reservoir remains the representative art standard before the
preserved Festival, Harbor and Canals work, followed by D6 unit coverage.

Worker projection #1075 merged as
`da0bd0d6be2b42a4d2f954ebdcb1f970311b0da5` from exact reviewed
`727a68d00622a93a56425b006999f0e474a40d3d`. Pages run 37216276847 succeeded;
both public deployment/build markers identify that merge. Its parents retain
main `f3764070e` and the qualified worker head. Actual public UI launch of this
new marker remains a separate coordinator check. The worker prerequisite's
native Worlds/Academy offline acceptance remains documented.

Menu source `411396374bf25a1888a4a861c089d19671fd8432` is qualified for focused
publication: full validation, pinned format/generator equality and all three
two-build admissions passed. Exact admitted Worlds/Academy players retain
102/69 members with no overlays. Six source and seven final admitted native
iframe layout observations cover 320/390/844/1280 CSS widths, reachable EN/UK
Settings, retained language after Reload, readable tabs/footer and wrapped header
actions. Native Worlds arming/pause and Academy practice/pause passed; Academy
used the full-window fallback when native fullscreen returned false. Undiagnosed
observer TypeError logs remain disclosed; no zero-console, physical-device,
hardware-FPS or new offline claim is made. Superseded narrow-layout candidates
remain historical. See [menu qualification](fpv-library-menu-access.md).

Library transport remains separate at admitted source `01fc6ad20`. The genuine
dedicated-Worker source fixture passed 208 controls and the all-three/two-build
admission passed, with 918 bytes of Worlds source reserve before menu/focus
integration. Its direct native Worlds and Academy players passed preparation,
stopped-origin reload and entry/pause. However, the exact admitted Library matrix
twice stopped after 119 controls waiting for the selected course's Ready text,
including an exclusive-focus repeat. The new bounded status/focus/RAF diagnostic
also reproduced that timeout; analysis is pending. The frozen runtime and guards
are unchanged. Do not claim 208 admitted controls, weaken the network/pause guard
or publish a finished production catalogue row on that evidence.

Focus #1076 is ready on current main and undergoing protected exact-head checks.
Reservoir r9 #1077 is separately published; its required source release-ready
check passed while the appearance check was still running at the bounded audit.
The later r10 content candidate passed 575 CPU controls including sixteen fresh
ordinary flights and independent/archive replays. Its visual/art acceptance
remains pending, so r10 is not called accepted or published. First-ready resource
investigation continues with bounded native program attribution; no broad
performance gain or cache rewrite is claimed.

### 4 October — Combined native and stopped-origin acceptance

Historical combined source `216b36ce1` now passes 208 native Library controls,
145 native appearance-focus controls (including trusted Tab/Shift+Tab), seven
responsive iframe observations, and both admitted players' native offline
reopens. Worlds Library and Academy Flight guide preparations completed through
public controls; trusted Enter activated controls where an initial click only
focused them. The known8939 server was stopped, with refused curl connections
before and after actual reload/launch/pause in both Worlds and Academy. This is
an own-origin outage check, not browser-wide offline, eviction or hardware/FPS
acceptance. The exact server was restored after the check.

The complete receipts/screenshots are losslessly retained in
[combined qualification](fpv-library-integrated-reliability.md). Its 95 original
inputs remain exact at16,776,664 bytes with552 bytes reserve; no unfinished shadow
prototype was included. Focus #1076 merged `b98205d76` and menu #1079 merged
`e7d06f3c6` through the normal protected path. Library #1080 received an ordinary
main update to`2cfc24050`; all 95 input hashes exactly match the admitted combined
candidate and fresh protected checks are pending. No new public deployment is
inferred from local or historical package acceptance.

### 4 October — Library live and personal-best access qualification

The pending Library status above is historical. #1080 merged as
`8e5ad71e9b791b7c16bae1cb308026ed3e18d5c2`. Both public deployment/build markers
now identify that revision. The coordinator reloaded the actual public Worlds
player, entered briefing, deliberately armed at zero throttle, observed active
flight and paused. The same public Library's Browse optional worlds action
reported “No published worlds yet.” The empty catalogue is intentional; it does
not advertise unfinished Reservoir content. Markers, native UI text and images
are retained in the
[public checkpoint manifest](../authoring/fpv-worlds/personal-best-settings/evidence/public-library-8e/manifest.json).

The focused personal-best Settings access change is qualified for publication.
It removes two hiding assignments without changing the existing ghost handler,
record selection, scoring or physics. The original native run retained 173
passing controls and a later Arm timeout; a separate unchanged-runtime tail
passed 166 controls and diagnosed an existing language repaint/Home phase race.
Full validation, 16 existing checks and all-three/two-build admission pass. All
95 original inputs remain exact to the admitted candidate, with 615 source bytes
remaining. See [the scoped evidence](fpv-personal-best-settings.md); this is not a
single broad browser pass or a new offline or hardware-performance claim.

Warm-frame readiness #1084 is ready at `7da26a8e1`, with its separate native
classification/lifecycle evidence and exact admission. World-visual source
projection #1085 is ready at `7fa`; a normal expected-head main update has been
requested. The latter recovers 41,026 original source bytes through the existing
lexical preparation, with full validation, all three admissions, deterministic
builds and AST/token/comment/line-ending identity. The generated world-visual
member's bytes change; unrelated payloads remain exact except for the expected
generated worker/descriptors. Neither ready PR is called publicly deployed here.

Remaining engineering work is the isolated language-phase race and steady-flight
CPU attribution. The next Reservoir gate is the capacity-bounded opaque-coating
runtime capability, then the r14 pack's fresh proofs, actual native import and
terrace visual acceptance. Hut identity and scene rooting remain subsequent
quality work. Festival, Harbor and Canals follow sequentially after Reservoir
meets the representative quality standard; final new unit coverage stays in D6.

### 4 October — Warm readiness and ghost access merged; capacity hold resolved

Warm-frame readiness #1084 merged normally as `1a1a82d5e6617a53239218642eda3aa70e817fe3`.
Personal-best Settings #1086 subsequently merged normally as
`5cde6dbc97c3067b6023d2bf7fd97fe251805347`, from updated head `04bc7c9505`.
The exact 95-input bridge verifies qualified warm main plus the two ghost hiding
deletions. Its original 173-control run and separate 166-control tail retain their
historical runtime identities; the normal merge is not called another browser run.
At the bounded 19:05 UTC deployment read, both public markers still identified
the already launched Library revision `8e5ad71e`, while warm deployment was running.
Newer public launch acceptance is not inferred from these merges.

Capacity #1085's hold was the initial allocation race: staging added it at
18:42:48 UTC, before milestone 57 was assigned at 18:43:55. Later staging skipped
the allocated PR but had no label-removal path. After exact-head/source inspection,
only that obsolete allocation hold was removed. Ordinary leased main updates
preserve the original capacity candidate and incorporate warm and merged ghost
work. Current inspected head `e058d93b4f2f415e5446190d7c61b3c6bdf4f465` has all
95 expected input identities, 16,735,954 raw source bytes and 41,262 bytes reserve.
Fresh exact-head checks and the normal protected controller remain authoritative.
The 41,026-byte lexical reduction preserves the previously documented semantic,
token/comment/newline contract; no cap or global publication policy changed.
Bounded publication/source bridges are retained in the
[checkpoint manifest](../authoring/fpv-worlds/language-phase/evidence/publication-checkpoint/manifest.json).

The next reliability fix preserves current flight ownership during language and
Library repaint. Its first +55-byte guard reproduced the original baseline race
and retained 324 passing native checks, then exposed another real transient:
public Settings paused flight but Home's resumability still said Start until a
native frame. The failed receipt remains. The isolated +105-byte continuation
also refreshes the existing HUD in the native surface-open callback. Its new
bounded source browser qualification is pending; pause/arming guards are unchanged.

The exact admitted r14 Reservoir coating candidate passed nine bounded native
views and actual import/render/arm/pause. All sixteen fresh ordinary flight proofs,
independent replays and archive reimports subsequently passed 575 checks. Broader
terrace/art acceptance and protected runtime/content publication remain distinct;
this is not a comprehensive realistic-world or hardware-performance claim. Hut
identity and scene rooting remain next quality work. Steady-flight CPU attribution
continues independently. Festival, Harbor and Canals remain sequential after the
Reservoir quality gate, with final new unit coverage reserved for D6.

### 4 October — Language action ownership qualified; capacity prerequisite merged

The focused language/menu ownership fix now has a 433-check native source pass
at `bf3597703763584c79119bdeab50bfa03198ae6f` and a separate 283-check native
admitted lifecycle pass at `d1d48b2b7ad67a0915532a1489f300abccd778ae`. The latter
uses all 102 admitted files with no runtime overlays, on main5c including the
qualified warm-frame and public personal-best control changes. Full Node22
validation, all 16 existing appearance/texture checks, and all-three/two-identical
source-bound admissions pass. The prior324-check timeout is retained: it revealed
the additional same-event stale Continue/Start state, repaired by synchronizing the
existing HUD immediately after the native surface-open pause. No clock, arming,
pause, physics, scoring or replay-proof guard changed.

Capacity #1085 merged normally as `5bd8f36d7767dcd9dda740865b4d8f19ddbe7c28`
at19:32:24Z after its current exact-head checks succeeded. Its initial allocation
hold had preceded milestone57; only that proven obsolete hold was removed, then
ordinary expected-head main updates and protected merge were used. The language
branch normally incorporates this semantic-only projection: all 95 input paths are
checked, only world-visuals formatting changes from the admitted candidate, and
the canonical bytes/AST/tokens/comments/line terminators remain exact. Resulting
source reserve is41,157B; fresh publication CI remains distinct from historical
local admission. See `authoring/fpv-worlds/language-phase/README.md` and its bounded
lossless evidence archives.

Warm #1084 is now publicly verified at marker/build identity
`1a1a82d5e6617a53239218642eda3aa70e817fe3`: native Start, briefing Start, Ready,
deliberate Arm, active flight and Pause were observed. Ghost #1086 is merged at5c,
but that earlier public marker does not establish its deployment. Library's
earlier8e public entry and empty published-world catalogue remain verified.

Remaining delivery order is unchanged: qualify and publish the cap-guarded
Reservoir coating capability, keep exact r14 native views/import/flight and
575-check16-proof evidence distinct from broader terrace acceptance, then improve
hut identity and terrain rooting. Steady-flight CPU attribution continues in its
separate measured lane. Festival, Harbor and Canals follow the Reservoir quality
standard; final additional unit coverage remains D6. No hardware-FPS, universal
imported-image determinism, new offline or unobserved public deployment claim is
added by this language increment.

### 4 October — Current publication and Creator transaction boundary

The active engineering instructions in
[the parallel plan](fpv-parallel-delivery-2026-10-04.md#engineering-execution-within-the-revised-allocation)
now distinguish delivered worker/warm/focus/menu work from the remaining gates;
older dated checkpoints remain historical. Native public deployment/build markers
both identified `5bd8f36d7767dcd9dda740865b4d8f19ddbe7c28`. The coordinator entered
briefing, deliberately armed, observed active flight, paused and opened Settings.
The personal-best control was visible and correctly disabled without a personal
best. This establishes public entry for ancestor ghost `5c` and capacity `5bd`,
not a personal-best playback or newer-runtime claim. See the
[bounded public evidence](../authoring/fpv-worlds/creator-install-reliability/evidence/public-5bd/manifest.json).

Language/Home phase #1087 merged normally as
`395a638b1b3d68b0da9771f313990f3028703481` after current-head protected checks.
Coating #1088 then passed all current `a767ff494` checks and merged normally as
`3bc7a923da2b7d50a6a675a91d5560005ad0f20d`. HUD #1089 received the reviewed label
and ordinary expected-head updates for phase and coating, then passed every
active check at exact `d97b7eb42` and merged normally as
`ecf0bafc6541c6b57ae28a530763bab221555d4f`. The later public deployment/build markers both identified `3bc7a923d`; the
coordinator entered briefing, reached Ready, deliberately armed, observed active
flight, then paused at 51.8 seconds with Continue available.
[This bounded public evidence](../authoring/fpv-worlds/creator-install-reliability/evidence/public-3bc/manifest.json)
qualifies normal entry for coating/language ancestry, not a public coating import,
FPS, later HUD or Creator run. No force, bypass or release-policy change was used.

The historical-main `5bd` Creator diagnostic preserved a genuine recording and
interrupted flight while reproducing two postcommit defects. The focused 323-byte
correction uses the committed transaction generation and truthful EN/UK saved-pack
refresh guidance. Source 294 controls pass, including failed install/retry, a real
second-connection revision conflict, exact retained proof/recovery and reopen/Watch.
The incorrect compiled-view-only fixture edit and its failed assertion are retained.
Full validation passed on `f1c8641b6`; integrated `fc3254382` has the exact same host
and 94 other inputs matching coating's admitted source, 28 existing checks, and fresh
all-three/two-build admission. Its exact zero-overlay admitted player passed
294/294 native controls, with both hosts free of warnings/errors. The complete
1,888,634-byte receipt is preserved losslessly under
`authoring/fpv-worlds/creator-install-reliability/evidence/admitted-8961-passed`.
The publication branch then normally merged HUD main `ecf0bafc6`. Its 95-input
bridge proves only the independently qualified 121-byte HUD difference from
admitted `fc325`; the 323-byte Creator function is byte-exact. Combined source
reserve is 37,314 bytes, with fresh protected CI required. This source bridge
does not establish the later HUD/compatibility combined browser journey.

Remaining work is the finished first Library row and old-cache compatibility,
Creator's protected publication, final combined reliability, and representative
natural and industrial presentation/endurance. Reservoir r16 has 575 ordinary
flight/replay checks, 304 admitted import/Watch checks and native arm/pause evidence;
its data-only #1090 is in protected publication. The production Library index stays
empty until the finished content and compatible runtime are published and verified. Festival, Harbor and Canals remain sequential after that
quality standard, followed by D6. Physical-device, novice and universal FPS/offline
claims remain pending.

## 4 October — Combined online journey and publication

Reservoir r16 data #1090 merged normally as
`53620a6615210047385c770ef1c24f4eb0bdc461`; Creator commit/retry repair #1092
merged as `8b31237d6f2cba627b5d35acc10309e4d3335992`. Library compatibility
#1093 merged normally as `21826c460e80fa4e7fa47ec8e6ba9f98f75beea4` after every
active check passed at exact `40b2e29df95691cbe44220e253ba8f795d60dd74`. Its
normal Creator-main update has the same host bytes as the final combined admission.
Latest actual public-entry evidence
remains the recorded `3bc7a923d` launch, not these newer merges.

The bounded [combined journey](fpv-combined-journey-qualification.md) passed all
453 native controls at port8965 on source
`6c341bef4347d98bae882fb1785eabf6a133537c`. It used the exact Library admitted
player plus the declared, byte-exact 323-byte Creator correction. Explicit native
file imports installed pack50ff and then its separate proof archive073ee. Native
selection, language/Settings ownership, neutral Arm/pause/visible Retry, the exact
1,616-tick Watch, non-first-course/single-mode edit/Undo/Redo, export, transaction
abort/ordinary retry/postcommit refresh failure and durable reopen all passed.
All original proof rows, original dependency revision and interrupted recovery
were retained. The created renderer released all registered resources; the
reopened lobby demonstrably created no renderer. Both hosts had no errors/warnings.
The full 6,456,631-byte receipt is losslessly archived with its original hash.

Both preceding failed fixtures remain retained. One selected the closed Results
Retry instead of Home Retry; the other required a renderer in the reopened lobby.
Only these manual observer/control defects changed. No product guard, physics,
clock or visibility behavior was altered to obtain the pass. This online run uses
the actual default Industrial presentation; it does not qualify an authored
natural performance workload, published Browse/download or cached-native offline.
The final exact combined source `0b54fd0fdf8fe06dc900024a8b59713340b09bb3`
passed full Node22 validation and all-three/two-identical-build admission, with
all 95 original inputs byte-exact to the successful online fixture. The complete
zero-overlay102-file player passed223 staging checks and supplies the single
runtime for subsequent native/offline and longer-session work. Original source
reserve is35,578 bytes; no limits changed and no second build set was created.

The exact admitted port8966 run subsequently passed all 453 of the same named
native online controls with zero overlays. Its full6,456,634-byte receipt and
screenshot are retained losslessly under `combined-journey/evidence/admitted-8966-passed`.
Both hosts had no errors/warnings; the created renderer released its owned
resources and the reopened lobby created no renderer. Published Browse and the
separate stopped-origin offline phase are not implied by that online pass.

That separate offline phase subsequently passed on the same native admitted entry.
Public preparation completed; the dedicated 8966 server stopped and curl refused
before and after native reload. Library retained edited revision d44a3936bff0 and
rollback 50ffbb0e5da7; Creator showed course 02/Acro X=-9.9m, Y=5m, Z=15m. Unchanged
course 01 loaded, deliberately armed at zero throttle and paused at 33.9s. Native
text/screenshots and exact server stop/refusal/restart metadata are retained under
`combined-journey/evidence/offline-8966-passed`. This qualifies own-origin outage,
not browser-wide offline, eviction or a repeated private database audit. The
same server root was restored with HTTP 200.

The separate [native session audit](../authoring/fpv-worlds/longer-session/README.md)
then passed 306 controls on the same exact 0b54 admission: eight 20-second windows
across authored industrial Yard and natural Reservoir, 167.196s total run. The
three repeated Ready resource counts per scene stayed identical, and both owners
released all registered resources. Mean host callback CPU ranged 1.442–1.850ms;
the recurring first stick-width read represented 25.0–29.5% of that nested time.
The maximum observed native RAF gap was 34.3ms. Supported LoAF/longtask observers
saw no qualifying entries starting inside these windows; that does not establish
absence of jank. The complete receipt, exact observer and audit retain overhead,
viewport, profile and shared-browser limits. This is a bounded single-runtime
observation, not a before/after speedup, hardware-FPS, GPU-time or thermal-endurance
claim. No optimization is included in this manual-evidence increment.

The active parallel-plan checkpoint and engineering priorities were reconciled,
including merged ghost/language/coating/HUD/Creator status. Reservoir's bounded
r16 art review is accepted and its data is merged; the first production Library
row is ready as #1094 following compatibility's merge; actual download/install
verification remains pending. An explicit owner-authorized temporary main-merge
hold applies until Character/P1 #1083 completes protected merge and Pages delivery
and the coordinator lifts the hold. #1094 is not enrolled in auto-merge; its checks
and prepared data remain intact. Development and qualification continue.
Festival r5 eight-course source has616 checks / 16 ordinary completion and replay
proofs, plus 311 historical admitted-browser checks / 16 Watch replays; final native
offline qualification and publication remain pending. Continue
Festival, Harbor, Canals and then D6, retaining device/novice limits.
