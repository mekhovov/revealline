# Flight practice: pointer and verification continuation

Hosting remains deferred. This continuation changes local behavior and acceptance
tooling only; it does not select packages for the public directory, allocate a
release, waive review gates or alter simulator mechanics.

## Integration baseline

Rebased cleanly onto main `95703ee32` while recovery PR #1487 remained open.
The unchanged baseline candidate is bound to source
`c83dacfa02e57995558a4135f83a9ae8bba8c6f9`, tree
`497b1b634a5e2e178bfa36f2557ea07df7d8d441`, and envelope SHA-256
`5a4f0cf63182af5641b10b547020db204692c5ae315691590e10e7551a01dccc`.
It reproduced all three packages twice and passed committed-input, archive-member
and admission checks. It is a development candidate, not a published release.

Accepted SIM changes include the Alpine station Library offer, saved-place
concurrency regressions and the read-only storage-continuity observer. The latter
fingerprints saved content; it does not itself perform offline/process-restart
testing. Lunar authored/delivery evidence does not add a new Library runtime offer
in this delta. None of these changes corrected Academy's native-dialog hint
handling. Existing SIM evidence remains bound to its own source and scope.

## Corrections

- **Incomplete offline verification:** preparation previously discarded detailed
  inspection status and could advise removal after an inconclusive check. It now
  asks for a retry without removing the saved copy. Only a verified result may
  advance installation records. Confirmed missing files still require repair.
  The shared path serves all three apps; the legacy boolean inspection interface
  remains compatible.
- **Native dialog geometry:** suspending menu input cleared navigation text in
  native Help and Notebook dialogs, although shared menus already retained it.
  The same guard now covers native menus in all three apps. Retaining the
  instructions does not retain input ownership or resume a flight. Modeled
  blur/focus regressions and native pointer acceptance are separate evidence.

## Focused pointer procedure

The observer serves original admitted Academy files without changing its entry
page, controls, access gate or application state. Authorized access uses the
ordinary form in isolated contexts; credentials must stay out of plans, command
arguments, screenshots and reports.

The protocol separates target activation by mouse from Tab/Enter. Setup navigation
uses public keyboard actions and does not qualify the entire menu path. Each
locale, visit and target starts independently; a failed first click must not be
silently retried or counted as passed because a later keyboard press works.
Passive event/geometry records and failure screenshots support diagnosis.

This procedure does not qualify human learning, physical input devices, full
first-flight completion, distinct-release updates or the public hosting journey.
The executable [remaining checklist](flight-practice-release-checklist-2026-10-15.md)
continues to own those cases.

## Frozen corrected candidate

Source `bf31260eb82530eeca38e1c2d84f63a22696946e`, tree
`e86346d82dc81d8d0fee94f7ab189668cb743e56`; envelope SHA-256
`128b8447235424fcb18aa1cc99a49a6ebeccb23cc86d7a0704c85fd2793cbd4c`.
Candidate location:
`/Volumes/alex/CodexMigrationStaging/flight-practice-pointer-fixed-20261015.4fSjdO/candidate`.
All three packages reproduced twice and passed admission/committed-input/archive
checks. Gym: 94 files / 3,750,021 bytes; Academy: 101 / 6,767,672; Worlds:
162 / 17,551,789. Worlds still occupies its unchanged 162-file allowance.
Version `v0.151.1` is a development identity; `publicEligible` remains false.
Later documentation commits do not relabel this candidate's source.

## Browser results and preserved failures

Mac16,7, macOS 26.7.1 (25G241), Chrome 155.0.8059.80, headless, 1440 × 900 CSS
pixels, DPR 1. No dedicated performance/quiet window. All runs used the same
observer authority; its SHA-256 is
`2206c7205f49de9f6d8bc3f6b269c86bfdf2353d4c854388cbacc074ed235e6b`.

| Run                                                                                    | Target results                                               | Complete-run result                                                                         |
| -------------------------------------------------------------------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------- |
| [Uncorrected baseline](flight-practice-pointer-20261015/baseline.json)                 | 13/24 passed: all 12 keyboard cases; only 1/12 pointer cases | Failed; 11 ordinary first-pointer failures; cleanup passed                                  |
| [Corrected first attempt](flight-practice-pointer-20261015/fixed-cleanup-timeout.json) | 24/24 cases and 32/32 target actions passed                  | Failed: browser cleanup exceeded the unchanged ten-second limit; server/site cleanup passed |
| [Corrected unchanged retry](flight-practice-pointer-20261015/fixed.json)               | 24/24 cases and 32/32 target actions passed                  | Passed, including cleanup                                                                   |

