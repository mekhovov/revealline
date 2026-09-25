# Offline waived qualification assembly

This adapter produces seven small attachments and descriptors for all nine release assets. It does not download or copy the original source TAR/distribution ZIP, upload anything, publish a release, or authorize publication. Tests are explicitly `waived`, never reported passed. Operator-provided GitHub API originals are evidence, not cryptographic authentication.

Run from the reviewed utility checkout:

```sh
python3 -B publishing/utility/assemble_waived_qualification.py /absolute/inputs.json --output /absolute/fresh-small-package
```

Example input shape (replace every placeholder with independently reviewed actual values):

```json
{
  "format": "revealline-waived-qualification-inputs.v1",
  "reviewed": true,
  "repository": "mekhovov/revealline",
  "repositoryPath": "/absolute/read-only-git-repository",
  "source": {
    "commit": "FULL_40_HEX_MERGED_SOURCE",
    "tree": "FULL_40_HEX_TREE",
    "version": "v0.84.0"
  },
  "prSource": { "commit": "FULL_40_HEX_PR_HEAD", "tree": "FULL_40_HEX_PR_TREE" },
  "sourcePR": 123,
  "approvedNonSourceChanges": [],
  "pr": { "run": "/absolute/pr/run.json", "jobs": "/absolute/pr/jobs.json" },
  "manual": { "run": "/absolute/qualify/run.json", "jobs": "/absolute/qualify/jobs.json" },
  "inspection": { "run": "/absolute/inspect/run.json", "jobs": "/absolute/inspect/jobs.json" },
  "inspectionDirectory": "/absolute/completed-retained-inspection",
  "extraEvidence": [{ "name": "logs/source-job.txt", "path": "/absolute/retained-source-job.txt" }]
}
```

The frozen source must already contain the v2 `release_artifact.py` consumer and the explicit waived policy. The adapter reads those immutable Git objects and executes that consumer in a fresh temporary directory. Historical v1 consumers and missing/malformed policies refuse; they are never silently upgraded. The assembler itself need not be in that source commit. No checkout or branch is changed.

The PR and manual runs must be distinct completed successful runs, with full unpaginated jobs inventories. PR `head_sha` must equal the supplied PR source, and manual `head_sha` must equal the frozen source. The manual run must have successful qualify/freeze jobs and one skipped `test` job or four skipped `test (N)` jobs. Mandatory actual gate, production-ledger, source-identity, freeze, retained-assets, exact PR validation, and explicit PR artifact-deferral steps must be successful. The full artifact is then built once from frozen merged source and independently inspected. Source verdicts are not borrowed from predecessors. If a PR workflow reports a synthetic merge SHA instead of the supplied source, the adapter refuses; collect appropriately bound source evidence rather than relabeling the run.

PR-to-frozen differences must be an exact sorted allowlist confined to `docs/` or `publishing/pages-controller/`; utility, policy, workflow, runtime, package, and build-input differences refuse. Identical trees are supported: the source-equivalence record retains the empty diff's hash/size without creating a zero-byte evidence pin.

`inspectionDirectory` is the complete retained `inspect-artifact` evidence closure from the guarded utility, including `retained-manifest.json`, binding/result, exact frozen metadata, offline review and originals, source-before/after, execution/helper pins and raw artifact API authority. Its retained manifest uses the existing `/utility-output/evidence/` path convention. Every file must be present with no extras and matching hashes. Exact inspection workflow Git objects must remain available locally.

Total originals are bounded to 64 MiB/2,000 files; symlinks and changing or special input files refuse. At least 1 GiB free remains reserved. Output and sibling `-review.json` must be absent. Seven files are written exclusively only after the exact-source consumer accepts the package; an interrupted final write can leave a partial fresh directory, which must be retained and inspected, not reused or overwritten.

The focused test fixture exercises the full adapter and fresh consumer subprocess with synthetic source-object reads and tiny retained originals. It is not real release evidence. Hosted source qualification/freeze/inspection, independent package review, guarded uploads, Pages selection, and public/browser acceptance are still required.
