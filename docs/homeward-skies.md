# Homeward Skies

Homeward Skies is a three-picture Ukrainian-inspired FPV chapter. Each mission reveals its own original pixel-art illustration: an orchard at dawn, a riverside railway town at sunset, and a hilltop beacon above a town returning to light. The pictures are collectible level rewards, with the existing reveal finale and completed-picture gallery. Active aircraft, cable, relays, interference and fields remain separate gameplay layers.

Open **Library → Packs → Install homeward-skies**, then choose **Homeward Skies** in the campaign selector. Its seven classes are all available. Mission briefs recommend equipment; the actual victory rules require territory and captured relays, so equipment recommendations are not compulsory ability gates.

| Mission          | Actual target and pressure                                                                   | Recommended interaction                                                                                                                                              | Picture                                  |
| ---------------- | -------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| Copper Orchard   | Restore two relays, reveal 72%; a 36-cell cable cap and 12-second cut limit bound crossings. | Fiber relay crosses active interference at full speed. Enemy contact can still break its exposed cable.                                                              | Warm orchard and village dawn            |
| River Switchyard | Restore two relays, reveal 68%; close each cut within 6.5 seconds.                           | Light carrier collects a charge and suppresses the west emitter. At the southern hangar, switch to Heavy carrier, refill and place the second field.                 | Coral railway town and river crossing    |
| Home Beacon      | Restore one relay, reveal 70%; complete the mission within 35 seconds.                       | Impact craft abandons a threatened live cut, suppresses its nearby emitter, stuns the approaching actor and redeploys. A subsequent ordinary cut captures the relay. | Blue-hour hilltop beacon and town lights |

The encounter geometry and legal-input curriculum adapt the first three [Fieldcraft challenges](fieldcraft-challenges.md). Homeward gives those interactions a coherent illustrated chapter with new campaign identity, stories, music settings and independent reward slots. It does not claim three new simulation primitives or mechanically new layouts. All distances, enemy behavior and timings are fictional arcade values.

## Pictures and independent replacement

The [runtime pack](../game/content/packs/homeward-skies.json) is a portable `xonix-pack.v1` file using `xonix-core.v2`. Each `levelVisuals` entry binds one level ID to a `background` descriptor containing the complete PNG data URL, name, `fit: "contain"` and source attribution. A pack can still override player bodies and other image roles independently using the existing content contract; this chapter replaces only its background rewards and music descriptors.

All three original PNGs are **1448 × 1086**, exactly 4:3. Their original bytes are retained unchanged:

| Source                                                                              |     Bytes | SHA-256                                                            |
| ----------------------------------------------------------------------------------- | --------: | ------------------------------------------------------------------ |
| [Copper Orchard](../authoring/library/homeward-skies/backgrounds/homeward-01.png)   | 2,949,901 | `27ac3051d7f9d99c83d26fac70baa3ee309409e296635ef48b7c4417f93d4004` |
| [River Switchyard](../authoring/library/homeward-skies/backgrounds/homeward-02.png) | 2,825,406 | `11a5066a45cfff861a90405764b276ab801a993848379d1c08c4233ee34aa24a` |
| [Home Beacon](../authoring/library/homeward-skies/backgrounds/homeward-03.png)      | 2,741,772 | `4b5da54f1d1023d24a40db5aab7ffe7d4bb1c531a4ed659663e6fad683921363` |

[Retained prompts and review notes](../authoring/library/homeward-skies/prompts.json) document their AI-assisted original creation. The art depicts imagined places inspired by Ukraine, not documentary scenes. It has no baked gameplay HUD or active actors. The existing completion effects animate the presentation; these PNGs do not contain authored frame animation or destructible scenery.

The formatted runtime pack is **11,371,849 bytes**. It fits the existing 24 MiB pack limit, 4 MiB per original image and 20 MiB combined encoded image limit. A local candidate build on this pass precached **19,890,655 bytes across 96 files**, below the existing 64 MiB limit; no budget was increased. Candidate counts can change with concurrent UI work and are not frozen release hashes. The optional pack increases download/cache size even though its three original source PNGs are not duplicated in the playable distribution.

Music is the existing procedural Web Audio system: Orchard Frequency uses synthwave/Dorian at 104 BPM, Riverline uses rock/Dorian at 116 BPM, and Lights Returning uses ambient/major at 78 BPM. These are configurable generated arrangements, not three prerecorded compositions.

