# Levels: current-main restoration and remaining plan — 30 September 2026

## Current delivery, not historical PR status

Latest accepted main inspected for this batch is
`451b82dc13dc8a8545ff964ffb724d3d756ac62a` (#816). The shared primary checkout
was updated separately by its owner. This lane first rebased four commits in its own
`cultural-routes-v15` checkout onto `3dbf92d39f` (#814) without conflicts, using the new
branch `codex/levels-current-main-20260930`. The previous branch and published
donor commits remain intact; no shared checkout, owner index or historical
release was rewritten.

The subsequent main change adds 21 lines only in the Legacy mission-library
Ready handoff. It does not overlap this batch's source paths. Final integration
must include that fix; the PR head and base record the exact final rebase.

The rebase exposed a real missing integration: main still has **v37**, not
Cooling loop **v38**, and lacks the completed pressure-corridor route proofs.
All 17 relevant files match their pre-feature state at `321408a3`: eight old
paths are unchanged and nine additions are absent. This source was preserved
in earlier aggregate proposals but **never reached accepted main**. Closing a
duplicate intake in that earlier queue did not establish main or public delivery.

This batch restores the reviewed source from `0314aa027`, `de5aeaac2` and
`b3b3b06de`, rather than inventing another edition or redesigning the maps again:

- Cooling loop's existing eroder now contests earned return routes. Its walls,
  Ukrainian separated-band geometry, other actors and protected foundations
  remain unchanged.
- v38 has explicit route registration, lazy/eager loading, isolated progress
  identities and an exact v37 Cooling loop archive entry.
- Studio can inspect the exact candidate and link to its Solo/Versus review.
- Six full strategies across Cooling loop, Pressure ladder and Switchback
  exchange have deterministic replay/equal-board evidence. The latter two
  missions keep their existing v37 geometry.

Normal Solo/Versus still defaults to v25, and Team keeps its current default.
No global physics, difficulty, gameplay policy, artwork, version, workflow or
release selector changes. This remains **balance review pending**; registration
is not approval to promote every newer candidate to the default route.

## Fresh verification

The verified runtime checkpoint on the #814 base is
`375a4f0ad90690f1c3c425de1f6c72136c0d17e6`. Later owned edits in this batch are
documentation only. This checkpoint is not a claim that a hosted build or public
journey has run at the eventual PR head.

- Current Node 20.19.5 focused route/candidate cohort: **41 passed**, zero
  failures/skips/cancellations, 15.51 seconds. Old route checkpoints remain
  unchanged; no golden value was rewritten to obtain a pass.
- Selected loader/history/Studio cohort: **11 passed**, **96 explicit
  name-filter skips**, zero failures, 24.11 seconds. This is not a full-suite run.
- Changed-file ESLint, Prettier and whitespace checks pass.
- Independent read-only review found all 17 restored source/evidence files
  byte-identical to the donor and no missing registration or unrelated overwrite.
- Presentation metadata validation passes for existing revision 104.
- Direct content validators pass: 12 base levels, four themes, seven classes,
  12 packs/35 pack levels/six goals, and the starter Team pack/two levels.
- The initial full CLI validation stopped because this sparse checkout excluded
  `optional-practice`. Its 38 tracked files (2,637,624 bytes) were materialized
  without changing source. The retry **passed**, validating 2,409 files, literal
  references and the pinned content snapshot, with five existing cross-site
  navigation warnings. The initial environment failure is retained separately.
- The separate whole-repository localization check was terminated during
  renewed disk pressure after about two minutes; it is **not passed**. This
  patch changes no translation catalogs. Its hosted check remains explicit.

Disk exhaustion prevented an optional Git index refresh after the successful
rebase and later temporarily blocked documentation staging. Source and HEAD were
intact; no-lock reads confirmed the expected state. The full CLI validator had
completed successfully before the attempt to stop it; only this lane's remaining
localization process was terminated. This lane deleted no caches or user data,
made no build/archive copies, and installed no dependencies.

Full suites, production play, physical controllers, human balance and final
artwork review remain deferred or pending, **not passed**. Hosted build,
provenance, package budgets and release integrity remain separate delivery gates.

## Repository-wide local-change audit

The 04:43–04:44 UTC scan covered 268 registered worktrees: 160 clean, 107 dirty,
one missing, no status errors. Of the dirty set, 63 contained only dependency or
deploy-report residue; 42 matched historical HEAD/status/path signatures; two
were active owner work (Pause rebase and spatial audio). The root and Levels
updates were treated as in-flight rather than misclassified as orphan edits.
This is a path/status comparison, not a fresh byte audit of all historical files.

The previous historical audit **is complete for its recorded cutoff**. The
[final PR780 receipt](https://github.com/mekhovov/revealline/pull/780#issuecomment-5893408945)
supersedes the older pending-history note: 1,188 audited tips, seven stashes,
195 meaningful historical variants and 31 staged OIDs are accounted for through
29 September 15:27:54 UTC. Recovery ref `117d892e8bb140a1c30b574f1b23bba280d0adfe`
is preservation only. Its screened payload contained no private UA-FPV recording
or paused original-track candidate; private material outside that scope remains
excluded. **Never merge or deploy recovery ancestry.**

The [curated manifest](https://github.com/mekhovov/revealline/blob/cb775a9ad9588b993bc3725a03d12058bab1f809/docs/verification/historical-proposal-review-2026-09-29/delivery-audit.json)
preserves selected proposals for review. #780, #802 and #804 are closed,
unmerged preservation records, not proof that every proposal is in main. Newer
active-owner work requires its own push receipt. Nobody should bulk-stage another
owner's changing checkout merely to make a global dirty count zero.

## Delivery queue

The source-restoration PR belongs to the existing **v0.150.0** train. The sole
publisher assigns final versions and controls merge, immutable release and Pages.
No independent version or duplicate publisher is created by this batch.

At the bounded morning snapshot:

| Item                   | State / next action                                                                            |
| ---------------------- | ---------------------------------------------------------------------------------------------- |
| #816 Ready handoff     | Merged as `451b82dc13`; actual public startup confirmation remains separate.                   |
| #815 Creator Guide     | Open draft on current main; owner finishes its input/reading checks.                           |
| #817 Spatial audio     | New owner PR on current main, targeted to v0.150.0; source and integrity report are pushed.    |
| #818 Offline readiness | Open release input for v0.150.0; owned independently.                                          |
| #819 Radio main menu   | Open verification input for v0.150.0; owned independently.                                     |
| Levels v38 restoration | Rebased and focused checks passed; push and reviewed release-input PR are the current handoff. |
| Pause rebase           | Active owner reconciliation, not an orphan patch or permission for this lane to edit it.       |

Main's Pages workflow succeeded, but successful deployment alone does not prove
startup. The Company candidate still failed its budget at **67,792,025 bytes /
794 files**, above the existing **64 MiB** cap; this is the current failure, not
the older 94.5 MB measurement. Latest immutable release metadata still lists
v0.142.3. This audit does not renew its public acceptance or claim v0.150.0 shipped.

## Remaining implementation, in priority order

1. **Finish the current batch's integration.** Preserve the exact restoration
   through main and the frozen artifact; ensure selector/Studio can reach v38.
   Do not hold it for unrelated new artwork or whole-Journey balance.
2. **Complete broader routes, not another speed increase.** Extend complete
   routes across presets, steering modes and selected seeds; the existing wider
   matrix proves first returns only. Investigate actual shortcuts, active threats
   and coverage cleanup. Preserve fair straight-between-impact keeper movement.
3. **Resolve current-edition mastery and erosion decisions.** Historical helper
   predicates do not award current v37 gap goals. Document useful repair/escape
   choices and distinguish route observations from implemented mastery awards.
4. **Continue targeted spatial/cultural batches.** Review remaining mission
   dispositions and adjacent-level distinction, using Ukrainian ornament geometry
   for real route choices. Preserve previous identities/editions and default
   promotion as a separate reviewed decision.
5. **Team cooperation and final qualification.** Complete complementary full
   routes, warning/readability and rescue ownership; finish original P13–P15
   pacing, accessibility/performance and human/device acceptance when available.

These are not new completion claims for the original Journey P00–P15 or broader
game P00–P18. Exact published delivery, source implementation and human acceptance
must continue to be reported separately.
