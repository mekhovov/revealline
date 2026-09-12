# Fieldcraft equipment challenges

Fieldcraft adds **four mechanically distinct maps** to the FPV theme, with an original procedural rock track, two-relay layouts, explicit cut budgets, emitter/supply interactions and recovery choices. It responds to the [initial balance survey](round-11-balance.md), whose winning routes never entered interference or used equipment. The base campaign and the two original expansions are unchanged.

Open the game's **Library → Packs**, choose **Install fieldcraft**, then select **Fieldcraft** from the campaign selector. Each map's mission brief recommends a class and explains its interaction. Every class remains selectable; no unsupported “must use this ability” gate is added. The pack is normal data at [fieldcraft.json](../game/content/packs/fieldcraft.json), so the same file can be imported, exported and revised through the existing pack workflow.

## What changes in play

| Map | Recommended choice | Actual interaction | Other viable approach |
|---|---|---|---|
| Copper Crossing | Fiber relay | A full-width interference band lies across the route. Fiber crosses it at full speed and still respects the live cable and 36-cell cap. Separate cuts restore two relays on opposite sides. | Ordinary craft complete the same intended waypoint path more slowly; a 12-second cut limit permits that fallback. |
| Switchyard Circuit | Light carrier, then Heavy carrier | Collect at the west pad, place a field near its emitter, cross the field, and use the south hangar to change craft. A second pickup and field suppress the south emitter before the next cut. | Ordinary captures clear both relays without supplies or class changes, with additional time in interference. |
| Pulse Recall | Impact craft | A nearby moving actor threatens the live cable. Pulse abandons that unfinished cut, suppresses the emitter and holds the actor briefly; after redeployment, a safer cross-field cut completes the mission. | Plan the safer route from the start. Pulse is a recovery tool, so the intentional abort is not the shortest route. |
| Net Loom | Trapper | Collect a net, begin the vertical cut and place it near the approaching actor. Its slower movement gives the live cable time to close. A shorter second cut restores the lower relay. | Use a longer three-cut detour around the walls and actor instead. |

These are fictional arcade regions, timings and abilities. The data contains no real weapon performance model or tactical parameters. Drone role references and their deliberately abstract game mappings remain in [the role research notes](research/round-11-drone-roles.md).

## Measured results

The [specialty verifier](../scripts/verify-specialty.mjs) checks **70 recorded attempts**: eight specialty clears, 56 ordinary clears covering all seven classes in both turn modes, and six matched traces that omit action. Every attempt is reconstructed through the normal portable replay validator and its authoritative checkpoint. Across the records, 113,336 input ticks are played, then independently replayed again.

| Evidence | Immediate steering | Grid-center steering |
|---|---:|---:|
| Copper Crossing — fiber clear | 10.88 s | 10.88 s |
| Copper Crossing — ordinary interceptor path | 31.23 s | 31.26 s |
| Switchyard — two fields and hangar change | 10.08 s | 10.08 s |
| Switchyard — ordinary interceptor path | 12.97 s | 13.06 s |
| Pulse Recall — abort, recover and clear | 9.33 s, 3 lives | 9.33 s, 3 lives |
| Pulse Recall — identical commands, pulse omitted | 9.33 s, 2 lives | 9.33 s, 2 lives |
| Net Loom — net-assisted clear | 5.89 s | 5.89 s |
| Net Loom — ordinary interceptor detour | 11.04 s | 11.04 s |

The fiber route spends **489 ticks** geometrically inside active interference while remaining unaffected. The ordinary comparison is slowed for more than 2,000 ticks. Both restore the same two relays and capture 74.10% of the field. The ordinary route remains possible with no active ability.

The Switchyard route collects **two supplies**, activates **two fields**, crosses **both suppressed emitter regions**, and performs **one real hangar class change** from light to heavy carrier. The second pickup fills two slots; the following drop leaves one. The same timed input trace with action omitted falls behind and has captured only 28.88% at the role route's finish, compared with 71.12% for the supported route. The separate ordinary route proves this is a useful shortcut rather than an ability gate.