## Evidence of class benefits

`node scripts/verify-homeward.mjs` checks **52 attempts**: six recommended-role clears, 42 ordinary clears covering three maps × seven classes × both steering policies, and four matched input traces with only the ability command removed. The records contain 91,958 input ticks, and normal portable replay verification independently reconstructs authoritative state. Every positive and ordinary route completes with three lives and all required relays.

| Measurement                                            |           Immediate |         Grid-center |
| ------------------------------------------------------ | ------------------: | ------------------: |
| Orchard, fiber route                                   |             10.88 s |             10.88 s |
| Orchard, ordinary interceptor                          |             31.23 s |             31.26 s |
| Switchyard, two supplies, two fields, one class change |             10.08 s |             10.08 s |
| Switchyard, ordinary interceptor                       |             12.97 s |             13.06 s |
| Beacon, abort/redeploy/recover                         | 9.33 s, three lives | 9.33 s, three lives |
| Beacon, same commands with pulse omitted               |   9.33 s, two lives |   9.33 s, two lives |

Fiber spends **489 ticks** inside active interference without slowing. The ordinary interceptor is slowed for 2,933/2,936 ticks. At Switchyard the role route crosses suppressed regions for **71 ticks** and finishes with **71.12%** coverage; the same timing with action omitted has only **28.88%** coverage. Beacon's pulse aborts one live cut and holds an actor for **360 ticks**; removing the pulse causes an actual `enemy-trail` life loss at **1.05 seconds**. A careful no-ability Beacon route finishes faster than the recovery demonstration, which is the intended tradeoff for an escape tool.

The [recorded fixtures](../game/replays/homeward-routes.json) include exact commands, gameplay hashes, summaries, event timelines, role metrics and final checkpoints. They prove reproducibility and the measured benefits of those inputs. They do not establish beginner difficulty, touch comfort, human enjoyment or retention. The Node scenario-dispatch test uses an explicit decoder adapter double; actual image decoding, gallery rendering and browser controls require the separate built-browser release checks.

The chapter brings supplied content to **25 maps** in total: 12 base maps and 13 maps across four expansion packs. Ordinary completion fixtures contain 24 base and 26 expansion configurations. The earlier 308 map/class/turn combinations plus Homeward's 42 cover **350** combinations, all at authored seed 1. Reused layouts are counted as separately identified maps, not as new mechanic families.

## Rebuild, verify and watch

Edit the small [source recipe](../authoring/library/homeward-skies/pack-source.json), or replace a reviewed original PNG and update its prompt/provenance record. Keep the same level IDs for art-only updates; deliberately revise the map and pack version when changing shipped rules. Regenerate the runtime pack and review its data and visual changes before refreshing proofs:

```sh
node scripts/build-homeward-pack.mjs --write
node scripts/verify-homeward.mjs --record
npm exec -- prettier --write game/content/packs/homeward-skies.json game/replays/homeward-routes.json game/replays/expansion-routes.json
node scripts/build-homeward-pack.mjs
node scripts/verify-homeward.mjs
node scripts/verify-packs.mjs
node --test game/test/homeward-playthrough.test.mjs game/test/expansion-playthrough.test.mjs
```

The builder embeds exact originals and validates dimensions, format headers, per-image/combined budgets and pack structure. It does not resize or restyle an image. Full browser decoding remains mandatory in `preparePack` before installation. Proof recording refreshes this chapter's six ordinary interceptor entries while preserving other packs' routes.

Export an ordinary player replay with:

```sh
node scripts/verify-homeward.mjs --export homeward-02 grid-center --out homeward-switchyard.replay.json
```

Use `homeward-01` through `homeward-03` and `immediate` or `grid-center`; existing output files are not overwritten. Open [Replay Theater](../game/replay-theater/), expand **Import your own replay**, choose the exported file and press **Play**. The theater can pause, step, restart and change speed. Recordings contain exact gameplay data, so the theater shows its selectable presentation rather than the chapter's embedded reward artwork. Watching does not award player progress. Play the installed chapter itself to see and earn its pictures.

Relevant AI workflows are [Expansion Author](../authoring/skills/xonix-expansion-author/SKILL.md) for pack and challenge changes, together with the art prompts/provenance contract above. Keep artwork generation separate from the deterministic simulation; images never become collision geometry automatically.
