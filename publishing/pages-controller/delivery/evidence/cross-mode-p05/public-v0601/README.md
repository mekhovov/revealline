# v0.60.1 — Team controls stay visible

**Accepted for the named Team correction on 17 September 2026.** Changing text preferences keeps the focused Options control and its ring inside the menu. During play, the redundant header gives the complete arena, Pause and both touch pads room; opening the menu restores navigation. **P03 and P05 remain in progress.**

[Play v0.60.1](https://mekhovov.github.io/revealline/releases/v0.60.1/site/game/) · [Remaining phases and next work](planning/progress-and-next.md) · [Scoped root acceptance](acceptance.json)

## Actual delivery and verification

| Gate | Retained result |
| --- | --- |
| Source | `822f3290787c704a217e7c185d4b8beb7a527e82`, tree `88bd680e09210f9bf56ca18465fdb46afb2f1307`; [PR #81](https://github.com/mekhovov/revealline/pull/81) merged as `d650bd54e60b726e1fb7ec2fd15ee4570735ecc4` with the same tree. |
| Source qualification | Both hosted families passed **5,416 tests across 430 files each**, zero failures/skips. Repeated qualification families are not 10,832 distinct tests. [Original qualification](tools/inputs/c1576deeab14bea21b00449912a6a465c3efaf90/qualification.json). |
| Release | [v0.60.1](https://github.com/mekhovov/revealline/releases/tag/v0.60.1), ID `390577418`, published **09:31:48 UTC** with all nine original assets. [Original release metadata](published-original.json). |
| Publisher | [PR #82](https://github.com/mekhovov/revealline/pull/82); commit `c1576deeab14bea21b00449912a6a465c3efaf90`, tree `1ad1ded6774c1fa63b2a2c6cf7f19328facfb7b1`. |
| Pages | [Run 35206271586](https://github.com/mekhovov/revealline/actions/runs/35206271586), attempt 1, deployment `6499869218`, success status `18467370379`. [Original successful run](hosted-observation-after1/run.json). |
| Public bytes | **2,674 files / 638,988,304 bytes**, zero failures/retries/skipped or uninspected files. [Complete report](tools/runs/complete-1/report.json), [independent row reconciliation](public-row-review-complete-1.json). |
| Live authority | Source, release assets, tag, latest/current release and deployment remained unchanged after the complete audit. [Fresh result](after-http-authorities-after1/result.json). |

## Observed player journeys

[Original browser observations](native/observations.json) retain actual actions, dimensions, cleanup and limitations. The public Team Relay Yard journey covered keyboard Start → Pause → Options → Back → explicit Resume, text preference reflow, visible controls, and discard-confirmed return to Solo. It did not include a flight direction, Team victory or rescue.

- **Desktop 1280×720, Theme/Large, touch Auto:** complete 956×478 arena; Pause bottom 703.89 within 720.
- **Landscape 844×390, Theme/Large, touch Auto:** complete 296×148 arena; Pause bottom 373.89 within 390.
- **Options reflow in landscape:** the focused text-size control bottom 295.99 remained inside the scrolling overlay bottom 378. Gameplay stayed paused.
- **Landscape with both touch pads, Plain/Large:** complete arena, Pause and both pads; all eight direction targets remained 44×44.
- **Portrait 390×844, Plain/Large with both pads:** complete 362×181 arena; both pads ended at 799.52 within 844.

The operator restored Theme/Standard/Auto/default effects through actual controls and readback, reset the viewport, followed the retained v0.60.0 Explorer route and checked the stable current Play route. The initial selector key attempt that did not change Standard remains recorded; Space opened the native selector. Screenshots were inspected inline, not saved as fabricated image evidence.

This is responsive browser evidence, **not physical phone/finger/controller or 200% zoom qualification**. No fresh offline/progress migration, Team win/rescue, difficulty or whole-phase acceptance is claimed. The HTTP report deliberately retains `publicBrowserAcceptance: false`: it tests bodies/MIME; the separate native observations and root decision supply the scoped browser acceptance.

## Evidence and next work

[CURATION.md](CURATION.md), [retained-files.json](retained-files.json) and [curation-review.json](curation-review.json) describe the unchanged original copies, explicit duplicate aliases, pin closure and link checks. Historical preparation records retain their original pending status; this README and `acceptance.json` are the final scoped decision.

The [immutable source evidence ZIP](https://github.com/mekhovov/revealline/releases/download/v0.60.1/source-qualification-evidence.zip) and [already-committed Team source verification](https://github.com/mekhovov/revealline/tree/822f3290787c704a217e7c185d4b8beb7a527e82/docs/verification/cross-mode/p05-team-clearance) are referenced rather than copied again. [Archive 16 admission](https://github.com/mekhovov/revealline/tree/c1576deeab14bea21b00449912a6a465c3efaf90/publishing/pages-controller/evidence/archive-16/append-v0600) preserves v0.60.0 separately.

Practice/Playground readability and Undo integration lead next, followed by remaining navigation and supporting tools. Their candidate evidence does not become accepted through this Team release. The phase register keeps content production, physical input, playtests and later native/network work open.
