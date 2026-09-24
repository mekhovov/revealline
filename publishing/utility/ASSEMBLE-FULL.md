# Hosted full-test release evidence

This is the mandatory-test counterpart to the historical waived assembler.
It does not change the frozen game, run a qualification, make a tag or release,
upload release assets, or deploy Pages. The workflow has only `contents: read`
and `actions: read`. Its only output is a reviewable small evidence package.

## Prerequisites and identities

1. The source PR has merged and its four test shards, preflight and ordinary
   `npm run build` all succeeded. Preserve that exact PR head/run attempt.
2. Dispatch the registered `qualify-release-source.yml` at the intended immutable
   source using `operation=qualify`, `run_tests=true`, and
   `freeze_snapshot=true`. It must finish all six source gates, production
   reproduction/readiness, four test shards and freeze successfully.
3. The frozen commit is either the merged PR's reviewed head or its merge commit.
   Its complete tracked contents, file types and modes must match the PR head.
   This assembler deliberately accepts no exception list for source changes.
   If a merge introduces other content, qualify that content through a new PR
   and exact-source run; do not relabel old evidence.
4. Inspect the frozen artifact with the existing `inspect-artifact` operation.
   Supply its exact API artifact ID, run, length and SHA-256 binding. This
   existing utility downloads the large outer ZIP only on a hosted runner,
   verifies all inner bytes and retains bounded inspection evidence.
5. Independently review the PR workflow commit actually checked out as
   `automation`/`.source-gate-automation` in raw PR logs. This is often a GitHub
   merge-workflow commit and is different from the tested game source.

The new workflow file must exist on the repository default branch before manual
dispatch. Merge its small infrastructure PR through the normal review pipeline
first, then verify the selected utility branch still resolves to the reviewed
utility commit. A push on `codex/full-release-evidence` runs utility tests only;
it does not assemble or publish a real release. Existing v0.97 workflows and the
waived assembler stay unchanged.

## Reviewed dispatch binding

Pass this JSON as `assembly_binding` to `assemble-full-release-evidence.yml`.
Replace every placeholder with actual independently checked values:

```json
{
  "format": "revealline-full-qualification-inputs.v1",
  "reviewed": true,
  "repository": "mekhovov/revealline",
  "source": { "commit": "FULL_FROZEN_SHA", "tree": "FULL_FROZEN_TREE", "version": "v0.98.0" },
  "prSource": { "commit": "FULL_PR_HEAD", "tree": "FULL_PR_TREE" },
  "sourcePR": 320,
  "prRun": 1,
  "manualRun": 2,
  "inspectionRun": 3,
  "prWorkflowCommit": "FULL_ACTUAL_PR_AUTOMATION_SHA",
  "inspectionArtifact": { "id": 4, "bytes": 123, "sha256": "FULL_INSPECTION_ARTIFACT_SHA256" }
}
```

The collector reads the current completed successful run attempt, full bounded
job inventories, merged PR metadata, workflow Git objects, raw job logs and the
exact small `inspect-artifact-evidence` ZIP. Its metadata and original extracted
bytes are revalidated during offline assembly. No large source TAR or
distribution ZIP is fetched by this workflow.

The assembler requires:

- all four distinct shards in each of two distinct run families;
- actual successful gate and source-check steps, rather than invented per-command results;
- terminal TAP counters in the exact shard command output, with zero failures,
  cancellations, skips and todos, consistent case/plan counts and equal totals;
- identical complete file partitions, reconstructed with the pinned runner and
  compared with tracked Git test paths; no untracked tests may enter the proof;
- the actual PR automation checkout and before/after raw tracked-source
  identities inside their command regions;
- manual source SHA/tree output and successful unchanged-source checks;
- matching package, lockfile root package and build versions;
- the exact source's required-test policy and immutable inspection closure.

It writes `revealline-source-qualification.v1`, never a waived v2 verdict.
The unchanged consumer extracted from the frozen source validates the complete
package in a fresh subprocess before output is accepted. No mocked adapter,
synthetic result, local test count or previous release can qualify a real run.

## Publication after independent review

Download only the small `full-test-small-package` artifact. Verify its hash
receipt and every original evidence pin. The package contains these seven release
attachments:

`manifest.json`, `release.json`, `distribution.zip.sha256`,
`source-qualification.json`, `source-qualification-evidence.zip`,
`verification.json`, `qualification-evidence-record.json`.

The review receipt contains exact descriptors for those seven plus the two
large frozen originals. The evidence record binds the other eight attachments;
it does not recursively claim its own hash.

The release owner can then create the immutable tag/draft, upload the seven
reviewed small files unchanged and dispatch existing `upload-originals` with
the exact nine-descriptor binding. That utility downloads the original outer ZIP
on the runner and streams only missing original members after independent
reverification. Keep its one-POST/no-overwrite and ambiguous-upload recovery
rules. Only after nine-asset readback succeeds may the owner publish the release,
merge the Pages selector/metadata PR and use `publish-frozen-pages.yml` on main.
Public source/version/asset checks and actual play remain separate acceptance.

## Bounds and tests

Each raw job log is limited to 16 MiB. Collected and uncompressed release evidence
are limited to 64 MiB and 2,000 files; non-ZIP release metadata keeps the existing
4 MiB limit. Assembly retains a 1 GiB free-space reserve. It belongs on a hosted
runner; limited local RAM is sufficient only for bounded synthetic tests and the
final small package.

The original source TAR and distribution ZIP are not duplicated locally.
For scale, published v0.97.0 has a 1,660,620,800-byte source TAR and a
595,070,842-byte distribution ZIP. Exact v0.98 lengths come from its new freeze.
The hosted inspection/upload needs the original outer ZIP plus its existing
512 MiB reserve; Pages assembly independently requires 8 GiB free and preserves
its existing 950,000,000-byte distribution admission cap.

Run `python3 -B -m unittest discover -s publishing/utility -p 'test_*.py'`.
The new tests use tiny synthetic originals and mocked fixture Git/disk evidence,
then invoke the real unmodified consumer. Those fixtures never leave the test
process as release evidence. Negative cases cover altered identities, missing
shards, nonpassing/truncated/borrowed TAP, incorrect partitions, changed
inspection originals, missing capacity and policy mismatch.
