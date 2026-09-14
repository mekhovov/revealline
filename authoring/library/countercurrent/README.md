# Countercurrent: source geometry and input proofs

These are proposed wide Arcade maps for planning slots `unassigned-13`–`unassigned-15`. Their source IDs are reserved below; the production register and every prior map remain unchanged. The current slice contains no new artwork, story, soundtrack, installed chapter, runtime catalog entry or public release. Geometry validation and the recorded core/replay/session proof have passed. The proof reproduces 168 ordinary wins, 12 first-loss controls, 12 recovered wins and six separate game-over controls, with 824 nonempty saved continuations and 12 endpoint restores. The dedicated mechanic assertions also pass under both supported Node runtimes. **No native acceptance, human balance or artwork quality is claimed.**

| Slot and map                                          | Decision to demonstrate                                                                                                           | Existing primitives                                                                                     |
| ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| 13 · `countercurrent-offset-docks` · Offset Docks     | Upper-first and lower-first returns around two opposite hooks; distinguish a solid wall from captured safe ground.                | Two field bouncers, one outer border patrol, optional enemy-slow contact bonus.                         |
| 14 · `countercurrent-sandbar-braid` · Sandbar Braid   | Choose a crossing order through four staggered bars; read a warned interceptor and avoid making the slow patch a compulsory trap. | Two bouncers, finite head-intercept pressure on one, slow terrain, optional player-speed contact bonus. |
| 15 · `countercurrent-crossing-watch` · Crossing Watch | Create a safe return between unequal islands and time two independently warned lanes.                                             | One horizontal and one vertical lane actor, one bouncer, optional enemy-freeze contact bonus.           |

Lane actors aim at the craft's row or column when the warning begins. Their fixed periods differ; the lanes themselves are not fixed map coordinates. This is a pair of timed hazards, not a staged boss or a new enemy type. Walls cannot close an unfinished cut. Each board is 72×36, uses the actual `arcade-actions.v1` policy and opts into capture stopping. Manual Scan, Boost, pickup and class switching are absent from every proof input; no historical Tactical policy changes. The seven explicit selectable recipes are Scout, Light carrier (`bomber`), Heavy carrier, Interceptor, Fiber relay, Impact craft and Trapper. Their identities and passives are tested separately even when the legal direction inputs coincide.

The coverage targets are 64%, 66% and 68%. No hard mission clock, cut timer or cable length limit is introduced here. The `[60, 120]` medal targets are provisional authoring values, to be calibrated against actual successful runs and native play. Optional powerups must not be necessary for either ordinary solution. Contact bonus behavior requires separate measured probes, not a claim inferred from a descriptor.

## Source setup

`build.mjs` owns finite data from `layouts.json`, calls the existing scenario and pack validators, compares wall masks with 15 existing geometry exemplars (including reflections), and checks that each new open space is connected. The 15 comparison maps are not 15 production families. The compiler's internal prepared pack exists only to supply the existing execution/session APIs with an exact source owner. It is never emitted, registered, installed or offered for download.

The explicit export writes only the three scenario JSON files to a new cache directory. Existing destinations and symlink ancestors are refused by the shared source writer; this is ordinary source tooling, not a hostile concurrent-filesystem guarantee.

```sh
node authoring/library/countercurrent/build.mjs --inspect
node authoring/library/countercurrent/build.mjs --out .cache/countercurrent-scenarios-1
node --test authoring/library/countercurrent/test-source.mjs
```

The metadata-only test file does not create or advance a core run. It covers reflected geometry refusal, source ownership, exact Arcade roster, command bounds, getter refusal and scenario-only export without overwrite. Static validation cannot establish fair warnings, meaningful alternative routes or winnability.

## Recorded source proof

`controls.mjs` contains explicit finite direction/tick/waypoint commands. It never moves an actor, changes cells, removes enemies or changes a core checkpoint directly. A blocked waypoint refuses within 3,600 ticks; a route refuses beyond 21,600 ticks. The metadata-only setup checks do not invoke those controllers. Revisions of failed controls and their raw results must be retained before recording a successor.

The six ordinary Scout routes preceded the exact Standard/Gentle × immediate/grid-center matrix. Its initial result was 126/168; the same three Gentle schedules failed under every recipe and turn policy. Three route-only changes closed the affected 42. Initial loss/recovery controls passed 28/30; the Gentle Crossing Watch recovery needed its own 300-tick pause after the real loss instead of the fresh route’s 540 ticks. Both corrected policies then passed. All earlier outcomes and exact commands remain in `.cache/countercurrent/`. Geometry, pressure, bonuses, coverage and acceptance stayed unchanged.

The first complete source proof subsequently passed all 198 contexts in one recording: 168 bonus-free ordinary wins (two routes × three maps × two difficulties × two turn policies × seven selectable recipes), 12 Scout first-loss controls, 12 Scout recovered wins and six separate Standard game-over controls. It advances 646,008 actual core ticks and checks 836 saved boundaries. Four of the authorized twenty bounded candidate batches were used. This is finite authored-route evidence, not exhaustive reachability or balance proof.

