# Independent authoring review — Round 19

Read-only production review on 12 September 2026 of the scenario-v2 validator, Playground model/controller/HTML, `scenario-mastery.test.mjs`, the four updated authoring skills and the library/playground guides. The reviewer added this note only; implementation fixes were made by their owners.

## Findings and verified fixes

1. **An ordinary Playground tab could regain session-only rewards after selecting a campaign.** The guide promised a reward-free lifetime, but `selectEntry` and `leavePractice` reset `practice` from the narrower controller-preview flag. Persistent writes remained blocked by the original practice writer; in-memory picture/score/seal updates could resume and enter an export. The app now captures `practiceSession` immediately after validated scenario loading and uses it for initial state and both selection paths. Independent code inspection confirmed the original `!practice` completion/award guards remain in effect after these transitions. This review does not claim an independently executed browser completion for that fix.
2. **The updated library guide described the old portable format as current.** It still said `xonix-library.v1` with five sections and omitted mastery records. The guide now describes current library v2, all six fields and v1 migration to an empty mastery list. Existing clears are not described as newly earned equipment seals.

No additional concrete defect was found within the reviewed import, context, preservation and adoption paths.

## Checked boundaries

- [Scenario validation](../../../game/content.mjs) retains strict v1 fields. V2 requires a supported definition or explicit null; named references and equipment capabilities resolve against its actual map/roster. Invalid context rejects before image decoding. The synthetic single-map practice campaign is distinct from production registration and supplies no award capability.
- [Preparation](../../../game/imports.mjs) validates original data before cloning, snapshots before its first await, decodes bounded images sequentially and leaves the candidate unchanged. Caller mutation during decoding cannot substitute another goal.
- [Editor model](../../../game/playground/model.mjs) retains definitions across ordinary presentation and valid map edits. Missing required objects reject the whole candidate before adoption. Copy creates an independent authored declaration; clear makes absence explicit. An interaction preset deliberately clears the previous goal. An unrelated generated map with incompatible names requires clearing or replacing that goal.
- [Playground controller](../../../game/playground/playground.mjs) checks import epoch, model revision and its initial snapshot before adopting asynchronous results. Goal and structural edits validate before recording Undo or replacing the current scenario. Undo preserves configuration, source selection and prepared catalog together. Loaded-library export preserves original declarations; edited one-map export retargets the goal's campaign ID and reports this distinction.
- [Goal controls](../../../game/playground/index.html) expose copy, explicit none and a labelled complete-JSON editor. They do not claim to be a full predicate-form builder, a route solver or an AI generator. Status uses text and the existing live region. Native labels and DOM construction were inspected; this was not a screen-reader session.
- The four updated skills distinguish implemented finite recipes from future behaviors, old v1 formats from explicit v2 opt-in, local reference checks from route proofs, and imported metadata from new verified awards. All **73 local Markdown links** in those skills and the two updated guides resolve.

## Executed checks

```sh
node --test game/test/scenario-mastery.test.mjs game/test/playground-model.test.mjs game/test/content.test.mjs game/test/imports.test.mjs game/test/pack-mastery-integration.test.mjs
```

This focused run passed **78/78 tests** in about 5.9 seconds. Its log is `/tmp/round19-authoring-review.log`. These are overlapping subsets of the project's larger checks, including the separate [23-test pack integration suite](pack-integration.md), not additional independent totals. The run preceded the app's narrow lifetime-flag correction; that correction was subsequently inspected in source. The scenario/model/import tests cover actual validation, ownership, pre-decode rejection, finite context and preserved/retargeted declarations rather than merely checking visible copy.

The root reviewer separately reported browser journeys for copy/edit/none/Undo, invalid references and erase preservation, Microtile/grid preservation, retargeted export feedback, a real practice pickup and unchanged solo storage. Those reports informed the handoff; they are not direct browser observations by this reviewer. Physical controllers, native hosts, playability of arbitrary authored goals and enjoyment remain outside this review.
