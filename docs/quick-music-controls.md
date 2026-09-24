# Quick music controls

Music can be controlled without opening Settings or the Music Studio.

- **B** plays or pauses music.
- **N** selects the next song.
- The main menu and pause menu have **Play music / Pause music** and **Next song** buttons, plus the current song title and artist.
- Touch players can pause the game and tap either music button.
- Controller players can open Pause, navigate with the D-pad or stick, and confirm normally. Resume remains the initial pause-menu action.

Music Pause does not pause a flight or mute its sound effects. Next while music is paused changes the selected song and leaves music paused. Existing mute and volume settings remain unchanged. If browser permission blocks playback, choose Play music to retry.

Keyboard shortcuts yield to custom gameplay bindings, text entry, key capture, held/repeated keys, modifiers, inactive pages and nested practice ownership. They are unavailable while Music Studio owns its audition transport.

In **Settings → Audio → Music shortcuts**, turn off the single-letter shortcuts if preferred. This preference is shared across game modes on the same origin and saved separately from game progress and the music library. Touch and controller buttons remain available. If browser storage is unavailable, the switch applies to the current visit.

## Implementation and verification status

This feature uses the existing Solo soundtrack player and Couch music session. It creates no audio deck, changes no gameplay bindings, and introduces no IndexedDB or soundtrack-library migration.

Initial source base: `a4b4de89065b519bca13bb991319f2daee0fa73d`.

Development verification on Node 20.19.5 used an in-memory Git source loader because local filesystem writes were refused:

- Quick-controls unit tests and actual Couch music-host tests: **18 passed**.
- Actual Solo soundtrack-host, soundtrack-player and Couch music-session tests: **87 passed**.
- Modified JavaScript parsed successfully and was formatted using pinned Prettier 3.6.2.
- ESLint was not run locally because its package was unavailable. Required hosted checks remain authoritative.

These checks use simulated DOM/audio boundaries. Independent UI/audio fingerprint review, hosted full qualification, actual browser/controller/device checks, frozen-build inspection and public release acceptance remain required. This document does not mark the feature released.

## Review correction: explicit retry ownership

Independent review found that Solo's lifecycle capture listener could retry blocked music before the explicit B shortcut or Play button handled the same gesture. The capture listener now yields to the quick-control row and eligible B/N shortcuts, preserving disabled-shortcut and custom-binding precedence.

After this correction, the affected quick-controls, Solo soundtrack-host and Couch music-host suites passed **40/40** tests, including trusted keyboard and pointer retries that request playback exactly once. This follow-up does not replace the initial transport/session results or claim hosted release qualification. Raw output and source bindings are retained alongside the review evidence.
