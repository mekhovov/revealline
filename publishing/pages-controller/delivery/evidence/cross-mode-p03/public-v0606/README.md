# v0.60.6 — shared Settings and quick Sound

**[v0.60.6 is accepted for the scoped Settings delivery](acceptance.json).** Solo, Versus and Team now group Controls, Audio, Appearance & accessibility and Game data consistently. Shared appearance changes remain immediate; Settings and sound controls preserve paused attempts and restore their invoking controls. This is a navigation and readability correction. **P03, full P05 and P18 remain incomplete.**

[Play v0.60.6](https://mekhovov.github.io/revealline/releases/v0.60.6/site/game/) · [Remaining phases](planning/progress-and-next.md)

| Gate | Recorded result |
| --- | --- |
| Frozen game source | `9c89f997cdbf0c8266fa65247832dcf2281d61ba`, tree `df6a6e83dcca0b4b55c402d6804538d0ea43ef37`; source [PR #94](https://github.com/mekhovov/revealline/pull/94). Both hosted families passed **5,673 tests / 452 files each**, with all six source gates, production/build and original freeze inspection recorded in the [qualification](tools/inputs/59734515e8a427bb68ac13bbdd71fff3a9abbf62/qualification.json). |
| Release | [v0.60.6](https://github.com/mekhovov/revealline/releases/tag/v0.60.6), release 391034651, published **17 September 2026 at 22:37:10 UTC**. All nine published original descriptors remain exact. [Published API original](published-release.actual.json). |
| Publisher / Pages | [PR #104](https://github.com/mekhovov/revealline/pull/104), main `59734515e8a427bb68ac13bbdd71fff3a9abbf62`, tree `54c9d0c0601549d86b905785f15b43af81e45941`; [run 35283812853](https://github.com/mekhovov/revealline/actions/runs/35283812853), deployment 6513676774, success status 18499160007. |
| Public files | **2,822 files / 639,924,677 bytes**, 2,822 attempts, **zero failed attempts or retries**, zero skipped or uninspected files. [Full report](tools/runs/complete-1/report.json) and [row reconciliation](public-row-review-complete-1.json). |
| Authorities after HTTP | [Fresh release, tag, source, publisher and deployment checks passed](after-http-authorities-main-1/result.json). |
| Public browser | [Root's scoped observations](public-browser/observation.json): Settings categories and return, shared Plain/Large, readable Game data, paused sound/Back in all three modes, portrait/short-landscape Settings and a legal Solo win. |

Solo title Settings opens with Appearance selected; Audio can be reached with category arrows, and reopening remembers the selected category for that visit. Team and Versus inherited the selected Plain/Large values. Their Game data readers returned to their actual openers. Closing Settings retained paused Team time/reserves and both paused Versus boards; Resume stayed explicit. Team departure cancellation also retained its paused round.

At 390×844 and 844×390, the checked Plain/Large Settings controls were visible without horizontal document overflow. First Signal produced a real **52.2% / 8,160-point / three-life / three-star win in 0:07**, with the full picture added to Collection. Settings → Escape preserved that result. A subsequent paused Solo attempt retained its elapsed time through a keyboard volume change and restoration; explicit Resume returned focus to the canvas. Original display/audio preferences and the viewport were restored.

The browser evidence is a **manual, scoped transcription of returned DOM snapshots and geometry**, not an exported raw session. Two screenshots were inspected inline; no screenshot files were exported. Some selects used semantic control selection, so this is not complete keyboard-only certification. Physical touch/controllers, assistive technology, audible listening, actual 200% zoom, offline execution and BFCache remain unverified. A normal earned Solo completion may remain in the disposable test profile; no player data was deleted.

Earlier failed original-upload attempts remain historical evidence. The accepted release retained the verified source asset and seven small originals while completing distribution; a later success does not establish the cause of earlier failures. Source tests, HTTP bytes, browser observations and physical-device qualification are separate evidence categories. No campaign, full theme, Team terminal win/Retry or whole-phase completion is claimed.

[CURATION.md](CURATION.md) and [retained-files.json](retained-files.json) record the finite original evidence. This delivery record changes no frozen game bytes, version, selector or release catalog.
