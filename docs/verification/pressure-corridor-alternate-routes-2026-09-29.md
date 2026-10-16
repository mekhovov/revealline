# Pressure corridor: second strategic approaches

Status: scoped source evidence complete and independently reviewed; release
integration pending. Production testing is deferred, not
passed. Base: `de5aeaac2f601ed3703b40071c9c4e09a7ec7724` (the unchanged PR #793
input), with Pressure ladder and Switchback exchange retaining their v37 content.

## Scope and acceptance

The previous complete routes start with the upper Pressure ladder landing and
the western Switchback connector. This slice investigates the other authored
decisions, not reflected copies of those inputs:

- **Pressure ladder:** reach the lower landing through its slow-field approach
  first, then use the resulting return network for a complete clear.
- **Switchback exchange:** open the east connector before the west, then use the
  opened ground during a complete clear. Gate opening, briefly touching a gate,
  complete traversal and demonstrable shortcut benefit are separate observations.

Only public gameplay input may advance fresh resolved missions. Apply current
gameplay tuning exactly once; do not edit enemies, cells, objectives, lives or
terminal state to construct a successful route. Record waits while the world
continues. A successful route must verify its complete replay and equal actual
Versus boards, without a required bonus or lost life.

Standard / immediate steering / seed 1 is the bounded starting scope. Finding a
route does not demonstrate other presets, all seeds, live host controls, fair
human-readable warnings, cultural authenticity or enjoyment. No quota, speed,
map, default selection, artwork or historical edition changes are authorized by
a route fixture alone.

## Evidence boundaries

The test-only Phaseworks and Relay goal helpers predate the v37 authored design
copy. Keep their historical predicates and observations distinct from the current
mission's stated optional challenge; neither helper creates a runtime medal.
Report actual landings, gaps, objectives, impact closures and connector use before
claiming an optional goal. Do not reinterpret old fixtures or approvals.

Production/native/device/human tests remain deferred. Focused source correctness,
review and eventual integrated build/provenance/release integrity remain required.
This source slice does not allocate a new version or modify the frozen PR #793
branch. It is intended for consolidated publisher intake after review.

## Pressure ladder: lower staging before upper return

The lower-first source route uses Standard / immediate / seed 1 / scout and
reaches the lower landing at tick 658. It captures 20 cells, including five of
the forty initially unclaimed slow-field cells. A subsequent cut actually leaves
that lower landing at tick 687. The later upper return at tick 2,208 connects all
three foundations; it does not simply substitute a differently timed first cut
before the same upper-first sequence.

The full run wins at tick **3,263**, approximately **27.19 seconds**, with six
closures, 2,206/2,206 claimed cells, zero losses and no pickups. It encounters two
warned, fixed-target interceptor commitments and clears three craft-bound impact
fronts during captures, including a frontier impact. Checkpoint:
`c28892f0a872a209`. The source fixture separately verifies recorded replay and
equal independent Versus winning boards.

This is a fast skilled route below the ordinary 45–150-second target, not proof
of ordinary-player pacing, a dominant low-risk solution or human enjoyment. The
final large fill is legal under the unchanged enemy-seeded capture contract:
the two field-retaining keepers are on the final trail when it is secured, leaving
no seed in the remaining field component. No actor was removed or fill rule
overridden to obtain 100%. Impacts were active before closure, but the fixture
does not measure a closure/front-arrival timing margin or prove the craft was
almost hit. It is not a dedicated arrival-tie regression.

The all-foundation observation is concrete; it is not a runtime medal or a
complete revision-specific proof of the authored both-gap optional challenge.
A bounded search found this route, but did not retain an exhaustive rejected
candidate count. No search success-rate or general timing-tolerance claim follows.

## Switchback exchange: east connector used before west relay

The alternate route opens the east relay at tick **183**, while the west remains
closed. The craft enters the opened east connector at tick **368** and reaches
the eastern outer landing at **558**, moving across its complete horizontal
span on reclaimed ground without cutting. It then launches from that landing at
**660** and closes at **850**, before opening the west relay at **1,353**.
This is actual end-to-end use and a changed continuation, not a gate touched
after the ordinary western-first route was already complete.

The route wins at tick **5,417**, approximately **45.1 seconds**, with eleven
closures, 1,705/2,002 claimed cells (about 85.16%), zero losses and no pickups.
Checkpoint: `b1e9dccc51cfe04f`. After the roamer activates at tick **3,430**, the
craft traverses the east connector westward at ticks **3,741–3,930**, followed
by the west connector at **4,066–4,256**. Permanent return ground is not described
as immunity from that reclaimed-ground threat.

This successful route avoids all trail impacts and encounters eleven lane
warnings. Avoidance is valid counterplay; an impact is not compulsory evidence
of pressure. A bounded omitted-wait counterexample hits the emitter at tick
3,000. It does not prove every other timing or route would fail.

Both required objectives are already open with **312/2,002 cells** claimed
(15.58%), leaving seven cuts and 4,064 ticks of play. That records the amount of
post-objective coverage work; it does not establish that it is tedious or that
gate use is mathematically necessary for any clear. The current authored
different-court-gap optional challenge and a runtime mastery award are not
claimed by these observations.

The bounded investigation retains three failed legal-input variants as negative
regressions: an overlong upper cut (impact seeded at 928, loss by 981), departing
during the active bottom lane (loss at 3,000), and omitting the final keeper
window (impact at 5,228, loss by 5,233). Other exploratory wait values are noted
in the fixture without an exhaustive search-rate claim. A 90-tick final wait
also cleared in exploration; only the selected 120-tick route receives the full
replay/Versus qualification. These are counterexamples, not unique-solution proofs.

## Verification receipt

Final composed local execution passes **41/41**, zero failures, skips or
cancellations, in **4.68 seconds**:

```sh
node --test game/test/cooling-loop-erosion-candidates.test.mjs game/test/cooling-loop-erosion-routes.test.mjs game/test/pressure-corridor-complete-routes.test.mjs game/test/pressure-ladder-alternate-route.test.mjs game/test/switchback-alternate-route.test.mjs
```

This includes the existing 36-case Cooling/route cohort plus the five new cases
(two successful alternate routes and three negative Switchback controls).
Do not add earlier overlapping 1/1, 4/4 or 3/3 runs to this total. Changed-file
ESLint, Prettier and whitespace checks pass. Independent read-only review found
no remaining blocker after the arrival-margin wording was qualified.

Together with the earlier evidence there are now two complete strategies per
mission in the triptych, **six routes** total, on Standard / immediate / seed 1.
The wider preset/steering/seed matrix still establishes first returns only.
Remaining work is broader complete-route qualification, current-edition optional
gap observations, cleanup/repair quality and eventual human pacing review. No
new artwork, mission geometry, runtime rule, default edition or award is shipped
by this test/documentation-only increment. Production testing stays deferred.
