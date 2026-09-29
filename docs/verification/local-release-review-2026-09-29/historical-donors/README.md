# Historical donor triage and bounded patch intake

Comparison snapshots: main b5ab06e12542f72e33c45b973ba693a5e1509c1c; scoped PR782 b4e91d856157eab0cc60eb3dcc77cc1f45c78c46.

These are future v0.150 intake inputs after the PR782 integration. Current PR785/v0.142.3 is unaffected. Neither patch is a ready-to-apply patch against current main. No worktree or Git state was mutated, and no patch was applied.

## P03: useful source port, not yet retained

Donor branch codex/p03-enemy-reading-next, HEAD 2f1074a37ade9c731ea7be37a6e56e533b51d1ac plus the exact dirty-file hashes in the manifest.

Four-file patch: p03-enemy-workshop-reading-source-only.patch (13,506 bytes; SHA-256 78e848c20e1e72f69ad9aa5a7679e80194f2aeac474a50c4323dfb59f01c02e8).

- authoring/enemy-catalog/index.html:13 adds the existing tool-display entry; lines17–30 and49–53 wrap actions with minimum44px targets.
- authoring/enemy-catalog/workshop.mjs:195–198 combines explicit reduced effects with the system motion preference.
- game/ui/enemy-catalog-panel.css:9–10 adopts FieldKit text/font tokens.
- game/test/enemy-workshop-host.test.mjs retains focused assertions for initial display preferences, draft/focus/storage preservation, actual painter reduction, BFCache return and subscription retirement.

Main/PR782 lack the entry and action wrapper, use only system reduction (main workshop:197; PR782:229) and retain fixed18px pixel font (panel CSS:9). The shared tool-display implementation already exists; no new preference infrastructure is needed.

Port only these intentions onto the PR782 host. Preserve its authoring-source picker, Workshop return flow, translated labels and native/controller ownership. Historical HTML predates the distinct Return to Workshop / Return to game links; copying it wholesale would lose them. Port host assertions to the latest harness, then verify actual narrow/Large/Plain/reduced rendering and page return.

## P05: useful narrow HUD port, old production artifacts excluded

Donor branch codex/p05-narrow-hud-actor622-r5, HEAD 17e0a455f76c3f4a72f2e596397a0e73463335a5 plus exact dirty hashes.

Five-file patch: p05-narrow-hud-source-only.patch (7,297 bytes; SHA-256 51fb6827de1083d2ad5fd40f5795df914434feb4a52e694a39cb70f22e92efd4).

- game/ui/hud-values.mjs:2–8 gives presentation-only maximum-three-decimal score labels and preserves integer padding; app imports/uses it.
- game/ui/field-kit-compiled.css:585–600 adds intrinsic wrapping below320px; 676–678 moves the Pause focus outline inside its target.
- game/couch/couch.css:423–440 reflows narrow Versus Pause/score/clock without reducing text size.
- game/test/hud-numeric-values.test.mjs checks integer/fraction formatting and actual fractional capture with unchanged replay/checkpoint/storage.

Main app:9007 and PR782:9014 still display raw floating-point score strings; the narrow overrides/helper are absent. Retain the existing localizedText callback and use selected-language number formatting rather than blindly adopting undefined/system locale.

Only source CSS/app/helper/tests are exported. Production ledger, Team bindings, producer, generated compiled manifest/runtime/studio, historical acceptance documents and old history assertions are excluded. Do not adopt FPV32. Fresh append-only presentation qualification must use the then-current ledger. Native donor evidence was partly disposable markup rather than current Phaser gameplay; recheck long timer/score values, Large/Plain,266/280/320 widths, rotation, focus and arena containment on the integrated host.

## UX3: useful intentions with concrete defects; report only

Commit 7cdfb458b977af907f6fc2410533b845c7d03493 (codex/ux3-gameplay-hud-v1) has unretained intentions: elapsed Versus clock when no countdown exists, hiding series score outside first-to-two, player target/state descriptions, Team progress aria-valuetext and identity descriptions, and grouped Solo equipment status.

Do not cherry-pick unchanged:

- Donor app.mjs:7961 labels timed runs TIME LEFT, but the next line still formats elapsed run.time. Its timeLabel helper at261–262 only formats input and does not subtract from the limit.
- Raw English textContent assignments replace today's localizedText/t behavior.
- The old fixed/tiny HUD geometry must be reconciled with shared display preferences and P05 intrinsic wrapping.
- Active short-landscape Team footer already uses fk-target-size at current relay-rescue.css:1434; that target-size policy is partly retained.

Port selected semantics after HUD layout decisions, localize labels and ARIA descriptions, and test that timer labels match displayed quantities. No UX3 patch was exported.

## Team teaching: storage collision proved; report only

Commit57bfaa567c62def3eae222c8feb69ddc4fc8039c has contextual ground/capability/specialist guidance already retained in main and PR782. Its unique intentions are explicit acknowledgement with a pending priority queue and counting support completion only when the pulse affects a target.

It reuses both format and key revealline.team-contextual-teaching.v1 while replacing introduced[] with acknowledged[] (donor module:19/109; main/PR782:16/77). Actual pinned modules loaded in memory reproduce this:

1. Existing v1 record introduced:[cut], completed:[] produces no tip in current.
2. The same record produces a cut tip in donor.
3. Donor acknowledgement writes acknowledged:[cut], dropping introduced.
4. Returning to current produces the cut tip again.

This used isolated in-memory storage only. A persistent-dismissal redesign needs an explicit format/migration and rollback policy with old-record fixtures, or a schema-preserving implementation. The effective-pulse completion check can be an independent small change without schema changes.

The donor's coop-briefing.mjs:35 also derives intercept capability only from relays, whereas current:29 includes enemies with lineImpact; preserve current coverage. Preserve new Steam Deck Confirm/native-event ownership for any dismiss action. No Team patch was exported.

## Integration sequence and limits

1. Keep current PR785/v0.142.3 frozen.
2. Integrate PR782 through its required gates.
3. Port P03 and P05 as separate owner-scoped source/test batches; coordinate new production qualification centrally.
4. Reconcile UX3 semantics after HUD layout integration.
5. Handle Team persistent-dismissal migration separately; the effective-pulse rule can be a schema-preserving follow-up.

Patch contents were inspected in full. Both contain only the listed source/test paths and relative repository references; neither contains local absolute/private paths, secret material, old ledger/binding/producer artifacts or unrelated changes. SHA-256 hashes before/after export matched. No donor host/browser/full-suite acceptance is claimed; only the isolated actual-module Team storage reproduction was executed.
