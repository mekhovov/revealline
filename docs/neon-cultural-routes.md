# Neon Ukrainian cultural routes · successor v16

Status: implementation candidate; local route enrollment and focused qualification are complete. Frozen-build qualification, public delivery and human cultural/balance review remain open. This document is not release evidence.

## Scope

This bounded successor redesigns three existing Neon identities and preserves their exact v15 editions in the unified selector:

| Mission | New spatial decision | Preserved behavior |
| --- | --- | --- |
| **Folded corner** | Close beside the short inner fold, or follow alternating broad and narrow returns to establish the longer outer shoulder. | Keepers, frontier patrol, quota, physics, art and difficulty. |
| **Inside out** | Contest the broad western mouth near the inner keeper, or cross the upper field and work through the smaller eastern mouth against outer pressure. | Keepers, frontier patrol, quota, physics, art and difficulty. |
| **Side-door bays** | Secure the nearby interrupted rim, or cross the open centre to reach the reversed far rim before its patrol returns. | Keepers, frontier patrols, perimeter patrol, quota, physics, art and difficulty. |

Only foundation geometry and route guidance change. The successor does not alter actor speed, count, movement rules, walls, terrain, speed zones, bonuses, objectives, presentation or the coverage denominator.

## Cultural source boundaries

- The [Museum Fund of Ukraine’s Krolevets rushnyk record](https://museum.mincult.gov.ua/collections/rushnik-tkaniy-kroleveckiy-33709) documents a woven textile with red figured bands on a white ground. Folded corner borrows only unequal horizontal-band rhythm and open spacing; it does not copy a rushnyk, rhomb, inscription, palette, meaning, object layout or source coordinates.
- The [Ivan Honchar Museum’s textile collection](https://old.honchar.org.ua/english/collection/) describes regional variation and ornament concentrated at the short edges of rushnyky. Inside out borrows only separate end-field rhythm around an open centre; it does not copy a ritual sign, textile, regional pattern, palette, meaning or source coordinates.
- The [National Museum of Ukrainian Pottery in Opishne’s painted-bowl collection](https://opishne-museum.gov.ua/malovani-mysky/) documents painted arrangements with geometric and plant ornament. Side-door bays borrows only the broad idea of rim, centre and surrounding-field zones; it does not copy a bowl, plant, fish, bird, ornament, palette, meaning or source coordinates.

These sources support cultural context and broad compositional vocabulary. They do not establish gameplay balance, permission to copy an object, or universal symbolic meanings.

## Focused verification performed

- Copy-on-write isolation for artwork and greybox factories.
- Exact preservation of actors, effective rules, hazards, objectives, bonuses, timed bonuses, presentation and difficulty metadata.
- Valid topology and usable departures on Gentle, Standard and Expert.
- Two deterministic approaches per mission, both steering modes and two seeds.
- Safe idle openings for every preset.
- Replay stability and equal paired Versus boards for every documented route.
- 40/40 focused candidate checks.
- v16 registry, loader, Studio, EN/UK catalogue and exact v15 historical-card enrollment checks.
- Repository validation and the 371/371 affected content, edition, lifecycle, loader and Studio cohort.
- 26/26 affected Solo, remote-library and Versus host checks.
- 8/8 controller-host checks.
- Scoped remote Team inventory check. The broader Team-host cohort is 12/13: its inherited blur-interruption chooser-close assertion still fails, while the Escape-path variant passes.

## Remaining gates

- Rebase if any parent in PR530 → PR558 → PR567 → PR577 changes before review.
- Resolve or explicitly carry the inherited Team blur-interruption chooser-close assertion without representing it as a pass.
- Allocate a release version only through the sole publisher, then verify the frozen public build.
- Conduct human cultural and balance review. Until that evidence exists, the candidate remains **balance pending**.
