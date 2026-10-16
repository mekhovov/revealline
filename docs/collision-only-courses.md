# Collision-only keeper courses

Status: v0.91.0 source candidate, implemented and locally verified; not released. Supersedes gp3's ordinary mid-flight steering for new attempts only. Base is merged v0.90 source `c585bcd3220438da971e2927763b966f55ee8235`; its frozen publication remains untouched. Sole publisher reserved v0.91 after v0.90 public acceptance.

## User requirement and evidence

Ordinary field enemies must hold a straight, readable course through open space. The player must be able to commit to a cut based on that course. Avoid restoring permanently horizontal, vertical, or same-angle repeating billiards.

- [X11 Xonix maintainer source](https://github.com/dl8dtl/xonix/blob/349841245936e3474a62097f201e67c9d3289962/xonix.c#L1265-L1410), `NewFlyerPosition`, changes flyer direction in collision checks. This is a historical reimplementation, not proof of every Xonix variant's algorithm. Its initial equal component magnitudes mean diagonal travel, not changing bounce angles.
- [Preserved Xonix32 C++ movement](https://github.com/PraveenAnandhanathan/xonix32/blob/ea1331c6f2daa66b916da9d5384dc2e5356b90e0/src/Objects.cpp#L78-L141) likewise sign-reflects at domain/screen boundaries. [Initialization](https://github.com/PraveenAnandhanathan/xonix32/blob/ea1331c6f2daa66b916da9d5384dc2e5356b90e0/src/Game.cpp#L172-L290) randomizes starting vectors, not each ordinary movement tick. This is third-party preservation of the original distribution, not an author-hosted repository or the 1984 DOS original. No implementation code is copied.
- [X11 manual](https://manpages.debian.org/testing/xonix/xonix.6x.en.html) separates field flyers from filled-ground eaters and retains regions occupied by flyers.
- [AirXonix developer rules](https://www.axysoft.com/airxonix/) distinguish field balls, filled-ground mines, and vulnerable unfinished trails; they do not specify a reflection algorithm.
- [Xposed Reloaded publisher listing](https://store.playstation.com/en-us/concept/10002881/) identifies the Xonix inspiration but does not document turning angles. Supplied still screenshots cannot establish a time-dependent movement law. No exact Xposed algorithm equivalence is claimed.

## Decision

Pure mirror reflection preserves timing fairness but brings back repeating axes. Timed/random steering breaks the open-flight prediction the user requests. Adopt straight flight with a small collision-only anti-loop variation, explicitly our rule rather than an attributed historical rule.

`field-course.v2` keeps velocity constant between physical wall/committed-ground impacts. At an actual axis-face reflection, adjust incidence by at most eight degrees from the mirror result, away from the surface and preserving the tangential direction. Keep incidence between eight and eighty-two degrees to avoid axis lock and grazing. The adjustment is a pure function of seed, actor ID, and collision position; no player sensing, elapsed-time steering, ambient randomness, or hidden mutable counter. At simultaneous corners, allow variation only when both reflected velocity components already depart all contacted faces; keep both signs. This closes the exact-45-degree corner loop found in focused tests. Ambiguous/opposed/curved Team corner contacts retain their physical reflection. Speed magnitude is preserved. Special warning/committed attacks and illegal-domain repair do not receive anti-loop adjustment. Patrols, stationary keepers, capture, speed presets and bonus effects are unchanged. Legitimate player-created traps stay trapped: no domain crossing, teleport or capture exemption.

Speculative movement plans own any rebound changes; only a committed collision publishes them. Partial legacy movement commits need exact planned velocity, not the old sign-only reconstruction. Team uses its existing swept contact normals and only varies unambiguous axis faces. Frozen/stunned actors never accrue a turn debt.

`gameplay-pressure.v4` / `gp4` opts new attempts into this contract. Freeze the exact gp3 adapter in `gameplay-tuning-v3.mjs`; preserve gp1/gp2/gp3 recipes, core steering and replay checkpoints. Do not alter an active historical attempt. New starts/Next use gp4; exact historical resume remains historical. Menu copy explains collision-only motion, while historical recipes retain their own descriptions. No preference/media/progress deletion.

## Implementation and bounded acceptance

1. Capture released gp3 replay checkpoints; freeze its adapter. Add versioned collision helper and schema admission.
2. Integrate only at actual collision planning/commit points in legacy Solo, Classic/Journey Solo/Versus and Team. Preserve partial-plan correctness.
3. Adopt gp4 and update effective menu policy recognition. Keep difficulty/admin controls.
4. Focused checks: open-flight velocity invariance; speed and outgoing-domain validity; horizontal/vertical/diagonal route variation; corner and one-cell corridors; speculative/partial commit; freeze/stun; equal seeded Versus/Team; historical gp1/2/3 checkpoints and replay reconstruction.
5. Scoped lint/format/source validation plus mandatory hosted production build and release provenance. Long unrelated suites waived, not passed. Publish via the existing sole publisher after the frozen v0.90 release, then bounded public availability/motion checks. No human/all-level qualification claim.

## Completed locally

- gp4 defaults and version declarations; collision-only courses across legacy Solo, Classic/Journey Solo and Versus, and Team.
- Exact unscaled partial-plan velocity, safe corner refinement, preserved special attack warnings, difficulty/admin menu continuity.
- Independently reviewed design and source implementation. Exact committed-head review remains a delivery gate.
- One coherent focused cohort: **52 passed, zero failed/skipped, 21.3 seconds**:

```sh
node --test game/test/collision-course.test.mjs game/test/field-course.test.mjs \
  game/test/gameplay-pressure-host.test.mjs game/test/couch-gameplay-pressure-host.test.mjs \
  game/test/xposed-motion.test.mjs game/test/gameplay-pressure-completion-host.test.mjs
```

- Scoped ESLint, Prettier and diff checks passed. gp1/gp2 adapters remain byte-identical. Frozen gp3 adapter git blob: `82f990cbbaba7d13757d1d7b2f59ae2d4e67f233`. Released-source 720-tick gp3 checkpoint goldens: legacy `7f47dcaf568116d3`, Classic `a5a0c57c17816f6a`; current core reproduces both and their replays.
- The cohort includes menu/admin, save reconstruction, completion eligibility, all compiled edition validation at bounded overrides, and retained Classic validation. This is not all-level playability or human enjoyment evidence.

Development failures are retained as limits, not relabelled passes: the first new fixture had two wrong imports; initial sparse checkout lacked pack/artwork fixtures (20/24 affected-host checks passed); the first anti-loop design left the diagonal corner loop unchanged; an added warning fixture omitted its runtime `classic` object (51/52 passed). Imports/fixtures and corner implementation were corrected before the final coherent 52/52 run. No production assets were edited to fix tests.

## Remaining delivery gates

1. Exact committed-source review and PR mandatory hosted validation/lint/format/production build.
2. v0.90 public acceptance and sole-publisher handoff, merged-source qualification.
3. Authentic immutable v0.91 release, preserved archive, Pages selector and public availability.
4. Bounded public checks on a fresh gp4 attempt. An exact historical gp3 Resume intentionally retains its recorded rules and is not the acceptance specimen.

Long unrelated suites are explicitly waived/skipped, never called passed. No broad local build/archive copy was made on the nearly-full disk. Risk is medium: collision planning changes, mitigated by descriptor gating and historical goldens. No dependencies, migrations, content removal or preference reset. No Jira/Jenkins steps apply to this repository. The PR-creation workflow is used for problem/solution/risk/evidence discipline, not its unrelated corporate integration conventions.

Human balance across the entire campaign, physical devices, accessibility and extended offline qualification remain separate. Merged or built is not publicly delivered.
