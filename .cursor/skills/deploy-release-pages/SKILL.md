---
name: deploy-release-pages
description: Deploy and verify a tagged RevealLine GitHub Release on GitHub Pages. Use when the user asks to publish, redeploy, live-test, or troubleshoot a RevealLine release on Pages.
disable-model-invocation: true
---

# Deploy a RevealLine release to GitHub Pages

## Procedure

1. Confirm the requested immutable tag and GitHub Release exist. Do not infer a release from an unreleased package version.
2. Publish a non-draft, non-prerelease GitHub Release to trigger deployment. For a retry, dispatch `deploy-pages.yml` from `main` and provide the exact tag as `release_tag`, so the current automation builds the immutable release source.
3. Verify the release gate, test shards, Pages build, artifact upload, and deployment all pass.
4. Confirm `https://mekhovov.github.io/revealline/release.json` reports the requested version.

## Safety rules

- Pages follows the highest published stable semantic version, never an untagged branch.
- Preserve historical `/releases/<version>/` routes.
- A queued or in-progress run is not a completed deployment.