Pulse Recall deliberately starts a threatened live cut. Its pulse aborts that cut and stuns the actor for 360 observed ticks. Removing only the pulse command causes a real `enemy-trail` failure at **1.05 seconds**. The subsequent route still completes, but with two lives and a silver medal. With the pulse it completes with all three lives. The ordinary fallback avoids the initial threat and clears faster; this is the expected tradeoff for a recovery ability.

Net Loom applies its field while the cable is exposed and slows the threatening actor for **479 ticks**. Removing only the net command causes an `enemy-trail` failure at **1.05 seconds**; continuing the now-inappropriate recorded movement later causes another failure. The test relies on the first cable contact to demonstrate the net's benefit. A separate, deliberate no-ability route completes with three lives, so that failed input sequence is not described as an unwinnable class.

The specialized Copper Crossing, Switchyard and Net Loom routes earn gold under their authored thresholds; their ordinary comparison routes earn silver. These are initial challenge targets, not measured human skill percentiles. Optimized input routes do not establish beginner difficulty, enjoyment, touch usability or a finished retention curve.

## Verify or watch a route

From the repository root on Node 20.19 or newer:

```sh
node scripts/verify-specialty.mjs
node --test game/test/specialty-playthrough.test.mjs
node scripts/verify-packs.mjs
```

The specialty fixture is [fieldcraft-routes.json](../game/replays/fieldcraft-routes.json). It records the exact input segments, map/class hashes, class history, summary, event timeline, role metrics and full authoritative checkpoint. The verifier rejects stale hazards or substituted inputs. It requires actual role evidence in addition to victory: entering interference, suppressing emitters, collecting supplies, changing craft, abandoning a live cut, slowing/stunning an actor and preventing a matched cable failure.

Open [Replay Theater](../game/replay-theater/) to watch all four built-in equipment examples. Select an example and choose **Load example**, then **Play**. Pause, step one tick, restart or change speed to 0.5× / 1× / 2×. The theater also accepts a standard replay file or pasted JSON:

```sh
node scripts/verify-specialty.mjs --export fieldcraft-02 grid-center --out fieldcraft-switchyard.replay.json
```

Choose `fieldcraft-01` through `fieldcraft-04` and `immediate` or `grid-center`. The output is a normal `xonix-replay.v3` file; existing output is not overwritten. In Replay Theater, open **Import your own replay** and choose the exported file. Watching a recording does not count as a player completion or grant earned progress. The initial import is verified before it appears, and playback rechecks its final authoritative checkpoint. Theme changes affect presentation only. See [Replay Theater behavior and maintenance](replay-theater.md) for the module contract and example refresh procedure.

After deliberately editing and reviewing this pack, refresh its proofs with:

```sh
node scripts/verify-specialty.mjs --record
npm exec -- prettier --write game/content/packs/fieldcraft.json game/replays/fieldcraft-routes.json game/replays/expansion-routes.json
node scripts/verify-specialty.mjs
node scripts/verify-packs.mjs
npm test
```

`--record` regenerates the 70 specialty records and the eight Fieldcraft interceptor entries in the ordinary expansion fixture. It preserves the existing Night Shift and Living Threads entries. Both turn modes execute real movement; the route authoring helper only reads position to decide when to change normal controller input. It never moves an actor, assigns cells, alters lives or bypasses a timer. Commands stop within a small positional tolerance after signal speed changes; immediate turns may therefore trace a slightly different path from queued grid turns.

## Release coverage

Together with the original content, the runtime now supplies **22 maps**: 12 base plus 10 expansion maps in three packs. Ordinary completion fixtures cover **24 campaign** and **20 expansion** configurations. The original 252-case roster baseline plus Fieldcraft's 56 all-class fallback clears cover **308 map/class/turn combinations**. Seed 1 is used because these authored maps contain explicit geometry and actor motion rather than seeded encounter generation.

This pass changed pack data, verification tooling and tests; it did not alter the core simulation or the accessible base campaign. The full repository suite passed **432/432** tests after integration, and content/reference validation passed. Built-browser input, visual, audio and device observations are tracked separately by the release review.
