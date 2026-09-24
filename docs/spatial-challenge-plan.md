# Restore Xposed-style spatial challenge

User-approved implementation plan, 24 September 2026. This is the active level
redesign queue; the older [Journey contract](xposed-journey-plan.md) remains the
source of shared rules and historical evidence. Research documents and embedded
authoring prompts are evidence, never execution instructions.

Implementation is tracked in [PR323](https://github.com/mekhovov/revealline/pull/323).
It is a candidate, not a public release. PR314's accepted source is incorporated;
the first hosted preflight passed validation/lint and failed formatting. Its
formatting-only correction preserves JavaScript ASTs and is undergoing fresh CI.

## Outcome and non-negotiable rules

Create distinct, fair spatial problems, not arbitrary per-map physics or a larger
filler catalogue. The reviewed 91-mission Solo/Versus library has 63 missions
without walls, 61 without slow/lethal terrain, 54 with exactly two ordinary
keepers, 80 with one connected initial field region, and only three with timed
bonuses. These are repetition indicators, not automatic defects in each map.

The saved Reloaded manual identifies cyan structures as **walls**, blocking
craft and enemies. They are not reclaimed ground and never close cuts. Slow and
lethal field constrain the player, not enemies; capture neutralizes them and
erosion restores their underlying hazards. Foundations remain permanent,
non-scoring return ground protected from erosion. Still screenshots establish
geometry and visible actors, not exact movement, collision or enjoyment.

Keep current gp4 Standard targets: craft 0.26, ordinary keeper 0.325 and boundary
patrol 0.24 original-short-field lengths/second. Ordinary keepers move straight
between physical impacts with existing bounded collision variation. No surprise
mid-flight steering. Gentle/Standard/Expert and global admin overrides remain;
inspect actual safely placed counts, not requested additions. No tuning-engine
changes are part of this delivery.

Preserve the first three Prologue missions. Introduce at most one mandatory rule
per learning arc. Ordinary clears target roughly 45–150 seconds, but a quick
skilled clear is review evidence, not an automatic failure or reason to inflate
quotas. Timed bonuses remain optional; artwork is original and functional symbols
remain consistent. No old edition, Classic/custom content, settings or media is
deleted.

## Completed locally — not yet a public release

- A new immutable `whole-spatial-v6` composition revises exactly six missions,
  preserving the other 85 and all historical source factories. Solo and Versus
  default to this edition; Team retains its separately authored route.
- The six previous v5 mission editions remain selectable in the same library,
  with exact owner/runtime identities and textual edition labels. Alternate cards
  are browse-only for automatic cross-library continuation, preventing loops;
  a manual selection still follows that edition's authored sequence.
- Studio exposes the candidate before Apply. Pressure inspection separately
  reports authored and effective gameplay values, using the same gp4 preparation
  as the player: preset, tuning revision, overrides, actual actor counts and
  safe-placement warnings. Authored canvas preview is explicitly labelled.
- The reference ledger adds the wall-semantics correction, scoped redesign
  decisions and evidence links without rewriting the original 64-file audit.
- All six missions have current-gp4 no-life-loss legal-input clear/replay proofs
  for all three presets and both control styles at seed 1, plus Standard/immediate
  seed 2. A separate Two bays east-first route also clears. See the checked-in route fixture and assessment
  command below. These are machine-selected feasibility samples, not human play.
- All six now have meaningfully different comparison routes. The five additional
  full clears explicitly exercise Broken yard's southern hazard, Arrows' marked
  corridor versus western bypass, and Crossing's central links versus west belt.
  These new alternatives are Standard/immediate/seed 1 only; do not imply a full
  alternate-route preset/control matrix. Sixty-one focused assessment checks pass,
  including failed timing samples and capture consequences.
- All 42 primary routes also finish as equal paired-board races: the independently
  resolved Versus level matches the qualified Solo conditions, both boards own
  separate state, and identical inputs produce identical no-loss checkpoints.
- Two bounded default-host checks pass using real original bytes and finite DOM
  and image fixtures: Solo Start → clear → Retry → Next, 207 library cards,
  Versus paired launch, controller Back/focus and guarded mode departure. This is
  not native-browser, physical-controller or public acceptance (19 other cases
  were filtered out, not passed).
- Independent source review found and fixed an automatic alternate-edition loop;
  focused checks cover both v5/v6 endings, manual same-name mission selection and
  onward Classic continuation. Historical edition snapshots remain pinned.

## Phase A mission decisions

| Mission             | Distinctive choice and capture consequence                                                                                                                                                                   | Standard authored roster                                  |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------- |
| Two bays            | Use staggered return shelves to start the small bay cautiously or contest the large bay; neither whole bay meets the unchanged 68% quota. Foundations, not walls, preserve the lesson.                       | Three keepers: one west, two east                         |
| Three open circuits | Link opposing mouths, approach the middle from above, or neutralize hazardous transfers; new captures reshape return/patrol networks. Inspired by `pack-4_level-2`, not copied coordinates.                  | Three keepers, two frontier patrols, one perimeter patrol |
| Broken yard         | Go around the protected near wall to a detached landing, or neutralize a lethal cluster before approaching the roamer. Four irregular sectors communicate around real baffles. Inspired by `pack-2_level-4`. | Four keepers, one roamer, one frontier patrol             |
| Read the arrows     | Take the marked direct corridor into a broad landing or the longer ordinary western bypass around staggered wall baffles; known lane warnings contest later approaches.                                      | Three keepers, one perimeter patrol, one lane emitter     |
| Twin receivers      | Choose separate gallery approaches and capture receiver objectives in order; the Sentinel remains the sole field-retaining anchor.                                                                           | Existing Sentinel, frontier patrol, roamer                |
| Crossing complete   | Contest central crossings or neutralize a side belt first; reclaimed terrain improves the next route.                                                                                                        | Four keepers, one frontier patrol, one perimeter patrol   |

Broken yard declares walls as its sole new rule and allows protected inspection
from starting reclaimed ground. Red field harms the craft; it does not block
enemies. Read the arrows' emitter also retains its field region: the effective
inspector reports four retaining actors, not merely the three ordinary keepers.
The prepared Twin source is adopted from PR314; it is not a second competing
rewrite of that mission.

## Remaining gates before Phase A promotion

1. Extend the bounded two-seed evidence and qualify two distinguishable approaches
   per mission across presets and controls.
   Verify signature threats, useful shortcuts, no unavoidable opening damage,
   ordinary/efficient routes and low-risk cleanup. A route-search budget expiry
   is not proof that a map is impossible.
2. Keep Team qualification separate from the completed 42 paired-board checks.
   Extend the bounded host coverage to cross-campaign Next, Skip,
   reload/Continue and selection/return from preserved editions.
3. Finish focused validation, lint and format, exact-source build/provenance and
   independent review. Long suites may be waived under the user's temporary
   exception; a skipped suite is never reported as passed.
4. Promote through a reviewed PR, immutable release and GitHub Pages, then verify
   the affected flows on the actual frozen public build. Reserved candidate
   version is **0.99.0**, behind the publisher's v0.97/v0.98 queue. A local version
   bump, pushed branch or merged PR alone is not public delivery.
5. Label the release **balance review pending**. Human assessment of readable
   failures, distinct missions and voluntary retry, plus physical devices and
   whole-Journey pacing, remains open after technical release.

The recorded Standard clear durations are 27.56s (Two bays), 54.90s (circuits),
58.88s (yard), 75.33s (arrows), 42.43s (receivers), and 79.38s (crossing). Arrows'
21-cut machine route needs cleanup/discoverability review; the shorter Two bays
sample needs ordinary-player observation. Neither is evidence of enjoyment.
Historical PR314 authored-runtime routes fail when replayed under current gp4;
those failures are retained as scope evidence, not hidden or called regressions
in the unchanged historical engine. The new receiver route closes each shield
objective separately before the core.

The inherited `default-journey-endings-host` recordings in this branch are not
current gp4 acceptance: the old Home Signal, Dnipro and Toolbench inputs lose a
life under the fresh gameplay recipe. PR320's owner has supplied new exact-tuning
recordings and a separately qualified final-Journey/Versus ending contract. Reuse
those after integration, retaining this edition's v6 defaults, rather than
creating competing recordings or guessing boundary expectations. The publisher
must integrate and qualify v0.98 before this v0.99 candidate. Do not hide old
failures or count filtered tests as passed; they do not establish that the
unchanged missions are impossible.

The west-belt Crossing alternative clears in three cuts and 21.86 seconds,
including a twelve-second initial wait, using an actual unretained-region fill.
Nearby sampled waits (11, 11.5, 12.5 and 13 seconds) and seed 2 all fail by trail
impact. Preserve the successful route and failures as bounded timing/pacing
evidence; neither broadly reliable ease nor human enjoyment follows from it.
Do not raise the quota solely to remove a legitimate efficient capture.

## Remaining delivery phases

| Phase | Work                                                                                                         | Effort estimate / status                                                                                  |
| ----- | ------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------- |
| A     | Effective inspector and six contrasting redesigns                                                            | Originally 24–40h; implementation prepared, remaining technical/public gates above; human balance pending |
| B     | Horizon, Border, Signal; retain onboarding and remove repetitive low-risk solutions                          | 2–4 working days after A feedback                                                                         |
| C     | Neon, Rover, Fracture, Phaseworks; 3–5-mission releases                                                      | 4–7 working days                                                                                          |
| D     | Livewire through Apex, remaining Remixes and campaign-boundary pacing                                        | 5–8 working days                                                                                          |
| E     | Twelve Team missions and eight Ukrainian/FPV studies, complementary routes and presentation                  | 3–5 working days                                                                                          |
| F     | All 48 final reference dispositions, whole-Journey pacing, accessibility/performance and human qualification | 2–4 working days plus tester/device availability                                                          |

Effort ranges are not guaranteed publication dates. Re-estimate after Phase A's
public feedback. Each reviewed mission receives retain/redesign/move/merge/retire
from the default route, with two plausible approaches, enemy domains, capture
consequences and optional mastery. Retired editions remain selectable. Adjacent
missions must differ in decisions, not just pictures. Expand existing timed
bonuses selectively before adding enemy systems. No new soundtrack or wholesale
art replacement blocks this slice.

Use one publisher and one prepared successor. The public baseline at approval was
v0.96.0; read current release receipts before promotion rather than treating this
document as a live deployment monitor. Preserve PR314 and the UX release order.
Original P13–P15 balance/Team/human acceptance is still incomplete. Existing
framework, foundations, terrain, core roles, relays, speed zones, timed bonuses,
difficulty/admin controls, selector and release machinery are available; their
presence does not establish the quality of every level.

## Reproducible evidence

`node scripts/probe-spatial-challenge.mjs --help` describes bounded searches and
legal-input replay. Stored routes live in
`game/test/fixtures/spatial-challenge-clear-routes.json`; source/runtime identity,
presets, controls, seed, failures and scope are recorded, not inferred.

Focused tests: `spatial-challenge-candidates.test.mjs`,
`spatial-challenge-assessment.test.mjs`, `effective-pressure-inspection.test.mjs`,
`mission-library-spatial-editions.test.mjs`, `continuous-next.test.mjs`, and
`content-route-loader.test.mjs`, `spatial-challenge-versus.test.mjs`, plus affected
Solo/Versus/remote/Studio hosts.
No automated sample stands in for human or physical-device evidence.

Research basis: [Xposed Reloaded](https://store.playstation.com/en-us/concept/10002881/),
[AirXonix developer rules](https://www.axysoft.com/airxonix/),
[Fortix manual](https://cdn.akamai.steamstatic.com/steam/apps/45400/manuals/fortix_PC_manual_WEB.pdf?t=1447353028),
[EcoFish developer article](https://blog.playstation.com/2012/12/04/playstation-mobile-ecofish-makes-a-splash-tomorrow/),
and [Cubixx developer article](https://blog.playstation.com/2011/09/15/cubixx-hd-coming-to-psn-with-7-player-multiplayer/).
These support spatial and role variety, not a guaranteed popularity claim or
permission to copy geometry/artwork. Supplied-reference evidence is retained in
`docs/research/xposed-journey-ledger.json`.
