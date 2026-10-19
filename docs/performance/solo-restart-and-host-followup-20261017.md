# Restart and host regression follow-up

The reviewed source is `39774cce8697d412d138ef4da11ac547a5f8e535`, tree `cac2369a26cac5282e4260c638b934540d17ced6`. Source/model observations below do not measure native rendering, browser memory or device performance. All original results remain retained.

## Actual Restart defect

The public Workshop route lives inside Settings. Confirming Restart closed Workshop and Home but left Settings open. The fresh attempt then could not pass the existing dialog guard for Resume. Close Settings only after the existing exact restart ticket is accepted and cleared. Cancellation, stale tickets, saved runs and gameplay rules retain their existing behavior.

The complete sixteen-case Restart test passes with the one-line fix. Its confirmed-Restart assertions now also require Settings to be closed and no dialog to remain open. The independent review checked the accepted-ticket boundary, cleanup order, and cancellation path. Runtime `game/app.mjs` SHA-256 changes from `ac8ceee9e988ad4c8656cd58feb8226e70bde65a4afa7bfa7a846ac12d8185b6` to `2cd6ca5a29ba2964c50e8ef276bdf2a76e7e08c274da2f565ea6a78d7a79db41`. A package built from 397 predates this fix and cannot qualify it.

## First-use and image fixture corrections

Library is intentionally constructed on its first explicit use. Host tests must activate its real visible control and join that action's preparation. They must not assume the optional dialog already exists. History picture tests also need the existing image fixture that reads real PNG/JPEG/WebP dimensions; their old default returned 1×1 for authored artwork. The dedicated held-decoder fixture remains unchanged.

History passes its complete six-case file after those corrections. Across five further complete Solo files, fifty of fifty-one cases pass: flight pictures, HUD cues, restart picture retention, saved freeze presentation and capture-stop differential coverage. One Pressure Lines/grid-center/controller case fails its unchanged five-second Start deadline. Preserve that failure.

A separate passive diagnostic of that case passed, observing picture-ready → prepared board → cadence preparation → running through the original public actions. It changed no application state or deadline. Its reported intermediate elapsed values use the modeled scene clock, not wall-clock preparation timing. It does not establish the cause of the earlier timeout, nor clear the separately retained equipment Start timeout. An initial diagnostic construction mistake stopped before application execution; that failed tool invocation is retained too.

## Retained source receipts

Each receipt covers tracked/nonignored text sources before and after its run, plus separately hashed cache overrides. It is not a full production payload proof. Raw logs and receipts remain in `.cache/solo-followup/final-runtime-checks/`.

| Observation                                        | Result                                     | Raw log SHA-256                                                    |
| -------------------------------------------------- | ------------------------------------------ | ------------------------------------------------------------------ |
| Original History + Restart complete files          | 19/22; three failures                      | `a4905523cb6ef4133a4d8a6833c00759271bcd06d5fc4422ada8b105f78d6e86` |
| Restart with accepted-parent close                 | 16/16                                      | `a4f01ae3573e052125b604ddd03402cbfaa89845170fa741190134f84dac5fed` |
| History with real-dimension/public-action fixtures | 6/6                                        | `b31317d57c7b957f2b20f71ad50b0d7db50c31cbcf615aab0bd85d5e559c5fd3` |
| Five-file Solo group                               | 50/51; Start timeout retained              | `4934275fe012a1310ebeb11dfea539123651ce336cede75445b595520220d8cc` |
| Separate passive Start diagnostic                  | One case passes; no attribution conclusion | `9a9ecbe25bad74bb206059cc9e3d080899ce9c2409c1679f246a25e5fd6dab48` |

The earlier focused CI run `39059454486` remains failed at its ninety-minute deadline. Its partial inventory and raw output are separate from these complete-file or focused observations. Continue shared Team/Versus regression review and final-source native qualification; these source successes do not satisfy those gates.

## Failure-only Start observation

The two retained Start boundaries now opt into a test-helper observation only after the existing wait rejects. It captures bounded public preparation/status, focus/dialog state, scene submission/cadence flags and run identity, separating actual wall time from the modeled scene clock. Successful waits take no snapshots. The existing five-second local / twenty-second CI limits, wait implementation and original Error identity, cause and stack remain unchanged. Stale getters or a frozen Error cannot replace the original failure.

Seven source-extracted success/failure controls pass, including hostile strings bounded before encoding and exactly two opt-in sites. Their 1,724-byte TAP has SHA-256 `e2b089efbabdd73f85079d21e7a92372d6f15ea316d222765af629077d53b097`; the three-file test-only patch has SHA-256 `ebb2428cc6783d6b0eb2a5dc7d91dd88304583dcf67cedb60d5f814bbe2c35b9`. No additional host run was used to clear either timeout. Their causes remain unresolved; the next required run can retain a more useful failure boundary.
