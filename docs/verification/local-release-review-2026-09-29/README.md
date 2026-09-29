# Local changes and release reconciliation

Updated 2026-09-29 after the source-preservation and release-queue review. The JSON inventories remain dated observations taken during active work; this update does not relabel them as atomic snapshots or product qualification.

## Confirmed release schedule

The GitHub milestone is scheduling authority. An input milestone does not make a draft ready or permit a separate publication. Existing review holds and serial publication gates remain required.

| Order          | Target                                      | Inputs and admission conditions                                                                                                                                                                                                                                                                                                                                        |
| -------------- | ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1              | v0.142.3 — Steam Deck Confirm               | Merged #775/#778; follow-up #785 repairs exact production provenance after qualification stopped before publication. Complete required CI, merged-source qualification, immutable assets, Pages selector, public-byte audit and packaged Chrome acceptance. Physical Deck acceptance remains separate.                                                                 |
| 2              | v0.142.4 — Mission selector and level cards | #776, then refreshed company inventory #738 and screening #747. Reconcile menu dependencies, localization and host expectations on accepted v0.142.3; resolve the inventory/screening conflicts. Retain the existing device and artwork acceptance gates.                                                                                                              |
| 3              | v0.143.0 — Soundtrack resilience            | #779 is now explicitly scheduled as a held aggregate input. Rebase its Audio persistence change and production provenance after v0.142.3; preserve pending style choices through failed saves and qualify the integrated source.                                                                                                                                       |
| 4              | Existing v0.144.0–v0.149.0 reservations     | Preserve the established cultural/Team train. This review does not alter its versions or admission evidence.                                                                                                                                                                                                                                                           |
| 5              | v0.150.0 — Unified native experience        | #782 native menus/authoring/branding/scenes, #784 community directory/isolation, #783 preservation aggregate, #781 dependent Demo Back fix, #771 Pause/Skip, #761 actor/authoring/presentation, #758 discoveries/company/flight, #756 Team difficulty, #757 Team More, and this evidence PR #780. Integrate each unique slice once and qualify one terminal aggregate. |
| Maintenance    | Deployed community acceptance               | #736 → #745 remain held maintenance/service work without a product version. Finish their explicit deployment and acceptance prerequisites; do not duplicate their stack into the product aggregate.                                                                                                                                                                    |
| Reconciliation | Historical worktrees                        | No new release input for dependency links, superseded controller patches, stale compiled data or partial old index states. Preserve unresolved work until its owner and unique changes are known.                                                                                                                                                                      |

All remaining active product PRs now have an explicit existing release milestone. Newly assigned feature inputs retain draft/hold status and the `release-aggregate-input` label. No new immutable version was allocated or published by the scheduling operation. There are no milestone due dates; dependency completion, hosted queues and physical-device gates prevent a reliable calendar ETA.

## Preservation and review findings

- The initial inventory found 260 registered worktrees, 259 existing, and 111 apparently dirty; 58 contained only a dependency link. These are dated observations, not current counts.
- Every one of the 526 paths in the prior shared-workspace inventory is present in pushed PR #783 at `a4abe0e987465276eec4223946849c25c503f8c0`: 508 match the recorded bytes and 18 evolved. None is missing. This proves preservation of that observation, not correctness of every feature.
- A later clean local checkpoint `47890a956` was observed after the pushed preservation head. Its latest reconciliation was not yet represented by that remote head at the observation; do not claim all subsequent local commits are pushed without rechecking.
- PR #781 now contains an eight-file dependent Demo Back repair and intake evidence, based on #783. It is no longer a duplicate whole-tree candidate. PR #782 and #784 are independent scoped inputs on accepted main; reconcile their corresponding aggregate hunks once.
- **Confirm integration blocker:** #783's app/router/navigation still use the old Confirm protocol. Adopting stale conflict resolutions can undo the native-before-frame repair or cause missing-method errors. Port Demo/spectator behavior onto the current `sample`/`cancel` coordinator and captured-target activation. Old lifecycle/trace files and absent race fixtures are inherited stale-base state, not explicit deletion hunks; a correct three-way integration retains main-only fixes. See the [pinned review](https://github.com/mekhovov/revealline/pull/783#issuecomment-5881614912).
- **Demo Back integration blocker:** #781 handles Enter/Space in window capture before the document Confirm coordinator and stops propagation. Consult controller ownership before immediate Back, and test combined Gamepad/native gestures with the real Demo host. The isolated keyboard repair remains useful. See the [pinned review](https://github.com/mekhovov/revealline/pull/781#issuecomment-5881623812).
- The reviewed #782/#784 controller lifecycle, guard, trace, router and race-host fixture retain accepted-main bytes. This is a scoped source finding, not complete browser/device acceptance.
- The historical 24-path player-UX checkout is superseded by published PR #374. Twenty-two files match its pushed upstream; the other two are stale intermediates. The old release-train-guard checkout likewise offers no useful unpublished controller fix and would restore obsolete press-time debounce. Neither needs another runtime PR.
- Two conflicted historical checkouts and large staged addition/deletion sets remain excluded from bulk commits. A separately reported localization-worktree anomaly includes zero-byte/missing files; prior uncommitted content was not established as recoverable or disposable. Preserve it for owner/recovery review.
- Local capacity repeatedly reached ENOSPC and later recovered. Recheck available space before large materialization; do not infer cleanup authority from this review.

## Verification and limits

The v0.142.3 continuation at `442833d169d01d7d48bd5de5be5e62d77f1709ee` passed 34 production-history/recipe tests and 127 Team picture/history/host tests, producer reproducibility, committed-ledger readiness, aggregate validation and focused lint/format checks. All prior production records and 132 payloads remain unchanged. Hosted source qualification and publication remain separate gates.

The earlier local full-suite attempt did not pass or complete: 45 observed failures/assertions were reproduced on baseline, ten readiness timeouts remain unclassified, and one stale assertion was corrected. Deferred full suites are not passing evidence. The source-served Chrome checks do not establish physical Steam Deck acceptance.

This review does not certify line-by-line correctness of all shared features, ignored files or historical worktrees. Head/base identities must be checked again before adoption. Cross-chat messaging authorization remains pending; this task made GitHub review/scheduling updates and did not message other chats.

- [Primary review and exact grouped paths](primary-review.md)
- [Primary path/size/hash observation](primary-inventory.json)
- [Historical worktree review and PR mapping](worktree-review.md)
- [Complete worktree observation](worktree-inventory.json)

Keep this documentation and other source merges behind the guarded v0.142.3 qualification/publication window.

## Historical source preservation addendum

The [bounded donor review](historical-donors/README.md) and [hash manifest](historical-donors/manifest.json) preserve useful Workshop and narrow-HUD source/test hunks as patch artifacts for selective integration after #782 in the v0.150.0 intake. They are not applied to current main and are not qualified product code. Old production ledgers, bindings and producer changes are excluded.

The same review identifies UX3 timer/localization defects and reproduces the Team teaching v1 storage collision using isolated actual modules. Those unsafe donors are report-only; retain existing saves and require a schema-preserving design or explicit migration before adoption.
