# Timed optional bonuses — slice B evidence

Status: implemented local candidate, not published or human-balanced. This is an
explicit successor capability; no historical mission or public pin is replaced.
The detailed design in `../superpowers/specs/2026-09-21-timed-bonus-design.md`
received the required independent specification review with no blocking findings.

## Implemented

- Strict self-versioned schedules shared by runtime, compiler, Studio and preview.
  Four existing contact effects; finite appearance/collection caps; bounded authored
  anchors; no scripts or objective dependencies.
- Deterministic announcement, availability, expiry and seeded relocation. Expires
  before contact on the expiry tick. Reclamation alone does not collect. Geometric
  eligibility excludes blocked/lethal/reclaimed/occupied/live-trail anchors and
  requires a bounded path; it does not promise safety against moving enemies.
- Recovery freezes the schedule clock without refunding grants. Pausing stops
  simulation. Enemy freeze does not stop pickup time. Replay and suspension retain
  exact clocks, grants and future anchor selection.
- Hollow announcement, semantic icon, countdown ring and seconds; cues remain with
  reduced effects. Terminal full-picture views suppress timed overlays.
- Studio add/replace/remove, seconds/ticks, anchors, stale-edit rejection, undo via
  shared draft history and explicit validated apply. Map overlay labels possible
  anchors; inspection never publishes. Team imports reject unsupported schedules.
- An explicit seven-mission Border study modifies only three existing missions:
  Behind the Patrol (slow), Second Landing (life), Long Rail (freeze). It reuses
  their maps/art, so it is not seven or three newly authored levels. Current study
  timings: 5s initial delay, 1s announcement, 10s availability, 12s cooldown, three
  appearances and one collection. It retains V1 difficulty to isolate this change.

## Automated evidence — 2026-09-21

The 149-test combined cohort passed on Node 20.19.5 and 22.22.2 using the sparse
read-only fixture adapter. Coverage includes engine, timed authoring/view, real Solo
host pause/resume, Border routes/races, classic core/presentation/transport,
foundation transport, existing bonuses, flight information and Studio hosts.

The route cohort tests three missions × three presets × two steering policies ×
fixed pickups present/absent: **36 no-loss Solo clears with exported replay match**,
and **36 equal paired-board complete races**. Every route sees a live timed pickup
and misses every timed bonus. The no-fixed half therefore completes without any
bonus at all. This proves optionality at seed 1, not human balance or all-seed
solvability. Existing pinned routes were reused; no final-state injection.

An early Long Rail anchor intersected an existing return route: collecting freeze
changed patrol timing and invalidated that route. The final anchor is an explicit
off-route detour at (52.5, 26.5); the complete cohort passes after that adjustment.
This does not prove that every bonus-taking route is safe—timing remains a choice.

The older transport suite incorrectly called registered relay replay V8 unsupported.
Its unregistered-format check now uses `xonix-replay.unregistered`; all existing
exact tuple, mismatch and ownership assertions remain intact. This stale assertion
existed before timed bonuses; no supported transport was removed.

Separate engine checks cover all four effects and activation/expiry bounds, life
cap nine, finite grants, occupied/unreachable anchors, announcement cancellation,
expiry/contact ties, enclosure without collection, recovery, terminal state,
independent boards, replay and restoration. Some edge-boundary unit tests arrange
state explicitly; they are not represented as played routes. ESLint and diff checks
pass for this slice.

## Still required

Controller/touch/small-screen
countdown readability; human optional-route/reward balance; broader seed/opportunity
sampling beyond the bounded cases below; timed Team ownership/schema design;
integrated pressure-catalogue balance; reviewed release-owner PR/version/Pages deployment.
No claim of Reloaded's exact timings, final accessibility approval, whole-plan
completion or proof that these mechanics improve enjoyment.

## Native observation and follow-up

Exact source `ffb198fc`, read-only local server port8815, native in-app browser:
loaded the explicit Border study, applied it to an isolated local draft, changed
availability10s→8s through the schedule form, and restored10s with Undo. Exact
Solo preview loaded the original picture and timed descriptor. Observed a hollow
`+1s` announcement followed by a solid icon, shrinking ring and `4s` label, with
no opening dialog or forced movement. This is desktop observation, not a physical
device/accessibility or human enjoyment signoff.

