# Recorded native journey

## Source and setup

The local page was `http://127.0.0.1:58352/game/couch/relay-rescue.html`, served
from exact `fc847b18817e1cebb1439b3391e1f3d8aa7361fd` plus the single combined
host override pinned in [pins.json](pins.json). The source implementation packet
is `.cache/p08-team-terminal-combined-fc847-r1/`; this documentation adds no runtime
changes and does not independently qualify that packet's automated tests.

The coordinator used the ordinary pack-import control with
`.cache/p08-team-terminal-hud-fc847-r1/candidate/game/test/fixtures/team-terminal-hud-qa.json`
and selected Expert difficulty with Full teamwork policy. The imported pack is
`qa-team-terminal-hud`, revision 1. It contains two explicitly labelled QA arenas
with the existing 72×36 geometry. No terminal status or result was assigned through
browser scripting.

## Active recovery, terminal loss and direct Retry

1. Start **QA only - terminal loss**. Its two stationary Drifters are positioned
   near the two spawns; the target is 95% coverage.
2. Use `D` for Sunflower and `ArrowLeft` for Skyline to contact the markers. The
   first joint recovery spends the single team reserve. `active-recovery.txt`
   records both players back on safe ground, Support ready, zero reserves and the
   footer explaining that one reserve was used. This is active recovery guidance,
   before the terminal result.
3. Repeat the inputs to reach terminal loss. `loss-state.json`, `loss.txt` and
   `loss.jpg` record **Attempt ended / Results ready** for both players at 0:08.
   The footer reads **Team attempt ended. Choose Retry or Change setup.** and has
   `role="status"`, `aria-live="polite"`. Named Help values advise Sunflower and
   Skyline to Retry or Change setup. The compact DOM values are Ended / Results.
4. Press Return on the already focused **Retry same arena**. `retry.txt` records
   focus on the canvas, 0:00, one reserve, both players on safe ground with Support
   ready, and active Drifter/cut guidance in the footer. This is a direct loss
   Retry, not a return through the Lobby.

## Victory, Help and pointer Retry

1. Use the ordinary setup flow to select **QA only - terminal victory**, explicitly
   discarding an active restarted attempt when the game requests it. The victory
   fixture has no enemies and a 0.01% target; it is designed only to expose the
   terminal presentation quickly.
2. Start and use `D` to bank a complete crossing. `win.txt`, `win-state.json` and
   `win.jpg` record 100% at 0:03 with one reserve. Both player HUDs show
   **Objective complete / Results ready**. The footer reads **Team objective
   complete. Your shared result is ready.**, with polite live-status semantics.
3. At 568×320, `compact-win-state.json` records Complete / Results for both compact
   player labels, the terminal footer text and document scroll width equal to
   viewport width (568). `compact-win.jpg` shows the results panel covering the
   HUD/footer. This establishes the recorded DOM values and lack of horizontal
   overflow only, not visual compact HUD/readability acceptance. The coordinator
   then reset the temporary viewport override.
4. Expand **How to play and controls**. `win-help.txt` records named player
   summaries advising another arena or Retry. General instructional content
   remains available; the named current-status summaries describe the completed
   attempt. DOM semantics are not a screen-reader announcement test. Escape
   collapses Help before Retry.
5. Activate **Retry same arena** with the pointer. `win-retry.txt` records the canvas focus, 0:00,
   one reserve, safe-ground/Support-ready HUDs and active small-loop guidance.

## Retained diagnostics and boundaries

The earlier [baseline/HUD-only receipt](baseline-hud-only-receipt.json) retains two
important distinctions. `corrected-setup-restart.json` followed a second Escape
back to the Lobby and then Enter; it was not direct Retry evidence. That earlier
run also tried selecting an arena while a discard dialog was still open; selection
worked only after explicit discard. Its separate `direct-retry.json` records the
actual direct Retry. These earlier observations are not silently relabelled as
combined-source evidence.

The earlier HUD-only loss and win screenshots still show stale footer messages.
The combined loss and win screenshots show the corrected footer alongside the
corrected full HUDs. Manual loss timings differ between observations and are not
a simulation-equivalence measurement. The empty `console.json` covers only this
combined candidate journey.

No new browser run, test suite or device study was performed to package these
records. Raw observations were captured by the coordinator; the packager inspected
the screenshots and raw text/JSON, checked their hashes and independently rehashed
every recorded served binding. Public deployment and physical-input qualification
remain separate.
