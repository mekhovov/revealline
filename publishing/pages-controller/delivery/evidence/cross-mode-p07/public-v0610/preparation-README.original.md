# v0.61.0 public audit — prepared, deployment unbound

The audit targets source `fc2c7af6b22c703cc3bb2c081579878b7510f667`, tree `bf11a670ac53a31d58b79540650229160bacd486`, and source qualification SHA `c8f3f40e34ed7e26bcfda123423ddc59e2bf01044d0ade69f9da04b6b895e191`. Root's retained release response confirms published release `391186371` and its nine assets. This does not claim that Pages has selected or deployed v0.61.0.

All **80 existing catalog records** are retained byte-exact from accepted controller `d5e131081764d7547fdfa9d749e3a73b296e19a5`. The next catalog is expected to contain **81 versions**. Existing 21 archive allocations remain, with the separately accepted Archive22 preserving v0.60.9. Its actual acceptance is retained in `source-originals/archive22-root-acceptance.json`; both referenced evidence pins were rehashed. The future publisher, run, deployment, status and receipt artifact remain null. No future authority IDs were guessed.

The original current-game manifest contains **690 files / 313,029,667 bytes**. The final complete Pages inventory must come from the successful hosted receipt, including root aliases, hidden files, workers and historical bridges. A frozen game manifest alone cannot establish that public inventory.

These are the accepted v0.60.9 tools with literal changes only: source/tree/version, preserved catalog hash, the selfcheck's 80-row expectation, and intentionally unbound receipt/request sentinels. The transport, observer, intake, refresh and row reviewer are byte-identical. Seven Python modules retain identical AST structure after literal normalization. Original helper bodies and diffs are preserved. Nine mock wrapper tests, the Node20 selfcheck and four capacity cases passed with **zero real network requests**.

The source-specific intake remains fail closed. After the intended Pages run succeeds, root binds its actual merged controller/tree/run to the existing observer:

```text
python3 -B observe-hosted.failure-retention.py before-1 ACTUAL_CONTROLLER ACTUAL_TREE ACTUAL_PAGES_RUN
```

Keep every terminal API response and derive the proposed intake request from those originals. Root reviews the descriptor and request before one bounded `frozen-pages-receipts` download. Then substitute only the real receipt artifact ID and reviewed request SHA in the prepared capacity adapter, retaining the prepared body and diff. The 32 MiB cumulative cache budget, 512 MiB reserve, 20 MiB headroom and three-expanded-copy allowance are unchanged. Do not download source TAR, distribution ZIP or the Pages body artifact locally.

The existing intake produces an unreviewed binding. Root checks the actual 81-version catalog, all 80 old records, 22 archives, original qualification and successful complete receipt before approving it. Then use:

```text
node --max-old-space-size=1024 tools/audit-main.mjs --binding ROOT_REVIEWED_BINDING --binding-sha EXACT_SHA --check
node --max-old-space-size=1024 tools/audit-main.mjs --binding ROOT_REVIEWED_BINDING --binding-sha EXACT_SHA --out complete-1
python3 -B review-public.py ACTUAL_CONTROLLER complete-1
python3 -B observe-hosted.failure-retention.py after-1 ACTUAL_CONTROLLER ACTUAL_TREE ACTUAL_PAGES_RUN
python3 -B refresh-after-http.py ROOT_REVIEWED_REFRESH_REQUEST EXACT_SHA
```

The row reviewer expects an exact ordinary copy of the approved binding at `binding.json`; retain that copy's pin and provenance if its reviewed source uses another name. Preserve all execution times, exits, stdout/stderr and failed attempts. The unchanged engine uses eight workers, 300-second requests and at most three attempts for transient failures; it streams bodies without storing them. Its 20,000-row and 950,000,000-byte limits remain unchanged. No actual HTTP audit or observer was executed during this preparation.

Separate acceptance gates remain for public byte reconciliation, actual player journeys, physical controllers/touch, listening, offline recovery and the complete phase. The immediate player-visible target is Solo result continuation; passing this audit does not close all P07 rewards work.
