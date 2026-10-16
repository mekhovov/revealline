# Snake shared appearance integration — 14 October 2026

This follow-through rebases the clean task branch onto main
`07cf04c4052b1118b644f63809ef6840acb45e08`. It checks the newer Battlefield
appearance controls against the completed Snake remaster. Physical-device
testing and player feedback remain deferred by request.

## Corrections

Snake mounted Enemy appearance twice: once in its own Display & appearance
disclosure and once in the common Appearance section. The shared section now
owns the only selector. Snake supplies its existing preset callbacks through an
optional adapter; other hosts retain the shared default. Localization and
subscription disposal remain owned by the shared component. Accepted artwork
still survives Retry and Continue; changing the future preset does not replace
the current attempt's accepted artwork.

The 320px browser inspection also found that intrinsic control widths pushed
appearance help text outside the scrollable panel. This is tracked in this
batch's shared responsive correction: the Appearance grid uses a shrinkable
column and bounded children; shared settings selects can shrink below their
longest option. This also fixes the Ukrainian Character cast selector inside
Snake's moved disclosure. Both fixes live in canonical shared CSS.

## Integration and browser evidence

- Explicit Battlefield links override saved cosmetic preferences. Automated
  coverage also checks saved preference restoration, paused appearance changes,
  refreshed mission cards, and completed-board replay without replacing the
  simulation or its exported replay.
- A local Signal Check entry opened directly. Pause focused Resume. Opening
  settings and changing the board from Battlefield to Atmospheric Ruins and
  the scene to Freight preserved the paused attempt. Switching back to
  Battlefield/Alpine updated the explicit URL immediately.
- At desktop width, Back returned to Pause and focused its Settings opener;
  Tab then reached Fullscreen. Choose mission opened the common 240-mission
  selector with Signal Check selected.
- At 320×640, settings use the shared two-level navigation: Back returns from
  the selected category to the category list, then to the pause opener. The
  pause actions fit and remain reachable. This is desktop viewport emulation,
  not a physical phone test.
- English and Ukrainian labels update in place, including the single Enemy
  appearance selector and its help. The shared Covered ground control explicitly
  explains that Snake uses its separate Board appearance setting.
- After correction, the shared Appearance controls and help fit inside the
  268px content width (left 26, right 294). The Ukrainian Character cast
  selector also measures 268px instead of 278.5px. Document width remains
  320px. Evidence: `appearance-settings-320-en.png`,
  `appearance-settings-320-uk.png`, and `appearance-board-controls-320-uk.png`.

## Validation

- 116/116 full Snake host tests.
- 22/22 shared appearance, Battlefield, world and terrain-cache tests, including
  the 240-mission traversal and 16 MiB retained-surface checks.
- 54/54 shared mode-shell and optional FPV package tests.
- 23/23 theme-system tests and 6/6 shared settings tests.
- Canonical shared play-shell and presentation outputs regenerated and checked
  byte-identical. Presentation generation follows play-shell generation because
  they update the same optional SIM style projection.
- Focused ESLint, formatting and whitespace checks pass.

The focused commands use `node --test` with `classic-snake-ui.test.mjs`,
`theme-picker-materials.test.mjs`, `classic-battlefield-art.test.mjs`,
`classic-snake-worlds.test.mjs`, `classic-snake-world-cache.test.mjs`,
`mode-play-shell.test.mjs`, `theme-system.test.mjs`,
`mode-settings-view.test.mjs` under `game/test/`, and
`scripts/test-optional-fpv-package.mjs`. The five groups above total 221 passing
tests with no skips. No browser screenshot is counted as an automated test.

This batch changes no translation keys, mission recipes, progression, enemy
rules, grades or transition ownership. No fresh full distribution build is
claimed: the earlier 3,277-file archive receipts retain their exact source
attribution. Disk preflight showed approximately 2 GiB free; no source, saved
data, commits or local assets were deleted for this pass.

## Remaining evidence and policy

- Physical touchscreen/controller/performance qualification remains deferred.
- Player recognition, pacing and enjoyment feedback remains deferred.
- VoiceOver listening is skipped by explicit user request. It is not a remaining
  acceptance gate for this delivery. Spoken screen-reader behavior remains
  unverified; accessible labels, focus and automated change-only announcement
  coverage are separate evidence.
- Additional silver/gold thresholds remain optional. The existing 375 graded
  setups and 1,065 completion-only setups are unchanged; the prior evidence does
  not justify inventing more thresholds.

These are qualification boundaries and optional extensions, not additional
mission or artwork implementation work. A new PR delivers this integration
correction independently of the merge queue.
