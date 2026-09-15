---
name: deploy-release-pages
description: Deploy and verify a tagged RevealLine GitHub Release on GitHub Pages. Use when the user asks to publish, redeploy, live-test, or troubleshoot a RevealLine release on Pages.
disable-model-invocation: true
---

# Deploy a RevealLine release to GitHub Pages

## Procedure

1. Confirm the requested immutable tag and published stable GitHub Release exist. Do not infer a release from an unreleased package version or move an existing tag.
2. Read `publishing/pages-controller/publication.json` on `main`. The enabled reviewed selector must name the requested version, its exact six-gate source qualification, and admitted archive routes. Preserve `retainedReleasesPerMajor: 5`: the effective main catalog and routing retain the newest five frozen releases per semantic major version, including the current version. Pages follows the highest published stable semantic version; publishing a release does not automatically change this selection.
3. Prepare and review all original metadata, qualification, archive byte/browser evidence, and selector changes before committing the publishing controller. The selection commit triggers `publish-frozen-pages.yml` on `main`. Keep controller identity separate from the immutable game source and use its original ZIP; do not rebuild or amend historical releases.
4. For a retry, dispatch `publish-frozen-pages.yml` from `main` with the exact `release_tag`. The legacy `deploy-pages.yml` manual entry on `main` routes to the same publisher. Historical tags retain historical workflow files, so do not assume their release event can execute the current controller or test sharder.
5. Verify the focused controller checks, bounded ZIP extraction, complete artifact byte reread, latest-stable guard, Pages upload, and protected deployment all pass. New game source still requires the six source gates; source pull requests retain preflight and four test shards.
6. Keep source and test automation distinct. Source check jobs place the selected checkout under `source/` and use the separate `automation/` runner pinned to `github.workflow_sha`, invoked with `--root .` from `source/`. Never copy newer tests into an immutable source. Initialize only generated `.cache` state.
7. Confirm `https://mekhovov.github.io/revealline/release.json` reports the selected version and exact frozen source revision. Audit all public bytes and actual play/offline behavior before claiming completion. Check installed retired editions separately from cold old main URLs; an existing scoped offline installation is not proof that its omitted main route still exists.

## Safety rules

- Only `publish-frozen-pages.yml` on `main` deploys; preserve the main-only Pages environment policy and non-cancelling publication concurrency.
- Preserve immutable source archives, ZIPs, manifests, tags, and direct canonical archive URLs. Keep all original pins in the controller catalog, but publish main `/releases/<version>/` routes and catalog entries only for the retained five per major version. Older main routes may be absent; never promise cold access to them. Keep the existing 950 MB main and 800 MB archive budgets.
- Never execute a current-only source helper from a historical tag. Use the release's accepted exact-source qualification and original bytes.
- A queued or in-progress run, PR preview, or uploaded artifact is not a completed public deployment.

If a historical source check lacks a sharding helper or generated cache directory, fix the workflow/runner instead of rewriting the tag. Focused runner tests cover discovery, imports, working directory and exit propagation; they do not establish hosted qualification or a public deployment.

## Example publishing prompt

“Publish the exact qualified frozen release selected on main. Preserve the five-per-major retention policy, every immutable source/tag/asset pin and direct archive URL. Verify the required archive bytes and native evidence, original ZIP, all output bytes, latest stable selection and actual current play/offline. Report cold retired main routes separately from installed older editions; keep failed attempts and successful retries in the evidence.”
