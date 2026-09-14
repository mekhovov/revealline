# Hosted immutable freeze artifacts

This temporary infrastructure branch freezes three already qualified sources when local disk cannot hold the build and all historical distributions. It does not change those source commits, create tags or releases, or deploy Pages. The dedicated push trigger is outside source qualification and publication branch patterns.

`sources.json` pins each exact commit, tree, Node version, full six-gate qualification, and its complete hosted receipt. `freeze.py` validates these records, rechecks the original successful source run and all five original job-log hashes through GitHub, checks out the exact source, and invokes that source's original exported `releaseSnapshot` function. It requires at least 8 GiB free. No npm installation, test substitution, changed compiler, or modified candidate files are involved.

The independent verifier compares a fresh Git TAR hash, every original Git blob and executable mode, every loose manifest body, every ZIP member, and all ZIP CRCs. Failed work cannot produce a passing integrity receipt. Each version has separate metadata, source TAR, and distribution ZIP artifacts with 90-day retention. Metadata contains the exact original build marker and checksum, separate source/controller identities, and the retained qualification and freeze evidence.

Artifacts are temporary retention, not final publication. Before creating a tag or GitHub release, independently verify each downloaded artifact digest, stream its original TAR against Git without extracting the source, and check its original ZIP and metadata. Keep the hosted loose-file proof distinct from the local ZIP proof. Permanent GitHub release assets must contain those exact original bodies and be checked against their stored SHA256 digests before publishing. Pages and actual public gameplay/offline acceptance remain separate gates.

Run the bounded fixture checks with `python3 publishing/qualified-freeze/test-freeze.py` and `python3 publishing/qualified-freeze/test-integrity.py`.
