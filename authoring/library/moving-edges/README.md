# Moving Edges · three source candidates

Three original 72 × 36 families for slots **16–18** now have bounded Scout route and mechanic proofs. Terrace Stitch, Survey Wheel and Breakwater Return use existing registered behavior. They add no runtime catalog entry, production approval, artwork, installable chapter or release version.

The source starts at Countercurrent geometry commit `3428aa1d2f345f78939df0355a853eac84f52ca2`. Existing layouts, IDs, recipes, core and earlier proofs remain unchanged. The builder compares each new wall mask with eighteen prior geometry exemplars and the other new masks, including reflected-mask rejection. This is a geometry check, not a count of approved production families or a human balance judgment.

## Three different decisions

| Slot | Map and target          | Route decision and registered pressure                                                                                                                                                                                                                                                              |
| ---- | ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 16   | Terrace Stitch · 68%    | Unequal stepped terraces offer a north stitch and lower-first circuit. A contour follows changing frontiers. Claiming the rover's starting cell triggers a 120-actor-tick warning before it moves on claimed ground. Leave a departure after closing each cut.                                      |
| 17   | Survey Wheel · 70%      | An offset wall hub and separated spokes leave unequal sectors. Two contours travel in opposite authored directions. Compare a cross-sector stitch with the outer circuit while a field interceptor warns, commits and cools down. The eastern slow patch and remote enemy-slow pickup are optional. |
| 18   | Breakwater Return · 70% | Offset barriers shelter a bay and western cove. Choose a repair route or an earlier outside capture. Two eroders warn before reopening vulnerable claimed cells. Repair restores coverage; previously credited cells cannot award score again.                                                      |

The walls are static and cannot reconnect a cut. No movable gates, new boss stages or new collision primitives are implied. All scenarios have `encounter:null`, `masteryDefinition:null`, existing `arcade-actions.v1` and stop on capture. Manual ability, boost and pickup actions are disabled by Arcade policy; contact pickups still work. All seven class recipes remain selectable and byte-exact, but only Scout has been replayed here.

Standard and Gentle are distinct current execution identities. Both Immediate and Grid (`grid-center`) turning are qualified at seed 1. The maps impose no mission, cut or cable deadline. Their time-medal targets `[60,120]` are provisional and have not been calibrated through native play. No Expert difficulty is invented.

## Actual finite evidence

The two certificates remain separate. The mechanics qualification authenticates the already-recorded ordinary proof without reexecuting its 24 routes.

| Certificate                                  |                  Executed contexts |  Ticks | Saved checks | Nonempty suffixes | Endpoint restores |
| -------------------------------------------- | ---------------------------------: | -----: | -----------: | ----------------: | ----------------: |
| [routes.json](routes.json)                   | 24 clean, bonus-free ordinary wins | 55,876 |          208 |               208 |                 0 |
| [mechanics-proof.json](mechanics-proof.json) |              52 dedicated controls | 76,380 |          290 |               274 |                16 |

The ordinary matrix covers two materially different capture decisions per map, two difficulties and both turning modes. Its actual capture-cell hashes and return coordinates differ for north/south. Every capture stops movement, and a neutral following tick does not restart it. The routes use waypoint inputs; no timed idle is used to obtain a win. Difficulty-specific return schedules reflect actual actor timing rather than changing geometry, enemy speeds or quota.

The 52 additional controls comprise:

- **12 recovery wins:** one actual self-contact failure, real respawn and a legal completed win on each map/difficulty/turn context.
- **12 terminal controls:** actual self-contact game overs with three losses in Standard or five in Gentle. These are not enemy-caused losses.
- **16 actor controls:** a separate loss and recovery attributed by `player.failed` to the claimed rover, counterclockwise contour, western eroder or warned interceptor, in each difficulty/turn combination.
- **4 warning escapes:** the interceptor warns at tick 49 with commitment scheduled at 169. A real 36-cell cut closes at tick 132 and cancels that warning with `trail-closed`. The recorder measures actual travel during the escape and saves its warning boundary. This is cancellation before commitment, not evidence of a committed attack.
- **4 extra-life wins:** one real failure, contact collection with gain 1, then a win. `livesLost` stays 1 and the result is not clean Gold even though the lost life has been replaced.
- **4 enemy-slow demonstrations:** actual contact starts the effect on the next tick; the recorder checks its last active tick and expiry after the fixed 720-tick interval, with restored continuations. A bounded stationary interval belongs to this explicit effect demonstration, which ends running; it is not a waiting win.

