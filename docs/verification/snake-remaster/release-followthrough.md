# Snake release and alternate-look follow-through — 14 October 2026

This batch starts from main `4c8c762bd56ffef6b7f3720d61a39978d4c66361`,
after rebasing the clean task branch. PR #1208 is merged. Real-device testing
remains deferred; the previous player-feedback deferral remains in place.

## Completed corrections

- Main pause/outcome announcements, result grades and session-only saving notices
  now change their text only when the message changes. Grade accessible names
  follow the same rule. Real transitions, resume, retry and localized content
  remain current. This extends the earlier reception-status fix to the other
  audited live regions; it is not an actual screen-reader listening study.
- Night Arcade shelter, receiver and dispatch roofs now use dark metal rather
  than filling large structures with luminous cyan or pink. Existing illuminated
  fittings, connected facades and collision outlines remain. This fixes a visual
  hierarchy problem found in the Alpine comparison: solid scenery competed with
  the small enemies and objective markers. Other looks and creator-owned artwork
  retain their existing rendering paths.
- The cosmetic world revision is v7 and the structure revision is v2. The world
  descriptor reads the exported structure revision instead of duplicating a
  string. Terrain invalidation therefore describes the actual artwork. Recipes,
  collision geometry, gameplay randomness, grading and cache allocations do not
  change.

## Browser observations

Inspected the first six boards of each of these chapters in both Atmospheric
Ruins and Night Arcade: Loaded Routes, Switchyard Pursuit, Cable Foundry,
Extraction Circuit, Signal Smugglers and Living Citadels. This is **72 starting
board/look presentations**, covering all six worlds at the gallery's
320px-screen-equivalent setting. Cable Foundry Ruins and Living Citadels Night
also received grayscale/collision-outline checks. The revised Alpine Night
boards were rechecked in color and at a true 320×568 desktop viewport with
grayscale/collision outlines; document width remained exactly 320 pixels.

The six representative state fixtures were inspected in both looks as well:
open, dense, wrapping, active jammer, shutter and Team. The jammer fixture retains
the readable head neighborhood while concealing enemies. These are renderings
of accepted fixture states, not new full mission playthroughs. The remaining
two missions of each eight-mission chapter and every evolving cable state are
not claimed separately inspected here.

Evidence: `release-night-alpine.png`, `release-night-320.png`. The darker roof
retains the same occupied outline, facade and equipment cues. No additional
geometry/readability defect was identified in this bounded pass. That does not
establish player recognition, enjoyment or physical-display quality.

## Earlier fixes are published

The public deployment identified source
`2abfd20bdee39369b3480ed3013074a8dfac3006`, which contains PR #1208.
Build/deploy/verify run
[38574210223](https://github.com/mekhovov/revealline/actions/runs/38574210223)
succeeded. The delivered `game/snake/classic-app.mjs` and `game/ui/audio.mjs`
were compared to that exact Git source using JavaScript token sequences (the
published modules have whitespace compaction). Both match. The deployment
identity was unchanged before and after the observation. Exact HTTP hashes are
retained in `release-published-observation.json`.

A normal published Signal Check entry opened gameplay directly. After an
ordinary wall defeat, Pause stopped automatic progression and left usable
results with the final-eight preview and focused Retry. Retry launched directly
at time zero; ordinary Pause then exposed the shared menu. See
`release-published-results.png`. Hardware Menu-button behavior and audible
jammed-catch suppression remain covered by source equivalence and automated
tests, not falsely described as a physical controller/listening session.

This published observation covers the previous merged fixes. The new status
and roof corrections in this batch require their own merge/deployment and are
not represented by that older public revision.

## Validation and remaining boundaries

- 113/113 full Snake host tests, including four new English/Ukrainian live-status
  regressions. Unchanged-message failures were reproduced before correction.
- 44/44 focused art, worlds, terrain-cache and interference tests. After the
  descriptor consistency correction, all 20 affected art/world/cache tests
  passed again; those 20 overlap the 44 and are not an additional coverage count.
- 7/7 optional-practice and 4/4 optional-distribution tests.
- Targeted source lint, formatting, whitespace and canonical shared play-shell
  checks pass. No shared generated runtime needs editing.
- The repository-wide localization recheck completed successfully: English and
  Ukrainian, 13,029 messages and 9,026 references. Its result arrived while a stop
  request was being sent after approximately eight minutes; the collected output
  confirms validation completed. This supersedes the provisional incomplete-check
  note. This batch changes no translation keys or message copy.
- Independent review identified the duplicated structure revision, now corrected;
  it found no other blocker in the creator-art, cache or localized-state paths.

No new full distribution build is claimed for these changes. The previous full
3,277-file build remains attributed to its exact source in
`interaction-validation.json`; publication verification above is separate evidence.

Physical-device qualification remains deferred. Player comparison remains
deferred rather than being replaced with invented observations. The 375 existing
higher-star setups and 1,065 completion-only setups stay unchanged: the prior
calibration assessment found insufficient independent strategy/execution evidence
for new thresholds. Additional grades remain optional, not unfinished campaign
content. No new music layer, hint system, mission or gameplay mechanism is needed
to close the concrete issues found in this follow-through.
