# P03 navigation recovery — original correction evidence

This additive bundle preserves the failed `39eaea27d456551b694c78e3a24f236cdb598fd9` source runs and the next working correction. It is evidence preservation, not release qualification or phase acceptance. P03 remains **In progress**. No source freeze, public deployment, physical-controller certification, or real foreground leave/return acceptance is established here.

## Failed hosted source

Both run [35078291343](https://github.com/mekhovov/revealline/actions/runs/35078291343) and run [35078265140](https://github.com/mekhovov/revealline/actions/runs/35078265140) finished with failure on exact source `39eaea2` / tree `595651c9575c8c5a93dd192f21647f4d730b3ecd`. They have the same **10 distinct leaf failures**: chapter-download-host (2), host-presentation-size (2), featured-chapter (5), and practice-brief-host (1). Repeating them in two source families does not make twenty distinct regressions. The manual freeze was skipped and its artifact inventory is empty.

All retained original source-run, job, automation/API, gzip log, collector, invocation, monitor and failed-inventory files are preserved. Collection success never changes a test failure into a passing qualification. The earlier partial failure observation remains separate from the final complete inventory.

## Correction and local verification boundaries

The chapter-install fixture correction scopes the existing 30-second allowance to the four named files' real large-chapter selection/install waits. It retains the actual chapter-identity, original-picture, readiness, storage, checkpoint and renderer predicates. Ordinary five-second waits and simulation behavior remain unchanged. Success and failure diagnostics preserve the observed state and original assertion.

The Solo correction rejects an already-ready Resume while the document is hidden or unfocused, before clearing Pause or changing focus/audio ownership. The six new regressions cover stale queued activation and eventless foreground-state changes, preserving both turning modes and exact unfinished cuts. The baseline full continuous-host file reported **7/11**, reproducing four stale-Resume failures; the corrected file reported **11/11**.

The eight-file correction cohort passed **135/135 on Node 20** before a one-line formatter-only change to continuous-host, and **135/135 on Node 22** after that change. The whole continuous-host file was rerun on final formatting under Node 20 and passed **11/11**. These overlapping totals must not be summed or presented as two final-byte full-cohort passes. Final focused lint and the twelve-path format check also passed, with their original receipts and stdout/stderr retained.

`run-focused.py` pins the directly named application/test files for its before/after checks; it does **not** recursively pin every imported dependency and did not directly pin the newly added `chapter-install-wait.mjs` during the cohort commands. The helper's exact body is retained in the proposal, applied review and final composed source list; the final lint/format runner explicitly pins it. This boundary remains visible and does not substitute for later whole-source hosted qualification. The bundle also retains both applied source reviews and their stated authorship/verification limits.

## Native observations

Both five-file native attempts are preserved unchanged. The source-native record contains scoped root observations and inline screenshots only. The foreground attempt selected another in-app browser tab, but the old game subsequently reached victory. The attempt did not establish the document's actual visibility/focus state or event delivery, so its receipt remains `PAUSE_TRANSITION_NOT_ESTABLISHED`. That observation is not proof of the separate, reproduced stale-Resume race, and the local regression correction does not convert it into native acceptance.

Real foreground leave/return, physical touch/controller, acoustic, whole-browser and public-release gates remain separate. No screenshot file is fabricated from inline transcript observations.

## Recovering originals

`manifest.json` records every original absolute path, group, size, SHA-256 and corresponding ZIP member. `evidence.zip` uses `objects/<sha256>` so identical bodies, including empty stderr, are stored once while all original path identities remain listed. The embedded manifest equals the adjacent manifest. Extracted bodies recover the exact original bytes; no JSON/log is normalized or relabelled. `receipt.json` pins the ZIP, manifest and this explanation.

The final composed tracked diff and explicit current source inputs identify the working correction, including the helper that was initially untracked and is now explicitly staged. Final local receipts refer to current input bytes; earlier receipts retain their original prior input identity. This bundle adds four ordinary delivery files and does not require adding every internal ZIP member to the later direct qualification selection.
