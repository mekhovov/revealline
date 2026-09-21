# Soundtrack integration on accepted v0.77 main

PR #209 was cleanly rebased onto accepted main `6f851d1bce4cb7d5f257546ab6ffd3c68231f08a`. The pre-rebase head `02b4925ed5e7d05b2162e8d3bdd0bcdbf9939997` is retained by `codex/soundtrack-v3-before-v077-rebase`; its green CI run `35567672135` is historical evidence, not qualification of this rebased source. The release controller explicitly reserved **v0.78.0** after confirming that no v0.78 tag or release existed. All four package/build version fields now agree.

## Integration repairs

- Conditional 44px music space keeps song titles and source links clear of Solo, Versus and Team handheld controls. Hidden credits reserve no space. The inherited Solo portrait header stacking issue is fixed without changing input handlers. Team Stronghold pads account for the objective text as well as the music rail.
- The shared Music Studio links to the separately published 70-track licensed MP3 preview archive. Opening Studio does not fetch or install this music; the built-in catalogue remains unchanged and empty.
- The upload guides now distinguish accepted v0.77's RLSTB1 reader from PR #209's additive RLSTB3 workflow. The dated YouTube follow-up identifies one of 77 UA-FPV recordings (two of 80 filename aliases), with redistribution permission still unverified.
- Field Kit preserves reviewed revision 48, appends source-stage 49 and independently reviewed 50, and retains all 127 original payloads unchanged. Team's exact metadata pins advance to 50 after verifying unchanged artwork bytes, identities and geometry.

## Evidence

- [Independent panel review](panel-review.json): final eleven-input audio fingerprint, the narrowly scoped discovery delta, 91/91 panel tests and explicit authorship/acceptance limits.
- [Independent handheld source review](independent-handheld-review.json): conditional layout, hidden states, Training, menu and header behavior, final CSS hash and reviewed 63/63 host test evidence.
- [Browser integration](browser-integration.json): actual in-app browser controls and DOM geometry at 390×844, 844×390 and 600×400; album import/save, explicit playlist, pause ownership, credits and the final Stronghold correction. Resized desktop viewports are not physical-phone qualification.
- [Production history](ledger/README.md): exact 48→49→50 preservation, 90/90 complete focused cohort, reproduction checks, and the retained first run with one stale expected revision.
- [Local check logs](checks/): validation, lint, both format checks, production reproducibility, 70/70 production utility tests, 60/60 music/touch host tests and 63/63 final stable-ledger host tests. The sparse-checkout failure and interrupted mixed-ledger run remain visible.

Raw logs retain their exact recorded bytes and hashes, including the linter's final blank line and whitespace in the failed TAP diagnostic. Source diff whitespace checks exclude only those two unchanged raw log files.

No soundtrack recordings receive listening approval from these checks. AI original production remains paused with **zero approved original recordings**. UA-FPV remains a private uploadable collection; all four packs retain 80 filename entries, 77 unique recordings and exact original bytes. The separate licensed archive's public-delivery receipt remains under `../music-publication-2026-09-21/`.

## Release gates after this source commit

Require committed-ledger readiness, fresh PR preflight/build/four shards, the separate hosted qualification/four shards, a frozen original snapshot and independent artifact inspection. Frozen-build browser/offline acceptance remains separate from the source integration evidence above. The release controller owns the subsequent controller/archive PR and Pages advancement; this worktree does not edit `publishing/pages-controller` or advance Pages.
