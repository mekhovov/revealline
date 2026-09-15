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

1. Confirm the requested immutable tag and published stable GitHub Release exist. Do not infer a release from an unreleased package version or move an existing tag.
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

## Example publishing prompt

“Publish the exact qualified frozen release selected on main. Preserve every immutable source/tag/asset pin, the complete semantic release explorer and direct archive routes. Keep comparison-only testing routes distinct from full byte/browser admissions and the stable root default. Verify original ZIP and all output/public bytes, latest stable selection and actual current play/offline; keep failed attempts and successful retries in the evidence.”

## Snapshot and integration checks

Use the selected immutable source and its own frozen builder. Follow [snapshot staging](../../../docs/snapshot-staging.md) for the rename-first source-TAR transfer; EXDEV still needs space for the temporary copy. Confirm fresh capacity and filesystem placement before building. Integration must retain the chosen main cutoff and the next release version; earlier candidate checks cannot qualify a later merge. Retire only verified generated previews, preserving the original Git/release assets and verification receipts.
