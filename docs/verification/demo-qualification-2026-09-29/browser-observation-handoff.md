# Finite browser observation handoff

The final observation is **running, not passed**. It uses the actual game with the installed FPV Front · Pressure Lines chapter. Installation and the resulting ordinary test flight occurred before the observation baseline on the separate `127.0.0.1:8820` origin. The user's `8779` game is unchanged.

- Checkout: `/Users/oleksandr.mekhovov/.codex/worktrees/community-admission/go_test`.
- Frozen production runtime: merge `c5e3419eecd564621470a654ce071f0f83d5984f` (later test/evidence commits do not change served runtime).
- URL: `http://127.0.0.1:8820/game/test/browser/demo-watch.html`.
- Existing in-app-browser tab: `32`, browser ID last observed `1`. It is marked for handoff. Re-discover the existing URL if IDs change; do not create a duplicate or reload it.
- Server: task-owned Python HTTP server on port `8820`, exec session `14116`. Preserve it until evidence is saved.
- Finite heartbeat: `finish-demo-browser-observation`, every 15 minutes. Pause it after the result is collected or the observation cannot continue without user action.
- Intended duration: 7,200 wall-clock seconds. The observer stops collecting automatically; it does not stop the game. Requested duration alone is never a pass.

Use `cua_repl` for browser interaction. On continuation restore its documentation, bind the existing tab, and inspect `#observer-status`. If the run remains healthy, keep it open with `markHandoff()` and stay quiet. Do not edit production/harness files, reload, navigate or inject game state during the observation. Returning focus must not override explicit playback intent.

At completion, read the full `#observation-report` textarea through read-only DOM access in chunks no larger than 80,000 characters, concatenate, parse, and save the JSON. A single large result was truncated during a preliminary run, so check the complete character length. The browser download-event wait previously hung and must not be used for collection. Preserve this run's exact source inventory, timestamps and diagnostics; do not rewrite preliminary files.

Review actual duration, sample count, replay/live rotation, pause/audio state, timing gaps, visibility, runtime diagnostics, navigation, source changes, storage-hash changes and bounded memory observations. All preliminary in-app-browser samples were visible even after changing tabs; that does not qualify hidden execution. No DOM status establishes audible output, physical controls, native OS behavior, human comprehension or release readiness.

Save the full report and update the qualification README with its actual outcome. Then inspect the current remote #781 head before committing/pushing evidence. Preserve newer owner work and use only a safe fast-forward continuation; no force overwrite, merge to main, release or hold changes. The exact source build/native reports are separate from this browser observation. Finally pause this finite heartbeat and release only the owned observer resources after evidence is retained.
