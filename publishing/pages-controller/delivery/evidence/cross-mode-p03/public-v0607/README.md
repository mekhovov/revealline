# v0.60.7 — clear disabled Replay actions and Team picture bindings

**[v0.60.7 is accepted for this scoped correction](acceptance.json).** At Replay completion, Play and Step remain visibly disabled even under the pointer, while enabled Restart stays distinct and receives focus. The two built-in Team missions again prepare their pictures against the exact active presentation revision. **P03, full P05, P08 and P18 remain incomplete.**

[Play v0.60.7](https://mekhovov.github.io/revealline/releases/v0.60.7/site/game/) · [Remaining work](planning/progress-and-next.md)

| Gate | Actual result |
| --- | --- |
| Frozen source | `a36d62f2fc3af67e3fffcafda3656c413ca77341`, tree `eaa76580e442311e87e6761a7d442f38f8f06652`; source [PR #96](https://github.com/mekhovov/revealline/pull/96). Exact source, six gates and hosted qualification remain in the [original qualification](tools/inputs/00a043d08c235422e9dbebef82dc5e0837da6667/qualification.json). |
| Immutable release | [v0.60.7](https://github.com/mekhovov/revealline/releases/tag/v0.60.7), release 391120699, published **17 September 2026 at 23:49:33 UTC**. [Published API original](published-release.original.json). All nine asset descriptors remain exact. |
| Publisher / Pages | [PR #106](https://github.com/mekhovov/revealline/pull/106), main `00a043d08c235422e9dbebef82dc5e0837da6667`, tree `53f7ddda49464f68a2dfc9112b46f8b8fda3eee6`; [run 35289348308](https://github.com/mekhovov/revealline/actions/runs/35289348308), deployment 6514586010, status 18501250583. |
| Full public inventory | **2,847 files / 640,138,824 bytes**, 2,849 attempts; two first-attempt HTTP503s recovered on retry. Zero failed, skipped or uninspected files. [Report](tools/runs/complete-1/report.json) · [Every result and attempt reconciled](public-row-review-complete-1.json). |
| Final authorities | [Fresh source, tag, release, assets and deployment checks passed](after-http-authorities-main-2/result.json) at **18 September 2026, 00:22:51 UTC**. |
| Public browser | [Root's scoped observations](public-browser/observation.json): complete Replay checkpoint, disabled hover presentation, same-edition return, and both Team picture-ready → Start → Pause journeys. |

Copper Crossing completed all **1,305 ticks**, displaying 10.88 seconds, 74.1%, three lives and 12,590 recorded points; checkpoint `861a6de2ffd7e119` matched and no player progress was awarded. Play and Step were disabled, muted and dashed. Restart was enabled with a solid border and received completion focus. A native pointer click over disabled Play left its hover colours and completed phase unchanged; Tab reached Back and Enter returned to Home with Start focused. This record does not claim an additional public Restart activation.

Relay Yard and First Connection each reached picture-ready state, then explicit Start and Pause with 0:00, 0.0% and three reserves. The Relay Yard screenshot showed its picture border, distinct actors and the wide arena behind the overlay. A discarded disposable attempt returned to its lobby without auto-start. First Connection's initial Home+Return select attempt did not change the selection; Space, Up and Return did. That limitation remains in the original transcription. No Team win, reward, slow-start injection or full map-matrix acceptance is claimed.

The two failed HTTP503 attempts remain in the original attempts log. The first final-authority refresh also correctly refused: publication had explicitly left GitHub's Latest pointer on v0.60.6. Root changed only that pointer to the existing v0.60.7 release; all nine assets, original publication time and tag stayed unchanged. [Initial refusal](refresh-failure-review.json) · [Pointer correction](latest-pointer-correction/review.json) · [Successful second refresh](after-http-authorities-main-2/result.json). No full HTTP audit was repeated or failure overwritten.

The browser record manually transcribes actual CUA actions, accessibility snapshots, screenshot inspection and read-only DOM results at 1280×720. It is not a raw session export; no screenshot files are fabricated. Physical controllers/touch, audible listening, offline, actual 200% zoom, BFCache, durable storage migration and broader player/content matrices remain separate. The accepted Archive20 route preserves independently playable v0.60.6 and v0.60.5; their existing loss/recovery and session-only limits remain in their own retention evidence.

[Curation](CURATION.md) and [original-file hashes](retained-files.json) distinguish immutable observations from this explanation. This delivery record changes no game bytes, version, selector, release catalog, workflow or skill.
