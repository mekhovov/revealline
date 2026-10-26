# Integrated aircraft release acceptance — 19 October 2026

The final runtime at `cfdf24d617f631c15e0bfaff1f167dcba5008ab9` (tree `73013fe15388dd2891ce2e996ee34e63bb0b0d58`) combines the reviewed recovery, course verification, split/reference, contact and 1,000 Hz changes with current main `dd337c8120fd6f875544c1479713d3aa4299c323`. The five reviewed #1665 patches are included for private integration testing while that PR follows normal release checks. No hosted merge or CI gate was bypassed. Later documentation-only commits do not alter this runtime.

## Integrated source and package checks

The complete course-flight file passes **32/32 TAP checks**, with no failures or skips. It runs **420 ordinary-control flights across 141 host/course pairs**, all fifteen aircraft and both flight modes, plus independent changed-aircraft/rates/PID comparisons in Academy, World and learning hosts. These 3.6-second samples establish takeoff, steering and released-control behavior, not completion of every objective. The source integration also preserves main's lesson-mode controls and explicit paused mode changes. Four fresh-session test assertions were updated to the new v3/1,000 Hz contract; explicit historical 500 Hz fixtures were retained.

All **19 package checks** pass: ten optional-package, seven native-development-package and two World texture checks. [The exact measurement](fpv-flight-integrated-package-20261019.json) verifies committed input bytes, records artifact inventories and binds them to the source above. It does not build the unrelated full game.

| Package                              | Measured bytes |      Limit |  Remaining |
| ------------------------------------ | -------------: | ---------: | ---------: |
| Academy original inputs              |     13,301,127 | 13,303,808 |      2,681 |
| Emitted bundled Academy              |     13,070,737 | 13,107,200 |     36,463 |
| World original inputs                |     19,791,370 | 20,971,520 |  1,180,150 |
| Native simulator development package |     19,017,407 | 33,554,432 | 14,537,025 |

Original source inventories remain full at Academy 151/151 and World 211/211. No budget or file admission was increased. The shared-shell deduplication saves 5,106 bytes with all other generated AST nodes preserved. Academy's small remaining source margin is a release constraint. Every subsequent source/dependency change requires a fresh capacity assessment. Native packaging does not qualify operation on native hardware.

## Actual packaged keyboard flights

These checks used two fresh localhost origins in the available desktop in-app browser, loaded from the exact emitted Academy and standalone World artifacts. They used ordinary visible controls and keyboard commands, not injected state. The affected public browser tab and its archives were not accessed. [The manual receipt](fpv-flight-integrated-manual-20261019.json) records exported configurations and hashes.

**Meteor75 / Academy / Self-level.** Selecting Meteor75 in the workbench and testing the draft created a zero-time unarmed attempt. In the unchanged **Lift and land** lesson, throttle-only keyboard input completed the first objective at 4.14 seconds and the complete lesson at **8.58 seconds**. The exported 530 input rows confirm zero roll/pitch/yaw commands. The descent included a bounce and about 0.4 m/s drift before settling upright; this is not a gentle-landing or zero-displacement claim. Practice continued to 10.60 seconds, with a durable checkpoint at 10.00 seconds.

The finished recording's real module worker verified the original course completion at 8.58 seconds on `civilian-quad-aircraft-regional.v3` at **1,000 Hz**. Explicit split-reference selection and aircraft-reference display remained independent; both split differences read zero. Export and reverification passed. Recovery returned to **10.00 seconds, paused**, with the proof/reference cleared and no invented earlier split history. Browser warning/error logs were empty.

**Nazgul / World / Self-level.** The World picker filtered to Open meadow and Random level selected **Turn and travel**. The workbench created a Nazgul draft with its starter Actual rates; the frozen exported setup is 652 g, battery depletion off, aircraft-specific controller gains and 1,000 Hz v3 timing. Keyboard takeoff, small pitch/roll/yaw inputs, release and repeated pause/resume reached **12.80 seconds**. Observed altitude was about 3.4 m, drift 0.3 m/s, with all rotation controls released and throttle retained. The finished archive verified **complete session physics from reset**. No course completion is claimed for this free-practice check.

Changing the visible Flight mode control to **Acro** created a new paused zero-time attempt with the same aircraft. After explicit resume, a separate 5.04-second keyboard takeoff/yaw/pitch/release check reached 6.1 m; released rotation controls were neutral, throttle 35%, and a 5.00-second checkpoint was saved. This is a short mode-transition check, not a sustained/landing qualification. World warning/error logs were empty.

Local screenshot paths are retained in the task's `sustained-flight` visualization directory: `meteor75-packaged-landing-complete-20261019.png`, `meteor75-packaged-course-verified-20261019.png`, `meteor75-packaged-recovered-20261019.png`, `nazgul-packaged-meadow-flight-20261019.png`, and `nazgul-packaged-acro-flight-20261019.png`. Exported archives remain in the local paths and hashes named in the receipt; no user archive was deleted.

## Split-reference lifecycle correction

The final package also includes independently reviewed `f81dd8a004d911049efc1ff366b2166168e72506` (integrated as `3d528a190`): the controls check whether their own session still has a split reference. Clearing verified proof always clears that session's reference, including when a presence query fails. It cannot clear another session's reference, and it does not affect the separately selected visual reference. **92 focused checks** pass, including EN/UK, disposed/owner boundaries and failed-query cleanup. This closes the previously recorded minor control-label lifecycle remainder.

## Remaining release gates

The software, local numerical, package and representative packaged-flight gates above are complete. Final normal integration review, hosted CI, deployment and source-bound public interaction remain separate and are tracked in the [current plan](fpv-current-completion-plan.md). Parent #1626's Pages workflow is fully successful, including verification at 00:54:31 CEST on 19 October; that result does not publish this later runtime.

No result here establishes exact real-aircraft behavior, physical-radio qualification, a browser/device matrix, native/PWA installation on every target, missing-archive recovery or Advanced scoring eligibility. R13 remains open; the six protected older archives are unaccounted for. No further cleanup is performed.
