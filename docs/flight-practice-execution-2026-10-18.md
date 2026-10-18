# Flight practice: integrated execution checkpoint — 18 October 2026

> **Latest follow-up:** [19 October: Mac mini staging, verified writer change and preparation timeout](flight-practice-execution-2026-10-19.md).
> The share has sufficient output space, but the current normal build times out
> before output materialization. No new production/browser pass follows. The
> source-bound results below remain historical evidence, not a resolved build blocker.

## Current checkpoint: accepted main 237b40543

The second rebase is complete: all 26 Practice commits replayed cleanly onto
`237b405437def3c41b01165fe057af1ab06f618c`. Verified runtime/candidate source is
`6177d2cc83adb9cb76ff4088d502c21ddfd7d199`, tree
`ba3902515d73e97ae18dda8ffc57ee698eba9825`. Later evidence-only documentation
commits do not relabel that runtime. The primary dirty checkout remains untouched.
This is a recorded accepted-main checkpoint, not a claim main cannot move again.

### Newly completed on this source

- **1,270/1,270 Practice tests**, 564.626 seconds; **756/756 local-UX tests**,
  199.371 seconds. Both finish within their unchanged 600-second diagnostic
  ceilings with unchanged source/input pins. The complete Practice script
  selection includes the expanded fifteen-aircraft/terrain cases. No failures,
  skips or cancellations in either suite. These local diagnostics are not the
  official full tracked-source CI receipt; the older remote timeout's cause is
  still not established by a newer local pass.
- **369/369 focused accepted-SIM/capture/guide checks** and **377 observer tests
  plus one explicit historical-fixture skip** pass.
- All three packages reproduce twice and pass strict original admission.
  Envelope SHA-256:
  `b64909c3127ea428be8d188444bf2ae0873e299b71bfd991a737ba0c658ce2a5`.
  Gym/Academy/Worlds retain 96/148/208 members respectively. Their revisions are
  `b59023973f9a8a69302b231bf81998c8a1683c7277d78275cec028c0d9f9fa6f`,
  `0e10677152c52e673448d28f526d20537466e581feb28a1c30141055b1776777`,
  `64e3d6d2d02ef419156bf389b9dc4c48a37b8f6bc64ea8cbcae70ec3e8588de7`.
  They remain development `v0.151.1`, `publicEligible: false`, with pending reviews.
- **Ten native beginner exercises and repeated independent export replays pass**
  again on these new packages: two assisted Gym and eight EN/UK FPV
  Self-level/Acro cases. No prior runtime receipt was substituted.
- **Six actual packaged EN/UK guides and four populated tuning-library backup
  journeys pass** again. Public download/upload/restore removes the later fourth
  profile, restores the named three-profile library and preserves all semantic
  fields through reload. Exact admitted sources, exports, ten PNGs and cleanup
  are audited. Only the declared core-tools lazy request and its four real
  localized fallback messages receive the bounded existing exemption.
- **Gym historical installed-session continuity passes again**, now against this
  new candidate: resumed-motion witness at 7.132 seconds, stable paused height
  0.30 m, explicit resumed lift
  to 0.40 m, unchanged old document/time origin, genuine trusted native blur.
  Ten all-package upgrade/rollback checkpoints, seven exact saved-World witnesses
  and 3,237 dependency rows pass. The owned OS app/profile are removed.

Timing interpretation: the retained Gym audits' `activeSessionElapsedMs` field
is the last visible motion witness, not the entire procedure. Final menu pause,
identity checks and cleanup follow it. Academy's corresponding field is its last
final-pause witness. The unchanged thirty-second session guard remains enforced;
these timestamps are not frame-pacing or whole-run performance measurements.

The new Academy active-session invocation was prepared but did not receive input;
it was cancelled before Node/browser startup when low space was rechecked. No
log or native receipt exists for it. This is **not run**, not an app failure and
not a credentials blocker. Academy's passing `3c6` historical receipt remains
valid for its original payload only. Historical Worlds remains **owner-deferred
and unverified**; current Worlds beginner exercises above do pass.

