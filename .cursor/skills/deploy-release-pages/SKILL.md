---
name: deploy-release-pages
description: Deploy and verify a tagged RevealLine GitHub Release on GitHub Pages. Use when the user asks to publish, redeploy, live-test, or troubleshoot a RevealLine release on Pages.
disable-model-invocation: true
---

# Deploy a RevealLine release to GitHub Pages

## Procedure

For the current redesign, consult the [cross-mode execution register](../../../docs/cross-mode-execution.md) and [phase prompts](../../../authoring/prompts/cross-mode-delivery.md). Each phase/campaign needs a new exact-source receipt and public acceptance before advancement. Keep its game source, publishing revision, asset-byte evidence, input/viewports and outstanding physical checks separate. A source-only inventory or an earlier candidate's passing run does not qualify the current release.

For releases that change asynchronous screens, also follow the [loading contract](../../../docs/presentation-loading.md). Include the current A01–A56 coverage, delayed/cached/failure/cancellation evidence, and visible status/escape actions on phone portrait and short landscape. Verify offline progress against the deployed worker and build identity; Stop waiting detaches an observer and must not be reported as cancelling shared installation. Preserve initial failed observations alongside corrected retests.

Exercise offline feedback with the full shipped optional-pack catalogue. Its names and installation explanation belong in details; they must not expand each progress label and displace the count or Stop action. If a public check exposes this defect, retain the release and failed screenshot, publish a new patch, and verify the corrected public layout before phase acceptance.

1. Confirm the requested immutable tag and published stable GitHub Release exist. Do not infer a release from an unreleased package version or move an existing tag. When publishing the newest intended stable release, explicitly set `make_latest: "true"` and read `GET /repos/mekhovov/revealline/releases/latest` back to confirm the exact release ID and tag. GitHub's Latest pointer is separate from the reviewed Pages selector. If it is stale, first reverify the existing release, tag and nine asset descriptors, then update only that release's `make_latest` field and verify again; preserve the original attempt and all immutable payloads.
2. Read `publishing/pages-controller/publication.json` on `main`. The enabled reviewed selector must name the newest published stable version, its exact six-gate source qualification, and admitted archive routes. `/game/` and the root entry must always follow that selector; never point the player default at a development tag.
3. Keep every immutable semantic tag visible in the `/releases/` explorer. Historical tags use their admitted archive route. A newly deployed but still comparison-only archive may use an explicit `testingRoutes` entry: it is playable from the explorer but cannot become the root default. Raw branch heads are mutable and must first be frozen as a semantic tag before being offered as a playable version.
4. Run `node publishing/pages-controller/sync-release-metadata.mjs --versions <comma-separated-tags> --qualification <current-tag>` to download and pin the original release record, manifest, checksum and selected source qualification. Review the resulting catalog/metadata diff; the script is a preparation tool and must not run during deployment. It preflights the whole requested batch and qualification, verifies the record/manifest/ZIP-checksum chain, refuses changes to existing pins or files, and preserves a byte-identical no-op. Keep its stale-input, ordinary-path and no-clobber guards; do not bypass a refusal or rewrite a prior release.
5. Prepare and review all original metadata, qualification, archive byte/browser evidence, testing routes, and selector changes before committing the publishing controller. The selection commit triggers `publish-frozen-pages.yml` on `main`. Keep controller identity separate from the immutable game source and use its original ZIP; do not rebuild or amend historical releases.
6. For a retry, dispatch `publish-frozen-pages.yml` from `main` with the exact `release_tag`. The legacy `deploy-pages.yml` manual entry on `main` routes to the same publisher. Historical tags retain historical workflow files, so do not assume their release event can execute the current controller or test sharder.
7. Verify the focused controller checks, bounded ZIP extraction, complete artifact byte reread, latest-stable guard, Pages upload, and protected deployment all pass. New game source still requires the six source gates; source pull requests retain preflight and four test shards.
8. Keep source and test automation distinct. Source check jobs place the selected checkout under `source/` and use the separate `automation/` runner pinned to `github.workflow_sha`, invoked with `--root .` from `source/`. Never copy newer tests into an immutable source. Initialize only generated `.cache` state.
9. Confirm `https://mekhovov.github.io/revealline/release.json` reports the selected version and exact frozen source revision. Audit every public byte, check the release registry contains every semantic tag, and test actual current play/offline plus routed historical/comparison entries before claiming completion. Keep installed-scope checks separate from fresh navigation.

