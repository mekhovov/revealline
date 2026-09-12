# Gentle library, backup and gallery — source verification

These isolated Round 30 changes add a saved next-attempt preference, resolve included backup campaigns before restoring their Gentle variants, and group pictures without merging their results. This is scoped source evidence, not a completed release or browser acceptance. The [accepted plan](../../round-30-gentle-difficulty-plan.md) and [player guide](../../campaign-difficulty.md) describe the wider increment.

## Changes and executed checks

| Component                           | Exact implementation commit                | New unique tests | Executed affected scope                           |
| ----------------------------------- | ------------------------------------------ | ---------------: | ------------------------------------------------- |
| Preference and compatibility        | `26e75e2e28091dce34f874ab55bb6c3d2a3a1f10` |               20 | 157/157 passed                                    |
| Trusted backup expansion            | `696952ae8029b813cc9ecde9ea90654b1e3b2ec6` |               12 | 88/88 passed                                      |
| Gallery grouping and mode selection | `3f4d5451f1dd8541a6b5b27141a47a1fe38e209f` |               16 | 84/84 initially; 45/45 after the final refinement |

There are **48 new tests** across these components. The affected batches overlap; the 45-case supplement is not additional coverage to sum into the 84. Every recorded batch has zero failures, cancellations, skips and todos. Commands used Node 22.22.2 through `mise`; scoped ESLint, Prettier and diff checks passed. No full source gate, browser run or test rerun was performed to write this note.

The [preference tests](../../../game/test/campaign-difficulty-library.test.mjs) exercise omitted-only migration to Standard, rejection of invalid present values, actual three-way storage merges, replacement generations, Undo, rollback and session-only failures. Old compatibility assertions first require the new field to equal Standard, then remove only that field for the original comparison. The archived fixtures were not regenerated.

Real public core inputs cover separate Standard/Gentle wins and live-cut backup restoration in both steering policies, including the encounter ruleset. The existing 1,000-score global cap, ten-score board cap and 7,200-second collection limit remain unchanged. Mixed-mode rows participate in ordinary bounded eviction; no promise is made that Standard history can never be evicted. Imported score-cap rows are metadata fixtures. The real long-duration core win checks collection rejection, not a recorded or replay-verified two-hour flight.

The [backup tests](../../../game/test/campaign-difficulty-backup.test.mjs) restore an included pack's Gentle live cut into a clean host using the actual public restore path. The optional synchronous `expandCampaigns` hook sees frozen registered originals plus the backup's fully prepared pack originals, not currently installed pack data. Returned contexts are bounded and owned before verification callbacks. Wrong keys or rules, conflicting ownership, malformed or asynchronous hook output, late mutation and final-callback cancellation reject. Existing no-hook behavior and portable formats remain intact; the larger in-memory context-copy allowance does not increase file import budgets.

The [gallery projection](../../../game/gallery-difficulty.mjs) groups only exact recognized base-campaign/map/theme identities, retaining the stored rows. Standard is the initial result when both modes exist; neither mode wins by comparing its score with the other. Saved difficulty selection shows that result's own score/time, and Replay mission passes its explicit mode to the host. Tests assert Standard `100 / 3.00s` versus Gentle `200 / 5.00s`, preserve focus and pagination, reject unavailable replay contexts, and cover late image/seal callbacks and celebration cancellation. Trusted Challenge activity has its own label and no difficulty override. Unknown contexts remain archived. Most gallery rows are explicitly metadata fixtures; a separate public-core award case checks real completion data.

## Evidence pins

The following unmodified worktree records contain exact commands, TAP/log hashes and source-file hashes. Their final source pins were independently compared with the implementation commits while preparing this note.

| Record                                                                             | Bytes | SHA-256                                                            |
| ---------------------------------------------------------------------------------- | ----: | ------------------------------------------------------------------ |
| [Preference verification](../../../.cache/gentle-library/verification.json)        | 4,734 | `8f192a6d604a88328898b44997e02fa4d0f2feff371347f4b7109507e5bdd807` |
| [Backup verification](../../../.cache/gentle-backup/verification.json)             | 1,358 | `caeff3d0ac17ee6f6a4772751e953ab3e1cfe50d8db4a65f94d87164dfd72990` |
| [Initial gallery verification](../../../.cache/gentle-gallery/verification.json)   | 1,699 | `ab771aca86f5f1e9e265243b6ff694a41eb856dbb4f5b979b0a498b79555fd69` |
| [Final gallery supplement](../../../.cache/gentle-gallery/verification-final.json) | 3,045 | `29067bbc8dc2925e7c99feec3cebee702374dd3fed20bd85dfbccfedbf6239cc` |

Raw results are [157-case TAP](../../../.cache/gentle-library/affected.tap), [88-case TAP](../../../.cache/gentle-backup/affected.tap), [84-case TAP](../../../.cache/gentle-gallery/affected-initial.tap) and [45-case supplement](../../../.cache/gentle-gallery/gallery-supplement.tap). Their recorded hashes were rechecked without changing the evidence. The eleven original fixture/proof files pinned against `a9578e0aecacf8d78fbc097406f5f603f5de41cc` in the preference record still match byte-for-byte. Cache links refer to retained local evidence; they are not shipped game assets.

## Independent review and limits

Lagrange's bounded source reviews found no concrete preference, backup or gallery authority/retention defect. Root's final gallery review required explicit primary-mode statistics, selected-mode score/time and strict explicit policy metadata; the final commit and 45-case supplement include those refinements.

The separate read-only host review found two selection issues: a derived Gentle ID could select the first chapter on pack replacement, and an implicit saved Gentle preference could alter campaign selection inside Practice. Root corrected replacement to use `activeEntry.baseCampaign?.id || campaign.id`, and selection to use explicit difficulty first, otherwise Standard in Practice. Both closures were read on disk; they preserve explicit verified save/gallery context. No other concrete blocker was found in the reviewed restore, award, shared-access, backup/Undo and cue paths. That read review is not an execution result for the later host changes.

This evidence does not establish browser layout, decoded image pixels, storage-device reliability, physical controller/touch accessibility, difficulty balance or a published release. Formal browser and release verification are separate. Existing replay, progress and collection authority remains with the normal validators; gallery grouping is a display projection, not synthesized Standard awards.