[Current checkpoint evidence](flight-practice-main-237-20261018-evidence.tgz):
135 original files plus inventory, 12,378,813 bytes before compression; SHA-256
`1a0f3da8ca6b037a71d00ba1777f913fd3bdf268ed2a653dcb4518ff6e2ebf8c`.
The archive was extracted and every inventoried file rehashed. It includes the
new candidate metadata/byte differences, suites, native exports, audits, screenshots,
storage preflight, explicit not-run record and generated-build relocation receipt.
Full package ZIPs remain in
`/Volumes/alex/CodexMigrationStaging/flight-practice-main-237-20261018-candidate`.

### Actual resource blocker and safe cleanup

Only our generated old production output was relocated: all **3,561 files** were
copied and hash-verified at
`/Volumes/alex/CodexMigrationStaging/flight-practice-production-3c6ac5ee0-20261018/site-original`
before removing the exact local generated directory. Its original ZIPs and
metadata remain in the parent folder. This is recoverable; no primary-checkout,
user data, user archives or unrelated files were removed. Original capture paths
inside historical receipts remain unchanged; use this relocation map to find them.

The latest read-only build preflight selects 4,429 committed inputs totalling
875,266,210 bytes. Under the existing storage guard, a local build needs
**3,361,145,156 bytes** including the **1,610,612,736-byte reserve**; only
**1,820,684,288 bytes** were available. The current full production rebuild was
therefore **not started**. The previously verified `3c6` production build and its
six journeys are not silently transferred to `6177`. The earlier external-volume
attempt timed out and remains failed. Do not relax deadlines, delete user files
or invent a hosting change to bypass this blocker. Request at least **4 GiB of
free fast local workspace**, allowing for concurrent work; a fast drive path is
an alternative. The full Practice run's minimum measured free space remained
1,854,656,512 bytes, above its unchanged 1.5 GiB reserve.

### Remaining order, impact and conditional estimates

The original plan is **not fully complete**. Estimates are focused effort after
prerequisites, not calendar promises; storage, queued CI and human waiting time
have no assigned ETA. No completion percentage or release date is claimed.

| Priority / ID       | Remaining next step                                                                                                                                                                  | Why it matters / impact if omitted                                                                                  | Effort and dependency                                                                             |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| P0 / R1             | Obtain fresh complete CI on the preserved rebased head                                                                                                                               | Local success does not make a queued remote job green; the old timeout is still undiagnosed                         | 1–2 h plus unknown queue time; no test/deadline waiver                                            |
| P0 / R2             | Refresh Academy's installed historical continuity with the new payload; retain Gym's new pass                                                                                        | The earlier Academy receipt cannot qualify changed current bytes                                                    | 1–2 h after safe disk headroom; Worlds is D3, not passed                                          |
| P0 / R3             | Complete current all-app recovery using actual public backups: Worlds projects/assets/records, other advertised libraries/archives, exact semantic restore and final offline flights | The real one-proof Academy recovery below is valuable but does not guarantee recovery of every record/world/library | 1–2 days after storage; use SIM-maintained export/import controls, not hidden database writes     |
| P0 / R4             | Native Cancel with genuinely outstanding digest work; settle late writes and check old/sibling preservation                                                                          | Unit-held digest and delayed final-ready reply do not prove real hash-time overlap                                  | 4–8 h; finite trace/clock/worker ownership protocol; absent overlap stays unverified/inconclusive |
| P1 / R5             | Build current full production and rerun six EN/UK directory/return plus affected restarted-offline routes                                                                            | New capture/main-shell and input bytes cannot inherit the old 3,558-member build's proof                            | 4–8 h after storage; **currently resource-blocked**, not a diagnosed product assertion            |
| P1 / R6             | Measure agreed moving-flight/menu/load/recovery workloads on the chosen local browser and obtain accepted budgets                                                                    | Fast startup or simulated flight ticks are not an approved rendered-performance result                              | 4–8 h after workload/budget choice; local browser is selected, thresholds are not                 |
| P1 / R7             | Actual 200% readable layout/full focus review and EN/UK screen-reader speech                                                                                                         | DOM geometry and cropped/blank captures cannot establish visual/spoken usability                                    | 1–2 review days plus fixes; named screen-reader/operator needed                                   |
| P1 / R8             | Real novice and maintainer guide walkthroughs                                                                                                                                        | Automated recipe completion is not evidence of understanding                                                        | 0.5–1 review day plus participant scheduling                                                      |
| Required / R9       | Freeze final evidence and obtain 24 attributable package-gate decisions                                                                                                              | Reproducibility, tests and this agent's audit cannot approve content/licenses/learning/hardware                     | 0.5–1 assembly day after checks; actual reviewer turnaround unknown                               |
| D1 / owner-deferred | Physical controller/radio/touch checks                                                                                                                                               | Supported physical inputs remain unqualified                                                                        | No ETA; not passed                                                                                |
| D2 / owner-deferred | Hosting/capacity/release allocation/upload/selection/public verification                                                                                                             | Local packages do not establish public availability                                                                 | No ETA; no publication action                                                                     |
| D3 / owner-deferred | Historical Worlds automated active-session check                                                                                                                                     | Current Worlds exercises do not prove its old/new active-flight continuity                                          | No ETA; explicitly left unverified by the owner                                                   |

