# v0.60.2 — Practice and Playground readability

**Accepted for this correction on 17 September 2026. P03 and P05 remain in progress.** Practice and Playground follow shared reading preferences; browser Back leaves the displayed choice consistent. Text changes preserve the preview and held virtual controls. The last Undo returns focus to a usable tool without replacing the running preview.

[Play v0.60.2](https://mekhovov.github.io/revealline/releases/v0.60.2/site/game/) · [Remaining phases](planning/progress-and-next.md) · [Scoped acceptance](acceptance.json)

## Delivery

| Gate | Result |
| --- | --- |
| Source | Qualified `ece40093940aabdc3b3659a07394b856f33ad4a1`; [PR #84](https://github.com/mekhovov/revealline/pull/84) merged with the same tree. |
| Qualification | Two hosted families each passed **5,449 tests across 433 files**, zero failures or skips; all six source gates, production checks and build passed. These are repeated qualifications, not 10,898 distinct tests. |
| Originals | [Immutable release](https://github.com/mekhovov/revealline/releases/tag/v0.60.2), ID `390644083`, published at 11:18:01 UTC. All nine assets matched reviewed hashes. |
| Pages | [PR #85](https://github.com/mekhovov/revealline/pull/85), publisher `082ef33adbb97f3b508a6ec4359294e7ae5e2663`, [successful run 35215437655](https://github.com/mekhovov/revealline/actions/runs/35215437655), deployment `6501572504`. |
| Public inventory | **2,705 files / 639,168,008 bytes**, zero failures, retries, skipped or uninspected files. [Full report](tools/runs/complete-1/report.json) and [independent row reconciliation](public-row-review-complete-1.json). |
| Authority | [Fresh after-audit verification](after-http-authorities-public-1/result.json) confirms unchanged source, release, assets, tag, latest version and deployment. |

## Actual browser results

[Observations](native/observations.json) record the scope and unsuccessful preliminary attempts. The canonical Play route opens v0.60.2. Keyboard navigation reaches Settings and Controller Practice. Practice preserves a held virtual button and its exact child preview during text changes. Actual History Back restores Plain/Standard/reduced with a matching selector; that return creates a new child session, so it is not BFCache evidence.

At 390×844 and 844×390, scoped Theme/Large and Plain/Standard layouts fit the viewport. Playground draft changes and Undo preserve the live preview; the final Undo focuses Wall. A real imported image pack was exported, downloaded and reimported. The **862,703-byte export matches the entire imported file exactly**. A malformed import preserves the working picture, Undo and preview. Explicit Play launches the imported scenario; a real practice flight reaches **52.2%, 8,160 points in 0:04**, with three lives, followed by Retry and keyboard Pause/Resume. Practice awards no campaign progress.

The operator restored Theme/Standard/full effects, left audio settings unchanged, reset the viewport and left the new title ready. Inline screenshots were inspected, not fabricated as saved artifacts. The pre-deployment 404 and two locator/category mistakes remain recorded separately from passing final results.

Physical touch/controllers, Safari, 200% zoom, the full EN/UA/style matrix, naturally occurring background Undo, nonempty offscreen diagnostics, fresh offline/save migration and human playtests remain open. Automated and native-browser checks do not establish enjoyment or whole-phase readiness.

## Retention and next work

All 72 prior catalog entries remain. [Archive11 admission](https://github.com/mekhovov/revealline/tree/082ef33adbb97f3b508a6ec4359294e7ae5e2663/publishing/pages-controller/evidence/archive-11/append-v0601) preserves original v0.60.1 and v0.51.0; its separate full audit and browser checks passed before cutover.

The release includes updated runtime-maintainer and level-design guidance and prompt examples. Next: remaining P03 decision/cancel, Collection paging and Team terminal journeys; then remaining P05 supporting screens. The [plan](planning/progress-and-next.md) preserves all later gameplay, assets, music, content and platform gates.

[Curation](CURATION.md) and [retained files](retained-files.json) preserve original receipts and their hashes. The [source qualification ZIP](https://github.com/mekhovov/revealline/releases/download/v0.60.2/source-qualification-evidence.zip) remains in the immutable release rather than being duplicated here.
