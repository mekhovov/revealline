# Ukrainian cultural spatial triptych

Status: source-ready authored Solo/Versus successor; human cultural and balance review pending. No package version, production asset, tag, deployment or release metadata changes are included.

This bounded batch changes exactly three existing mission identities: **Stepping stones**, **Return pocket** and **Neutral ground**. The registered `whole-spatial-v10` route has its own session and profile keys, while `whole-spatial-v9` remains available as the unchanged historical edition. Mission, campaign and pack order stay authored; only the three owning campaigns and their packs receive the new source revision.

## Route decisions

| Mission         | Safe approach                                                                   | Contrasting approach                                                                              | Readable pressure points                                       |
| --------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| Stepping stones | Connect the near seed landing, then build the short spikelet chain.             | Bypass the near landing and make the longer opening to the broad central sun landing.             | Near seed, sun landing, upper spikelet, lower spikelet.        |
| Return pocket   | Reposition along the safe spine and leave from the upper band mouth.            | Reposition to the lower band mouth, preserving the outside line toward the existing freeze bonus. | Inner pocket, upper mouth, lower mouth, freeze detour.         |
| Neutral ground  | Read the western keeper, then cross the existing slow bed from the side branch. | Climb the safe stem and arc above the existing lethal bed from the upper branch.                  | Central stem, western slow bed, upper branch, eastern hot bed. |

All enemies retain their existing roles, counts, positions, tiers and collision-only movement. Difficulty scaling, coverage, objectives, bonuses, timed-bonus schedules, terrain cells and movement modifiers are unchanged. The new geometry uses foundations and negative space only, so these early missions do not introduce walls ahead of their taught campaign arc. Every permanent component has multiple departures and the field remains connected, so none of the three maps creates a single-exit trap.

The ornament silhouettes do not buy easier coverage by adding safe ground. Stepping stones changes permanent foundation cells from 64 to 62 (eligible capture cells 2316 to 2318), Return pocket 165 to 154 (2215 to 2226), and Neutral ground 145 to 140 (2235 to 2240). With unchanged coverage ratios, each required-capture budget is therefore slightly higher, not lower. This numerical guard still does not prove human difficulty or enjoyment.

## Cultural sources and adaptation limits

- **Lemko pysanka:** Ivan Honchar Museum object [НДФ-1497](https://honchar.org.ua/en/collections/detail/1019), catalogued with geometric/floral ornament and sun and spikelet elements. [UNESCO's Pysanka inscription](https://ich.unesco.org/en/RL/pysanka-ukrainian-tradition-and-art-of-decorating-eggs-02134) supplies context for the living Ukrainian practice. The mission uses an original spatial landing rhythm; it does not copy an egg's surface design or claim to reproduce a pysanka.
- **Podillia rushnyky:** Ivan Honchar Museum objects [КН-18297](https://honchar.org.ua/en/collections/detail/2708), a geometrically ornamented woven rushnyk, and [КН-22891](https://honchar.org.ua/en/collections/detail/1786), a geometrically ornamented embroidered rushnyk. The map's stepped bands and pockets are original game geometry. No museum motif is transcribed and no symbolic meaning is assigned.
- **Petrykivka:** [UNESCO's element page](https://ich.unesco.org/en/RL/petrykivka-decorative-painting-as-a-phenomenon-of-the-ukrainian-ornamental-folk-art-00893) and [official inventory text](https://ich.unesco.org/doc/src/18937-EN.pdf) document fantastic flowers, local flora/fauna and branch/frieze composition. Neutral ground adapts only a non-crossing branch composition into functional routes; it copies no painting, flower or coordinates.

These three traditions are named separately. Crimean Tatar Örnek is not labelled as vyshyvanka and is not mixed into this batch.

## Open-chain overlap audit

The identities in PRs 323 and 332 and the terminal spatial chain were treated as reserved. PR421 owns `garden-refuges`/`four-quarters`; PR429 `survey-markers`/`windbreak-weave`; PR441 `split-berths`/`stepped-return`; PR443 `dogleg-return`/`staggered-circuit`; PR446 `bank-the-crossing`/`five-anchors`; PR450 `two-ways-home`/`dogleg-transfer`; PR452 `first-link`/`second-approach`; PR458 `three-compounds`/`spiral-stores`; PR460 `nested-relays`/`watchpost-exchange`; and PR463 `compass-array`/`outer-loop`. None overlaps this batch.

Those PRs remain candidate-only and allocate no authored route/profile registry entry. This PR intentionally does not merge their source chain. `whole-spatial-v10`, `journey-whole-spatial-v10` and its suspended-session key are new and isolated.

## Automated evidence and human gaps

Focused checks cover copy-on-write preservation, exact three-identity mutation, owning dependency revisions, cultural metadata/source URLs, collision-only actor parity, unchanged terrain and speed rules, topology, idle safety over multiple seeds, two documented first-closure routes across Gentle/Standard/Expert and both controls over multiple seeds, Solo/Versus equality, replay determinism, route/profile isolation, lazy loading, Studio edition selection and authored/default navigation.

Automation does not establish cultural appropriateness, visual resemblance at play scale, enjoyment, final coverage pacing, complete mission clears, physical keyboard/controller/touch feel, or compact-display legibility. A Ukrainian cultural reviewer and human playtesters should review those before publisher release qualification.

## Follow-on disposition (outside this PR)

- Re-evaluate `wide-approach` for a future carefully attributed Crimean Tatar Örnek geometric-weaving study. Do not call it vyshyvanka, reproduce protected artwork, or assign symbol meanings without Crimean Tatar artisan/community review. Primary source: [UNESCO Örnek](https://ich.unesco.org/en/RL/ornek-a-crimean-tatar-ornament-and-knowledge-about-it-01601?RL=01601).
- Audit other unclaimed Horizon/Border/Signal identities only after the PR421–463 chain lands or is dispositioned, so successor ownership and cumulative bases are explicit.
- Keep future batches bounded and preserve a separately selectable prior authored route for every promoted edition.
