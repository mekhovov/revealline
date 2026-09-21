# Rover first-capture teaching review

Status: local candidate successor, not released or human-qualified. This addresses
two of the four early-learning pacing warnings; Signal's Dry spine and Garden
refuges remain under review. A clean metadata report alone is not acceptance.

## Finding and intervention

The historical Standard/immediate seed-1 route for Wake the yard first wakes its
roamer at tick1710, after58.16% coverage. The player is near the bottom return and
the warning starts remotely near the top. Split berths first warns at tick726,
after18.66%. Those are observations of particular legal routes, not guarantees
about all play or evidence of human understanding.

The explicit `teaching-1` successors make the short opening connection reclaim
the first sleeper's cell. Wake places it at32.5,7.5, facing down, and removes the
outer patrol from this introduction. Split places the near sleeper at18.5,5.5,
facing down; its separate far sleeper is unchanged. Initial foundations provide
left and right departures after the return. Field keepers, coverage targets,
challenge bands, materials, art, roamer speed and one-second warning stay intact.
Only Wake's authored threat-density rating changes from3 to2.

The introduction/practice declarations now describe learning stages rather than
also categorizing the newly taught role as an advanced combination. Stepped
return remains the later combination. This metadata correction accompanies an
actual encounter change; it is not a diagnostic suppression.

Nintendo's [Wonder developer interview](https://www.nintendo.com/us/whatsnew/ask-the-developer-vol-11-super-mario-bros-wonder-part-1/)
describes prototyping surprising course ideas while retaining familiar, trusted
interaction rules. Applied here as a design hypothesis: a capture visibly wakes
a new threat, without changing capture or movement rules. The interview does not
establish that this redesign improves enjoyment or retention.

## Deterministic evidence

`rover-teaching.test.mjs` checks:

-180 starts: two missions × three presets × two steering settings × five seeds
× three initial delays. First Down closure starts the warning below1% coverage,
stops movement, preserves lives, gives the full120-tick warning and permits
two seconds of observation followed by either tested72-tick side escape.
-12 ordinary no-loss clears with pinned identities/checkpoints, public replay
verification and equal untimed paired boards. Each includes a closure after a
roamer is active, not merely a final capture that awakens one.
-12 optional-goal routes with unchanged goal predicates and pinned replay
checkpoints. Split's Standard and Expert mastery requires different routes
from the ordinary clear; completion alone is not mastery.

- Historical source factories, maps, original assets, later missions and old
  fixture bytes remain unchanged. Old clear/mastery/art regressions still apply
  to their old editions, not silently to the new one.

Negative evidence is preserved: the former Gentle grid clear loses a life in the
new encounter, and the old Expert grid mastery route also failed during review.
New command routes were found and pinned without reducing targets or editing
runtime state. The Expert grid mastery route waits12 more command ticks at the
first broad landing before using the existing Standard grid route geometry.
These are sampled feasibility checks, not universal safety, readable-warning,
reaction-time, duration or human-enjoyment qualification.

## Explicit enrollment and remaining checks

Studio's Rover and whole-library Inspect actions select this successor but retain
the Inspect → Apply boundary. `?journey=whole-originals-v2` selects it in both real
Solo and Versus hosts, using the same compiler, registry, chooser and71-core
continuation. The old `whole-originals` source and v1 suspension key remain exact;
the new route owns the v2 suspension key. No public/default Journey is expanded.

The whole-library opt-in is `roverTeaching: true`; default factory calls preserve
prior editions. Exactly two mission definitions change; the83 originals, all
map geometry, the other81 missions and twelve optional Remixes remain intact.

Full71-mission real-host tests and native warning/escape review are in progress.
Accepted-tree integration, human prediction/failure-understanding evidence,
physical-device qualification, release packaging and GitHub Pages publication
remain required. This record does not declare P13/P15 or the full plan complete.
