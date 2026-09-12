# After controller reading: optional Boost toggle

Reviewed 12 September 2026 against the v0.12.0 working source. **Proposal only; no input, preference or simulation change is implemented by this note.** Finish the reader increment before taking this bounded follow-up.

Recommend a player-selectable **Controller Boost: Hold / Toggle**, with Hold as the default. [The router](../game/ui/controller-router.mjs) currently forwards the selected button's held state. Remapping changes that button but not the duration requirement. [Touch input](../game/ui/input.mjs) already has its own Boost latch in Tap steering, so that existing feature should remain intact.

Microsoft's [XAG 107 — Input](https://learn.microsoft.com/en-us/xbox/accessibility/xbox-accessibility-guidelines/107), reopened on 12 September 2026, distinguishes remapping from sustained-hold barriers and recommends considering toggles or automatic holds for prolonged actions. It also calls for alternatives to preserve the default action's functionality. Only the page's text was inspected; its embedded videos and screenshots were not viewed. This supports the proposed option, not a claim of conformance, improved retention or measured physical comfort.

## Exact proposed behavior

- Toggle changes on a fresh press of the configured flight Boost button. Keeping it held across samples produces one change; a second press switches it off. Show a stable **Boost on** cue with the current button label.
- Stop, pause, reader entry, hangar/menu transitions, recovery, disconnect and lifecycle interruption clear the controller latch. Require neutral before accepting another press; returning to flight must never restore a previous latch.
- Keep keyboard and touch sources independent. Switching off controller Boost must not cancel another genuinely held source. Deliberate global Stop and lifecycle clears still clear every source.
- Persist only the player's mode choice. The active latch is temporary. Apply a mode or binding change after clearing input; older valid profiles default to Hold. Define this in the strict preference contract without silently extending the existing binding-map format.
- Continue emitting the canonical `boost` boolean. Both steering modes, equipment behavior, encounter schedules, replay schemas and existing frozen checkpoints remain unchanged for identical recorded commands.

## Bounded proof and UI work

Test fresh-press/held/released sequences, remapped buttons, scope transitions, recovery, selected-pad replacement and lifecycle neutral gates. Exercise mixed keyboard/touch/controller input and explicit Stop. Cover preference validation, session-only settings, backup import and Undo without retaining a live latch. Use existing immutable replay expectations to show that equal command streams still produce equal results.

In the real Controller Lab, select Toggle through Settings, join, boost, stop, pause/read/resume and disconnect using visible controls. Repeat with a remapped Boost button and both steering policies. The lab's simulated pad can verify this software path; physical-controller comfort, Bluetooth behavior and native execution require separate sessions. Controller direction still requires a hold, so this is not a complete no-hold control scheme.

This is preferable as the next small increment to retry copy or mirrored touch placement because it removes a concrete remaining input demand with a small explicit setting. Retry wording can follow using actual failure causes; mirrored touch controls need their own layout, focus-order and physical reach checks. Neither should be bundled into the Boost change. Existing picture celebrations, retry actions and the new readers remain available without another reward delay or gameplay requirement.
