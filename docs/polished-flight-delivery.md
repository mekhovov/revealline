# Polished journeys and real-radio flight: delivery ledger

This supersedes claims that the assisted overhead gym completes the immersive
flight-simulator phase. The historical `civilian-flight` / `assisted-gym.v1` stays
unchanged. New first-person flight belongs to the separate `civilian-fpv` package.

## Order and compatibility

Deliver Phase 2 → 3 → 4 → 6, with qualification in every batch, through integration
PR #758 while open. The branch was refreshed onto main `a5859df78` (v0.142.2) for the latest batch.
Keep 18 campaigns, 108 arcade missions, English/Ukrainian, shared arcade simulation,
and every already-published reward promise. Human learning, artwork and physical
radio testing remain explicitly deferred. Passing synthetic inputs is not hardware
qualification. Release coordination owns versions and production promotion.

| Batch          | Deliverable                                                                        | Current integration state                                                |
| -------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| A / 2          | Shared screen polish, practice discovery, guided lesson and atlas editing          | Implemented                                                              |
| B / 3          | First three polished missions in each of four existing showcase campaigns          | Implemented                                                              |
| C / 4          | Six missions per showcase, different application fixtures, control lab             | Implemented                                                              |
| D / 6          | USB-radio diagnostics, arbitrary channels, calibration, separate response profiles | Implemented; physical devices unverified                                 |
| E / 6          | First-person model, Self-level/manual throttle and Acro, representative drills     | Implemented; portable numeric fixtures pass                              |
| F / 6          | Twelve drills, typed practice rewards, notebook and studio round trips             | Implemented                                                              |
| Continuous / 7 | Reproducible archives, portable proofs, lifecycle/performance, admission           | Local integration verified; remaining performance/publication gates open |

## Acceptance contracts

- Every UI path retains immediate Next/Retry, uncropped board edges, neutral input
  while reading, visible focus and reduced-motion equivalence. Presentation cannot
  change simulation or accepted replay results.
- The four showcases are Community Connections, Ideas into Understanding, Threads
  Across Ukraine and Meet the Aircraft. Each has an explained example, a bounded
  attempt with corrective feedback, and later application to a different fixture.
  The six-win finales remain unchanged; application bonuses are separate.
- Guided Studio edits must preview, export/import, compile, play and reopen in
  Collection. Preview sessions never earn. Preserve exact sources/media revisions.
- USB-radio profiles separate stick diagrams (Modes 1–4), channel calibration and
  flight-response curves. Accept standard/unmapped devices, reordered/reversed axes,
  full-travel throttle and optional latched switches. One movement source owns input.
  Disconnect/replacement/blur/profile change freezes, clears live input and requires
  explicit recovery; airborne recovery requires control pickup, never automatic arm.
- The new model uses deterministic bounded integer state, fixed steps, stable
  collision order, directional swept gate tests and consecutive holds. Centered Acro
  stops commanded rotation without levelling or cancelling momentum. Self-level
  levels attitude while throttle and momentum remain meaningful.
- Twelve distinct verified drills in either allowed mode unlock the main notebook;
  all twelve in Acro unlock a separate distinction. No invented arcade wins. Attempts
  pin model, course, mode and response identities; imports reverify bounded transcripts.
- Node, Chromium, Firefox and WebKit must match before portable proofs are admitted.
  Twenty scene/retry cycles and context loss must release resources and freeze safely.
- Preserve 8 MiB/64-file optional runtime **and source** limits, core 64 MiB/2,000
  files, edition assets 32 MiB and the existing hosted cap. Admit only selected
  Three.js 0.186.1 files and MIT licence. Historical package policies remain intact.

## Research used

