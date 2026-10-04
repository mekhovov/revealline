# Compact demo controls and complete performances

The demo now places Pause/Resume, Next, play choices, Audio & details, fullscreen,
and Back in one compact top toolbar. Each icon has a localized accessible name,
tooltip, and 44 × 44 CSS-pixel touch target. Audio, credits, captions, picture
preferences, and practice choices remain in a scrollable panel opened on demand;
there is no persistent bottom dock while watching.

## Complete runs

- Remove the 45-second/six-maneuver improvisation cutoff and 60-second live cutoff.
- Admit recordings only when their verified endpoint is a real win or loss.
- Rehearse live seeds through the same Worker, watchdog, and simulation checkpoints
  before displaying them, then reset to the beginning. A seed that stalls is
  rejected during preparation, rather than displayed and abandoned mid-level.
- Improvised performances must capture territory and reach a terminal result.
  Keep bounded preparation and recording limits; exceeding them rejects the
  source rather than presenting an unfinished run as a completed level.
- Prefer safer choices after a lost life. Losses still arise from actual hazards
  during sustained cuts, without scripted reverse-direction suicides.
- Retire six authored mistake scenes (including unfinished excerpts and reverse
  suicides) from rotation and regeneration. Keep their historical replay files.
  Ten reviewed winning recordings across eight base maps remain, with improvised
  fallbacks for newly unrepresented installed maps and the existing live sources.

Manual Next, Back, cancellation, and genuine runtime faults retain their existing
behavior. This does not change game rules, progression, rewards, or picture policy.

## Verification

- Demo host, fullscreen, recording generation/identity, source inventory/packaging,
  bot, improvisation, audio, Back ownership, and loading/cancellation checks passed.
- A real-core live regression advances through 7,800 ticks without completing at
  the old 60-second boundary. Rehearsal rejects a stalled seed and admits a seed
  that reaches a verified victory, without leaking its Worker.
- Four seeded improvised runs reached actual losses after useful captures. One
  ran for 13,418 ticks (111.82 simulation seconds); all reproduced exactly and
  avoided reverse-direction failures. Verification yields and is cancellable.
- The isolated browser specimen at `game/test/browser/demo-toolbar.html` uses
  production markup and styles, without starting the game or loading protected art.
  At 320 × 568, 390 × 844, and 667 × 375, the toolbar measured 44 pixels high,
  all six targets fit, and the bottom panel was hidden while watching.
- Focused ESLint, Prettier, and whitespace checks passed.

## Remaining acceptance and tradeoffs

The isolated layout check is not physical iPhone, controller, or full-game visual
acceptance. The current local full game is access-gated; the specimen does not
bypass that gate. Review actual device presentation and perceived loading before
release. Rehearsal adds preparation work; existing loading deadlines and reviewed
fallbacks remain authoritative, so slow devices may skip more live sources.
Installed source enumeration does not guarantee every random seed can complete.
No release, Pages publication, or new two-hour observation is claimed here.
