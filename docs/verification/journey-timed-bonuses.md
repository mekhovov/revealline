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

Native exact-source Studio and play observations; controller/touch/small-screen
countdown readability; human optional-route/reward balance; bonus-taking route
qualification across seeds; timed Team ownership/schema design; integrated
pressure-catalogue balance; reviewed release-owner PR/version/Pages deployment.
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
No core timing or candidate placement changed in that follow-up. Final native
follow-up, Team and release gates remain pending.
