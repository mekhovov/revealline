# Held A2 native preview

URL: http://127.0.0.1:65444/game/

Base c7f4faae318d58eacab140c1b2913e620e15efb7. Five exact production overlays are listed in native-preview-binding.json and checked against source-held.json (SHA55756dc7ea57b33b68cb8e8f53d8e6b3fa3ba7d3210fb3038bb378e2c63d49a6). preview-http-check.json records their actual HTTP bytes. The server reads other routes directly from the base Git objects, materializes no archive, binds only localhost on its own fresh port and supplies no timing/game-state/boot fixture. No P05/P08/R5/title/R3 overlay is included.

Root owns browser input. Suggested bounded journeys:

1. Ready Missions, nondefault theme: choose Versus, return through the actual ready Solo link. Confirm exact Missions selection, visible Versus focus after ready and no automatic Solo flight. Repeat URL only if desired to observe one-use Title fallback.
2. Configure Grid steering before starting. Move into a live cut with a buffered perpendicular turn, Pause → Missions → Versus. Observe checking/saved-or-session-only status. Stay/Escape must return to Versus link with the flight paused. Reopen and explicitly Leave, then return from actual Versus. Back opens selection; it does not adopt or resume the saved flight.
3. Actual Versus unfinished match → Return to Solo: Stay leaves both boards paused, Confirm uses the fixed captured-token link. No nested Solo hint is forwarded on Versus → Team.
4. Scope browser evidence only to actually exercised controls, source pins and visible state. Exact checkpoint/raw storage comparisons, race injection, blocked storage and native controller/physical/device behavior need their own evidence and are not implied by these observations.

The initial source-unit checks and the final fourteen whole-file pair are separate from native checks. Initial old G fixture absence remains a retained failed execution; the source is unchanged and only the two exact baseline pack leaves were restored for that rerun.
