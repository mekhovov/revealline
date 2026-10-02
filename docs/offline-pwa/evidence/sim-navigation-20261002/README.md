# Direct SIM navigation — 2026-10-02

Baseline: `origin/main` at `3f16c1d53`. This is a focused navigation change;
ongoing SIM content, controls and physics work stays independent.

## Behavior

- The shared Solo/Versus/Team mode selector checks the bundled SIM entry and
  opens it directly in the same window. A normal successful launch does not
  display the package-selection dialog or initiate an offline download.
- If the bounded entry check fails, the existing recovery panel offers retry,
  optional **Install & offline play**, and **Back to game**. Players can leave
  the panel without downloading anything. A later check cannot navigate after
  cancellation or after the player chooses another action.
- **Back to game** appears in the SIM header and flight menu. It retains the
  original game mode/community, query and fragment. Return addresses are limited
  to admitted game pages on the same origin and edition.
- A direct SIM visit receives a game fallback. Separately published SIM archives
  return to the public game root, because they do not contain an arcade copy.
- Leaving an active flight pauses it and awaits the existing recovery-save path
  before navigating. Existing recovery eligibility rules still apply.
- Return anchors receive their validated destination at mount time. Arcade pages
  are not pulled into the independent SIM package's dependency closure.

## Manual evidence

Used the production entry controller through
`game/test/manual/sim-navigation.html`, then the real SIM at localhost:8897 in
the Codex in-app browser. No arcade access gate was bypassed.

1. Clicked SIM: navigated directly to World SIM with `#learn` and
   `game-return=/game/?journey=legacy`; no intermediate dialog appeared.
2. Inspected 393 × 852 portrait and 852 × 393 landscape headers. The exit is
   visible and other controls wrap without horizontal overflow.
3. Started lesson 01, selected **Let's fly**, opened **Menu**, and selected
   **Back to game**. Navigation returned to `/game/?journey=legacy` and displayed
   the game loader. This proves navigation, not completed flight restoration.
4. Used the fixture's rejected-fetch mode to inspect unavailable recovery.
   The optional download link was present; dismissing restored the SIM button.
   This is a simulated failure, not a full offline-device qualification.

Screenshots: [portrait](portrait.png), [landscape](landscape.png),
[flight menu](flight-menu.png), [unavailable recovery](unavailable.png).

## Validation and limits

- ESLint, repository validation/localization and changed-file Prettier passed.
- Repository-wide formatting still reports four unchanged baseline files:
  `game/editions/runtime-assets.json`, `game/test/fpv-world-content.test.mjs`,
  `scripts/test-fpv-content.mjs`, and `scripts/test-main-pages-profile.mjs`.
  All four are byte-identical to baseline HEAD; this PR does not reformat them.
- Full in-memory package build evidence is recorded in `build-summary.json`.
- Added regression cases for direct launch, failed entry, cancellation, and
  return routes across arcade modes and communities.
- Automated test suites: **WAIVED_SKIPPED_NOT_PASSED** under
  `publishing/test-policy.json`; these regression cases were not executed.
- Physical iPhone/iPad standalone testing remains required. Responsive browser
  checks do not establish Safari safe-area or offline-download qualification.
- Release planning target: `v0.150.0 — Unified native experience`; a queued PR
  is not a deployed fix. Frozen releases remain unchanged.
