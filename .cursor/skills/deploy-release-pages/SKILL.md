---
name: deploy-release-pages
description: Deploy and verify a tagged RevealLine GitHub Release on GitHub Pages. Use when the user asks to publish, redeploy, live-test, or troubleshoot a RevealLine release on Pages.
disable-model-invocation: true
---

# Deploy a RevealLine release to GitHub Pages

## Current hosting policy — 2026-09-27

Future releases use only `mekhovov/revealline`. Do not create, allocate, append, deploy or admit a `revealline-archive-XX` repository as a release step. Historical archive deployment and per-PR publication are not prerequisites.

Publish the exact qualified current game on the main Pages site and keep original immutable ZIPs, manifests, checksums and source evidence in the main repository's GitHub Releases. Unarchived historical editions become explicitly download-only, not broken Play links. Existing accepted archive links, repositories, tags, assets, saved data and evidence remain unchanged; their frozen registry is compatibility history, not a recurring remote-admission gate. Do not delete or republish them.

Keep current-source qualification, reviewed selector, protected-main checks, frozen independent inspection, bounded extraction, full artifact/public-byte verification, latest-release validation and scoped player acceptance. Preserve explicit test waivers as SKIPPED. The main Pages budget remains 950,000,000 bytes; exceeding it requires a new reviewed decision, not another repository or a raised limit. See [main-repository publishing policy](../../../docs/main-repository-publishing.md).

## Procedure

For the current redesign, consult the [cross-mode execution register](../../../docs/cross-mode-execution.md) and [phase prompts](../../../authoring/prompts/cross-mode-delivery.md). Each phase/campaign needs a new exact-source receipt and public acceptance before advancement. Keep its game source, publishing revision, asset-byte evidence, input/viewports and outstanding physical checks separate. A source-only inventory or an earlier candidate's passing run does not qualify the current release.

For releases that change asynchronous screens, also follow the [loading contract](../../../docs/presentation-loading.md). Include the current A01–A56 coverage, delayed/cached/failure/cancellation evidence, and visible status/escape actions on phone portrait and short landscape. Verify offline progress against the deployed worker and build identity; Stop waiting detaches an observer and must not be reported as cancelling shared installation. Preserve initial failed observations alongside corrected retests.

Exercise offline feedback with the full shipped optional-pack catalogue. Its names and installation explanation belong in details; they must not expand each progress label and displace the count or Stop action. If a public check exposes this defect, retain the release and failed screenshot, publish a new patch, and verify the corrected public layout before phase acceptance.

1. Confirm the requested immutable tag and published stable GitHub Release exist. Do not infer a release from an unreleased package version or move an existing tag. When publishing the newest intended stable release, explicitly set `make_latest: "true"` and read `GET /repos/mekhovov/revealline/releases/latest` back to confirm the exact release ID and tag. GitHub's Latest pointer is separate from the reviewed Pages selector. If it is stale, first reverify the existing release, tag and nine asset descriptors, then update only that release's `make_latest` field and verify again; preserve the original attempt and all immutable payloads.
   Publishing a draft may change `browser_download_url` from an untagged draft URL to the canonical versioned release URL. Compare each asset's exact ID, name, size, digest and uploaded state, then require its new canonical URL. Do not require whole asset-object equality or repeat a successful publication PATCH because the URL changed. Preserve the original overbroad comparison refusal and the successful readback; payload identity remains separate from mutable URL metadata.
   A draft release lookup by tag can return 404 even after creation. Preserve that response and use the actual release ID from the successful create response or an authenticated release listing: `GET /repos/<owner>/<repo>/releases/<release_id>`. Verify its tag, draft state, target and existing asset descriptors before continuing. Do not infer that the draft is absent, create a duplicate release, or repeat an upload because the tag lookup failed. After publication, verify the canonical tag route separately.
