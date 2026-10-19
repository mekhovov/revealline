# Static aircraft course verification

R11B introduced an offline, unscored diagnostic verifier. R11C now shares its reconstruction kernel with the simulator’s explicit **Verify course completion** action; the original physics-only action remains unchanged. It answers whether an exported aircraft session both reproduces its physical recording and completes an explicitly supplied static course under the recorded mission-adapter version. The simulator's existing archive verification, archive formats, saved setups, aircraft physics, package byte/file caps, scored comparison eligibility and awards are unchanged.

This is a software verification tool, not a claim of measured aircraft fidelity or authenticated pilot input. A course dependency supplied by the operator is not an official-course authority, and its hashes are not signatures. The tool does not grant leaderboard, competitive-ghost, personal-best or other scored production eligibility.

## Use

Run from this repository with its dependencies installed:

```sh
node scripts/fpv-static-course-proof.mjs bind archive.json course.json dependency.json
node scripts/fpv-static-course-proof.mjs verify archive.json dependency.json report.json
```

The first command validates and binds the exact normalized course and archive content with canonical-data SHA-256 digests. These bind validated JSON rather than raw file bytes; whitespace/key order are equivalent and validator defaults are normalized. The archive's existing course identity must match. The second command verifies both passes below. Omit the report path to write JSON to standard output. Output files must be new; the commands never overwrite an existing file. A failed course proof exits with status 2; malformed input or other failure exits with status 1; interruption with SIGINT exits with status 130. Cancellation creates no successful report file.

The dependency is separate from the unchanged production archive. It freezes the full authored course, evaluator version, historical mission model, and archive/course digests. Changing controller values, rates, geometry, objectives or the selected adapter cannot reuse the original recording merely by regenerating dependency hashes.

## What each pass establishes

1. **Physical recording verification:** call the existing `verifyAircraftArchive` unchanged. Its complete-session, interrupted-session and checkpoint-clip scopes retain their original meanings. A physical success alone never establishes course completion.
2. **Static course reconstruction:** require a complete session beginning at canonical reset. Recreate the ordinary `createAircraftCourseSession` with the supplied course, recorded mode/configuration, historical mission adapter and known physical backend. Generate spawn state and terrain from that course; compare them against the recording rather than trusting recorded terrain as course authority. Feed the ordinary session one canonical accepted input sample per 50 Hz mission interval. Check every recorded periodic hash, segment final hash, next segment's complete checkpoint and the final session hash. Continue checking the tail after objective completion.

Only the second pass's ordinary mission predicates determine completion and objective boundaries. Reported objective durations are at 50 Hz mission resolution, not the finer recorded physics-step timing. At most 64 objective rows are retained. The existing observed pause-panel rows are not accepted as proof or imported into the verifier.

The report keeps `physics` and `course` separate. A physically valid but unsupported or incomplete course can return `physics.verified: true` with `course.verified: false` and an explicit reason. A successful CLI report says `toolingOnly: true` and `scored: false`. Browser reports also remain `scored: false`; they do not carry the CLI-only provenance wrapper.

In-process consumers may call `isVerifiedStaticCourseProof` only on the exact frozen object returned by this module. Its private WeakSet admits successful course reconstructions only. Copies and parsed JSON reports are untrusted, and no object is registered with production comparison eligibility. A persisted report must be verified again before a consumer treats it as an in-process proof.

### Owned comparison prerequisite

The shared verifier additionally exposes `aircraftCourseComparisonEligibility(reference, candidate)` for two exact results from `verifyAircraftCourseArchive` or `verifyAircraftCourseArchiveInWorker`. A private registry records successful job ownership, including the worker reply's binding to the cloned archive's final hash, end tick, recorded mode, configuration class and terrain identity. Both archive and course inputs are copied before asynchronous verification; later caller edits cannot change the job. The immutable `requestedCourseIdentity` report field binds the bounded input course, before per-format validation adds defaults; the existing canonical course-to-recording check remains separate. Returned course reports, nested splits and optional presentation data are immutable. Aborting at worker completion still rejects the operation before its result can be registered in the caller's realm.

The assessment rejects unowned or serialized reports, checkpoint clips, incomplete or unsupported courses, direct proofs produced with a caller-supplied course adapter, and results from an explicitly supplied worker constructor or an unrecognized worker entry URL. Custom executors remain available for diagnostics. Only the environment's default Worker and the exact built-in Academy/World worker entry URLs can establish this ownership through the worker wrapper. The ordinary World worker installs its adapter locally; its result is independently registered by the receiving wrapper. The environment and loaded application code remain trusted. This is an in-process ownership check, not cryptographic attestation or protection against altered application code or a replaced global Worker.

