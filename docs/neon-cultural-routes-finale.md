# Neon Ukrainian cultural routes finale · successor v17

Status: implementation candidate. The stacked route work is rebased onto `main` at `109631e70`, and local route enrollment, deterministic route qualification and the affected content/host checks listed below are complete on the rebased candidate. Frozen-build qualification, public delivery and human cultural/balance review remain open. This document is not release evidence.

## Scope

This bounded successor redesigns the remaining three Neon identities and preserves their exact v16 editions in the unified selector:

| Mission                 | New spatial decision                                                                                   | Preserved behavior                                                                               |
| ----------------------- | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------ |
| **Dogleg return**       | Connect the short central hook, or pass offset wall bands to establish the quieter east landing first. | Two keepers, frontier/perimeter patrols, policy, quota, bonuses, objectives and art.             |
| **Staggered circuit**   | Use a short central pad through slow field, or take a long clear staggered lane to the right rail.     | Two keepers, frontier/perimeter patrols, policy, quota, bonuses, objectives and art.             |
| **Three open circuits** | Close the short western mouth, or risk the long exposed upper span to join the far circuit first.      | Two keepers, two frontier patrols, perimeter patrol, policy, quota, bonuses, objectives and art. |

The successor changes authored walls, foundations, hazard placement, spawn placement and patrol attachment where required by the new topology. Enemy roles and counts, physics, difficulty tuning, objectives, bonuses and presentation remain stable. Walls are blocking obstacles, never return surfaces.

## Cultural source boundaries

- The [Ivan Honchar Museum’s Podolia striped woollen riadno panel](https://honchar.org.ua/en/collections/detail/2581) documents twill/domestic weaving and classifies its ornament as geometric. Dogleg return borrows only alternating offset-band rhythm; it does not copy a textile, stripe sequence, palette, ornament, meaning or source coordinates.
- The [Ivan Honchar Museum’s Hutsul woven zapaska](https://honchar.org.ua/en/collections/detail/2972) documents a woollen, twill-woven garment with geometric ornament. Staggered circuit borrows only alternating woven-lane rhythm; it does not copy a garment, pattern, palette, ornament, meaning or source coordinates.
- [UNESCO’s Ukrainian pysanka record](https://ich.unesco.org/en/RL/pysanka-ukrainian-tradition-and-art-of-decorating-eggs-02134) documents successive wax-resist and dye stages and emphasizes community- and family-specific practice. Three open circuits borrows only the broad idea of layered field separation; it does not copy a pysanka, symbol, wish, message, palette, ritual meaning or source coordinates.

These sources support cultural context and broad compositional vocabulary. They do not establish gameplay balance, permission to copy an object, or universal symbolic meanings.

## Verification performed so far

- Copy-on-write isolation for artwork and greybox factories.
- Exact preservation of rules, role counts, objectives, bonuses, timed bonuses and presentation.
- One connected field, deliberately disconnected permanent returns and valid topology on every preset.
- Two deterministic approaches per mission, both steering modes and two seeds.
- Safe idle openings for every preset.
- Replay stability and equal paired Versus boards for every documented route.
- 40/40 focused candidate checks.
- 62/62 route-loader and exact-edition checks.
- 430/430 affected content-stack checks.
- 26/26 Solo/Versus host checks, 8/8 controller checks and the scoped Team inventory check.
- The broader Team remote-host cohort remains 12/13: its pre-existing blur-interruption chooser-close assertion still fails, while the equivalent Escape path passes. This is recorded as a failure, not a pass.

## Remaining gates

- Rebase again if `main` or any stacked parent changes before review.
- Resolve or explicitly carry the inherited Team blur-interruption chooser-close assertion without representing it as a pass.
- Allocate a release version only through the sole publisher, then verify the frozen public build.
- Conduct human cultural and balance review. Until that evidence exists, the candidate remains **balance pending**.
