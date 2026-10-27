# F04a — Survival checkpoint assessment

## Decision

Single Drone's current simulation can survive a lossless JSON round trip and
continue deterministically in the tested scenarios. F04b is feasible, but it is
**not safe to expose the assessment serializer as a player save format**. This
change provides a test oracle and a checkpoint contract; it adds no save slot,
importer, suspend control or promise of browser/device durability.

“Single Drone” names the Survival operation. Its host defaults to **three
airframes**, and offers one or three. Both settings belong to F04b. Riy, Hunt,
Raid variants, automated reviews and benchmark fixtures remain outside this
checkpoint contract.

## Executable evidence

Run `node --test game/test/overflight-suspend-assessment.test.mjs`.

- Nine opening/continuation scenarios cover V1–V3 and all six current V4 worlds,
  two seeds, all three difficulties across the matrix, both airframe settings and
  the carrier handling profile. This is a representative matrix, not every
  cross-product of content and settings.
- A normal-input V4 field-crossing attempt, seed 7, relaxed difficulty, reaches
  victory after **19,856 simulation ticks / 330.933 seconds** and **10 earned
  choices**. Repeated checkpoints around 60, 100, 190, 275 and 320 seconds
  produce the same complete final state as the uninterrupted branch, including
  elite/final goals, random generators, inactive pool slots and event queues.
  The largest checkpoint in that test is **2,361,379 bytes**. This is an observed
  sample, not a production capacity limit or worst-case memory measurement.
- A pending upgrade restores paused into the same offer. Reroll output,
  consumed-choice history and confirm/boost release remain identical.
- Focused engine fixtures exercise three-airframe replacement and final defeat;
  an armed supply choice and its consumed state; terrain damage, navigation
  Maps and infinite solid-obstacle hull; live piercing hit Sets; and shared
  enemy references. The supply and threat setup is deliberately controlled,
  rather than presented as an independently played full mission.
- The terrain/projectile fixture is serialized to JSON, passed through stdin
  into a **fresh Node process**, restored there and advanced for 90 ordinary
  fixed ticks. Its complete graph digest matches the original process.
- Mismatched build/content identities, unknown format, terminal attempts,
  other mode owners, executable callbacks and invalid numeric state are refused
  by the assessment boundary. Fresh host clock/input owners leave a restored
  attempt paused, omit absent wall time and require a released action button.
- A reopened mastery owner records the same completed attempt again because its
  deduplication key is an in-memory object. Existing earned flags remain
  monotonic, but the previous-attempt comparison changes. This is a demonstrated
  F04b ownership requirement, not a newly introduced gameplay defect.

The test-owned serializer lives under `game/test/helpers/`. It preserves the
entire trusted simulation graph, including object aliases, Sets, Maps, typed
arrays, null-prototype dictionaries, undefined values and infinities. A plain
`JSON.stringify(run)` does not preserve those semantics. The oracle's 8 MiB /
40,000-node bounds are test admission bounds; it is not a hostile-file parser or
a low-memory mobile implementation. It retains derived caches deliberately so
the equality check does not silently omit a field that later influences play.

The build token in the test is a SHA-256 of `core.mjs`, solely an opaque test
compatibility identity. It does **not** identify a real release or its dependency
closure. F04b must use the authoritative packaged build identity and validated
content identity. No cross-version migration is qualified here.

## State contract

