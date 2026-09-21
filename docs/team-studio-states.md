# Team state previews

Asset Studio → Field context → Couch Team uses the actual Team painter and unchanged revision-2 starter arenas. Select the FPV collection and an arena-compatible shared body or picture, then select a scene. Both current and draft surfaces use the selected scene independently.

The scene menu now exposes Hunter recovery, Support pulse and slowed enemies in both arenas, plus emitter warning, travelling spark, both-player crawling and Team reserve recovery in Relay Yard. These supplement the existing cuts, warning/charge, joint capture, objective, victory and both-player rescue specimens. Arena availability comes from the same table that admits fixture construction; switching to First Connection clears an unavailable Relay Yard scene to Initial field.

Every scene is earned through public simulation commands at Standard, seed 17. The spark trace pauses movement with ordinary release commands after the warning, allowing the unchanged emitter to launch along an existing cut. No enemies, impacts, events, checkpoints or artwork owners are injected. Support and enemy slowing are separate specimens because the slowdown outlasts the pulse.

Paused previews hold the actual simulation state. Play preview advances bounded fixed steps and loops back to the retained earned state. Reduced effects keeps meaningful warnings, slowdown markers and sparks readable. This inspection does not write saves, award pictures, alter arena bytes or certify a collection for publication.

## Team reserve recovery

Relay Yard → Team reserve recovery starts at tick 484 after both craft were genuinely downed and one shared reserve restored them to their spawns. The HUD shows two reserves; both players retain two seconds of recovery grace. This is different from the existing individual contact-rescue specimens, which consume no reserve. The scene comes from public Standard / seed 17 commands, never manufactured grace windows or an injected event. Play preview releases both inputs, lets the normal grace expire, then loops to the earned recovery. Paused and Reduced effects hold the selected state.

The last-tick `team.recovery` event remains inspectable in the held specimen. Production event animations must consume events after each simulation step: `run.events` is cleared on the next tick, so a render-only observer can miss an event. A held preview must never award progress, spend another reserve or repeatedly emit sound.

## Crawling players

Relay Yard → Player 1 crawling / Player 2 crawling starts at tick 495. The existing rescue route first earns a downed player at tick 483. Twelve ordinary unboosted steering steps move Player 1 right or Player 2 left along captured ground while their active partner stays still. No reserve is spent and no rescue is fabricated. Play preview continues the short crawl, then releases input so the body naturally returns to its stationary downed state before the bounded loop resets.

The renderer distinguishes downed and crawling bodies by observed displacement. A lone frozen snapshot cannot prove movement. For these two scenes, the fixture retains the actual predecessor, lets the painter observe it, advances one recorded simulation step and presents the selected tick. This primes only cosmetic sampling; the final state, clock and trace cursor are identical to the earned specimen. The same treatment runs after each private loop reset. Paused/reduced previews then retain the true crawling body without advancing time, and a failed observation cannot replace the usable fixture. The event latch is separate and never ingests this priming predecessor.

Choose the compact body for narrow previews and the detailed body for wide previews; the selected-state message identifies the active treatment. Both downed and crawling rotors stay stopped. No new crawling behavior is added to either arena. First Connection has no approved crawling specimen, so its menu entries stay unavailable rather than showing a manufactured pose.

## Small-screen controls

Preview controls wrap using a nonzero flex basis. The interface text reset deliberately allows shrinkage through `min-inline-size: 0`, so `min-width` alone cannot keep these labels readable. Keep all selectors and the Geometry overlay label at least 44 CSS pixels high; use normal vertical document scrolling on phones rather than squeezing all eight controls into one row. Do not reduce text size or alter the selected scene during reflow.

## Acceptance

Exercise every added scene on the actual painter at compact and detailed widths, with normal and reduced effects. Verify shared actor and picture bindings, disposal, held-state readability, scenario availability, reset/loop isolation and independent command replay of the travelling spark and Team reserve recovery. Assert that normal released-input ticks expire grace without spending another reserve, and switching to First Connection removes the unavailable recovery scene. Native Studio selection, painted appearance and input checks remain separate from modeled renderer evidence.

Existing genuine Solo, two-board Versus and Team previews must not be described as missing. Body, anchor, personal-feedback and threat authoring have separate slot contracts; registration alone does not approve their production artwork. Joint-capture/team-recovery event authoring is a separate contract. Remaining production work includes approved edition artwork, further arena/recovery causes and imported-map inspection. Selecting a procedural state while inspecting a shared body does not make that cue an independently replaceable asset slot.

### Terminal preview guidance

Completed arena specimens retain the actual winning simulation and its last-step events. Because terminal simulation time stops, a winning joint-cut receipt can remain within its presentation lifetime indefinitely. Field context gives terminal state precedence over that receipt: it shows completion guidance, hides live event artwork and reports an event slot inactive. The receipt and simulation are not modified. Paused/reduced previews preserve the same precedence; running Joint capture and Team reserve recovery specimens retain their normal cues.

The live Team page presents its separate victory/loss overlay with Next/Browse/Retry guidance. This Studio correction does not alter those actions or claim the underlying live HUD message has been erased. A completion-preview check must use a command-earned winner with a retained final capture, not a manufactured empty event list.
