# v0.60.8 full public audit — prepared, deployment not yet bound

This is the literal-only successor of the accepted v0.60.7 helpers in `.cache/p03-replay-public-audit-a36d62f2`. It targets source `a7fd646e40bd93268f56b714fdc5d8aa9b0b1f67`, tree `fffcf886b4f1a0000fbfd062a931bbe1cb0fef64`. The retained catalog is the exact 78-row original from main `6601635e56bd2f5f7ae992f544a7bdf8880906de`; all 79 intended final rows must survive. The intended publication has 21 archive admissions. The exact source manifest contains 690 files / 313,015,040 bytes; this is not the final assembled Pages inventory.

No controller merge, Pages run/deployment/status or receipt artifact ID is guessed. `intake-request.pending.json` deliberately has null runtime authorities and `reviewed:false`. `proposed-publisher/` is a reviewed local candidate snapshot only. Intake obtains the actual committed selector, catalog, manifest, record and qualification, then binds them to the original successful hosted receipt. The final inventory must come from that receipt and include every root alias, hidden file, worker, release record and historical bridge.

## Reviewed adaptation and checks

`originals/` retains all ten original helpers/template bodies. `adaptation.diff` changes only the version, source, tree, retained catalog hash and the self-check row count 77 → 78. Five operational helpers are byte-identical: intake, refresh, observer, independent row reconciler and HTTP transport. All six Python AST structures remain identical after literal normalization. Nine wrapper tests and the Node20 self-check passed with zero real network calls. The old synthetic current-v0602 fixture locator is intentionally retained.

The tests check explicit review/identity refusal, changed or missing observations, archive members, download integrity, failed Git API intake, exact original preservation, incomplete/stale HTTP refusal and changed published assets. The transport check covers wrong hash/size/MIME/redirect refusals, retained transient retry and symlink input refusal. These mock checks are not deployment or browser acceptance.

## Execute only after actual intended Pages success

1. Root records the actual merged publisher commit/tree and its successful `publish-frozen-pages.yml` main-push run. The inherited GET-only observer then retains all actual run/jobs/artifact/main/deployment/status APIs with a unique label. A pending or failed observation is never the intake authority. Preserve all failures and retry observations under new labels.
2. Root reviews the terminal observation and the exact small `frozen-pages-receipts` descriptor. The receipt artifact must be the existing two-member original; never download the large Pages artifact, source TAR or distribution ZIP. Before intake, verify the 512 MiB free reserve and the 32 MiB cumulative cache allowance against actual compressed/expanded receipt sizes.
3. Root creates a separate reviewed intake request from the pending template with actual identities, receipt descriptor and relative pins for the observation and published release. Intake creates an **unreviewed** final binding only. Root checks the original receipt, exact 79-row catalog, all 78 preserved rows, qualification/source, admission configuration and full inventory before approving that binding.
4. Run the audit `--check` before the complete streamed audit. Use a new output label once, retaining stdout/stderr, command, start/end and exit status. Existing transient retry policy remains unchanged; content/size/MIME/redirect errors never become transient retries.
5. Reconcile every result and attempt with the bound inventory, then take a fresh hosted observation after completed HTTP proof. Root reviews a separate refresh request for the exact report, row review, original published release and new observation. Refresh rechecks the existing Latest/tag/nine assets/source/deployment and preserves its original responses.
6. Root performs the actual v0.60.8 player journeys. Byte success does not prove browser navigation, physical input, audible/offline behavior or complete phase acceptance.

## Commands

All commands run from this cache, with ACTUAL values supplied only from the retained successful deployment. These are templates, not executed observations:

```text
python3 -B observe-hosted.failure-retention.py before-1 ACTUAL_CONTROLLER_COMMIT ACTUAL_CONTROLLER_TREE ACTUAL_RUN_ID
python3 -B intake-live.py ABSOLUTE_ROOT_REVIEWED_REQUEST EXACT_REQUEST_SHA
/Users/oleksandr.mekhovov/.local/share/mise/installs/node/20.19.5/bin/node --max-old-space-size=1024 tools/audit-main.mjs --binding ABSOLUTE_ROOT_REVIEWED_BINDING --binding-sha EXACT_BINDING_SHA --check
/Users/oleksandr.mekhovov/.local/share/mise/installs/node/20.19.5/bin/node --max-old-space-size=1024 tools/audit-main.mjs --binding ABSOLUTE_ROOT_REVIEWED_BINDING --binding-sha EXACT_BINDING_SHA --out complete-1
python3 -B review-public.py ACTUAL_CONTROLLER_COMMIT complete-1
python3 -B observe-hosted.failure-retention.py after-1 ACTUAL_CONTROLLER_COMMIT ACTUAL_CONTROLLER_TREE ACTUAL_RUN_ID
python3 -B refresh-after-http.py ABSOLUTE_ROOT_REVIEWED_REFRESH_REQUEST EXACT_REQUEST_SHA
```

## Limits and acceptance boundaries

The unchanged engine allows at most 20,000 rows / 950,000,000 bytes, eight workers, a 300-second request timeout and three attempts for transient failures only. Bodies are streamed and never retained. API replies stay below 2 MB with 35-second timeout; the existing receipt parser accepts the exact two-member ZIP only, below 10 MiB compressed / 64 MB expanded. This parser ceiling is not permission to exceed this task’s stricter 32 MiB cumulative cache allowance; actual intake capacity must be reviewed first.

Actual Missions entry/Back and backup export feedback are the affected journeys. Test the visible opener and status/escape actions, not hidden handlers; distinguish player-opened and automatic dialogs. Keep manual smoke observations separate from full navigation coverage. Preserve the previous release and root-owned archive browser acceptance. No physical controller/touch, audible listening, offline/server-stopped, Team, BFCache, durable migration or full P03/P05/P18 claim follows from this prepared audit.