The verifier records actual input segments, claimed-cell hashes and positions per closure, field/pressure/lane events, slow-terrain ticks, lives lost, capture stopping, final replay and checkpoint hashes. Captures must stop with zero speed and no queued turn. A neutral command after a nonterminal capture must not resume movement. North and south alternatives must show different capture order or a different return corridor, not merely a different starting wait.

At actual unfinished-cut, pressure warning/commit, lane warning/active, slow crossing, capture-stop and recovery boundaries, the verifier uses `suspendSession`/`restoreSession` with the exact execution key, recipe, procedural presentation identity and null story. Replaying each of the 824 recorded nonempty suffixes produces the same final checkpoint and replay. The 12 recovery endpoint-only restores are counted separately. These source-only procedural identities are not produced or owned picture assets.

`mechanics.mjs` owns twelve finite Standard/immediate/Scout controls, including one explicitly different pressure-off sandbox. It uses ordinary public inputs and never patches a running state. The recorded assertions establish:

- Offset Docks blocks an unfinished return against its upper wall at `(20.5, 10.18)` with zero speed, a live trail and no capture. A wall is not safe claimed ground.
- The three contact bonuses activate on the next tick and expire after 720 enemy-slow, 600 player-speed and 360 enemy-freeze ticks. Player speed reaches 18.75 cells/s; the frozen-actor comparisons remain unchanged until expiry. Ordinary solutions collect no bonus.
- Both Braid ordinary alternatives cross slow terrain for 48 ticks. The separate warning-window return starts from the actual second warning at tick 1602 and closes at tick 1670, before its tick-1722 commitment. The pressure-off contrast keeps a distinct `sandbox1` owner; it never replaces the authored pressure-on proof.
- Watch’s first warnings occur together at 2 seconds. The horizontal and vertical active phases begin at ticks 421 and 457 and overlap for 42 ticks. Deliberate horizontal contact loses a life to `boss-lane`. The separate vertical control waits beyond horizontal activity and loses a life to a line-impact front owned by `watch-vertical`; that is recorded as `enemy-trail`, not mislabeled as a direct body contact.
- A real inward cut followed by 2,400 neutral ticks gains no coverage. Docks keeps the unresolved cut through the interval; Braid loses a life to its interceptor at about 19.06 seconds, and Watch loses one to the horizontal lane at 3.5 seconds. No universal idle punishment is claimed.

Retained probe mistakes include a one-tick input that never left safe ground, a vertical return along an already captured column that correctly caused no loss, and an attempted vertical contact that first hit the overlapping horizontal lane. The corrected vertical probe waits until that horizontal activity ends. Focused refusal checks reject altered proof content, a missing matrix context, foreign geometry, a mismatched execution owner, a corrupted replay checksum and a foreign picture identity. They preserve the valid saved prefix and current run. Native gameplay remains unqualified.

Final Node20 validation passes all eight source/proof tests in one run. Node22 first passed seven of eight, including the complete 198-context replay/session proof and all twelve mechanics; its only failure was a new test expecting a later generic rejection message when the corrupted checkpoint was correctly refused earlier by the section-checksum guard. That expected message was corrected, and the affected owner test passes separately. Thus eight distinct checks are covered on each runtime; no fresh full Node22 run is implied. The retained raw logs and before-fix test are in `.cache/countercurrent/final-check-1/`.

```sh
# Heavy: run only in the admitted simulation window.
node authoring/library/countercurrent/verify.mjs --record
node authoring/library/countercurrent/verify.mjs
node authoring/library/countercurrent/mechanics.mjs --record
node authoring/library/countercurrent/mechanics.mjs
node --test authoring/library/countercurrent/test-source.mjs authoring/library/countercurrent/test-proof.mjs
```

The recorder writes `routes.json` exclusively only after the complete required matrix passes. The independent mechanic recorder similarly writes `mechanics.json` only after its assertions pass. Neither command can overwrite an existing proof; ordinary verification reads and compares the retained proof. The proof records source hashes and exact execution owners; there are no managed-media or player-profile writes.

## Boundaries before artwork or distribution

The current wide/Classic scenarios require `masteryDefinition: null`. Existing legacy mastery also has finite equipment compositions, but none establishes support for new durable wide-map badges. Reveal, Precision and Pace remain measured outcome dimensions pending their own implementation. Theme originals, exact first-earned ownership, four-theme identity remapping, catalog admission and native capture/continuation/complete-map checks belong to later, separately reviewed work.

Native acceptance must inspect every map's actual capture routes and warnings, including a retained loss and retry. Test the whole wide board at desktop, portrait tablet and landscape phone sizes without putting 44px controls over it. No physical controller, touch, native play, media quality, public build or full campaign acceptance follows from source or modeled-input proofs.

Related contracts: [Classic runtime](../../skills/xonix-level-designer/references/classic-runtime.md), [enemy pressure](../../../docs/enemy-pressure.md), [Fracture source proof](../fracture-lines/README.md), and [ordinary source writer](../sentinel-circuit/files.mjs).
