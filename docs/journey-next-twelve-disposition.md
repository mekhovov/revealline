# Journey spatial backlog: next twelve unowned identities

Status: planning evidence only; 2026-09-25 catalogue snapshot. This document does not enroll content, change a mission, allocate a version, or authorize a release.

## Selection and ownership boundary

The accepted Journey catalogue contains 91 mission identities. The next batch must extend existing identities through copy-on-write successors rather than creating another optional collection or rewriting historical editions.

The active three-mission source slice at `fe1d2bf2d58366490620bfb30afe74f586021673` names `stepping-stones`, `four-quarters`, and `survey-markers`. Only `stepping-stones` is currently unowned elsewhere. `four-quarters` is already prepared in [PR 421](https://github.com/mekhovov/revealline/pull/421), and `survey-markers` is already prepared in [PR 429](https://github.com/mekhovov/revealline/pull/429). Those overlapping proposals must be reconciled with their existing owners; they must not become third successor editions.

Existing open ownership excluded from the next-twelve selection:

| Open work | Existing mission identities already owned |
|---|---|
| [PR 323](https://github.com/mekhovov/revealline/pull/323) | `two-bays`, `neon-remix`, `broken-yard`, `read-the-arrows`, `twin-receivers`, `crossing-complete` |
| [PR 332](https://github.com/mekhovov/revealline/pull/332) | `cross-stitch-crossings`, `rushnyk-bands`, `pysanka-sections`, `four-motor-landings`, `circuit-lanes`, `twin-lens-chambers`, `toolbench-weave`, `dnipro-crossings`, `two-districts`, `two-ways-home`, `second-approach`, `windbreak-weave` |
| [PR 421](https://github.com/mekhovov/revealline/pull/421) / [PR 429](https://github.com/mekhovov/revealline/pull/429) | `garden-refuges`, `four-quarters`; `survey-markers`, `windbreak-weave` |
| [PR 441](https://github.com/mekhovov/revealline/pull/441) / [PR 443](https://github.com/mekhovov/revealline/pull/443) | `split-berths`, `stepped-return`; `dogleg-return`, `staggered-circuit` |
| [PR 446](https://github.com/mekhovov/revealline/pull/446) / [PR 450](https://github.com/mekhovov/revealline/pull/450) | `bank-the-crossing`, `five-anchors`; `two-ways-home`, `dogleg-transfer` |
| [PR 452](https://github.com/mekhovov/revealline/pull/452) / [PR 458](https://github.com/mekhovov/revealline/pull/458) | `first-link`, `second-approach`; `three-compounds`, `spiral-stores` |
| [PR 460](https://github.com/mekhovov/revealline/pull/460) / [PR 463](https://github.com/mekhovov/revealline/pull/463) | `nested-relays`, `watchpost-exchange`; `compass-array`, `outer-loop` |

PR 332 and the later spatial chain overlap on `windbreak-weave`, `two-ways-home`, and `second-approach`. Their owners must choose one canonical successor per identity before enrollment. This audit does not resolve or duplicate those editions.

Audited open heads: PR 323 `e8888844e398d9850bc833ca1a070f00e6cad5ea`; PR 332 `48b42b610856e54e8df58c40943b5fd0e3c208fa`; PRs 421/429 `5b180e5452b30e56f4012104e4743754ef9c30f5` / `26658e554772d0bb32758e699e3a541d9d6c2cdc`; PRs 441/443/446 `3919825e522842a0d5199d8fc3131baca9f3def1` / `04d5e55f941083bbd6fde60ad0901f9d58e2ccc8` / `b6f314a48a86760e222558148da6bf0e97c334a0`; PRs 450/452/458 `a7b385527bfd71901c99c8f21ca0f3576f1713a2` / `18150b2a93f17253a8918d54d470d5959eb3f85b` / `978a494e4df553b2d65fedada3c14328eced87dc`; PRs 460/463 `2a2699e83fd435e22e9f93445c929f82448cd4bd` / `fd9e7e66e9c49dad78ead984f6b0ea57b1b99505`.

The matrix below therefore selects the first twelve genuinely unowned post-Prologue identities in authored Journey order, excluding the active slice and every open owner above. The three unchanged Prologue teaching missions remain outside this redesign queue.

## Disposition matrix

| Order | Existing identity and current revision | Disposition | Distinctive route decision | Attributed visual/spatial study | Existing mechanics to reuse | Historical-edition boundary |
|---:|---|---|---|---|---|---|
| 1 | `nearby-shore` · `pressure-v2-37598943b92f4187` | **Retain** | Use the island for a short, low-yield bridge or stay exposed for a perimeter enclosure; preserve its clear first-island lesson. | Western Polissia counted-stitch and horizontal shoulder-join rhythm, used only as presentation and negative-space cueing. | One interior foundation; two retaining field enemies; deliberately no wall, terrain, or bonus. | Retain the exact map and revision. A presentation study must not create a geometry edition or change progress/Next ownership. |
| 2 | `island-outpost` · `outpost-spatial-1` | **Redesign** | Close the short western join or commit to the longer eastern join that makes the following return safer. | Vyzhenka, Chernivtsi-region braided joining seam and double-prutyk construction, translated into two broad broken approaches rather than a copied shirt chart. | Interior foundation; two retaining field enemies; current west/east bridge lesson. | Copy-on-write successor only. Preserve `outpost-spatial-1` as selectable Original and keep its receipts immutable. |
| 3 | `courtyard-return` · `courtyard-spatial-1` | **Move** | Its inner-first versus outer-first nested-ring decision fits a later cultural study, but does not need another immediate core successor. | Crimean Tatar Örnek nested botanical composition is a possible reference only after practitioner review; its meaning-bearing elements must not be rearranged as generic decoration. | Foundation ring; inside/outside retaining enemies; no extra mechanic required. | Do not author a successor yet. Keep `courtyard-spatial-1` in its current route and selectable; moving the study does not invent a clear or delete progress. |
| 4 | `long-way-home` · `pressure-v2-10c46f94f296e9f8` | **Redesign** | Choose an upper or lower shoulder join, or attempt a direct exposed side-to-side shortcut. | Verkhovyna Hutsul shoulder and seam construction: a strong joining axis with offset paired groups, treated as construction evidence rather than a named symbolic motif. | Four foundations; two retaining enemies; multiple existing return surfaces. | Copy-on-write successor; preserve the named current revision and its original ordering as a selectable edition. |
| 5 | `horizon-remix` · `pressure-v2-3bcf3798720f7d15` | **Redesign** | Secure a central spiral shoulder first or connect outer petal/outpost returns to separate three keepers in a different order. | Lemko pysanka floral spiral, petals, and dot rhythm; use an original broad open composition, not traced egg divisions. | Five foundations; three retaining field enemies; existing Remix identity. | Preserve the current revision as Original. A successor remains `horizon-remix`; it must not become a second optional mission. |
| 6 | `behind-the-patrol` · `pressure-v2-bcfbbfbaa2fbeb73` | **Retain** | Depart before the patrol arrives or wait and return immediately behind it; route markers should improve timing readability, not remove pressure. | Krolevets woven-rushnyk band structure and schematic three-prong rhythm, confined to visual timing cues around the perimeter. | Interior foundation; two keepers; introductory outer-perimeter patrol; no walls or terrain. | Retain current geometry/revision. Any art treatment is presentation-only and cannot change collision or completion identity. |
| 7 | `second-landing` · `pressure-v2-fe482a14b4cc8fee` | **Redesign** | Take a short cutwork-like opening to the far landing or make a longer outside wrap toward a temporary opportunity. | Reshetylivka white-on-white square cutwork and merezhka; keep strong game contrast rather than imitating the source palette literally. | Long and far foundations; two keepers; perimeter patrol; reuse the existing bonus system as a visible timed, relocating optional detour. | Copy-on-write successor; retain the current fixed-bonus edition as Original and do not require the timed bonus for completion. |
| 8 | `long-rail` · `pressure-v2-8b1e01dc9b8f5634` | **Redesign** | Use the ordinary rail or take a faster, riskier branch route; capturing either branch must shorten a later exposure. | Petrykivka botanical/frieze composition with separated branch masses. Petrykivka is decorative painting, not embroidery. | Central rail and side shelf foundations; two keepers; perimeter patrol; player-speed bonus. | Preserve the current revision and artwork pairing. Successor geometry must receive a new runtime/completion identity. |
| 9 | `new-frontier` · `pressure-v2-e08dc1f4545b7457` | **Redesign** | Close the left or right panel shoulder to deliberately reshape the moving frontier before attempting the larger cut. | Kosiv painted-ceramic bilateral panel and framing rhythm; do not turn its people or animals into targets or obstacle caricatures. | Broad island foundation; two retaining enemies; introductory moving-frontier patrol. | Preserve the current introduction edition. Enroll a successor only after its frontier-path consequence is demonstrated in preview and play. |
| 10 | `turn-the-corner` · `pressure-v2-10279f06acf194fe` | **Redesign** | Take the short inner wave/elbow or wrap the outer shoulder for a larger capture and an optional slow window. | Bukovyna pysanka geometric/floral family—cross, rhomb, pine, ox-eye, and wave—as a source for one broad original wave/dogleg, not a copied symbolic chart. | L-shaped foundation; two keepers; moving-frontier patrol; enemy-slow bonus. | Copy-on-write successor; keep the named current revision selectable and its recorded progression unchanged. |
| 11 | `return-pocket` · `pressure-v2-abc914299e2e132c` | **Redesign** | Close the pocket mouth first or leave a side opening while perimeter and frontier patrol domains diverge. | Podillia woven-rushnyk large eight-point stars with smaller star/diamond interstitial rhythm; use open shoulders and separated small masses without asserting universal meanings. | Pocket foundation; inside/outside keepers; perimeter and frontier patrols; freeze bonus. | Preserve the current mixed-patrol edition. A successor must not reinterpret old replays or award migration clears. |
| 12 | `border-remix` · `pressure-v2-151e25ea588a28dd` | **Redesign** | Connect the central spine first or reach a far leaf/island first; optional bonus detours must change timing, not gate the clear. | Poltava-region branch, oak-leaf, broken-tree, and staggered sleeve arrangements, recomposed into original offset route masses with no village/date or universal-symbol claim. | West/east islands and central spine; two keepers; perimeter and frontier patrols; extra-life and freeze bonuses. | Preserve the current Remix revision as Original. The successor keeps the same mission identity and authored Journey boundary. |

## Cultural attribution and source limits

These references are design inputs, not permission to copy museum objects, embroidery charts, paintings, or community symbols. Geometry should borrow large-scale rhythm—bands, joins, openings, offsets, nested areas—while art remains original. Region, medium, and technique must stay attached to each reference; “Ukrainian ornament” is not one interchangeable style.

- Western Polissia: the Honchar Museum record locates a shirt in Kysorychi, Rivne region, and documents zanyzuvannia/stem-stitch work and a horizontal shoulder join ([Honchar Museum](https://honchar.org.ua/to-learn/sorochka-zhinocha-chernivetska-oblast-poch-hh-st-1-1-1-i147)).
- Vyzhenka and Verkhovyna: the museum records document braided/double-prutyk seam construction in Vyzhenka and an applied embroidered shoulder detail over a join in Verkhovyna; both objects are catalogued in the Hutsul ethnographic region ([Vyzhenka shirt](https://honchar.org.ua/to-learn/sorochka-zhinocha-chernivetska-oblast-poch-hh-st-i134), [Verkhovyna shirt](https://honchar.org.ua/to-learn/sorochka-zhinocha-chernivetska-oblast-poch-hh-st-1-i139)).
- Crimean Tatar Örnek: UNESCO describes a meaning-bearing system of symbols and their arrangement across embroidery, weaving, pottery, engraving, jewellery, wood carving, and glass/painting; it must remain explicitly Crimean Tatar and requires community-sensitive review ([UNESCO](https://ich.unesco.org/en/RL/ornek-a-crimean-tatar-ornament-and-knowledge-about-it-01601?RL=01601)).
- Lemko and Bukovyna pysanky: the museum records attribute floral spiral/petal/dot work to the Lemko Area and geometric/floral cross, rhomb, pine, ox-eye, and wave work to Bukovyna ([Lemko pysanka](https://honchar.org.ua/en/collections/detail/1514), [Bukovyna pysanka](https://honchar.org.ua/en/collections/detail/1188)).
- Krolevets rushnyk: use the museum-attributed woven band structure as a compositional reference, not as a generic religious-symbol library ([Honchar Museum](https://honchar.org.ua/collections/detail/1712)).
- Reshetylivka: the UNESCO-accredited Regional Centre describes white-on-white embroidery and its cutwork/merezhka practice; game contrast must override literal white-on-white rendering where hazards would become unreadable ([Regional Centre for the Safeguarding of Intangible Cultural Heritage](https://www.unesco-centerbg.org/en/2021/11/22/white-on-white-technique-of-embroidery-of-reshetylivka/)).
- Petrykivka: UNESCO identifies it as Ukrainian decorative painting and notes its characteristic flora/fauna imagery; it must not be relabelled as embroidery ([UNESCO](https://ich.unesco.org/en/RL/petrykivka-decorative-painting-as-a-phenomenon-of-the-ukrainian-ornamental-folk-art-00893)).
- Kosiv ceramics: UNESCO attributes the tradition to the Hutsul community and documents figurative designs expressing Hutsul history, life, folklore, beliefs, and customs; figures are not disposable enemy silhouettes ([UNESCO](https://ich.unesco.org/en/RL/tradition-of-kosiv-painted-ceramics-01456)).
- Podillia rushnyk: the museum object supplies the large-star/smaller-interstitial composition used here; the design recommendation does not add an unverified universal meaning ([Honchar Museum](https://honchar.org.ua/collections/detail/1769)).
- Poltava-region embroidery: use the museum study's attributed branch, oak-leaf, broken-tree, and staggered sleeve arrangements without extending its object-specific evidence into a universal regional claim ([Kharkiv Historical Museum](https://museum.kh.ua/academic/publications.html?n=929)).

## Suggested source batches

1. **Early-island batch:** `nearby-shore` remains unchanged; prepare successors for `island-outpost` and `long-way-home`. `courtyard-return` stays in place until the Örnek review is available.
2. **Patrol-transition batch:** `horizon-remix`, `second-landing`, and `long-rail`; keep `behind-the-patrol` unchanged so the first perimeter-patrol lesson remains readable.
3. **Frontier-and-pocket batch:** `new-frontier`, `turn-the-corner`, and `return-pocket`.
4. **Boundary review:** `border-remix` only after the preceding three prove the mixed patrol vocabulary. Then re-evaluate its two fixed bonuses for timed relocation without making collection mandatory.

## Three net-new identities for later batches

These are new mission identities, not successors. Their IDs and names do not occur in the accepted Journey, shipped Classic/Custom catalogue, active three-map slice, or the open spatial owners audited above. They remain concepts only; adding a row here does not reserve an implementation owner or enroll a mission. No additional FPV/workshop identity is proposed because PR 332 already owns toolbench, motor, lens, and circuit studies, while the active slice owns an FPV trace study.

### `woven-end-exchange` · Woven end exchange

- **Placement:** Border Bloom, challenge band 3, after the introductory perimeter-patrol lesson.
- **Attributed study:** an East Polissia woven rushnyk from Makyshyn, Chernihiv region. The museum record documents a symmetric end-weighted composition with schematic vases, candleholders, plants, and birds ([Honchar Museum](https://honchar.org.ua/collections/detail/2314)).
- **Route decision:** two separated terminal foundation courts flank an offset central exchange. The player chooses whether to establish a short return at one end or cross the exchange immediately to separate the keepers.
- **Approach A:** connect the near terminal to the perimeter, observe the patrol from the new return, then make two shorter enclosures toward the centre.
- **Approach B:** commit to one long cut through the central exchange before either terminal is connected, gaining a larger early enclosure at greater exposure.
- **Capture consequence:** connecting a terminal creates a useful return but earns no foundation coverage. A central separator fills only a keeper-free side, so the chosen order determines which end remains contested.
- **Existing mechanics only:** two field keepers, one outer-perimeter patrol, two disconnected foundations, and ordinary enemy-seeded capture. No relay, timer, or new actor rule.
- **Cultural boundary:** use only the source's end-weighted symmetry and alternating density as large-scale composition. Birds, candleholders, and plants stay in the reveal artwork, never as targets or enemy silhouettes; do not copy the object or claim universal meanings. Unlike PR 332's `rushnyk-bands`, this is a pair of separated terminal courts with a central exchange, not a parallel-band course.

### `gathered-returns` · Gathered returns

- **Placement:** Neon Contours, challenge band 4, after changing-frontier behavior is already understood.
- **Attributed study:** a 1930 Boyko Area shirt from Shchyrets, Lviv region. The museum record documents geometric ornament and cross stitch, cross-stitch plait, backstitch, and riasuvannia gathering ([Honchar Museum](https://honchar.org.ua/en/collections/detail/3297)).
- **Route decision:** three narrow foundation ribs gather toward an offset hub. The player can join the outer ribs to build a gradual return fan or cross the compressed middle gap to reshape the frontier in one move.
- **Approach A:** connect the two outer ribs separately, accepting smaller captures in exchange for short, readable departures around the hub.
- **Approach B:** cross the central gap first, separating two keepers and forcing the frontier patrol onto a new contour before the outer ribs are secured.
- **Capture consequence:** each outer join expands the return network without scoring its foundation cells; the centre-first cut can fill one lobe and redirects the moving-frontier patrol along the surviving contour.
- **Existing mechanics only:** reclaimed foundations, slow field between ribs, three field keepers, one moving-frontier patrol, and the established contour reassignment rule.
- **Cultural boundary:** the mission studies construction rhythm—gathering and a plaited join—not a named symbolic motif. Do not trace the shirt's embroidery chart or generalize one Shchyrets object to all Boyko work. Unlike `cross-stitch-crossings` and `four-quarters`, this has no cross-shaped wall or four-quadrant capture puzzle.

### `chain-loop-crossing` · Chain-loop crossing

- **Placement:** Phaseworks, challenge band 7, after travelling trail impacts and committed pursuit are established separately.
- **Attributed study:** an early-twentieth-century Slobozhanshchyna rushnyk from Khukhra, Sumy region. The museum record identifies hemp cloth, hand chain-stitch embroidery, and plant/zoomorphic ornament ([Honchar Museum](https://honchar.org.ua/collections/detail/2006)).
- **Route decision:** three offset loop-like return islands create a switchback. The player can stitch them together through short cuts or thread one long diagonal while a telegraphed pursuer commits to its route.
- **Approach A:** connect the loops sequentially, using each new return to keep trail-impact travel distance short while leaving smaller keeper-held lobes for later.
- **Approach B:** wait for the pursuer's recovery, then cross two openings in one exposed diagonal that separates the keepers earlier but gives a trail impact farther to travel.
- **Capture consequence:** a short loop connection mainly improves the next return; the long diagonal fills only an unoccupied lobe and leaves the keeper-held loop active, preventing an automatic oversized clear.
- **Existing mechanics only:** three foundations, two field keepers, one warned/committed pursuer, and the current ordered-path travelling-impact contract. No free steering or mid-flight retargeting.
- **Cultural boundary:** use chain stitch only as inspiration for linked spatial rhythm. Plant and animal forms remain respectful background details rather than collision geometry, targets, or combat jokes; no traditional meaning is inferred. This is a trail-risk switchback, not another FPV trace, toolbench, circuit-lane, or woven-band mission.

Each candidate still needs route simulations, actual Standard/Gentle/Expert play, both steering modes, paired-board parity, public clear/Next/Skip/Continue checks, and human review. This disposition audit is not evidence that a mission is balanced, fun, culturally approved, or ready for default enrollment.
