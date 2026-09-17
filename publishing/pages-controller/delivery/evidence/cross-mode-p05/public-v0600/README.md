# v0.60.0 — Studio and Replay readability accepted

[Play v0.60.0](https://mekhovov.github.io/revealline/releases/v0.60.0/site/game/) · [Studio](https://mekhovov.github.io/revealline/releases/v0.60.0/site/authoring/asset-studio/) · [Replay Theater](https://mekhovov.github.io/revealline/releases/v0.60.0/site/game/replay-theater/) · [Updated phase register](planning/progress-and-next.md)

**Complete: the named Studio/Replay readability delivery within P05. The full P05 and P03 phases remain in progress.** Studio and Replay now share Theme/Plain text, Standard/Large size and reduced-effects preferences. Studio keeps original font specimens and draft ownership separate from its interface; Replay preserves the recording and playback position while improving startup, jump, completion and return focus. No simulation, score or replay-format change is included.

Source [PR #78](https://github.com/mekhovov/revealline/pull/78) and publication [PR #79](https://github.com/mekhovov/revealline/pull/79) are merged. The independently playable [v0.59.1 predecessor](https://mekhovov.github.io/revealline-archive-15/releases/v0.59.1/site/game/) remains available through the Release explorer. Neither old release bodies nor tags were overwritten.

| Gate | Accepted evidence |
| --- | --- |
| Frozen game | `170508f11dd41204b7e24917a823f21701c15961`, tree `287ea0fddf97f594af0ce9eba452a24dc5f507c7` |
| Source qualification | Two complete hosted families passed **5,399 tests each**, all six source gates, production reproduction/readiness and ordinary build. These are repeated complete runs, not 10,798 different tests. [Original qualification](https://github.com/mekhovov/revealline/releases/download/v0.60.0/source-qualification.json) |
| Published game | [v0.60.0 release](https://github.com/mekhovov/revealline/releases/tag/v0.60.0), release ID `390511341`, nine original assets |
| Pages | Publisher `0d1f8a281a3c01768e69ac7a7de05094d03f0ee7`; [run 35196541650](https://github.com/mekhovov/revealline/actions/runs/35196541650); deployment `6498129383`; successful status `18463307492` |
| Actual public bytes | [Complete report](tools/runs/complete-1/report.json): **2,649 files / 638,838,205 bytes**, no failed, skipped or uninspected files. One HTTP 503 and its successful retry are preserved. [Independent row reconciliation](public-row-review-complete-1.json) |
| Live authorities | [Post-audit refresh](after-http-authorities-main-1/result.json): latest/current release, all nine assets, tag, source and deployment unchanged |
| Actual browser | [Observed public journeys](native/observations.md): Studio font specimens and keyboard selection, shared preferences, Replay play/pause/jump/completion/return, Collection return focus, and current/predecessor routing |

The public Replay completed all 1,305 recorded ticks with final checkpoint `861a6de2ffd7e119`, moved focus to Restart and granted no player reward. Changing display preferences while paused preserved tick 512. Original Theme/Standard/reduced-off preferences were restored; the existing Studio document was not edited or saved.

Team's focused Large-text selector and live-screen space correction is the next scoped release candidate. Controller Practice and Playground follow. The [phase register](planning/progress-and-next.md) distinguishes accepted releases, partial foundations, local candidates and remaining content.

The source and browser records have different scopes. This release does not certify real controllers/touch devices, Safari, disconnected use, save migration, a controlled browser restart, human challenge/replay value, all supporting routes or the remaining campaigns. The 132-mission programme remains future work. Native stores and online multiplayer retain separate gates.

[acceptance.json](acceptance.json) binds the scoped decision. [retained-files.json](retained-files.json) records exact copied originals and [CURATION.md](CURATION.md) explains the evidence boundary. Earlier records retain their original pending labels; the later scoped decision does not rewrite history. The release is frozen by project policy; the GitHub API's immutable-release flag was false and is not claimed otherwise.
