---
name: deploy-release-pages
description: Deploy and verify a tagged RevealLine GitHub Release on GitHub Pages. Use when the user asks to publish, redeploy, live-test, or troubleshoot a RevealLine release on Pages.
disable-model-invocation: true
---

# Deploy a RevealLine release to GitHub Pages

## Scope

Deploy only an immutable Git tag that matches the repository `package.json` version. Preserve the
dirty working tree: deployment must use GitHub Actions, not a local commit, force-push, or direct
rewrite of Pages.

## Procedure

1. Inspect `git status`, confirm the repository is `mekhovov/revealline`, and resolve the requested
   release tag. Never infer a tag from an unreleased package version.
2. Confirm the tag exists and points to the intended commit:

   ```sh
   git ls-remote --tags origin 'v*'
   gh release view TAG --repo mekhovov/revealline
   ```

3. For a new release, ensure the intended source is committed, create/push the matching tag, and
   publish a non-draft, non-prerelease GitHub Release. The `release: published` trigger deploys it.
4. For an existing release or a retry, dispatch the workflow against the exact tag:

   ```sh
   gh workflow run deploy-pages.yml --repo mekhovov/revealline --ref TAG
   ```

5. Watch the run until it finishes. Check that the release gate, full tests, Pages build, artifact
   upload, and deployment all pass:

   ```sh
   gh run list --repo mekhovov/revealline --workflow deploy-pages.yml --limit 5
   gh run watch RUN_ID --repo mekhovov/revealline --exit-status
   ```

6. Verify `https://mekhovov.github.io/revealline/game/` and `/release.json`. Report the Actions
   run URL, exact tag/commit, live URL, and any failed gate. A queued or in-progress run is not a
   completed deployment.

## Safety rules

- Do not deploy `main` directly as the public current version; Pages follows published stable
  Releases.
- Do not publish prereleases as the current Pages build.
- The workflow rejects an older release if GitHub reports a newer stable release.
- Do not modify or delete historical `/releases/<version>/` routes.
- If the release tag and `package.json` version disagree, stop and explain the mismatch.
- If the worktree is dirty, leave all existing changes untouched.

## Troubleshooting

If the workflow fails, inspect the failed job before retrying:

```sh
gh run view RUN_ID --repo mekhovov/revealline --log-failed
```

Fix the source or release metadata, then rerun the workflow against the same immutable tag only
after the cause is understood. A failed run does not alter the currently deployed Pages artifact.
