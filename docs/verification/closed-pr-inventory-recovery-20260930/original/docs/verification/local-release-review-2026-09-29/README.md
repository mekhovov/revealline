# Local changes and release reconciliation

Current review: 2026-09-29. This replaces the stale status summary; the linked inventories and review records remain dated evidence. Milestones schedule work, while draft/hold state and exact-source release checks control admission.

## Current source coverage

The primary checkout is clean at `0cc7337a8e490d73ad9d7718fb5b208aaf7da924` and matches pushed PR #783. Its original 526-path observation was fully preserved (508 exact / 18 evolved); that historical comparison is not a claim that every later feature is reviewed or ready.

The refreshed scan found 264 registered worktrees, 263 existing, and 111 dirty. Of the dirty worktrees, 58 contain only dependency links and 53 contain source/evidence changes. Compared with the previous inventory: four registrations and ten heads changed, and three worktrees gained dirty paths. The scan was read-only and non-atomic; unchanged path/status does not prove unchanged bytes.

Two new product batches were identified: native-menu/Versus handoff work belongs to existing #782, and Team readability/rescue/Support work belongs to existing #757. Exact final preservation heads and the disposition of transient dirty evidence are in [refresh.json](refresh.json). Levels and CI intake documents already match #780/#787. Pause and selector changes are patch-equivalent to #771/#776 and need no duplicate PR.

Historical damaged localization files, old conflict/index states, dependency links and obsolete generated artifacts retain their recorded exclusion or recovery dispositions. No worktree was reset, bulk-staged, deleted or archived by this review.

## Release sequence

| Order       | Target                                      | Inputs and remaining admission work                                                                                                                                                                                                                                                                          |
| ----------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Published   | v0.142.3 — Steam Deck Confirm               | #775/#778/#785 and publisher #788 are complete. The [Pages audit](https://github.com/mekhovov/revealline/actions/runs/36508987227) verified 2,240 files / 761,781,536 bytes. Physical Deck acceptance remains open.                                                                                          |
| 1           | v0.142.4 — Mission selector and level cards | Maintenance #789 must land before future evidence assembly. Integrate #776; refresh #738 then #747 against final mission/company content. Required reruns, inventory/screening reconciliation and applicable artwork/device checks remain.                                                                   |
| 2           | v0.143.0 — Soundtrack resilience            | #779 Audio persistence, with final integration and source/release qualification.                                                                                                                                                                                                                             |
| 3           | Existing v0.144.0–v0.149.0 reservations     | Preserve the established cultural/Team train and its reviewed dependencies.                                                                                                                                                                                                                                  |
| 4           | v0.150.0 — Unified native experience        | #782 native menus/Creator/branding; #784 community isolation; #781 Demo Back; #771 Pause/Skip; #761 actor/authoring; #758 discoveries/company/flight; #756 Team difficulty; #757 Team navigation/readability/guidance; #786 authoring originals. Reconcile unique #783 slices once and retain #780 evidence. |
| Maintenance | Deployed community acceptance               | #736 → #745 keep their service/deployment prerequisites and holds, without a product version.                                                                                                                                                                                                                |
| Maintenance | Branch reconciliation                       | #787 preserves opt-in CI timing tools. Hosted timing activation remains a separate operational change.                                                                                                                                                                                                       |

All current product inputs have an existing release milestone. No immutable version was allocated by this refresh. There are no reliable calendar ETAs: final integration, current-head checks, device acceptance and the serial publisher queue determine shipment. A successful earlier run does not satisfy a newer pending run or a changed main baseline.

PR #789 corrects an evidence-package omission prospectively: v0.142.3's qualification ZIP omitted the historical audio audit. Its frozen build/assets remain immutable. The new assembler preserves the original audit in future packages; this does not silently replace v0.142.3 assets.

## Review findings and verification

- **Resolved:** #783 now contains the shared Confirm `sample`/`cancel` protocol and native-before-frame wiring. The earlier broad claim that this migration was absent is obsolete.
- **P1, Creator integration:** #783's Creator adapter still hard-cancels the just-released Start gesture on the menu-to-flight transition and probes inactive flight context before native filtering. A controlled run of the existing #782 boundary tests fails for #783 and passes for #782. Preserve #782's tested adapter and guard transition fix during aggregate reconciliation.
- **P1, Demo integration:** #781's window-capture Enter/Space Back action can run before the document Confirm coordinator. Keep the ordinary keyboard repair while consulting shared ownership; add the combined host interleaving regression before admission.
- The Creator comparison produced 3 selected passes, 1 expected regression failure and 6 unrelated skips. It is not a broad suite or hardware test. [Controller review and reproduction](controller-refresh-review.md) records the exact source identities and command.
- New native-menu and Team batch validation, final remote heads, and current required-check observations are recorded in [refresh.json](refresh.json). Held admission failures are distinguished from failed product tests.
- The prior local full suite did not pass or complete. Source-served Chrome and supplemental published-byte in-app tests do not establish physical Steam Deck acceptance. See the [release evidence and limits](https://github.com/mekhovov/revealline/pull/785#issuecomment-5882103200).

This review inventories all registered worktrees and reviews the new source delta; it does not certify every historical feature line, ignored file or damaged checkout. Existing PR owners and the final aggregate qualification remain the implementation/release boundary. No cross-chat messages were sent.

## Preserved evidence

- [Current refresh and release observations](refresh.json)
- [Controller review and reproduction](controller-refresh-review.md)
- [Primary review and grouped paths](primary-review.md)
- [Primary path/size/hash observation](primary-inventory.json)
- [Historical worktree review and PR mapping](worktree-review.md)
- [Original full worktree observation](worktree-inventory.json)
- [Remaining branch dispositions](remaining-branches.md)
- [Source intake updates](source-intake-update.md)
- [Bounded historical donor patches](historical-donors/README.md)

Historical Workshop and narrow-HUD patches remain selective source donors for v0.150.0. UX3 timer/localization defects and the Team teaching storage collision remain report-only; preserve saves and require compatible schema design or explicit migration before adoption.
