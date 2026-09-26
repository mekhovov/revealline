# Company campaign authoring

`catalog.mjs` describes five Coupa campaigns of six missions, six DroneAid Netherlands campaigns of six missions, and a separate historical three-mission Portuguese pilot. `content.mjs` produces the existing `ContentProjectV1` format. The 69 maps retain distinct authored walls, interior returns and/or terrain. `progression.mjs` adds explicit canonical actor, objective, relay-gate, directional-field and shield/core encounter data. Source lessons and artwork never alter collision geometry or the core replay.

Current Coupa challenge windows are Bands 1–2, 4–5, 6–7, 8–9 and 11–12; Netherlands uses 1–2, 3–4, 5–6, 7–8, 9–10 and 11–12. Each campaign uses one simulation format, including explicit empty gate/flow arrays or nullable encounters in earlier missions. Qualify through `createContentExecutionCatalog` and the actual Solo host as well as the map compiler. Later standalone chapters introduce their assigned advanced mechanic; they are not novice courses. Human pacing and onboarding remain untested.

The three Coupa practice campaigns share fictional workshop records, with different outcomes for requesters, buyers, receivers, AP staff and developers. The employee campaign has six reflections. Every reflection choice has a consequence, without a scored culture or personality assessment. Adventure and DroneAid missions have no training gate.

`lessons.mjs` is authoring input. Standalone editions load only their generated campaign JSON and lesson JSON; the generic `learning.mjs` and `workbench.mjs` do not import the complete authored catalog. The producer writes selected data using `scripts/produce-company-content.mjs`.

## Runtime contract

Validate the selected lesson array with `validateCompanyLessons`. Match `lesson.missionId` to `run.levelId`. Create a learning attempt pinned to the current lesson/fixture content and, when associated with a run, its simulation identity and uint32 seed. `reduceLearningAttempt` accepts `inspect`, `configure` and `commit`. A failed commit records explanatory feedback and leaves the draft editable. A successful commit is terminal. Culture reflection completes as `reflected`; a practice handoff completes as `mastered`.

The current shared Solo host offers optional activities after victory and the revealed picture. They never gate arcade progress, and all illustrative records are inspectable in that bonus. No lesson invokes a live API, approval, payment or production record update.

The historical preview evidence contract creates `createLearningEvidenceObserver` at tick zero and observes every core tick. A positive cut closure or captured objective recovers one record; victory recovers the remainder. Run-pinned actions require a safe ground or terminal boundary. Records follow authored sequence, not artwork coordinates. This compatibility verifier does not imply that current bonus records are hidden around the pictured scene.

`verifyLearningAttempt` checks local transcript consistency against the frozen lesson. `verifyLearningEvidence` additionally replays the actual game input, checks every learning action at its safe tick, confirms inspected records were recovered by then, and verifies the final simulation checkpoint and summary. It returns the traced observer for continuation. Saved availability flags are never trusted. Lesson revision 2 introduced this evidence policy. This remains a local consistency proof, not a signed credential or anti-cheat guarantee. Historical preview progress retains its original combined arcade/learning gate; current shared Solo advances from the arcade result independently of bonus activity completion.

## Verification

Run `node --test game/test/company-learning.test.mjs game/test/company-evidence.test.mjs game/test/company-campaign-routes.test.mjs`. The independently verified route set covers all 69 missions at 3 difficulty presets and both steering policies using seed 1: 414 objective-and-coverage completions without life loss. All five route-suite checks pass for the advanced successor. Tests check canonical host catalog compatibility, authored simulation identities, actual gate/core events, final checkpoints and public replay verification.

Regenerate feasibility evidence with `node scripts/build-company-route-fixtures.mjs`. This uses the existing bounded omniscient route search and records legal input segments. A machine route establishes reachability and replay consistency. It does not establish human pacing, enjoyment, readability, motor accessibility, or performance on every device. Human playtesting and visual review remain separate release evidence.

The records are versioned illustrative training, grounded in linked official Coupa documentation and the public Life at Coupa page. They deliberately avoid live UI instructions, instance-specific scope strings, disputed endpoint behavior, and claims that approval means payment. DroneAid’s pilot is a fictional community workshop story, not an operational drone simulator or a claim about deployment outcomes.

## Formative playtest preparation

[The playtest packet](../../docs/company-editions-playtest.md) covers 66 current maps, three historical maps and 24 optional Coupa activities. It identifies four representative learning missions and supplies a facilitation script, pending observation tables, source links and an art coverage plan. Human observations are pending. There are 60 current missions without dedicated raster reveal pictures: 25 Coupa and 35 Netherlands. Six current and three historical raster pictures remain candidates. Final bulk artwork is held for human feedback.

`playtest-fixtures.mjs` contains four alternate fictional tasks with distinct mission/lesson identities. They change the requirement, role or requested resource so copying the first mission’s answer fails. Culture choices remain unscored. `companyPlaytestTask(id)` exports participant-safe records and choices without answers or feedback. The module is authoring-only: it is not in edition catalogs, runtime imports, progress or release mastery. Tests use the existing learning reducer for fixture consistency; this does not substitute for a person explaining the decision.

[Transfer practice](../../authoring/company-studio/playtest.html) mounts those tasks with the existing workbench controls, immediately inspectable records and blank answers. It stores no answers/results, awards no campaign progress, and clears its in-memory response on restart, task change, close or leaving. Its export contains task cards only. The facilitator records observations separately before Commit reveals feedback.

Practice lesson revision 3 improves causal feedback; S2P-06 fixture revision 2 makes its simplified approval policy explicit. Culture retains lesson revision 3 / fixture 2. The subsequent advanced-encounter update advances Coupa campaign/pack/edition revisions to 4 and Netherlands to 2, with changed mission/map revisions and fresh simulation proofs. Historical Portuguese source remains byte-identical. Revised lesson and simulation pins cannot silently authorize older transcripts.
