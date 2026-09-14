---
name: deploy-release-pages
description: Deploy and verify a tagged RevealLine GitHub Release on GitHub Pages. Use when the user asks to publish, redeploy, live-test, or troubleshoot a RevealLine release on Pages.
disable-model-invocation: true
---

# Deploy a RevealLine release to GitHub Pages

## Procedure

1. Confirm the requested immutable tag and published stable GitHub Release exist. Do not infer a release from an unreleased package version or move an existing tag.
2. Read `publishing/pages-controller/publication.json` on `main`. The enabled reviewed selector must name the requested version, its exact six-gate source qualification, and admitted archive routes. Pages follows the highest published stable semantic version; publishing a release does not automatically change this selection.
3. Prepare and review all original metadata, qualification, archive byte/browser evidence, and selector changes before committing the publishing controller. The selection commit triggers `publish-frozen-pages.yml` on `main`. Keep controller identity separate from the immutable game source and use its original ZIP; do not rebuild or amend historical releases.
4. For a retry, dispatch `publish-frozen-pages.yml` from `main` with the exact `release_tag`. The legacy `deploy-pages.yml` manual entry on `main` routes to the same publisher. Historical tags retain historical workflow files, so do not assume their release event can execute the current controller or test sharder.
5. Verify the focused controller checks, bounded ZIP extraction, complete artifact byte reread, latest-stable guard, Pages upload, and protected deployment all pass. New game source still requires the six source gates; source pull requests retain preflight and four test shards.
6. Confirm `https://mekhovov.github.io/revealline/release.json` reports the selected version and exact frozen source revision. Audit all public bytes and actual play/offline/old-entry behavior before claiming completion.

Source test jobs keep the selected source in `source/` and obtain the shard utility from a separate `automation/` checkout pinned to `github.workflow_sha`. Run the utility with `--root .` from `source/`, so discovery, imports, child processes and dependencies belong to the selected source. Initialize only generated `.cache` state; never copy newer game tests into a historical tag. These checks do not replace the immutable release qualification or the frozen-ZIP publisher.

## Safety rules

- Only `publish-frozen-pages.yml` on `main` deploys; preserve the main-only Pages environment policy and non-cancelling publication concurrency.
- Preserve immutable source archives, ZIPs, manifests, tags, and historical `/releases/<version>/` routes. Keep the existing 950 MB main and 800 MB archive budgets.
- Never execute a current-only source helper from a historical tag. Use the release's accepted exact-source qualification and original bytes.
- A queued or in-progress run, PR preview, or uploaded artifact is not a completed public deployment.

If a source check reports a missing shard utility or generated cache directory, fix the current workflow/runner rather than rewriting a tag. Local runner tests cover source selection, imports, working directory and exit propagation; they do not establish hosted qualification or public deployment.