Approximately **3–5 focused engineering days** remain for the conditional software
work, excluding review/setup waiting, major new defects and deferred items. This
is not a full Phase 1/public-release ETA. Do not keep rebasing unmerged SIM work
or overwrite older evidence to make the list appear complete.

The SIM owner's [archive-retention incident](fpv-archive-retention-followup-20261018.md)
remains open: missing protected archives and a closing-database observation are
not explained by the small reconnect fix. Our fresh-profile controlled eviction
test neither accessed that affected profile nor diagnosed its cause. Preserve
that concern and use disposable data for R3; do not perform destructive cleanup
on the affected user archives. Human approvals and accepted performance limits
are separate from the local-browser choice.

The earlier follow-ups below remain source-bound historical evidence.

## Follow-up: verified integration and recovery

Later results on the same **3c6 runtime packages**, with clean observer
`b8e0182de344fba5bf1541ddca753ac7769bdd60`:

- All **six current full-production EN/UK journeys pass**: three cards, no
  simulator dependency requests before Play, one Play to unarmed Home, personal
  appearance transfer, packaged guide, directory and main-game return. All
  **3,558 original members / 1,074,713,915 bytes** were verified before/after and
  independently rehashed. The audit checks 452 original package members, 30
  stable-launcher copies, regenerates all 489 overlay files and hashes 24 PNGs.
  These are actual built files, not a source-shell fallback or public selector.
- All **ten beginner exercises pass**: eight EN/UK Academy/Worlds Self-level/Acro
  cases and two EN/UK assisted Gym cases. Native completion, real public exports,
  independent exact-package replay and clean key/browser/server shutdown are
  required. The audit reruns all ten replays. Vertical Acro is not rotational
  proficiency, human learning or physical-input qualification.
- **Gym genuine historical installed-session continuity passes** in 6.899 seconds
  within the unchanged 30-second procedure: visible lift, actual native blur,
  the same old document/time origin through upgrade, stable 0.35 m paused height,
  explicit resume to 0.45 m and final menu pause. Ten all-three upgrade/rollback
  checkpoints, seven saved-World database witnesses and 3,237 cache dependency
  rows are checked. Its shared proof/profile fixtures are explicitly synthetic;
  this is not a genuine persistent Gym record-restore claim.
- **Academy's refreshed genuine historical installed-session continuity passes**
  in 8.576 seconds, paused at 0.30 m then explicitly resumed to 0.40 m. Nine
  installation/rollback checkpoints, five saved-World witnesses, all three owned
  OS app removals and disposable-profile removal pass. Original immutable old
  payload is still `98ad851…`, not a same-byte version alias.