## Safety rules

- Only `publish-frozen-pages.yml` on `main` deploys; preserve the main-only Pages environment policy and non-cancelling publication concurrency.
- Preserve immutable source archives, ZIPs, manifests, tags, and historical `/releases/<version>/` routes. Keep the existing 950 MB main and 800 MB archive budgets.
- Never execute a current-only source helper from a historical tag. Use the release's accepted exact-source qualification and original bytes.
- A queued or in-progress run, PR preview, or uploaded artifact is not a completed public deployment.

If a historical source check lacks a sharding helper or generated cache directory, fix the workflow/runner instead of rewriting the tag. Focused runner tests cover discovery, imports, working directory and exit propagation; they do not establish hosted qualification or a public deployment.

## Scoped feature delivery

A named feature release inside an unfinished phase still needs exact-source qualification, original frozen assets, the reviewed publication selector and actual public verification. Keep the parent phase implementing until its own complete gate passes; internal work-package IDs do not become accepted phases merely because their code ships. List tested input methods and viewports separately from outstanding physical hardware and actual foreground-loss/return checks.

When browser screenshots are available only inline, identify that limitation and the observer. Retain actual source/HTTP records and written observations without inventing exported images or their hashes. Such evidence does not close raw-image, physical-device or full-phase acceptance. Preserve unsupported/failed attempts and verify the final public source independently.