Baseline event records show hint text becoming empty during element focus.
Workshop moved 25.4375 px in English and 36.15625 px in Ukrainian; profile and
notebook targets moved 42 px between press and release. Release/click landed on
another element. `document.hasFocus()` remained true: this is an **element-focus
hint-reflow race**, not evidence of actual whole-window blur. Baseline profile
export pointer actions were not reached because their disclosure failed first.

In the corrected first run, all 16 pointer actions retained their target's Y
position, nonempty hint and intended click target. Both corrected runs passed
profile and notebook exports. The fresh notebook backup is intentionally empty;
no flight completion, proof import or personal-data persistence is inferred.
No code, browser deadline or protocol changed between the failed-cleanup run and
the passing retry. A retry does not erase the first cleanup failure.

Original individual receipts, plans, observer-source snapshots and all eleven
baseline screenshots are retained in the [evidence inventory](flight-practice-pointer-20261015/README.md).

### Installation and offline restart: passing retry, unresolved recurrence

The [unchanged installation retry](flight-practice-pointer-20261015/installation-retry.json)
passed nine checkpoints: three prepared/installed apps, closed-window offline
relaunch, installed-window relaunch, browser-process restart while the context
network was disabled, exact scripted proof/profile retention, damaged-transfer
rejection, retained-path rollback and Gym removal preserving the other apps.
There were no page or cleanup errors; all owned installed apps and the temporary
profile were cleaned up. The earlier failure below remains part of the result.

This uses the existing observer's keyboard route, not the pointer matrix. Its
Academy prior version is the **same payload at another path**, not a distinct
release migration. Browser-context network denial is not machine-wide airplane
mode. No human flight or saved-World-content acceptance is inferred. The raw
observer's historical pointer-warning text predates the separate matrix above;
it describes that observer's limitation, not a new pointer failure on this source.

## Automated checks

- Practice suite: **345 passed**, zero failures or skips.
- Pointer-observer tests: **10 passed**, including ordinary single-click behavior,
  independent keyboard traversal, bounded exports, failed admission and late
  resource-cleanup uncertainty. The optional-candidate CI now runs this suite.
- Academy native dialog/menu tests: **49 passed**. The recorded pre-fix native
  Help/Notebook regression failed both children (plus their parent); 44 unrelated
  tests were intentionally filtered, not claimed passed.
- Gym/Worlds native-dialog regressions failed before the fix and passed after it;
  their complete two-file suite passed 55 tests. These modeled cases do not claim
  native first-pointer acceptance for Gym or Worlds.
- Scoped ESLint, unchanged generated worker and whitespace checks passed.

## Remaining work, in order

1. **C4/offline verification reliability:** the first all-three installation run
   on this candidate prepared and installed every app, then failed during Academy
   closed-window offline relaunch. The launcher reported incomplete verification,
   retained the saved-version record and offered Check again, but Open stayed
   hidden. Browser-process restart was not reached. The
   [original failure](flight-practice-pointer-20261015/installation-unverified.json)
   retains the exact status and cleanup: all owned installed apps were removed
   and the temporary profile was cleaned. This recurrence means the earlier
   readiness fixes did not establish reliable cold relaunch; its exact underlying
   timeout/inspection cause is still unproven. Do not increase deadlines or
   certify an unverified pointer merely to make the observer pass. The unchanged
   nine-checkpoint retry passed, establishing one successful current-candidate
   restart, not explaining or eliminating the intermittent failure.
2. **C2/full player journey:** main-game directory → Play → deliberate flight,
   pause/retry and beginner exercise in each app and both FPV modes. This run
   qualifies selected Academy controls, not the full player journey.
3. **C5–C7/recovery:** genuinely different versions for all three apps, protected
   active sessions, cancellation/stalls, cache-write denial, missing dependencies
   or owning worker, and scoped removal with actual saved Worlds content.
   Existing modeled coverage is not a substitute for those browser observations.
4. **Remaining C3/C9:** native Gym/Worlds pointer matrix, return focus, disabled/
   held-input behavior, physical radio/controller/touch, spoken screen reader,
   native zoom and explicit whole-window focus return.
5. **C8/C10/C11:** named-device moving-flight performance, real first-time-player
   and maintainer walkthroughs, and attributable content/license/review decisions.
   Human and physical-device checks need real participants/hardware, not invented
   automated approvals.
6. **Deferred:** hosting/capacity choice, release allocation, upload/selection and
   public end-to-end acceptance. The public directory is not populated by these
   local fixes.
