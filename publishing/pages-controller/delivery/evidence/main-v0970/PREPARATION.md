# v0.97.0 main Pages audit preparation

This is a prepared, peer-reviewed reuse of the v0.82.1 main-site authority and HTTP auditors. No public audit or deployment has run from this directory. The execution request remains reviewed:false with all future publication identities unresolved.

Frozen game: v0.97.0, source 1518e15e248b59c6470cc6931023eaf6f1ac363c, tree c618b5d01fd0742a5dfc8c55c9d851d1d21d58e8. The three original metadata inputs are exact hash-pinned bytes. helper-origins.json records the main auditor donor. The metadata writer and final-authority deadline check come from the separately reviewed Archive66 auditor.

## Evidence already available

- 38 offline tests passed, including authority mismatch, preview refusal, canonical-byte closure, HTTP status/final URL, redirects, MIME, size/hash, retries and deadlines.
- Exact full-record metadata boundary, overflow, short write, ENOSPC and inventory-capacity cases pass.
- --prepare succeeds with zero network requests.
- The pending request is rejected as Actual reviewed request required.
- All 4,242 rows in the v0.96.0 PR337 preview and all 1,113 v0.97 canonical manifest entries fit the inherited path/MIME policy. The preview is sizing evidence only.

## Root publisher handoff

After the new selector's actual main workflow and Pages deployment finish successfully:

1. Pin the actual main commit/tree, successful main Publish selected frozen game run, both successful jobs, Pages deployment and latest successful deployment status. Preserve the exact raw API originals under authority/.
2. Download only the new run's frozen-pages-receipts Actions ZIP. Verify its actual API ID, byte count and SHA-256; retain the raw artifact inventory and ZIP. Never reuse the PR337 preview as authority.
3. Preserve the exact committed publication.json and catalog.json bytes. Populate the ordinary local repository/ with the two exact Git commits/trees and these two small blobs. No source or distribution payload download is needed. Binding checks disable lazy fetch and do not acquire missing objects automatically.
4. Derive the full file inventory only from the actual publishable artifact-receipt.json. The request inventory digest is SHA-256 of the UTF-8, two-space-indented JSON envelope containing base https://mekhovov.github.io/revealline/ and files receipt.files, followed by one newline. Retain row order. Verify all original v0.97 canonical members against the immutable manifest.
5. Fill every explicit request field and raw authority pin. Mark reviewed:true only after independent review. The unchanged admission checks reject PR runs, skipped deploy steps, wrong source/commit/tree, missing canonical files, unexpected ZIP members and mismatched descriptors.
6. Run python3 -B tools/http_audit.py without --run first. It must report READY with zero requests and the exact finite file/byte counts. Root must pin and approve this binding before public execution.
7. Reserve an exclusive audit window with at least **60 MiB free** on this metadata volume, then run python3 -B tools/http_audit.py --run. No payload is persisted; bodies are hashed as streams. Keep the original logs and every failed retry. Nothing in preparation authorizes this future dispatch.
8. Reconcile current remote main/run/deployment authorities again after the audit, alongside the auditor's held-input/helper revalidation. Browser play, offline readiness, listening and physical devices remain distinct evidence.

## Capacity contract

The reviewed maximum is 4,608 inventory files, 2 KiB per complete attempt/result record, 14 MiB for the final report and 4 MiB for all setup/authority snapshots. Three attempts plus one final row per file yield a 54 MiB worst-case persisted allocation, below the 56 MiB hard cap and 60 MiB free-space requirement.

Records are never truncated. Oversized headers/errors, excess inventory/setup/report metadata, short writes or full storage cause a visible failure before a PASS can be recorded. Every output write passes the same budget. A larger inventory or record format needs another review; do not raise a bound during an audit. Root coordinates space with other RAM users; do not remove another owner's files.

Transport behavior remains four workers, at most three attempts per file, 25-second socket inactivity timeout, 90-second per-attempt deadline, and 1,800-second overall deadline. Redirects, altered final URLs, encoded bodies, mismatched Content-Length, wrong MIME or mismatched bytes/hashes fail. Acceptance is checked before/after body reads, response close and final authority validation. Blocking transport can overrun wall time; an expired completion is never accepted.
