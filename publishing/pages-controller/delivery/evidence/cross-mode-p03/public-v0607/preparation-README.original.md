# v0.60.7 public audit preparation

This is the literal-only successor of accepted `.cache/p03-settings-public-audit-9c89f997`. Source `a36d62f2fc3af67e3fffcafda3656c413ca77341`, tree `eaa76580e442311e87e6761a7d442f38f8f06652`, version v0.60.7. Main baseline 79b94 contains 77 original catalog rows; actual publisher PR106 has 78 and the accepted Archive20 append. Actual merge is `00a043d08c235422e9dbebef82dc5e0837da6667`, tree `53f7ddda49464f68a2dfc9112b46f8b8fda3eee6`; the single automatic main-push Pages run is 35289348308. No dispatch was made.

`originals/` preserves all ten predecessor helper/template bodies; `adaptation.diff` changes only source/tree/version/catalog hash and the retained-count assertion. Five execution helpers are byte-identical: intake, refresh, failure-retaining observer, independent row reconciler and HTTP transport engine. All six Python AST structures remain identical after literal normalization. Nine wrapper mocks and the Node20 self-check passed without real network requests; original outputs and input pins are retained. The synthetic current-v0602 fixture locator remains intentionally unchanged.

`current-before/` contains exact Git catalog/configuration/allocation bytes from 79b94; `proposed-publisher/` contains the exact c0369f3f committed bodies. `source-originals/frozen-manifest.json` is the original assembled/published manifest, SHA e0ede398594f9e5907e015abcec766800fcd3c89433a6ea9e19e2c220799fc3a. It is not a fabricated inventory or source-tree hash. The actual published API response is retained unchanged in `published-release.original.json`.

## Gate sequence

The GET-only observer retains each attempt separately. A pending observation must never become the intake authority. Once a new terminal observation verifies successful run/jobs and deployment/status linkage, prepare a separate `intake-request.proposed.json` with `reviewed:false` and safe relative evidence pins. Root reviews that request's exact SHA and actual small descriptor before intake. Preserve at least 512 MiB plus the small receipt budget; never download the large Pages artifact.

From this directory, use the existing unchanged commands, retaining stdout/stderr/exit and unique output labels:

```sh
python3 -B observe-hosted.failure-retention.py UNIQUE_LABEL 00a043d08c235422e9dbebef82dc5e0837da6667 53f7ddda49464f68a2dfc9112b46f8b8fda3eee6 35289348308
python3 -B intake-live.py ABSOLUTE_ROOT_REVIEWED_REQUEST EXACT_REQUEST_SHA
```

The intake creates an unreviewed nine-authority binding. Root then checks the receipt inventory, exact source/qualification, all original catalog rows, Archive20/all other admissions and actual published descriptors. Only a separately approved binding may run:

```sh
NODE=/Users/oleksandr.mekhovov/.local/share/mise/installs/node/20.19.5/bin/node
"$NODE" --max-old-space-size=1024 tools/audit-main.mjs --binding ABSOLUTE_ROOT_REVIEWED_BINDING --binding-sha EXACT_BINDING_SHA --check
"$NODE" --max-old-space-size=1024 tools/audit-main.mjs --binding ABSOLUTE_ROOT_REVIEWED_BINDING --binding-sha EXACT_BINDING_SHA --out complete-1
python3 -B review-public.py 00a043d08c235422e9dbebef82dc5e0837da6667 complete-1
python3 -B observe-hosted.failure-retention.py after-1 00a043d08c235422e9dbebef82dc5e0837da6667 53f7ddda49464f68a2dfc9112b46f8b8fda3eee6 35289348308
python3 -B refresh-after-http.py ABSOLUTE_ROOT_REVIEWED_REFRESH_REQUEST EXACT_REQUEST_SHA
```

After-observation must follow completed HTTP proof; refresh request needs safe relative binding/report/row-review/observation/published pins and separate root review. No self-approval.

## Scope and limits

The full streamed inventory always includes all current/hidden/alias/worker/bridge rows. Existing limits remain 20,000 rows / 950,000,000 bytes, eight workers, 300-second request timeout, and at most three attempts for transient failures only. Wrong size/hash/MIME/redirect is not retried. No public body payloads are stored. Only the exact two-member receipt ZIP is allowed, below 10 MiB compressed / 64 MB expanded; API replies stay below 2 MB with 35-second timeout and retained failures.

Root owns native/browser acceptance. Suggested affected journey: enter Replay from Workshop, inspect disabled Play at completion without hover/keyboard activation, ensure enabled Restart remains identifiable/focusable, then Restart restores enabled playback; check Plain/Large reading and Return to game. `replay-route-proposal.json` pins the frozen relevant bodies; it is not browser evidence. Retained v606 Archive20 remains independently playable, with existing loss/recovery and session-only limitations preserved. No physical input, offline, audible listening, BFCache, durable migration or complete P03/P05/P18 claim follows from byte success.
