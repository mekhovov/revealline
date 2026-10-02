# FPV continuous feature delivery

Updated 2026-10-01. The owner requests a verified PR after each completed feature,
with the next independent item developed while source gates and deployment run.
Additional unit coverage belongs in the final phase. Build, browser, replay,
import/export and publication verification remain part of every applicable item.

**Current checkpoint:** see “Reviewed continuation — creator repair, Acro school,
graphics and audio” at the end of this log. Earlier tables and heads are history.

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
