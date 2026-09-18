# v0.60.9 public audit — prepared, actual deployment not yet bound

This is the literal-only successor of the accepted v0.60.8 audit in `.cache/p03-missions-public-audit-a7fd646e`. It targets exact source `628e95daf403082768cdcf900a8ea1d1ef4629a2`, tree `304acdf23c8ef9c465e61e8338b43a69aebfdca5`. The committed publisher candidate is `f6cfe83b7b811a4960648fc135207baab6e77543`, tree `4252be1dbbb867e335f99468655bde56d5efe196`; that is not a guessed merged controller or deployment identity.

The exact 79-row predecessor catalog is retained from publisher base `82cfc869c6f4b6fa224cf6378fb8e189368b02e9`. All those authorities must remain intact in the intended 80-version catalog. The candidate has 21 admitted archives, with Archive21 now retaining v0.60.7 and v0.60.8. The original current-game manifest has **690 files /313,017,200 bytes**. That is not the final assembled Pages inventory: the successful hosted receipt must supply that complete inventory, including aliases, hidden files, workers and historical bridges.

`originals/` preserves all eleven prior helper/template bodies plus their original provenance record. Changes are limited to version, source/tree, retained-catalog hash, selfcheck count79, and explicitly unbound receipt artifact/request hash sentinels in the existing capacity adapter. Five operational helpers are byte-identical: original intake, after-HTTP refresh, observer, row reviewer and streaming transport. All seven Python helpers keep their AST structure after literal normalization. Neither the source nor publisher worktree is edited by this preparation.

**Nine Python wrapper tests, the Node20 selfcheck and four capacity checks passed without real network requests.** The first Node check was started before its provenance record had been written and refused with ENOENT; the actual upstream hash record was then created and the unchanged check passed. Both outcomes remain in `checks/`. Tests cover explicit approval/identity refusal, incomplete or changed observation, original member validation, corrupt download retention, failed metadata intake, incomplete/stale HTTP refusal, asset drift, hash/size/MIME/redirect refusals and bounded transient retry.

`intake-request.pending.json` intentionally has `reviewed:false` and null merged controller/run/deployment/status/receipt authorities. No actual deployment IDs, production binding, audit result or public acceptance are fabricated. Root must supply and review the successful intended Pages run before the first observer/receipt intake. Only the small existing two-member `frozen-pages-receipts` original may be downloaded; the Pages artifact, original source TAR and distribution ZIP are excluded.

After root reviews the actual observation and receipt descriptor, bind the capacity adapter's two sentinel literals to the actual receipt ID and reviewed intake-request SHA, preserving its prepared body and diff. The unchanged intake uses this runner to check compressed receipt identity, central-directory expansion and reserve before extraction. Keep the **32 MiB cumulative cache budget** and **512 MiB free reserve**, including prior preparations, originals and reports. The adapter conservatively allows three copies of the expanded receipt plus20MiBheadroom. Its limits cannot be silently relaxed.

Intake produces an **unreviewed** binding. Root independently checks all originals, actual 80-version catalog, 79 retained records,21admissions, qualification, source identities and complete hosted inventory before approving it. The existing row-review helper uses `binding.json`; if needed, retain an exact ordinary byte copy of the reviewed binding at that locator, with a receipt explaining its identical SHA. That copy is not a second approval.

Commands remain templates until actual authorities are available:

```text
python3 -B observe-hosted.failure-retention.py before-1 ACTUAL_MERGED_CONTROLLER ACTUAL_TREE ACTUAL_PAGES_RUN
python3 -B run-capacity-bounded-intake.py
node --max-old-space-size=1024 tools/audit-main.mjs --binding ROOT_REVIEWED_BINDING --binding-sha EXACT_SHA --check
node --max-old-space-size=1024 tools/audit-main.mjs --binding ROOT_REVIEWED_BINDING --binding-sha EXACT_SHA --out complete-1
python3 -B review-public.py ACTUAL_MERGED_CONTROLLER complete-1
python3 -B observe-hosted.failure-retention.py after-1 ACTUAL_MERGED_CONTROLLER ACTUAL_TREE ACTUAL_PAGES_RUN
python3 -B refresh-after-http.py ROOT_REVIEWED_REFRESH_REQUEST EXACT_SHA
```

Retain all command times/exits, failures and original stdout/stderr. Execute one full audit; preserve each attempt. The unchanged engine allows20,000rows/950,000,000bytes,eightworkers,300-secondrequests and at most three attempts for transient failures only. Bodies are streamed and never retained. Before/after API authority checks and final Latest/tag/nineasset/source/deployment refresh remain required. Public bytes, actual player navigation, physical controllers/touch, audible/offline tests and whole-phase acceptance remain separate evidence categories.
