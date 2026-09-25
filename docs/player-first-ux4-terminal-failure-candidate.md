# UX4 terminal failure and deliberate Retry candidate

This unversioned local checkpoint is reconciled onto the exact Couch
quick-start candidate `50b6fa1841f53983ff30a40f4d4279db60271853`. It is intentionally not
pushed, merged, versioned, or released. It inherits the base's version
metadata without assigning that version to this feature.

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

- The only source overlap between the older reviewed UX4 commit and Couch
  quick-start was `game/couch/relay-rescue.mjs`. Git applied it without a text
  conflict; review confirmed that the resulting delta only removes terminal
  automatic Retry and adds lost-result labels/styles around the newer compact
  lobby.
- Solo terminal/result/Next/navigation: 11/11 cases passed. This includes exact
  prepared Retry, held keyboard/controller ownership, explicit key release,
  held touch cancellation, the 600 ms zero-tick cue, and fresh Resume.
- Solo defeat presentation and ordinary life recovery plus Team terminal
  authority: 16/16 cases passed.
- Team downed/crawling/rescue/recovery mechanics: 19/19 cases passed.
- Focused Retry/Next evidence passed for actor retention, difficulty change,
  controller-only win → Retry → win → Next, failed picture prewarm, visual
  retention, delayed/cancelled picture preparation, exact Team cross-campaign
  failure recovery, and deliberate lost-attempt Team Skip.
- Scoped ESLint, Prettier, native Prettier, validation, motion syntax and diff
  checks passed. The inherited `0.112.0` production build contains 1,138 files
  with SHA-256
  `04806804d42063e4823c30fbbd23a1c625d4f25d8a713db57cc34313538aa889`;
  this candidate does not claim or assign that release version.

## Evidence limits

The complete repository suite was not run. Two slow host fixtures fail before
the changed Retry path: the retained-presentation setup does not settle, and a
story-flight route remains running instead of reaching its expected win. Both
fail identically on the exact `50b6fa18` base, so they are recorded as inherited
base defects and are not claimed as UX4 passes. Browser clicks remain modeled
touch evidence, and modeled controller evidence is not a physical controller
or Steam Deck check. A parent publisher must still perform responsive visual,
real touch and physical-controller review before release.
