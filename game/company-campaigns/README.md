# Company campaign authoring

`catalog.mjs` describes five Coupa campaigns of six missions and a three-mission DroneAid community pilot. `content.mjs` produces the existing `ContentProjectV1` format. Each of the 33 missions has different authored walls, interior returns and/or terrain. Moving threats use existing field keepers and perimeter patrols. Source lessons and artwork do not alter collision geometry or the core replay.

The three Coupa practice campaigns share fictional workshop records, with different outcomes for requesters, buyers, receivers, AP staff and developers. The employee campaign has six reflections. Every reflection choice has a consequence, without a scored culture or personality assessment. Adventure and DroneAid missions have no training gate.

`lessons.mjs` is authoring input. Standalone editions load only their generated campaign JSON and lesson JSON; the generic `learning.mjs` and `workbench.mjs` do not import the complete authored catalog. The producer writes selected data using `scripts/produce-company-content.mjs`.

## Runtime contract

Validate the selected lesson array with `validateCompanyLessons`. Match `lesson.missionId` to `run.levelId`. Create a learning attempt pinned to the current lesson/fixture content and, when associated with a run, its simulation identity and uint32 seed. `reduceLearningAttempt` accepts `inspect`, `configure` and `commit`. A failed commit records explanatory feedback and leaves the draft editable. A successful commit is terminal. Culture reflection completes as `reflected`; a practice handoff completes as `mastered`.

The host creates `createLearningEvidenceObserver` at tick zero, observes every core tick, and pauses before opening `mountCompanyWorkbench` with its evidence snapshot callback. A positive cut closure or captured objective recovers one record; a won mission recovers the remainder. Inspect hides unrecovered record contents. Run-pinned actions require a safe ground or terminal boundary. Records follow the authored sequence; they are not individually bound to artwork coordinates. No lesson invokes a live API, approval, payment or production record update.

`verifyLearningAttempt` checks local transcript consistency against the frozen lesson. `verifyLearningEvidence` additionally replays the actual game input, checks every learning action at its safe tick, confirms inspected records were recovered by then, and verifies the final simulation checkpoint and summary. It returns the traced observer for continuation. Saved availability flags are never trusted. Lesson revision 2 introduces this evidence policy. This remains a local consistency proof, not a signed credential or anti-cheat guarantee. Edition progress keeps completed historical practice separate from a fresh attempt and requires verified arcade and learning completion for the next mission.

## Verification

Run `node --test game/test/company-learning.test.mjs game/test/company-evidence.test.mjs game/test/company-campaign-routes.test.mjs`. The committed route fixture replays all 33 missions at all 3 difficulty presets and both steering policies using seed 1: 198 successful objective-and-coverage completions without life loss. It checks authored simulation identities, final checkpoints and the public replay verifier.

Regenerate feasibility evidence with `node scripts/build-company-route-fixtures.mjs`. This uses the existing bounded omniscient route search and records legal input segments. A machine route establishes reachability and replay consistency. It does not establish human pacing, enjoyment, readability, motor accessibility, or performance on every device. Human playtesting and visual review remain separate release evidence.

The records are versioned illustrative training, grounded in linked official Coupa documentation and the public Life at Coupa page. They deliberately avoid live UI instructions, instance-specific scope strings, disputed endpoint behavior, and claims that approval means payment. DroneAid’s pilot is a fictional community workshop story, not an operational drone simulator or a claim about deployment outcomes.
