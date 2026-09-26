# Source preservation migration (opt-in, not production-enabled)

The accepted v0.141.5 publisher retains the legacy contract. The v0.141.6
candidate introduces dual readers before a future manifest-format canary; it does
not restart, retag, replace assets, or change the default qualification writer.

## Contracts

- Legacy `release.json` formatVersion 1 retains `sourceArchiveSha256` and
  `source.tar`. Existing releases remain readable and immutable.
- FormatVersion 2 replaces those with `sourceTree`, `sourceUrl` (GitHub archive
  URL addressed by the full immutable source commit), `sourceManifestSha256`,
  and `source-manifest.json`. Distribution and the seven evidence assets stay
  unchanged: exactly nine release assets, never both source representations.
- The manifest is `revealline-source-manifest.v1`: source commit/tree, total byte
  length, and every tracked path with Git mode, byte length, and SHA-256. Paths
  are ordered by UTF-8 bytes. Regular, executable, and symlink blobs are checked
  directly against Git objects; symlinks are never followed. Gitlinks are refused.
- GitHub-generated archive compression bytes are not an authority. An archive
  may be used to obtain source, but contents and modes must match the manifest.
  Commit-plus-manifest preservation still depends on the repository retaining
  its immutable Git objects; it is not a separate offline source backup.

## Opt-in shadow command

After the consumers are reviewed, use an isolated, clean, full checkout of the
completed release's exact commit. One publisher owns this resource-intensive
operation. Import the reviewed writer or invoke it with the exact source tree;
do not execute an unreviewed branch with publication credentials.

```sh
node scripts/game-cli.mjs release-snapshot --ref FULL_COMMIT --version vX.Y.Z --source-format manifest
```

The default remains `--source-format tar`. A manifest snapshot rejects a dirty
or different-commit checkout. The production qualification workflow deliberately
does not pass the new flag yet. Independent inspection reads either contract;
evidence assembly, Pages metadata validation, normal publication and guarded
emergency uploads also accept either. Missing, mixed, duplicate, or mismatched
assets fail closed. Matching uploaded originals are retained on resume.

## Required rollout receipts

1. Preserve accepted v0.141.5 on its original contract; review and qualify the
   exact v0.141.6 candidate head against that immutable predecessor.
2. Run a completed-release shadow build under the sole publisher. Compare its
   distribution bytes and manifest against the original frozen distribution.
   Local miniature-fixture parity is not a substitute for this receipt.
3. Inspect the actual Git-backed source manifest, including all file contents and
   modes. Independently assemble and validate the seven evidence assets.
4. Exercise fault recovery at qualification, inspection, evidence, tag/draft,
   each asset upload, publication, archive admission, selector and deployment.
   Unit-tested asset-boundary recovery is not whole-chain recovery evidence.
5. In a reviewed follow-up, enable the explicit manifest writer only for a new
   canary version; do not rewrite a historical or already-frozen release.
6. Keep archive admission, exact public-byte audit and bounded EN/UK Solo,
   Versus and Team journeys blocking. Record timings and bytes transferred.
7. Evaluate the performance targets after two successful public canaries.

Rollback means selecting the legacy writer for the next new version. Never
downgrade or replace an existing formatVersion 2 release's assets. Keep dual
readers indefinitely while either contract is retained.

## Verification recorded for this change

Focused tests cover deterministic Git manifests, missing/additional/changed
entries, executable and symlink modes, mixed contracts, legacy and manifest
inspection, fresh evidence consumers, identical miniature distributions,
streaming uploads and recovery at each original-asset boundary. Long source
suites remain waived, not passed. Live shadow/canary and whole-chain interruption
receipts are still required; no measured production speedup is claimed yet.
