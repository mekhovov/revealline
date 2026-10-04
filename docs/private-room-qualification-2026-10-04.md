# Private-room connection qualification — 4 October 2026

## Completed correction

Room liveness now uses elapsed wall-clock time independently of simulation ticks. The service checks it before refreshing a returning seat's heartbeat, after receiving a delayed action body, and during maintenance even when a service stall permits no simulation catch-up.

Previously, the five-second shared pause and sixty-second abandonment checks ran only inside `stepAuthoritativeRoom`. A stall deliberately schedules no game steps. A heartbeat arriving before a later game step could refresh `lastSeen` and revive an expired seat. Waiting or already-paused rooms also retained earlier Ready choices after a disconnect.

The corrected behavior is:

- A missing seat pauses live play after five seconds and invalidates both earlier Ready choices, including in a waiting or already-paused room.
- Either seat missing for more than sixty seconds abandons the room, clears queued and held controls, and returns the existing terminal `ROOM_UNAVAILABLE` response. A late heartbeat cannot revive it.
- A request body that finishes after expiry or removal cannot act on the stale room object it originally acquired.
- Returning within the reconnect window preserves the paused game clock and state; both seats must make fresh Ready choices. Old activation tokens remain rejected.
- Completed results retain their existing retention and rematch behavior. This correction does not introduce a simulation catch-up, rewards, new transport protocol, public matchmaking, or a hosting claim.

## Research informing the review

The Node.js timer documentation explicitly does not guarantee exact callback timing or ordering. Consequently, the service must compare wall-clock deadlines at admission rather than treat periodic timer execution as the deadline authority. [Node.js timers](https://nodejs.org/api/timers.html)

Browsers throttle timers in background tabs. Existing visibility/background handlers remain responsible for releasing local controls and requesting shared pause; a background browser's heartbeat is not evidence of continued active play. Device suspension and real network transitions still require separate qualification. [MDN Page Visibility API](https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API)

These are engineering adaptations of the documented platform behavior, not claims of measured wide-area network performance.

## Automated evidence

The user's current request authorizes testing. On Node.js 22.22.2, the focused command is:

```sh
node --test game/test/online-room*.test.mjs
```

Result: **69 passed, zero failed**. The first run found one pre-existing fixture alias: its source and mission titles shared an object, so changing the source label also changed the asserted mission title. The fixture now models separate JSON-owned values.

Two new real-HTTP regressions failed before the implementation fix:

1. A heartbeat after 60,001 ms returned 200 instead of a terminal unavailable result.
2. An old Ready choice and its activation survived a waiting-room disconnect beyond 5,000 ms.

The corrected suite also covers a request body held open across expiry, successful 59-second recovery with two fresh Ready choices and no paused-clock advance, stale activation rejection, duplicate inputs, lost acknowledgements, rematch generations, receipt reproduction, native input ownership, snapshot identity, optional artwork interruption and silent/deduplicated presentation restoration.

HTTP requests use the real Node server and sockets. Only the wall clock and service interval wake-up are controlled; this makes before-maintenance and delayed-body ordering reproducible without pretending to reproduce a mobile network. Shared Capture/Team/Snake engine and legacy receipt regressions remain included in the slice.

## Remaining qualification and priority

| Priority | Item                                                                                     | Why it remains necessary                                                                                                      | Limitation until complete                                                                        |
| -------- | ---------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| P1       | Two real devices across delayed/lossy networks; reconnect just inside/outside the window | Confirm HTTP recovery, notices, no stale controls and fresh two-seat consent under actual scheduling and transport conditions | The passing local HTTP harness is not real-network qualification                                 |
| P1       | Background/suspend and app restoration on phones; physical two-seat touch/gamepads       | Confirm controls release and audio/presentation remain silent during restoration on each supported host                       | Desktop source tests cannot establish hardware ownership or operating-system suspension behavior |
| P1       | Configure and qualify the approved HTTPS room endpoint                                   | Establish TLS, allowed game origins, deployment retention/restart policy and endpoint-scoped credentials                      | Local rooms are runnable; hosted private multiplayer is not delivered                            |
| P2       | Supported-device frame/asset budgets with two boards and repeated reconnects             | Measure the shared rendering/resource lifecycle at actual device limits                                                       | Functional source coverage does not establish memory or frame-time targets                       |

Broader public matchmaking, media-bearing room registries and networked SIM retain their optional status. No endpoint, deployment, artistic approval or device result was invented for this batch.
