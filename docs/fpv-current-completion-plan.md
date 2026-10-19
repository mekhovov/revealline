# SIM completion plan — current status and remaining work

Reviewed **19 October 2026 (Europe/Berlin)**. This is the current
execution index for the accepted rates, aircraft and Setup Workbench plans.
It distinguishes implemented features, released corrections, remaining software
work and qualification that requires outside evidence. It does not reopen
unrelated world-expansion or demonstration-authoring projects.

## Current continuation — 19 October, 07:26 CEST

**The plan remains incomplete.** Independent software preparation and local
acceptance continue; release, platform and measurement gates remain explicit.

- **Latest-main integration is qualified.** Main `6e3c5f81d4` is incorporated
  on a separate follow-up branch at `7109710578`; queued PR heads were not
  changed. All **775 unique focused checks** pass across the original run and
  a targeted rerun after restoring exact missing sparse fixtures. **19/19**
  package checks, three generated-source identities and all **243 input hashes**
  pass. No source/assertion repair was needed. Academy has **41,429 bytes spare**
  under unchanged caps. [Receipt](fpv-main-integration-qualification-20261019.json).
- **R3/R9 local offline update acceptance passes.** The World package reloads
  with its server stopped; Meteor75 lifts and pauses, its complete recording
  verifies, and its 15-second checkpoint restores paused. A normal update from
  `1dfb180f2` to `9dd87a9c1a` retains the saved setup and verifies the old archive
  again with the updated native worker while the server is stopped. This is
  local server loss/update coverage, not OS-offline, installed-PWA or native
  qualification. [Procedure, result and screenshots](fpv-offline-update-acceptance-20261019.md).
- **R6 bounded command-domain selection is implemented and independently
  reviewed.** Commit `59586770b5` selects over declared fixed-voltage surface
  cells with a 256-combination limit, rejects ambiguity and unresolved candidates,
  and preserves evidence gaps. **99/99** combined synthetic checks now pass,
  including four independently reviewed coupled-sag counterexamples. Multiple and
  repeated voltage roots require a complete root-isolation/error-bound contract;
  a simple bisection wrapper would miss valid solutions. No coupled solver or
  flight activation is claimed. Command mapping, motor dynamics and matched
  measurements remain. [Contract](fpv-propulsion-evidence.md) ·
  [Confirmed sag design gap](fpv-sag-inverse-contract-20261019.md).
- **R9 bounded Regional worker acceptance passes.** The independently reviewed
  harness passes **17/17** software checks and actual native-browser cancellation
  followed by successful Meteor75 Self-level and Nazgul Acro cases on exact
  integrated source `ecfb4bc01d`. Complete direct/worker state, input cursors,
  terrain/mission rejection, byte-budget segment boundaries and fresh-worker
  recovery agree. [Scope and reports](fpv-regional-worker-protocol-20261019.md).
- **R1/R9 rendered Regional acceptance expands.** On that same integrated source,
  Meteor75 uses its saved setup in Urban earthworks review-r2, flies from Mill
  court and Tower court, pauses/resumes and restores a ten-second checkpoint
  while paused. The 13.14-second Tower court recording verifies from reset
  through the native worker. Terrain loading waits for explicit Arm at both
  starts. This is representative two-area coverage, not continuous cross-cell
  flight or every map. [Evidence](fpv-regional-rendered-acceptance-20261019.md).
- **Runtime equivalence is retained.** All **243** packaged source files at
  `ecfb4bc01d` match the qualified `7109710578` inputs. New propulsion diagnostics
  and qualification tools add no shipped flight code.
  [Receipt](fpv-followup-runtime-equivalence-20261019.json).
- **Release remains queued.** The latest read of #1722 still shows its unchanged
  `35a1824f1c` head open/mergeable with fifteen queued checks and no completed
  result. No manual rerun, cancellation, bypass or merge was performed. The
  preceding release chain and final Pages acceptance remain outstanding.
- **R13 remains unresolved and protected archives untouched.** No hidden public
  storage inspection, deletion or denied-route retry occurred. Physical radios
  and pilot comparisons remain deferred by the user.
- **Available disk is now a constraint.** It fell to approximately **122 MB**
  during the final rendered check. The results and receipts were saved; one
  optional extra summary write failed. No further builds are started, no user
  files or archives are deleted, and source/evidence commits remain small.

| Priority | Remaining result | Estimate / dependency |
| --- | --- | --- |
| P1 — release | Normal checks/integration for #1679 → #1685 → #1698 → #1717 → #1722 and this separately qualified follow-up; actual Pages acceptance | Queue ETA unknown; **1–2 working days after stable deployment**, fixes extra. |
| P1 — Firefox | Trajectory-preserving remedy for the original failed 2× capacity gate | Profiling complete; remedy ETA unknown. Original frequency/gate unchanged. |
| P1 — archives | Account for six protected older records and establish cause/recovery | **1–3 investigation days after a permitted diagnostic context**; recovery ETA unknown. No cleanup. |
| P1 — workspace capacity | Restore sufficient available disk for further builds/platform runs | Space was approximately 122 MB at 07:26; no cleanup or capacity-change ETA is assumed. Existing evidence is retained. |
| P2 — Regional | Continuous rendered cross-cell transitions, wider maps/aircraft/modes and sustained storage | Native protocol and representative two-area rendered checks complete locally; wider desktop matrix shares the estimate below. |
| P2 — broader platforms | Installed apps, interrupted updates/eviction, additional hosts/devices | Local World server-loss/update check complete. **3–5 working days** for available desktop matrix, **1–2 days per additional target**, access/fixes extra. |
| P2 — propulsion | Joint-cell root isolation with error bounds, then sag coupling, command mapping/transients, versioned activation and matched fitting | Counterexamples and contract options reviewed; solver implementation estimate depends on the numerical contract. **5–10 days per first reference after matched data**; acquisition/all-aircraft fidelity undated. |

No overall completion date is credible while the external queue, platform remedy
and physical evidence remain unresolved. Numerical checks are not measured
whole-aircraft fidelity, and scored/default promotion remains gated.

## Historical continuation — 19 October, 06:58 CEST

**The plan remains incomplete. Available software work continues.** This summary
supersedes older queue, capacity and in-progress notes below.

- **R3 PID readability and recovery are complete locally and ready for review.**
  Compact displays preserve exact gains; valid Revert/Undo clears stale invalid
  flags and error messages. Real browser checks also ran the response bench
  successfully and confirmed unchanged saves. Combined source `863449767f`
  passes **743/743 focused checks and 19/19 package checks**, lint/format,
  generation identity and all 243 input hashes. [Qualification](fpv-pid-followup-qualification-20261019.md).
- **R1/R11 actual course acceptance passes locally.** Meteor75 Academy Lift and
  land and Nazgul World-host Flight School Meet your drone finish through normal
  keyboard input. Their native replay/course checks verify **17.20 s / 14.34 s**;
  explicit split and visual reference selection works. This closes that specific
  local native-World acceptance gap, not every World/Regional course.
- **R6 fixed-voltage inverse allocation is implemented and reviewed.** Its
  **80/80** synthetic checks join the combined cohort; no shipped flight code
  imports it. Sag-coupled allocation, command mapping, transients and measured
  fitting remain separate. No claim of exact real-aircraft fidelity is made.
- **R18/R11 capacity is resolved and the local reference feature is qualified.**
  Reusing the existing canonical audio bank removes **52,782 duplicated bytes**.
  Combined source `9dd87a9c1a` passes **776/776 focused and 19/19 package checks**,
  scoped lint/format, shell/audio projection identity and all 243 input hashes.
  Academy has **48,531 input bytes spare**, with unchanged limits/file counts.
- **R11 best local practice reference is complete locally.** Native search found
  the genuine Nazgul World-host lesson at **14.34 s** and Meteor75 Academy
  flight at **17.20 s**. Both required explicit split/visual selection. World
  cancellation/retry and Academy pause/resume plus EN/UK/EN feedback passed.
  Multiple-winner/tie rules are tested synthetically; each real local inventory
  had one completed compatible candidate. The feature is device-local/unscored;
  no public leaderboard, account or server-attestation scope is implied.
  [Implementation and rendered evidence](fpv-practice-best-reference-20261019.md) ·
  [Combined qualification](fpv-practice-reference-qualification-20261019.json).
