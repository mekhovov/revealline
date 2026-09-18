# v0.60.9 — readable Motion Lab values

**Accepted on 18 September 2026 at 03:07 UTC for the scoped motion-control correction.** The five motion sliders now keep their purpose labels stable and show current values with units. Native keyboard bounds, stepped changes and explicitly paused preview behavior passed on the actual public edition. **P03, P05, P08 and P18 remain incomplete.**

[Play v0.60.9](https://mekhovov.github.io/revealline/releases/v0.60.9/site/game/) · [Motion Lab](https://mekhovov.github.io/revealline/releases/v0.60.9/site/authoring/motion-lab/) · [Scoped acceptance](root-acceptance.json) · [Current plan and priorities](planning/progress-and-next.md)

## Delivered and verified

Rotor radius, character scale, background opacity, cruise speed and body turn response expose stable labels with matching percent, scale, cells-per-second or degrees-per-second values. Actual Tab/Home/Right/End/Left checks passed for all five. Selecting the two-blade recipe reset rotor radius to 16%; range and recipe changes preserved the paused preview. Immediate → Grid + buffer explicitly reset the preview and stayed paused; this was not a new full grid-steering qualification.

Actual browser checks covered Standard/Plain text, the shared Large preference, and 1280×720, 390×844 and 844×390 layouts. Focused controls were readable and narrow layouts had no horizontal document overflow. The public `/game/` entry opened the immutable v0.60.9 edition. A First Signal cut ended at 50.0%, 7,820 points, three lives and one star; its 1:54 clock included idle time before input. Full-picture viewing and returning to Results preserved score and focus. Retry reset time, coverage and score with three lives. Pause → Mission brief → Back preserved pause and restored its opener. This is onboarding and navigation smoke, not a measurement of challenge or enjoyment. [Original browser observations](public-browser/observations.json)

Both recorded source families passed **5,690 tests across 453 files**, six source gates, production and build checks for frozen source `628e95daf403082768cdcf900a8ea1d1ef4629a2`, tree `304acdf23c8ef9c465e61e8338b43a69aebfdca5`. Its qualification SHA-256 is `0b8fdff6a5946223b07a496b05a5ce1556a6b2b62f6f247100c64c6b6b407cd4`. [Source PR #100](https://github.com/mekhovov/revealline/pull/100)

GitHub release `391164971` was published at 02:22:35 UTC with all nine original assets. [Publisher PR #113](https://github.com/mekhovov/revealline/pull/113) merged controller `d5e131081764d7547fdfa9d749e3a73b296e19a5`, tree `4252be1dbbb867e335f99468655bde56d5efe196`. [Pages run 35300937871](https://github.com/mekhovov/revealline/actions/runs/35300937871) succeeded, creating deployment `6516490967` and successful status `18505659971`.

The complete public audit verified **2,897 files / 640,444,329 bytes**, including hashes and accepted content types, with **zero failures, retries or skips**. Every result and attempt was independently reconciled. Fresh post-audit API originals confirmed the same deployment, Latest v0.60.9, annotated tag, source tree and nine release assets. All 79 predecessor catalog entries remain unchanged, for 80 public versions and 21 admitted archives. [HTTP report](tools/runs/complete-1/report.json) · [Row reconciliation](public-row-review-complete-1.json) · [Fresh authorities](after-http-authorities-main-1/result.json)

## Remaining limits

- Resizing from portrait to short landscape can leave the existing rotor focus offscreen; Arrow Right changed its value without scrolling. Tab then Shift+Tab brought it back into view. Responsive focus visibility remains a correction.
- Exact `getByLabel("Animation recipe")` returned no match in the inspection tool, although the native accessibility tree exposed a named select and actual keyboard selection worked. Select labeling and assistive-technology behavior need separate review.
- No physical controller/touch, audible listening, offline/server-stopped, complete cross-mode, screen-reader announcement or human playtest acceptance is claimed. Motion Lab is a presentation playground, not proof of Tactical mechanics.
- Screenshots were inspected inline; no exported screenshots or invented image hashes are included.

The pending deployment observation and initial helper setup failure remain preserved. The unchanged Node self-check passed after the missing preparation-provenance record was supplied; the failed attempt was not removed. The predecessor v0.60.8 report retains its dated scope unchanged. [Evidence curation](CURATION.md)
