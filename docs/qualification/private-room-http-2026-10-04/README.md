# Native private-room HTTP qualification — 4 October 2026

The browser control lifecycle, actual HTTP server, native game engines,
presentation cursor and terminal verifier now run together through controlled
delivery failures. No production gameplay or transport rules changed.

## Demonstrated outcomes

| Accepted mission | Mode and seed                    | Result through HTTP                                                                                                                             |
| ---------------- | -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Cable Cutoff     | Snake Versus, Normal, seed 17    | Both boards clear 12 targets; draw; 24 unique catch cues; native result and embedded replay reproduce                                           |
| Cable Cutoff     | Snake Team, Normal, seed 17      | Shared quota clears; both players contribute; 12 unique catch cues; native result and embedded replay reproduce                                 |
| Crossing Post    | Capture Versus, Standard, seed 1 | Both boards contact-catch Patroller and Courier, then clear; 1,322 native ticks; native result reproduces                                       |
| Pincer Yard      | Capture Team, Standard, seed 17  | Each player contact-catches a target, a native downing/rescue occurs, and the capture goal clears; 1,661 native ticks; native result reproduces |

Recipes come from the accepted catalogue/pilot preparer. Existing legal
completion commands travel through `/input`; the fixture never assigns actor
positions, targets, collision state, objectives, scores or results. Both seats
download the same terminal receipt. Verification binds the accepted recipe,
content hash and server engine version; it grants no local progression or
server signature.

## Fault coverage

- A real HTTP relay duplicates a request. Acknowledgements agree, the command
  queues once, and the terminal input history contains no duplicate sequence.
- A superseded sequence delivered late cannot replace the queued direction.
- The relay closes the response socket after admission. The actual client
  observes a failed fetch, suspends controls and rebases to the acknowledged
  sequence during recovery.
- A 59-second disconnected interval advances no native game time. Recovery
  clears queued input, acknowledges shared Pause and needs two fresh Ready
  votes. One Ready cannot resume play.
- An input body held across recovery receives `STALE_ACTIVATION`. An older
  snapshot released afterward cannot replace or suspend the new activation.
- Duplicate snapshots emit no repeated catch cues. Recovery silently primes
  the journal; subsequent catches emit once.
- Two rematch votes preserve the recipe/seed, reset native state and input
  acknowledgements, and require new readiness. Old activation tokens remain
  rejected and prior effects do not replay.

The eight existing HTTP service regressions remain, including expiry after
60,001 ms, a body outliving expiry and disconnected waiting-room readiness.
The service runs its own 120 Hz simulation. The Snake driver observes each
completed grid move before its next turn; a decimal clock increment alone is
not movement evidence. Capture controls use accepted native tick segments.

## Verification and limits

- Node 22.22.2: all `game/test/online-room*.test.mjs` — **73 passed**.
- Node 20.19.5: service and HTTP qualification files — **12 passed**.
- Both runs have zero failures, skips or cancellations. Targeted ESLint and
  formatting checks pass.
- [Working-tree evidence](evidence.json) records tested file/TAP hashes and the
  base commit separately. Exact-head CI/source qualification follows after
  the parallel work is committed; this receipt is not a clean-source build.

The shared fixture uses real Node sockets on loopback. Only wall-clock time,
interval wake-up and HTTP delivery are controlled. New cases have 30-second
deadlines. Owned servers, held responses and sockets are closed after each
case. No browser tabs or public endpoints are involved.

This does not measure internet congestion, Wi-Fi/cellular transitions, TLS,
deployed reverse proxies, restart durability, physical controls, mobile
suspension, actual sound-device playback or human enjoyment. An approved HTTPS
endpoint and real-device/network review remain required for hosted private
multiplayer. Public matchmaking and networked SIM remain separate optional
work.
