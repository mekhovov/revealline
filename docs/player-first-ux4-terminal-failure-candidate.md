# UX4 terminal failure and deliberate Retry candidate

This unversioned local checkpoint is based on accepted main
`f54a6ecbdf329c7fd175d90ec258537d035c72e7`. It is intentionally not pushed,
merged, versioned, or released.

## Player contract

- A terminal Solo failure waits on a compact result with **Retry mission** as
  the primary action, plus **Change difficulty** and **Missions**.
- Retry adopts the prepared attempt only after its exact picture, actor style,
  theme, and setup are ready. A 600 ms ready cue holds the simulation at tick
  zero and requires no second Start action.
- Held Confirm and Back input cannot activate Retry, leave the result, or cross
  the ready cue into gameplay.
- A terminal Team failure no longer starts another arena after 700 ms. The
  result remains until a player deliberately retries or chooses another action.
- Ordinary Solo life recovery and Team downed, crawling, rescue, reserve, and
  recovery mechanics are unchanged.

## Focused evidence

- Solo terminal result, difficulty return, exact prepared Retry, held
  Confirm/Back, and no pre-cue simulation: 1 selected case passed.
- Solo defeat presentation and ordinary recovery: 8/8 cases passed.
- Team terminal failure and recovery authority: 8/8 cases passed.
- Team lost-attempt Journey skip: 1 selected case passed.
- Solo difficulty Retry: 1 selected case passed.
- Controller-only authored win, Retry, second win, and Next: 1 selected case
  passed.
- Fresh visual Retry retention: 1 selected case passed.
- Picture preparation/cancellation status: 4/4 cases passed.
- Failed picture prewarm Retry: 1 selected case passed.
- Scoped ESLint, Prettier, syntax, diff checks, and the ordinary production
  build passed. The inherited `0.110.1` build contains 1,137 files with SHA-256
  `4988c45b9eefa11bd8ec84cbfee93ccffed03e9141aa081e1e0e19114c8a52af`;
  this candidate does not claim or assign that release version.

## Evidence limits

The complete repository suite was not run. The current accepted source also
contains slow host fixtures whose independent selected runs can fail before the
changed Retry path (a retained-presentation setup timeout and a story-flight
route that does not reach its expected win); they are not claimed as UX4
passes. Computer-use browser visibility is unavailable in this subagent, so a
parent publisher must perform the responsive visual and real browser input
review before any release. Modeled controller evidence is not a physical
controller or Steam Deck check.
