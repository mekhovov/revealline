# Recovery handle resilience — 19 October 2026

## Result and scope

R19 is implemented, independently reviewed and locally accepted on frozen runtime
`3738e7658f54de5e5043cd0daf4222bbc36a8d1d` (tree
`8c421a47bc9c929d412d4e525e2407c34b326cf9`). It is integrated as
`3ddd0d8e940dbac9f9152828449eab9358f8279f`; the runtime, scripts, game and
publishing paths have no difference between these commits. Only acceptance
documentation differs. Hosted integration, publication and deployed acceptance
remain.

The isolated World test had reported `InvalidStateError`: the database connection
was closing when Restore attempted to open a transaction. The recovery store now
forgets a connection on close/version change and retries once only when
transaction admission synchronously fails with that error, before any request
has been issued. It never retries an admitted or uncertain write. A late close
from an old connection cannot invalidate a replacement. Cancellation and explicit
store closure remain final, and a reopened empty slot stays empty.

Autosave now identifies capture, validation or storage failures. Error names and
inert details are bounded; EN/UK stage labels are translated. Native error identity
is preserved. This does not alter aircraft physics, flight hashes or archive
retention policy.

## Automated acceptance

- Before the fix, five of six selected new recovery cases failed; the sixth
  passed. Seventeen unrelated cases were unselected in that negative run.
- Final recovery and archive UI tests: **77 passed, zero failed or skipped**.
  The log `/private/tmp/fpv-recovery-handle-focused.log` has SHA-256
  `fb197afa7c2d977af49c8373a0e7aa91680e4e5ad950f56e3372d7de1bcdbdc0`.
- Scoped lint, formatting and diff checks passed. Independent code review found
  no remaining issue in the safe retry/ownership boundary.
- **19 package checks passed**, zero failed or skipped, against the exact
  committed runtime above. The [unmodified receipt](fpv-recovery-handle-package-20261019.json)
  records the inputs and output. One brief process overlap occurred during the
  packaging run; the remaining checks ran sequentially. This was not a full-game
  build or a native-device test.

The actual Academy bundle contains 138 files and uses 13,069,696 of 13,107,200
bytes, leaving **37,504 bytes**. Academy original input leaves **9,185 bytes**
(13,294,623 of 13,303,808). Source file slots remain full: Academy 151/151 and
World 211/211. No package limits or admissions changed. Future runtime additions
still need exact remeasurement.

## Actual packaged browser acceptance

The emitted Academy package was served on a fresh isolated local origin
(`127.0.0.1:8876`), using the existing public test password. Through visible UI,
the test opened Controls, selected Meteor75 into a draft and entered Test draft.
The initial flight was prepared at zero time with motors off. After explicit Arm,
ordinary keyboard input held zero throttle for a brief ground session; it paused
at **6.36 seconds**. The UI reported a durable checkpoint at **5.00 seconds** and
“Checkpoint saved.”

Restore last saved checkpoint completed successfully. The UI reported
“Checkpoint restored. The flight remains paused; arm when ready,” with the recent
clip ending at 5.00 seconds. Earlier observed splits were correctly unavailable
after recovery. Browser warnings/errors were empty. The temporary tab and server
were then closed; no public-site state, saved setup library or archive deletion
was involved.

Screenshot evidence is retained at
`/Users/oleksandr.mekhovov/.codex/visualizations/2026/10/15/01a14160-c3f4-7f50-a9a8-4d14c06417bf/sustained-flight/recovery-restored-packaged-20261019.png`.

This is an ordinary successful save/restore check, not a rendered reproduction of
the native closing-handle fault. Focused transaction tests establish the bounded
retry behavior. It is not a takeoff, course-completion, endurance or hardware test.

## Separate open incident

The [R13 archive-retention incident](fpv-archive-retention-followup-20261018.md)
remains open. This recovery-store correction neither explains missing archive
records nor recovers or accounts for the six protected public entries. No further
deletions or hidden-state diagnostic bypasses are authorized by this result.
