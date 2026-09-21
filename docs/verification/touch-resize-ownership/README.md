# Touch interruption on window resize

Held source correction after PR209. This does not close device or public-release acceptance.

Both Solo and couch previously cleared captured steering on window resize without notifying the host that control had been interrupted. Flight continued but the same finger could no longer turn. The actual Solo host reproduces this in stick, swipe and D-pad modes. The shared couch input reproduces it with two owned fingers.

The shared adapter now distinguishes deliberate `clear()` from interrupted `cancel()`. Existing resize listeners call `cancel()`, which notifies the host only when a gesture was actually owned. Solo uses its existing paused continuation. Couch pauses once and retires both physical gestures, preserving permitted saved directions. Duplicate resize or capture-loss events cannot pause again. Explicit Resume and fresh gestures remain required. Pointer-up remains ordinary release, and idle resize does not pause keyboard/controller flight.

## Verification

- Baseline at f9bbe3e8 with the new cases: shared couch6/9; selected actual Solo resize cases0/3. These are real reproduced failures, not inferred physical-device failures.
- Complete seven-file couch/input/navigation/core cohort: **116/116 on Node20.19.5 and22.22.2**, no skips.
- Separate complete Solo host/legacy-input cohort: **69/69 on both runtimes**, no skips. Tests preserve the paused checkpoint through repeated resize/focus/stale-pointer events and then exercise explicit Resume and fresh steering.
- Every loaded tracked module was checked against candidate bytes or exact8cff source. Logs, read manifests and hashes are retained in this directory. Source cohorts are separate, not one combined release qualification.
- Scoped lint and formatting pass; the three runtime hunks retain existing simulation, save, replay and normal-release behavior.

An exact-source desktop Chromium preview also exercised keyboard Start at390×844, live resize to844×390 with no active pointer, Pause and resize to568×320, then explicit Resume. The running/paused state and focus stayed correct; document width matched each viewport. This is bounded browser evidence, not native held-touch or actual Safari/Steam Deck testing. The initial preview omitted shared authoring renderer modules; correcting its route allowlist restored startup. This preview failure did not require a game change.

`native-review.json` retains measured arenas and the distinction between unique served-file bindings and total network requests. The tab was closed, viewport override reset and owned server stopped. Final merged build/public journeys and physical rotation/browser-bar comfort remain open.

## Research and maintenance

[MDN resize documentation](https://developer.mozilla.org/en-US/docs/Web/API/Window/resize_event) identifies the window-level event. [MDN pointer cancellation](https://developer.mozilla.org/en-US/docs/Web/API/Element/pointercancel_event) describes interruption separately from ordinary pointer-up. RevealLine's pause-on-owned-layout-interruption is a game policy using the existing cancellation path, not a claim that every mobile browser emits the same event sequence.

Prompt: “Resize with both couch fingers captured and with each Solo steering style. Verify exactly one pause, retired captures, no stale turns, preserved checkpoint and explicit Resume followed by fresh input. Repeat resize without active touch and preserve keyboard/controller play. Keep actual phone rotation and browser chrome behavior separate from simulated resize.”
