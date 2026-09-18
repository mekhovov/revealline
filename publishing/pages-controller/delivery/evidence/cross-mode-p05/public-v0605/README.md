# v0.60.5 — Motion reading and preview recovery

**[v0.60.5 is accepted for the named Motion correction](acceptance.json).** Motion Lab follows shared reading settings, preserves deliberate preview controls, shows the still/default APNG image and offers an actionable Retry after setup failure. Matching authoring guides, AI skills and prompts are included. This release adds no campaign, enemy mechanic, save format or score authority. **P03, full P05 and P18 remain incomplete.**

[Play v0.60.5](https://mekhovov.github.io/revealline/releases/v0.60.5/site/game/) · [Motion Lab](https://mekhovov.github.io/revealline/releases/v0.60.5/site/authoring/motion-lab/) · [Remaining phases](planning/progress-and-next.md)

| Gate | Actual result |
| --- | --- |
| Exact game source | `a336f18306a425f6575b77a3017056d32155043f`, tree `b80ee2c1ccf455609a6834af14c6760ecce868e3`. Both complete hosted families passed **5,582 tests / 444 files each**, with no failures or skips; source/production/build and frozen-original inspection passed. [Original qualification](tools/inputs/e5cb0114bbb80ef53319938b6cad99eb42cd8273/qualification.json). |
| Source review | [PR #93](https://github.com/mekhovov/revealline/pull/93), merge `3f94acc62cf6d85fd7c930616747e524e06f8d63`, preserves the qualified source tree. |
| Frozen release | [v0.60.5](https://github.com/mekhovov/revealline/releases/tag/v0.60.5), release 390920301, published **17 September 2026 at 19:25:17 UTC**; nine original assets. [Published original](published-release.original.json). Earlier failed transfers are retained; the reason the final attempt succeeded is unproven. |
| Publisher and Pages | [PR #97](https://github.com/mekhovov/revealline/pull/97), publisher `e5cb0114bbb80ef53319938b6cad99eb42cd8273`, tree `017e34b0b9552cbc95af934ff547f961d4a51617`. [Pages run 35266528525](https://github.com/mekhovov/revealline/actions/runs/35266528525), deployment 6510802918, successful status 18492655321. |
| Actual public files | **2,790 files / 639,724,180 bytes**, 2,790 attempts, **zero failed attempts or retries**. [Report](tools/runs/complete-1/report.json), [results](tools/runs/complete-1/results.jsonl), [attempts](tools/runs/complete-1/attempts.jsonl), [independent row review](public-row-review-complete-1.json). |
| Fresh authority review | [Release/tag/source/publisher/Pages identities stayed unchanged](after-http-authorities-main-1/result.json) after the public audit. |
| Public browser | [Root's scoped original observations](native/root-observations.json) cover Workshop → Motion, preview Pause/Play, shared reading preferences, red APNG default image, invalid-upload retention, Clear/return and the retained v0.60.4/Release explorer routes. |

The observed preview initially followed its authored autoplay. Explicit Pause stopped travel; Play resumed it. The public still-image check used the owned 377-byte APNG fixture, whose red default lies outside its blue/green animation. Its poster remained red through playback and reading redraw. A failed eight-byte PNG retained the preceding preview. Game Display changes in another tab propagated Plain/Large/reduced effects to Motion without treating local and shared reduced-effects choices as the same setting. Preferences and temporary tabs were restored. A truthful session-only saving notice from temporary same-origin tabs cleared after those tabs closed and the current game reloaded.

**Known P05 follow-up:** changing a range can leave an outdated accessible output name: Background opacity announced its initial 0.28 while the visible value was 70%; Body turn response retained 360 while showing 540. Correct these names in a new version; do not overwrite v0.60.5 or claim complete accessibility from this scoped acceptance.

The browser check used native keys, chooser activation and visible control selection. It is not a complete keyboard-only or physical-controller/touch certification. Explicit Pause/Play did not establish actual blur/visibility interruption or BFCache. No public new victory, fresh offline/migration, full responsive/200% zoom, audible music listening or all-mode acceptance is claimed. The local forced 503 → Retry proof remains source-local; no failure was injected into the public server. Retained v0.60.4 reached its title and explorer without resuming its old flight.

Source qualification, release assets, public byte verification and browser evidence remain separate. GitHub's server-side immutable flag was false at publication; the project retains its existing no-overwrite/versioned-release policy. Settings v0.60.6, Replay v0.60.7 and navigation/backup v0.60.8 are separate candidates. Their evidence does not enlarge this release's scope.

[CURATION.md](CURATION.md) and [retained-files.json](retained-files.json) identify the finite original evidence. This delivery changes reports and current-status summaries, not the frozen game, selector or version.
