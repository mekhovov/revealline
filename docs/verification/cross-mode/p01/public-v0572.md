# P01: v0.57.2 public verification and follow-up

Published on 2026-09-15; **P01 remains open**. The immutable [test release](https://mekhovov.github.io/revealline/releases/v0.57.2/site/game/) contains game source `cc9f8ffcc3be246f53ca0df7f068476d8401d040`, tree `f6ff808b2d7cf60c4295f99e24e65fa9a26d9ed4`. Publishing revision `d0288c502620bfa7a4a0861fbdbce1a60be183c5` deployed through [run 34999859343](https://github.com/mekhovov/revealline/actions/runs/34999859343), deployment `6464364805`.

Both complete hosted source families passed 4,228 tests and all six source gates. The ordinary build, production checks and frozen-artifact checks passed. These are hosted results, not a local full-suite claim. The public audit verified all 2,426 files / 636,869,407 bytes; one initial HTTP 503 succeeded on its bounded retry. Original frozen assets and historical versions remain unchanged.

## Public browser results

- A genuine First Signal playthrough completed at 50% / 7,820 points. Retry created a new authentic paused attempt. Its checkpoint and pinned artwork survived menu work and release navigation.
- Library reading feedback and cancellation stayed visible. After restarting the isolated browser, game-data and saved-attempt downloads completed. Large/Plain terminal details remained readable; PageDown reached the landscape message's actual bottom, and refocusing Export cleared the sticky rail.
- Controller Apply and Cancel restored focus to the actual Edit button. Tab reached Boost; reopening retained the applied PlayStation labels.
- Native keyboard type-ahead selected Large/Plain and changed glyph labels. Earlier arrow-only selections did not change values and remain recorded.
- The actual Explorer stylesheet response was HTTP 200, CSS MIME, 1,889 bytes, SHA-256 `7e9131637045630f440ed82782bf73c8077397b35fd12c23c64665894ad59f5e`. Its original response body is retained.
- Offline preparation and cold offline verification each checked 609 files / 55,440,584 bytes, with no missing or corrupt entries. Build ID: `6efb45e582f66e73936ba1370a352e7238bca13d7e7f84631a1b2c582103c809`.
- A fresh browser process through a refusing HTTP/HTTPS proxy restored run `4ce9f795-518d-4c7b-b521-0b3fc0c07dfe`, 196 ticks, checkpoint `4ac535eca3faa27e`, with identical artwork pins. Two observations 8.8 seconds apart stayed paused. Explicit Resume advanced the unfinished cut; another completed offline capture is not claimed. A subsequent proxy-free cold start and fresh network response verified online restoration.

## Required correction

Explorer → browser Back retained the saved attempt but exposed a speculative-picture failure after the profile writer had been released: “The profile writer no longer owns picture storage.” The next patch must cancel and fence stale preparation, retain readable pinned originals and session-only behavior, and explain actual recovery requirements. This finding is not fixed in v0.57.2 and blocks acceptance of that return journey.

File-input cancellation, Still Workshop opener focus and replay export placement are separately implemented follow-ups. Their working-source checks do not certify this frozen release. Transfer/recovery and the bounded authoring family also remain in the P01 checklist.

## Evidence and limits

[Review](public-v0572/review.json) and [original evidence bundle](public-v0572/evidence.zip): 214 original files / 51,040,094 bytes, excluding the retained browser profile. ZIP: 15,482,041 bytes, SHA-256 `27b78f1846ca9762300f7cc43f14881e117122710eaa5867b21099bcee33c51b`. The embedded manifest SHA-256 is `1ab664f16c344273f3a0809514b8e98f9f5c90e2be00168ca1257e908427bf5e`.

The first browser encountered an unexplained storage-query stall; cancellation and saved state were retained, then a fresh process completed exports. Its network observer also disconnected; the gap is explicit. Later network collectors stayed uncapped with zero page exceptions. Two separate mutation observers reached their caps, so later screenshots/direct measurements do not establish continuous mutation or painted-busy coverage. Retained evidence exceeded the launcher's 32 MiB reservation; its enforced free-space/profile checks are separate from that tooling limitation.

Early observations used Chrome's actual 500×701 viewport; explicit 390×844 and 844×390 measurements are identified individually. Unchanged manual-scroll observations and the partially scrolled portrait message are not full scroll proofs. Native keyboard activation with driver-selected focus is not exhaustive keyboard navigation. No physical phone, touch-only journey, physical controller, audibility or whole-game accessibility acceptance is claimed. All owned browsers, observers and the refusal proxy were closed and verified before source changes resumed.
