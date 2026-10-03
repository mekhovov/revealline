# Flight modes in the shared game shell

Worlds, Academy and the assisted flight gym now use the same presentation-only `mode-play-shell` contract as Snake. The title presents Start or Continue, mission selection, Settings, sound and fullscreen. Workshop and help remain available through Settings. A menu close never arms or resumes an aircraft. Native flight controls and existing record/replay rules remain authoritative.

## Entry and play

- **Worlds:** the title opens a prepared first flight, validated interrupted-flight recovery, or the existing catalogue. The catalogue retains Flight School, playlists, Workshop and Library. Explicit `#learn`, `#creator`, playlist and exact installed-world/course links keep their destinations. Settings delegates to the existing native flight-options dialog. A selected course opens its native disarmed scene; Arm remains explicit.
- **Academy:** the title opens the current drill briefing. Missions uses the existing drill catalogue, and Settings owns the existing flight mode, keyboard/touch/controller/radio, camera, appearance and audio controls. Notebook, radio setup, help and Studio retain their native dialogs. Studio previews and accepted recordings return to their matching scene; opening menus cannot acquire flight input.
- **Assisted gym:** the title and mission briefing own the existing drill selection; Settings holds language, sound, gamepad connection and detailed controls. Authoring remains in its existing validated catalogue/transcript dialog. Continue is session-only, matching the gym's existing persistence model.

The focused flight layout now applies on desktop as well as phones. Gameplay shows the flight scene, essential instruments, a shared wordmark Menu and Pause bar, Arm/Resume and native touch controls. Academy's scene fits inside the shared stage; Worlds moves the same bar into its native modal flight scene so it remains visible above the aircraft view. The existing paused flight menu retains advanced options, briefing, diagnostics and exports. Browser fullscreen remains an optional enhancement to the full-window layout.

Worlds and source-hosted Academy present Solo, Versus, Team, FPV SIM and Snake destinations derived from the existing validated game-return URL. The local gym source also exposes these destinations, and an installed gym can use a validated explicit return. Snake opens its game title directly. The shared header reuses the existing main wordmark asset; it does not duplicate artwork inside optional packages. An isolated optional package does not invent an arcade installation. Its host-provided return remains available. Interface theme, fonts and SIM appearance continue to use the existing presentation service.

## Finished recordings

When a recording exhausts its accepted commands, the shared menu shows **Results** and **Retry**, including incomplete recordings and section replays. Continue is unavailable after playback ends. This is a presentation outcome: the recorded simulation state stays unchanged, an unfinished objective is not marked complete, and watching earns no records or rewards. Results reveals the retained native playback explanation and actions. Pausing a recording before its end still offers Continue from the same position.

## Source and package ownership

`game/ui/mode-play-shell.mjs` is dependency-free. `scripts/refresh-fpv-play-shell.mjs` checks its syntax, rejects imported or dynamically resolved dependencies, embeds a deterministic source projection into the already-admitted `flight-fullscreen.mjs`, and projects its resource-free CSS into `flight-fullscreen.css`. The existing presentation-assets generator then includes that stylesheet in admitted SIM `style.css`. Both identity checks are part of `npm run validate`.

Worlds and Academy gain no package file slots. The gym admits the two canonical shared-shell files directly under its unchanged 64-file/8 MiB limit. No physics, collision, course, reward or record format changes are introduced.

## Verification

Regressions were authored for Academy and gym title/menu input ownership, explicit Start, paused clocks and continuation; Worlds' connected catalogue and native-modal header ownership; and the gym's pointer-focus Pause sequence. Regressions also cover exhausted incomplete Academy recordings and World section/full recordings: Results remains reachable, proof and record ownership are unchanged, and only explicit Retry prepares another attempt. Native blur/focus input safety remains authoritative, while the shared Pause button remembers the action shown when the pointer was pressed. Existing flight-domain tests explicitly enter the prepared disarmed scene; shell regressions retain the initial title. Automated suites remain waived and were not run.

Targeted ESLint, formatting and exact projection checks accompany production optional-package build/candidate/independent admission. These checks validate import closure and package budgets, not physical-device usability. The release owner records committed-source outcomes separately.

Remaining release qualification includes real 320/360/390 px phones, landscape, enlarged text, EN/UK, simultaneous controller/menu navigation, radio setup return, native fullscreen, offline packages, and listening/device review. The assisted gym keeps its simpler graphics and native eight-action controls; this change aligns navigation and screen ownership rather than replacing its model or artwork.
