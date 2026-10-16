# Snake public release check — 15 October 2026

The remaining recommended public-site interaction check is complete. No new
runtime defect was identified, so this delivery adds evidence rather than
changing gameplay or adding another implementation phase.

## Source and integration

The clean task was moved onto freshly fetched main
`da0b0108206a0270b4b870e747f2d1bc0e6695cb`; a subsequent rebase confirmed it was
up to date. All earlier task commits, including PR #1233 and its integration
follow-up, are ancestors of main.

The observed public deployment is
`018bd53a09f1366b918f1184605fab215ccab1df`, which includes PR #1233. Pages
[run 38675850859](https://github.com/mekhovov/revealline/actions/runs/38675850859)
succeeded. This deployed revision and the local baseline have no differences in
Snake, shared theme-family controls, mode-settings CSS or industrial appearance
CSS. The delivered Snake host and shared appearance-control JavaScript token
sequences match the exact deployed Git source. Public deployment identity was
unchanged before and after those HTTP comparisons.

`public-release-observation-20261015.json` retains the deployment identity and
delivered-module hashes. No fresh full-distribution build or new automated-suite
count is claimed for this evidence-only change; existing validation receipts
retain their original source attribution.

## Public browser observations

1. **Entry and pause:** Open Loop entered gameplay directly. Pause focused
   Resume. Settings opened the shared categories and returned focus to its Pause
   opener without resuming the attempt.
2. **Appearance:** changing the paused board to Night Arcade and Freight updated
   the board and explicit URL. The shared Appearance section contains exactly
   one enemy-preset selector.
3. **Victory:** a verified unfinished Open Loop recording was loaded using the
   normal saved-round file input. It was generated from the existing
   `docs/verification/classic-snake/authored-open-loop.replay.json`, replayed
   through the production engine to move 92 of 93. The last ordinary simulation
   move completed the encounter. Celebration showed confetti, commentary and
   actionable Next/Try again/Home. Results automatically played the final-eight
   preview and showed a five-second next countdown. The untouched sequence
   advanced to Twin Islands.
4. **Cancellation and direct Next:** a repeat of that fixture-assisted completion
   used keyboard Tab during celebration. Results remained available without
   automatic continuation. Next then launched Twin Islands with one activation,
   at time zero and without a briefing. Imported progress was explicitly labeled
   “Recording · no new awards”; lifetime totals remained zero. This is a
   fixture-assisted flow check, not a new human victory or grading assessment.
5. **Selector:** the shared browser listed all 240 missions. Searching Signal
   Check and activating its card launched that mission directly. Pause then
   showed its new attempt at time zero.
6. **Ordinary defeat:** a fresh, live Signal Check attempt was allowed to hit the
   wall. Visible DOM observations captured impact/results, “Final 8 moves”,
   “Ready…”, and a new playing attempt at time zero. The sampled interval from
   first observed defeat to resumed play was **2,929 ms**. Replay began about
   685 ms after the observed defeat. This supports the approximately-three-second
   recovery target; it is one desktop sample with observation latency, not a
   statistical timing benchmark. Pause stopped progression and exposed usable
   controls. No victory confetti appeared in the observed failure flow.
7. **Compact layouts:** at measured `innerWidth=320`, `innerHeight=568`, document
   width remained 320. Result Next/Retry/Home stayed visible while secondary
   content scrolled. Ukrainian Appearance help and the single enemy selector
   fit the approximately 269px content width. The browser's existing zoom was
   accounted for with the viewport override; browser zoom itself was unchanged.
8. **Normal reload:** the same visited browser session reloaded the published
   game normally, preserving the explicit mission and appearance. Entry and
   Pause remained usable. Collected browser warning/error logs were empty.

Evidence files:

- `public-results-320-20261015.png`
- `public-settings-320-uk-20261015.png`
- `public-failure-trace-20261015.json`
- `public-release-observation-20261015.json`

The temporary viewport override was reset. This check did not clear browser
storage, delete profiles, inject application state or bypass the save importer.
It does not separately qualify service-worker upgrade recovery or all browsers.

## Closure and exclusions

All currently identified non-deferred implementation and public-site follow-up
items are complete. This report does not turn bounded inspection into a claim
that every device or every possible gameplay state is verified.

- Physical-device touch/controller/performance testing remains deferred.
- Player pacing, recognition and enjoyment feedback remains deferred.
- VoiceOver listening remains explicitly skipped and is not an acceptance gate.
- Additional silver/gold calibration remains optional; existing exact-setup
  budgets and completion-only policies remain unchanged.

No new mechanic, artwork batch or grading threshold is needed to close this
release check. Future changes should respond to a concrete defect or separately
approved improvement rather than reopening completed work automatically.