- **PID release submitted:** [PR #1717](https://github.com/mekhovov/revealline/pull/1717)
  at `0f2e4bf50a` depends on #1698. At 06:56 it has fifteen queued checks;
  mergeability is temporarily unknown, with no completed result inferred.
  The separately qualified R11/audio follow-up is now submitted as
  [PR #1722](https://github.com/mekhovov/revealline/pull/1722) at `35a1824f1c`,
  depending on #1717. At 06:58 it is mergeable with fifteen queued checks and
  no completed result. Normal integration and public acceptance remain.
  This local publication note does not change either queued PR head merely to
  record its own publication.
- **Release queue remains external:** at 06:45, #1679, #1685 and #1698 are open
  and mergeable with twelve queued checks each and no completed new-head result.
  No run was reset or gate bypassed. The 06:51 read-only public metadata
  still reports `dd337c8120fd`; final-source Pages acceptance is not claimed.
- **Protected archives remain untouched and unresolved (R13).** No hidden
  public storage inspection, new deletion or denied-route retry occurred.

| Priority                                | Remaining result                                                                                                                | Estimate and dependency                                                                                                                                                                |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P1 — release                            | Complete normal hosted checks/integration/deployment for #1679 → #1685 → #1698 → #1717 → #1722; accept the actual public build. | Local implementation/qualification complete; queue ETA unknown. Shared public acceptance: **1–2 working days after stable deployment**, fixes extra.                                   |
| P1 — Firefox                            | Find a trajectory-preserving remedy and pass the original 2× performance gate.                                                  | Reproduction/profiling complete; remedy ETA **unknown**. No physics timing or gate change.                                                                                             |
| P1 — protected archives                 | Account for six older records and determine cause/recovery.                                                                     | **1–3 investigation days after a permitted diagnostic context**, recovery ETA unknown. No cleanup.                                                                                     |
| Completed locally — practice references | Search, capacity repair and Academy/World recorded-flight acceptance are complete; publish the reviewed follow-up.              | No remaining implementation estimate for this increment; normal release/public acceptance above. Scored promotion remains separately gated.                                            |
| P2 — broader acceptance                 | Installed/offline/update, additional rendered hosts and Regional streaming; physical input targets when available.              | **3–5 working days** for the available desktop matrix; **1–2 days per additional target**, access/fixes extra.                                                                         |
| P2 — measured dynamics                  | Remaining bounded allocation/dynamics preparation, followed by reference fitting.                                               | Software preparation continues without radios/pilots. **5–10 days per first reference after suitable matched evidence**; data acquisition/all-aircraft fidelity have no reliable date. |

Physical radios/pilot feedback remain deferred at the user's request. Numerical
agreement and native replay success qualify computation, not whole-aircraft
realism. Scored/default promotion remains closed while platform gates fail.

## Historical continuation — 19 October, 06:09 CEST

**The plan is not complete.** Current priority is the normal release chain and
source-bound flight acceptance. Work continues on available software tasks;
unavailable radios, pilot feedback and matched aircraft measurements do not
block those tasks. Earlier receipts retain their original source and scope.
This section supersedes older release, capacity and queue snapshots below.

- **#1665 merged** at 04:51 CEST. Its original 22 successful checks and two
  policy skips are recorded separately from downstream checks. #1679, #1685
  and #1698 required reconciliation with newer main; main
  `a2c0b33c43d56adbdbb666c618d5f489cbdd32e7` is now incorporated locally.
- **#1679 integration is reviewed, tested and pushed** at
  `69f47f465882bad6e9fba7560e28a8109d0c152b`: **289/289 focused checks and
  19/19 package checks** pass from an exact committed extraction. Main's
  navigation and persistence changes and the later flight corrections are
  retained. The generated shell matches its source byte for byte.
- **#1685 integration is reviewed, tested and pushed** at
  `fa00bbe61`: **38/38 focused checks and 19/19 package checks** pass from an
  exact committed extraction. The inspector, non-activating propulsion tools
  and reviewed shell remain unchanged by reconciliation. Normal exact-head
  hosted checks must complete; no manual run resets or gate bypasses occurred.
- **#1698 integration and capacity repair are complete locally**, independently
  reviewed and qualified at `1dfb180f2c699692afe2fc121a845f5e5f7ef727`:
  **627/627 focused checks and 19/19 package checks**, no skips. Lint,
  formatting and generator identity pass. Eight unreachable edition helpers
  are omitted only from the private generated shell; canonical modules stay
  unchanged and new references stop generation before writing outputs.
  The verified 3,292-byte reduction leaves Academy at
  **13,302,259 / 13,303,808 input bytes** (**1,549 spare**), World with
  **1,179,007 spare**, and unchanged 98/151/211 source-file limits. All 243
  unique package inputs match the exact committed source. Earlier bound
  capacity failures and sparse-extraction failures are retained.
  [Combined release receipt](fpv-current-main-release-20261019.json).
- **Fresh rendered checks pass in the local packages.** Meteor75 flies in
  World Self-level/Acro, returns to its unchanged draft and reaches upright
  ground contact after throttle cut. A normal warehouse attempt uses the saved
  Nazgul and its PID values. Academy Apply & restart waits for Arm, then
  Meteor75 lifts and returns to the floor. The manual lesson overshoots its
  target band; no rendered lesson-completion claim is made. Both tabs report
  no warning/error logs. This is local keyboard acceptance, not the final
  public site, whole-aircraft fidelity or a new platform performance gate.
  [Rendered scope and screenshots](fpv-current-main-rendered-20261019.md).
- **World course preparation is implemented and reviewed locally**, with **55/55
  tooling checks**. It resolves exact built-in World/Flight School course
  identities, rejects unsupported or ambiguous content and returns immutable
  inputs. It explicitly reports verification **not run** and native proof
  ownership **not established**. Native World-worker audit, genuine completed
  World-flight acceptance and scoring policy remain open. This is useful
  preparation, not a completed course-verification gate.
- **Firefox CPU sampling now has reproducible evidence.** Three fresh replay
  runs retain all 3,000 checked physics steps. Four anonymous WASM functions
  account for about 85.3% of sampled physics-step stacks; this is a sample
  fraction, not measured CPU-time attribution. No cause or remedy is
  established. The pinned ordinary Rapier compatibility build does not enable
  enhanced determinism: observed matches remain valid, but an upstream
  cross-platform guarantee cannot be extended to untested targets.
- **Public source is newer than earlier status notes:** both deployment
  metadata files reported `dd337c8120fd6f875544c1479713d3aa4299c323`, build
  `main-dd337c8120fd`, at this turn's read-only audit. This is not the final
  downstream correction source; fresh public acceptance remains outstanding.

The restored isolated checkout is under a stable workspace path. Earlier
temporary checkouts and logs were unavailable; committed evidence and Git
history remain. Their disappearance is not diagnosed by this integration. Missing tracked test fixtures were restored without
changing assertions. Protected public archives remain untouched; R13 is still
unresolved and its previously denied storage-inspection route remains unused.

**Publication update — 06:12 CEST:** the combined correction is pushed to
[PR #1698](https://github.com/mekhovov/revealline/pull/1698) at
`fba38cb9630113e63ccaaee882e1e8d34f4f39fa`. Its documentation-only successor
retains all 243 qualified runtime inputs. #1679, #1685 and #1698 are now
mergeable; each has twelve checks queued and no completed new-head result.
The public metadata still reports `dd337c8120fd`. No deployment acceptance is
claimed and no run was manually reset. This local publication note does not
change the queued PR source merely to record its own publication.

A fresh Expert-view observation also identified long floating-point tails in
some PID fields. A separate R3 follow-up is investigating display-only
formatting that preserves untouched values, raw edits and flight identities;
it does not alter the qualified release while its checks are queued.

**Acceptance continuation — 06:24 CEST:** actual keyboard flights now complete
both **World-host Flight School / Meet your drone with the saved Nazgul** and
**Academy / Lift and land with the saved Meteor75**. Their finished archives
pass native-worker physics/course verification at **14.34 s** and **17.20 s**.
Both private-owned-proof reference controls become enabled and work after
explicit selection; flights remain paused and unscored. This supersedes the
earlier lack of rendered Academy completion and closes the local World-host
Flight School native-worker acceptance gap. No runtime ownership integration
was missing: the existing native World path already provides it. The optional
named-catalog audit, plain World-catalog coverage, local admission policy,
public deployment acceptance and competitive qualification remain distinct.
[Exact observations and limits](fpv-native-course-acceptance-20261019.md).

At 06:23 CEST, #1679 and #1685 still had twelve queued checks each; GitHub
temporarily reported mergeability unknown. No new-head success or deployment
is inferred. Available disk space is about 2.6 GiB, so follow-ups use targeted
in-memory package checks without full builds, installs or unrelated cleanup.

### Historical 06:24 priorities and conditional estimates

| Priority                    | Remaining work                                                                                                                   | Estimate and dependency                                                                                                                                                                          |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **P1 — release**            | Complete the queued exact-head checks, normal integration and deployment; accept flights on that deployed source.                | Capacity repair and local qualification complete; hosted queue ETA unknown. Allow **1–2 working days after a stable deployment** for the shared available-desktop acceptance scope, fixes extra. |
| **P1 — Firefox**            | Identify a trajectory-preserving remedy from the sampled/minimized reproduction, then requalify the unchanged performance gate.  | Reproduction and sampling complete; fix ETA **unknown**. No timing or performance gate is relaxed.                                                                                               |
| **P1 — archive incident**   | Account for six protected older records and establish recovery/cause using a permitted diagnostic route.                         | **1–3 investigation days after access**, recovery ETA unknown. No further deletion or public-state mutation.                                                                                     |
| **P2 — available software** | Exact-value PID readability, local comparison admission, command mapping/allocation and versioned propulsion preparation.        | Superseded by the current continuation: PID/inverse preparation complete locally; device-local unscored selection proceeds without public-competition scope.                                     |
| **P2 — broader acceptance** | Installed/offline/update behavior, rendered hosts and streamed Regional transitions; actual additional platforms when available. | **3–5 working days** for the accessible agreed matrix; **1–2 days per extra target**, access and fixes extra.                                                                                    |
| **Evidence-dependent**      | Matched propulsion/aircraft measurements, physical radios/touch, pilot comparison and signed native targets.                     | User deferred radio/pilot evidence. One reference aircraft fit is **5–10 engineering days after suitable matched data**; acquisition/all-aircraft fidelity and signed targets remain undated.    |

## Earlier continuation — 19 October, 03:26 CEST

The workbench lifecycle fixes, safe package reduction and unscored course-result
integrity changes are **implemented, independently reviewed and qualified locally**.
The next work is **normal integration and deployment → source-bound acceptance**,
with Firefox investigation and non-activating propulsion preparation continuing
independently. The whole plan remains incomplete. This section and the detailed
remaining-work table supersede every earlier snapshot and estimate below.

The combined source `11883768afe9119b4da833324e4b6f33d4ab1a94` passes
**366/366 focused regression checks** and **19/19 package checks**, with no skips.
Scoped lint, formatting, generated-shell byte identity and independent integration
review pass. Earlier invocations failed to load missing tracked modules, an audio
fixture or an existing dependency in the sparse checkout; those setup failures
are retained separately, and no runtime or test edits were used to clear them.
[Exact source-bound package and test receipt](fpv-workbench-integrity-package-20261019.json).

Academy has **5,632 original-input bytes** and **39,414 bundled bytes** spare;
World has **1,183,101 input bytes** spare. All three optional source inventories
remain at their unchanged **98/151/211** limits. Native packaging passes its
simulator-only development contract; this does not qualify a native device.
Main was refreshed again and remains an ancestor of this source. The final
continuation at `6b91adb212d2a1366fe90890ae9eff251f5fa971` has the same
**243 unique packaged inputs**, byte for byte. Additional 64/5/49 passing tool
suites are reported separately because prerequisites overlap.
[Continuation receipt](fpv-workbench-integrity-continuation-20261019.json).

The reviewed continuation is now published as
**[PR #1698](https://github.com/mekhovov/revealline/pull/1698)** at
`6c6ca7cd59ca0f04d3f005b929b67cb1b391aee1`, explicitly depending on #1685.
At **03:25 CEST** it is mergeable, with fifteen checks queued and no completed
check yet. This is publication, not integration or deployment. This later
documentation-only publication note is retained locally rather than changing
the queued PR source solely to record its number.

- **R3: inspector 200% zoom is locally accepted.** A fresh exact World package
  at `7d92d2fd10a0e0b098f95eadea30df9bb5080932` passed English/Ukrainian keyboard,
  wrapping, focus, calculation, result invalidation, return and revert checks
  in Chrome Guest. No flight or archive write occurred. [Receipt](fpv-inspector-zoom-20261019.md).
  Physical touch and virtual-keyboard checks remain separate.
- **R3: two new reproducible software defects are fixed locally.** Input-preview
  ownership text becomes inaccurate across locale changes or close/reopen;
  search results can retain controls removed by a rate-algorithm change.
  Both were reproduced through the real UI modules in an isolated test DOM.
  The fix passes **155/155** focused checks, source review and fresh-package
  rendered acceptance. [Receipt](fpv-workbench-state-20261019.md).
- **R18: structural capacity reduction is implemented and reviewed.**
  The generated flight shell embeds a duplicate appearance-control module
  already admitted by all optional packages. Reusing its canonical import
  recovers **7,416 bytes** without changing a limit, removing content, or
  touching physics. **70/70** focused checks and independent review pass.
  The R11 prerequisite and its reference-selection consumers are now integrated
  locally. Exact combined package qualification passes.
  [Capacity receipt](fpv-shared-appearance-capacity-20261019.md).
- **R11: owned-proof unscored selection is implemented and reviewed.** Split
  and recorded-aircraft controls require the verifier's immutable in-process
  proof plus existing live configuration/terrain checks. Default Academy/World
  workers remain supported; copied reports and custom executors stay
  diagnostic-only. The final cohort passes **95/95**, with no skips. The first
  combined invocation was **94/95** because a tracked World worker file was
  absent from the sparse checkout; that setup failure is retained separately.
  Cleanup remains independent of eligibility and scoring stays disabled.
- **R11: the offline built-in Academy audit is implemented and reviewed.** It
  resolves complete catalog content and the actual course revision, assesses
  native proof ownership before copying, and rejects altered same-ID courses,
  injected authority options and observed selected-source changes. Its separate
  **49/49** integrated suite passes, without skips. It
  remains tooling-only, unscored and default-ineligible. This is a local trust
  boundary, not client attestation. [Contract and limits](fpv-static-course-proof.md#built-in-academy-admission-audit-offline-preparation).
  World-owned course resolution, admission policy and competitive filtering
  remain independent software work; physical evidence gates promotion, not
  this preparation.
- **R6: static quad composition is implemented and reviewed locally.** Four
  explicitly indexed rotor surfaces now combine with the shared-voltage load
  solver to calculate force, torque and power, using declared SI geometry and
  declared canonical ESC-command units. Missing/negative/power-inconsistent operating
  values and conflicting known environmental conditions cannot produce a wrench;
  diagnostic receipts remain available. Unknown conditions remain visible. **64/64** integrated synthetic
  circuit/vector/energy checks pass. This adds **zero shipped bytes** and changes
  no aircraft, controller, motor response or recording. Command mapping,
  allocation, dynamics, matched-data fitting and versioned activation remain.
  [Data and adapter contract](fpv-propulsion-evidence.md#static-quad-forward-adapter-non-activating-preparation).
- **R9: the Firefox failure is localized further.** Supported native profiling
  identifies contact velocity-constraint resolution as the dominant cost.
  A separate unattached headless run still fails capacity, so Playwright
  attachment is not required to reproduce it. Original failed results remain
  authoritative; no trajectory-preserving performance fix is established.
  All 32 completed diagnostic cases preserve exact trajectories.
  [Investigation and retained negatives](fpv-v3-firefox-solver-investigation-20261019.md).
  The independently reviewed [minimal contact replay](fpv-contact-tape-diagnostic-20261019.md)
  now reproduces the gap using only pinned Rapier, a checkpoint and recorded
  forces. All **1,000 post-step world/body observations** match in Node and two
  fresh runs each of Chrome and Firefox. Five integrated diagnostic tests pass.
  The reproduction excludes controller/game/worker logic, but does not establish
  a compiler defect, a remedy or full-flight capacity. This closes the minimized
  reproduction task; R9's original performance failure stays open.
- **Release audit at 02:37:54 CEST:** #1665's release-ready job awaits a runner;
  #1679 waits behind its superseded run's queued cancellation finalizer;
  #1685's 15 checks remain queued. A second read-only snapshot at **02:48 CEST**
  found no change. No final-source test failure or merge
  conflict was found. Public metadata still reports `e440030395`. No run was
  reset and the public browser/archive state was untouched. Queue ETA unknown.
  At **02:59:48 CEST**, #1679's team-admission check had started; its other
  eleven checks and #1685's fifteen checks remained queued. This is queue
  progress, not release completion. No final-source failed check was reported.
  At **03:09 CEST**, #1679 had four successful checks, two running and six
  queued. #1665 still awaited release-ready; #1685's fifteen checks remained
  queued. Sources and dependency ordering were unchanged.
  At **03:22 CEST**, #1679 had six successful checks, three running and five
  queued; #1665 still awaited release-ready and #1685's fifteen checks remained
  queued. Main was refreshed without new commits to incorporate. No failed
  final-source check or changed prerequisite head was found. The next reviewed
  continuation is `codex/fpv-workbench-integrity-20261019`, depending on #1685.

The protected archive incident R13 remains P1 with no further deletion or
unapproved inspection. Disk headroom is about **1.5 GiB**; only small targeted
builds and measurements are being used. Conditional estimates below remain
engineering allowances, not completion promises; the old capacity-search
estimate is superseded by the completed and package-qualified reduction.

Current priority order:

1. **P1:** integrate #1698 after #1685 and accept the eventual
   deployed source. Queue time is unknown; allow **1–2 working days after a
   stable deployment** for the shared available-desktop acceptance scope.
2. **P1:** assess a trajectory-preserving Firefox remedy using the completed
   minimized contact diagnostic. Profiling and reproduction are complete; a fix ETA is
   unknown. The existing failed performance gate remains open.
3. **P2:** available-desktop offline/update, rendered-host and Regional coverage;
   **3–5 working days** for an agreed accessible matrix, fixes extra.
4. **P2:** remaining propulsion command mapping, allocation and dynamics;
   trusted World course resolution, agreed local scoring-admission rules and
   competitive filtering. These can proceed in parallel with release, without
   pilots. Real-aircraft activation and scored promotion still require their
   separate evidence gates; local records versus public competition needs an
   explicit product scope before designing additional authority infrastructure.
5. **Access/evidence-dependent:** R13 archive diagnosis, physical radios/pilots,
   matched aircraft measurements and signed/native targets retain the detailed
   dependencies below. No further public archive mutation is authorized by this
   continuation.

## Earlier status snapshot — 19 October, 02:18 CEST

**The core features are released. The latest flight corrections are implemented
and locally verified, but are not live yet. The whole plan is not complete.**
This snapshot supersedes earlier queue observations below; historical receipts
retain their original source, date and coverage.

| Delivery state                                        | Current evidence                                                                                                                                                                                                                                                                     | Next step                                                                                                                                                                                                                                                                          |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Live**                                              | Read-only public metadata still reports `e4400303952d4d6dcfd6416d6d085131ce71466b`, build `main-e4400303952d`. Fifteen civilian presets, rates/profiles/imports, workbench, continuous practice and archive/challenge tools are released.                                            | Accept the eventual final deployment through fresh source-bound interactions. The protected public browser/archive state remains untouched.                                                                                                                                        |
| **#1665 / #1679 pending**                             | Both PRs remain open, unchanged at `35ae4985c` / `f8eb6c91e`. #1665's final release-ready job remains queued after its other checks passed. Twelve #1679 registered checks remain queued. No failing check was reported by the latest query.                                         | Normal prerequisite integration, CI and deployment. Queue time has no reliable ETA; no checks or controller were bypassed or reset.                                                                                                                                                |
| **Narrow inspector: fixed locally**                   | At 320 × 640, the original Advanced grid clipped fieldsets and controls. The fix passes visible EN/Meteor75 and UK/Air65 checks, including synthetic load calculations. Independent source review, 9 inspector checks and 19 package checks pass.                                    | Publish this reviewed follow-up, then public acceptance. [Receipt](fpv-inspector-narrow-20261019.md). Physical touch, virtual keyboard and 200% zoom remain separate.                                                                                                              |
| **Current browser matrix: partial**                   | Fresh v3/1,000 Hz tests cover fifteen aircraft and thirty aircraft/mode worker/direct/replay/reset/recovery cases per engine. Chrome and Playwright WebKit pass; Firefox matches trajectories but fails the unchanged performance gate. Independent evidence review passed.          | Firefox profiling/remediation plus remaining installed-PWA, rendered-host, streamed-Regional, mobile/native and architecture checks. [Full result and retained failure](fpv-v3-browser-qualification-20261019.md).                                                                 |
| **Propulsion surface prerequisite: complete locally** | Reviewed bounded command/voltage surfaces, coverage-aware interpolation and load solving preserve source evidence. Sparse coverage and derived-power diagnostics were repaired after review. 52 focused checks pass. No flight/UI imports activate this module.                      | Versioned runtime integration, controller allocation and matched-data fitting remain open. [Data contract](fpv-propulsion-evidence.md).                                                                                                                                            |
| **Course-result integrity prerequisite: isolated**    | Local commit `54328a69b9fb0763f09c1724e9aedb2968ffbb58` binds immutable reports to owned archive/course inputs, rejects forged or custom-executor eligibility, and preserves unscored/default-ineligible policy. Review, 28 runtime/worker and 8 selected compatibility checks pass. | It is not integrated or shipped: its 2,966 added runtime bytes exceed available Academy input capacity by **1,599 bytes** when combined with the layout fix. Safe capacity work and new exact package checks are required. UI consumers and scored admission are still unfinished. |

Refreshed main `bd15820be` was incorporated into the new isolated follow-up;
its three newly fetched commits concern First Flight and do not change the
qualified FPV physics. The reviewed integrated follow-up is bound to
`4e1959a4a1eb88a0d64399511ddc50e87410de54`: **61/61 focused checks** and
**19/19 package checks** pass. A first focused invocation found a missing sparse
checkout test file; it did not run the tests. The file was materialized and the
complete result is retained separately. No runtime failure is concealed.

[Fresh committed-input measurement](fpv-followup-package-20261019.json) confirms
Academy **13,302,441 / 13,303,808 input bytes** and **13,072,051 / 13,107,200
bundled bytes**, leaving **1,367** and **35,149** respectively. World input margin
is **1,178,836 bytes**. Source-file inventories stay at 98/151/211; no cap or
admission changed. Disk headroom is about **2.1 GiB**. The non-activating surface
module is deliberately outside the runtime package closure.

The reviewed follow-up is now **[PR #1685](https://github.com/mekhovov/revealline/pull/1685)**,
published at `1129b1a0e537d9b57ea4fa3bdf187831b4c63c57` with explicit
`Depends on #1679` ordering. Its normal checks are queued, including source
preflight; this does not mean the changes are live. The release sequence is
**#1665 → #1679 → #1685 → source-bound public acceptance**. This publication
bookkeeping changes documentation only and is retained locally without resetting
the published source's already queued checks.

### Historical 02:18 priorities and estimates — superseded

This table preserves the earlier decision state, including the then-unresolved
capacity deficit and zoom check. It is not the current work queue. Use the active
continuation above and the detailed remaining-work table below. No dependable
all-plan completion date is available.

| Priority / work                                                   | Remaining result                                                                                                                                                                                                                       | Estimate / dependency                                                                                                                                                                                                                                            |
| ----------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **P1 — final flight corrections and live acceptance**             | Normal release of #1665 then #1679 and this scoped follow-up; fresh public Meteor75 Academy, World and Regional checks against the actual deployed source.                                                                             | **1–2 days** after successful final deployment; no queue ETA. Local 60 completed lesson flights, 35 sustained cases and 420 short course samples remain source-bound evidence, not exhaustive public acceptance.                                                 |
| **P1 — protected archive incident (R13; no R4 cleanup)**          | Account for the six older protected archives, establish cause and recover if possible. No further deletion.                                                                                                                            | Cause/recovery **unknown**; allow **1–3 investigation days** only after an approved diagnostic/export route is available. Earlier automatic approval review rejected native storage inspection; that route remains unavailable and is not bypassed.              |
| **P1 before platform promotion — Firefox capacity (R9)**          | Reproduce under controlled host load, profile solver/WASM internals, qualify any fix without changing physics frequency or trajectories. Worst retained landing capacity **0.890×**, worker **1.461×**; required **2×**.               | **1–3 days initial profiling**, fix/requalification ETA unknown. Focused profiling reproduces the floor failure and attributes ~89–90% of its measured interval to the solver call; it does not identify the internal cause.                                     |
| **P2 — R11 source capacity and consumers**                        | Recover at least **1,599 bytes** through reviewed equivalent code reduction, then integrate the isolated provenance checks and qualify exact packages. Complete comparison-consumer integration and scored-admission rules separately. | **1–2 days for packaging-design investigation**, implementation ETA unknown: no suitable small equivalent reduction was found. Scoring remains **1–2 engineering weeks provisionally**, with promotion dependent on qualification. No limit increase is assumed. |
| **P2 — broader UI/platform matrix (R3/R9)**                       | Physical touch/virtual keyboard, 200% zoom, installed-PWA install/update/offline/eviction, rendered full-host load, streamed Regional transitions, agreed mobile/native targets and another architecture.                              | **3–5 days** for an agreed accessible initial matrix; **1–2 days per extra target**, remediation extra. Responsive emulation and Playwright WebKit do not qualify physical touch or installed Safari.                                                            |
| **P2 — measured propulsion/dynamics (R6)**                        | Activate versioned surfaces and current/electrical coupling, adapt allocation and fit propulsion, motor response, inertia and drag to matched data.                                                                                    | **5–10 days for one reference aircraft** after usable matched evidence/scope. Independent preparation continues without pilots; data acquisition and all-fifteen fidelity have no reliable date.                                                                 |
| **Deferred by available evidence — real controls/pilots (R7/R8)** | Physical radio/touch mapping and cadence; experienced-pilot comparisons.                                                                                                                                                               | **1–2 days per control target**, **2–3 pilot sessions + 1–2 review days** after access. Not a blocker for completed web features.                                                                                                                                |
| **P3 / separate evidence or distribution scope (R10/R12)**        | Measured propwash/ground effect, eligible Advanced promotion, signed full-game/native distribution if selected.                                                                                                                        | Undated until aerodynamic evidence, platform qualification, signing access and distribution scope exist.                                                                                                                                                         |

The source inventory remains **41 Swarm records and ten spreadsheet tabs
classified**, not every kit implemented: equipment is not an aircraft,
military-specific entries are excluded and ambiguous civilian component sets
remain unresolved. Estimated aircraft coefficients must not be described as
measured whole-aircraft fidelity. Existing preferences, historical backends and recordings retain their documented
compatibility. This continuation did not modify unrelated shared-workspace edits
or public archive state; it does not establish that the missing archives survived.

### Earlier integrated flight/UI qualification — source-bound receipt

**The documented local flight checks pass at `cfdf24d617f631c15e0bfaff1f167dcba5008ab9`; the earlier UI-only follow-up passes its scoped checks at `3949d2f2afd1395e447de27ba906152aaec5add9`. This is not full platform qualification; the later Firefox failure above remains open.** The combined source includes current main, the five reviewed #1665 corrections, safe recovery-handle reopening, course verification, optional recorded-aircraft references, the final split-control lifecycle repair and versioned contact/timing fixes. Runtime changes are frozen for publishing. The UI follow-up fixes thirty fine-adjust accessible names and clarifies Legacy reference entry; its 169 checks and actual packaged Ukrainian acceptance pass. [UI evidence](fpv-workbench-labels-20261019.md). [Integrated evidence](fpv-flight-integrated-acceptance-20261019.md).

- All fifteen aircraft pass the current v3 **1,000 Hz** numerical gates against the 2 kHz reference: maximum response error **0.499%**, worst floor penetration **0.677 mm**, minimum local simulation capacity **8.69×**. This qualifies the measured local runtime, not a device matrix or real-aircraft fidelity.
- **60 complete scripted lesson flights**, **35 sustained cases** (including a 735-second Meteor75 flight and Regional rollback/recovery), and the latest-main **420-flight sample across 141 host/course pairs** pass. Distinct configurations and changed aircraft/rates/PID values are exercised in all three hosts. The short samples do not mean every objective was completed.
- The actual emitted Academy build completed Meteor75's unchanged **Lift and land** lesson by keyboard in **8.58 seconds**. A real worker verified the recorded course completion, and checkpoint recovery returned paused at **10.00 seconds**. The descent included a bounce before settling; no lateral input was given.
- Actual packaged World Nazgul takeoff, steering, release and pause passed in Self-level, with its 12.80-second recording verified from reset. An explicit mode change produced a fresh paused Acro attempt and a separate short takeoff/steering check. No World course completion is claimed.
- All **19 package checks** pass. Academy has **2,195 original-input bytes** and **35,977 bundled bytes** spare; original source-file inventories remain full. No caps or admissions were raised. This is the historical `3949d2f2a` measurement; the front snapshot and fresh follow-up receipt supersede its margins.

The final R20 [qualification report](fpv-current-contact-qualification.md) retains the rejected positive-gap contact proposal, the failed 500 Hz drop gate and missing-fixture retries. R19's [recovery correction](fpv-recovery-handle-20261019.md) is locally accepted; it does **not** diagnose R13 or recover the six protected archives. No public-site archive changes were made in this continuation.

Priority order is now **normal review/integration → hosted checks and deployment → source-bound public acceptance**. #1626's deployment and post-deployment verification have succeeded. #1665's appearance build and final source aggregate have passed; release-ready remains queued at the status snapshot above. The complete follow-up is submitted as [PR #1679](https://github.com/mekhovov/revealline/pull/1679), against freshly fetched main `dd337c812`, with explicit `Depends on #1665` ordering before normal integration. Once the prerequisite merges, any required protected-main update must receive fresh checks; retain source comparisons and qualify actual differences. No force-push or manual hosted merge is used. R13 remains a separate P1 investigation with no further deletion. Missing radio, pilot and measured-flight evidence remains deferred as requested.

## Current status

**The core rates, fifteen-aircraft practice and Setup Workbench features are
released; the follow-up corrections in #1665/#1679 are not yet public. The
complete original ambition is not finished:** exact real-aircraft
fidelity, exhaustive source-kit coverage, wider-device qualification and Advanced
competitive promotion remain open or explicitly excluded as detailed below.

The earlier three corrections were released through
[PR #1583](https://github.com/mekhovov/revealline/pull/1583), merged as
`3a2880287b501dffcdd1ab1937ffbe0fead8b782` on 18 October at 09:14 CEST.
The release's [public deployment metadata](https://mekhovov.github.io/revealline/main-deployment.json)
reported `20555cda6bd44a0736aa829e64c52e455b4e770c`; its
[Pages build, deployment and verification](https://github.com/mekhovov/revealline/actions/runs/39145153450)
all passed. This review downloaded the three corrected public modules and
confirmed their bytes matched the verified PR #1583 release. The later live
metadata check on 18 October at 22:49 CEST reported
`cb8dddd3d3c11d24c56b014fa48ac0e6417d6465`, the existing recovery-entry update.
Its build/deploy had succeeded while post-deployment verification was queued at
that check; the complete cb8 Pages run subsequently passed.
PR #1626 merged normally as `e4400303952d4d6dcfd6416d6d085131ce71466b` on 18 October
at 23:05:20 CEST. Its [Pages deployment](https://github.com/mekhovov/revealline/actions/runs/39166266155)
completed on 19 October at **00:19:47 CEST**. Read-only public metadata now reports
that exact merge source and build `main-e4400303952d`. The served
`optional-practice/civilian-fpv/aircraft-presets.mjs` also matches its source bytes:
**38,055 bytes**, SHA-256
`df46d7ca8359be8415ca6682f62454373d012aa3a6b445ad24cd6bbff9999784`.
The post-deployment `verify` job **117806055366** passed at **00:54:31 CEST** on
19 October; the complete workflow succeeded at 00:54:32 CEST. Source-bound deployed
interactive acceptance remains separate. These HTTP reads did not touch the public UI or archives.
Later continuation changes below are not yet public.

### Earlier continuation — implementation and acceptance history

This earlier work was isolated on `codex/fpv-sustained-flight-20261018`, based on refreshed
main `e3a20a2a342757444775c0c261131da168280b58`. Unrelated local demo/UI edits
remain untouched. The reviewed six-commit candidate was subsequently rebased
cleanly onto main `461ace72e78f8cbd77c26549381d9e21d0a65e91`. The following work is
**merged through normal review, deployed and post-deployment verified** in
[PR #1626](https://github.com/mekhovov/revealline/pull/1626), final source
`cf13bcad9a59a387be7c31c9af8d30d74e7c1860`.

The hosted candidate checks passed on the exact PR source, including **1,364/1,364**
primary checks. The optional-practice integration run passed **1,221/1,221**
practice and **10/10** pointer checks; observers reported **170 pass, zero fail,
one skip** because their historical fixture bundle was absent. That optional run
is bound to merge-integration source `8fc952b7a0beb70b3065663e4b5390feb209d490`,
not the isolated PR head. All four focused source shards, their aggregate, the Appearance
preview and industrial checks have passed. The focused aggregate completed at
22:21 CEST and final release-ready passed at 22:55 CEST. The normal controller
merged the unchanged cf13 source at 23:05 CEST as `e4400303952d4d6dcfd6416d6d085131ce71466b`.
No gate was waived. Parent Pages deployment completed at 00:19:47 CEST on
19 October; exact public metadata and catalog bytes match that merge, while
the normal post-deployment verification job subsequently passed at 00:54:31 CEST.
The five reviewed follow-up fixes rebased cleanly onto that merge, with all five
patches unchanged, and are now [PR #1665](https://github.com/mekhovov/revealline/pull/1665),
source `35ae4985c0bec6277a45b9331efc0c0332aa165a`. Post-rebase 448/448 focused tests,
ESLint and diff checks pass. Two inherited formatting warnings are disclosed;
large unrelated reformatting was avoided. New main advanced independently; the
published candidate remains stable for normal integration gates.
An obsolete cancelled run's always-run aggregate
had blocked the source lane and was force-cancelled; the final source subsequently
passed its own normal checks. No final-source gate was waived. Repository
`REVEALLINE_FULL_CI=false` means the broader deferred lint/test gates must not be
reported as a full-repository pass. Parent post-deployment verification is complete; deployed UI acceptance and follow-up publication remain pending.

| Priority                                  | Current result                                                                                                                                                                                                                                                                                                                                                                                                                                       | Next gate                                                                                                                                                                                                                                |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **P1: keyboard flight regression**        | Public Meteor75 flight reproduced throttle dropping to zero after deliberate Pause → Resume, causing a fall/flip. Fixed session-specific resume preserves the last accepted throttle, clears held rotation keys and retains zeroing on blur/source changes/restart. Six host regressions fail against the old source and pass with the fix. Local rendered World visible-button and P-key pauses both resumed at 50% throttle with neutral rotation. | Independent review complete; reloaded Academy and Regional acceptance passed. Source gates and build/deploy passed in #1626; post-deployment verification passed; source-bound public interaction remains. No physics constants changed. |
| **P1: sustained coverage**                | All fifteen aircraft pass 32-second controlled RC-input flights in Acro and Self-level (30 cases), rotated across Academy/World/learning hosts, including contacts, re-takeoff and exact recovery. All 35 cases now pass, including four 65-second Regional cases and a 735-second Meteor75 flight with 730.1 seconds airborne.                                                                                                                      | The [receipt](fpv-sustained-flight-qualification.json) retains named source hashes, initial synthetic-pilot diagnostics and exact scope. These in-process tests do not replace rendered/manual flight or establish total-memory bounds.  |
| **P1: archive reliability investigation** | Both local and public World archive operations reported a closing IndexedDB connection. Public reload/refresh then showed only a new test session instead of the prior sixteen entries. Cause unknown; the six older archives cannot be confirmed preserved. A stale-handle reconnect correction is tested, but does not establish retention or explain the missing inventory.                                                                       | P1 retention remains open. Preserve this negative and the earlier 16 October owner audit; reconnect success is not proof of retained data. No bulk-delete path was found.                                                                |
| **P2: source inventory**                  | [Civilian disposition inventory](fpv-civilian-source-inventory.md) covers all 41 returned Swarm records and all ten spreadsheet tabs. Existing Mobula8 maps to the explicitly civilian indoor kit. Military-specific entries are excluded; equipment and ambiguous collections are not fabricated aircraft.                                                                                                                                          | Inventory complete within the documented source/access boundary; this does not claim every source kit is implemented.                                                                                                                    |
| **P2: civilian candidates**               | Cetus X (2022 Betaflight SPI ELRS, original 30C series cells) and Protos 1.6 AIO 1.0 are implemented with distinct original visualizations and visible approximation notices. All thirteen previous numerical identities remain unchanged. All fifteen pass the local numerical gate; targeted source/config/host checks pass.                                                                                                                       | Independent review and short Academy takeoff/steering/pause checks complete; deployed and post-deployment verified in e440; public interactive acceptance remains. [Implementation evidence](fpv-civilian-candidate-implementation.md).  |
| **P2: actual browser zoom**               | Chrome Guest toolbar verified actual 200% zoom. EN/UK camera search, keyboard numeric editing, reachable focused fields/actions and revert checked; zoom restored to 100% and guest window closed. The discovered invalid-value/slider mismatch is corrected; final DOM reads confirm 86/86 and unfinished 4/86 exact/slider pairs.                                                                                                                  | Local corrected-control acceptance complete. Keep this single Chrome/desktop check distinct from narrow-viewport and mobile coverage.                                                                                                    |

The local rendered World session reached **14:20.30**, retained clip **12:00.00–14:20.30** and durable checkpoint **14:20.00** despite archive failure. This includes ground/ceiling contact, not measured continuous airtime. Reloaded Academy Meteor75 and both new presets passed short input/pause checks; Regional Meteor75 passed a separate current-source starting-area flight. [Rendered evidence](fpv-flight-continuation-20261018.md).

The public long-flight attempt reached 5:44.60 but encountered the pause bug;
it is **not** a completed twelve-minute rendered flight. It also confirmed
continued flight and durable checkpoints with the sixteen-entry archive store
full. The user authorized deletion of ten identified test archives. The first attempt reported a closed connection; all sixteen were still listed immediately afterward. After reload, the older inventory was absent. No successful cleanup or preservation claim is made; no further deletions were attempted.

Archive feedback now distinguishes a confirmed single deletion from a failed or
cancelled follow-up refresh, and initial list errors are visible. **19/19**
controls/integration checks pass, including EN/UK failure paths. This corrects
outcome reporting without changing storage algorithms or explaining the missing
public inventory. A new local 50.78-second Regional archive saved and verified
from reset; that positive result does not close retention R13.

The rebased candidate also has **30 rendered catalog smoke cases**: all fifteen
presets launched and steered in both modes through the World workbench. The
[receipt](fpv-rendered-catalog-20261018.json) preserves the excessive-throttle
Meteor75 Pro ceiling contact and gentler retest. Archive-full status did not stop
the remaining flights. These short checks advance R1; longer representative
routes and acceptance on a frozen public release remain.

Additional source-preview checks exercised X650 in Circuit stadium (25.54 s) and
Cetus X in Open meadow (72.76 s). These were unscored draft flights, not completed
course objectives. The Cetus archive finished through 64.50 s, verified from reset,
survived a normal same-tab reload and verified again. No archive deletion or
saved-library change was performed. [Detailed limits](fpv-flight-continuation-20261018.md).
The older missing inventory remains unresolved.

### Newly reproduced lesson defect — P1

A normal saved-Meteor75 **Meet your drone** practice attempt, entered through
the teaching guide's **Practice with BETAFPV Meteor75** action, did not complete
its initial on-pad condition. After settling upright with zero throttle, zero
vertical speed/drift and centred sticks, the explanation showed **−0.0 m** against
the **0.0–0.8 m** height band, with every other condition satisfied and zero hold
progress. The physical contact solver settles approximately 1 mm below its plane;
the mission adapter passed that small negative height straight to a strict bound.

Source review also found that **56 Flight School courses and 30 World courses**
request the authored `$floor` landing surface, while aircraft contacts supply
`course-boundary-y-min`. A predicate-isolation reproduction completes 3/3 steps
only after changing that support identifier; the original stays at 2/3. This
does not mean all those courses were flown or that every failure has one cause.

**R14 / P1: selected-aircraft mission completion** is corrected locally in
`55a5eefd1f02dec493fd80a5da53aabd301cedbf`, preserving physical state/contacts and
verified historical v1 recovery. Independent review and the original 31-check
adapter/course/recovery/challenge suite passed. The later
`1c7354bebc5349c90a7f99190654ca098fedb4fc` receipt covers **all fifteen aircraft in
both modes** completing one original ground/lift/landing lesson, continuing
practice and recovering with exact aircraft/controller/rate configurations.
Completion was 6.04–6.26 seconds. The matrix run reported 31 TAP passes including
its parent and four unselected tests; a separate run passed those four. These
are overlapping targeted checks, not a sum of unique tests.

The rendered World teaching route now completes on Meteor75 at **13.66 seconds**,
allows a second takeoff and finishes at **16.34 seconds**. Its archive verifies
from reset. This is local keyboard/Self-level evidence, not public acceptance or
all-course coverage. **Release checks and deployed acceptance remain**, usually
several hours after integration but dependent on CI capacity. PR #1626's separate
pause/archive corrections remain on their unchanged release path.

Restoring the original test library exposed **R15 / P1: post-restore editor
selection**. The library committed successfully, but the editor attempted to use
the removed active setup and reported a `profileId` error. Refreshing recovered
the view; the exported contents match the pre-test backup apart from its expected
revision increment. A focused selection/reset fix now passes **179/179** tuning UI/library checks
and rendered acceptance: the original backup restores in one action, the editor
shows `My drone` / `Legacy feel` with zero changes, and the active Meteor75
attempt remains paused at 8.92 seconds. The new backup matches the original
apart from its expected revision increment. Independent review passed and commit `ba1f6d065` retains the correction;
**release checks and public acceptance remain**. No archive deletion
occurred.

That acceptance also reproduced **R16 / P1: Apply & restart starts before Arm**.
From a paused World attempt, saving a Meteor75 draft with Apply & restart briefly
showed scene preparation, then advanced the new flight to 8.92 seconds without
an Arm action. The UI promises that a new attempt waits for Arm. The correction is committed as `07196f3a29f423d94e6708aff466740837106765`.
Only World's workbench restart needed the existing paused-start flag; Academy
and Regional already waited for Arm. Six pre-fix failures were reproduced.
The final World/Legacy-course/Regional matrix passes nine configuration cases
plus its parent; three selected Academy cases and fourteen related origin/pause/
physical-host checks also pass. These counts overlap earlier targeted runs.
Independent review confirms ordinary Fly behavior and frozen settings remain
unchanged. Rendered Meteor75 stayed at 0.0 seconds with motors off after scene
preparation and a neutral-input wait; only explicit Arm advanced it to 1.02
seconds. The original library was restored afterward. **Integration/package
checks, publication and deployed acceptance remain.**

### Combined follow-up qualification

The reviewed aircraft, lesson, restore, explicit-arm and propulsion-inspector
changes are combined on source `ad7225621f0522d9a5d0c886a51e56aefc6f5274`,
rebased onto main `cb8dddd3d3c11d24c56b014fa48ac0e6417d6465`. All seven reviewed
runtime modules match their pre-integration bytes. The combined propulsion
suite passes **46/46**, and packaging passes **19/19**, with no failures or skips.
[Measured receipt](fpv-combined-package-qualification-20261018.json).

Actual bundled Academy is **13,099,861 / 13,107,200 bytes**, leaving **7,339 bytes**;
original inputs leave 31,556 bytes. World and simulator-only native package
checks pass as well. Byte limits were not raised. Selected-source file counts
are exactly full at 151/151 and 211/211, so later features need fresh dependency
and capacity checks. This is package qualification, not deployed/offline/native
device acceptance. PR #1626 has since deployed as e440; the combined follow-ups described here
have not yet been published.

### Observed practice timing — accepted locally

Commit `a113208ce8e4076c19b2acc99332c3172e53bfcc` adds unscored timing in
the pause panel. All fifteen aircraft in both modes complete the same original
lesson with and without the observer and retain exactly equal full recovery
packets. Host, failure-isolation, long-clock and recovery checks pass. The
historical scored-sector tracker is unchanged.

A rendered World Meteor75 Self-level lesson completed all three objectives in
**0.80, 12.34 and 6.04 seconds**. At 20.32 seconds, restoring the durable
20.00-second checkpoint kept flight paused and explicitly discarded unknown
earlier split history. The new panel translated correctly into Ukrainian.
English and the pre-test setup library were restored; its content matched
exactly apart from the expected revision increment. The local archive store
reported full, but flying, lesson completion and checkpoint recovery continued.
No archives were deleted. These are local-source-preview observations, not
public deployment or packaged/offline/device acceptance.

Actual package checks pass **19/19**, with bundled Academy at
**13,106,517 / 13,107,200 bytes**: **683 bytes spare**. Source file slots remain
full at 151/151 for Academy and 211/211 for World. Neither budget was increased.
The separate locale-switch defect in existing recovery/archive messages is now
corrected in R17 at `39a8be8c19c2a107b7be2352f45dbfe5cc23f5cd`. Its **36/36**
controls checks include zero status writes across fifty unchanged paints and
one update per locale change. A fresh-origin rendered checkpoint test passed
English → Ukrainian → English without resuming flight. No setup was saved or
archive deleted. Final package checks pass **19/19** at **13,106,939 bytes**,
leaving **261 bytes** before the R18 build-only correction below.

### Package headroom — accepted locally

R18 is implemented at `7f38f550e5f67278aea5fa8d1f3aad1b059caa0c` and
independently reviewed. Applying the existing safe indentation projection to
only the bundled presentation module saves **52,539 bytes**. The actual bundled
Academy is **13,054,400 / 13,107,200 bytes**, leaving **52,800 bytes**. All caps,
embedded assets and numerical source identities remain unchanged. Preservation
checks pass **9/9** and package checks **19/19**.

The actual emitted package also passed a rendered Academy check: unlock,
Meteor75 draft/previews, explicit Arm, short lift, pause and 5.00-second recovery,
including English → Ukrainian → English result text. The lift overshot to the
10 m ceiling; it is a package smoke check, not a completed lesson or hover
qualification. English and the original draft were restored; no setup save or
archive deletion occurred. [Scope and measured receipt](fpv-package-headroom-20261018.md).
Original-input margin remains 24,478 bytes and selected source file counts remain
full. This closes the bounded byte-headroom change locally, not every future
capacity or delivery gate. Publication remains pending.

### Static-course recording verification — tooling complete

R11B is committed and pushed as `a1d883ccedb68704acc320352ec6a3f895d8b580`,
with **42/42 checks passing** on the clean committed source and independent
review complete. It first verifies recorded physics, then reconstructs the
supplied static course through its original mission adapter. All fifteen
catalog aircraft in both modes complete the introductory lesson; gate crossing,
miss/wrong-direction, historical v1, tampering, cancellation and CLI tests pass.
[Feature and limitations](fpv-static-course-proof.md) ·
[Qualification receipt](fpv-static-course-tool-qualification-20261018.json).

The tooling is integrated unchanged as `eb44937112e205ac5336ae6ad49e0d0c6c71de66`
on the combined follow-up branch. All three file hashes match the reviewed
commit. It changes no shipped runtime, aircraft configuration, archive format or
scoring authority. The existing package receipt remains bound to its stated
source, not relabeled as a new build of the later tooling commit.

Dynamic/action-dependent courses, challenge wrappers, Regional/free flight,
partial-origin clips and unknown versions remain explicitly unsupported. Parsed
reports are descriptive output, not trusted production proof. The 39,000-tick
cursor check verifies bounded schedule traversal, not a long physical flight.
The original R11B increment did not include browser integration. R11C below
now shares its reconstruction kernel with the browser; comparison/ghost selection
and competitive qualification remain separate work.

### Browser course verification — implemented and locally accepted

**R11C** is committed through `5947bdcf5fbd9af302e25a959fdbcdbbfcfdbf1f` on
`codex/fpv-browser-course-proof-20261018`. The archive panel now offers **Verify
course completion**, separately from its unchanged physics-only check. It uses
the selected archive's frozen aircraft, settings, mode and historical mission
adapter against the current frozen course. Results remain unscored. Unsupported,
incomplete, mismatched and checkpoint-only recordings never become course proof.

The CLI and browser use one reconstruction kernel. A dedicated cancellable worker
keeps verification isolated from flight; World supplies its own course adapter
without adding the World model to Academy. Session replacement, same-owner
recovery, selection changes and disposal reject late results. Language changes
translate results and archive status without repeating verification or storage.

The focused suites pass **42/42 reconstruction**, **22/22 worker/runtime** and
**31/31 UI** cases. Independent review and **19/19 package** gates pass. These
counts are separate suites, not a claim of full-repository qualification.
[Acceptance record](fpv-browser-course-verification-20261018.md) ·
[Final committed-source package receipt](fpv-browser-course-package-qualification-20261018.json).

Rendered World Meteor75/Self-level completed **Meet your drone** at **14.48 s**,
paused at **16.34 s**, and independently verified the same completion time. Its
archive survived a normal reload and verified again while a different attempt
remained paused at **0.18 s**. An incomplete **26.86 s** flight correctly failed
course completion while its physics passed. Cancellation and EN/UK results pass.
An earlier excessive-throttle climb and a separate hard landing/inversion are
retained negative manual attempts, not completed-flight evidence.

The actual emitted Academy package flew a **3.88 s** Meteor75 draft, sealed it and
correctly returned verified physics / incomplete course. This confirms the shipped
worker entry and dependency closure in a browser; it does not claim offline-network
or native-device qualification. No public archives were changed or deleted.

Final Academy input headroom is **4,361 bytes** and bundled headroom is **32,682
bytes**; source slots remain **151/151**, with World at **211/211**. A complete
visual ghost must fit those limits or receive a separately reviewed size reduction.
Hosted integration/publication and deployed acceptance remain.

**R11D split-reference slice is now implemented, independently reviewed and locally
accepted** through `d4565cf6e`. [Detailed acceptance](fpv-practice-reference-20261018.md)
records prepared comparison/terrain matching, explicitly selected owned proof,
bounded split data and safe recovery. The real Meteor75 test retained its reference
through pause/resume and cleared it at checkpoint recovery. EN/UK and explicit
clearing passed. Automated scopes: 38 session/worker, 42 reconstruction, 69 UI, 20
validator/projection and 19 exact package checks; no skips in these groups.

A narrow generator prerequisite reuses the already shipped JSON validators,
saving 5,033 bytes with AST/boundary preservation. Historical R11D Academy margins
were **4,259 original-input bytes and 32,579 bundled bytes**, source slots 151/151;
World remains 211/211. No caps changed. Hosted publication and deployed acceptance
remain. **R11E** now implements bounded geometry-correct visual reference playback.
Its R11E package left **11,327 original-input bytes and 39,646 bundled
bytes**. The subsequent accepted R19 recovery correction leaves **9,185 original-input
bytes and 37,504 bundled bytes**; every later runtime change needs remeasurement. Local rendered Academy/World reference checks are complete; hosted
integration and deployed acceptance remain. Its dedicated renderer preserves
actual geometry and long clocks independently of the legacy PB renderer.
No score or competitive promotion is enabled.

## Delivered and retained

| Accepted area             | Completed behavior                                                                                                                                                                                                                   | Evidence / qualification boundary                                                                                                                                                                                                                                                                                                      |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Rates and transfer        | Legacy plus Actual, Betaflight, Quick, KISS and Raceflight; versioned throttle, named profiles, per-setup assignments, CLI/preset review and native transfer.                                                                        | [Completion record](fpv-tuning-completion-plan.md). Firmware compatibility is limited to the verified releases 4.5.2, 4.5.5, 2025.12.4, 2025.12.5 and 2026.6.2; this does not execute Betaflight or translate its PID values into SIM gains.                                                                                           |
| Aircraft                  | Fifteen civilian presets, installed-component accounting, distinct numerical configurations, dimensions and simplified visualizations; editable battery/camera payloads and starter or retained rates.                               | [Original twelve](fpv-aircraft-presets.md), [Mobula8 and source limits](fpv-civilian-kits.md), [Cetus X and Protos](fpv-civilian-candidate-implementation.md). Physical coefficients remain estimates where identified measurements are absent.                                                                                        |
| Practice and recording    | Aircraft-aware Academy, World, learning and Regional practice; unrestricted flight, bounded recent clips, recovery, persistent segmented archives and bounded ghosts. Storage failure does not stop flying.                          | [Implementation](fpv-aircraft-completion.md), [archives](fpv-aircraft-archives.md). Verification certifies recorded simulation behavior, not real-world fidelity or scored eligibility.                                                                                                                                                |
| Optional endurance        | Depletion off by default; explicit battery/timed challenges preserve ordinary continuous practice.                                                                                                                                   | [Battery](fpv-aircraft-endurance.md), [challenges](fpv-aircraft-challenges.md). Mass, propulsion limits and instantaneous sag remain active without depletion.                                                                                                                                                                         |
| Workbench                 | Basic/Expert views of one draft, search, rates/throttle/camera previews, shared-profile ownership, undo, import review, calibration/test return and complete setup saves.                                                            | [Workbench record](fpv-setup-workbench.md). Actual 200% Chrome zoom has new EN/UK evidence above; physical-device usability remains separately unverified.                                                                                                                                                                             |
| Controller tools          | Independent reusable-tune library; manual A/B conditions; isolated simulation bench with physics-step metrics; bounded one-gain assistant with separate validation and explicit application.                                         | [Workbench phases 2–3](fpv-setup-workbench.md). All assess the SIM model; they do not establish real-aircraft tunes.                                                                                                                                                                                                                   |
| Flight regression repair  | Regional headings, dense collision frames, pause/prefetch coordination, terrain recovery and paused-browser-stall recovery corrected. Learning reference demonstrations cannot silently replace selected-aircraft practice.          | [Flight audit](fpv-all-aircraft-flight-audit.md), PRs [#1577](https://github.com/mekhovov/revealline/pull/1577) and [#1580](https://github.com/mekhovov/revealline/pull/1580). The keyboard pause/resume defect is corrected and deployed in e440; fresh public interaction is unverified; earlier fixes remain source-bound evidence. |
| Earlier usability repairs | No persistent archive before accepted flight progress; correct Draft / Saved for next flight / Used by this flight status; direct mouse/touch curve inspection with exact keyboard alternatives; completed archive-refresh feedback. | [PR #1583](https://github.com/mekhovov/revealline/pull/1583), released and checked on the public site. No physics constants, timing, historical identities or saved-library formats changed.                                                                                                                                           |

Recovery with retained flown history can create a checkpoint-origin archive
immediately; it need not wait for a new resumed tick. The lazy-start correction
prevents empty archives for fresh, unflown sessions without dropping recovered
history.

Implemented aircraft: **Air65 II Racing, Meteor75, Meteor75 Pro, Meteor85,
Mobula8, Pavo20 Pro II, SMART35, Nazgul ECO XL5, Mach R5 Sport, Rekon7 PRO,
Chimera7 Pro V2, Helion Pro, X650 V2, Cetus X (2022 Betaflight SPI ELRS)
and CADDXFPV Protos (AIO 1.0)**. These are available through the shared
practice paths. Fixed historical/scored challenges retain their original rules;
selected-aircraft practice variants provide access without rewriting old results.

## What the checks establish

| Evidence                         | Result                                                                                                                                                                                                                                                        | Limit                                                                                                                                                                                                                                                                                                                                             |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Earlier correction release       | **1,183/1,183** flight/practice checks, **1,756/1,756** broader preview/Appearance/SIM checks, **1,364/1,364** candidate primary checks and **10/10** pointer checks passed; normal package builds and publication passed.                                    | Separate suites overlap and must not be added into a unique-test total. [Flight/candidate run](https://github.com/mekhovov/revealline/actions/runs/39104883750), [preview run](https://github.com/mekhovov/revealline/actions/runs/39104883723), [release deployment](https://github.com/mekhovov/revealline/actions/runs/39106933666).           |
| Catalog and modes                | **5,616 startup combinations** and **728 short flight/configuration checks**; changes to mass, rates and PID alter actual solver motion across hosts.                                                                                                         | Startup checks generally accept one mission tick; sampled flights are approximately 3–4 seconds. Entries may share maps. This is not every completed lesson/course or every downloadable edition. [Coverage details](fpv-all-aircraft-flight-audit.md).                                                                                           |
| All-model public flights         | **26 brief keyboard takeoff/steering flights**, all thirteen aircraft in Acro and Self-level, on `4f68b924ee74`.                                                                                                                                              | Historical source-bound acceptance, not a new interactive pass on the current release or a physical-radio test.                                                                                                                                                                                                                                   |
| Earlier correction UI acceptance | Meteor75 draft flights and archive verification in local Academy, World and Regional; public rate inspection, correct active-flight status, unchanged archive count before flying, and continued flight despite full archive storage.                         | The final public Meteor75 Acro observation lasted **2.76 seconds**. Existing saved setup/settings and archives were preserved. No sustained-flight or full-mission claim follows from this short check.                                                                                                                                           |
| Numerical behavior               | Original twelve-aircraft report selects **500 Hz** against the **2 kHz** reference, with browser/worker agreement on the recorded Node/Chrome/Firefox/WebKit environments. Mobula8 has later catalog-wide numerical checks and the all-thirteen flight audit. | The recorded cross-browser numerical report covers twelve aircraft on one Apple M4 Pro; it is not a refreshed thirteen-aircraft/device matrix. The historical reference backend's **250 Hz** identity remains separate. [Numerical report](fpv-aircraft-numerical-qualification.json), [browser report](fpv-aircraft-browser-qualification.json). |
| Continuous flight / delivery     | A recorded local flight exceeds twelve minutes; segmented archives, quota-failure trajectory equivalence, checkpoint recovery and offline/native staging have evidence.                                                                                       | Desktop native execution is an unsigned simulator-only ARM64 Mac development shell. iOS staging is not iOS runtime; desktop offline checks are not all OS-installed PWA/update/eviction scenarios. [Aircraft completion](fpv-aircraft-completion.md), [native receipt](fpv-native-second-review-qualification.json).                              |

The first PR #1583 full flight run passed **1,182/1,183**: an obsolete arena test
expected an archive before flying. Its replacement checks idle sessions, short
canonical flights, continuation and interruption of a genuinely flown session.
The corrected run passed **1,183/1,183** before publication. Earlier **35/35**
archive and **213/213** draft/curve/library/host checks remain supporting evidence,
not additional unique-test totals.

Earlier local browser evidence included a 7.16-second Meteor75 archive verified
from reset, a saved/draft roll readout of 145.7/184.0°/s at 50% stick after an
explicit 600→800°/s rate edit, and correct active-flight status after restart.
These observations stay tied to that earlier served source. Publication is now
confirmed; the old queued/final-run-pending wording is superseded.

## Remaining work, priorities and estimates

**Estimates are active engineering effort after the listed dependency is met,
not promised calendar dates.** No overall completion date is defensible while
measurements, devices and pilot availability are unknown. Missing radio/log/pilot
evidence was explicitly deferred by the user and must not block independent
software work. Defects found during qualification may extend these ranges.

P1 is the next available assurance work; P2 improves coverage or closes external
qualification; P3 depends on a qualified physical/platform baseline.

| ID / priority                      | Current status and remaining work                                                                                                                                                                                                                                                                                                    | Estimate / dependency                                                                                                                                                                             | Completion boundary                                                                                                                                                                                                                                                                       |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1 / P1                            | **Local evidence expanded:** 420 sampled flights, 35 sustained cases, packaged Meteor75 lesson and World Nazgul in both modes. Earlier rendered catalog sweep covers all fifteen. Refresh representative interaction on the final deployed source.                                                                                   | **1–2 working days after stable deployment** for shared available-desktop acceptance of R1/R14–R21; fixes and release queues extra. Do not add a separate R20 estimate.                           | Record exact source, selected aircraft/settings, contacts, pause/recovery and long-flight scope; list untested combinations. No exhaustive-course or all-device claim.                                                                                                                    |
| R14 / P1                           | Lesson floor adapter **implemented, reviewed, locally accepted**, merged in #1665; final deployed-source lesson acceptance remains. All fifteen × both modes complete the original lesson in simulation.                                                                                                                             | Engineering complete; normal hosted release remains. Representative public lesson acceptance is included in R1, not an extra estimate.                                                            | Correct authored surface/height interpretation, unchanged physical state and historical recovery.                                                                                                                                                                                         |
| R15 / P1                           | Post-backup editor selection **implemented, reviewed, locally accepted** (179 checks and rendered restore). Merged in #1665; deployed-source acceptance remains.                                                                                                                                                                     | Release queue only; no new engineering estimate.                                                                                                                                                  | Restore selects a valid setup and clears stale draft state without changing the active paused flight.                                                                                                                                                                                     |
| R16 / P1                           | Apply & restart waits for explicit Arm: **implemented, reviewed, locally accepted** across hosts; merged in #1665, final deployed-source acceptance remains.                                                                                                                                                                         | Release queue plus public acceptance.                                                                                                                                                             | Fresh attempt stays at zero until explicit start; normal Fly now remains intact.                                                                                                                                                                                                          |
| R19 / P1                           | Recovery-handle reopening **implemented, reviewed, locally accepted**: 77 focused checks plus packaged save/paused restore. Final integrated packages also pass.                                                                                                                                                                     | Final follow-up review/CI/deployment; queue duration unknown. Public acceptance is included in R1.                                                                                                | Retry only before transaction admission; never retry uncertain writes. Does not close R13.                                                                                                                                                                                                |
| R20 / P1                           | **Documented local flight checks pass; platform qualification is incomplete (R9).** Overlap-only current contact, fixed v3 1,000 Hz, 176 core/37 bench/42 proof checks, fifteen-aircraft numerical matrix, 60 complete lessons, 35 sustained cases and actual packaged keyboard landing/recovery pass.                               | Final review and normal hosted release remain; public acceptance is included in the shared R1 **1–2 working day** allowance if integration remains source-equivalent. Queues/fixes extra.         | Preserve v1/v2 and explicit recorded timing. No invented height support, gain retune, relaxed objective or lost failed-candidate evidence.                                                                                                                                                |
| R13 / P1                           | **Unresolved archive retention incident.** Six protected older public records remain unaccounted for; the later isolated local disappearance also remains unexplained.                                                                                                                                                               | **1–3 investigation days** after an appropriate permitted diagnostic context is available; diagnosis and recovery ETA unknown.                                                                    | Account for protected records and establish cause. Existing inspection denial is not bypassed. No further cleanup.                                                                                                                                                                        |
| R2 / completed bounded scope       | All 41 accessible Swarm records and ten spreadsheet tabs dispositioned. Only the supported civilian indoor kit maps to Mobula8; other entries remain equipment, ambiguous or excluded.                                                                                                                                               | Complete for this accessible snapshot; refresh only on changed sources/clarified civilian references.                                                                                             | Exact titles, status and evidence gaps retained; this is not all-source-kit implementation.                                                                                                                                                                                               |
| R3 / P2                            | Local zoom/narrow EN/UK checks and capture/search fixes pass. Exact PID display and Revert/Undo validity/status fixes are independently reviewed and browser-accepted; the native bench runs after recovery. Combined **743/743 + 19/19** checks pass.                                                                               | Publish the qualified follow-up; public acceptance belongs to R1. Physical touch/virtual keyboard remain.                                                                                         | Exact gains, raw edits and flight identity preserved; desktop emulation does not qualify physical mobile devices.                                                                                                                                                                         |
| R4 / paused cleanup scope          | Ten identified test-archive deletions authorized but **not confirmed completed**; first outcome unknown and older inventory subsequently absent.                                                                                                                                                                                     | No cleanup ETA before R13 is understood.                                                                                                                                                          | Re-identify only the ten named entries and protect the six older ones; never substitute deleting another session.                                                                                                                                                                         |
| R5 / P2                            | Cetus X and Protos **implemented, deployed and post-deployment verified in e440**; approximation/assist limits visible.                                                                                                                                                                                                              | Public interactive acceptance remains. Measurements remain unavailable.                                                                                                                           | Frozen exact component variant, explicit mass and assist limits, distinct visualization, host coverage.                                                                                                                                                                                   |
| R6 / P2                            | Evidence inspector, load solver, command/voltage surfaces, static quad forward composition, fixed-voltage cell inverse and bounded command-domain selection are reviewed. **99/99** synthetic checks include the sag multiplicity fixtures; no flight activation. Joint-cell root isolation/error bounds, sag coupling, command mapping, motor transients and matched fitting remain.                                | Continue independent software preparation. **5–10 days for one reference after matched data**; acquisition/all-aircraft fidelity undated.                                                         | Explicit units/conditions; no extrapolated or synthetic result presented as measured. Versioned activation and held-out validation remain required.                                                                                                                                       |
| R7 / P2                            | Physical USB radio and touch-device mapping, calibration, input ownership and cadence **deferred/unmeasured**.                                                                                                                                                                                                                       | **1–2 working days per representative target** after access, plus fixes.                                                                                                                          | Real-device flight and setup pass; browser cadence is not physical input latency. Keyboard/emulation cannot close this gate.                                                                                                                                                              |
| R8 / P2                            | Experienced-pilot comparisons **deferred by user**.                                                                                                                                                                                                                                                                                  | **2–3 comparison sessions plus 1–2 review days** after pilots are available; scheduling unknown.                                                                                                  | Repeatable maneuvers, subjective A/B feedback and reviewed keep/revert outcomes; pilot preference is distinct from physical fit.                                                                                                                                                          |
| R9 / P1–P2                         | Exact v3/1,000 Hz trajectories agree across Node, Chrome, Firefox and Playwright WebKit. Chrome/WebKit pass measured gates; **Firefox fails capacity** (0.890× landing, 1.461× worker). Native counters, minimized replay and three fresh sampled runs isolate the slowdown from controller/game code. Wider platform checks remain. | Profiling and minimized reproduction complete; remedy/requalification ETA **unknown**. **3–5 days** for an accessible agreed platform matrix, then **1–2 days/extra target**, access/fixes extra. | Preserve original failed matrix and exact replay evidence. Ordinary pinned compatibility build lacks enhanced-determinism; measured matches do not qualify untested platforms. No changed frequency/gate or compiler-defect claim. Headless WebKit does not qualify installed Safari/PWA. |
| R10 / P3                           | Measured propwash and ground effect **gated on base qualification and measurements**.                                                                                                                                                                                                                                                | No dependable ETA before evidence/tolerances exist.                                                                                                                                               | Versioned fitted effects with held-out validation; no invented coefficients to close the row.                                                                                                                                                                                             |
| R11A–C / P2                        | Observed splits, static-course tooling and browser proof **implemented, reviewed, locally accepted**.                                                                                                                                                                                                                                | Final follow-up release/public acceptance only.                                                                                                                                                   | Bounded complete-proof reconstruction, unscored diagnostics, no invented pre-recovery history; Regional free flight has no course splits.                                                                                                                                                 |
| R11D / P2                          | Split references **locally complete**, including the final owner/lifecycle label fix (92 focused checks). Actual final-package proof selection and paused recovery pass.                                                                                                                                                             | Final follow-up release/public acceptance only.                                                                                                                                                   | A control reflects its own live reference; clearing proof removes that reference even if its presence query fails. No physics or scoring changes.                                                                                                                                         |
| R11E / P2                          | Optional recorded-aircraft reference **implemented, reviewed, locally accepted**; final package retains independent split and visual actions.                                                                                                                                                                                        | Final follow-up release/public acceptance only.                                                                                                                                                   | Bounded geometry-correct poses, no collisions/scoring effects, explicit selection and cleanup.                                                                                                                                                                                            |
| R17 / P2                           | EN/UK recovery feedback **implemented, reviewed, locally accepted** without repeated storage operations.                                                                                                                                                                                                                             | Final follow-up release/public acceptance only.                                                                                                                                                   | Locale changes only presentation; unknown diagnostics remain literal.                                                                                                                                                                                                                     |
| R18 / completed local prerequisite | Reviewed helper pruning plus canonical audio-bank reuse recover capacity. Latest-main `7109710578` passes **19/19 package checks**, three canonical projections and all 243 input hashes; final `ecfb4bc01d` preserves those runtime inputs.                                                                                                                                                 | Normal release and R1 public acceptance remain; the R11 capacity blocker is closed locally.                                                                                                       | Academy margin **41,429 bytes**; World **1,218,832**. No cap/file-count change or removed sounds. [Receipt](fpv-main-integration-qualification-20261019.json).                                                                                                                          |
| R21 / P2                           | Fine-adjust accessible labels and contextual Legacy reference guidance **implemented, reviewed and accepted in the final package**. All thirty labels translate; numeric values/undo and retained Legacy behavior are unchanged.                                                                                                     | Final follow-up publication/public acceptance only.                                                                                                                                               | 169 focused checks and actual packaged Ukrainian interaction pass; no physics or stored-configuration change. [Evidence](fpv-workbench-labels-20261019.md).                                                                                                                               |
| R11 / P2–P3                        | Device-local best practice search, owned-proof split/visual actions and capacity repair are reviewed and locally qualified: **776/776 + 19/19** combined checks. Actual Nazgul World-host/Meteor75 Academy searches pass, with cancel/retry, pause/resume and EN/UK feedback.                                                        | Local increment complete; publication/public acceptance remains. Scored/default platform qualification is separate; public competition is outside this delivery.                                  | Reverify candidates, rank completion ticks and label partial coverage. No automatic reference selection, scores or medals. All-course/platform qualification is not implied.                                                                                                              |
| R12 / separate scope               | Signed/full-game native distribution **unscheduled**; simulator-only development package delivered.                                                                                                                                                                                                                                  | Not estimated until targets, signing access and package scope are decided.                                                                                                                        | Signed target install/update/runtime acceptance; does not block the current web release.                                                                                                                                                                                                  |

R2 covers the requested [Swarm kit catalog](https://swarm.army/kits) and
[multi-tab kit spreadsheet](https://docs.google.com/spreadsheets/d/1nCYfjbcyr1H6p-15pXcK9bmx5YWTSem229Sen8fiLLo/edit).
The [inventory](fpv-civilian-source-inventory.md) records each public record and
tab, its exact title and disposition, along with the first-party feed/loading-shell
and bounded sheet-header inspection limits.

Current sequence: **#1665 merged → #1679 / #1685 updated and rechecking → #1698 published → normal checks/integration/deployment → source-bound public acceptance**. Parent #1626's Pages workflow is complete. The flight correction branch is `codex/fpv-flight-integration-20261019`; #1685 is `codex/fpv-qualification-followup-20261019`; #1698 is `codex/fpv-workbench-integrity-20261019`. Unrelated main lesson-mode changes are retained. A direct stacked diff against #1665's original branch would not represent this rebased history correctly.

R13 remains an independent P1 investigation; R4 has no safe cleanup path until the inventory is understood. R2’s bounded inventory and R3’s local narrow/200% EN/UK checks are complete; physical touch, virtual keyboard and public acceptance remain separate. R6 software preparation can proceed independently of deferred physical radios/pilots, but measured activation cannot. Delivered R11A–E and R17–R21 corrections need normal publication and scoped public acceptance; R18’s capacity reduction and exact combined-package qualification are complete locally. Do not wait for R6–R12 to improve released practice or treat them as passed because the local release is ready.

### R6 evidence and preparation history

**Current R6 result:** bounded surfaces, static quad composition, fixed-voltage cell inverse and bounded command-domain selection are implemented and independently reviewed. **99/99** synthetic checks include four coupled-sag counterexamples; the general coupled solver remains unimplemented pending complete root-isolation/error bounds. The earlier 80-check cohort was included in the **743/743** source qualification at `863449767f`. The new adapter adds no shipped bytes and is not imported by current flight/UI/worker code. No measured fit or runtime activation is claimed. The chronological receipts below retain their original branch/publication states; use the front snapshot for current release status.

A separate exact-component correction is committed as
`48373316b65bf14e3731569e9de9296fcdb553d0` on
`codex/fpv-nazgul-diameter-20261018`, not yet published. The Nazgul V1.1 aircraft
specifies F5 props; the matched manufacturer SKU specifies **5.1 inches**, or
**129.54 mm**, rather than the previous 127 mm class-based value. New preset
revision 2 corrects the radius; the older saved configurations and both recording
backends retain their dimensions and hashes. **32/32** targeted checks and
independent review pass. The other fourteen aircraft are numerically unchanged.
The correction deliberately preserves the existing estimated reaction torque;
a dimensional specification does not supply a propulsion measurement.

The exact Meteor75 reference remains **0802SE 19500KV, 40 mm two-blade props and
BT2.0 1S 450 mAh**. The [manufacturer battery page](https://betafpv.com/products/bt2-0-450mah-1s-30c-battery-4pcs)
provides an image of voltage versus time under a constant 11 A discharge. It is
not a motor/propeller map, a maximum-current measurement or a battery-resistance
measurement. Raw observations, test temperature, cell age and repeated samples
remain unavailable. No matched propulsion dataset was found in the bounded
primary-source follow-up; do not blend another motor revision into this preset.

Software preparation continues without pilots or real radios. Commit
`66305696561c6c35e065a009066364cf777fe10c` on the separate
`codex/fpv-propulsion-load-20261018` branch implements a non-activating load-line
solver: it intersects documented voltage paths and solves battery voltage against
their current, using explicit battery-model inputs and a caller-declared DC
current basis. **30/30 tests** pass (14 new load cases and 16 existing evidence
cases); formatting, lint and independent review pass. Review caught and corrected
a false solution at nearly coincident voltage samples; that case now returns an
explicit numerical-resolution failure. [Contract and limits](fpv-propulsion-evidence.md).

The initial kernel increment is a local numerical prerequisite without an external
measurement bundle or catalog change. Its subsequent inspector integration is
described below. It does not delay PR #1626, activate measured aircraft physics or
close R6. Command/voltage surfaces were subsequently completed as described above;
allocation, versioned runtime integration and matched measurements still remain.

Non-activating inspector integration is committed as `9d4da6c13` after dependency
commit `f9ddc2693` on that follow-up branch, not yet published:
manual circuit assumptions, an explicit DC-input-current declaration and a
user-requested calculation against the imported eligible voltage sweep. It has
no aircraft write path or measured-default claim. **46/46** targeted checks and
**19/19** package checks pass, along with independent review. A local English
browser check on `40611b264` reached the inspector through World Settings →
Workbench → Expert PID → Advanced reference practice, imported explicitly
synthetic voltage data and obtained the expected **2.5 V / 2.5 A** operating
point. Input editing cleared results, and the built-in command-axis example
disabled calculation with an explanation. No flight was started or configuration
saved; the draft and Basic preference were restored. That original English receipt did not qualify Ukrainian rendering or narrow layouts.
A later exact-package Ukrainian desktop check passes below, and the newer narrow EN/UK check is in [its own receipt](fpv-inspector-narrow-20261019.md). These retain separate source and coverage; final production acceptance remains open. The later combined measurement on `ad7225621` leaves only **7,339 bytes**
in the unchanged bundled Academy byte budget. Observed splits and the locale correction have their own committed-source measurements above; R18 subsequently increases the bundled margin to **52,800 bytes**. These are actual package measurements, not source-size projections.

The final packaged World artifact (`cfdf24d61`) also passed a fresh-origin Ukrainian inspector check on 19 October. From a temporary Meteor75 draft, the inspector retained its synthetic-data disclaimer and refused load-line calculation for the built-in command-axis example. An explicitly synthetic voltage path with current equal to voltage, 3 V open-circuit voltage and 0.2 Ω series resistance produced **2.5 V / 2.5 A**, with 7.5 W supply, 6.25 W load and 1.25 W loss. Editing voltage cleared the result; returning preserved the 14-change temporary draft, then Revert restored zero changes and Basic view. No flight was started, setup saved or archive deleted. Browser warning/error logs were empty. Screenshot: `propulsion-inspector-uk-20261019.png` in the task's local sustained-flight evidence directory. This is desktop rendering only; no supported narrow-viewport control was available in that browser session. A caught optional Settings module request returned 404. Source review confirms the core-only module is intentionally excluded from standalone packages and the localized fallback is tested; no admission change is needed. Absence of console errors is not a claim that every network request succeeded. The resulting fine-adjust label issue was corrected separately as R21.

## Blockers, concerns and scope boundaries

- **Realism is not yet measured for all aircraft.** All fifteen preset models use estimated
  propulsion; inertia, drag, motor lag, reaction torque and electrical parameters
  also retain estimate labels. Manufacturer component names, correct installed
  mass, a passing numerical benchmark and partial static motor points cannot
  establish exact real-aircraft handling. [Fidelity limits](fpv-all-aircraft-flight-audit.md),
  [propulsion evidence](fpv-propulsion-evidence.md).
- **Source-kit scope is incomplete.** The broader site/spreadsheet request must
  not be marked fully delivered. Ground equipment is not aircraft mass or a new
  drone. Military-specific configurations are excluded, not pending work with an
  ETA. Cetus X and Protos now have frozen variants and explicit mass/assist uncertainty labels. The bounded civilian inventory is complete, without converting ambiguous or excluded entries into invented presets. [Source record](fpv-civilian-kits.md).
- **Flight coverage has limits.** Short flights and startup matrices do not
  establish full-course completion, sustained performance on every device or
  every map edition. One earlier World readiness timeout remains unexplained;
  later successes did not establish its cause. It is a historical reliability
  concern, not a reproduced current blocker. [Recorded limitation](fpv-input-recovery-delivery-verification.json).
- **Recorded live checks found real regressions.** The public Meteor75 pause/resume failure and native camera input/slider observations remain in the evidence. Their fixes are released in e440, with fresh final-source public interaction pending. The archive inventory incident remains unresolved; recovery-handle improvements in #1679 do not explain it. Automated/source checks do not erase the original failures.
- **Some acceptance needs outside access.** Physical radio/pilot evidence is
  deferred; wider devices and iOS runtime need actual targets. Actual desktop Chrome page zoom now has EN/UK observations; other devices remain separate. No available
  measurement has been relabeled as passed to close those rows.
- **Archive retention takes priority over cleanup.** An earlier public test observed a full sixteen-entry store and confirmed continued flight. The authorized single deletion attempt reported an error; its commit outcome is unknown. Reload exposed a different one-entry inventory, which remained at the last non-mutating review. The six protected older records cannot be confirmed preserved. No further deletion or public-state mutation is planned while R13 is unresolved. A prior automatic approval review rejected native storage inspection; that diagnostic route remains unavailable and is not bypassed.
- **Local workspace is shared and resource headroom varies.** Unrelated demo/UI
  edits remain untouched. Available disk space was approximately **1.1 GiB** during the failed-storage investigation and **2.5 GiB** at the 01:43 CEST status review on 19 October. Heavy verification already running in hosted CI is not duplicated locally; focused source/tests use isolated sparse worktrees. Free space changed during the audit, so recheck
  before large builds. Do not delete user files, archives or generated work to
  manufacture a passing check.

## Completion rule and review cadence

Update each row separately for implementation, automated qualification,
interactive acceptance and publication. A completed software feature is not a
passed physical/device gate. Preserve original failures beside subsequent
regression evidence, and record source/date/device with every new receipt.

Only add new implementation work for an accepted remaining item or a demonstrated
defect. Do not create unrelated features or repeatedly rerun unchanged suites to
make an open measurement gate appear complete. Estimates must be revised after
new data, device access or a reproduced failure changes the scope.

This continuation includes runtime corrections, two civilian presets and new
qualification tooling. Publication is recorded after the identified normal
build/deploy succeeds; post-deployment verification and source-bound public
interaction are tracked as separate acceptance gates. No physical-device or measured-fidelity
gate is closed by the software-only results.
