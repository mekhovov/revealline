# UX4: deliberate Team terminal retry

This unversioned candidate removes the 700 ms automatic restart that remained on authored Team Journey terminal losses. A lost Team attempt now stays on its result overlay until the player deliberately chooses **Retry same arena**, **Browse Team arenas**, **Change setup**, Skip where available, or another visible destination.

## Audit boundary

- Solo already keeps a terminal loss on its result overlay and focuses **Try again**. Its result path does not own an automatic restart timer.
- Legacy/imported Team attempts already waited for deliberate input.
- Authored Team Journey attempts alone created an `automaticRetry` ticket after loss and restarted after roughly 700 ms while Retry kept focus.
- This slice removes only that Team timer and its focus/lifecycle cancellation machinery. It does not change ordinary reserve recovery, downed/crawl/rescue behavior, difficulty, artwork ownership, scores, progress, or simulation rules.

## Player contract

- Terminal Team failure freezes the finished result and telemetry for any amount of foreground time.
- Retry remains the default focused action and starts only from a fresh activation.
- Retry keeps the accepted mission, difficulty, actor collection and exact prepared picture without rereading artwork.
- Held flight directions and a controller Confirm held across failure cannot start the next attempt.
- A failed first paint after deliberate Retry stops safely on the recovery result instead of entering a loop.
- Browse arenas and setup remain visible alternatives. Direct **Change difficulty** on the result panel is still part of the later UX4/UX5 outcome-menu work.

## Focused evidence

- `game/test/content-team-recovery-host.test.mjs`: 3/3. Against the current original-art Team entry and its exact pinned picture bytes, it covers indefinite terminal retention, exact-picture reuse, released keyboard Retry, a held modeled-controller Confirm, cleared flight directions, and painter failure.
- Selected `game/test/team-journey-next-host.test.mjs` terminal Skip case: 1/1, with 24 unrelated cases skipped by the name filter. Against the same exact original-art entry, it proves a stopped Journey result remains present through the former retry interval and Skip still requires confirmation.
- Selected `game/test/terminal-navigation.test.mjs` Solo terminal self-contact case: 1/1, with 10 unrelated cases skipped by the name filter. It confirms Solo already retains its result, focuses Retry, and starts only after deliberate preparation.
- `node --check game/couch/relay-rescue.mjs`, scoped lint/format checks and `git diff --check` are required before review.

The focused Team fixtures use the current original-art entry because the greybox edition intentionally has no exact picture binding on current main. Automated long suites remain governed by the repository test policy.

## Dependencies and limits

Current main includes the Couch controller activation guard and this draft independently proves that a Confirm already held across terminal failure cannot restart. Fresh modeled-controller Retry and physical-controller qualification remain separate from this timer-removal slice.

PR539 remains open and changes the Team Pause hierarchy but does not overlap the removed terminal timer. Reconcile it with this candidate in publisher order.

Modeled controller input is not physical-controller or Steam Deck certification. Touch activation, physical controller release, short landscape layout, and direct result-level difficulty selection remain follow-up qualification.
