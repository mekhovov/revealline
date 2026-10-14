# Rating calibration follow-through

## Decision

Keep the published 375 exact-setup higher-star budgets and the 1,065 completion-only
setups unchanged. There are no proposed new silver/gold keys. This completes the
bounded follow-up assessment; it does not claim new player calibration. Completion
stars, personal records and the explicit before-play/result criteria remain the
intentional baseline for the remaster.

## What was examined

The existing foundation and supplemental pace journals use the same general
qualification pilot. Replaying its path at another pace verifies that setup's
correctness, but does not create independent strategy or difficulty evidence.

The new `review-snake-rating-evidence.mjs` compares five simple, stable seed-17,
normal-pace Solo setups using two separately implemented steering approaches:

- The existing scored search simulates possible accepted moves, scores escape
  space and may backtrack while constructing a winning journal.
- A new visible-board pilot chooses a shortest path to the stationary target using
  only the current head, cable and walls. It conservatively keeps the tail blocked,
  never reads future random state, never simulates candidate moves, and never
  rewinds or changes strategy. No current path is recorded as a limitation.

Both submit ordinary turn inputs to the production simulation. The report retains
both journals, exact recipe identities and source hashes. Every journal restores
to the same exported checkpoint. The comparison includes Open Loop as a published
control and four completion-only candidates; no Team, faster-pace, moving-target
or variable-hazard eligibility is inferred from Solo results.

| Normal Solo, seed 17 | Visible pilot moves | General pilot moves | Different input journal? | Current policy                       |
| -------------------- | ------------------: | ------------------: | ------------------------ | ------------------------------------ |
| Open Loop            |                  93 |                  93 | No                       | Existing fixed budget                |
| Twin Islands         |                  98 |                  98 | No                       | Completion star and personal records |
| First Baffle         |                 108 |                 108 | No                       | Completion star and personal records |
| Offset Blocks        |                 102 |                 102 | No                       | Completion star and personal records |
| Room to Follow       |                 156 |                 156 | No                       | Completion star and personal records |

All five clear with both implementations, but **none produces a second route**.
Agreement confirms that a simple visible-state strategy can reproduce the
qualification path. It supplies neither independent strategic coverage nor an
evidence-based margin for silver versus gold. Creating thresholds by multiplying
these move counts would repeat the original single-witness problem.

## Evidence required before publishing additional budgets

1. **Exact identity and scope.** A proposed budget names current recipe identity,
   seed, mode, pace and revision. Team receives its own evidence; altered seeds,
   recipes and variable hazards cannot borrow the budget.
2. **Independent route evidence.** Retain verified input journals for meaningfully
   different approaches and their provenance. Separate algorithms, reordered
   tie-breaks and pace copies alone are not independent strategies. Include
   unsuccessful attempts and explain any solver knowledge unavailable to players.
3. **A declared difficulty policy.** Specify what silver and gold should reward,
   the intended execution margin and the treatment of movement versus reaction
   pressure. A shortest route, even if optimal, does not determine a fair margin.
4. **Execution evidence when claiming player fairness.** Observations must cover
   supported pace/control conditions, first comprehension and repeat improvement.
   No physical-device test or player study was performed for this assessment;
   both are deferred by the user. Do not describe generated routes as a player
   cohort or quietly infer real-time difficulty from move counts.
5. **Explicit publication review.** Review the concrete keys, budgets, supporting
   journals and limitations separately from qualification. The existing publication
   fence continues to reject new keys, altered thresholds and deleted published
   rows. This report does not bypass it.

Additional grades can be proposed later under that policy. They are not an
undisclosed unlock condition or a blocker to playing the completed campaign.
Variable-schedule missions remain completion-only until their conditions have a
separate defensible comparison policy.

## Reproduction

```sh
node scripts/review-snake-rating-evidence.mjs --check
node scripts/review-snake-grading.mjs --check
node scripts/calibrate-snake-ratings.mjs --check
node --test scripts/test-snake-rating-evidence.mjs scripts/test-snake-rating-publication.mjs game/test/classic-snake-ratings.test.mjs
```

The bounded evidence harness is local, collects no telemetry and does not run in
gameplay. `rating-independent-evidence.json` is reproducible evidence, not a new
rating registry.