- **One actual Academy proof recovers after browser-managed eviction.** Under a
  verified 512 KiB temporary-pool setting, Chrome reports one eviction in one
  round after its normal startup interval. Both original prepared caches and the
  previously populated Journey proof database disappear; the stale installation
  pointer survives. An offline browser restart fails honestly. Normal online
  preparation restores all 146 pinned dependencies; Notebook is first observed
  empty, then public import/reverification restores the exact externally saved
  genuine proof. A second offline browser restart exports the same proof again.
  Total 328.931 seconds, unchanged 600-second diagnostic bound, clean disposal.
  This is **one EN Academy proof**, not all-app/all-backup recovery or an offline
  flight after recovery. No deletion/pressure API, filler writes or fake proof
  produced the loss. Native quota UI showed available disk falling **3.46 →
  1.83 GB**; ambient low disk remains a confounder. This does not isolate the
  reduced pool as the sole cause or establish default-policy eviction. Initial
  numeric counters were unavailable, not zero; no numeric delta is claimed.

The owner explicitly chose to **leave the historical Worlds automated active
check unverified for now**. No more fixes are attempted on that lane. Current
Worlds exercise passes above do not retroactively pass that historical check.

Evidence, including actual exports, audits, screenshots and original failures:

- [Integration/Gym packet](flight-practice-integration-followup-20261018-evidence.tgz),
  124 files, SHA-256 `d989b935b5c7509f14b53a556bd8126ff9ac7c08fd35496afa601c2317ba79f6`.
- [Academy/recovery packet](flight-practice-recovery-followup-20261018-evidence.tgz),
  27 files, SHA-256 `4979da8d673b3a5cb1e4639315da12ddee3af8539d45500e1d4679f86a03cd4c`.

Both archives were extracted and checked against their inventories. The first
recovery attempt failed at test-server directory routing before app setup. Audit
script mistakes (reference-vs-structural equality and incorrect assumptions about
different receipt schemas) are retained alongside corrected audits; native
receipts and their source identities were never rewritten.

PR #1554 was safely rebased/pushed to `b8e0182de…` using the preserved exact remote
lease. It is now **draft and mergeable**, with new CI queued at inspection, not
passed. Main subsequently advanced to `237b405437def3c41b01165fe057af1ab06f618c`:
accepted SIM pause/throttle, archive-access/preset updates and capture-limit UI.
Those changes require a new integration checkpoint and affected qualification;
the evidence above must remain attributed to 3c6. No unmerged SIM work is copied.

Low local space (about 1.8 GiB) pauses new large browser/build batches. Only this
task's generated loose build is being copied to the existing external production
folder's `site-original/`; the exact local directory is removed **only after**
every destination file is hash-verified. Until its completion receipt exists,
do not claim the move or recovered space is complete. No user data is cleaned.

Remaining order is now **R1 accepted-main refresh/current CI → R3 remaining app
and backup recovery → R4 native hash-overlap cancellation**. R5 is complete for
the frozen 3c6 build, but must be repeated where the newer main changes inputs.
Gym/Academy R2 are verified for that candidate; Worlds is owner-deferred (D3),
not passed. R6–R9 and hosting/hardware keep their separate decision boundaries.

