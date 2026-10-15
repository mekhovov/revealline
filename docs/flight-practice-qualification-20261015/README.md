# Flight practice evidence — 15 October 2026

These are byte-for-byte copies of local observation outputs, not publishing
approvals. Original capture-time absolute paths in JSON are intentionally unchanged.
Screenshot basenames resolve in this directory; their hashes match the receipts.

| Receipt                                                                                    | Result                                                            | SHA-256                                                            |
| ------------------------------------------------------------------------------------------ | ----------------------------------------------------------------- | ------------------------------------------------------------------ |
| [Directory first attempt](practice-directory-browser-da0b010820-20261015.json)             | Seven checkpoints reached; failed cleanup deadline                | `4938d4278809eade59a2057ef2589d5ec0108b65ed754d74a64ef42c14f2320b` |
| [Directory retry](practice-directory-browser-da0b010820-retry-20261015.json)               | Passed seven component checkpoints                                | `3bbe38ca9e76a1f5a63ce66b36b8ad12f3496172bd4e5f0fc7793251aa9296b6` |
| [Installation first attempt](practice-real-restart-da0b010820-20261015.json)               | Three apps prepared/installed; failed offline launcher visibility | `5d14698b7b583adeacbb726524982a733850ed8b05b0df16e292430a3ce5c656` |
| [Installation diagnostic retry](practice-real-restart-diagnostic-da0b010820-20261015.json) | Passed nine checkpoints, including browser restart                | `d24702feb930ba6980b402fd9ef1e4cb9819a3df6903df5a8637f6f98b10fb88` |

[Practice test log](practice-tests.log): 323 passed, zero failed, cancelled or
skipped. Includes the unpublished fourth-package recipe. This is a working-branch
test run, not an assertion that every changed file was in the frozen package.

Read the [observation report](../flight-practice-observation-2026-10-15.md) and
[release checklist](../flight-practice-release-checklist-2026-10-15.md) before using
these results. They explicitly retain failures, fixture boundaries and unrun
human/device/release cases. No test credentials or browser profiles are retained.

The [final-guide candidate observation](practice-real-restart-final-ff8bfbca35-20261015.json)
also passed nine checkpoints, including browser restart, on source `ff8bfbca35`.
Receipt SHA-256:
`7ffc0eaf169b6d0d40033555b385fb95ccd360a7050f21801db41717b6ef044f`.
It uses the same observer and the final candidate's new exact envelope, with the
same bounded fixture/network/input claims. Full repository lint exited zero.
