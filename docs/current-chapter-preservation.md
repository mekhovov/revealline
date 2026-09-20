# Current-chapter preservation

Status: v0.68.2 correction candidate; not released or publicly accepted. Tracks the Solo portion of P06 current-chapter preservation. It does not close P03, P06 or hardware qualification.

On public v0.68.0, starting Pressure Pictures and then choosing its Play action again in More worlds offers to replace the same unfinished flight. Stay keeps the flight and restores the exact Play action. Ordinary mission selection already preserves this chapter. The world-play resolver unconditionally returned `same: false`.

The correction compares both the source-pack ID and authored campaign key against the unfinished accepted flight. Selecting that same chapter keeps its exact paused attempt and explains how to return to Continue. Different chapters retain checked Stay/Replace. A finished attempt is not classified as an unfinished current flight, so the ordinary replay path remains available. Preparation, picture validation, scoring and simulation are unchanged.

Verification uses the actual mounted Solo host with authenticated installed pack bytes. The regression opens an unfinished cut, reselects its chapter, and checks the exact run, checkpoint, picture ownership, profile and saved-session bytes. It also requires no replacement dialog, no extra download, a usable Play action and exact focus return. The full existing file covers different-chapter Stay/Replace, decode failure, cancellation, stale work and conflicting artwork ownership.

The public observation and original-code failing regression are retained under `.cache/v0680-public-native-r1` and `.cache/current-chapter-preservation-r1` in the working repository. Final evidence must be committed with the release delivery. Focused host tests are separate from native browser, public deployment, physical input and offline checks.

Research: [W3C's modal-dialog pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/) recommends a visible closing action, a contained keyboard sequence and logical focus return. Those navigation requirements remain applicable to the different-chapter confirmation; selecting an unchanged chapter need not open that confirmation.

Both complete affected-file runs pass 16/16 tests on Node 20.19.5 and Node 22.22.2. [Retained evidence](verification/current-chapter-preservation/manifest.json) includes original failing behavior, the sparse-fixture failure and final successes. These are focused checks, not complete source qualification.

## Full-suite correction

The first complete hosted families for `45ed925e` failed an older offline current-chapter test that expected the removed replacement dialog. The corrected complete file now requires the exact paused cut, checkpoint, unchanged storage bytes, no new download, no confirmation and retained Play focus. Different-chapter Stay/Replace, quota/readback, failed installation and cancellation coverage remains. The test activates a focused Play action, matching the native keyboard journey.

The complete additional host file passes 15/15 on Node 20.19.5 and Node 22.22.2. [Original failures and corrected receipts](verification/current-chapter-preservation/full-suite-correction/review.json) stay separate from the earlier 16-test file and from pending exact-source full requalification. No production behavior changed in this test-contract correction.
