# Library launch navigation

Status: isolated follow-up correction; not released or publicly accepted.

Selecting an installed chapter or generated challenge from **Settings → Game data
→ Library** must dismiss both Library and Settings after the selection succeeds.
The ready mission receives focus on Start. Loading a suspended or imported flight
uses the same return path and keeps its verified cut paused until explicit Resume.
No selection or menu dismissal supplies a direction or starts simulation.

`focusMission` owns this successful transition in the Solo host. It closes the
retained Settings, Workshop and Home menus before focusing the mission. Individual
Library operations continue to own their current-operation checks, child dialogs,
replacement confirmation and error handling. Do not replace this with a generic
close-all-dialogs operation: an unrelated or newer dialog must retain its ownership.

Passive Back/Escape returns to the parent Settings action. Stay, failed preparation,
lost focus, cancelled work and stale callbacks keep their existing return behavior.
Opening Settings may refresh a paused save; Back must not change that saved attempt.

This follows the [W3C modal-dialog focus guidance](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/):
return focus to the invoking control on ordinary dismissal, or to the next logical
workflow step when the completed action leads there. Content behind an open modal
cannot serve as a usable Start target.

## Verification

`game/test/library-launch-host.test.mjs` exercises the actual Solo entry with a
modeled browser boundary and modal focus restrictions. Coverage includes:

- Ready installed/challenge selection from Settings, with tick zero and no Resume.
- Active-cut Stay and explicit Replace from Settings and Workshop.
- Suspended and imported saved cuts restored from either parent, with exact checkpoints.
- Passive Back to Settings with the paused cut and saved bytes preserved.
- Existing stale, hidden, departed, failed-selection and same-selection cases.

The added ready-selection cases fail against the original source because Settings
remains open. The complete focused suite passes 29/29 on Node 20.19.5 and Node 22.22.2.
The isolated native-browser keyboard journey also passed: Settings → Installed
chapters → Install Night Shift → Play reached the visible Midnight Channel briefing
with Start focused. The mission remained ready until explicit Start; Escape then
paused normally. Passive Library Back restored focus to Installed chapters in Settings.
No console errors or warnings were observed.

The second keyboard-only native journey verified suspended-flight restoration,
challenge Stay and explicit Replace, then restoration of the retained prior mission.
Stay kept Settings and Library open and returned focus to the challenge launcher.
Replace reached the ready challenge with Start focused; loading the earlier flight
again reached Pause with Resume focused and the same visible time/lives/score.
The challenge was never started. These observations do not prove exact native save
bytes; checkpoint identity remains covered by the modeled tests.

A third native journey imported the generated teaching pack through the file chooser,
launched First bridge from Settings/Library, and completed it using direction taps.
The win recorded 32.2% coverage, 7,590 points and three retained lives. Its procedural
picture opened from Collection, replayed its celebration, and remained available with
the same visible score after reload. This checks pack import and reward persistence,
not imported saved-flight restoration or a production difficulty target.

[Scoped evidence](verification/library-launch-navigation/result.json) records the
base source, exact app override, negative control and results. Native checks cover
installed and generated selection, Stay, Back, suspended-flight restoration and an
actual imported live-cut file. Its before/after exports differ only in `savedAt`: the
replay, tick 1106, checkpoint `33c95cb606aebb9d`, identity and leftward continuation
are unchanged. Explicit Resume completes that cut without another direction input
and stops at closure. A further native Grid + buffer export/import/export preserved an off-center upward
position and queued down turn at tick 1677, checkpoint `0539571e4f07eee2`. Only
`savedAt` changed. Explicit Resume without a direction command advanced four ticks,
consumed the queued turn and moved down; the exported replay verifies exactly. This
Grid sample is on secured ground, not an active cut. Queued Grid live-cut combinations
and stale callbacks retain modeled host evidence. This is not touch, screen-reader,
physical-controller, integrated-build or public-release acceptance. Repeat affected
journeys against the final integrated build before release, including Stay and restore.

## Maintenance prompt

“Update a Library launch or restore path without bypassing its ownership checks.
Exercise Settings and Workshop parents, both ready and active-cut states. Successful
selection should reach the visible paused mission; Back and failed/stale work should
retain their parent and focus. Keep the saved checkpoint, queued direction and explicit
Resume contract. Record modeled and native verification separately.”
