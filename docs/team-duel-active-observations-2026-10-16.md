# Team and Duel native activity observations — 16 October 2026

Two further Mac browser windows completed using normal mission selection,
Restart, explicit Resume and trusted keyboard input. Both use Gentle and sound
off at 1280 × 561 / DPR 2. Team auto-next/auto-retry were disabled before play.
These establish intermittent gameplay and the new visible Duel phase recording.
Sustained pressure, matched-baseline performance and complete memory qualification
remain open.

| Observation                    | Team — Expedition Homecoming                                      | Duel — Crown Photo Finish                                   |
| ------------------------------ | ----------------------------------------------------------------- | ----------------------------------------------------------- |
| Full window                    | 120,003.5 ms                                                      | 30,007.7 ms                                                 |
| Animation-frame intervals      | 14,387                                                            | 3,578                                                       |
| p95 / p99 interval             | 10.1 / 11.2 ms                                                    | 11.0 / 13.1 ms                                              |
| Maximum interval               | 37.0 ms                                                           | 33.2 ms                                                     |
| Trusted keydowns per seat      | 15 / 15                                                           | 9 / 9                                                       |
| Endpoint progress              | 0% → 4.9%; four reserves retained                                 | Each: 0% → 2.7%, 600 points; five lives retained            |
| Bounded activity snapshots     | 120; each seat: 6 line-exposed, 114 reclaimed-ground observations | 60; `running` does not distinguish cutting from safe ground |
| Visible encounter phases       | Explicitly unsupported for Team cards                             | Both seats: `warning`, `active`, `rest`                     |
| Sampled JavaScript heap peak   | 69,132,175 bytes / 25 readings                                    | 122,797,202 bytes / 7 readings                              |
| New resource entries in window | 0                                                                 | 0                                                           |

Snapshot counts are observations, not measured durations spent cutting. Neither
window has a matching main-source run. Frame intervals include browser scheduling
and the observer's work; heap readings are sampled and do not measure retained
ownership, complete decoded media or GPU memory. Owned heavy local checks had
finished; unrelated workstation processes remained present. No improvement,
worst-case load or device-budget claim follows.

## Source and transport

The [binding and summary](verification/team-duel-public/active-observation-source-binding-2026-10-16.json)
pin runtime and observer commit `b7f54e275b67918e734a92bc860c9380e6f591e1`, tree
`746dd29079203333e58955a35d57832ecb99cae5`. The ordinary local development server
served the active worktree. Before play, only test files differed under the
production roots; the postflight check retains that same boundary. Eight served
entry/host/presentation/observer files match their exact Git originals. Later
commits change test/documentation files. This is a source observation, without a
packaged build or public-release identity.

The initial pinned-Git transport exceeded the unchanged 30-second menu-readiness
guard under cold loading and local build contention. Its [discarded log](verification/team-duel-public/team-pressure-pinned-load-discard-2026-10-16.json),
[binding](verification/team-duel-public/phase-pressure-pinned-load-binding-2026-10-16.json)
and lossless response-prepared receipt remain retained. No frame statistics come
from that attempt. Response-prepared pins identify offered bytes, not confirmed
browser consumption. The ordinary-server retry preserves the same readiness,
foreground, pause, result, navigation, mission and duration guards.

## Inputs and visible outcomes

Team used paired small vertical cuts, then fresh horizontal return strips chosen
from the visible field. Duel used three paired down/sideways/up loops. Releasing
a direction does not stop continuous steering. Closure clears the seat's input;
new choices must use the actual visible field. No engine state, events, clock,
seed, position or runtime audio cache was injected.

The [Team raw log](verification/team-duel-public/team-gentle-active-observation-2026-10-16.json)
retains its passing frame sample at event index 9. The [Duel raw log](verification/team-duel-public/duel-warning-active-observation-2026-10-16.json)
retains the Duel sample at index 14; it also contains the earlier Team history.
Selection/focus timeouts remain in those logs. In particular, the first Team
input-attempt entry occurred before true iframe focus and outside the measured
window. The successful sample counts only 30 trusted movement keydowns.

Both screenshots follow completion and explicit pause. Team continued to bank
ground after the measured window, reaching 23.4% before the screenshot at 2:22;
the measured endpoint remains 4.9% at 2:00. Screenshot HUD values must not replace
the raw endpoints. Duel's real cards include the original title and instruction
for each phase, rather than a phase inferred from an English caption.

Raw files, input-attempt timestamps and screenshot SHA-256 pins are in the
binding. The temporary tabs and owned review servers are closed after retention.
Human balance playtesting remains waived, and Duel hardware remains deferred.
The [reviewed plan](team-duel-plan-continuation-2026-10-16.md) retains the remaining
native pressure, public/offline, acoustic and release dependencies.