The user-approved design follows [IES worked-example/application guidance](https://ies.ed.gov/ncee/wwc/PracticeGuide/1),
[PhET constrained exploration](https://phet.colorado.edu/publications/prst-per-2010.pdf),
[EdgeTX joystick mapping](https://manual.edgetx.org/edgetx-how-to/joystick-mapping-information-for-game-developers),
[EdgeTX independent stick mode/channel order](https://manual.edgetx.org/color-radios/radio-settings/radio-settings),
[VelociDrone replay/coaching examples](https://www.velocidrone.com/downloads/VelociDroneManual.pdf),
and [deterministic mathematics considerations](https://rapier.rs/docs/user_guides/javascript/determinism/).
These inform implementation; they do not prove learning effectiveness or real-flight transfer.

## Implemented in the integration branch

- **A / Phase 2:** Shared Home/Controller Lab practice discovery and explicit
  loopback-only testing links; guided Company lesson and atlas editing, missing
  sidecar creation, wrong/correct/resume previews. The existing 800 ms reveal and
  immediate Next/Retry remain unchanged. The arcade core has no diff.
- **B/C / Phases 3–4:** All 24 existing showcase missions have bilingual learning
  progression. Ten additional bounded lessons, two optional community application
  bonuses and the Met's cleared second textile object are added. Four exact
  pre-update presentations retain old promises; existing six-win finales and the
  two older application bonuses remain intact. The complete catalogue stays at
  108 missions. Ukraine's selected assets remain under 22 MB and the 32 MiB cap.
- **D / Phase 6:** Explicit USB-device selection, raw channels, guided measured
  calibration, independent Modes 1–4 diagrams, full-travel throttle, optional
  switches, response curves and validated profile transfer. Failure/disconnection
  freezes input; fresh arm transitions and airborne control pickup are enforced.
- **E / Phase 6:** Separate Three.js first-person gym/field, integer quaternion
  flight model, manual-throttle Self-level/Acro, cameras, stick display, 24 verified
  teaching examples, slow review and readable failure/capability recovery.
- **F / Phase 6:** Twelve ordered drills, exact practice transcripts, shared v2
  reward definitions/receipts, twelve-distinct finale and separate all-Acro
  distinction, persistent notebook, cosmetic presentation and course Studio.
  Demonstration, authoring and replay sessions cannot earn. Custom course imports
  preserve reward metadata and require new revisions for changed requirements.
  Long proof verification yields in batches of at most 200 simulation ticks.
  Imports can be cancelled, including during storage hydration; explicit cancellation
  or notebook disposal prevents late writes or playback. Hiding the dialog alone
  does not dispose its notebook. Immediate Retry preserves the completed attempt while
  its single cooperative notebook admission finishes.
- **Continuous / Phase 7:** Trusted new-package policy, selected pinned upstream
  renderer/licence, historical gym compatibility, full runtime/source caps and CI
  selection of both optional packages. Production selection is unchanged.

### Evidence and remaining qualification

The [portable numeric fixture receipt](verification/evidence/fpv-portability-2026-09-28.json)
compares 24 demonstrations and two 3,000-tick stress sequences with intermediate
state checkpoints in Node, Chromium, Firefox and WebKit. Source hashes identify
exact tested modules. That receipt is not physical-radio or learning evidence.

The [compiled runtime observation](verification/evidence/fpv-runtime-2026-09-28.json)
binds every runtime file and the observation harness. Twenty drill/reset cycles
return to the same registered geometry/material/texture and renderer counts.
Four desktop/tablet/phone layouts remain inside horizontal and vertical viewport
bounds. A live WebGL context loss freezes an active attempt. Application-owned
resources are disposed and the GL context is lost; Three's remaining shared lookup
texture accounting entry is recorded, not concealed or claimed as a measured leak.
The final eight-second headless final-circuit observation records p95 frame interval
16.7 ms, maximum 116.7 ms and no observed long-task entries. The isolated long frame
is retained in the receipt; p95 alone does not establish stall-free play. This is a
scoped development-machine observation, not a matched arcade regression benchmark
or a full retained-memory qualification.

Focused suites cover reward compatibility, 11/12 locking, corrupt/foreign proofs,
failed saves, calibration inversion and replacement, background input, Studio
round trips, boundary mathematics and independent optional-package admission.
The initial priority-batch company run passes **919/919** checks and the complete optional
practice cohort passes **144/144**, with no skips or cancellations. The earlier
company run exposed an obsolete positional lesson fixture; it now selects the
unchanged lesson explicitly. Changed-file formatting/lint and English/Ukrainian
localization validation pass. The content generator verifies 186 exports; source
eligibility checks include 294 admitted assets.

The [local package admission receipt](verification/evidence/fpv-package-integration-2026-09-28.json)
records two byte-identical builds and complete runtime/source inventories. The new
package has **50 runtime files / 2,747,250 bytes**, with **52 source files / 2,761,642
bytes**. The old gym retains its exact pre-parameterization archive hash. This
integration exercise uses explicitly synthetic commit/tree bindings and is
non-promotable; frozen current-commit admission remains required.

### Follow-up qualification and fixes

The `c1a62377a` [candidate receipt](verification/evidence/discovery-2026-09-28-candidate-c1a62377a.json)
confirms eighteen double-built editions, both frozen optional packages, exact
downloaded artifact hashes, original-member admission and committed-input checks.
All candidate jobs passed. The separate hosted job tests the Community service;
it is not evidence of optional-PWA publication. Pages is held because PR #758 has
no immutable release slot; the product build is skipped by that release gate.

The [installation observation](verification/evidence/optional-installation-c1a62377a.json)
installs both Chrome PWAs, explicitly opens standalone launcher windows, prepares
and reopens both games offline, rejects a truncated dependency, and preserves a
verified proof when restoring a previous pointer or uninstalling the other app.
Seven state transitions pass, and both temporary apps/profile are cleaned up.
These are exact frozen candidate bytes on one isolated Chrome environment. The
rollback fixtures use the same payload at alternate local version paths, so they
do not qualify a real historical-model migration. [Method and limits](optional-installation-observer.md).

The full guided Studio → source/media export/import → compilation → ordinary
keyboard win → wrong/correct activity → Collection regression exposed two defects.
Collection now resolves a lesson using the actual composite Journey mission ID
and exact gameplay binding. Optional activities are also available directly from
the initial winning result when its earned picture is displayed. Neither fix
changes arcade simulation, result navigation or earning authority.

The [retention diagnostic](verification/evidence/fpv-retention-2026-09-28.json)
found that course-button handlers retained the flight scene after disposal. Those
handlers are now cleared, including after language changes. Two consecutive
twenty-cycle intervals keep the measured DOM/listener and named object cohorts
stable; the second interval's total shallow heap change is negative. After disposal,
the scene, renderer, application frame/paint closures and owned CanvasTextures no
longer appear in the captured heap. Library scratch/prototype objects remain
explicitly recorded. This forced-GC diagnostic does not measure exclusive retained
memory, native allocations, GPU bytes or natural frame pacing.

The follow-up regression run passes **921/921 company checks**, **145/145 optional
practice checks**, and **5/5 heap-analyzer checks**. The analyzer checks are now part
of the regular practice CI command. Formatting/lint and unchanged generated content
validation pass; public source eligibility includes 294 admitted assets. The
arcade core and historical gym source have no changes in this follow-up.

### Final input guard and capacity follow-up

The clean `d22621010` optional packages were built twice and independently admitted.
The downloaded CI artifact's twelve files match the local bundle byte for byte;
the same seven installation/recovery checks pass on those frozen bytes. FPV's
runtime is **50 files / 2,747,465 bytes**, and its complete source is **52 files /
2,761,859 bytes**, before the subsequent input-guard fix below.

The [default-capacity observation](verification/evidence/default-capacity-d22621010.json)
records **799,088,673 bytes** for the prepared default payload, including its
manifest. With both optional runtimes and stable launcher originals, the known
lower bound is **802,052,737 bytes**. This leaves **147,947,263 bytes** below the
950 MB hosting cap before company editions, generated pointers/hubs, root metadata
and retained versions. This is one preparation, not a frozen default archive,
whole-site admission or permission to raise a cap. Sparse inputs and producers were
restored from their exact committed blobs; historical dirty work was untouched.

The completed `d22621010` candidate CI passes for all eighteen editions and both
optional packages. The [verified capacity packet](verification/evidence/company-capacity-d22621010.json)
puts the same-source known lower bound at **924,295,263 bytes** for the default,
optional packages and four new editions; **1,049,938,753 bytes** with Coupa All and
DroneAid NL Community added; or **1,375,885,332 bytes** for all eighteen editions.
The latter two already exceed the unchanged cap. Four editions leave only
**25,704,737 bytes** before the omitted components. Larger selections require
separate configured targets or download-only packages; complete hosted admission
and release selection are still required.

Live-input fault injection reproduced a queued-animation edge case: after a
300 ms main-thread block, an old rAF timestamp could admit one ordinary simulation
tick before the next callback paused. The guard now checks the actual monotonic
callback-execution gap as well as animation timestamps. It resets both clocks at
the existing ownership, resume and reset boundaries. Flight-model mathematics,
accepted transcript rules and renderer timing remain unchanged. A regression
covers both modes and keyboard/radio ownership, no extra recorded step, neutral
keyboard resume and radio control pickup. The complete practice suite passes
**151/151** checks with no skips; the earlier **921/921** company result covers
unchanged arcade/edition code.

The [input observation](verification/evidence/fpv-input-2026-09-29.json) retains the
initial failed assertion, the confirmed stale-callback traces and the corrected
four-case run. Both 300 ms fault placements now add zero simulation/recorded steps
in both modes and input owners, with explicit recovery preserved. The corrected
natural windows report p95 callback intervals of 16.7–16.8 ms, maximum 83.4 ms and
no observed long-task entries; the earlier 250 ms sample is also retained. These
are first-person field rendering with active ground-yaw inputs, not airborne
navigation. The synthetic radio is a Gamepad API fixture, and input timing is a
model-observation proxy, not USB or input-to-photon latency. The evidence pins
exact fixed runtime bytes from a dirty worktree; it is not frozen-release,
physical-device or matched 5% regression qualification.

At that checkpoint, publication work still included fresh candidates for follow-up code changes,
complete same-source hosted-target capacity/admission, production promotion and
real version/public rollback. Desktop frame-pacing/input-stall benchmarking and
broader memory/device qualification remain distinct from the bounded observations.
Human comprehension, pacing, artwork and physical-radio/device evidence stays
**deferred and unverified**. The proposed macOS/Windows browser/device matrix is a
qualification target, not a list of proven compatible transmitters.

### Rebase and candidate recovery batch

All 31 integration commits were rebased onto main `a5859df784314556072f9215f9b293962e4f2ea4`
without changing the historical dirty checkout. Studio conflict resolution retains
main's spatial-review tools alongside the discovery editor and preserves both
English/Ukrainian translation sets. The generated locale catalogue matches its
merged sources. The shared arcade core has no diff from main. On clean rebased
`9105025316c21bfe749ea8617dbb2220fd2b5530`, all **921 company checks** and
**151 practice checks** pass, with no skips or failures. All seven source hashes
in the earlier four-runtime numeric fixture receipt still match.

The earlier `308745195` candidate CI completed successfully for all eighteen
editions and both optional packages. That result stays bound to its original
source. The rebased optional packages were frozen twice and admitted independently:
FPV remains **50 runtime files / 2,748,040 bytes**, with **52 source files /
2,762,434 bytes**. The old gym remains **29 runtime files / 178,540 bytes**.
Neither package exceeds its existing 8 MiB/64-file limits.

The [clean rebased default inspection](verification/evidence/default-capacity-910502531.json)
found a new publication blocker: prepared
content is **800,592,677 bytes**, which exceeds the unchanged **800,000,000-byte**
archive-content ceiling by **592,677 bytes**. Including its **402,023-byte** manifest,
the payload is **800,994,700 bytes**. Preparation alone is not archive admission.
This is one source-verified inspection, not two reproducible default archives or
a whole hosted-site qualification. Earlier capacity totals remain historical and
must not be combined with the new candidate as though they were one source.

The author guides now describe the delivered simulator, four application bonuses,
existing no-loss mastery predicate, actual JSON/file transfer routes and separate
course/reward revisions. Custom course preview, practice proof import and reward
schema support do not grant publication admission or fabricate arcade progress.

The installation observer now accepts an independently admitted previous frozen
bundle and requires different versions, commits, trees and archive hashes. It
stages each candidate's exact launcher, pins both sources even in failed reports,
and requires two genuinely standalone launcher windows. The
[distinct-candidate observation](verification/evidence/optional-installation-910502531.json)
passes seven transitions from `d22621010` / v0.142.1 to `910502531` / v0.142.2:
offline coexistence, update, rejected truncated download, rollback, and removal
of the other package. Exported flight proofs and separately stored radio/response
profiles remain byte-identical. The mapping is explicitly synthetic and unverified.
The changed files are `app.mjs`, the worker and package manifest; this tests a real
candidate code update, not an arbitrary model/schema migration or public rollback.

A minimal packaging fix emits only generated `offline-inventory.json` as compact
JSON. It preserves the inventory data, every asset and historical record, source
string whitespace and normal manifest hashing. The **39 focused build/offline
publication/inspector checks pass**, including complete parsed-inventory equivalence
and original-byte preservation. Formatting, lint and independent review pass.
The next clean-source inspection must measure the reduction before this closes
the archive-size blocker.

The [matched arcade observation](verification/evidence/arcade-performance-2026-09-29.json)
compares the exact `1106ec0ac` FPV edition with frozen `910502531` on the same
machine and browser. Two unprofiled pairs run in opposite order. All four
play/results comparisons meet the scoped 5% p95 target with **0% measured change**:
active play is **16.7 ms**, and corresponding results are **16.7 or 16.8 ms**.
The candidate's **50 ms** maximum result frame remains in the report. An unpaired
valid sample and harness setup/route failures are retained, not selected away.
Twenty ordinary earned-result/viewer cycles per build retain stable connected
DOM/media counts within that build; the richer candidate starts with more nodes.
These are neither detached-retainer nor decoded-media memory measurements.

The separate first-win traces do **not** close the 50 ms reward-work target.
Baseline/current callbacks take **70.131 / 71.348 ms**, mostly inside Phaser's
animation callback containing gameplay and result work. Timeline-only traces
cannot assign exclusive reward cost. Unprofiled results also retain page-wide
long tasks. Further attribution is required; this batch does not waive that gate
or infer performance across all editions, devices or input hardware.

The legacy three-argument installation observer also passes all seven transitions
with its narrower same-payload fixtures. The new observer rejects equal candidate
versions before loading browser automation. Generated company content verifies
**186 exports**, and source eligibility verifies **294 admitted assets**.
