# Humanoid Hunt qualification follow-up

Status: structural admission and focused runtime inspection, **not human-play qualified**.
Date: 2026-10-02. Worktree: `codex/humanoid-hunting`, after integrating main `e48adf318`.

## Concrete gaps closed

- Generated populations no longer choose every position from the same eight-cell band around the spawn. The first target remains nearby; successive targets maximize separation with deterministic tie ordering. Existing minimum spawn, ordinary-actor and population spacing remains enforced. Placement stays serialized in the accepted level; it does not run during play.
- Every target now needs a geometric approach from an authored player spawn, including Bonus targets that are optional for victory but relevant to all-target/contact mastery. Walls and lethal **field** cells block admission; reclaimed cells remain traversable even when their underlying material is lethal. A quota no longer conceals unreachable surplus targets.
- Solo relay gates contribute potential reachability only after their validated linked capture-objective cell is reachable. Admission iterates these dependencies; a gate cannot unlock itself or a closed dependency cycle. This is geometric potential, not proof that a player can safely execute the objective capture among moving hazards. Generated overlays use initially reachable locations and do not depend on future unlocks.
- Runner recipes preserve the exact 70% ratio when gameplay tuning admits craft speed 20: the compiled runner speed is 14. The successor limit is 14 only for explicitly referenced Hunt runners in Solo level v9 / Team Hunt validation. Historical patrols and guards retain their speed limit of 8. The public combat-view validator also admits the corresponding velocity; shots keep their previous limits.
- Solo run admission checks the entire accepted class roster, because pilots can change class. A custom roster containing a 0.5 multiplier rejects a level whose runners exceed 35% of base craft speed. An explicitly compiled slower population can admit that roster. The engine does not silently change accepted level recipes or historical non-Hunt custom rosters. All seven built-in classes currently have unboosted multiplier 1.
- Deriving Off or Patrol from a Solo Hunt level now removes its Hunt descriptor and returns level v8, rather than leaving a v9 level missing its required Hunt rules.
- Shared capture inspection now recognizes Team's direct combat population and excludes claimed roamers as field-retention seeds in Team rulesets v9 and v10, matching their established live semantics. This repairs Studio/snapshot explanations; Team's live capture implementation does not use this shared snapshot helper.

## Evidence collected

The existing automated-test waiver remains unchanged. No automated test suites were run. New admission regression cases in `game/test/hunt-core.test.mjs` are **unrun**, not passed.

Focused compiler/runtime inspection established:

- All six authored teaching missions compile with their explicit populations in Solo and Team: 2, 3, 3, 3, 5 and 6 targets. Their original keeper geometry, IDs, lesson order and source board positions were preserved.
- A craft-speed-20 Hunt level compiles with four runners at speed 14 and a valid six-actor combat view. Off and Patrol derivatives validate as Solo level v8.
- The same level rejects a roster containing multiplier 0.5. Recompiling its runners at speed 7 admits that exact roster.
- A Bonus target behind a permanent wall is rejected despite quota zero. A validated gate whose objective is reachable admits the target behind it. These are direct boundary inspections, not playthroughs.
- On the generated First Return board, a frozen vertical closure at column 24 removes 3 of the 6 optional targets, leaving targets on the retaining side. On the authored final lesson, a frozen southward departure from the west landing at column 12 removes 0 of 6. Snapshot inspection assumes a legal closure and frozen actors; it neither proves the route is safe nor predicts the result after movement.
- `scripts/inspect-hunt-coverage.mjs` regenerated `docs/humanoid-hunt-coverage.json`. Every one of the six edition choices remains structurally available on all 91 default Solo missions, 91 default Versus missions, 12 default Team missions, and each six-mission teaching route in Solo, Versus and Team. The JSON continues to label qualification `structural` and human play `pending`.

## Rules reviewed without changing them

Hunt bodies are removable by an active craft during both an exposed cut and safe-edge contact. The contact segment must not pass through a wall or closed gate. Historical optional patrol contacts keep their prior cut-only gate. Guard shots remain governed separately by exposed-cut and grace eligibility. A frozen body can still be removed; a frozen shot remains inert.

The Solo transaction orders fatal collision first, then accepted closure/capture cleanup, then remaining contact eliminations, then victory evaluation. An actor changes alive state only once. Capture wins a same-transaction capture/contact tie and awards 50; accepted contact awards 100. Guard removal clears owned shots. Dedicated Hunt requires every finite target, while Bonus and capture-plus-quota retain their original mission obligations.

Runner detection remains six cells, steering remains every 60 actor ticks, and geometric lookahead uses the effective enemy slowdown. Both turn policies use the same movement speed; their turning behavior differs. Slow ground, directional fields and signal penalties can temporarily make the craft slower than a runner, so the 70% promise applies to the accepted neutral-ground unboosted class recipe, not every local material condition.

## Remaining release gates

1. Play the six lessons in their teaching order with keyboard, touch and gamepad where supported, both turn policies, the slowest accepted roster and no boost/power-up dependency. Record completion, deaths, unintended farming and whether the player understands keeper versus humanoid silhouettes. Repeat shared roles in Team and equal recipes on both Versus boards.
2. Qualify authored and generated Hunt routes with slow terrain, directional speed fields, relay gates, moving keepers, narrow returns and timed pressure. Dry geometric reachability does not establish interception feasibility, safe return, time-limit balance or the ability to capture a gate objective. Failed routes need an authored placement/rule adjustment or explicit edition exclusion.
3. Check first-enclosure outcomes at actual closure times. A legitimate enclosure may remove all targets and must still win under the accepted rules. Population separation reduces one known trivial opening; it does not guarantee that every generated Hunt is an interesting standalone challenge. Maps without an effective retaining keeper, remote unseeded chambers and easy large closures especially need review before being described as curated Hunt content.
4. Verify high-speed narrow-boundary movement and simultaneous shot/body/capture events interactively. The engine uses continuous contacts and the numerical caps now admit the intended ratio, but no new high-speed playthrough or determinism suite was executed under the waiver.
5. Once the waiver is explicitly lifted, run the admission/contact/serialization/replay regression suites, including the newly added speed, custom-roster and reachability cases. Human qualification and automated verification remain separate gates.

The six teaching missions remain the discoverable authored chapter. The 91/12-mission overlays are structurally available experiments; the coverage counts must not be presented as proof of balanced or human-qualified gameplay.
