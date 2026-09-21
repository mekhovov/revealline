# Optional combat D2c — readable presentation and deliberate player choice

Status: proposed for independent review after D2b `a22bbb16`. Implements the
existing approved optional-combat direction, not new simulation rules. The user
authorized automatic continuation; no routine confirmation pause. Release/host
ownership and human acceptance still apply. Original soundtrack remains paused.

## Scope and sequence

Two implementation checkpoints complete D2c; neither alone completes D2d Team or
qualifies public content. Do not remove D2b's enabled-preview guard early.

1. **C1, current bounded work:** owned read-only combat projection, pixel robot
   bodies, mandatory locked-aim/projectile cues, short removal feedback and
   bounded persistent scrap; a static local review sheet and pure rendering tests.
   No shared app, Team host, preference or publisher mutation.
2. **C2:** integrate the approved C1 renderer into shared Solo/Versus painting;
   captions/audio, persistent options, deliberate next-attempt combat selection,
   exact-edition identity/progress/save behavior, real-host and native checks.
   Coordinate with the release owner before editing host-owned files. Only then
   permit Studio gameplay preview when its required presentation is available.

## Alternatives

- **Selected:** one original code-native pixel robot family with stable role
  badges; theme palettes/material accents may vary, silhouettes cannot. Rendering
  is deterministic, inspectable and does not require an external asset download.
- Extend ordinary enemy skins to include these characters: rejected because it
  confuses harmless contact/removal with retaining-body/trail threats and risks
  historical uploaded-body precedence.
- Full animated fictional soldiers now: deferred cosmetic work. Robots establish
  gameplay readability first. No civilians, nationality caricatures, gore or
  realistic dismemberment; the drone treatment is a brief mechanical spark/scrap
  effect, not a different damage rule.

## C1 data boundary

Add a separate `combatView(run)` beside classic/foundation views. It consumes
only supported foundation-aware runs and the opt-in descriptor/state. It returns
`null` for absent/disabled combat, and a bounded owned frozen projection for valid
active combat. Malformed active data returns an explicit invalid result, not a
successful empty view. C2 must stop that preview with a visible diagnostic rather
than silently painting an invisible active threat.

Use descriptor-safe reads like existing classicView: reject accessors without
executing them, sparse arrays, duplicate/unknown IDs, nonfinite/out-of-board
positions, oversized populations and inconsistent live/eliminated phases.
Limits remain24 actors,8 sentries,8 projectiles,24 unique elimination records.
Copy only presentation fields; never expose PRNG, mutable objects or write to a
run. Validate/derive warning progress from actorTick and the authored warning
duration, not wall time. Freeze keeps warnings/projectiles visibly frozen;
pause has no independent advancing cosmetic clock.

Projection includes live actor role/position/velocity/radius/phase, locked aim
and remaining warning ticks when applicable; projectile position/direction/radius;
elimination event-time position/cause/tick; current simulation tick/actorTick and
active freeze state. Scrap reconstructs after suspend/restore from authoritative
elimination records without replaying sounds. No future trajectories or player
input prediction is added to the simulation.

## C1 visual contract

- Scout: compact square visor, two alternating pixel feet, open side brackets.
  Sentry: same removable family plus a distinct top emitter/bar badge. Ordinary
  keepers retain their round damaging-body vocabulary. No role distinction is
  colour-only. Use native integer pixel masks, nearest-neighbour scaling and the
  existing actor sizing contract:16px phone/24px desktop minimum,32px ordinary cap.
  A small contact-centre/radius cue remains accurate even if art is enlarged.
- Walk pose derives from non-frozen actorTick and observed movement; warning and
  recovery poses are stationary. Reduced effects keeps a static leg pose, full
  silhouette and all functional cues. No bob, shake, flashing or expanding bloom.
- Locked warning: dashed two-ink aim ray, fixed target cross and a compact static
  countdown segment beside the emitter. The ray goes through the locked point
  toward the current wall/reclaimed obstruction or maximum projectile travel;
  it must not falsely imply the projectile stops at its aim point. It is a current
  geometry cue, not a guarantee after a future capture. Bound work to the board
  size; no scene-wide searches per actor or unbounded sampling.
- Live shot: solid high-contrast diamond with short direction tail and an accurate
  centre. Minimum visible core4CSS pixels, surrounding plate distinguishes it
  from the trail/background. Frozen shots remain visible with a pause mark.
  Critical cues are visible in muted audio, monochrome and reduced effects.
- Removal: event-position four-pixel spark for at most0.25 simulation seconds,
  then an inert compact scrap mark. Contact and capture share the same final
  state but may use a different brief shape. Maximum24 marks, drawn below hazards,
  active trail and craft; no particles that hide danger, score/life reward or
  collision effect. Reduced effects skips the spark. A cosmetic `showScrap:false`
  hides only inert marks, never live actors, warnings or shots.
- Scrap remains on the current board and can be shown over the victory picture;
  replay/gallery artwork itself and recorded coverage are not modified. A new
  attempt removes old scrap by creating a new run, not by clearing saved records.

Keep functions split into projection, underlay scrap, warning cues and live
bodies/shots so C2 can place them around the existing trail/craft layers. C1 does
not change the BoardPainter or pretend that its review sheet is gameplay.

## C1 visual review and tests

Add a static local sheet analogous to journey-actor-review, clearly labelled
unpublished presentation study. Show scout/sentry walk/locked/recovery, projectile,
contact/capture scrap and an ordinary keeper reference at16/24/32px on ink/paper/
grey surfaces, normal/reduced effects. Use constructed presentation specimens,
not fake run victories. No autoplay sound, storage, project Apply or live combat.

Automated tests cover exact owned projection; absent/disabled no-op; accessor/
malformed rejection; supported schema pairs; warning deadline/freeze/pause;
projectile ray beyond aim and boundary clipping; no writes/RNG/identity changes;
state restoration; bounded canvas calls, finite coordinates, minimum sizes,
distinct silhouettes, line styles and retained cues under reduced/monochrome
settings. Run historical actor/classic/foundation/lane/pressure and D2a/D2b
regressions on Node20/22. Independent code review. Native sheet observation, when
available, is a small-size rendering check, not human recognition or game balance.

## C2 constraints reserved for the next host integration

Persist a release-independent preference, session-only fallback/retry/export on
storage failure; corrupt/future values must not be overwritten. Default preserve
the authored mission setting. Only explicitly opted-in missions have a combat
toggle. Choosing on/off during play is pending until deliberate Restart or the
next mission; never silently mutate a live/suspended run or its receipt identity.
Keep Solo/Versus choices explicit and paired boards identical. Historical missions
without the descriptor are unchanged. Cosmetic scrap/reduced-effects choices
cannot change simulation, score, clear or replay identity.

Detailed restart/Continue/Next, imported preview versus owned Journey, replay/save
and completion-receipt behavior must be specified against the accepted host before
C2 implementation. Tests must include failed load/save and cancelled restart.
Captions should explain body-only shots and removable versus retaining actors;
audio is supplementary and respects mute. No mandatory dialogue or new menu gate.
Team remains rejected until D2d; no inferred Team ownership or shared shot damage.

## Acceptance boundary

C1 is complete only with reviewed modules/tests and truthful visual evidence.
D2c remains incomplete until C2 real-host/native/control/accessibility checks.
The three greyboxes retain their documented short-clear and bypass concerns;
visual polish cannot substitute for pacing, human counterplay understanding,
original picture composition, content cuts or exact-source public deployment.

The executing-plans skill's writing-plans helper is unavailable; the C1 sequence
above is the explicit bounded implementation fallback after specification review.