For R4, current [Chromium WebCrypto source](https://chromium.googlesource.com/chromium/src/+/refs/heads/main/components/webcrypto/webcrypto_impl.cc)
exposes `DoDigest` / `DoDigestReply` trace events. A future finite native protocol
should first verify their availability/worker identity for the installed build,
then correlate actual Cancel input against outstanding digest work. Missing or
non-overlapping events remain inconclusive. This research is a test-design lead,
not installed-version proof or a completed check; the exact installed source was
not retrievable through the web tool. Do not slow crypto, replace messaging,
relax deadlines or call the existing delayed-ready response a hash interruption.

The original execution checkpoint below remains source-bound history.

This execution checkpoint supersedes the earlier **read-only** 18 October status
and historical next-step statements. It does not relabel any original evidence.
The implementation is substantial; non-hosting acceptance is **not complete**.
Hosting/publication and physical hardware remain owner-deferred, not passed.
The owner selected the local browser for available software checks. That is not
an approval of performance limits, human learning, licenses or package gates.

## Source and isolation

Work continued in the isolated Practice checkout. The concurrently dirty primary
checkout was not edited. Remote Practice head
`4768988fb5f91b915f825ccd983b88600160b32b` was preserved as
`codex/practice-remote-preserved-20261018`, then all 18 Practice commits were
rebased onto main checkpoint `cb8dddd3d3c11d24c56b014fa48ac0e6417d6465`.
Both package-script conflicts retained the union of main and Practice tests.
Main is moving; this is an integrated checkpoint, not a perpetual latest-main claim.
No unmerged SIM mechanics, rendering or training work was copied.

Current runtime/package source:
`3c6ac5ee0f524a1c3a456316b978cf4e0043e06c`, tree
`ad8f538f6378cd22ea053fc1f56f0d0d370885af`.
Subsequent session-observer changes are separate test authority, not a relabeling
of these packages. PR #1554 remains draft; no release was allocated, uploaded,
selected or deployed. Remote CI after the rebase is not yet established here.

## Completed in this execution

| Work                   | Actual result                                                                                                                                          | Boundary                                                                                                |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------- |
| Main integration       | Preserved remote work, successful rebase, combined test registration                                                                                   | Original remote CI timeout is not diagnosed merely by passing later source                              |
| Local-UX reproduction  | Node 22.22.2, 742/742 tests, 249.334 seconds under the unchanged 600-second limit, unchanged selected inputs                                           | Local sparse-checkout diagnostic, not a full tracked-source CI receipt                                  |
| Current Practice suite | 1,232/1,232 pass, 518.137 seconds                                                                                                                      | Source `3c6ac5ee0`; not human/package approval                                                          |
| Current packages       | All three build twice identically and pass strict committed-input/dependency/archive admission                                                         | Development `v0.151.1`, `publicEligible: false`                                                         |
| Restarted offline use  | Six actual stable-launcher/installed-window short-flight routes, browser restart, exact imported-world retention, owned profile/app cleanup            | English, short lift/pause, not every course/mode/browser/device                                         |
| Player guides          | Six actual packaged EN/UK guide routes                                                                                                                 | Automated use, not first-time-player understanding                                                      |
| Tuning backup          | Four default-library and four populated-library native export/upload/restore/reload journeys across both FPV apps/locales                              | Separate radio calibration/controller-tune/records/world recovery and origin eviction remain open       |
| Production output      | Normal full build, 3,558 members, 299 seconds, unchanged 600-second limit and source inputs                                                            | Local output, not hosting capacity or public eligibility                                                |
| Extra-app observer     | Finite Gym/Worlds IDs, strict route/HUD/overlay checks, owned-window integration and tests; expanded observer suite 377 pass/one explicit fixture skip | Native Gym preparation passes; Worlds preparation and both full joined-update checks remain unqualified |

### Fixes actually made

- Corrected the offline observer for accepted SIM ownership: importing calibration
  explicitly leaves Rates & throttle unchanged. The observer verifies the actual
  visible notice and separate data, rather than expecting an obsolete mixed import.
- Corrected EN/UK guides to distinguish radio calibration from complete tuning
  library backups and point to the direct maintained Settings → Controls →
  Aircraft, rates & throttle → Library route. Restoring replaces the library;
  imported individual profiles are not complete backups.
- Fixed World Studio's global file-input hiding rule leaking into shared tuning
  controls. A narrow `.fpv-tuning input[type='file']:not([hidden])` override makes
  the maintained upload/folder controls available. No mechanics/model change.
- Populated backup checks create a named profile through actual UI, save/export
  the three-profile library, create a fourth profile, then restore exactly three
  and re-export after reload. Every field except the expected root revision is
  compared; these are not fabricated database writes.

The one declared core-only tools request is checked against package policy and
its actual localized fallback message. Other missing assets still fail. It is
not a blanket 404 exemption or a reason to bundle the whole main-game editor.

## Failures retained, not converted into passes

- Original remote local-UX timeout: source `4768988fb…`, 600,000 ms, no final TAP
  summary. Its cause remains unconfirmed. The committed original ZIP remains
  SHA-256 `ba855607ab80421cb3fb76fa3a44ca08e82cf86723f4b4bc75fc1130e800a021`.
- First two local reproductions exposed omitted sparse replay fixtures; the
  first also used Node 20. Those failures remain separate from the Node 22 pass.
- Initial calibration observer failure and a later successful receipt's stale
  metadata are retained with an explicit erratum; neither original was edited.
- Guide-route drafts, the hidden World upload input, overstrict optional-core
  classification and an early disabled-control sample remain in failed originals.
- Full build on the external volume reached the unchanged ten-minute deadline
  while materializing output. A separate local-disk retry passed. This does not
  prove the cause of the unrelated old CI timeout, or relax a product deadline.
- Historical Worlds manual pointer lift/menu/resume worked. Automated first Arm
  remained disarmed, including the two-frame readiness experiment. No automatic
  Arm retry, hidden-owner activation, forced interaction or weaker assertion was
  accepted. The unproven timing workaround was removed. Further fixes on this
  lane are paused for test-approach review after repeated unsuccessful attempts.
- Historical UI-only screenshots/short lifts are not old/new update continuity.
  One early World Space probe mislabeled a still-playing frame as paused; its
  erratum remains with the originals.

## Exact candidate and evidence

Final candidate envelope SHA-256:
`6e526b6438afd02cdad71e164af699c2c5cb15cc52a0dd90b65c3feed8f04f49`.

| Package | Members / bytes  | Revision                                                           |
| ------- | ---------------- | ------------------------------------------------------------------ |
| Gym     | 96 / 3,799,985   | `9abf0c12a458534dd617d66be9b72852aa81aa46b87b5d60a96116fa4e774e4d` |
| Academy | 148 / 12,070,405 | `75a7f259037962508f8ca64a7208911fa75e50ac20de81d3898e1738e440a287` |
| Worlds  | 208 / 18,577,998 | `8250089c6cb228e38d04d948b10971eeb453d69932a1c46f5ad042e01b49c6be` |

External original package directory:
`/Volumes/alex/CodexMigrationStaging/flight-practice-tuning-upload-fixed-20261018-candidate`.
Original full distribution is retained at
`/Volumes/alex/CodexMigrationStaging/flight-practice-production-3c6ac5ee0-20261018`:
1,075,848,925-byte ZIP, SHA-256
`2d4ddbfcbf400afd7b8656451ba10678f8f278ffaf5ddbaeadd6077e8aae4582`.
Only our generated local ZIP was moved there after verifying the durable copy;
no user data or primary-checkout files were removed. The loose local build remains.

The [execution evidence archive](flight-practice-execution-20261018-evidence.tgz)
contains 305 original files plus its hash inventory, including failed attempts,
scripts, audits, screenshots, TAP, metadata and provenance. Archive SHA-256:
`6a4c78e957e2572113e4063e50e48299fbf4ee795af4d4b124c76b3cecef0e37`.
Inventory SHA-256:
`1d91d0b81c092cacd2c2abc8c5ebf5a0f1bc45aa067eb04e16614cb21f69dff5`.
It is a **3c6 runtime checkpoint**, not the later extra-session experiments.
Package/distribution ZIPs stay in the separately named external directories;
the archive includes their metadata, not gigabytes of duplicate payloads.

The separate [session-probe evidence](flight-practice-session-probes-20261018-evidence.tgz)
retains 50 files: all five failed/partial native preparations, observer snapshots,
final source/patch, regression TAP and explicit unqualified scope. SHA-256:
`968dacf361131c312353c712cbf97ce49e5b9c865e5db4e0816914d3a8067b1c`.
Final active-session unit checks pass 19/19 after removing the unsuccessful paint
workaround; lint and whitespace checks pass. The expanded observer suite passes
377 with one explicit historical-fixture skip. Neither result is a native
Worlds active-update qualification.

## Remaining priorities, impact and estimates

Estimates below are focused effort, not calendar commitments. Newly found defects
and reviewer availability can change them. No full-Phase-1/public-release ETA is
claimed while hosting/hardware are deferred and real approval is outstanding.

| ID / priority | Remaining and next action                                                                                                                                                      | Why / consequence if omitted                                                                        | Focused estimate / blocker                                                                               |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| R1 / P0       | Push preserved rebased branch safely and obtain complete current CI; investigate original timeout if still reproducible                                                        | Local passes do not establish current remote integration readiness                                  | 2–4 h plus CI; original timeout cause unresolved                                                         |
| R2 / P0       | Run genuine old/new Gym installed-flight continuity; review historical Worlds first-Arm test approach before more fixes, then run its continuity                               | Otherwise only Academy has complete active-session evidence; reload/state loss may interrupt flight | Gym 2–4 h; Worlds ETA unassigned until preparation is understood. No further speculative workaround      |
| R3 / P0       | Use real app exports, witness browser-managed origin eviction, observe honest offline failure, reinstall/import and reverify calibration, tuning, records/worlds as applicable | Successful backup restore alone does not establish recovery after browser-origin loss               | 1–2 days; controlled disposable profile/disk, persistence may prevent eviction                           |
| R4 / P0       | Observe native cancellation with actual hashing/verification outstanding; check late writes/readiness and exact old/sibling preservation                                       | Pending unit digest and delayed final reply do not prove cancellation during native hashing         | 4–8 h; timing may remain explicitly inconclusive                                                         |
| R5 / P1       | On the new 3,558-member production output, rerun six EN/UK directory → one Play → disarmed start → guide/return routes; bind affected exercise/mode checks to current bytes    | Older 3,493-member receipts cannot qualify this main shell                                          | 2–4 h for directory batch plus affected exercise checks; rebuild/admission/offline/guides already passed |
| R6 / P1       | Record moving-flight/menu/load/recovery measurements on local Chrome; obtain accepted workloads/budgets separately                                                             | Baseline measurements are not a performance approval                                                | 4–8 h measurement after scope; accepted budgets still missing                                            |
| R7 / P1       | Actual 200% visual/focus review and EN/UK screen-reader speech for readiness/progress/errors                                                                                   | DOM/geometry checks and cropped captures do not prove readability or spoken usability               | 1–2 review days plus fixes; named screen-reader/operator needed                                          |
| R8 / P1       | Real novice and maintainer walkthroughs following the guides                                                                                                                   | Scripts cannot establish understanding or find all undocumented steps                               | 0.5–1 day plus participants; no invented human reviewer                                                  |
| R9 / required | Complete final evidence packet and obtain 24 attributable package-gate decisions                                                                                               | Reproducibility is not content/license/learning/package approval                                    | 0.5–1 assembly day after remaining checks; reviewer turnaround unknown                                   |
| D1 / deferred | Physical controller/radio/touch matrix                                                                                                                                         | Supported physical inputs remain unqualified                                                        | No ETA; owner deferred                                                                                   |
| D2 / deferred | Hosting/capacity/release allocation/upload/selection/public verification                                                                                                       | Local implementation does not populate the public empty catalogue or meet public-release criteria   | No ETA; owner deferred                                                                                   |

Continue independent R5/software work while the R2 test approach is reviewed.
Do not wait for a PR queue to do local scoped work, and do not merge/publish to
bypass missing evidence. Keep SIM mechanics/rendering/training with its owner.