2. Read `publishing/pages-controller/publication.json` on `main`. The enabled reviewed selector must name the newest published stable version, its exact source qualification (including honest explicit waivers), and main-repository-only hosting policy. `/game/` and the root entry must always follow that selector; never point the player default at a development tag.
3. Keep the reviewed `retainedReleaseCount: 5` global history selection. The current edition is playable on main Pages; unarchived historical editions are download-only from the main GitHub Releases. Preserve accepted legacy archive links and all immutable historical metadata, tags, releases, assets and evidence. Never allocate or admit another archive to advance the selector. Raw branch heads are not immutable releases.
4. Run `node publishing/pages-controller/sync-release-metadata.mjs --versions <comma-separated-tags> --qualification <current-tag>` to download and pin the original release record, manifest, checksum and selected source qualification. Review the resulting catalog/metadata diff; the script is a preparation tool and must not run during deployment. It preflights the whole requested batch and qualification, verifies the record/manifest/ZIP-checksum chain, refuses changes to existing pins or files, and preserves a byte-identical no-op. Keep its stale-input, ordinary-path and no-clobber guards; do not bypass a refusal or rewrite a prior release.
5. Prepare and review all original metadata, current qualification, frozen-artifact evidence, and selector changes before committing the publishing controller. The selection commit triggers `publish-frozen-pages.yml` on `main`. Keep controller identity separate from the immutable game source and use its original ZIP; do not rebuild or amend historical releases.
6. For a retry, dispatch `publish-frozen-pages.yml` from `main` with the exact `release_tag`. The legacy `deploy-pages.yml` manual entry on `main` routes to the same publisher. Historical tags retain historical workflow files, so do not assume their release event can execute the current controller or test sharder.
7. Verify the focused controller checks, bounded ZIP extraction, complete artifact byte reread, latest-stable guard, Pages upload, and protected deployment all pass. New game source still requires the six source gates; source pull requests retain preflight and four test shards.
8. Keep source and test automation distinct. Source check jobs place the selected checkout under `source/` and use the separate `automation/` runner pinned to `github.workflow_sha`, invoked with `--root .` from `source/`. Never copy newer tests into an immutable source. Initialize only generated `.cache` state.
9. Confirm `https://mekhovov.github.io/revealline/release.json` reports the selected version and exact frozen source revision. Audit every public byte, check the selected release history exposes honest Play or Download actions, and test actual current play/offline plus affected legacy/download entry routes before claiming completion. Keep installed-scope checks separate from fresh navigation.

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

“Publish one exact qualified frozen release from `mekhovov/revealline`, using the main-repository-only selector. Do not create or append archives. Preserve immutable source/tag/asset pins and existing legacy links. Verify the original ZIP, current qualification, complete artifact/public bytes, latest stable selection and actual bounded player journey; keep failed attempts and skipped suites explicit.”

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

Archive repository creation, appends, tag-fetch preparation and archive admissions are retired release steps. Do not run their old example prompts. Historical protocols remain in `docs/archive-hosting-design.md` for interpreting preserved evidence only. A workflow-write permission refusal must not be bypassed with another transport, token or Git-tree workaround; obtain legitimate authorization before updating a workflow.

Before committing verification evidence, check every manifest-pinned original with `git ls-files --error-unmatch`. Repository ignore rules can omit original `.log` files even when their JSON manifest is staged. Add only those explicitly reviewed original paths with `git add -f`, then verify all recorded sizes and hashes against the index. Preserve original log/diff bytes, including whitespace; never normalize evidence to satisfy a source-format check. Run exact-source qualification only after that evidence-complete commit.

Use the selected immutable source and its own frozen builder. Follow [snapshot staging](../../../docs/snapshot-staging.md) for the rename-first source-TAR transfer; EXDEV still needs space for the temporary copy. Confirm fresh capacity and filesystem placement before building. Integration must retain the chosen main cutoff and the next release version; earlier candidate checks cannot qualify a later merge. Retire a generated preview only after regenerating it from its exact preserved Git source and verifying equal byte length and SHA-256. Record the comparison and retired path; preserve the immutable release originals, source Git objects and verification receipts. Low disk space alone does not authorize deleting an original.

