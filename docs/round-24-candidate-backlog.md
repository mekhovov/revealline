# After Boost: explain the failed attempt before Retry

Proposal only, 12 September 2026. Finish and verify the current solo Boost increment first. This note changes no runtime, rules, saved data or archived evidence.

Recommend one bounded improvement: a **cause-specific explanation and one useful next step on the existing lost-result screen**. Keep the Retry button immediate and optional. Add no replay delay, forced tutorial, confirmation, automatic difficulty change or new reward system.

## The concrete gap

In [the current app](../game/app.mjs), `overlay('lost')` describes mission timeout, cut timeout and cable length, but enemy contact, self-contact and boss lanes receive the same generic instruction. `eventFeedback` has some more specific temporary messages, but they are not the persistent explanation next to Retry. The existing retry handler already calls `prepare()` and `resume()` directly; preserve that behavior.

The simulation already records enough information. [Core recovery/completion](../game/core/index.mjs), [enemy contacts](../game/core/contacts.mjs) and [challenge contacts](../game/core/systems.mjs) produce the seven finite `run.failureCause` values below. Explain the actual terminal cause, without guessing from an enemy's later position or from the last visible caption. A mission timeout can complete directly without a `player.failed` event.

| Existing cause    | Proposed explanation                                       | One next step                                                           |
| ----------------- | ---------------------------------------------------------- | ----------------------------------------------------------------------- |
| `self-contact`    | Your unfinished line crossed itself.                       | Reach safe ground without crossing the line you are drawing.            |
| `enemy-trail`     | An enemy caught your unfinished line.                      | Try a shorter cut while keeping enemies away from the open line.        |
| `enemy-player`    | An enemy reached your character.                           | Leave room between you and enemies, including patrols on safe ground.   |
| `boss-lane`       | The active marked lane caught your character or open line. | Keep both outside the marked lane while it is active.                   |
| `cut-timeout`     | The time allowed for one open line ran out.                | Return to safe ground sooner; waiting with an open line also uses time. |
| `cable-limit`     | Your open line exceeded its length limit.                  | Plan a shorter line back to safe ground.                                |
| `mission-timeout` | The mission clock ran out.                                 | Plan a shorter route to the required reveal area and objectives.        |

These are theme-neutral suggestions, not guaranteed winning routes. In particular, `enemy-player` does not identify the actor subtype, and `boss-lane` covers either character or trail contact. Do not claim a fiber cable failed because of radio interference, identify an unseen attacker, or imply that captured ground protects against every patrol. Keep objective details in the existing mission brief.

Below the existing revealed percentage, state the retry consequence plainly: **“Retry starts this mission again. This attempt's revealed area resets; your collected pictures and best results are kept.”** This distinguishes a new attempt from nonterminal recovery, where captured territory remains. For Practice, retain its existing no-rewards wording rather than claiming this attempt added pictures or results. Continue to surface any separate storage warning; the footnote is not a promise that a failed write succeeded.

## Small implementation boundary

Add a pure UI projection such as `retryExplanation(run)` in `game/ui/retry-view.mjs`, returning owned plain text only when `run.status === 'lost'`. Map known strings to the finite copy above; use a neutral fallback for an unavailable/unknown cause. Never print arbitrary cause strings as markup. A won or recovering run returns no terminal explanation: `failureCause` can still describe an earlier recovered contact, so checking the cause alone is insufficient.

Have the lost overlay consume this projection through `textContent`. Keep the existing title, revealed percentage, one Retry action and the shared Read details/Done behavior. Reuse the current reading region so the explanation remains available without a timer. Do not add another modal or move focus on every caption update. If a short reason label is used, convey it with text rather than color alone.

Scope the code to the new UI helper, the app's lost-overlay text and focused tests. No core/event/checkpoint modification, replay/session field, pack schema, preference, score identity or content regeneration is needed. Retain legacy and staged encounter behavior exactly. Do not alter nonterminal warnings in this first increment merely to expand its scope.

## Acceptance before release

- Cover all seven cause mappings and the unknown/null fallback; reject showing a stale failure on a later win, ready state or recovery. Verify text-only rendering and no mutation of the supplied run.
- Produce reproducible normal-input terminal traces for each cause in both turning policies using small validated test maps, for example an authored one-life fixture where appropriate. Record and verify those replays with existing public APIs. A direct object passed to the text projector tests copy mapping; it is not evidence of a playable failure route.
- Test a mission timeout during recovery, plus shield absorption and impact redeployment that remain unfinished, to ensure only actual terminal state receives retry advice. Reuse existing event/checkpoint expectations; do not regenerate frozen oracles to match new text.
- Through the actual game or Controller Lab, lose by ordinary contact and by a marked boss lane, read the corresponding reason, then activate Retry once. Verify a fresh run on the selected mission/seed/starting loadout/policy, cleared input including Toggle Boost, no automatic relaunch and no duplicate award. Reading/Back must not retry; a held Confirm must not launch repeated attempts.
- Inspect the persistent text and Retry action at actual 320×640, 844×390, 844×501 and 1280×720 dimensions. The reading region may scroll vertically; the button remains reachable with keyboard, touch and remapped controller controls. Preserve the existing 44px target minimum and full-picture results on successful attempts.
- Ask a player to explain why the attempt ended and what they would change next, without coaching. This can expose confusing wording; it does not establish a retention rate or prove the game is universally intuitive.

## Primary-source basis

Microsoft's [XAG 109 — Objective clarity](https://learn.microsoft.com/en-us/xbox/accessibility/xbox-accessibility-guidelines/109) supports clear, reviewable objectives and useful next steps. Applying that principle to this game's persistent retry explanation is a design inference, not a claim that Microsoft prescribes these messages.

[XAG 115 — Error messages and destructive actions](https://learn.microsoft.com/en-us/xbox/accessibility/xbox-accessibility-guidelines/115) recommends explaining an input error and how to correct it. Its direct scope includes forms, settings and destructive actions; a normal gameplay loss is not a form-validation error. We borrow the communication pattern of cause plus correction, without using the guideline to require confirmation before Retry or claiming accessibility conformance.

Both primary pages were reopened on 12 September 2026. Their text was reviewed; their embedded screenshots and videos were not inspected. The hypothesis is that a persistent, accurate reason makes the next attempt easier to understand. No new gameplay observation, physical-device test or engagement result is claimed by this proposal.
