# Actor batch 10 — parallel C3–C6 implementation

Source checkpoint on PR761, parent `0cd0d6ddec77b87ecd0590089a18ece2730d922d`.
This is bounded source/authoring verification. It is not publication, whole-phase
acceptance, approved cultural art or a completed C2 pilot. C2 remains last.

## C3: authoritative Team hunter poses

`coop-actor-presentation.mjs` now reads the existing hunter state: warning faces
its locked target point; charge follows actual velocity rather than turning back
towards a passed target; recovery holds the pose. Pause holds heading. A review
caught residual banking when reduced effects was enabled while paused; the final
code removes that banking without changing motion, collision or timing.

The native [Team hunter study](../rotor-motion/team-hunter.html) uses the real
core snapshots and shared decoded presentation. It advances Patrol 0s, Warning 0.5s,
Charge 1.70s and Recovery 2.66s. Chrome visual review at 1593×1179 CSS pixels covers
light/dark backgrounds, pause and reduced effects. [Warning](team-hunter-warning.png)
and [recovery](team-hunter-recovery.png) are actual browser screenshots. They do not
establish whole-arena readability, physical input or a full mission playthrough.

[81/81 focused checks](team-hunter-focused.tap) include real-core transitions,
locked-target versus live-player ownership, passed-target velocity, recovery,
paused/reduced changes and unchanged core checkpoints.

## C4: optional remains without scenario mutation

Content Studio's **Show enemy remains** checkbox is available only for a valid,
explicitly enabled Solo combat preview. It defaults on and snapshots before any
asynchronous preparation. Off changes only inert residue through
`preview-remains=hide`; live actors, warnings, shots and brief sparks remain.
The parser requires an owned non-course practice route and exactly one
`practice=1` and one valid preference. Ordinary, ambiguous and malformed routes
retain existing visuals. No scenario, score, checkpoint, replay or save field changes.

[39/39 focused checks](practice-remains-focused.tap) exercise actual app/painter
hosts, exact checkpoint/replay equality, retained Retry, launch ownership and
EN→UK→EN markup. Independent review found no blocker. Native IAB at 1280×720 selected
Sentry detour, unchecked the option, opened the exact practice URL, started,
paused and closed. Close blanked the iframe and restored `#play`; Ukrainian
[checkbox/help](practice-remains-uk.png) was visible. That browser journey does not
claim contact/capture removal, a win, touch certification or controller hardware.
Global published-play preferences and broader counterplay qualification remain open.

## C5/C6: native board-image preparation

The new Asset Studio operation validates the whole retained collection before
rasterizing a parent reveal. Wide 1152×576 and classic 768×576 support contain or
center crop, preserve aspect, reject upscaling and fit the existing 16-file,
4 MiB/file and32 MiB/payload limits. Declared pixel art uses nearest sampling;
photographs use smooth sampling. Rights, creator, parent identity, original
records and bytes remain retained. The new immutable candidate records fit
rectangles, sampling, actual PNG hash/bytes and native encoder identity.

Load ownership, AbortController, decode timeout and late completion checks leave
the previous draft usable on rejection, cancellation, replacement and page restore.
Native Canvas encoder bytes can vary between browsers: recovery uses the retained
export, not a promise of identical regeneration.

[26/26 artwork checks](artwork-focused.tap) cover validation, geometry, budgets,
maximum creator metadata, source snapshots, actual rasterizer-entry then ignored
abort, native adapter cleanup, atomic mounted-panel adoption and stale lifecycle.
The tests' injected rasterizer/decoder boundaries are not native-image evidence.

Separate actual Chrome evidence created the three wide derivatives plus workshop
classic contain, exported the native download, reloaded, and reimported that exact
file. [Screenshot](native-artwork-reimport.png) and [DOM readback](native-artwork-reimport-observed.json)
show all 7 entries and revision 5. [Independent byte verification](native-artwork-packet.json)
confirms the 13,316,304-byte packet SHA-256, all 3 original records/bytes unchanged
and a byte-identical packet round trip. Actual browser decode was performed;
the independent script's PNG header check is not a second raster decoder.

The four exact native outputs and full collection metadata are retained in
[board candidates](../../../authoring/library/community-art-cohort-v1/board-candidates-v1/README.md).
None are bound to missions. Resampling does not deliver deliberate native-grid
cleanup or fix the Poltava shutters/beam details. Those reviews remain required.
IAB download capture timed out, so the independent native Chrome download is the
reported export evidence; IAB export preparation alone is not counted as success.

## C6: non-rotor Motion Lab editing

Existing wing, thruster, pulse and blink components now have validated anchor/rate
controls, per-character drafts, JSON application/export and reset. Original
component identities, bounded recipe fields and shared clocks remain authoritative.
There are no invented gameplay states or edits to historical presets. X/Y/rate
keyboard increments are 0.01; pending text is not committed until native change.

[91/91 focused checks](motion-parts-focused.tap) cover real rendered wing commands,
invalid draft retention, per-character/reset, paused/reduced clocks, single frame
ownership and BFCache. Actual Chrome typing plus Tab committed anchor 0.25;
ArrowUp committed 0.26; rate 3.25→3.26 worked while paused. A CUA fill interaction
that did not trigger change was not used to infer a product defect.

## Build, review and release limitations

The first validate/build correctly failed because `parts-editor.mjs` was absent
from Motion Lab's explicit distribution allowlist. [Validation log](validate-before-packaging-fix.txt)
and [build log](build-before-packaging-fix.txt) preserve the failure. The module is
now explicitly included. Final ordinary build and byte checks are recorded in
`development-build-verification.json`; source gate outcomes in `source-gates.json`.

The complete selected production guard has **6 passes / 2 failures**:
[current log](production-guard.tap). Both failed assertions require exact Team
recipe approval and observe `source` rather than `reviewed`. No historic approval,
compiled asset or assertion is changed to hide this blocker. These source changes
require a new reviewed successor during integration. The four inherited practice
brief focus failures documented in batch 9 remain open; they were not rerun or
claimed fixed in this batch. Long suites remain waived under committed policy.

Focused cohorts overlap earlier evidence and are not additive full-game coverage.
No human-balance, physical touch/controller, comprehensive offline, sound-listening
or whole-content approval is claimed. Main/public remained v0.142.1 at the final
status read. The canonical publisher must reconcile newer accepted source/history,
resolve production review, assign version and qualify immutable publication and
actual public play. This draft does not allocate another version or publication lane.

Raw evidence locations and SHA-256 values are in [evidence-files.json](evidence-files.json).
TAP storage normalizes line endings/trailing whitespace; JSON uses repository
formatting. Counts and diagnostics are retained. Browser screenshots and packet-derived PNG bytes are unmodified.
