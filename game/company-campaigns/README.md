# Company campaign authoring

`catalog.mjs` describes six DroneAid Netherlands chapters of six missions and the historical three-mission Portuguese pilot: 39 authored missions. `content.mjs` produces `ContentProjectV1`. `progression.mjs` supplies canonical actors, objectives, relay gates, directional fields and shield/core encounters. Artwork and optional learning activities do not change collision geometry or replay rules.

The Netherlands chapters use challenge windows 1–2, 3–4, 5–6, 7–8, 9–10 and 11–12. Later chapters introduce their assigned advanced mechanic; they are not beginner courses. The Portuguese pilot keeps its original geometry and progress identities. The fictional workshop narrative is not an operational flight simulator or evidence of real deployment outcomes.

## Sources and generation

Run `node scripts/produce-company-content.mjs --check` to compare generated content with the authored inputs. Standalone edition compilation accepts an explicit catalog and file map, so independently owned community apps can supply their own content without adding it to this repository. The generic compiler, learning reducer, workbench and reward engine do not require any particular community's lessons.

The current shared Solo host offers optional learning after victory and the revealed picture. Learning never gates arcade progression. No lesson invokes a live API, approval, payment or production record update.

## Learning and evidence contracts

Validate explicit lesson arrays with `validateCompanyLessons`. Match `lesson.missionId` to `run.levelId`. Learning attempts pin lesson and fixture content, and optionally the run's simulation identity and seed. `reduceLearningAttempt` accepts `inspect`, `configure` and `commit`. Incorrect commits explain the problem and leave the draft editable. Successful practice and unscored reflection outcomes remain distinct.

`verifyLearningAttempt` checks transcript consistency. `verifyLearningEvidence` also replays actual game input and checks safe-tick actions, record availability and the final simulation checkpoint. This is a local consistency proof, not a signed credential. The historical capture-based observer remains a compatibility mechanism; current bonuses make all their illustrative records inspectable after victory.

## Verification and playtesting

Run `node --test game/test/company-learning.test.mjs game/test/company-evidence.test.mjs game/test/company-campaign-routes.test.mjs`. The retained route fixtures cover the remaining missions across three difficulty presets and two steering policies. A successful automated route establishes reachability and replay consistency, not human pacing, accessibility or enjoyment. Saved raw checkpoints remain subject to the runtime's compatibility checks.

`node scripts/build-company-route-fixtures.mjs` generates feasibility evidence. Its `--witness-only` option cannot replace a failing route: it must first prove that original hashes, input sequences and discrete observations still match the recorded reference runtime.

Use the [community playtest packet](../../docs/company-editions-playtest.md) for ordinary browser checks. The independent [authoring practice example](../../authoring/company-studio/playtest.html) uses a fictional bridge notice and earns no campaign progress. Its participant export omits answers and feedback. Record actual observations; do not convert missing human evidence into a pass.
