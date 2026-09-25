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

- `game/test/content-team-recovery-host.test.mjs`: 3/3. It covers indefinite terminal retention, exact-picture reuse, released keyboard Retry, a held modeled-controller Confirm, cleared flight directions, and painter failure.
- Selected `game/test/team-journey-next-host.test.mjs` terminal Skip case: 1/1, with 24 unrelated cases skipped by the name filter. It proves a stopped Journey result remains present through the former retry interval and Skip still requires confirmation.
- Selected `game/test/terminal-navigation.test.mjs` Solo terminal self-contact case: 1/1, with 10 unrelated cases skipped by the name filter. It confirms Solo already retains its result, focuses Retry, and starts only after deliberate preparation.
- `node --check game/couch/relay-rescue.mjs`, scoped lint/format checks and `git diff --check` are required before review.

The current main branch has unrelated stale expectations in the complete Team Journey/terminal-host files after newer content revisions. Those failures are not counted as passing evidence for this slice. Automated long suites remain governed by the repository test policy.

## Dependencies and limits

PR535 (compact gallery) supplies the Couch controller activation guard needed for a fresh modeled controller Confirm to invoke the focused DOM action consistently. The release coordinator reverted that merge while restoring the ordered train, so this draft follows current main and independently proves that a Confirm already held across terminal failure cannot restart. Reconcile after PR535 is re-admitted, then qualify fresh-controller Retry on the combined source.

PR539 changes the Team Pause hierarchy but does not overlap the removed terminal timer. Rebase this candidate after PR535 and PR539 in publisher order.

Modeled controller input is not physical-controller or Steam Deck certification. Touch activation, physical controller release, short landscape layout, and direct result-level difficulty selection remain follow-up qualification.
