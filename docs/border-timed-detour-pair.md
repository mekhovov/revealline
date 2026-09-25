# Border Bloom: two optional timed detours

## Audit and bounded successor

Accepted main `b13089b702391c275f2505d1a76c87eebb9dcce0` uses the 91-mission
`whole-spatial-v9` Journey. Only three missions have timed bonuses: Behind the
patrol, Second landing and Long rail, one schedule each. Ten other missions have
fixed bonuses without schedules. Border Bloom's six core missions progress from
outer patrols to frontier patrols; its fourth mission, New frontier, is the
uncluttered introduction to that changing contour and stays exactly unchanged.

`createBorderTimedDetourPairCandidates` prepares successors for Turn the corner
and Return pocket, the two following practice/combination missions. It does not
replace the accepted route, modify a historical edition, or automatically enroll
a release. No overlap with the mission geometry in PRs #421, #429, #441 or #443
is required. Release integration must explicitly compose these two mission
revisions with the accepted source and retained-edition library.

All map geometry, enemy roles/counts/positions, existing fixed bonuses, goals,
objectives, mission IDs, campaign order, pictures, difficulty facets and gameplay
policy remain unchanged. Only the two mission revisions, their optional
schedules and explanatory design text change, with containing campaign/pack
revisions updated. Original art is reused without altering or copying files.

## Route decisions

| Mission         | Optional window                                         | Route choice                                                                                                                                                                                             |
| --------------- | ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Turn the corner | One enemy-freeze collection, three possible appearances | Keep the L-shaped foundation as a short return, or detour beside its north, inner or east arm before closing. A missed east window can return to the north instead of rewarding camping at one location. |
| Return pocket   | One enemy-slow collection, three possible appearances   | Close the broad pocket mouth directly, or choose a detour inside, above or outside the shelter while respecting the distinct outer/frontier patrols.                                                     |

The fixed slow/freeze pickups remain where authored. Neither old nor new bonus
is a completion objective. The new schedules cannot farm repeated grants. No
forced player acceleration or new enemy behavior is introduced.

## Existing timing and presentation contract

- Turn the corner first announces at simulation tick 480 (4 seconds); Return
  pocket at tick 600 (5 seconds), if a valid opportunity exists.
- Every announcement lasts 120 ticks (1 second), followed by at most 1200 ticks
  (10 seconds) of availability. Missed windows expire, rest for 960 ticks
  (8 seconds), then announce another eligible anchor. At most three appearances
  or one collection are allowed.
- Presets retain those authored timings. Enemy speeds/population and impact
  rates still follow the existing preset and gp4 preparation; no custom tuning
  overrides are used in verification.
- This is the existing `timed-bonuses.v2` engine. Its ordinary dashed announcement,
  seconds label and shrinking lifetime ring distinguish the warning from a
  collectible item and show expiry. This change adds no new renderer or phase.
- Contact, not enclosure or touching a warning outline, collects a bonus. The
  shared next-tick activation, finite effect duration and expiry-tick precedence
  remain unchanged. Recovery pauses the active schedule clock.
- Eligibility still rejects occupied, reclaimed, lethal, blocked or live-trail
  anchors. If none is eligible the appearance is deferred, not forced. A valid
  geometric opportunity does not promise safety from moving enemies. Different
  routes/presets can therefore cause different cancellations or eligible anchors;
  identical prepared inputs and seed remain deterministic.

## Verification delivered

Node 20.19.5, `node --test game/test/border-timed-detour-pair.test.mjs`:
**9 grouped cases passed, 0 failed, 0 skipped**, 37.22 seconds under concurrent
local work. This is a focused file, not the complete suite.

The cases include:

- Exact preservation of accepted geometry, actors, fixed bonuses, objectives,
  pictures, policy, order, difficulty facets and untouched mission editions.
- Twenty-four actual no-loss early return samples: two missions, three presets,
  both steering policies and seeds 1/2. Each closes before the first announcement.
- Twelve actual optional collection-and-return routes: both missions, all
  presets and both steering policies at seed 1. Effects activate, collection is
  capped, and exported replays reconstruct the result.
- Twelve ignored-window samples with real announcement, appearance, expiry and
  a distinct relocated anchor, plus Standard exhaustion of all three windows.
- Actual contact with Return pocket's warning outline before materialization:
  no grant. Standard paired boards have independent schedule state and matching
  command/collection/return checkpoints.
- Two exact Standard/immediate/seed-1 **no-bonus no-loss full clears**, recorded
  in `game/test/fixtures/border-timed-detour-clears.json` and verified through the
  public replay API:

| Mission         |           Clear time | Captures | Earned coverage |
| --------------- | -------------------: | -------: | --------------: |
| Turn the corner | 5516 ticks / 45.97 s |        9 |          72.65% |
| Return pocket   | 8879 ticks / 73.99 s |       17 |          72.10% |

The optional-collection routes deliberately isolate the window rather than
measure an optimized clear: Turn the corner lets the first window expire before
collecting the relocated northern one. Return pocket's Standard route waits to
tick 900 before departure; Gentle/Expert use tick 720. The initial Standard
tick-720 departure really loses a life to the frontier at tick 815 and remains
an explicit failing-route regression, not an omitted result or an engine fix.

The first focused run had 6 passes and one test error: it incorrectly expected
impact speed to be identical across presets. The correction compares each
preset to its own unchanged historical runtime; final 9/9 includes this check.
No gameplay expectation was weakened or enemy removed.

Clear routes were found by the read-only, public-input search helper from
PR #323 at `e8888844e398d9850bc833ca1a070f00e6cad5ea`, using this branch's actual
gp4 engine. Its source reference is recorded in the fixture; it is not a new
runtime dependency. Corner used 68,948 of 80,000 simulated search ticks. Pocket
first exhausted 80,000 ticks at 56.21% coverage, then a separate 100,000-tick
continuation used 58,280 ticks to clear. The first exhausted sample is preserved
in the fixture. It never implied impossibility or dependence on a bonus.

## Remaining gates and limits

Scoped ESLint 10.10.0, Prettier 3.6.2, syntax and whitespace checks passed.
The first lint invocation lacked its cached `globals` dependency in the sparse
worktree; linking the existing pinned dependency resolved that setup failure.
No version change, build, default enrollment, merge or Pages deployment is part
of this preparation PR. Publication remains with the release owner.

These are deterministic feasibility samples, not human balance evidence. Full
clear routes for every preset/control/seed, voluntary human detour/retry behavior,
native keyboard/controller/touch sessions, picture-decoding and public frozen
build journeys remain unverified. The existing render contract was inspected,
not newly certified on a physical screen. Team content is outside this pair.
