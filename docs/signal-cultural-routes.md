# Signal Ukrainian cultural routes · successor v15

Status: implementation candidate; local route enrollment and focused qualification are complete. Frozen-build qualification, public delivery and human cultural/balance review remain open. This document is not release evidence.

## Scope

This bounded successor redesigns three existing Signal identities and preserves their exact v14 editions in the unified selector:

| Mission | New spatial decision | Preserved behavior |
| --- | --- | --- |
| **Soft crossing** | Cross the short slow band into an upper openwork return, or take the longer clear eastern edge to a lower offset return. | Keepers, perimeter patrol, slow terrain, quota, physics, art and difficulty. |
| **Cool the crossing** | Establish a near framed panel, or use the northern shoulder to approach the far panel before neutralizing the lethal bed. | Keepers, perimeter patrol, lethal terrain, quota, physics, art and difficulty. |
| **Signal remix** | Secure the upper branch through slow terrain, or descend the stem and contest the lower branch beside the lethal channel. | Keepers, perimeter/frontier patrols, both terrain types, optional freeze, quota, physics, art and difficulty. |

Only foundation geometry and route guidance change. The successor neither adds permanent score-bearing territory nor alters actor speed, count, movement rules, hazards, bonuses, objectives or presentation.

## Cultural source boundaries

- The [Regional Centre’s Reshetylivka record](https://www.unesco-centerbg.org/en/2021/11/22/white-on-white-technique-of-embroidery-of-reshetylivka/) documents white-on-white openwork and merezhka practice. Soft crossing borrows only alternating dense/open spacing and an unequal joining rhythm; no embroidery chart, garment, motif, meaning or palette is copied.
- [UNESCO’s Kosiv ceramics record](https://ich.unesco.org/en/RL/tradition-of-kosiv-painted-ceramics-01456) documents a Hutsul tradition whose figurative designs express local history, life, folklore and customs. Cool the crossing borrows only large-scale framing and unequal panel rhythm. People, animals and source scenes are not collision objects or targets.
- [UNESCO’s Petrykivka record](https://ich.unesco.org/en/RL/petrykivka-decorative-painting-as-a-phenomenon-of-the-ukrainian-ornamental-folk-art-00893) establishes a living decorative-painting tradition. Signal remix borrows only an open central stem with offset branch masses; it does not relabel the practice as embroidery or copy a painting, flower, bird, brushstroke or palette.

These sources support cultural context and broad compositional vocabulary. They do not establish gameplay balance, permission to copy an object, or universal symbolic meanings.

## Focused verification performed

- Copy-on-write isolation for artwork and greybox factories.
- Exact preservation of actors, effective rules, terrain, objectives, bonuses, timed bonuses, presentation and difficulty metadata.
- Valid topology and safe departures on Gentle, Standard and Expert.
- Two deterministic approaches per mission, both steering modes and two seeds.
- Safe idle openings for every preset.
- Replay stability and equal paired Versus boards for every documented route.
- 40/40 focused candidate checks.
- v15 registry, loader, Studio, EN/UK catalogue and exact v14 historical-card enrollment checks.
- Repository validation and changed-file lint/format checks.
- 323/323 affected content, edition, lifecycle, loader and Studio checks.
- 26/26 affected Solo, remote-library and Versus host checks.
- 8/8 controller-host checks and the scoped remote Team inventory check.

## Remaining gates

- Rebase if any parent in PR530 → PR558 → PR567 changes before review.
- Resolve or explicitly carry the inherited Team blur-interruption chooser-close assertion; its Escape-path variant passes and this candidate does not change the chooser interaction.
- Allocate a release version only through the sole publisher, then verify the frozen public build.
- Conduct human cultural and balance review. Until that evidence exists, the candidate remains **balance pending**.
