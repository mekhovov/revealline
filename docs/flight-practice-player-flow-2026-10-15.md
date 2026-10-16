# Flight practice: expanded player-flow checks

**Later visibility audit correction:** the eight FPV cases below read legacy
DOM telemetry without checking whether it was displayed. The admitted SIM HUD
hides those legacy instruments. Their authentic mode/start/pause/retry and
DOM-state observations remain valid; they do **not** verify player-visible FPV
height/speed feedback. Original receipts remain unchanged. The two Gym movement
cases and two independently replayed Gym exercises use a separate interface and
are not invalidated by this finding. Visible maintained-HUD FPV reruns remain open.

Hosting and publication remain deferred. This continuation follows the
[repair report](flight-practice-repair-2026-10-15.md), advancing C2 without
changing SIM mechanics, controls, rendering or training content.

## Integration and method

Rebased cleanly onto main `d452bda9e22acf705751f11584cdcd5b0a0d4640`.
This includes SIM's Alpine quiet-timber/station-concourse Library offers and
World Library flight-record navigation. Those inputs differ from the earlier
`50b7612e8` candidate; that candidate's receipts remain historical.

The registered v2 observer adds ten exact cases: EN/UK Gym, Academy Self-level
and Acro, and Worlds Self-level and Acro. It observes document language and the
localized Settings label, selects modes through Settings → Gameplay, and checks
DOM telemetry movement, pause stability and retry. The original v1 four-case protocol
remains supported without extending its claims.

A separate two-case Gym protocol requires a fresh lift-and-land exercise,
ordinary R/F input, visible lift, ordered 0/2 → 1/2 → 2/2 checkpoints, landing,
the native completion/result/checkmark, and released input keys. It captures
completion before entering Settings → Data to export the actual transcript.
The standalone runner independently replays that export with the exact native
catalogue/model and byte-matched seven-file dependency closure from the admitted
Gym package. Future unlisted imports fail closed. The final verifier runs each
replay in a fresh isolated Node process, not the browser or a long-lived module
cache. This is process isolation, not a filesystem/network security sandbox.

The whole envelope, including original runtime/source archives and inventories,
is admitted before staging. Gym plans bind Gym's revision; the generic loader's
existing default Academy selection remains compatible. Authority snapshots and
exclusive evidence outputs preserve failed attempts as well as passes. This
does not insert a transcript into the browser or synthesize native completion.

