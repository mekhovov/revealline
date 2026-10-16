# Team cue overflow — source implementation, 29 September 2026

Parent: `f067823fe8e2f76d061bd45d17b11787fe376a23`, PR757. Production review
is explicitly deferred by the user; no approval, version, merge or release is
created by this source batch.

## Behavior

When the real bounded compact-canvas planner reports unplaced cues, the host
adds a Field details action outside the complete board. It stays available for
the attempt, including when later phases/reflow fit again. This avoids hiding a
focused action or oscillating the available board space. One activation pauses
and enters the existing Help reader; Back returns to the action while paused.
Resume remains explicit. The reader retains every player, active enemy and core
with stable identity and the current phase, lock, slowdown and anchor state.

The list is not a live region. A separate once-per-attempt status does not
replace loss/rescue messages. New attempts, terminal outcomes and setup clear
old content. No core rule, collision, clock, picture or approval changes.

## Correctness evidence

- `initial-focused.tap`: 55/55 passing before the focus-latching refinement.
- `focused.tap`: final 55/55, with the latch, resize inside the open reader,
  exact list/focus/paused-state retention, fresh controller Confirm, critical
  message preservation and dense import handling. These overlap the adjacent
  host cohort and must not be summed as independent coverage.
- `adjacent-hosts.tap`: complete existing renderer/host cohort plus the two new
  overflow files. The terminal TAP summary is the authoritative count.
- Scoped ESLint, formatting and native syntax pass. Independent read-only
  review found no blocking defect and requested the open-reader resize check,
  which is now included.

## Bounded native-browser observation

Local source route: `http://127.0.0.1:52261/game/couch/relay-rescue.html?journey=legacy`.
The ordinary import picker loaded a schema-valid test arena with 16 hunters and
8 relay cores; it is a fixture, not a new campaign. Start, Pause, shared Settings,
Show both players, Direction pad and explicit Resume used ordinary UI actions.

At **568×320 CSS**, Plain/Large text, the board remained **212×106**;
Field details was **212×47.59375**. Direction buttons remained **44×44**;
Boost/Support were **76×44**. All were inside the viewport. Enter on Field
details opened the existing focused reader in one activation, containing all
**26** entries. Rotation to **390×844** retained `coop-help-reading` focus and
all exact rows; Escape returned to `coop-field-details` while paused. After
explicit Resume, the board was **370×185**, details **382×47.59375**, directions
**52×52** and actions **76×44**. Automated host evidence checks the frozen clock;
the native DOM record checks list/focus and does not expose a simulation clock.

The two screenshots and `rotation-reader.json` preserve those observations.
Dense canvas labels can still overlap in the explicit visible fallback; the
complete paused reader is the implemented recovery, not an assertion that 26
plates fit inside a 212-pixel board. No physical controller/touch, full mission,
production artwork, 200% zoom, performance, offline or public acceptance is
claimed. Extended production/device review remains deferred.
