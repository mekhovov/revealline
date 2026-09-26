> Retained historical excerpt after an ownership migration. Exact originals are preserved separately. This excerpt is not the original complete record or a release qualification.

# Company campaign authoring




`lessons.mjs` is authoring input. Standalone editions load only their generated campaign JSON and lesson JSON; the generic `learning.mjs` and `workbench.mjs` do not import the complete authored catalog. The producer writes selected data using `scripts/produce-company-content.mjs`.

## Runtime contract

Validate the selected lesson array with `validateCompanyLessons`. Match `lesson.missionId` to `run.levelId`. Create a learning attempt pinned to the current lesson/fixture content and, when associated with a run, its simulation identity and uint32 seed. `reduceLearningAttempt` accepts `inspect`, `configure` and `commit`. A failed commit records explanatory feedback and leaves the draft editable. A successful commit is terminal. Culture reflection completes as `reflected`; a practice handoff completes as `mastered`.

The current shared Solo host offers optional activities after victory and the revealed picture. They never gate arcade progress, and all illustrative records are inspectable in that bonus. No lesson invokes a live API, approval, payment or production record update.

The historical preview evidence contract creates `createLearningEvidenceObserver` at tick zero and observes every core tick. A positive cut closure or captured objective recovers one record; victory recovers the remainder. Run-pinned actions require a safe ground or terminal boundary. Records follow authored sequence, not artwork coordinates. This compatibility verifier does not imply that current bonus records are hidden around the pictured scene.

`verifyLearningAttempt` checks local transcript consistency against the frozen lesson. `verifyLearningEvidence` additionally replays the actual game input, checks every learning action at its safe tick, confirms inspected records were recovered by then, and verifies the final simulation checkpoint and summary. It returns the traced observer for continuation. Saved availability flags are never trusted. Lesson revision 2 introduced this evidence policy. This remains a local consistency proof, not a signed credential or anti-cheat guarantee. Historical preview progress retains its original combined arcade/learning gate; current shared Solo advances from the arcade result independently of bonus activity completion.

## Verification

Run `node --test game/test/company-learning.test.mjs game/test/company-evidence.test.mjs game/test/company-campaign-routes.test.mjs`. The independently verified route set covers all 69 missions at 3 difficulty presets and both steering policies using seed 1: 414 objective-and-coverage completions without life loss. All six route-suite checks pass for the advanced successor. Tests check canonical host catalog compatibility, authored simulation identities, all recorded events/closures, exact discrete outcomes, every board cell and objective flag, and full same-runtime checkpoints/public replay verification. Fixture v2 retains original raw hashes with their Node/V8/platform/architecture provenance. Continuous enemy tails and terminal sub-tick time are not portable fixed goldens; integer ticks remain exact. Strict saved-replay imports can still reject incompatible math runtimes.

Regenerate feasibility evidence with `node scripts/build-company-route-fixtures.mjs`. Its `--witness-only` mode adds portable witnesses only after proving that every original raw hash, input sequence and discrete observation still matches on the reference runtime; it cannot replace a failing route. This uses the existing bounded omniscient route search and records legal input segments. A machine route establishes reachability and replay consistency. It does not establish human pacing, enjoyment, readability, motor accessibility, or performance on every device. Human playtesting and visual review remain separate release evidence.


## Formative playtest preparation


`playtest-fixtures.mjs` contains four alternate fictional tasks with distinct mission/lesson identities. They change the requirement, role or requested resource so copying the first mission’s answer fails. Culture choices remain unscored. `companyPlaytestTask(id)` exports participant-safe records and choices without answers or feedback. The module is authoring-only: it is not in edition catalogs, runtime imports, progress or release mastery. Tests use the existing learning reducer for fixture consistency; this does not substitute for a person explaining the decision.

[Transfer practice](../../authoring/company-studio/playtest.html) mounts those tasks with the existing workbench controls, immediately inspectable records and blank answers. It stores no answers/results, awards no campaign progress, and clears its in-memory response on restart, task change, close or leaving. Its export contains task cards only. The facilitator records observations separately before Commit reveals feedback.

