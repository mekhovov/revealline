# Ukrainian and FPV readable-pressure adaptations

Status: implementation candidate; human balance and cultural review pending.

This successor adapts six missions already present in the optional Ukrainian ornament and FPV
workshop campaigns. It does not append the earlier duplicate encounter-study campaign.

| Campaign           | Existing mission identity | Adapted role        |
| ------------------ | ------------------------- | ------------------- |
| Ornament crossings | Cross-stitch crossings    | Trail pursuer       |
| Ornament crossings | Pysanka sections          | Trail pursuer       |
| Ornament crossings | Rushnyk bands             | Trail pursuer       |
| Workshop routing   | Four motor landings       | Heading interceptor |
| Workshop routing   | Circuit lanes             | Heading interceptor |
| Workshop routing   | Twin lens chambers        | Heading interceptor |

Each role replaces one ordinary field keeper. Actor count, retaining behavior, maps, walls,
foundations, objectives, artwork and campaign order remain unchanged. The first adapted mission in
each optional sequence teaches the visible lock; the next two combine it with the established spatial
problem. Tryzub gates and Component trident remain exact so each four-mission campaign retains one
non-pressure contrast mission.

The adaptations use the same `journey-actors-v9` contract as the core Phaseworks arcs: a finite locked
target, 0.75-second warning, 1.2-second commitment, and 2.5-second Standard recovery. A commitment
does not invisibly retarget after a player turns. Closure cancels it; walls and reclaimed ground block
sensing.

The route is `whole-spatial-v8`, with isolated progress and suspended-session keys. `whole-spatial-v7`
and every older route remain selectable and immutable. The accepted geometry from the separate
spatial/ornament PR stack can be incorporated later because this successor changes mission actor and
design records, not map revisions.

Automated checks can prove identity preservation, deterministic timing, paired-board equality and
runtime compilation. They cannot establish cultural quality or final fun/balance, so the route stays
labelled **balance pending**.
