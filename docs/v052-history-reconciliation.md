# v0.52 history reconciliation

PR #35 was linearly rebased from `362e5bf` to `01473e4` by the separate deployment task while the original source was still under verification. The rebase replayed first-parent commits but omitted implementation work previously merged through side branches. Restoring the `b8774ec` sprite files alone did not restore their validator, loaders and presentation metadata.

This reconciliation retains both histories through a normal merge. Compared with the tested source, the incoming game change retained here is the explicit `shell-release-explorer` identifier. Its test now checks the six visible destinations, resolved catalog URL, label and keyboard reachability. Current main publisher changes, Archive09 admission and delivery evidence remain intact.

The retained implementations include runtime body derivatives and their validation; touch-hand migration and consistent stick/D-pad settings; canvas Plain typography; presentation-aware enemy previews; conditional equipment explanations; and the requirement to validate both overlapping frozen-source copies. Their tests and provenance remain in history.

Source profile recovery keeps the real build-config version lookup, cancellation and empty untrusted catalog in development. This already fixes the source-entry problem addressed by the later `dev` fallback. It does not need the synthetic `9999.9999.9999` ceiling or a Title-only bypass of the pending-content guard. The existing lazy-resolution and cancellation tests remain.

The full `362e5bf` run passed preflight and 3,865 of 3,867 tests, with exactly two old menu expectations failing and zero skips. The corrected whole menu file passes on Node20 and22. The reconciled menu and updated workflow contracts pass six local cases; the new raw-source identity CLI passes eight temp-Git cases on each supported Node version. These focused results do not qualify the complete reconciled head.

CI now records raw tracked-file, executable-mode and symlink identity before and after commands using the workflow-pinned verifier. It retains the independent build introduced on main. The complete new source gates, freeze, native acceptance and publication still have to pass.

Archive10 has independently reproduced and deployed v0.42 and v0.51 at infrastructure `55019541`, deployment `6450531920`. All976 public files /633,532,427 bytes match. This infrastructure work is separate from v0.52 qualification; its new native/main-controller admission is still pending.

No existing tag or frozen release is replaced. The separate deployment task is coordinating PR integration and version allocation; this branch does not force-push its work or create a competing v0.52 tag.
