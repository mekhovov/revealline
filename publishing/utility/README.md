# Existing frozen artifact utility

This utility runs on a hosted runner when the original five-file qualification artifact is too large for a local checkout. It downloads and verifies the **original** outer ZIP; it never rebuilds, extracts a duplicate source TAR or distribution ZIP, creates a release, changes a tag, overwrites/deletes an asset, or publishes a draft. Public HTTP, browser, offline and phase acceptance remain separate.

The registered `qualify-release-source.yml` workflow can be dispatched at the reviewed feature-branch commit that contains this utility. Its default `qualify` operation retains the existing six source gates, four test shards and optional freeze. The utility modes skip those jobs and operate only on an already completed successful qualification/freeze run. No infrastructure-only merge or second freeze is needed.

## Review and execution order

1. Qualify and freeze the intended source using the normal workflow. Retain its actual run/artifact API metadata and original GitHub artifact SHA-256.
2. Review a binding with `release: null`, then explicitly dispatch `inspect-artifact`. This job has `contents: read` and `actions: read`. It verifies the original artifact digest, every Git source blob/type/mode and TAR commit, the original inner ZIP/hash chain and every manifest byte, plus the offline inventory's 2,000-file/64 MiB budget, worker template and entry identity. It retains bounded metadata and logs only.
3. Independently review that inspection and assemble the actual source qualification and evidence set. The utility does not replace the qualifier or create passing qualification records. Prepare the immutable version tag and an existing **draft** release through the normal reviewed release process. Upload the seven reviewed small attachments listed below, preserving their original bytes.
4. Review a second binding with the exact draft ID and all nine final descriptors. Explicitly dispatch `upload-originals` at the same reviewed utility revision. This is the only job with `contents: write`. It independently receives and fully inspects the same original artifact again, verifies all seven small assets, every evidence ZIP member and every qualification evidence pin, both four-shard families and the six actual source gates, then preflights **both** original members before either POST. It streams `source.tar` and `distribution.zip` directly from the held outer ZIP and rereads all nine API asset digests and the immutable tag.
5. Independently review the upload receipts before any separate publication. An interrupted or ambiguous POST is **not retried**. Preserve its started/result receipts and reread the exact draft asset list manually. A later utility attempt refuses preexisting source/distribution members; it cannot resume, delete or clobber them.

The artifact must remain available and unexpired through both operations. The hosted runner needs the original outer ZIP length plus 512 MiB free reserve (and bounded evidence), not expanded source/distribution copies. Metadata/evidence inputs are capped at 4 MiB per small JSON and 64 MiB for the evidence ZIP and its uncompressed originals. Requests have finite size/time bounds and no automatic retry. Only the existing GitHub API/CLI authentication path is used; credentials and temporary signed download URLs are not retained.

## Reviewed binding

Pass the actual JSON file as the `artifact_binding` string input. The schema is deliberately small and strict; unknown keys, incomplete values, abbreviated refs and duplicate JSON keys are rejected. A `reviewed: true` flag records the operator's review; it does not substitute for the actual byte/API checks or confer approval by itself.

| Field            | Required value                                                                                                                                                 |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `format`         | `revealline-release-utility-binding.v1`                                                                                                                        |
| `reviewed`       | `true`, only after the root review                                                                                                                             |
| `repository`     | Exact current GitHub `owner/repository`                                                                                                                        |
| `source`         | Object with full lowercase 40-character `commit`, full `tree`, stable `version` such as `vX.Y.Z` with actual numeric components                                |
| `artifact`       | Object with positive actual `id`, originating successful manual `runId`, exact `bytes`, lowercase 64-character `sha256` from the actual GitHub artifact digest |
| `release`        | `null` for inspection; upload requires `{id, tag, assets}` for the exact existing draft and immutable source tag                                               |
| `release.assets` | Exactly nine unique `{name, bytes, sha256}` descriptors, all measured from reviewed originals                                                                  |

The nine names are `source.tar`, `distribution.zip`, `manifest.json`, `release.json`, `distribution.zip.sha256`, `source-qualification.json`, `source-qualification-evidence.zip`, `verification.json`, and `qualification-evidence-record.json`. The last seven must already exist on the draft. The evidence record binds the other eight; its own descriptor comes from the reviewed binding. Source and distribution descriptors must bind the original archive member names as well as bytes/hashes. No future release/artifact ID is embedded in source.

After root review, verify the dispatch branch still resolves to the reviewed utility commit, then dispatch using that branch. GitHub workflow dispatch requires a branch or tag name; the actual workflow commit and qualified source remain independently pinned in the receipts:

```sh
test "$(gh api "repos/$REPOSITORY/git/ref/heads/$REVIEWED_UTILITY_BRANCH" --jq .object.sha)" = "$REVIEWED_UTILITY_COMMIT" &&
gh workflow run qualify-release-source.yml \
  --repo "$REPOSITORY" \
  --ref "$REVIEWED_UTILITY_BRANCH" \
  -f operation=inspect-artifact \
  -f artifact_binding="$(cat "$REVIEWED_INSPECTION_BINDING")"
```

For the separately approved second stage, use `operation=upload-originals` and its reviewed upload binding. These examples are instructions, not executed release operations.

## Receipts and limits

Each job uses an exclusive `utility-output` directory. Its `evidence/` contains the exact binding, original API JSON responses with request locators, original small artifact/asset bodies, before/after source identity, actual automation commit/tree/helper pins, inspection/offline logs and receipts, and a final retained-file hash manifest. The workflow uploads **only** that evidence directory. The large outer ZIP remains ephemeral runner storage and is not duplicated into a new artifact. Failure and started-upload records remain distinguishable from success.

`inspection.json` retains the previously reviewed inspector schema and wording: “local” means the process inspecting a local runner file. The enclosing utility execution receipt identifies the actual hosted workflow/source checkouts. It does not claim the developer machine ran a build or full tests. The evidence ZIP verification checks archived original bytes and their qualification pins; the preceding independent evidence assembly still owns rereading its original source files before packaging.

The qualification adapter expects the reviewed hosted-source schema already used by this repository: six completed successful command gates, two distinct four-shard families with equal actual TAP totals and no failures/cancellations/skips/todos, an actual successful ordinary-build step, frozen-original corroboration, and all referenced evidence pins. Existing qualification generation/review remains authoritative for raw source identities, exact test partitions, production readiness and automation attribution; the original evidence for those checks must remain in the pinned evidence ZIP.

Run the bounded local checks without credentials or external requests:

```sh
python3 -m unittest discover -s publishing/utility -p 'test_*.py'
```

These use tiny local Git/TAR/ZIP fixtures, mocked metadata/orchestration and loopback HTTP servers for the preserved upload engines. They do not qualify a real artifact or perform a GitHub write. `provenance.json` records the original reviewed engines, which remain byte-identical; only the offline verifier's input binding and receipt locators were made portable.
