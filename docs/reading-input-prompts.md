# Reading prompts follow the current input

The Solo reader now describes the controls the player is using. Keyboard entry previously displayed “South or East returns” even though Enter, Space and Escape already ended reading. This successor changes the prompt, preserving the existing action handlers and focus/reading ownership.

| Input                  | Scroll prompt when needed | Exit prompt                          |
| ---------------------- | ------------------------- | ------------------------------------ |
| Keyboard               | Up/Down scroll            | Enter, Space or Escape returns       |
| Controller             | Up/Down scroll            | Current mapped Confirm or Back names |
| Touch or mouse/pointer | Scroll to read            | Done reading returns                 |

Short regions say all text is visible. Home/End/PageUp/PageDown remain available to keyboard readers; Tab relinquishes reading without restoring the origin. Enter, Space, Escape, mapped controller exits and Done retain their existing one-action behavior. Returning never starts or resumes the flight. Touch/mouse copy describes the stable Done button; it does not add a gesture handler.

Both existing reading adapters accept an optional `getReadingPrompt({scrollable})`. Hosts that omit it retain their prior mapped-controller wording. Solo provides one function using current input modality and applied controller labels. Navigation exposes `refreshReadingHint()` to republish an already-current hint only. It checks foreground, root, scope, visible region and Read origin, active focus and unchanged content; it does not sync, refocus, enter or cancel reading. Existing sync still owns invalidation.

The first keyboard arrow in controller reading executes before the native-input notification. Solo therefore refreshes the active hint after changing modality, and after refreshing mapped labels. Native Enter on a button remains browser-owned: its default click follows the keyboard notification. The finite host fixture explicitly models that default, rather than adding a production click handler.

[Xbox Accessibility Guideline 112](https://learn.microsoft.com/en-us/xbox/accessibility/xbox-accessibility-guidelines/112) supports clear exit prompts and consistent input paths. It is design guidance, not an accessibility certification for this change.

The [retained evidence](verification/cross-mode/p03-reading-prompts/README.md) binds exact `1f3b9995` source plus this narrow successor. The three complete navigation, reading-helper and actual-Solo-host files pass 78/78 on Node22 and Node20; all 230 inputs and the semantic index remained unchanged. Seven new host cases cover keyboard exits, first-key switching, remapped controller Back and touch Done; two adapter cases cover optional/default-compatible prompts and neutral/stale refresh. Tests preserve the actual simulation checkpoint and stored profile.

The original fixture-only Enter failure, corrected wrong-copy failure and passing successor are separate records. A later [native supplement](verification/cross-mode/p03-reading-prompts/native/README.md) observes actual keyboard and pointer Mission brief behavior on checkpoint `6727d83e`: truthful hints, first-key switching and Read-focus restoration while paused. It retains five records and three root-inspected JPGs, with all twelve source responses unchanged before and after. The initial accessibility/DOM route ambiguity remains unresolved. Physical touch/controller use, scrollable reading, zoom, full-source qualification, current P01/P02 integration and phase/public acceptance remain open; other P03 journeys and P07 progression stay separate.
