# Pressure corridor: additional full-clear qualification

## Scope and delivery

This test-only successor depends on [PR820](https://github.com/mekhovov/revealline/pull/820),
which restores the previously unmerged v38 registration and original complete
route evidence. That release-targeted PR remains unchanged. This successor was
rebased onto main `4d9d7023` (the current-menu verification correction) without
conflicts. Both belong to the existing v0.150.0 release intake; neither document
claims publication.

No runtime, map geometry, policy, difficulty, assets, defaults, historical
fixtures, or player data change. The six previous Standard/immediate/seed1
strategies and their goldens remain intact. These are three additional legal
input recipes on fresh, normally prepared v38 candidates, not a new autopilot.

## Completed in this batch

| Mission             | Newly qualified case           | Full clear                            | Distinguishing evidence                                                                                                                |
| ------------------- | ------------------------------ | ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Cooling loop        | Standard, immediate, seed917   | Tick7246; 1804/2098 cells; about60.4s | Warned erosion really removes earned cells; foundations remain protected; both lethal banks are neutralized and landings connected.    |
| Pressure ladder     | Standard, Grid steering, seed1 | Tick5019; 1797/2206 cells; about41.8s | Three telegraphed interception commitments; two active craft-bound impacts cancelled by actual closures; slow field neutralized.       |
| Switchback exchange | Standard, immediate, seed917   | Tick6190; 1697/2002 cells; about51.6s | Both relays open; the added approach traverses the entire east connector at ticks5628–5817; lane warnings and roamer activation occur. |

All three finish with zero lost lives, no collected pickups and no abilities or
boost. Every fixed step preserves the coverage denominator, original foundations
and any opened permanent connectors. Valid closures stop the craft. Fresh replay
verification matches; actual untimed equal-input Versus finishes tied, with both
winning authoritative checkpoints matching Solo. The checks do not merely compare
two independently labelled Solo runs.

Fixtures are in `game/test/fixtures/pressure-corridor-expanded-routes.json` and
the executable checks are in `game/test/pressure-corridor-expanded-routes.test.mjs`.
The focused run passed all three tests with no skips, failures or cancellations
on Node20.19.5. This is not a full suite, host-input test or public playtest.

A second bounded cohort passed **nine complete routes** (six unchanged historical
recipes plus the three new cases), with **29 explicit name-filter skips** and
zero failures/cancellations in 4.93 seconds. Changed-file ESLint10.10.0,
Prettier3.6.2, syntax and whitespace checks pass. The available read-only ESLint
installation used byte-identical repository configuration/localization rules;
no dependencies were installed or copied. Independent source review found no
blocking issues. Exact mission/preset/control/seed tuples are pinned explicitly;
replay and paired-board authoritative checkpoints remain exact comparisons.

## Observations and limits retained

The initial bounded experiment replayed the six old recipes across Standard,
both steering modes and seeds1/917. Only their six originally qualified cases
cleared unchanged. The other18 stopped short or lost a life. This shows that
timed commands are not universally portable; it does not establish that those
maps or controls are broken. The new continuations use legal commands rather
than changing enemy state, quotas, geometry or expected historical goldens.

Pressure ladder's Grid recipe spends its last phase finishing coverage after its
interceptor episodes. Switchback seed917 changes early fill enough that part of
the old prefix becomes safe walking; no capture occurs between ticks3523 and6190.
The successful second-seed route is therefore **not** evidence of efficient
cleanup or enjoyable pacing. Cooling loop's additional cuts likewise establish
feasibility, not an optimized route. Rejected continuations remain exploration,
not product regression failures or passed qualification.

An early in-memory harness draft incorrectly read `edition` from the compiled
project instead of checking the authored source revision. That assertion failed
before simulation; it was corrected before the recorded three-test run. Disk
exhaustion also interrupted an initial file write/rebase attempt, which changed
no runtime source. These are not public gameplay failures.

Production testing stays deferred at the user's request. No physical controller,
touch, human enjoyment, all-preset, all-seed or mastery-award claim is made. Runtime
mastery still requires its separate current-edition implementation; observing
its design conditions does not award it.

## Remaining work, in order

1. Integrate PR820 and this bounded evidence batch through the existing publisher
   and required hosted source/build/provenance gates. Keep release publication
   separate from PR creation or merge.
2. Extend complete routes to Gentle and Expert, then fill the missing steering
   and seed combinations. Current broad matrices mostly prove first returns;
   these three additional cases do not close whole-Journey qualification.
3. Review unnecessary safe travel, final coverage cleanup, optional mastery and
   erosion repair choices before default promotion. Preserve rewarding skilled
   shortcuts; do not raise quotas or speeds merely to lengthen play.
4. Continue targeted Ukrainian spatial batches, complementary Team routes and
   original P13–P15 accessibility/performance/human qualification separately.

The latest local-change audit remains owner-scoped: Levels changes are pushed as
their own reviewed batch; active Pause, soundtrack, Creator and UX/root edits
require their owners' exact push/PR receipts. Historical preservation and
dependency/report residue are not new runtime release inputs.
