# Team visible-miss and relocation route

Follow-up to [reserve-taking qualification](journey-team-reserve-routes.md).
One Expert Depot dash route now demonstrates actual visible expiry followed by
collection at a different anchor and a no-loss shared clear. Both seat assignments
and joint cuts on/off pass: **four successful cases**, not six. No runtime,
geometry, timing, quota, art, enrollment or release changes are made.

## Observed sequence

| Event                    | Tick           | Anchor       |
| ------------------------ | -------------- | ------------ |
| First announcement       | 239            | (19.5, 6.5)  |
| First visible pickup     | 359            | (19.5, 6.5)  |
| Uncollected expiry       | 1559           | (19.5, 6.5)  |
| Relocated announcement   | 2519           | (52.5, 29.5) |
| Relocated visible pickup | 2639           | (52.5, 29.5) |
| Contact collection       | 2836           | (52.5, 29.5) |
| Return and shared clear  | 2857 completed | —            |

The full 1200-tick first availability window and 960-tick cooldown elapse before
the new 120-tick announcement. This is not a cancelled announcement or delayed
first appearance. At tick 2676, the second pickup is visibly present on unclaimed
field, no bonus has been collected, both pilots have already returned at least
twice, and 77.42% coverage is earned. The collector approaches across the lower
field, collects speed, and returns with that effect active. The final clear is
80.27% at 23.808 seconds. The route contains eighteen incidental both-idle ticks
(0.15 seconds), not a parked wait for the schedule.

The partner is **not cutting at contact**. This is relocation feasibility with
both contributing to the clear, not concurrent collection/cooperation mastery.
It does not prove adequate Expert difficulty, human temptation or replay value.

## Exact evidence and limits

`TeamRelocationRouteEvidenceV1` pins the unchanged manifest identity, public input
log, bonus events, collection coordinates, both pilots' returns, first damage,
stop ticks and state/event hashes. Seven tests repeat all runs and inspect the
pre-contact checkpoint and boosted return. The existing helper rejects hidden
braking and stops on first damage; it never injects states or repairs a route.

All 994 combined regression tests pass on Node 20.19.5 and 22.22.2, with lint,
formatting and diff checks passing. Independent review repeated the seven focused
tests on both runtimes and all six direct-engine runs; their exact hashes match.
The two failed-route assertions count toward passing tests, not successful clears.

Reusing this exact log on Gentle and Standard produces knockdowns at ticks 2076
and 2169. Those two negative probes are retained, not counted as clears or as
evidence that the presets are harder. Different enemy timing requires different
routes; preset-specific relocation taking remains open. Earlier successful
ordinary and reserve logs, and the sixteen original failed timing probes, remain
unchanged.

Remaining: Gentle/Standard and other-map relocation routes, additional seed/start
sampling, optional reserve relocation, complementary cooperation, shortcut and
pressure-inversion review, native/device/two-human checks, original pictures and
coordinated reviewed release/Pages. No accepted phase or public deployment is
claimed. These logs do not add an official Team replay/resume format.
