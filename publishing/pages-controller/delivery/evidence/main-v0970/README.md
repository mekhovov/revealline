# Main v0.97.0 delivery evidence

The complete deployed inventory passed its public HTTP audit on 2026-09-24 at 06:17:40 UTC. All 4,271 files and 625,227,678 bytes matched the admitted inventory. There were zero failed attempts, retries, skipped files or redirected final URLs. No response payload files were persisted.

The source is v0.97.0 at 1518e15e248b59c6470cc6931023eaf6f1ac363c (tree c618b5d01fd0742a5dfc8c55c9d851d1d21d58e8). Controller ca3f3fd638e02e1907a0811d7759d24ba8f726b6 was published by run 35962558115, deployment 6631370106, successful status 18767390016.

- [Complete report](http/http-20260924T061200Z-494edbf9/http-report.json), [every final row](http/http-20260924T061200Z-494edbf9/http-results.jsonl), and [every attempt](http/http-20260924T061200Z-494edbf9/http-attempts.jsonl).
- [Final GitHub authority check](final-authority/report.json): fresh API originals confirmed the same main, successful workflow/jobs, deployment/status, receipt artifact and latest Pages deployment at 06:18:18 UTC. The audit and this final check took 377.954 seconds, within the 1,800-second deadline.
- [Reviewed execution request](execution-request.reviewed.json) and [exact admitted original authorities](authority/).
- [Final release/tag reconciliation](final-release/report.json): all nine immutable release asset descriptors remain unchanged. The original comparison response is preserved as [comparison-original.json](final-release/comparison-original.json); the raw report retains its historical preparation path.
- [Separate native-browser observation](native-observation.json). It is a bounded browser observation, not physical-device, touch or controller certification.
- [Helper tests](helper-tests-first.txt), [origins](helper-origins.json) and [post-audit held-input readiness](post-audit-held-binding-readiness.json). The readiness command performs no network requests and does not replace the completed HTTP audit.
- [Evidence manifest](evidence-manifest.json) lists every preserved byte and explicit exclusions.

PREPARATION.md, candidate-preflight.json, actual-binding-summary.json, helper-preparation.json and the pending-template refusal preserve their historical preparation states. Their NOT_RUN/review-pending labels describe that earlier stage; the actual reviewed request, completed report and fresh authority check above establish execution.

This evidence establishes delivered byte/URL/MIME integrity and exact publication authority. It does not claim a full game test-suite pass, complete gameplay qualification, offline readiness, listening checks or hardware certification. The inherited v0.97 game test waiver remains separate from the successful publisher infrastructure checks. The unfinished v0.98 UX0 source is not this deployed game.

The tools retain strict source/authority checks. Re-execution needs the exact small Git commit/tree and publication/catalog objects described in PREPARATION.md; the temporary local Git object store is deliberately excluded from the evidence commit.