When the original qualification artifact exceeds local capacity, use the [hosted artifact utility](../../../publishing/utility/README.md) on the reviewed workflow revision. Its default operation still qualifies and freezes source. Bind inspection to the actual successful run, source/tree and original artifact digest; review its original receipts before assembling qualification. The separately selected upload operation needs the exact existing tag/draft and seven reviewed small attachments, verifies both original payloads before either upload, and refuses overwrite or automatic retry. Keep hosted execution, immutable source, automation revision, local evidence review and public play distinct. An ambiguous upload needs an actual asset reread; never rebuild or regenerate the frozen payload to recover it.

A failed full source family cannot qualify a candidate even when preflight/build passed. Retain each completed shard's original logs and diagnose its actual failing assertions before rerunning. If navigation contracts changed, update obsolete fixture entry paths while preserving gameplay, save and cancellation guarantees; do not count a direct hidden handler as a visible journey. Keep sparse-input failures separate and hydrate only exact tracked dependencies. Commit the reviewed corrections and applicable guidance, then qualify that new source in full. A not-yet-published version may remain allocated; no immutable release is overwritten.

After changing a scoped provenance review declaration or its expected evidence matcher, run the complete affected `game/test/presentation-production-history.test.mjs` file and retain the exact fingerprint and review-scope assertions before qualifying the new source.

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

### Retention of a partially accepted edition

Archive admission may preserve exact original bytes and a scoped navigation result while a required feature-native check remains open. Carry the actual unresolved issue and its provenance into the archive admission and next publisher report. Do not turn retention, a successful workflow or a later source correction into full feature acceptance of the retained edition; keep the prior scoped accepted baseline explicit.

## Report actual qualification runtimes

Report the actual runtime from each retained hosted job log with that run’s workload and totals. Two successful workflow families are not a Node-version matrix. Distinguish complete source suites from focused Node 20/22 cohorts, and identify command-path version evidence when stdout does not print the runtime. Correct ambiguous summaries through a pinned append-only clarification; never rewrite the original qualification, log, attachment or historical acceptance.

Example prompt: “For each claimed Node version, identify the exact run or local receipt, runtime authority, test/file totals and source scope. Keep focused checks separate from full suites, and retain corrections beside the immutable originals.”

## Resolve the actual workflow before dispatch

Use the retained workflow filename or its verified GitHub workflow ID when dispatching an artifact utility. The current utility is `qualify-release-source.yml`; do not infer a filename from an operation name. Preserve a definite 404 from a nonexistent workflow, correct the endpoint once, and bind the resulting actual run. An ambiguous transport outcome instead needs run/asset discovery before any repeat. For failed read-only log or artifact retrieval, retain the original failure and use a finite retry of the exact observed run/job/artifact, with explicit time and byte bounds and a fresh receipt. A retrieval timeout does not justify rerunning successful source qualification. Keep tokens and signed download URLs out of diagnostics and published evidence.

A delayed dependency blocks only its dependent operation. Continue independent ready work and report the specific dependency, remaining active work and next check. Keep publication ownership explicit; a coordination or transport wait is not a whole-programme blocker.

## Thin publisher checkouts

Keep a publisher-only change limited to the required text hunks; preserve unrelated JSON formatting and recompute pins from the exact final bytes. A sparse checkout may omit inputs needed by otherwise unchanged tests: the catalog fixture reads `game/presentation/page-entry.mjs`. Record a missing-input setup failure separately from a product regression, restore the exact selected source input, and rerun the affected complete cohort. A local test glob over a thin checkout does not prove the full hosted fixture set ran.

For complete catalog/admission validation without copying historical evidence, a reviewed read-only adapter may supply absent inputs from the exact accepted local Git objects. Keep production validators unchanged, restrict fallback to the declared required paths, verify blob identity and length, and reject missing objects. Enumerate trees without sizes (`git ls-tree -rz`); ask `git cat-file --batch-check` only about the exact required object IDs with lazy fetch disabled. Never use recursive size enumeration to hydrate an entire history.

Count authored evidence files such as README and browser admission separately from copied originals. Verify every final evidence pin against the staged index, including complete original ZIPs and their member indexes. Preserve prepared cutoffs; add truthful current acceptance above them instead of leaving pending instructions as the current summary.

Example prompt: “Review the main-only publisher hunks, verify current qualification and immutable metadata, preserve legacy compatibility links and all evidence, and test that the next predecessor needs no archive. Keep hosted/public acceptance separate.”


