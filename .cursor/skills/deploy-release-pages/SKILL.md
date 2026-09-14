---
name: deploy-release-pages
description: Deploy and verify a tagged RevealLine GitHub Release on GitHub Pages. Use when the user asks to publish, redeploy, live-test, or troubleshoot a RevealLine release on Pages.
disable-model-invocation: true
---

# Deploy a RevealLine release to GitHub Pages

## Procedure

1. Confirm the requested immutable tag and GitHub Release exist. Do not infer a release from an unreleased package version.
2. Publish a non-draft, non-prerelease GitHub Release to trigger deployment. For a retry, dispatch `deploy-pages.yml` from `main` and provide the exact tag as `release_tag`, so the current automation builds the immutable release source.
3. Keep release code and automation distinct. The shard jobs check out selected source under `source/` and the utility under `automation/` at `github.workflow_sha`; run that utility with `--root .` from `source/`. Never copy newer game tests into an old immutable tag. Initialize only generated `.cache` state before the selected tests.
4. Verify the release gate, test shards, Pages build, artifact upload, and deployment all pass.
5. Confirm `https://mekhovov.github.io/revealline/release.json` reports the requested version.

## Safety rules

- Pages follows the highest published stable semantic version, never an untagged branch.
- Preserve historical `/releases/<version>/` routes.
- A queued or in-progress run is not a completed deployment.

If an old tag reports a missing shard utility or generated cache directory, fix the current workflow/runner instead of rewriting the tag. Local focused tests cover selection, imports, working directory and exit propagation; they do not prove a successful hosted workflow or Pages deployment.
