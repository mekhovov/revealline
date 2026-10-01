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
