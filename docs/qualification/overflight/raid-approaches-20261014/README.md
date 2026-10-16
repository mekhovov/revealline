# Raid objective approaches — 14 October 2026

This delivery changes finite encounter authoring, not contact rules or completion gates. It preserves the exposed first leader, six pre-boss objective rewards, one/two/three vehicle armor segments, committed warning/recovery rules and unrestricted expert shortcuts.

## What changed

- All three encounter sets now have distinct priority-target geometry. Patrol uses compact triangular routes; Crossing uses opposing diagonals; Countermove uses offset triangular turns. The first exposed leader stays at its existing position and route.
- The existing escort allowance is split into two wings: a shield facing and a nearby brace warning/recovery. Each sector retains four escort actors on Standard or six on Veteran. Shield actors remain stationary and commit their facing; brace actors use the short authored route. No casualties are replaced.
- The wing spacing leaves room to go around. Players can flank the shield or sweep through a recovering brace wing; they do not need to kill either wing to finish the objective.
- V2 specialist wings may contain two or three actors. Ordinary packs retain their four-actor minimum; V1 retains six. Creator Studio and the compiler use the same minimum helper, so the editor no longer reports valid built-in wings as below its input minimum. Visibility and total specialist validators remain enforced, including surviving escorts from prior sectors.

## Recorded comparison

`before.json.gz` and `after.json.gz` retain every attempt, input configuration, objective timeline, selected upgrades, ten-second samples and outcome. There were no discarded failures or adaptive retries. Each contains 144 deterministic routes: three seeds (17031991, 42, 101), two difficulties, three encounter sets, objective/pack routes and baseline/Sweeper/Pursuer/Breaker builds. Baseline disables card drafts only; it does not change movement or contact rules.

Both versions completed 144/144 routes, including all 36 baseline-kit runs. `comparison.json` contains the full aggregate comparison.

| Route/difficulty      | Mean clear before → after | Mean damage before → after | Mean score after |
| --------------------- | ------------------------- | -------------------------- | ---------------- |
| Objectives / Standard | 26.66 → 24.98 s           | 31.5 → 17.7                | 15,600           |
| Objectives / Veteran  | 24.52 → 27.53 s           | 10.6 → 39.8                | 30,067           |
| Packs / Standard      | 51.12 → 50.29 s           | 11.4 → 16.2                | 98,931           |
| Packs / Veteran       | 46.95 → 46.37 s           | 9.4 → 23.0                 | 110,960          |

The revised objective routes range from 18.77–42.12 seconds; pack routes range from 35.87–65.63 seconds. This is a deterministic, state-reading pilot. These numbers establish reachable routes and the score/time trade-off, not ordinary-player pacing. The intended 4–7-minute first completion and enjoyment are **not established**. Standard became less damaging while Veteran became more demanding for these inputs; this is not a universal difficulty claim.

Direct routes had no time with no nearby actor. Pack hunting still provides substantially more score and kills than shortcutting objectives. No mandatory cooldown, kill quota, invulnerability window or extra armor was added to lengthen a run.

## Verification

- 60/60 Raid compiler, runtime, presentation, HUD, records and Community tests passed (`tests.tap`).
- Coverage includes all three sets, both difficulties, three seeds through the conservative camera-overlap validator; same-profile/fresh-profile package round-trip; preserved legacy layouts; and rejection of single-member wings and two-member ordinary packs.
- Scoped lint and whitespace checks passed.
- Run `node docs/qualification/overflight/raid-approaches-20261014/qualify.mjs` to regenerate the current 144-route receipt. It records failures as returned.
- Source hashes are in the compressed receipts. The initial comparison changed only `raid-project.mjs`; later source-formatting/shared-minimum refactoring was rerun without changing outcomes. No pilot changes were used to obtain these results.

## Remaining evidence boundary

A native visual pass must verify that the shield and brace wings are distinguishable in motion, that warning overlap is readable and that the new approach geometry feels worthwhile. Automated wins cannot substitute for that review. The external hardware/controller/five-player checks remain skipped at the user's direction. This packet adds no hardware-performance claim.

## Time Attack and Contract Marathon

`raid-variants.mjs` wraps the existing Raid mode. It keeps the same renderer, sound owner, input, contact transactions, Studio project and profile-record backend. Root integration selects these through `raid.html?operation=time-attack` or `raid.html?operation=marathon`.

- **Time Attack:** no mandatory countdown. Objective completion produces a medal time equal to simulation time plus 0.25 seconds per hull point lost. Gold/Silver/Bronze thresholds are initially 90/150/240 seconds. Raw and adjusted times retain hundredths, including record displays. Failed runs cannot earn medals or fastest-clear records. These thresholds are initial tuning, not established player difficulty.
- **Marathon:** after a contract, bank the entire score and finish, or carry hull, remaining airframes, build, shield, rerolls, character traits and appearance into the next contract. Contracts use deterministic new seeds, rotate existing routes and increase ordinary pack speed by eight per contract, capped at 140. Shield facing commitment decreases only to its one-second floor; repair rewards decrease only to ten. Warning and machinery recovery floors, actor counts and specialist budgets remain unchanged. Scores rise from ×1 to ×2 over five contracts. The fifth clear automatically banks; loss of the final airframe forfeits all unbanked score, including the current contract. There is no free repair or replacement at contract boundaries.
- **Records:** variant rules are included in a separate content identity. Mission-chooser queries use the same identity as completed records. Intermediate contract wins are never submitted as completed Marathon records; repeated renders do not write duplicate results. Existing Raid records remain separate. Storage failures keep the existing clearly session-only fallback.
- **Lifecycle:** continuing leaves the new shared run ready; the native host releases input, resets its clock/result latch and explicitly starts it. Bank/continue is available only at a completed contract, and the host can block continuation during graphics recovery. Same-seed retry creates a fresh campaign. Once fewer than three upgrade families remain legal, later queued drafts stop instead of offering duplicates or crashing.

`variant-tests.tap` contains 11 passing tests, including an ordinary-input five-contract completion, exact-once banking/forfeiture, carry-over, bounded escalation validation, pause, exhausted drafts, UI bank/continue guards, same-seed reset, independent record queries, storage fallback and stale asynchronous-result exclusion.

`variants.json.gz` retains 72 deterministic attempts at seed 42 across both difficulties, all three sets, both objective/pack routes and all three build preferences. **36/36 Time Attack attempts completed; 33/36 Marathons banked after five contracts. Three Marathons lost during contract three**, with forfeited scores retained in the receipt. No failures were discarded. This verifies a reachable but fallible risk loop, not human enjoyment or medal calibration.

The first broad variant qualification uncovered a real queued-upgrade exception: core card confirmation can immediately open the next pending draft, before the next simulation step. The wrapper now checks the post-choice legal catalog before confirming. `variant-draft-failure.json` retains the initial exception and its evidence limitation; the exact interrupted route was not captured. The regression is covered explicitly and the complete corrected matrix finished without exceptions.

Run `node docs/qualification/overflight/raid-approaches-20261014/qualify-variants.mjs` to regenerate the matrix; the runner now retains per-attempt exceptions as outcomes and continues the remaining matrix. Native host recordings and subjective difficulty remain separate review evidence.
