# UX4 — direct Team difficulty recovery

## Player result

After a terminal Team failure, Retry remains the focused primary action. The former
generic **Change setup** action is labelled **Change difficulty** and returns to the
same arena with **Arena & team options** expanded and the difficulty selector focused.
The player can choose Gentle, Standard, or Expert and then start deliberately. The
action does not change difficulty or begin another attempt by itself.

Pause and victory continue to use **Change setup**. Running and paused attempts keep
their existing discard confirmation and explicit Resume behavior.

## Input and ownership

The action remains a native button in the shared Team result navigation scope, so it
uses the existing keyboard, controller, and touch activation paths. Returning to the
lobby uses the same foreground, generation, and focus-ownership checks as the existing
setup handoff. A newer pointer, keyboard, focus, visibility, or page-lifecycle action
prevents the old handoff from reclaiming focus.

## Evidence on the feature source

- Complete `game/test/coop-host.test.mjs`: 78/78 pass.
- The new terminal-failure case proves Retry receives initial focus, keyboard traversal
  reaches Change difficulty, the same arena and selected difficulty are retained, the
  optional setup is expanded, and focus lands on the difficulty selector.
- `npm run lint`, `npm run format:check`, `npm run format:native:check`,
  `npm run validate`, Motion Lab syntax, localization generation/check, and
  `git diff --check` pass.

The repository's committed temporary release policy waives the long suite. It is not
claimed here. Physical controller, touch hardware, Steam Deck, and public Pages checks
remain release acceptance work.
