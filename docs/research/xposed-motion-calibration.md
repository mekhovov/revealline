# Xposed Reloaded movement observations — 23 September 2026

Source candidate on `codex/xposed-motion-defaults`; not a released or human-balanced change. v0.86.0 source c311e91b remains frozen.

## Method and limits

Observed the rendered game in two independent gameplay recordings, paused and
frame-stepped through the visible YouTube player. Playback speed Normal was
verified. First recording additionally exposed paused=true/playbackRate=1 and
exact currentTime through the rendered video element. Thirty single-frame
steps advanced that recording by 0.99999 seconds. Positions below are approximate
visual sprite centres, not game-source constants. Allow roughly 3–5% uncertainty.
Normalize travel by the shorter original field dimension, not the video size,
remaining unclaimed region, or viewport. No footage/artwork is copied into game
assets. Original screenshots establish layout/counts, not movement timing.

No claim of exhaustive pack coverage, exact collision radii, input latency,
all actor types, temporary powerup timing, or human balance validation.

## Recording A

https://www.youtube.com/watch?v=SKKvpZ2DvUY
“Xposed Reloaded PS4 Settings & Gameplay LPOS”, Lord Parker.

Level 1: original field approximately (66,137)–(846,527), 780×390 pixels.

| Video seconds | Craft centre/path                 | Moving orb centre                   |
| ------------- | --------------------------------- | ----------------------------------- |
| 112.64840     | (460,480), upward cut from bottom | (806,287)                           |
| 113.64839     | (529,447), via corner (460,447)   | (788,414)                           |
| 114.64838     | (631,447), straight right         | (770,508), boundary bounce interval |
| 115.64837     | (706,421), via corner (706,447)   | (753,386)                           |

Craft path lengths about 102,102,101 pixels per second: .259–.262 short-field/s.
Orb clean first interval about128px/s (.329); post-bounce interval about123px/s
(.316). Approximate ordinary orb/craft speed ratio 1.2–1.3, centred near1.25.
One field enemy in opening level. No visible pickup collection in this interval.
Craft makes sharp right-angle changes; there is no visible turning arc.

Level 2,165.81050→166.81049 seconds, same field bounds:

- Four moving field actors, split two per half by a reclaimed centre lane.
- Two unobstructed orb tracks: (287,278)→(251,155), ~128px;
  (793,260)→(688,188), ~127px. Roughly .325–.329 short-field/s.
- Cyan boundary actor (604,526)→(511,526), ~93px/s, .238 short-field/s.
- Other tracks bounce and are not used as straight-displacement speed estimates.

Level 3 at232.13470s matches supplied pack-1_level-3.png: central cross and four
islands with four outer-edge patrols, four island patrols and four central-cross
patrols visible. No ordinary field orb visible at this starting frame. This is
domain/geometry variety, not a rule that every later level needs more field orbs.

## Recording B

https://www.youtube.com/watch?v=BFOOn4NeIRc
“XPOSED Reloaded- Pack 6: Level 5 (3 Stars)”, Lentarian.

Normal playback verified in visible Settings menu. Read-only video-element
inspection timed out after navigation; use player clock9→10sec and game
clock2:58→2:57, with30frame-step actions. Confidence lower than exact-clockA.
Original field approximately (42,125)–(871,543), short side~418px (visual bound
uncertainty~4px). Dense slow/lethal geometry; four field actors and one cyan
boundary actor visible before any capture.

- Orb track (289,311)→(419,348),~135px per second, .323short-field/s.
- Orb track (275,360)→(406,323),~136px per second, .326short-field/s.
- Cyan boundary track around corner (42,176)→(42,125)→(90,125),~99px,
  .237short-field/s.
- Stationary/intermittent craft interval is not used for craft-speed estimation.

Late-pack measurements corroborate roughly stable basic orb/patrol rates;
stronger geometry and combinations supply difficulty. They do not prove every
Reloaded enemy or level has the same speed.

## Reveal Line comparison

Read-only audit of exact80ed1c4cc, relevant source identical to mergedc311e91b.
All91Journey Solo boards72×36; shorter playable dimension34cells.
Unboosted ordinary Standard craft11.5cells/s=.338short-field/s; core bouncer
5.376cells/s=.158; enemy/craft=.467. Optional ornament bouncers7.168=.211.
Even Expert core bouncer8.4cells/s trails craft11.5 (.730ratio).

Standard core keeper counts: First return1→2,Two keepers2→3,Sorting yard4→6,
Spiral stores3→5,Home signal2→3. Extra counts do not correct the speed hierarchy.

## Implemented bounded successor

- Standard starting targets: craft .26,ordinary field keeper .325,boundary patrol
  .24 original-short-field/s. At short34:8.84,11.05,8.16cells/s respectively.
- Preserve authored Standard counts, particularly the one-enemy teaching level;
  no universal density quota. Optional difficulty/admin changes remain explicit.
- Do not apply orb-speed correction indiscriminately to projectiles, shooters,
  erosion, stationary hazards or warning windows; those roles lack measurements.
- Keep main-menu difficulty and browser-global admin controls. Normalized rates
  need honest UI units, not old authored-speed multipliers presented as exact.
- New versioned pressure recipe/revision; preserve gp1 reconstruction bit-for-bit
  for historical saves/replays. Focused golden identity, restore, equal Versus,
  Team validation and actual capture-route checks before later PR promotion.
- No edits to frozenv86; next source/version promotion follows its acceptance.

## Source verification and release boundary

- Shared v1+v2 cohort:26tests passed, including819Solo,108Team and192Classic
  preset/override variants for each adapter; every tuned geometry validates.
- v1 implementation Gitblob remains exactly17af134756974c6482a416d9235d7d1a06316719.
  Fixed golden gp1 identities reconstruct through current public dispatch.
- v2 deterministic replay executes actual input ticks; paired Versus boards agree.
  Fast extra keepers keep speed-aware spawn clearance; stationary actors and lane
  warning/active windows remain unchanged. Standard does not add keeper anchors.
- Actual Solo host Start→Save→Resume→capture→clear→Next and admin no-award
  checks passed. Menu difficulty, settings Apply/Reset and historical/current
  save forgery checks passed in focused host fixtures, not native-device proof.
- Final menu/save host cohort:8/8 passed, including whole-spatial Standard/Expert
  views that exclude misleading inherited40%/75% enemy-speed descriptions.
  Historical catalog descriptions remain unchanged for historical views.
- Independent read-only adapter review found no blocker; it did not rerun
  tests or qualify native playability. No full automated suite was run.
- Initial new replay test called the recorder with a run instead of a level and
  failed; corrected fixture uses the public API and asserts nonzero recorded ticks.
  No runtime bypass was introduced to make the fixture pass.
- Preference storage stays on its unchanged v1 format/key, preserving existing
  overrides and rollback reads. Recipe versioning, not storage deletion, selects
  historical movement. Current new-attempt recipes use gp2.
- The numeric matches are approximation targets from observed recordings. Exact
  internal Xposed constants, all actor classes, collision tolerance and latency
  remain unknown. Contour patrols inherit the measured boundary-role target as a
  design adaptation, not a separately measured Xposed contour speed.
- Release version, fresh main integration, mandatory hosted validation/build,
  frozen/public checks and human balance review remain pending. Do not label
  this deployed, perfectly matched or fully validated.