Two complete reset proofs can be compatible for **unscored practice** when both their configuration class and reconstructed terrain match. Existing identity rules continue to permit personal rotation rates and cosmetic camera differences while binding aircraft, controller, throttle/performance limits, timing, mode and course conditions. Exact replay verification still uses each recording's own frozen configuration. The assessment always returns `experimental: true`, `scored: false` and `defaultEligible: false`, including on success. It changes no record admission, awards or legacy comparison API. CLI wrapper objects and persisted reports must be reverified through the shared verifier to obtain this particular in-process ownership.

The unscored reference UI now requires this owned-proof assessment before offering either split references or recorded-aircraft visuals. It also retains the independent live-session, archive-generation, selected-archive, 50 Hz objective timing, configuration-class and terrain checks. Verification never selects a reference automatically. Clearing a selected reference remains available after compatibility is lost; recovery, replacement, cancellation and disposal keep their existing cleanup ownership. The host leaves the environment's matching default Worker implicit; a different injected constructor remains diagnostic-only.

This is a tested boundary prerequisite, not completion of R11 scored promotion. Binding scored admission to the app’s known course/rules, qualification policy, scored storage/admission, competitive ghost/sector filtering and platform qualification remain separate work. The consumer tests use short synthetic static Academy/World recordings and actual verifier/worker-handler results; they do not establish authored-course, rendered-browser or real-device qualification. Combined package qualification and release acceptance must use the final integrated source; no file or byte limits are raised.

## Supported and rejected cases

The current kernel supports static `FlightCourse.v1` and `FlightCourse.v2` documents with only hold, gate and land objectives, known `aircraft-course-practice.v1`/`v2` mission adapters, explicit fixed 500 or 1,000 Hz timing, and its supported regional-v1/v2/v3 numerical identities. Historical recordings reconstruct their recorded backend and frequency; they are never upgraded to the current default. Academy and World archive hosts are supported. The archived course family is checked separately because World can launch an Academy course.

The tool fails closed for:

- Missing, mismatched, oversized or malformed dependencies; unknown course/evaluator/mission versions.
- Checkpoint-origin clips, interrupted sessions, noncanonical spawn/configuration, missing/reordered segments or inconsistent hashes/checkpoints.
- Actors, dynamic colliders, action-dependent or other unsupported objectives, additional motion/terrain events, or optional challenge wrappers.
- Regional/free-flight courses, unknown backends, or unsupported simulation frequencies.
- Missing, duplicated, reordered, noncanonical or unsafe recorded input clocks and sequences.

Aircraft archives contain four stick channels, not an action-button history. Actor-free hold/gate/land objectives in the current model do not depend on those omitted actions. The tool does not claim to detect past unrecorded action presses; it rejects action-dependent objectives and unknown recorded event rows.

Historical v1 course recordings retain their raw-floor behavior. Verification does not upgrade them to v2 support normalization or silently award newly attainable objectives. The retained pre-change v1 fixture reproduces its original physical identity/hash and remains incomplete.

Input traversal is lazy and bounded by the existing archive limit of 256 segments and 32 MiB, not by the 12-minute threshold. Clocks must be safe integers. Course validation retains the existing per-format limits; the dependency envelope is limited to 4 MiB plus 4 KiB. CLI file reads allocate no more than the admitted file size plus one byte, close handles on failure and reject growth beyond the admitted size. Simulation instances are disposed on success, rejection, callback failure and cancellation. Verification yields between bounded blocks so cancellation can be observed during both passes.

## Source provenance and evidence limits

Reports record eleven **selected** source-file SHA-256 values, repository revision/tree and whether the working tree has changes. These values are diagnostic reproducibility metadata. They do not establish a complete transitive dependency closure, loaded-module integrity or trusted source authority. Reading a source file after a module was loaded cannot itself attest the loaded code. The tool checks that these selected values and repository metadata remain unchanged during a run, but only a clean, committed qualification run should be cited as frozen source evidence.

The tests exercise all 15 current catalog aircraft in Acro and self-level on one static introductory course, using normal input-driven ground, lift and gentle-landing progression. They compare every reconstructed objective boundary with the recorded ordinary session, including multiple recording segments. This is not all-course, browser, device, network, native-wrapper or real-aircraft qualification.