## Validate evidence ZIPs with their actual upload consumer

Before uploading qualification metadata, run the selected source utility’s real
`small_assets_check` against the complete proposed binding and original small
asset bodies. Its evidence ZIP requires `evidence-manifest.json` at the ZIP root;
valid nested hashes alone do not establish a consumer-compatible package.
If an unpublished draft has invalid metadata, retain the rejected originals and
failed hosted receipt first. Correct only the explicitly identified draft metadata
assets after exact source/tag/asset reconciliation, then bind one reviewed upload
attempt to the new descriptors. Never overwrite published versions, change the
frozen game bytes, or repeat an ambiguous payload upload without fresh asset checks.

## Verify the actual merge parents

A PR's cached `base.sha` can name an earlier main commit even when GitHub has already computed a clean merge against current main. Preserve that mismatch and the refused first check. Before merging, fetch the proposed merge commit itself: require its parents to equal the freshly read main and exact qualified PR head, and its tree to equal the qualified source tree. Recheck main immediately before the merge and verify the returned merge parents/tree afterward. Never substitute a stale base or re-label older qualification. If the proposed tree differs, integrate and qualify the new source instead.

## Legacy archive records

Keep existing archive fixtures and accepted records as preservation evidence. They do not authorize a new repository, deployment or admission and are not prerequisites for current releases.

### Retained-media conflicts during public installation checks

If an optional external chapter refuses a retained picture-binding conflict, keep
that failed observation and the original media/flight unchanged. Verify a different
known compatible chapter independently; do not turn its success into catalog-wide
acceptance. Record the conflicting chapter as an open P06 recovery item. Same-chapter
Play preservation, different-chapter Stay and deliberate Replace are separate checks.
Capture visible before/after mission, score, lives and timer; distinguish elapsed
active play after explicit Continue from mutation while paused. No local preview or
HTTP byte audit substitutes for the deployed player journey.


### Cancel title continuation before restore settles

Exercise immediate Escape/Back and explicit Cancel after title Continue from a real saved flight. Both title and field preparation feedback must settle; an enabled Load button beside a stale “Verifying your saved flight” message is a failure even when the saved bytes remain intact. Then explicitly load and compare mission, lives, score and timer while paused. Keep the abort owner scoped so a late decoder cannot erase newer feedback or move focus. Preserve the original failed public observation and the complete affected title host tests.

During an active title preparation, Escape/Back cancels the operation and retains its title opener. Verify this through the actual native cancel event and real keyboard input; do not treat a direct Cancel-button-only test as proof of Back focus behavior.

When an authored conditional recovery group changes a chapter card, preserve the exact visible action order and closed native-file disclosure checks. Extend the contract to require the group hidden initially, an accessible name and the correct explicit actions; keep complete keyboard/controller, cancel/retry and stale-focus tests. Never simply remove a structural assertion to obtain a pass.

For short-screen pause overlays, test Large/Plain at 844×390 and 568×320. Traverse both directions to Resume and Main menu; inspect the whole focused outline within the scrollport. Structural CSS assertions do not substitute for actual intrinsic-height, scroll and keyboard checks. Keep font size and target size intact.


## Default Journey delivery (v0.83 candidate)

Use [the current bounded release contract](../../../docs/default-journey-release.md).
A special `?journey=whole-spatial-v5` URL does not prove ordinary discovery. Verify
queryless public root, direct Solo/Versus and Team (91/91/12), then explicit Legacy
and return paths. Preserve parameter-owned practice, course, pack and mode-return
entry and Workshop catalogue context. Keep one publisher/one prepared successor;
reserve the version before committing. No migration or new artwork is required.
Check nested tool launches as well as tool return links: Playground's installed-map
Couch preview must explicitly carry `journey=legacy` in both its frame and open
link. An editor-only test does not prove the child host selected that catalogue.
Legacy fixture helpers must explicitly request Legacy; dedicated default-entry
tests must pass an actually empty query. Never change behavioral assertions merely
to hide a navigation regression. Keep balance/device/offline limits in evidence.