| Owner                 | State that must survive                                                                                                                    | Why it matters                                                                                   |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------ |
| Content and rules     | Compiled project or immutable validated source, project identity, rules/balance, difficulty, seed, handling profile                        | The same visible mission name can resolve to different rules or authored content.                |
| Attempt               | Exact fixed tick/time, phase and resume phase, configured/remaining airframes, result reason                                               | An upgrade is a paused decision, not an ordinary playing tick; replacement is not a new attempt. |
| Player and camera     | Position, velocity, heading, hull, invulnerability, boost/shield/pulse/overdrive state and cooldowns, viewport                             | These values change collision, attack and spawn decisions.                                       |
| Random/director state | Both PRNG states, next IDs, encounter cursor, spawn credit, dynamically created movement counts, relief/clear windows and held-boost latch | Reconstructing from the original seed rerolls future threats and cards.                          |
| Build and progression | Modules/branches/ranks, offers, XP, thresholds, rerolls, history with original ticks                                                       | Prevents a restored offer becoming a free extra choice or reroll.                                |
| Actor pools           | Every enemy, projectile, pickup, field, effect, priority attack, echo and pulse slot, plus free-list order                                 | Slot reuse and queued attacks affect future behavior; inactive state is not assumed irrelevant.  |
| Graph ownership       | Projectile prior-hit Sets, support-source references into the enemy pool, grid owner and typed arrays                                      | Lost aliases or hit history can alter damage, support, removal and collision queries.            |
| World and objectives  | Terrain obstacle state/strike tokens and revision, supply guards/arming/choice, props, goal IDs/flags                                      | Reopening a breached wall or claimed supply would change progress or duplicate a reward.         |
| Reports               | Stats, damage causes, defeat feed, transient events                                                                                        | Records and presentation derive from the same actual attempt; pre-suspend audio must not replay. |
| Separate host owners  | Validated appearance/content provenance, writer ownership, result write ownership, recovery UI and navigation intent                       | These are not contained in the simulation object and are not established by graph equality.      |

Implementation sources: `game/overflight/core.mjs`, `grid.mjs`, `terrain.mjs`,
`tactics.mjs`, `project.mjs`, `host-loop.mjs`, `records.mjs`, `mastery.mjs` and
`app.mjs`. The core has dynamically added fields as well as constructor fields;
an eventual explicit schema must inventory both. Any optimization that drops
grids, terrain route caches, scratch arrays or inactive slots must first pass
equivalent continuation tests. This assessment does not prove such omissions
safe.

## F04b acceptance and ordering

1. **Admit a production checkpoint.** Define a bounded, versioned, explicit
   data schema for validated current Single Drone content and its permitted
   settings. Require exact package, gameplay and authored-source identities;
   reject an unavailable or incompatible package before touching the current
   attempt. Use the assessment as a differential oracle, not an importer.
2. **Save one recoverable slot.** Freeze at a paused fixed-step boundary, capture
   a stable attempt identifier and save through the existing profile storage
   owner. Preserve the prior slot and active attempt on quota, failed write or
   cancellation. Replacing/deleting an existing slot requires a clear choice.
   Detect another tab's owner or revision before applying anything.
3. **Restore paused.** Rebuild renderer/audio/input owners from current admitted
   content; never serialize live DOM, GPU, audio nodes or device handles. Start
   a fresh clock, discard elapsed wall time and stale fractional frame time,
   require action release, and use the existing slow-resume preference. A saved
   upgrade must reopen its original decision after explicit Resume.
4. **Own consumption and terminal writes durably.** A restored object must keep
   the same attempt identifier. Define save/resume/consumed transitions so a
   stale slot or second tab cannot complete the same attempt twice. Coordinate
   retries with the existing score and mastery stores; confirm each store's
   result before retiring recovery evidence. Existing per-object WeakMaps and
   monotonic achievement flags do not establish this across restarts. No new
   all-store transaction is assumed.
5. **Qualify failure and return flows.** Cover save failure, interrupted resume,
   replacement, incompatible content/build, backgrounding, duplicate tabs,
   terminal-write failure and reopening after each durable transition. Keep
   recovery actions understandable and test source-host behavior separately
   from the exact packaged browser and installed-device candidates.

F04a has no dependency on F11 archives or F14 readiness. F04b remains an
**8–15 working-day** feature estimate after this assessment; source-level
determinism does not remove storage/lifecycle/UX work. Physical iPhone and Deck
testing is **not tested** because those devices are unavailable. Desktop browser
storage, packaged launch and actual process eviction are also outside this
Node-only assessment. A rolling update at the same URL cannot be called a full
rollback; a checkpoint from another build must remain safely rejected unless an
explicitly qualified compatibility path exists.
