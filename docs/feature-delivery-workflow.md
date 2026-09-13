# Feature delivery and public verification

This project’s current authorization is to commit each completed feature or phase, freeze a new independently playable version, create and merge its pull request, deploy it to GitHub Pages, and verify that deployment. No repeated permission request is needed for these scoped actions. This does not authorize unrelated external messages or native-store purchases/submissions.

## One completion path

1. Implement the player-visible result and update the relevant roadmap step, source documentation and AI authoring guidance. Keep future phase code out of the candidate by staging explicit related paths. Preserve supplied references and unrelated working changes.
2. Run the appropriate regressions and actual browser journeys. For navigation, reproduce terminal win/loss, picture and nested menus through keyboard and modeled controller inputs, then inspect touch layouts. Modeled pads and desktop resizing are not physical-device certification.
3. Commit the logical changes. Extract that exact committed revision with `git archive` into an isolated verification directory; run tests, lint, format, native-format, content validation and motion-lab syntax there. Record commands, source SHA, logs, failures and actual support limits.
4. Use the tested CLI’s `release-snapshot --ref FULL_SHA --version vX.Y.Z`. Never overwrite a release/tag. Create the annotated tag on that source SHA. Verify the manifest, ZIP and source hashes, old release/tag preservation and frozen browser play.
5. Push the feature branch and the exact new tag. Create a PR with the problem/result and validation evidence. Wait for PR checks; review the concrete diff, resolve failures, and merge with history preserved. A successful local test is not a merged PR.
6. Publish the tag’s original `distribution.zip`, checksum and `release.json` as GitHub Release assets. Historical releases use `--latest=false`; only the current delivered milestone is marked latest. Never regenerate an asset under the same version.
7. The main-branch Pages workflow verifies source, builds the exact package-version tag, and deploys only after verification. The root game and its versioned URL must have the same manifest and `game/build-info.json`, even when the main merge commit is later than the source tag.
8. Verify the completed Actions run and fetch the actual public release metadata and representative files; test the public game. Record version/source identity, public URL, PR, deployment run, failed checks and remaining issues. Only then mark the feature delivered.

## Pages storage

`npm run build:pages` keeps all tagged playable sites and rejects stale local archives, missing current tags, symlinks and artifacts above 950 MB. ZIP files duplicate the sites and are hosted as GitHub Release assets instead. The published version index links to those assets; frozen runtime files and manifests retain their exact bytes. The local release archive still contains its ZIP and source TAR. When history eventually exceeds the budget, design an explicit archive-hosting transition rather than silently removing playable editions.

## Reusable agent requests

- “Finish the terminal menu feature; reproduce win/loss using the actual host; verify every visible action without a mouse; preserve saved runs; follow the delivery path and report the public source SHA.”
- “Create a new enemy appearance for a registered role, inspect its direction and damage cues on phone and desktop, compare simulation checkpoints, and publish the validated cosmetic feature without altering old campaigns.”
- “Prepare an MP3 playlist update with source credits and an exact binary backup. Keep the session song playing across menus and ordinary pause. Verify actual uploaded audio separately from synthetic fixtures.”
- “Add a new authored behavior edition. Preserve old proof files, bind the new rule explicitly, prove ordinary wins and failure/recovery, and document what remains inferred from reference footage.”

All project skill entry points link here. Skill text supports the user’s chosen scope; it does not turn a design-only request into a release or bypass a failed check.
