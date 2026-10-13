# Compact shared game chooser — 13 October 2026

## Completed

- Primary chooser: Solo, Team, Duel, More. English Duel and Ukrainian Дуель replace the abbreviated VS label; internal mode IDs and saved-game routes remain unchanged.
- More expands to two rows of three game icons: Solo / Team / Duel and Snake / Survive / SIM, followed by a compact collapse control. Secondary-mode homes start expanded so the active mode remains visible. Collapsing them returns focus to More.
- Survive (Вижити) replaces Overflight in the shared chooser and player title. Survive and SIM carry visible and accessible beta labels.
- The separate Raid shortcut is removed from the shared landing. Survive's operation cards, including Raid, remain available inside its Settings rather than on Home.
- Shared native buttons/links preserve pointer, touch, Tab, Enter/Space, keyboard, controller/D-pad and radio-adapter activation. More exposes aria-expanded and aria-controls. Hidden destinations leave the active navigation path.
- Horizontal traversal follows the visible choices and wraps. Down from a selected mode retains Start/Continue → Missions → Settings → Sound → Fullscreen → selected mode. If the active secondary mode is collapsed, the final step returns to More. Expanding More focuses the first available secondary choice; Down from expanded More also enters the extra choices.
- Escape/Back from the chooser collapses it. Nested Settings, paused flights and result screens retain their original Back behavior; the disclosure cannot steal a different surface's focus.
- Hover does not impersonate the selected mode. Shared utility text fits narrow Ukrainian layouts without splitting words into single letters.
- The canonical changes are projected into standalone SIM assets with the existing generators.

## Verification

The focused source/host regression command is recorded below. It covers the shared chooser, all six active-mode navigation states, native modal/Tab behavior, Snake, Academy, Worlds, Gym, fullscreen, Survive input/presentation, appearance handoff and optional-core admission.

```sh
node --test --test-concurrency=2 \
  game/test/mode-choice-view.test.mjs \
  game/test/mode-choice-appearance.test.mjs \
  game/test/mode-play-shell.test.mjs \
  game/test/couch-shell.test.mjs \
  game/test/civilian-practice-ui.test.mjs \
  game/test/native-landing-structure.test.mjs \
  game/test/native-landing-fullscreen.test.mjs \
  game/test/classic-snake-ui.test.mjs \
  game/test/fpv-flight-ui.test.mjs \
  game/test/fpv-world-appearance-ui.test.mjs \
  game/test/overflight-host.test.mjs \
  game/test/overflight-controller.test.mjs \
  game/test/overflight-raid-presentation.test.mjs \
  scripts/test-optional-core-tools-boundary.mjs
```

Final combined result: **293 passed, 0 failed, 0 skipped**.

ESLint passed for changed authored JavaScript. Both SIM generators verify byte-identical output. Localization validation passed for English/Ukrainian (13,029 messages, 9,026 references). `git diff --check` passed.

Real in-app browser observations used the isolated local origin `http://127.0.0.1:8789`:

- Team: collapsed and expanded English/Ukrainian chooser at 320 × 740; Escape restores More; keyboard enters Survive with the current locale.
- Survive: current beta mode is visible in the expanded chooser; Down reaches Start; Raid is absent from Home and present in Settings.
- SIM Worlds: exact six-step Down loop, Escape collapse and Enter expansion; 740 × 360 landscape has six choices in two rows and no document horizontal overflow.
- Snake: Ukrainian 320 × 740 layout; exact six-step Down loop and Escape collapse; left from More then Enter opens Duel.
- Duel: Ukrainian collapsed row and keyboard expansion, exact six-step Down loop; 1280 × 800 expanded layout has six choices and no document horizontal overflow.

## Remaining / limitations

- Physical controllers, radio transmitters and touch hardware were not available for this run; controller input is covered by simulated host tests. Responsive browser inspection does not claim physical-device qualification.
- Solo's fresh browser preview stopped at its existing password gate. The gate was not bypassed; shared/native source tests cover its chooser integration.
- No full distribution ZIP, retained-client upgrade or installed-offline acceptance was performed for this UI batch.
- Existing authored mission/campaign names, internal Overflight/versus identifiers and creator archive titles are retained. This change renames player-facing chooser/host labels, not stored content identities.
- Broader menu roadmap work, historical worktree recovery and unrelated local gameplay changes are outside this branch.

## Screenshots

![Team expanded in Ukrainian at 320px](team-uk-320.png)

![Snake expanded in Ukrainian at 320px](snake-uk-320.png)

![SIM expanded in Ukrainian short landscape](sim-uk-landscape.png)
