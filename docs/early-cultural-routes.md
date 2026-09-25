# Early Ukrainian cultural routes · successor v14

Status: implementation candidate; route enrollment and focused automated checks complete locally; human cultural and balance review pending. This document is not release or public-deployment evidence.

## Scope

This bounded successor redesigns three existing identities and preserves their v13 editions in the unified selector:

| Mission           | New spatial decision                                                                | Preserved behavior                                                              |
| ----------------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Nearby shore      | Short line to a small near landing versus a longer crossing to a larger far landing | Both keepers, coverage, physics, art and onboarding role                        |
| Two bays          | Upper offset into the tighter west bay versus lower offset into the wider east bay  | Both keepers, two retained field components, coverage, physics and art          |
| Behind the patrol | Immediate crossbar return versus longer open-stair route to a quieter inner tip     | Keepers, perimeter patrol, timed enemy-slow schedule, coverage, physics and art |

The work changes foundation geometry and route guidance only. It does not copy reference coordinates, add cultural figures as targets, assign universal meanings to symbols, or alter enemy speed to manufacture difficulty.

## Source boundaries

- [UNESCO’s Örnek record](https://ich.unesco.org/en/RL/ornek-a-crimean-tatar-ornament-and-knowledge-about-it-01601?RL=01601) documents a Crimean Tatar system whose geometric ornament is used primarily in weaving and whose symbols form meaningful narrative compositions. Nearby shore therefore borrows only an abstract alternation of solid and open space. It does not reproduce or rename any Örnek symbol or composition.
- [UNESCO’s pysanka record](https://ich.unesco.org/en/RL/pysanka-ukrainian-tradition-and-art-of-decorating-eggs-02134) documents repeated wax-resist stages and family-specific patterns and practices. Two bays borrows only the gameplay idea of layered sectioning; it does not reproduce a pysanka design, symbol or claimed message.
- The [National Museum of Ukrainian Pottery’s tactile-panel article](https://opishne-museum.gov.ua/ornamenty-yaki-mozhna-vidchuty/) documents five unequal openwork wooden panels informed by Vasyl Krychevsky’s ornament and installed beside a staircase. Behind the patrol uses an original open stair-and-panel return as a spatial interaction, not a copy of the panels or Krychevsky artwork.

These sources establish cultural context and broad compositional vocabulary. They do not establish game balance or authorize copying exact artwork.

## Verification performed

- Copy-on-write isolation for artwork and greybox factories.
- Exact preservation of actors, effective rules, terrain, objectives, bonuses, timed bonuses, presentation and difficulty metadata.
- Valid topology and safe departures on Gentle, Standard and Expert.
- Two deterministic routes per mission, both steering modes and two seeds.
- Safe idle openings for all presets.
- Replay stability and equal Versus boards for every documented route.
- Separate v14 profile/session ownership and exact v13 historical cards.
- Registered lazy loading, default Solo/Versus entry, authored Next, Studio selection, EN/UK catalogues and 294-card unified-library inventory.
- Repository validation, changed-module lint and formatting.
- 219/219 current and inherited cultural-route checks; 35/35 route-loader checks; 15/15 edition checks; 13/13 default lifecycle checks; 13/13 default Solo host checks; 3/3 remote-library checks; and 16/16 Studio checks.

The controller-library cohort is not counted as passing. Six controller-open cases also fail on the untouched v13 parent stack after its latest-main rebase, while their keyboard/click and remote-library equivalents pass. The separate Versus default-entry cohort has the same inherited controller-open failure and passes its other nine cases. This must be reconciled independently; it is not attributed to the three geometry changes and is not waived as a pass.

## Remaining gates

- Resolve or formally isolate the inherited controller-open regression on the accepted parent before frozen-build qualification.
- Review the stacked PR after PR530 and PR558 land; restack if either source head changes.
- Allocate a release version only through the sole publisher after earlier queued releases are public.
- Run bounded frozen/public play checks and human cultural/balance review. Until then the candidate remains **balance pending**.
