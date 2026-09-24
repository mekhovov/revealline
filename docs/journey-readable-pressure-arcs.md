# Journey readable pressure arcs

Status: implementation candidate; automated and human balance review pending.

This successor keeps the 91-mission `whole-spatial-v6` library, geometry, objectives, pictures,
actor counts and global travelling-impact rules. It changes one ordinary keeper in each of six
Phaseworks missions:

| Arc          | Missions                                              | Current-rules role  |
| ------------ | ----------------------------------------------------- | ------------------- |
| Pursuit      | A return in reserve → Two ways home → Dogleg transfer | Trail pursuer       |
| Interception | Crossed bands → Pressure ladder → Signal channels     | Heading interceptor |

Both roles warn visibly and commit to a finite, locked route. They cannot invisibly retarget while
committed. Closure and topology changes cancel the commitment; walls and reclaimed ground block
sensing. The role replaces an existing keeper and remains field-retaining, so the capture contract
and enemy count do not change.

The `journey-actors-v9` catalog preserves all earlier catalogs and uses current-rules authored tells:

- warning: 90 actor ticks / 0.75 seconds;
- commitment: 144 actor ticks / 1.2 seconds;
- Standard recovery: 300 actor ticks / 2.5 seconds after the registered Standard rest factor is
  applied once;
- Gentle and Expert retain their registered speed and recovery differences.

The new route is `whole-spatial-v7`, with isolated suspended-session and Journey profile keys.
`whole-spatial-v6` and every older edition remain selectable and unchanged. Solo and Versus use v7
as the normal entry; Team remains on its separately versioned route.

Technical verification can establish deterministic timing, catalog isolation, exact content
preservation and host routing. It cannot establish fun or final balance. Public candidates must stay
labelled **balance pending** until human play verifies readable failures, viable alternate approaches
and willingness to retry.