Dedicated interceptor-loss controls also observe actual warning, commitment and cooldown. Their bounded wait intentionally allows an enemy to strike an open trail. This negative control does not imply that waiting is required for ordinary play.

The retained ordinary evidence records contour patrolling and rejoining honestly, rover warning/activation, actual erosion and recapture. Both Breakwater north routes repair previously eroded cells. The south comparison differs by difficulty: Standard north erodes two cells and south one; Gentle north and south each erode two. Therefore a universal claim that the outside route always incurs less erosion is **not supported**. The driver independently unions all `cells.claimed` indices on every tick; `uniqueClaimedCount` and score must match that first-time union, so erosion cannot decrease credit or enable duplicate scoring.

Saved controls serialize real v4 sessions, preserve exact presentation pins and continuation input, restore the exact checkpoint, replay the unchanged remaining input and compare the final checkpoint and complete replay. Endpoint restores are counted separately. Terminal game-over states themselves are not misrepresented as resumable saves.

## Source and verification

- [layouts.json](layouts.json) and [build.mjs](build.mjs) hold the finite geometry and use current scenario/pack validators. The internal procedural pack supplies an execution owner; it is not exported or installed here.
- [controls.mjs](controls.mjs) owns bounded input data and changes a run only through public input ticks.
- [verify.mjs](verify.mjs) owns the original ordinary certificate. Its source/header and recorded proof remain byte-exact after qualification.
- [mechanic-cases.json](mechanic-cases.json) and [mechanics.mjs](mechanics.mjs) own the separate fixed controls, actor assertions and session continuation checks.
- [mechanics-plan.json](mechanics-plan.json) keeps the initial design requirements with a results supplement and clearly deferred claims.
- [test-source.mjs](test-source.mjs) checks geometry, Arcade policy, command ownership, safe export and foreign-request refusal without replaying ordinary routes. [test-mechanics.mjs](test-mechanics.mjs) checks the actual additional certificate and tampered proof refusal.
- [AI-REQUEST.md](AI-REQUEST.md) gives a bounded follow-up request using the existing level-design and classic-role guidance.

To verify source and the separate mechanic certificate on a materialized exact checkout:

```sh
node --test authoring/library/moving-edges/test-source.mjs authoring/library/moving-edges/test-mechanics.mjs
```

The standalone recorders accept `--record` only with an absent output. Recording is not an implicit verification step. Preserve the existing certificates and all failed runs; after a substantive source change, create an explicit successor and review affected contexts before expanding execution. No global suite, runtime build, artwork generation or catalog adoption belongs to these commands.

Initial route failures, blocked candidate directions, insufficient captures and unsuccessful actor-contact proposals were retained in the worktree's ignored `.cache/takeover` evidence. Geometry, pressure, quota and ordinary acceptance stayed unchanged. An initial sparse dependency omission was also retained separately from actual gameplay failures. Required base dependencies were then materialized from the exact Git commit, without copying another worktree's changing source.

## Acceptance limits

These are deterministic core/input/replay/session proofs at seed 1 for Scout. Other selectable classes, additional seeds, physical devices, native comprehension, readable final art and human balance remain unqualified. No new durable achievement schema is implemented: Reveal is the actual win, Precision requires zero lives lost, and Pace uses a future calibrated authored target with the existing tolerance. The safe-cell erosion-protection algorithm remains unchanged; this cohort does not independently demonstrate every protection anchor.

TAITO's [official Qix description](https://www.taito.co.jp/en/mob/topics/14971) distinguishes threat domains. The [Mokoko X publisher description](https://store.steampowered.com/app/1785000/Mokoko_X/?l=english) motivates varied pressure and capture decisions. Applying those broad principles is an original project design choice; these layouts, routes and timing claims come from this project's source and recorded runs. No reference maps, images or code were copied, and no fresh reference-game play observation is claimed.
