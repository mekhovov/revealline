# Shared touch capture fallback — 28 September 2026

Base: `6fe52474b5b395a5c416bd388555d488db33f287` (current main at preparation).
This is focused source/input-adapter evidence, not browser, physical phone,
controller, complete phase, or public-release acceptance.

## Defect and correction

When pointer capture throws or is unavailable, a finger released outside the
shared pad never retired its gesture. Later touch gestures were ignored in Solo
and couch. Both hosts now supply the owning window; shared steering observes
matching release/cancel in capture phase, including events stopped by another
control. Ordinary release preserves continuous heading. A genuine interruption
uses the existing pause contract; unrelated/stale fingers are ignored. Destroy
removes the window observers.

The browser contract allows capture to throw and uses capture to redirect events
outside the target ([MDN setPointerCapture](https://developer.mozilla.org/en-US/docs/Web/API/Element/setPointerCapture)).
Cancellation is distinct from an ordinary release
([MDN pointercancel](https://developer.mozilla.org/en-US/docs/Web/API/Element/pointercancel_event)).
The fallback and ownership rules above are RevealLine implementation choices.

## Executed checks

- Before the runtime correction: 67 tests, 57 passes, **10 expected failures**
  covering shared stick/swipe/D-pad, Solo and two-seat couch. Actual steering
  remained in the old direction after outside release.
- After correction and an additional stopped-propagation/teardown regression:
  **143/143 pass** across five input modules.
- Independent read-only review found no actionable issue; its additional event
  fixture check covered stopped propagation, duplicate cancellation, fresh
  steering and teardown. It did not run a native browser.

Final focused command:

```sh
node --test game/test/touch-steering.test.mjs game/test/couch-shared-touch.test.mjs game/test/continuous-input.test.mjs game/test/ui-input.test.mjs game/test/couch-input.test.mjs
```

The red run used the first three modules before changing runtime code. Original
TAP output and its byte/hash inventory are retained in `red.tap`, `green.tap` and
`evidence.json`. The added teardown test is only in the final green run.
Node's original failure diagnostics contain whitespace-only lines in `red.tap`;
the unrestricted diff whitespace check reports those ten preserved evidence
lines. Source and documentation pass the check with the original TAP files
excluded. The evidence was not normalized or rewritten to silence that check.

Full suite, ordinary build, frozen-source qualification and actual public checks
were **not run here**. The coordinator owns final version allocation and release
qualification. Existing waivers remain explicit; focused tests do not replace
unwaived release gates. No game media or offline bundle was downloaded.

## Public follow-up

On the eventual published version, exercise the same shared controls in Solo,
Versus and Team; lift outside the pad, start another gesture, interrupt one
finger, then explicitly Resume. Verify both seats remain independent on ordinary
release and both are safely paused on an actual interruption. Record actual
device/browser/input and viewport separately from deterministic event tests.
