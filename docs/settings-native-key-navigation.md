# Settings keyboard navigation after Ukrainian startup

## Behavior and bounded fix

The Settings category strip already advertises Home/End navigation. Its accepted-key set incorrectly contained translated Home/End labels created at module initialization, while selection handled literal browser keys. After Ukrainian startup, physical Home/End were rejected; switching back to English could not repair the captured set. Left/Right continued to work.

Keep `KeyboardEvent.key` protocol identifiers literal: `ArrowLeft`, `ArrowRight`, `Home`, `End`. Translate player-facing labels independently. This changes neither key bindings nor tab ordering, controller polling, gameplay, save formats, menus or selected preferences. Existing visibility, ownership, modifier and native-input guards remain authoritative.

[MDN’s keyboard key values](https://developer.mozilla.org/en-US/docs/Web/API/UI_Events/Keyboard_event_key_values) documents these navigation identifiers. [W3C’s tab pattern](https://www.w3.org/WAI/ARIA/apg/patterns/tabs/) describes optional Home/End first/last-tab behavior and wrapping horizontal arrows. This patch restores the game’s existing behavior; it does not certify accessibility compliance.

## Maintenance prompt

“Start in Ukrainian before importing the Settings module. Open a middle Settings category and press physical Home then End. Repeat after EN/UA changes. Verify first/last enabled category, matching focus and exactly one visible panel; modifiers, native text editing and unrelated keys keep their existing owners. Compose with the shared controller navigation adapter to prove one navigation action, not two. Pause a legal off-center grid turn, navigate Settings, Back and explicitly Resume; compare exact paused checkpoints and stored bytes. Keep browser component evidence distinct from full-game and physical-device acceptance.”

## Delivery boundary

Based on current main `bb9b3640270dc26633d37cfdf4a306aecda277b6`, preserving merged #741 and #750. This is independent of reviewed #742 and #748 and does not rewrite them. No new locale keys or generated-catalog changes are needed, reducing next-batch integration conflicts.

The release coordinator owns allocation, integration, immutable freeze and Pages publication. This unversioned source input is not a public release. See [current completed/remaining checkpoint](plan-status-2026-09-28-native-keys.md).

## Scoped verification

235 navigation checks and one cold-Ukrainian paused Solo host check pass. The original component reproduces four failures; the local browser confirms Home/End recovery. See [evidence and limits](verification/settings-native-keys-20260928/README.md).
