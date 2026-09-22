# Rover first-capture teaching review

Status: local candidate successor, not released or human-qualified. This addresses
two of the four early-learning pacing warnings; Signal's Dry spine and Garden
refuges remain under review. A clean metadata report alone is not acceptance.

## Finding and intervention

The historical Standard/immediate seed-1 route for Wake the yard first wakes its
roamer at tick 1710, after 58.16% coverage. The player is near the bottom return and
the warning starts remotely near the top. Split berths first warns at tick 726,
after 18.66%. Those are observations of particular legal routes, not guarantees
about all play or evidence of human understanding.

The explicit `teaching-1` successors make the short opening connection reclaim
the first sleeper's cell. Wake places it at (32.5, 7.5), facing down, and removes the
outer patrol from this introduction. Split places the near sleeper at (18.5, 5.5),
facing down; its separate far sleeper is unchanged. Initial foundations provide
left and right departures after the return. Field keepers, coverage targets,
challenge bands, materials, art, roamer speed and one-second warning stay intact.
Only Wake's authored threat-density rating changes from 3 to 2.

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

- 180 starts: two missions × three presets × two steering settings × five seeds
  × three initial delays. First Down closure starts the warning below 1% coverage,
  stops movement, preserves lives, gives the full 120-tick warning and permits
  two seconds of observation followed by either tested 72-tick side escape.
- 12 ordinary no-loss clears with pinned identities/checkpoints, public replay
  verification and equal untimed paired boards. Each includes a closure after a
  roamer is active, not merely a final capture that awakens one.
- 12 optional-goal routes with unchanged goal predicates and pinned replay
  checkpoints. Split's Standard and Expert mastery requires different routes
  from the ordinary clear; completion alone is not mastery.
- Historical source factories, maps, original assets, later missions and old
  fixture bytes remain unchanged. Old clear/mastery/art regressions still apply
  to their old editions, not silently to the new one.

Negative evidence is preserved: the former Gentle grid clear loses a life in the
new encounter, and the old Expert grid mastery route also failed during review.
New command routes were found and pinned without reducing targets or editing
runtime state. The Expert grid mastery route extends its first Down segment by 12
ticks, moving one cell farther into the broad landing before its left turn; it
does not insert an idle wait. Real-host routes rearm direction after closures.
These are sampled feasibility checks, not universal safety, readable-warning,
reaction-time, duration or human-enjoyment qualification.

## Explicit enrollment and remaining checks

Studio's Rover and whole-library Inspect actions select this successor but retain
the Inspect → Apply boundary. `?journey=whole-originals-v2` selects it in both real
Solo and Versus hosts, using the same compiler, registry, chooser and 71-core
continuation. The old `whole-originals` source and v1 suspension key remain exact;
the new route owns the v2 suspension key. No public/default Journey is expanded.

The whole-library opt-in is `roverTeaching: true`; default factory calls preserve
prior editions. Exactly two mission definitions change; the 83 originals, all
map geometry, the other 81 missions and twelve optional Remixes remain intact.

The 21-case source/route/art/Studio cohort passes on Node 20.19.5 and 22.22.2;
historical Rover art/clear/mastery regressions also pass. A further exact-manifest
check verifies that 486 whole-review preset/mode manifests stay unchanged and
only the 12 projections of the two successor missions differ.

Native source `8c36f85e` at owned localhost port 8813: Solo direct chooser launch,
first Down closure and warning were observed for both missions (Wake 0.5%/110 points,
Split 0.4%/90 points, three lives). Pausing on the actual DOM coverage signal
retained the warning; Wake's optional Field details showed no unfinished line and
0.8s before rover activation. Resume+Left visibly departed Wake's platform;
Resume+Right and immediate pause departed Split with lives intact. Original art,
reclaimed connection, marked warning actor and still-covered field were visible.

Negative native observations remain: prolonged idle inspection of Wake lost a
life, and letting its leftward departure run unattended afterward also lost one.
These were not clean full clears or precise reaction-time measurements. A failed
observation selector initially used the AX spacing rather than actual DOM text;
the subsequent bounded check used the observed `0.5%` text. Ground-rover body
contact also exposed a generic line-caught caption, handed to the UI owner for
a cause-specific fix. Human readability and loss-copy verification remain open.

Native Studio inspection compiled 83 missions without changing the one-mission
workbench until explicit Apply. Apply created the teaching review draft with
24 packs/25 campaigns/83 missions; selecting Wake showed the sleeper at (32.5, 7.5),
two field keepers, 64 permanent interior cells and no outer patrol. Candidate-art
and disconnected-foundation warnings remain visible. The two Signal pacing
warnings are retained with a [separate scaffolding review](signal-practice-scaffolding.md).

Node 22's full 71-mission Solo real-host clear/70 Next/failure-retry test and all 71
equal Versus races/70 Next pass (504s and 96s respectively). These finite host tests
decode real PNG headers/hashes but do not replace native decoding or human play.
The final Node 20 whole-host recheck also passes both cases (550s Solo, 134s Versus).
Both runs include all 71 command-earned clears/races and 70 deliberate Next actions;
the injected artwork failure is expected negative evidence, not an unhandled failure.
Accepted-tree integration, human prediction/failure-understanding evidence,
physical-device qualification, release packaging and GitHub Pages publication
remain required. This record does not declare P13/P15 or the full plan complete.
