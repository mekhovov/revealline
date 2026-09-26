# Rover Ukrainian cultural routes · successor v18

Status: implementation candidate. The stacked cultural-route work is rebased onto `main` at `109631e70`. Local route enrollment and the focused content, replay, Versus and edition checks below are complete on this candidate. Merge, frozen-build qualification, public delivery and human cultural/balance review remain open. This document is not release evidence.

## Scope

This bounded successor redesigns three Rover identities and preserves their exact v17 editions in the unified selector:

| Mission | New spatial decision | Preserved behavior |
| --- | --- | --- |
| **Wake the yard** | Close the short central cutwork window and wake its roamer, or cross offset openings to establish the east window first. | Two keepers, reclaimed-ground roamer, policy, quota, objectives, bonuses and art. |
| **Between the rows** | Take the short west contour panel, or cross the upper field to reach the east panel before its frontier patrol returns. | Two keepers, roamer, frontier patrol, policy, quota, objectives, bonuses and art. |
| **Rover remix** | Connect the central branch and enlarge both roamer domains, or bank a remote outer cluster before joining either sleeper. | Two keepers, two roamers, frontier patrol, policy, quota, objectives, bonuses and art. |

The successor changes authored walls, foundations, terrain, spawn placement and actor attachment only where the new topology requires it. Existing physics, difficulty catalogues, objectives, bonuses, timed bonuses, coverage targets and presentation remain stable. Walls block movement and never close a cut.

## Cultural source boundaries

- The [Reshetylivka white-on-white record](https://www.unesco-centerbg.org/en/2021/11/22/white-on-white-technique-of-embroidery-of-reshetylivka/) describes geometric and floral merezhka compositions and cutwork made from square openings. Wake the yard borrows alternating solid/open spacing only. It does not copy embroidery, a stitch chart, a motif, a palette, a meaning or source coordinates.
- [UNESCO’s Kosiv painted-ceramics record](https://ich.unesco.org/en/RL/tradition-of-kosiv-painted-ceramics-01456) describes contour drawing and bordered figurative compositions on practical objects. Between the rows borrows unequal contour-and-border organization only. It does not copy a figure, object, story, palette, ornament, belief or source coordinates.
- [UNESCO’s Petrykivka record](https://ich.unesco.org/en/RL/petrykivka-decorative-painting-as-a-phenomenon-of-the-ukrainian-ornamental-folk-art-00893) describes decorative compositions built from imaginary flowers and other natural elements. Rover remix borrows broad clustered-and-branching composition only. It does not copy a flower, bird, animal, object, symbol, palette, meaning or source coordinates.

These sources support cultural context and broad compositional vocabulary. They do not establish gameplay balance, permission to copy an object or universal symbolic meanings.

## Verification performed so far

- Copy-on-write isolation for artwork and greybox factories.
- Exact preservation of rules, role counts, objectives, bonuses, timed bonuses and presentation.
- One connected field, deliberately disconnected permanent returns and valid runtime topology on Gentle, Standard and Expert.
- Two deterministic approaches per mission, both steering modes and two seeds.
- Safe idle openings on every preset.
- Replay stability and equal paired Versus boards for every documented approach.
- 40/40 focused Rover candidate, route-registration and Studio checks.
- Exact v17 history remains independently launchable; v18 owns separate progress and suspension keys.

## Remaining gates

- Run the complete affected host/content cohort after the library-count updates and record its exact totals.
- Resolve or explicitly carry the inherited Team blur-interruption chooser-close assertion without calling it a pass.
- Review and merge the stacked cultural route PRs in order, then allocate a release only through the sole publisher.
- Qualify the frozen build and verify the actual public Pages deployment.
- Conduct human cultural, readability and balance review. Until then this candidate remains **balance pending**.

## Next content priorities

1. Fractured Grid and Phaseworks: distinct repair priorities, endangered return networks and closure races.
2. Livewire, Relay and Crosswind: crossing windows, objective order, shortcuts and directional-route tradeoffs.
3. Sentinel and Apex: shield approaches and capstone combinations without adding arbitrary physics.
4. Team: complementary captures where one player creates a useful return or removes pressure for the other.
5. Whole-Journey pacing, accessibility/performance and human/device qualification.
