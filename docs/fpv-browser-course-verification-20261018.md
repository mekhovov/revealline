# Browser aircraft course verification

Implementation: `81fd96bb0` (shared reconstruction and worker transport),
`3c99a3e97` (explicit archive-panel action), `c6092b4a3` (package dependency checks)
and `5947bdcf5` (language-dependent archive status labels).
Final runtime source: **5947bdcf5fbd9af302e25a959fdbcdbbfcfdbf1f**,
tree **909d18d0513d5ca29614343102308ac5c639b2be**.
Status: independently reviewed and locally accepted; not deployed.

## Behavior and limits

**Verify course completion** checks the selected saved archive against the current
session's frozen course. It first verifies the unchanged physical recording, then
reconstructs ordinary mission predicates with the archive's aircraft, controller,
rates, mode, backend and historical mission adapter. The archive name, course and
recorded mode are displayed. A successful result describes the recorded flight;
it does not complete the currently paused attempt.

The browser and offline CLI share one reconstruction kernel. Each requested check
owns a separate worker. World supplies its native course adapter during worker
installation; Academy retains only its existing model. Functions do not cross
worker messages. Replacement, same-owner recovery, selection changes, cancellation
and disposal invalidate late results. Progress callback failures terminate the
owned worker. Existing physics-only verification remains available.

Results distinguish completed, incomplete, unsupported, course-version mismatch
and checkpoint-only recordings. Actor-free hold/gate/land courses and supported
historical adapters are the only admitted course family. Regional/free flight,
dynamic/action-dependent courses, challenge wrappers and unknown versions remain
unsupported for course proof. Physical verification can still succeed independently.
All results remain **unscored**, with no ghost, comparison, PB or award eligibility.
This verifies simulation behavior, not real-world fidelity or authenticated input.

## Automated evidence

| Scope                         | Result               | Boundary                                                                                                                                                                                                                                  |
| ----------------------------- | -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Shared reconstruction and CLI | 42/42 pass, no skips | All fifteen aircraft × both modes on one lesson, gate cases, historical adapter, malformed/tampered/partial cases, bounded input cursor and cancellation. Run on frozen runtime files before commit; their bytes match the final runtime. |
| Worker/client/archive runtime | 22/22 pass, no skips | Actual handler with structured-clone transport, dedicated ownership and cancellation, both entry modules installed exactly once, World retaining Academy-course fallback. Not a native-device run.                                        |
| Archive controls              | 31/31 pass, no skips | Twelve new cases: frozen selection/configuration, recorded mode, separate outcomes, Regional availability, cancellation, late results after replacement/recovery/selection/disposal, EN/UK and stable live-region updates.                |
| Final package gates           | 19/19 pass, no skips | Academy/World dependency closure and pins, standalone and native package limits, final clean committed source.                                                                                                                            |

Independent review approved the kernel, worker/bootstrap, UI ownership and package
changes. The initial UI mode readout used the construction-time assist location;
review corrected it to the authoritative serialized `config.response.mode` before
acceptance. The archive status-label assertion failed against the previous source
and passes after the locale repaint correction. Language changes preserve the
selected archive and do not read/write storage or rerun verification.

[Final exact package receipt](fpv-browser-course-package-qualification-20261018.json):

| Package boundary              | Bytes / limit           | Remaining  |
| ----------------------------- | ----------------------- | ---------- |
| Academy original inputs       | 13,299,447 / 13,303,808 | 4,361      |
| Academy emitted bundle        | 13,074,518 / 13,107,200 | 32,682     |
| World original inputs         | 19,785,174 / 20,971,520 | 1,186,346  |
| Simulator-only native package | 19,018,894 / 33,554,432 | 14,535,538 |

Academy source slots remain 151/151; World remains 211/211. The emitted Academy
has 138 files. No budget or dependency-policy cap was changed. Native packaging
success is not signed installation or physical-device acceptance.

## Rendered World acceptance

A fresh isolated local source-preview origin (`127.0.0.1:8873`) was tested on
18 October, approximately 22:36–22:50 CEST, using the normal UI and keyboard.
The public browser tab and its archives were untouched.

- The fifteen-aircraft picker, saved Meteor75 setup and normal teaching-guide
  **Practice with BETAFPV Meteor75** route were used. Aircraft defaults were saved
  only in this new test origin. No hidden-state or database injection was used.
- An excessive-throttle first climb did not complete the lesson. Its completed
  26.86-second archive passed physical verification and explicitly failed course
  completion. A separate short attempt landed hard and inverted; it also did not
  complete the height step. These negatives are retained, not counted as passes.
- Fine keyboard throttle then completed the original **Meet your drone** lesson.
  Observed objective durations were **0.80 + 5.16 + 8.52 = 14.48 seconds**. The
  drone landed upright and the attempt paused at **16.34 seconds**. Its finished
  archive independently verified course completion at exactly **14.48 seconds**.
- The result translated EN→UK with the same archive, course and recorded mode.
  Review found the older option status still said “finished”; final commit
  `5947bdcf5` corrects this without altering saved names.
- After a normal reload, all four preceding test archives remained listed. The
  saved Meteor75 setup remained at zero changes. Home Continue first resumed a
  prior Legacy attempt; this was not claimed as physical-checkpoint recovery.
  Explicit Apply & restart selected the saved aircraft again. The completed
  archive verified at 14.48 seconds while the new attempt remained paused at
  **0.18 seconds**. Final UK→EN changed both the result and option status while
  preserving the selected archive.
- Explicit cancellation produced **Course verification cancelled** without
  changing the current flight. Browser diagnostics captured no errors/warnings.
  The source-preview server reported the absent generated World offline worker;
  this preview is not offline-network acceptance.
- No archive was deleted. English was restored; the temporary tab/server closed.

## Actual emitted Academy acceptance

The final 138-file emitted Academy package was served separately at
`127.0.0.1:8874` around 22:51–22:54 CEST. This used actual package output, not a
source-file fallback.

A Meteor75 draft launched with motors off and waited for Arm. It flew **3.88
seconds**, reached approximately **0.3 m**, and paused upright with **50% throttle**
and **+0.3 m/s** vertical speed. The archive finished successfully. The new
course-check worker then reported **recorded physics verified / course not
completed** for **Lift and land**, as expected for that short flight. Captured
browser diagnostics contained no errors/warnings. No setup was saved and no
archive deleted. The temporary tab/server closed.

This checks the shipped Academy worker bootstrap and course-verifier dependencies;
it does not establish complete Academy-course coverage, offline-network behavior,
real radio support or native runtime qualification.

## Remaining work

Publish through normal hosted integration and perform deployed acceptance. The
first pause/archive PR remains on its unchanged exact-head release path. R11D
still needs a manually selected verified practice reference, comparison-class
filtering and bounded geometry-correct visual playback; the existing legacy PB
renderer cannot be used unchanged. Package input capacity must be measured before
that feature is considered ready. Scored promotion remains behind its separate
qualification gates. The older public archive-retention incident is still open;
these fresh-origin positives neither explain it nor recover the six protected
archives.
