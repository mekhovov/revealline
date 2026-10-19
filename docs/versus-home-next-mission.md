# Default Versus Journey: explain the existing Start selection

This bounded F10 slice adds one EN/UK paragraph beside the existing Versus Start
action. It explains the first mission, a deliberately selected exact mission, or
the host-selected successor to a recorded completion. A recorded completion is
not a claim about either player's present skill or the result of a match.

The existing boot owner still selects `initialJourneyMission`. Its cursor and
clear predicate are captured as read-only explanation facts, bound to the initial
accepted `roundRecipe`. The pure presentation helper verifies exact catalogue
membership and explains the supplied destination; it never invokes Next, sorts
missions, selects a different row, loads artwork, or writes progress.

Later accepted manual recipes use neutral selected wording. Live/paused matches,
pending or failed preparation, incoming exact-library handoffs/continuations,
stale cursors, unknown owners, and completed final-mission fallbacks receive no
initial recommendation. Historical/Classic/other Journey routes retain their
existing landing. Named result Next, Rematch, first-to-two, Skip, controller
input, focus, launch guards and persistence stay with their existing owners.

The paragraph shares the native landing command column with Start, adds only
its own `aria-describedby` ID, and preserves existing descriptions. Shell
teardown restores its authored location and removes only that association.
Locale refresh changes text without activating either board. The Versus host
does not own a generic saved-flight Resume; validated incoming continuation
settings and mode-return remain separate existing protocols.

Implementation base: `8704f202cda63edbc8438df133754a8ac2cdd358`, the independent
Solo fixture prerequisite in PR #1732. F10 remains partial overall; Team is a
separate host slice and lesson recommendations still depend on F25/shared demos.

## Verification status

The first frozen candidate's pure file passed **5/5**. Its complete new host file
ended with a file-level **0/1**, signal `SIGKILL`, after 120,495.591 ms, without an
individual case result. The cause is unknown; this is not an OOM or assertion
diagnosis. The historical host fixture is preserved as Git blob
`a65c3589ea7c4e918111a3c9d8e5a6b24fce412a` at
`refs/codex/evidence/f10-versus-host-da78-failed`.

Static review found an unnecessary second full default Journey construction in
the fixture, retained only to obtain its profile key. The corrected fixture pins
the exact independently reviewed v25 edition/profile metadata and checks actual
host profile writes. The real game still constructs and compiles the original
complete default Journey. No runtime, assertions, timeouts or catalogue are
replaced; bounded per-case phase/RSS diagnostics aid further diagnosis.

That corrected host attempt was also **incomplete**: an approved protective
`SIGTERM` stopped its validated worker at roughly 12.5 GiB RSS after 120,922.488
ms. Its 64d0 source manifest stayed unchanged, and no individual case result was
available. This protective stop does not establish the earlier kill's cause.
The corrected historical host and component fixtures remain preserved at
`refs/codex/evidence/f10-versus-64d0-host` and `...-shell`.

Read-only DOM review found no ancestor/self insertion in the new paragraph's
placement or restoration. Fixture identity checks now compare the same exact
references as Boolean predicates, preventing an assertion diagnostic from
serializing a complete DOM graph. The actual visible lobby Missions action is
`race-chapters`; its returned owner promise and exact Back focus are observed.
Neither change establishes that diagnostic formatting caused either old run.

The complete `couch-shell` file then passed **27/27**, with no guard trigger,
at 1,599.9 MiB peak process-group RSS. The complete actual default-host file
produced **9/10 passing cases** at 1,388.0 MiB peak RSS, with no guard trigger.
Its one assertion incorrectly expected a ready landing after a real mission
card's Play action. The published Versus owner explicitly starts that exact
mission and returns success only while its accepted match is running.

The corrected fixture asserts both accepted boards are running the exact
`first-return` mission, the explanation is absent, and the original Start
handler remains. It then exercises actual Pause and Resume with the same
checkpoint. It no longer issues an extra Start while already running. Neutral
ready-selection copy remains covered by real first-to-two setup preparation.
The obsolete visible-after-Play assertions were replaced, not retained verbatim.
Production, helpers, timeouts and the complete catalogue are unchanged.

Changed source lint, formatting and whitespace checks pass. The next complete
cohort uses 1,536 MiB V8 old-space, 2,048 MiB process-group RSS and 180 seconds
wall time per file; guard stops remain incomplete evidence, never a test pass:

- `versus-home-recommendation.test.mjs`
- `versus-home-recommendation-host.test.mjs`
- `couch-shell.test.mjs`
- `candidate-versus-host.test.mjs`
- `versus-default-entry.test.mjs`
- `mission-library-versus-host.test.mjs`
- `versus-continuous-next-host.test.mjs`
- `mode-return-versus-host.test.mjs`
- `mode-return-versus-recovery-host.test.mjs`
- `localization-couch-host.test.mjs`
- `couch-start-cue-host.test.mjs`

New native cases cover real initial/manual selection, visible description and
unchanged Start/Resume handlers, EN/UK focus/checkpoints, a legally earned clear
followed by re-entry, stale progress, exact incoming continuation, cancelled
original-picture preparation, first-to-two continuation and historical routes.
Existing assertions remain in the complete adjacent files.

Actual browser layout/focus review at 320 portrait and 568/844 landscape, both
text faces, keyboard/controller/pads, full repository validation and current-main
admission remain pending. Modeled host tests cannot qualify native rendering,
physical iPhone/PWA offline or Steam Deck behavior.
