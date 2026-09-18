# RevealLine v0.60.8 — Missions return and accurate backup feedback

**The public correction is accepted.** Closing Missions returns focus to the control that opened it, including the title, paused field, mission brief and appearance detours. Importing or undoing a game-data backup reports that operation accurately; it does not create fictional mission-preparation or cancellation feedback. A paused flight remains paused until explicit Resume.

[Play v0.60.8](https://mekhovov.github.io/revealline/releases/v0.60.8/site/game/) · [Remaining priorities](planning/progress-and-next.md) · [Root acceptance](acceptance.json) · [Preserved v0.60.7](https://mekhovov.github.io/revealline-archive-21/releases/v0.60.7/site/game/)

## What was verified

- **Exact source:** `a7fd646e40bd93268f56b714fdc5d8aa9b0b1f67`, tree `fffcf886b4f1a0000fbfd062a931bbe1cb0fef64`; [source PR98](https://github.com/mekhovov/revealline/pull/98). Both hosted families passed six source gates and **5,687 tests across 453 files**. Production checks and the ordinary build passed.
- **Actual publication:** [publisher PR109](https://github.com/mekhovov/revealline/pull/109), commit `36d9e9fa14601ae1ae11a737dda0279e27f909da`; [Pages run 35296490635](https://github.com/mekhovov/revealline/actions/runs/35296490635), deployment `6515753918`. Frozen game and publication identities are separate.
- **Every public byte:** all **2,872 files / 640,294,864 bytes**, with zero failures, retries, skipped or uninspected files. Every result and attempt was compared with the complete original hosted inventory. All 79 published release records and 78 historical bridges are present. [HTTP report](tools/runs/complete-1/report.json) · [Row reconciliation](public-row-review-complete-1.json).
- **Actual player input:** keyboard Missions Back/Escape from the title, field and brief; appearance return paths; native file chooser Import/Undo using an owned empty test backup; exact paused-clock preservation. [Navigation and backup observations](public-browser/observations-navigation-backup.json).
- **Reward and continuation:** an actual First Signal win at **52.2%, 8,160 points, 0:08 and three lives**, full earned picture, Retry to a neutral attempt and explicit Pause. Brief navigation was also checked at **390×844** and **844×390**, then the viewport override was reset. [Victory and responsive observations](public-browser/observations-victory-responsive.json).

Root accepted this scope at **18 September 2026, 01:59 UTC**, after the final live check confirmed the same Latest release, nine immutable assets, annotated tag, frozen source and deployment. [Final live authorities](after-http-authorities-main-1/result.json).

## What remains open

This correction does **not** complete P03 navigation, P05 presentation, P08 artwork/feedback or P18 qualification. The observed intro win is not proof of satisfying difficulty or enemy pressure. Physical controllers, touch devices, audio listening, offline/server-stopped behavior, BFCache, durable migration and the full mode/map matrix remain separate gates. Responsive desktop browser dimensions do not certify phones. Screenshots were inspected inline; no exported screenshots or hashes are invented.

At this checkpoint v0.60.9 is an **unpublished draft**, not a tested public edition. v0.61.0 continuation, integrated v0.61.1 media controls and Team v0.61.2 candidate retain their own qualification and release gates. See the [prioritized plan](planning/progress-and-next.md).

The [original-file manifest](retained-files.json) preserves failed or mistimed attempts, pending preparation records, the exact hosted receipt and all raw result rows. [Curation](CURATION.md) explains the finite copy and scope. Historical acceptance records remain unchanged.