Before choosing an affected public journey, inspect the complete original frozen
manifest and retain the full positive path/byte/hash entries. Paths are relative
to the artifact root: do not assume a `site/` prefix or infer exclusion from a
failed prefix search. Match those entries to the actual hosted inventory and
public route. Enemy Workshop is shipped at `authoring/enemy-catalog/index.html`
and `authoring/enemy-catalog/workshop.mjs`; it requires an affected public check.
Source-preview observations remain separate from actual deployed verification.
If a previous packaging statement was wrong, preserve its original record and
add a dated explicit correction to current summaries and qualification prose. For shipped About or reward dialogs, check that closing or
Back restores visible focus to a logical opener and that content leaves Back
visible. Follow [Xbox navigation guidance](https://learn.microsoft.com/en-us/xbox/accessibility/xbox-accessibility-guidelines/112)
and the [W3C modal-dialog pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/).
Keep digital controller input checks separate from physical hardware acceptance.

If main advances after a successful Pages run, preserve the resulting authority
mismatch. Do not relax the current-main comparison or substitute a new commit in
old receipts. Review the unchanged frozen selector and explicitly authorize a new
workflow run on the actual main revision; retain both deployment records and
verify the final public binding before acceptance.

## Example publishing prompt

“Publish the exact qualified frozen release selected on main. Preserve every immutable source/tag/asset pin, the complete semantic release explorer and direct archive routes. Keep comparison-only testing routes distinct from full byte/browser admissions and the stable root default. Verify original ZIP and all output/public bytes, latest stable selection, GitHub Latest ID/tag readback and actual current play/offline; keep failed attempts and successful retries in the evidence.”

## Snapshot and integration checks

For a bounded linked-worktree preparation, configure sparse checkout explicitly
with `git -C <worktree> config --worktree core.sparseCheckout true`. Inspect both
`--show-origin --get-all core.sparseCheckout` and the selected worktree's value
before `read-tree`, checkout or hydration: a per-worktree `false` overrides a
common `true`. Never change common repository configuration for a local sparse
selection. Capture the selected paths and estimated bytes, the current source
and index identity, and fresh free space before hydration. Apply the managed
byte limit and reserve afterward as well. If unintended hydration occurs, stop
and retain the failure; recover only the newly created clean worktree to its
reviewed sparse paths. Do not reset, stash or remove files from other worktrees,
and do not guess a prior common-config value that was not captured.

Before appending a release to an archive, compare its workflow's explicit tag fetch
against **every** release in that archive's final `source-lock.json`, including
unchanged cohorts. Run the read-only check from the reviewed controller checkout:

```sh
node publishing/pages-controller/archive-tag-fetch.mjs --source-lock /path/to/archive/source-lock.json --workflow /path/to/archive/.github/workflows/deploy.yml
node --test publishing/pages-controller/archive-tag-fetch.test.mjs
```

The supported archive template uses a direct `jobs/build/steps` named step with no step condition,
`working-directory: source` and a one-line `git fetch --depth=1 origin` command,
followed by `refs/tags/V:refs/tags/V` for each locked version. A checkout of the
extractor's tooling commit alone does not fetch those release tags. Missing older
or newly appended cohorts, another destination ref, forced refs, and dynamic or
conditional fetch declarations must be corrected and reviewed before dispatch.
The checker verifies declared coverage only; retain the hosted tag-object and
peeled-source checks, complete byte audit and native archive admission. Preserve
the failed first attempt if an omitted tag already caused a deployment failure.
Do not remove old cohorts, move tags, infer archive acceptance from a successful
workflow, or change the live selector while publication/retention is pending.

Before committing verification evidence, check every manifest-pinned original with `git ls-files --error-unmatch`. Repository ignore rules can omit original `.log` files even when their JSON manifest is staged. Add only those explicitly reviewed original paths with `git add -f`, then verify all recorded sizes and hashes against the index. Preserve original log/diff bytes, including whitespace; never normalize evidence to satisfy a source-format check. Run exact-source qualification only after that evidence-complete commit.

Use the selected immutable source and its own frozen builder. Follow [snapshot staging](../../../docs/snapshot-staging.md) for the rename-first source-TAR transfer; EXDEV still needs space for the temporary copy. Confirm fresh capacity and filesystem placement before building. Integration must retain the chosen main cutoff and the next release version; earlier candidate checks cannot qualify a later merge. Retire only verified generated previews, preserving the original Git/release assets and verification receipts.

When the original qualification artifact exceeds local capacity, use the [hosted artifact utility](../../../publishing/utility/README.md) on the reviewed workflow revision. Its default operation still qualifies and freezes source. Bind inspection to the actual successful run, source/tree and original artifact digest; review its original receipts before assembling qualification. The separately selected upload operation needs the exact existing tag/draft and seven reviewed small attachments, verifies both original payloads before either upload, and refuses overwrite or automatic retry. Keep hosted execution, immutable source, automation revision, local evidence review and public play distinct. An ambiguous upload needs an actual asset reread; never rebuild or regenerate the frozen payload to recover it.

A failed full source family cannot qualify a candidate even when preflight/build passed. Retain each completed shard's original logs and diagnose its actual failing assertions before rerunning. If navigation contracts changed, update obsolete fixture entry paths while preserving gameplay, save and cancellation guarantees; do not count a direct hidden handler as a visible journey. Keep sparse-input failures separate and hydrate only exact tracked dependencies. Commit the reviewed corrections and applicable guidance, then qualify that new source in full. A not-yet-published version may remain allocated; no immutable release is overwritten.

When a heavy-content wait times out, preserve its original state and actual elapsed timing before calling it a performance or logic defect. Scope any revised test allowance to the measured operation; never relax success predicates, omit failed tests or reuse an older successful shard for a new source. Browser tab selection alone does not prove a document visibility/focus transition. Retain unestablished native lifecycle checks separately from a reproduced callback race and its corrected regression.

For a release touching More worlds, verify same-chapter preservation and different-chapter Stay/Replace through all three chapter adapters. Press Stay both after verification and while its checked-save lock is pending; require immediate exact-opener availability and prevent late settlement from disturbing newer work. Keep failed-save/readback and delayed/background callback evidence separate from actual browser input observations. A passing direct `selectEntry` or installation test does not establish safe player selection.


For an ambiguous original upload, inspect the bounded `uploadDiagnostics` receipt
and fresh draft assets before proposing recovery. The completed client-send count
is not proof of server receipt; an absent HTTP status is not an HTTP failure code.
Preserve the failed attempt and never log raw exceptions, credentials, headers or
response bodies as diagnostics. Keep utility revision and frozen game identity
separate. The reviewed shared API lifetime is 5,400 seconds (90 minutes), including
inspection, both original uploads and final reconciliation, within the existing
180-minute hosted upload-job timeout. Keep the per-socket timeout at 120 seconds.
This finite allowance does not prove that an earlier failure was a timeout or
authorize another POST. Preserve all pin/asset limits and require explicit review
for any later budget change; never infer a server limit or retry from elapsed
time alone.

Standard SSL subtype names are fixed safe diagnostic labels; arbitrary subclass
names and exception text remain suppressed. Do not infer a TLS failure or its
subtype from an older `OtherError` receipt. This classification change adds no
errno field and does not change transport, timeouts, chunking, headers or upload
guards; it does not authorize another upload attempt.
