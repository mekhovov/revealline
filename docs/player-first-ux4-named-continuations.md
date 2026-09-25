# UX4 named continuation actions

Result actions now state the destination already owned by the active runtime:

- Solo and Versus Journey results name the next mission. At a campaign boundary they name the next
  campaign; at the end they offer **Browse missions**.
- Solo authored campaigns name the next level while it is in the same accepted campaign. A
  successor that still requires asynchronous unified-catalogue resolution remains **Next mission**
  until that operation identifies it; the UI does not guess.
- Versus keeps **Next round: _mission_** and **Rematch: _mission_** for the current match format.
- Team already names its exact next mission and keeps **Browse Team arenas** as the terminal primary
  action. This audit leaves that verified host behavior unchanged.

This slice changes labels only. It does not alter successor selection, preparation, progression,
scoring, picture ownership, simulation timing or input routing. English and Ukrainian strings are
generated into the shipped catalogue. Focused host checks cover same-campaign and cross-campaign
labels; the pure policy check covers the final-library action while existing host tests retain their
Browse missions assertions. Physical controller and touch wording review remains part of the
cumulative player release.
