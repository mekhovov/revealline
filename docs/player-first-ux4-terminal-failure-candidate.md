# UX4 terminal failure and deliberate Retry candidate

This unversioned local checkpoint is reconciled onto the exact Steam Input plus
Couch quick-start candidate `b213212e94208883e002be76f94af0e79b43ff86`.
It is intentionally not pushed, merged, versioned, or released. It inherits
the base's version metadata without assigning that version to this feature.

## Player contract

- A terminal Solo failure waits on a compact result with **Retry mission** as
  the primary action, plus **Change difficulty** and **Missions**.
- Retry adopts the prepared attempt only after its exact picture, actor style,
  theme, and setup are ready. A 600 ms ready cue holds the simulation at tick
  zero and requires no second Start action.
- Held Confirm and Back input cannot activate Retry, leave the result, or cross
  the ready cue into gameplay.
- A held touch remains inert until release; cancelling that touch leaves the
  terminal result and its authoritative checkpoint unchanged.
- A terminal Team failure no longer starts another arena after 700 ms. The
  result remains until a player deliberately retries or chooses another action.
- Ordinary Solo life recovery and Team downed, crawling, rescue, reserve, and
  recovery mechanics are unchanged.

## Reconciliation and focused evidence

- The earlier reviewed UX4 and Couch quick-start work both touched
  `game/couch/relay-rescue.mjs`. Reconciliation applied without a text conflict;
  inspection confirmed that the resulting delta only removes terminal
  automatic Retry and adds lost-result labels/styles around the newer compact
  lobby.
- The accepted Steam Input guard owns native Confirm echoes for 1.25 seconds.
  The held-controller navigation fixture now waits through that exact bounded
  ownership window before modeling a fresh keyboard Resume. The player runtime
  and its protection against duplicate activation are unchanged.
- Solo terminal/result/Next/navigation: 11/11 cases passed. This includes exact
  prepared Retry, held keyboard/controller ownership, explicit key release,
  held touch cancellation, the 600 ms zero-tick cue, and fresh Resume.
- Solo defeat presentation and ordinary life recovery plus Team terminal
  authority: 16/16 cases passed.
- Team downed/crawling/rescue/recovery mechanics: 24/24 cases passed.
- The earlier checkpoint's 38-case Team picture/history and broader Retry/Next
  evidence remains useful history, but it was not rerun as exact-base evidence
  here and is not counted as a pass for this reconciliation.
- Scoped ESLint, Prettier, native Prettier, validation, motion syntax and diff
  checks pass. A candidate build was deliberately omitted because the shared
  assembler disk was below its build reserve; the exact base's already-recorded
  build remains separate evidence. This candidate does not claim or assign the
  inherited release version.

## Evidence limits

The complete repository suite was not run. A broad changed-file diagnostic
also includes historical presentation/schema fixtures outside the terminal
failure contract; their existing failures are not claimed as UX4 passes.
Browser clicks remain modeled touch evidence, and modeled controller evidence
is not a physical controller or Steam Deck check. A parent publisher must still
perform responsive visual, real-touch and physical-controller review before
release.
