# Static aircraft course verification

R11B introduced an offline, unscored diagnostic verifier. R11C now shares its reconstruction kernel with the simulator’s explicit **Verify course completion** action; the original physics-only action remains unchanged. It answers whether an exported aircraft session both reproduces its physical recording and completes an explicitly supplied static course under the recorded mission-adapter version. The simulator's existing archive verification, archive formats, saved setups, aircraft physics, package byte/file caps, comparison eligibility and awards are unchanged.

This is a software verification tool, not a claim of measured aircraft fidelity or authenticated pilot input. A course dependency supplied by the operator is not an official-course authority, and its hashes are not signatures. The tool does not grant leaderboard, ghost, personal-best or other production eligibility.

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

Only the second pass's ordinary mission predicates determine completion and objective boundaries. Reported objective durations are at 50 Hz mission resolution, not 500 Hz physics-step timing. At most 64 objective rows are retained. The existing observed pause-panel rows are not accepted as proof or imported into the verifier.

The report keeps `physics` and `course` separate. A physically valid but unsupported or incomplete course can return `physics.verified: true` with `course.verified: false` and an explicit reason. A successful CLI report says `toolingOnly: true` and `scored: false`. Browser reports also remain `scored: false`; they do not carry the CLI-only provenance wrapper.

In-process consumers may call `isVerifiedStaticCourseProof` only on the exact frozen object returned by this module. Its private WeakSet admits successful course reconstructions only. Copies and parsed JSON reports are untrusted, and no object is registered with production comparison eligibility. A persisted report must be verified again before a consumer treats it as an in-process proof.

## Supported and rejected cases

The first slice supports static `FlightCourse.v1` and `FlightCourse.v2` documents with only hold, gate and land objectives, known `aircraft-course-practice.v1`/`v2` mission adapters, the existing 500 Hz aircraft backend, and its explicitly supported regional-v1/regional-v2 numerical identities. Academy and World archive hosts are supported. The archived course family is checked separately because World can launch an Academy course.

The tool fails closed for:

- Missing, mismatched, oversized or malformed dependencies; unknown course/evaluator/mission versions.
- Checkpoint-origin clips, interrupted sessions, noncanonical spawn/configuration, missing/reordered segments or inconsistent hashes/checkpoints.
- Actors, dynamic colliders, action-dependent or other unsupported objectives, additional motion/terrain events, or optional challenge wrappers.
- Regional/free-flight courses, unknown backends, or different simulation frequencies.
- Missing, duplicated, reordered, noncanonical or unsafe recorded input clocks and sequences.

Aircraft archives contain four stick channels, not an action-button history. Actor-free hold/gate/land objectives in the current model do not depend on those omitted actions. The tool does not claim to detect past unrecorded action presses; it rejects action-dependent objectives and unknown recorded event rows.

Historical v1 course recordings retain their raw-floor behavior. Verification does not upgrade them to v2 support normalization or silently award newly attainable objectives. The retained pre-change v1 fixture reproduces its original physical identity/hash and remains incomplete.

Input traversal is lazy and bounded by the existing archive limit of 256 segments and 32 MiB, not by the 12-minute threshold. Clocks must be safe integers. Course validation retains the existing per-format limits; the dependency envelope is limited to 4 MiB plus 4 KiB. CLI file reads allocate no more than the admitted file size plus one byte, close handles on failure and reject growth beyond the admitted size. Simulation instances are disposed on success, rejection, callback failure and cancellation. Verification yields between bounded blocks so cancellation can be observed during both passes.

## Source provenance and evidence limits

Reports record nine **selected** source-file SHA-256 values, repository revision/tree and whether the working tree has changes. These values are diagnostic reproducibility metadata. They do not establish a complete transitive dependency closure, loaded-module integrity or trusted source authority. Reading a source file after a module was loaded cannot itself attest the loaded code. The tool checks that these selected values and repository metadata remain unchanged during a run, but only a clean, committed qualification run should be cited as frozen source evidence.

The tests exercise all 15 current catalog aircraft in Acro and self-level on one static introductory course, using normal input-driven ground, lift and gentle-landing progression. They compare every reconstructed objective boundary with the recorded ordinary session, including multiple recording segments. This is not all-course, browser, device, network, native-wrapper or real-aircraft qualification.

Focused checks also cover legitimate v1/v2 adapters, a retained pre-change v1 fixture, an Academy course, ordinary-input gate crossing/miss/wrong-direction cases, controller/rates/geometry tampering, dependency and terrain changes, noncanonical reset/input, incomplete and partial archives, cancellation during both passes, rerunning after failure/cancellation, private report ownership, CLI non-overwrite behavior and file bounds. The 39,000-tick cursor test crosses 13 minutes and demonstrates bounded schedule traversal; it is not a separate 13-minute physical flight qualification.

Run the focused suite:

```sh
node --test scripts/test-fpv-static-course-proof.mjs
```

The Node CLI wrapper and its tests/docs remain outside the shipped runtime. R11C moves the reconstruction kernel into the existing archive verifier, with host-owned adapters installed in dedicated workers. Academy does not import the World model. The browser freezes the selected archive/course, pauses flight, and cancels stale operations on session replacement, recovery or selection changes. It labels the archive, course and recorded mode; verification never completes the current live attempt or activates scoring. See the [browser acceptance and package receipt](fpv-browser-course-verification-20261018.md). Dynamic-course support, reference/ghost selection and scored promotion remain separate reviewed increments.