The paused information panel exposed a real integration omission: known schedule
events were classified as unknown field effects. The follow-up registers the four
events as ordinary and adds a regression for upcoming/available descriptions and
unknown-event fallback. The resulting **150-test cohort passes on Node20 and22**.
No core timing or candidate placement changed in that follow-up.

Final native follow-up at `00b500d3` (contains `49127b9a`), port8816: loaded the
explicit study and started Behind the patrol Expert preview. Paused at24seconds
after the first appearance/expiry, opened Field details and confirmed that the
unknown-effects warning is absent. No warning/error console entries were observed.
Team, physical-device/human and release gates remain pending.

## Taking-route follow-up — authored V1 and explicit pressure V2

The committed `timed-taking-routes.json` fixture and public-input tests now cover
**54 ordinary cases per edition**: three missions × three presets × two steering
policies × three mission-specific seeds. Behind uses1/3/10, Second1/2/6 and
Long1/2/3. Each route contacts exactly one timed item, activates its effect or gains
a life, and clears without losing any lives. A collected life cannot conceal a
failure. Fixed pickups remain present; the earlier all-missed/no-fixed study is
the separate optionality evidence, not a result inferred from these taking routes.

The pressure study uses `withPressureDifficulty(createTimedBorderCandidates())`;
it does not edit maps, anchors, timing, effect strength or player handling. Neither
edition is silently enrolled. All cases are replayed from fresh runs using public
directions, verified through exported replays, and repeated in real paired-board
Versus races with equal final authoritative checkpoints and independent schedules.
Post-contact suspension/restoration is checked for each of the three bonus kinds
in both editions, continuing the same remaining inputs to the pinned clear.

Directly applying the54 old input paths to pressure V2 gives14 no-loss clears,
28 first losses and12 incomplete paths. All54 collect before that outcome. A
regression preserves this distinction: old inputs are not pressure qualification.
Fresh cross-preset path trials and bounded continuation searches from undamaged
post-collection closures produced the complete new54-case matrix. Long search
used82.025s; Behind/Second62.990s. These are offline omniscient feasibility searches,
not human attempts, autonomous gameplay or measured player completion times.

| Mission | Authored V1 clear seconds | Pressure V2 clear seconds | Pressure stationary seconds |
|---|---:|---:|---:|
| Behind the Patrol |18.05–25.25|18.30–31.45|6–8|
| Second Landing |17.35–24.55|18.25–36.40|6–15.25|
| Long Rail |19.80–45.08|19.80–41.00|5.05–13.05|

Stationary time is measured from unchanged craft positions, not inferred from null
inputs (continuous steering can still move). Most optimized routes fall below the
plan's45–150second ordinary target. Bonus waiting is not useful challenge by itself.
These results keep short-clear geometry, tempting-route value, warning readability
and human pacing review open; faster enemies alone do not settle those questions.

Three seeds do not guarantee three different positions: Second's ordinary paths
collect only two anchors. Additional far-anchor routes collect(58.5,18.5) and
clear in23.45s(V1) /28.15s(V2). Separate missed-window probes let the first item
expire, collect the second appearance at a different anchor, and clear in49.05s(V1)
/56.10s(V2), including30s/33.75s stationary time. They verify relocation, not
desirable pacing. The pressure version required departing30ticks earlier; simply
reusing the old departure lost a life before closure. Each edition now covers all
nine authored anchors. These four additional probes are labelled separately and
never inflate the ordinary matrix or imply every seed/anchor pairing is safe.

Final verification: **348/348 tests pass on Node20.19.5 and22.22.2**, including
235 taking-route tests (112 collection/clear/replays,112 real paired races, six
post-contact saves and five matrix/anchor/transfer checks). The other113 tests
cover schedules, authoring/host, all-missed routes, existing bonuses, core,
presentation and versioned/foundation transport. ESLint, Prettier and diff checks
pass. Sparse-checkout runs use the existing read-only `.cache/read-source-git.mjs`
fixture adapter; the new route fixture is committed, not an ignored cache input.
Independent review approved the final112-row snapshot, separately reran all235
taking tests, and reproduced the late pressure-departure failure at tick4205.

Direct reproduction from a complete checkout:
`node --test game/test/timed-taking-routes.test.mjs`.

No runtime, candidate, shared host, published manifest or Pages deployment changes
are made by this evidence follow-up. Team and human/device acceptance remain open.
