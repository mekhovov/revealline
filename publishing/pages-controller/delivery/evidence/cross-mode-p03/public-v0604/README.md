# v0.60.4 — Recovery reading and navigation

**[v0.60.4 is accepted for the named Recovery correction](acceptance.json).** Recovery follows shared reading preferences, keeps startup/Back navigation available and preserves focus through Find, Review and prepared-export actions. It remains a direct troubleshooting route; no new game-menu entry or gameplay/save/score rule is introduced. **P03, full P05 and P18 remain incomplete.**

[Play v0.60.4](https://mekhovov.github.io/revealline/releases/v0.60.4/site/game/) · [Recovery troubleshooting page](https://mekhovov.github.io/revealline/releases/v0.60.4/site/game/profile-recovery.html) · [Progress and next phases](planning/progress-and-next.md)

| Gate | Actual result |
| --- | --- |
| Exact source | `d77ea4f5c2aeccf2ba3bdf483a3f25531f8095b6`, tree `f3a02f9d9e38650f2f9f61ddacd358dfc1f64333`; **5,511 tests / 438 files in each complete hosted family**, zero failures/cancellations/skips/TODOs. Source/production/build and frozen-original inspection passed. [Original qualification](tools/inputs/1298acb1dbdef3a96b5a690c171fee754794c26c/qualification.json). |
| Source review | [PR #90](https://github.com/mekhovov/revealline/pull/90) merged as `ef260cea80035b65a8ab3769a6b40868275f0b38`, preserving the qualified tree. [Original merge](source-merge/source-merge-commit.json). |
| Immutable release | [v0.60.4](https://github.com/mekhovov/revealline/releases/tag/v0.60.4), release 390820115, published **17 September 2026, 15:11:30 UTC**; nine original assets. [Published original](published-release.original.json). |
| Publication | [PR #91](https://github.com/mekhovov/revealline/pull/91), publisher `1298acb1dbdef3a96b5a690c171fee754794c26c`, tree `961bf6d7da2159071519172b3de8583a16cca139`; [Pages run 35239952497](https://github.com/mekhovov/revealline/actions/runs/35239952497), deployment `6506175017`, successful status `18482014233`. |
| Actual public bytes | **2,755 files / 639,467,460 bytes**, 2,756 attempts including one HTTP 503 and successful retry; no failed, skipped or uninspected files. [Full report](tools/runs/complete-1/report.json), [every result](tools/runs/complete-1/results.jsonl), [every attempt](tools/runs/complete-1/attempts.jsonl), [row reconciliation](public-row-review-complete-1.json). |
| Fresh authority review | [Release/tag/source/deployment identities remained unchanged](after-http-authorities-main-1/result.json) after the full audit. |
| Public browser | [Scoped root observations](native/root-observations.json): current Start/Pause/menu, direct Recovery Find/Review/preparation, shared Large/Plain with unchanged selection/status/export link, portrait layout, ordinary Back and re-Find, retained v0.60.3 continuation and Release explorer return. |

The browser journey used native keys **and semantic selection/settings/link actions**. End/Space/Down did not visibly change the native select in this in-app browser; semantic selection completed the scoped check. That platform/input step remains unresolved and has no established application cause. This is not keyboard-only/controller certification. Ordinary history traversal does not establish BFcache admission; preserving a prepared export link does not verify a downloaded export's bytes.

Existing same-origin profiles were reused. The initial current-game Start created ordinary saved-flight state; retained v0.60.3's saved-flight clock advanced during real continuation. No new cut or victory is claimed for that retained flight. Source-local delayed/fault tests remain separate from public successful fast paths. The 390×844 resize is not a physical phone test; default screenshot cropping differs from the reported 1280×720 DOM viewport.

No historical-original verification, storage migration, fresh offline operation, forced public failures, physical touch/controllers or broad zoom/browser certification is accepted here. Preferences and viewport were restored. Motion and Team lobby preview candidates are not part of v0.60.4. The original failure records remain intact, including the audit caller's rejected absolute-path request and corrected relative references; that was an intake-preparation error, not a game defect.

[CURATION.md](CURATION.md) and [retained-files.json](retained-files.json) identify the finite original evidence. This acceptance-only delivery changes reports and evidence, not the publisher selector or runtime.
