# Combined journey fixture preparation

This local-only manual fixture implements the bounded
[combined-journey design](../../../../docs/fpv-combined-journey-qualification.md).
Ready component PRs are unchanged.

The first native online run at port8963 stopped at its Retry control after 362
successful checks, followed by the failed control check and three passing cleanup
checks. The fixture selected the Results-dialog Retry while the current surface
was Home. The full failure, screenshot and manifest are preserved under
`evidence/source-8963-failed`; the receipt confirms a genuine paused17-tick flight,
retained recovery, no warnings/errors and zero owned resources after disposal.
The next immutable fixture selects the existing public Home Retry button and
adds compact control/dialog/phase observations. Production and visibility guards
are unchanged.

The corrected run at port8964 completed the native flight, exact Watch, edit,
transaction-fault retry and durable reopen checks, then stopped at the final
cleanup assertion. The original owner had all registered resources zero. The
reopened lobby never launched a flight: its lastDraw was null and no renderer
resource result existed. The fixture incorrectly required a renderer for every
owner. Its full failed receipt is preserved under `evidence/source-8964-failed`.
The next observer records factory creation count explicitly: a never-created
owner must have null resources and no draw; a created renderer must still have
all owned resources zero. No missing resource result is treated as zero after
creation. This run used the actual default Industrial presentation and does not
qualify the authored natural profile or longer-session performance.

Preparation rejects any input difference beyond the exact accepted 323-byte
Creator function when using the Library admitted player as a source baseline.
That mode cannot qualify worker cache descriptors or offline reload. Admitted
mode requires all 95 source inputs and all 102 members to match the exact supplied
revision/tree. Both modes rehash their pinned served files before native app mount.
The fresh dedicated origin uses normal database names to support the later native
offline handoff; it refuses pre-existing databases/caches rather than deleting them.

Pack50ff and proof archive073ee are separate explicit imports. This version uses
native file inputs and does not qualify the published Browse/download row.
The selected full native-clock Watch is course08/self-level, 1,616 ticks. A bounded
course02/Acro hold-volume edit precedes one precommit abort and postcommit-refresh
failure/retry. Existing component matrices and all16 Watch runs are not repeated.

Two initial Node preparation mistakes were caught before any output tree or browser
run: importing the staged browser closure lacked the repository's ESM package
boundary for the UMD i18n dependency; then the preparer treated inspected asset
Blobs as raw byte arrays. Inspection now uses the hash-bound source closure and
explicit Blob.arrayBuffer conversion in Node and browser asset checks. Neither
observation is attributed to production or claimed as a passed browser case.

The parent coordinator owns browser execution and the separately recorded
offline server stop/restart. No performance, quota, eviction or new unit-coverage
result is implied by fixture preparation.