Focused checks also cover legitimate v1/v2 adapters, a retained pre-change v1 fixture, an Academy course, ordinary-input gate crossing/miss/wrong-direction cases, controller/rates/geometry tampering, dependency and terrain changes, noncanonical reset/input, incomplete and partial archives, cancellation during both passes, rerunning after failure/cancellation, private report ownership, CLI non-overwrite behavior and file bounds. The 39,000-tick cursor test crosses 13 minutes and demonstrates bounded schedule traversal; it is not a separate 13-minute physical flight qualification.

Run the focused suite:

```sh
node --test scripts/test-fpv-static-course-proof.mjs
```

The Node CLI wrapper and its tests/docs remain outside the shipped runtime. R11C moves the reconstruction kernel into the existing archive verifier, with host-owned adapters installed in dedicated workers. Academy does not import the World model. The browser freezes the selected archive/course, pauses flight, and cancels stale operations on session replacement, recovery or selection changes. It labels the archive, course and recorded mode; verification never completes the current live attempt or activates scoring. See the [browser acceptance and package receipt](fpv-browser-course-verification-20261018.md). Dynamic-course support and scored promotion remain separate gates. Explicit unscored split references and optional bounded recorded-aircraft visuals are locally implemented in [R11D](fpv-practice-reference-20261018.md) and [R11E](fpv-practice-ghost-20261018.md); they do not grant competitive eligibility.

## Built-in Academy admission audit (offline preparation)

```sh
node scripts/fpv-static-course-proof.mjs audit-builtin archive.json flight-01 r1 report.json
```

This separate command resolves the full validated `FLIGHT_COURSES` entry from the loaded repository catalog. Its ID and actual `revision` field select an entry; neither is sufficient without the complete content binding. A supplied course, sidecar, verification report, qualification policy, worker or adapter cannot replace these rules. The existing `bind` and `verify` commands retain their supplied-dependency diagnostic behavior. Academy courses launched by a supported World host remain subject to the existing native verifier's host and course-family checks.

The audit takes immutable module-owned course copies and refuses in-memory catalog changes at entry or during verification. It adds the catalog file to the eleven existing selected source pins and checks those hashes plus the repository tuple of HEAD revision, HEAD tree and clean/dirty Boolean during the job. A changed value aborts the audit; a dirty-to-dirty change in an unselected file does not change that tuple. This is a local loaded-code trust boundary, not source attestation: startup under modified application code, dependency changes outside the selected pins, changes restored between observations, and a modified JavaScript environment are not detected by these diagnostics.

The command reconstructs the recording through the native Academy verifier without a custom adapter or worker. It assesses the verifier owner's exact result before copying it into `AircraftBuiltinCourseAudit.v1`. The resulting `ownedProofAssessment` describes an unscored proof prerequisite; the copied or serialized audit itself is never registered as a native proof. Full archive/course digests and the existing configuration-class/terrain pair remain in the report. Recorded simulation identities, historical mission/backend timing, personal rotation-rate compatibility and throttle/performance constraints are unchanged. Output files must be new. A valid owned prerequisite exits 0, an incomplete or unsupported prerequisite exits 2, malformed selection/input exits 1, and SIGINT cancellation exits 130.

Every audit remains `toolingOnly: true`, `experimental: true`, `scored: false`, `defaultEligible: false`, with `admission: 'scored-admission-not-enabled'`. This slice introduces no qualification allowlist, score storage, award, public ranking, runtime import or package change. Passing an audit does not establish human input, real-time play, an unmodified client, account identity, platform performance, or measured aircraft fidelity. A local/offline report cannot provide that authority.

Scored promotion still requires explicit product decisions about local records versus public competition; eligible course revisions, aircraft and backend/platform qualification; completion/penalty rules; and historical-record treatment. Those choices must be owned by a future admission policy, not supplied by an imported recording or operator report. World-owned course resolution, dynamic courses and competitive filtering remain separate work. No authentication, signing service or server infrastructure is implied.

The focused tests generate an ordinary-input flight completing the unmodified built-in `flight-01`/`r1`, then cover native ownership before copying, full-content identity, altered same-ID course rejection, revision/ID errors, rejected authority overrides, immutable reporting, incomplete/interrupted scope, cancellation in both passes, catalog mutation, and non-overwriting CLI output. Selected source mutation runs in a disposable repository with only two writable source copies; it never changes the checkout's source. This is one authored-course software prerequisite, not all-course or hardware qualification.
