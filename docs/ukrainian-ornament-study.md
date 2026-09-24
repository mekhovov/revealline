# Ukrainian ornament spatial study

Status: implemented review candidate, not a published or human-balanced release.
Base: Phase A `e8888844e398d9850bc833ca1a070f00e6cad5ea` (PR323).
This is a separate successor, not a change to the v6 default or its frozen maps.
Source preparation: [draft PR332](https://github.com/mekhovov/revealline/pull/332),
stacked on PR323. No release version has been allocated and no deployment is
claimed. Hosted main-branch gates start after the accepted-base integration.

## Scope and decision

The approved spatial-challenge plan extends to three existing optional missions:
Cross-stitch crossings, Rushnyk bands and Pysanka sections. Keep their original
pictures, mission IDs, quotas, shared gp4 physics, no countdown and no required
bonus. Revise map/mission identities copy-on-write. Keep all other 88 missions
unchanged. The explicit review route and Studio selector use the same factory.
No Team qualification, version allocation, default switch or release mutation is
part of this preparation batch.

Alternatives considered: decorative reskinning leaves the repeated solution in
place; wholesale campaign replacement would delay the already prepared release.
Three original geometry successors provide a bounded comparison instead.

| Mission                | Distinct problem                                                                                     | Two intended approaches                                                                                               |
| ---------------------- | ---------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Cross-stitch crossings | Staggered open diamond walls; the second motif opens on another axis and the middle return is offset | Short exposed connection through a motif opening; longer enclosure around a shoulder to establish a different return  |
| Rushnyk bands          | Stepped zigzag wall bands with alternating gaps; no reclaimed strip already bridges a gap            | Weave through the inner gaps; wrap a band end while timing the perimeter patrol                                       |
| Pysanka sections       | Asymmetric open egg-shaped wall sections, with inside/outside keeper pressure and a frontier patrol  | Connect through the side gap and reshape the frontier; establish an exterior return around the stepped shoulder first |

Ordinary keepers remain straight between impacts. No new enemy roles, arbitrary
per-map speeds or steering exceptions. Inspect actual Gentle/Standard/Expert
placement. Wall geometry blocks craft and field enemies but cannot close a cut.
Provide an inspectable wall beside reclaimed starting ground and qualify a
nonmodal rule reminder for each directly selected study. The protected geometry
is implemented; Solo has an existing generic wall reminder, but its readiness
timing and a visible Versus opening reminder remain explicit acceptance work.
The authored `design.lesson` alone is not a gameplay caption. Optional studies remain unlocked;
their existing bands are not a claim that walls belong before Broken yard's
core lesson. No silent core insertion.

## Evidence and cultural boundaries

- [Honchar Museum, rushnyk КН-22884](https://honchar.org.ua/collections/detail/1769):
  Vilshanka, Podillia; documented stars, diamonds and a broken zigzag border.
  Use original abstractions, not traced embroidery charts or museum photographs.
- [Poltava shirt collection study](https://museum.kh.ua/academic/publications.html?n=929):
  geometric and vegetal motifs, staggered/vertical arrangements and varied
  palettes. Do not invent universal meanings for diamonds, crosses or branches.
- [UNESCO Pysanka decision](https://ich.unesco.org/en/decisions/19.COM/7.B.14):
  Ukrainian egg-decoration tradition, jointly nominated by Ukraine and Estonia.
  Pysanka is not embroidery; the game's open stepped shell is a design
  abstraction, not a claim to reproduce a regional pattern.
- [Xposed Reloaded](https://store.playstation.com/en-us/concept/10002881/) and
  [Xposed](https://store.playstation.com/en-ca/product/UP2538-CUSA05619_00-XPOSEDPS4USGAME1):
  retain simple controls, demanding enclosures and picture revelation. Supplied
  screenshots establish geometry, not exact timings or enjoyment.
- [AirXonix developer rules](https://www.axysoft.com/airxonix/): distinct threats
  on open and filled territory inform domain pressure; do not import 3D/timers.
- [EcoFish developer article](https://blog.playstation.com/2012/12/04/playstation-mobile-ecofish-makes-a-splash-tomorrow/):
  terrain/enemy combinations support variety; its enemy-elimination capture rule
  is different and is not adopted.
- [Fortix manual](https://cdn.akamai.steamstatic.com/steam/apps/45400/manuals/fortix_PC_manual_WEB.pdf?t=1447353028):
  impassable walls and capture-dependent threat removal support route ordering;
  do not import its per-terrain speeds or homing into ordinary keepers.

Future candidates, not implemented here: star chambers, Reshetylivka-style open
cutwork lattice, and Poltava broken-tree branching yards. Petrykivka is a separate
painting tradition, not a synonym for vyshyvanka. Fine decorative details belong
in artwork, not unreadable collision geometry; functional colours stay consistent.

## Implementation and acceptance checklist

- [x] Copy-on-write three-map factory; unchanged historical and unrelated records.
- [x] Explicit Solo/Versus review route, separate profile/session and Studio entry.
- [x] Compile all presets; inspect actual actors, wall/refuge separation, usable
      departures and retained components; no unintended empty remote autofill.
- [ ] Legal deterministic route evidence with replay, both controls and presets;
      distinguish opening evidence from complete clears and retain failed samples.
      Both intended approaches need full legal continuations across presets and
      controls; any missing continuation stays an explicit open gate.
- [x] Same resolved Solo/Versus level and deterministic prepared states; no invented
      completed paired-race or Team evidence.
- [x] Focused tests, formatting/lint and independent source review.
- [x] Separate draft PR332; remain behind the sole publisher's accepted release queue.
- [ ] Native/public selection, capture, Next/Skip and return verification after freeze.
      The review route's unified Missions selector lists the three new editions
      and their separately tagged previous v6 editions, plus six preserved v5
      editions. Default-entry promotion and its discoverability remain a separate
      publisher decision; source-only presence is not a public delivery claim.
- [ ] Human balance, cultural/art fit, keyboard/controller/touch and device review.

## Current qualification evidence

The final bounded cohort passes **130/130 checks**, with no skips, in eight
focused test files. Changed JavaScript passes ESLint and formatting. This is not
the long suite, full repository validation, release build or public acceptance.

The three Standard/immediate seed-1 routes are replay-verified no-loss clears,
using unchanged gp4 preparation and no admin overrides:

| Mission                | Clear time | Captures | Earned coverage |
| ---------------------- | ---------: | -------: | --------------: |
| Cross-stitch crossings |     48.5 s |       11 |          70.59% |
| Rushnyk bands          |     62.3 s |       10 |          72.34% |
| Pysanka sections       |     54.1 s |       13 |          76.80% |

See `game/test/fixtures/ukrainian-ornament-clear-routes.json` and its four replay
tests. These extend the exact earlier incomplete routes; nothing was replaced
with fabricated state, instant captures or altered enemies.

The separate `ukrainian-ornament-routes.json` retains 116 opening samples,
including 88 life losses. Of 36 approach/preset/control configurations, 28 have
a safe sampled closure and eight remain unqualified: Cross-stitch Expert
shoulder (both controls), Rushnyk Standard/Expert band-end (both), and Pysanka
Expert shoulder (both). Its six 80k-simulation-tick continuations remain recorded
as incomplete; three later 160k-budget extensions clear. Search ticks are offline
work, not gameplay duration. Failure of a bounded search does not prove impossibility.

Actual Gentle/Standard actor populations are 3/4/3, and Expert populations are
5/6/4, respectively. This includes the existing Rushnyk perimeter patrol and
Pysanka frontier patrol, not only field keepers. Initial fields are connected and
enemy-retained. Protected wall contact passes all 18 preset/control cases. Both
artwork modes preserve all 88 unrelated missions and historical source data.

Integration checks cover 100 unique Journey display identities (91 current,
three previous ornament versions and six v5 alternatives), truthful Ukrainian
and Arcade tags, original sequence order, profile isolation, fixed handoff
identities, disposal and zero artwork fetches while browsing. They do not decode
receiving-host pictures or constitute public/native launch evidence.

Verification limits: an attempted broader source-host navigation run first lacked
sparse-checkout fixtures, then was stopped after readiness failures rather than
reported as passing. The separate bootstrap, default-entry, Studio and fixed-link
checks pass; the fixed-link-only run has 11 name-filter skips. Full host/native,
physical controller/touch, public Pages and long-suite checks remain open. Early
new-test failures were fixture assumptions (single-mode host, Solo manifest API,
disposed launch rejection) and an in-progress snapshot hash; corrected tests
retain the actual adapter contracts rather than changing runtime behavior.

The final two gates cannot be inferred from source tests. An automated clear
does not establish fun or difficulty; fast safe bypasses require design review,
not automatic quota inflation. Keep the next core review (Horizon/Border/Signal)
wall-free until the existing wall lesson and preserve its onboarding.
