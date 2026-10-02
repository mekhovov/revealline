# Theme registry and collection expansion — 2026-10-03

Added three original families through the shared interface, Arcade, and SIM contracts: Pocket LCD (sage/ink handheld palette), Copper Observatory (petrol/copper/ivory), and Sakura Station (warm porcelain/plum/cherry red). Each family has complete semantic asset/model/material/effect references. Existing procedural models and protected geometry remain the source; these are additional coordinated material/texture collections, not three new model libraries.

Vyshyvanka's unpublished current revision is `r2`, with near-black `#08090a` / `#121314` / `#1c1d1e` surfaces, saturated crimson `#d3222a`, neutral warm-gray ordinary control borders `#867671`, and ivory text `#f3eade`. Primary/selected controls pair crimson with white (5.21:1); focus uses crimson (3.24:1 on the raised surface); ordinary links use the readable light text token. The previous coral candidate was rejected during browser review and is not the final palette.

The current Classic Field Kit registry label uses `legacy@r2`. Its interface descriptor differs from `legacy@r1` only by name/revision, and retains null Arcade/SIM bindings. Exact r1 family and interface documents remain installed. Runtime adoption of the r2 declared palette is separately reviewed in the controls/UI evidence.

## Revision compatibility

- `vyshyvanka@r2` binds interface r2 and Arcade r2. Its SIM binding stays r1 because the existing enamel and ornament source is already red; no existing SIM asset revision was overwritten.
- `vyshyvanka@r1` retains its original interface and Arcade bindings. Interface JSON SHA-256 remains `8f5f4ff894c663d0960bb9764974380fffd7f5ac833b4b86fba370f619190c21`.
- The SHA-256 of the concatenated original r1 Arcade sprite RGBA frames remains `bb519487441bb54ff778aab392265b24c3ca4b9179b773c5af65fd1398f19981`.
- Arcade rendering now resolves its exact family/interface reference, so a newer interface cannot silently recolor an old Arcade collection. Existing Industrial r1 continues using its original palette object.
- All three new families use interface/Arcade/SIM r1. Their masks preserve source dimensions and alpha; original media and gameplay geometry remain unchanged.

## Automated checks

`registry-and-collections-focused.tap` records 55/55 passing tests across the new compatibility suite, Arcade behavior, SIM workshop visuals, SIM family controls, objective cue/label rendering, and shared theme contracts. The SIM cohort checks all eleven collections across all existing environment families, protects course data/exterior scenery bounds, and verifies eleven distinct enamel luminance motifs rather than accepting only palette recoloring.

For normal presentation, the minimum normal text/supporting text contrast across ink, panel, and raised surfaces is:

| Family             | Normal text | Supporting text |
| ------------------ | ----------: | --------------: |
| Pocket LCD         |      7.62:1 |          4.73:1 |
| Copper Observatory |      9.85:1 |          6.51:1 |
| Sakura Station     |     11.11:1 |          5.72:1 |

Explicit primary/selection/input/error/success pairs and every component state pass normal and high-contrast checks. Focused ESLint and `git diff --check` pass. The source tests do not replace actual browser visual review, physical-device checks, full flight-distance review, or a performance qualification for the new collections.

## Calibration initialization repair

Browser review exposed an existing calibration-page failure: its environment menu included Adventure environments, but its course lookup only included Academy and World courses. The first Coastal Airfield selection therefore passed an undefined course to the renderer. The page now includes Adventure courses, offers only environments with courses, explicitly selects a valid initial course, and repairs stale environment/course selections while retaining a valid explicit choice.

`calibration-course-coverage.tap` records 10/10 acceptance-workflow and Asset Studio build checks. The new test runs the actual calibration entry source with real catalog data and Three.js scene objects at a mocked WebGL boundary. It verifies initial rendering, every current environment and its complete course list, valid-choice preservation, stale-choice recovery, course immutability, and teardown. It does not claim pixel-level or GPU validation. Current visible collection descriptions were generalized; historical measured counts were left unchanged.
