# Native Motion rotation candidate harness

Open **http://127.0.0.1:52863/authoring/motion-lab/**. The loopback server serves exact local Git source `4fd8e2dac4fdc851d0d2bf0b21e77162d9d405c9` (tree `d16edac0127fc96139445ae2365cc74499f80921`) with only the pinned candidate `authoring/motion-lab/display.mjs` substituted. It does not read mutable root source, insert preferences, change application state, or use network Git fetching.

## Actual server

- PID: 27270
- Exec session: 69143
- Port: 52863
- Command: `python3 -u .cache/p03-motion-focus-rotation-4fd8/native-server/serve.py` with stdout/stderr redirected to this directory.
- Request log: `requests.jsonl`; live binding: `binding.json`.
- Stop only this server through session 69143 (Ctrl-C) or SIGINT to this PID after native checks. Keep its final receipt/log. Do not restart into the same evidence directory: original files are exclusive creations.

## Original observed steps and expected correction

1. Load the Motion study and wait for its normal ready state. Use native keyboard navigation; do not assign focus with script.
2. At 390×844 portrait, pause the preview. Reach Rotor radius by Tab, change its value (the previous observation used 27%), and retain that control as the active element. Record current value, recipe and paused state.
3. Resize to 844×390 without pressing Tab first. The label/current value/slider should remain visible within both viewport and settings panel. The field should use nearest scrolling; it must not steal focus, reset a value or start the preview.
4. ArrowRight must still change the same range while paused. Repeat a resize with the field already visible: there should be no unnecessary scrolling.
5. Repeat Standard/Large using the real Text size select, and reverse the orientation. Check settings-only clipping and a field too tall to fit. Theme/Plain may be checked only through an actual supported preference workflow; this harness does not inject storage to manufacture that condition.
6. Record native geometry/focus-ring observations separately from modeled source tests. Browser resizing is not physical-device rotation, controller or assistive-technology certification.

The prior observation is retained at `../final-review/prior-native-observations.json`. Its user-visible failure was that ArrowRight changed the offscreen rotor value and only Tab then Shift+Tab brought it back.

## Bounded verification

GET-only localhost smoke authenticated 152 Motion entry, static import/CSS, JSON, compiled font/image and default-body responses (2,715,162 bytes) against exact Git/candidate bytes. No browser was used, and no startup asset was omitted. Optional character variants, whole-game routes and return-to-game are outside this smoke. They are served lazily if local Git objects exist and stay below the 8 MiB single-file limit; no fallback or fake assets are substituted. There is no media/range/service-worker qualification.

No dependencies were hydrated to disk. The server has an 8 MiB memory cache, 1 MiB/4000-row request-log ceiling and a 512 MiB free-space reserve; all file requests are authenticated local Git object reads with lazy network fetching disabled. Candidate source remains unchanged.
