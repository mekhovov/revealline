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

### Stronger unmuted regression evidence

The initial revision-2 retry tests inherited a muted fixture, which bypassed automatic lifecycle retry. The final tests explicitly enable sound and assert an unmuted output. Against the original `d34659f95a5a89a9227c17fbd35649e8a4c23521` runtime, keyboard retry requested Play twice and pointer capture started Play before the button. Both tests fail on that source and pass on the corrected runtime. These targeted runs select two tests and intentionally skip the other 19 host tests; they are not a full-suite qualification. Original revision-2 evidence remains retained.

## Current archive-player reconciliation

On 25 September 2026, the reviewed controls were replayed onto the exact public-archive
integration head `7cbf5771f69917dd9b24cc88e9687fec77f2a876`. The controls keep using that host's
single transport and live 128-recording catalogue; they do not create another deck, copy the
catalogue, or change its trust boundary.

The reconciled audio, control, host, panel, player, source and input cohort passes **346/346**
tests. The complete presentation-production-history file passes **12/12**. The separate Team
production-history file has the same two pre-existing `team.enemy.drifter` source-stage failures
on both the exact stack base and this candidate; those failures are retained as a blocker rather
than reported as passes. This feature changes no Team recipe input or generated presentation
output. Three broader Couch navigation host assertions also fail identically on the exact stack
base and candidate; targeted base/candidate runs preserve those upstream failures instead of
attributing them to the quick controls.

Revision 5 of the fingerprint audit compares every declared Field Kit source group on the exact
stack base and candidate. UI, screens, motion, effects, Team and audio fingerprints are byte-for-byte
unchanged, so no production-ledger write or approval inheritance is justified. The audit records
the quick-control host, module and CSS as runtime paths outside the current declared recipe groups.

Independent final review, hosted source gates, actual browser layout, physical keyboard, touch and
controller checks, frozen-build inspection and public release acceptance remain pending. PR #333
stays stacked on PR #370 until the online catalogue integration is merged.
