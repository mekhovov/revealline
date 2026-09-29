# Soundtrack physical and offline acceptance — v0.142.2

This packet closes M2, M3 and M8 without treating simulated browser tests as
physical-device evidence. The tested public build must report v0.142.2 and source
`a5859df784314556072f9215f9b293962e4f2ea4` before execution.

## Automated and desktop preflight

| Check                              | Expected result                                                                                                                | State                                      |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------ |
| Public selector and release marker | Root selects v0.142.2 and the game reports the exact source above                                                              | Ready to execute                           |
| Canonical catalogue                | The game loads 196 public recordings and excludes 64 review-only recordings                                                    | Ready to execute                           |
| Remote to bundled switch           | Start a canonical remote track, wait 15 seconds, select bundled Shchedryk, then return to a remote track; audio remains usable | Ready to execute                           |
| Failed remote recovery             | Force one remote media request to fail; the failed deck is disposed and the next bundled, uploaded or remote recording plays   | Covered by source tests; repeat in browser |
| Uploaded MP3 coexistence           | Upload one small MP3, mix it with public and bundled music, then use Previous/Next across all three sources                    | Ready to execute                           |
| Saved style selection              | Choose at least two styles, reload, and confirm the explicit selection remains                                                 | Ready to execute                           |
| Review-only exclusion              | A known review-only ID is absent from ordinary archive/game results                                                            | Ready to execute                           |

## Physical iPhone

1. Open the public game in Safari and enable sound using one deliberate gesture.
2. In **Settings → Audio**, choose Synth and Metal and start the selected music.
3. Let a remote recording play for at least 30 seconds. Lock/unlock the phone and
   return to the game; resume if Safari requires another gesture.
4. Use Previous, Play/Pause and Next. Switch to Shchedryk and back to a remote
   recording. No fast skip loop or permanent silence is acceptable.
5. Background and foreground Safari once. Sound effects and music controls must
   remain independently usable.

State: **pending real iPhone execution**. A simulator result cannot close this row.

## Physical controller and touch

1. Open Audio settings with a connected controller. Confirm initial focus is
   visible and every style and transport control is reachable.
2. Activate Previous, Play/Pause and Next using Confirm. Gameplay must not start or
   change state.
3. Repeat using touch with no keyboard or mouse. Controls must not steal focus from
   Resume when opened from the pause menu.

State: **pending real controller and touch execution**.

## Cold offline restart

1. Install one permitted album and confirm its exact byte/hash verification.
2. Close every game tab, stop the serving origin or disable network access, and
   launch the installed game from a fresh browser session.
3. Confirm bundled Shchedryk and the installed album play. Public stream-only
   recordings should be reported unavailable without disabling bundled, installed
   or uploaded music.
4. Restore the network and refresh the canonical catalogue. The saved style and
   playlist choice must remain intact.

State: **pending a real server-stopped/offline execution**.

Record device model, operating-system/browser version, date, exact public URL and
the observed result for every physical run. A failure becomes its own scoped fix
and release; do not edit this packet to imply a pass.