Independent read-only review found no blockers in the helper, replay or runner
integration; 34 focused tests passed (18 observer, 12 input-helper, 4 replay).
The [maintainer guide](flight-practice-maintainer.md#repeat-player-flow-observations-locally)
documents protocol selection and safe access handling.

## Fresh candidate and initial verification

The candidate at
`/Volumes/alex/CodexMigrationStaging/flight-practice-player-20261015.qlqEIH/candidate`
is frozen at source `8cf5fe46d239387e4686ad44443e78ad7cc0dd62`, tree
`c670ed46fa7b8db775b74112532ce20e9f928957`. Its
[original envelope](flight-practice-player-flow-20261015/optional-packages.json)
SHA-256 is `78c09eea14faffe9a18457b13c8ad1db268fe25815812e11b038d341d5031bb6`.
The [build receipt](flight-practice-player-flow-20261015/candidate-verification.json)
records two reproducible builds, committed inputs and independent runtime/source
admission. Counts remain 94 Gym / 101 Academy / 162 Worlds files. Policies and
the development version `v0.151.1` are unchanged; `publicEligible` remains false.

The [observer suite](flight-practice-player-flow-20261015/observer-tests.log)
passed 59 tests and the separate
[artifact/pointer suite](flight-practice-player-flow-20261015/admission-pointer-tests.log)
passed 17. Scoped lint, formatting and whitespace checks passed. These are
separate suites, with some coverage overlapping the full practice command.

The [full practice run](flight-practice-player-flow-20261015/practice-tests-interrupted.log)
was intentionally interrupted after 69 passing cases when internal free space
fell to approximately 123 MiB. It has no complete TAP summary and is **not** a
full-suite pass. Stopping that owned heavy process recovered space; unrelated
files were not deleted. Candidate outputs were already placed externally.

### Initial Gym observation: native completion, export not verified

The [original report](flight-practice-player-flow-20261015/gym-incomplete-export.json)
and [complete artifacts](flight-practice-player-flow-20261015/gym-incomplete-export-artifacts.tgz)
retain both EN/UK cases. Each observed the genuine ordered lift/hover/landing,
native 2/2 completion/result/checkmark, and released R/F keys. Both then failed
the export operation timeout, so the aggregate result is false. No transcript
or independent replay success is claimed for this attempt. Browser, server and
temporary-site cleanup all succeeded.

The completion and failure screenshots establish the test-route mistake:
Settings is not visible in Gym's native result scene. Its visible Home/Додому
button returns to the menu without resetting the completed model or transcript;
only then is Settings available. The helper omitted that step. Correct the
observer's public navigation, not the app or timeout, and retain this failed
attempt alongside any retry against the unchanged candidate.

### Initial locale/mode matrix: six passes, Worlds return route incomplete

The [original ten-case report](flight-practice-player-flow-20261015/modes-incomplete-settings.json)
and [complete artifacts](flight-practice-player-flow-20261015/modes-incomplete-settings-artifacts.tgz)
record Chrome `155.0.8059.80`, six passing Gym/Academy EN/UK cases and four failed
Worlds cases. Locale witnesses and actual mode selection succeeded; Worlds did
not start a flight while its custom Settings modal remained open. All owned
browser/server/temporary-site cleanup passed. Aggregate completion is false.

The source and screenshots identify another observer assumption: Worlds opens
`#sim-settings` and uses `#close-sim-settings`, rather than the shared shell's
Settings dialog/back button. Checking the inactive shell dialog and a Home menu
laid out behind the modal does not establish that Home is actionable. Observe
and close the actual native modal with its public Back controls before Play.
Keep v1's original workflow unchanged, and add a regression for v2's real modal.
This is a test-navigation correction, not evidence of broken simulator controls.

### Corrected ten-case matrix

The [unchanged-candidate retry](flight-practice-player-flow-20261015/modes-completed.json)
and [complete artifacts](flight-practice-player-flow-20261015/modes-completed-artifacts.tgz)
pass all ten cases. Each has the expected actual document language and visible
Settings label. Both FPV hosts retain the selected Self-level/Acro mode after
Start. DOM telemetry movement, four paused samples over 600 ms, reset, second
movement and second pause all pass. For FPV those nodes were hidden, as corrected
above; visibility was not asserted. Screenshots and observer authorities are retained;
owned browser/server/temporary-site cleanup passes. `qualified` remains false.

### Second Gym attempt: export succeeded, replay assumption rejected

The [second original report](flight-practice-player-flow-20261015/gym-incomplete-replay.json)
and [complete artifacts](flight-practice-player-flow-20261015/gym-incomplete-replay-artifacts.tgz)
show native completion and successful normal-UI export in both locales. Each
actual transcript contains four commands and 75 ticks. Replay rejected the
packaged `game/i18n/catalogs.mjs` because it is intentionally a generated locale
subset, not the full repository catalogue. Both aggregate cases remain failed;
their original reports are not rewritten after the verifier correction.

The builder generates that JSON-only projection at
`scripts/build-optional-practice.mjs:302`. The corrected verifier still requires
all six executable model/catalogue/validation/i18n modules to match repository
bytes and rejects unlisted imports. It validates the seventh module as the
builder's exact JSON-only bilingual projection, then copies **all seven admitted
files** unchanged into its own temporary directory. A fresh Node child replays
the actual exported transcript with those bytes. A local `type: module` loader
fixture is neither packaged nor served. The child inherits no environment,
has a ten-second deadline and 64 KiB output limit, and its staged hashes are
checked before cleanup. Cleanup failure cannot produce success. This replaces
the invalid full-repository-catalogue comparison; it does not bypass admission.

Independent review found no blocking issue. Regression checks also reject
executable suffixes/IIFEs and incorrect locale roots in projected catalogues.
The earlier snapshots retain the first verifier for auditability.

### Final Gym end-to-end observation

The [third original report](flight-practice-player-flow-20261015/gym-completed.json)
and [complete artifacts](flight-practice-player-flow-20261015/gym-completed-artifacts.tgz)
pass both EN/UK cases against the unchanged candidate in Chrome `155.0.8059.80`.
Each observes fresh ground start, lift, 0/2 → 1/2 → 2/2, native localized completion,
result phase and replay-backed checkmark, then captures the completion screenshot
before returning Home and exporting through Settings → Data. No input, clock,
runtime model, progress or saved-record injection is used to obtain that result.

The actual EN record has five commands / 77 ticks, SHA-256
`abbb28f94c1d2578a0636bdf3c2d22aa3abf9ee0975e31e337a18f80b75c80e0`;
UK has five commands / 76 ticks, SHA-256
`066e3224170cccaa052f8730bcc52552cfe9b96e3e0b87eb28840d28467309f8`.
Both independent replays finish at checkpoint 2/2, altitude zero, with one native
ground contact. This is successful assisted practice, not precision landing or
physical-flight qualification. All owned R/F keys, browser, server and temporary
site are released/closed. Aggregate `completed` is true and `qualified` is false.

The final [observer suite](flight-practice-player-flow-20261015/observer-final-tests.log)
passes 61 cases, including the native-route and projected-locale regressions.
After disk pressure recovered, a separate
[full practice rerun](flight-practice-player-flow-20261015/practice-tests-completed.log)
passed **352 tests, zero failures, zero skips**. This does not replace or erase the
interrupted log. Scoped lint, formatting and whitespace checks passed again.

The [final input comparison](flight-practice-player-flow-20261015/final-input-check.json)
checks all 87 Gym, 94 Academy and 155 Worlds original inputs against the frozen
inventories: zero changed hashes. Follow-up changes affect observer tooling,
tests and documentation, not the candidate's application inputs. Original source
and observer-authority identities are retained rather than relabelled.

The [independent evidence audit](flight-practice-player-flow-20261015/independent-audit.json)
found no actionable defects: all 116 archived files, 82 authority/screenshot/export
pins and five original receipts match, all ten locale/mode checks recompute, both
Gym replay closures match admitted ZIP members, and the complete test summaries
are confirmed. This read-only audit is not one of the pending human/device
qualification approvals.

## Acceptance boundary

Unit tests alone do not complete C2. Both observers start from stable app
launchers, not the main-game Flight practice directory. FPV exercise completion,
first-time human learning, physical input/accessibility, distinct-version
migration and public-host acceptance remain separate gates. `qualified` stays
false; no review approval is fabricated.

Next implementation priority is the complete staged main-game directory → app →
guide → return journey, then representative Academy and Worlds beginner exercise
completion with their native verified evidence. Continue the separately listed
pointer, populated-World restart, genuine distinct-version migration and
interrupted-installation checks afterward. Physical-device, first-time-player
and maintainer-review gates require real observations, not synthetic approvals.
