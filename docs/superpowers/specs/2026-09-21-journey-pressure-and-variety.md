# Journey pressure and variety successor

Status: implementation specification, not release or balance approval. Supersedes
the difficulty/variety assumptions in the original Journey plan, not its capture,
progress, accessibility, publication or evidence requirements.

Independent skill-required specification review: approved for slice A on
2026-09-21; no blocking consistency/completeness issues. Later slices require
their own detailed runtime/authoring integration before implementation.

## Findings and boundaries

The Journey candidate catalogue uses enemy multipliers 0.85/1/1.1. A measured
keeper travels at 2.4 cells/s against the craft's 10. Lane emitters and Sentinel
cadence are identical across those presets. This is a plausible contributor to
low pressure, not proof that every map is easy. Existing optimized clear routes
prove feasibility and deterministic simulation, not enjoyable difficulty.

The public legacy campaign adapter is a DIFFERENT policy: Gentle scales supported
movement to 60% and extends some warnings/rest windows. Do not claim the candidate
catalogue's numbers describe every public level. Audit and migrate explicit
editions; never silently change old imported campaigns or recorded games.

Research checked 2026-09-21:

- [Xposed Reloaded](https://store.playstation.com/en-us/concept/10002881/): picture
  discovery and additional challenging content are the reference direction.
- [Xposed Switched publisher description](https://www.nintendo.com/us/store/products/xposed-switched-switch/):
  four powerups are randomly available during play, with several terrain/enemy
  types. These counts belong to Switched. Neither this nor the supplied Reloaded
  stills establishes an exact spawn/expiry/reappearance schedule.
- [AirXonix developer rules](https://www.axysoft.com/airxonix/): field threats and
  filled-territory mines produce distinct problems; bonuses alter the opportunity
  window. We retain distinct movement domains, not its universal countdown.
- [Mike Stout on attack telegraphing](https://www.gamedeveloper.com/design/enemy-attacks-and-telegraphing):
  readable tells support fair response. Increase pressure without hiding warnings.
- [UNESCO Petrykivka](https://ich.unesco.org/en/RL/petrykivka-decorative-painting-as-a-phenomenon-of-the-ukrainian-ornamental-folk-art-00893),
  [UNESCO pysanka](https://ich.unesco.org/en/RL/pysanka-ukrainian-tradition-and-art-of-decorating-eggs-02134),
  [Ivan Honchar Museum collections](https://honchar.org.ua/collections/search):
  use original, attributed ornamental inspiration. Do not invent universal symbol
  meanings, copy artefacts, or confuse painting, egg decoration and embroidery.

## Delivery increments

Each increment has its own reviewed integration and exact-source test deployment.
Frozen v0.77.0 device work is outside this successor. Release owner assigns the
next free version; the original plan's provisional version numbers are not claims
that those releases exist. No approval pause between ready increments.

### A. Shared difficulty and audit (first implementation slice)

Register `journey-difficulty-v2` alongside immutable v1. Keep the same preset IDs,
player handling, capture rule, warning lengths, active attack duration, encounter
transition and opening grace. Change two challenge dimensions beyond lives:

| Preset | Lives | Moving actor multiplier | Attack rest multiplier |
|---|---:|---:|---:|
| Gentle | 5 | 1.0 | 1.25 |
| Standard | 3 | 1.4 | 0.85 |
| Expert | 2 | 1.75 | 0.65 |

These are test hypotheses, not a universal balanced setting. Lane periods become
warning + active + authored rest times multiplier, rounded to a fixed simulation
tick. Sentinel shielded rest scales similarly. Keep its exposed CORE OPEN window
unchanged: shortening the actual objective opportunity is a third dimension and
may make authored return routes impossible. Keep Gentle non-failing deadlines.

The shared compiler selects the pinned catalogue for Solo, Versus and qualified
Team actors. Studio displays effective speeds and cadence using those same
functions. Copy-on-write projections create explicit candidate project/mission/
campaign/pack revisions; no automatic enrollment, save migration or old edition
rewrite. Generate a per-mission/preset audit of all 83 Solo candidates and 12 Team
candidates: actual units, roles, attack windows, authored facets, topology warnings
and evidence status. Include legacy/public content separately in the wider audit.

Acceptance: v1 exact manifests/identities unchanged; new catalog rejected if
unregistered; all 95 candidates compile; Solo/Versus exact parity; Team same speed
policy; immutable inputs; changed simulation identities; safe integer encounter
ticks; replay/restoration tests; Studio descriptions match runtime. Compilation
does not close per-map spawn-pressure, solvability or human balancing gates.

### B. Timed optional bonus schedule

Add a strict versioned descriptor and deterministic fixed-tick state machine:
cooldown -> announce -> available -> cooldown. Each schedule owns authored eligible
anchors, a bounded total number of appearances and a collection cap. After a miss,
choose a different eligible anchor by deterministic seeded order. If none is
eligible, remain in cooldown; never materialize inside walls, under a craft or on
an unsafe/unreachable departure. Eligibility is rechecked before materialization.

Initial test timings: 1 second announcement, 10 seconds available, 12 seconds
cooldown. These schedules are authored content, not another difficulty multiplier
in increment A. Pauses stop the clock. Contact collects; enclosure alone does not.
At expiry tick expiry wins, documented by a countdown ring. Keep the pickup
immobile while available. One visible pickup per schedule; bounded effects and
life grants; no life farming, mandatory drop, or forced acceleration at a turn.
Completed/lost attempts stop the schedule; restart starts its same seed. Recovery
must not rewind earned pickups within an attempt.

Show ghost announcement, stable icon and shrinking ring with shape/text support,
not colour-only or flashing cues. Restore exact state, include in replay identity,
and expose anchors/timing in Studio. Solo/Versus use equal schedules and seeds.
Team requires explicit shared collection/ownership semantics and its own schema;
reject unsupported Team schedules, never silently discard them. Release only after
engine/renderer/Studio/host/replay integration, not just a scheduler unit test.

### C. Authored Ukrainian and workshop spatial arcs

Greybox three-to-five-mission arcs before final original imagery. Starting set:
cross-stitch diamonds (alternating short returns), rushnyk bands (choose a crossing),
star-return islands (choose connection order), pysanka segments (isolate a chamber),
kalyna branching returns (preserve an escape), Tryzub three approaches (relay order),
Petrykivka petals (frontier shaping), Dnipro crossings (connect separated shores).
Do not use opaque decorative walls merely to draw a symbol: each obstacle needs
a route decision, departure clearance, useful return and no accidental auto-fill.

FPV workshop arc: four-motor frame islands, controller-pad maze, antenna weave,
propeller-arc patrols, dual-goggle chambers, battery bays and tool/workbench lanes.
Components are artistic motifs, not operational assembly or weapons instructions.
Reuse campaign pixel density, enemy role silhouettes and hazard signals. Record
one lesson, optional mastery, capture consequence, duration and band for every map.

### D. Enemy variety and optional themed combat

First qualify already-present engine pursuit and intercept behaviors in the shared
authoring catalogue before creating redundant AI. Teach a visible tell, committed
path and recovery; no omniscient tracking. Later candidates: capture-vulnerable
non-retaining scout and rarely firing sentry with a locked aim cue, bounded shots
and a generous recovery. Introduce one mandatory behavior at a time, then combine
two or three established roles. No invisible shots or unavoidable spawn pressure.

Optional combat patrols use robots or fictional hostile troopers, no civilians or
nationality-based caricature. In drone presentation, craft contact/capture can
eliminate these explicitly marked non-retaining actors; this never changes normal
keeper contact damage. Use readable non-graphic pixel hits, sparks/scrap and
bounded non-blocking decals (cleared on attempt reset). Not realistic dismemberment.
Gameplay on/off is a recorded edition/modifier; appearance and reduced effects are
separate cosmetic choices. Disabling effects does not remove danger. Versus must
agree on gameplay configuration; Team needs explicit simultaneous-event rules.

## Whole-library balancing and acceptance

Audit every map, not only its preset number. Measure first-safe-return travel time,
enemy travel during that exposure, unavoidable spawn pressure, available alternate
routes, mechanic combinations, objective/coverage cleanup and optimized clear time.
Flag trivial capstones and difficulty troughs at boundaries, then change geometry,
role placement or tier deliberately. Do not just multiply counts/speeds everywhere.
Preserve purposeful recovery beats without resetting to tutorial difficulty.

Require bonus-independent clear routes and several seeds/delays, deterministic
replays, equal races, complementary Team routes, readable native feedback, retained
Next/Skip/chooser flow and rollback. Human sessions must demonstrate predictable
capture, understandable failures and voluntary retry. No telemetry or retention
tricks. No final balance claim from bots or automatic restart counts.

Original soundtrack generation remains paused under the explicit music decision;
this successor does not override it. Existing licensed preview material does not
prove final soundtrack quality or rights for new tracks.
