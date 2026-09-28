# Recording neutral pilot playtests

The neutral player exports version 2 observations that can be replayed through
actual Solo, Versus and Team engines. The previous player passed Team's `support`
field to Versus, which rejects that field. The shared session now constructs each
mode's accepted command shape. A terminal run or the ten-minute recording limit
requires Reset before playing again.

1. Serve the repository and open `docs/content-offline/pilot-player.html`.
2. Select a mission and difficulty, then Play. Use the displayed two-seat controls
   for Versus or Team. Pausing freezes simulation time; backgrounding clears held
   controls. Reset starts a new recording and clears notes.
3. Play the planned route. Record the route name, intended decision, confusing
   moments, failures and whether the complete-run duration met its brief.
4. Export observations. Keep separate files for alternative routes and presets.
5. Run `node scripts/verify-pilot-observations.mjs path/to/observations.json` from
   the same source checkout. Retain the source commit, original JSON, CLI result,
   browser/device version and screenshots alongside review notes.

The verifier rebuilds the named pilot from current canonical content; it never
runs a level supplied by the observation file. It checks the initial source,
resolved runtime levels, difficulty tuning, rulesets and race protocol, then
replays the bounded direction stream. Both Versus seats are simulated together;
Team uses its cooperative engine. Source configuration is captured before play
because Team simulation can mutate its own level data.

Results include terminal status, per-seat clears, elapsed simulation time,
coverage, objectives, board cells, player positions/trails, banking events and
failures. `verified: true` means those observations reproduce. `terminal: false`
is an incomplete run; a terminal defeat is not a clear. The verifier rejects
inputs after termination, altered outcomes/events, stale configurations and
oversized or invalid files. Direction runs are compressed without losing ticks.
File size is bounded at 16 MiB and simulation at 72,000 ticks (ten minutes).

Portable numeric observations use six decimal places, rather than an
architecture-dependent exact engine checkpoint. This verifies the recorded
outcomes, not every internal simulation field. Recordings are unsigned and can
be authored by automation; verification does not prove a human played, assess
fun or balance, or approve the mission. Notes are reviewer testimony. No game
profile, save slot, achievement or earned picture is written.

Version 1 files remain historical observations. They lack this verification
contract and are not silently upgraded or counted as verified v2 evidence.

## Evidence in this batch

Regression tests replay public inputs for Solo, Versus and Team. The unchanged
Solo First return control clears after 469 ticks on Standard, seed 17, using the
`down` command; its observed bank and complete result reproduce. This is a control
clear, not completion evidence for any replacement. The browser smoke check
starts and pauses the actual two-board Versus player without the former command
exception. The five replacement pilots still require complete playthroughs,
alternative routes, difficulty/failure observations and human design review.
