# Frozen Pages publication controller

This directory publishes one explicitly selected immutable game and the complete release catalog. It does not rebuild historical games or change their release records, tags, assets, original workers, saved-data keys or ZIP files. The initial review fixture selects v0.44.0 and has `deploymentEnabled: false`. The final main publication will select qualified v0.51.0 after all required archives and public journeys are admitted. A canonical archive URL satisfies each earlier phase's Pages testing; main does not need to cycle through those phases.

The publishing controller commit is different from `gameSourceRevision`. For example, v0.42.0 is frozen source `e9928cdaad2f55d912aadd2ef25f635fb99e938c`; the main merge `f56ce9d98f0ce5d77a8f3c7dc310bf1a7e6b795c` was its publishing controller. The same distinction applies here. Infrastructure changes do not increment a frozen game version.

## Inputs and admission

`catalog.json` pins the original bytes of every release record, manifest and ZIP checksum, plus each annotated tag object and peeled source commit. `metadata/` contains those exact small original files. Neither formatting nor regeneration may rewrite them. The complete semantic-version tag set must still agree before publication.

`allocations.json` reserves archive ownership independently of the selected current version. Only admitted, existing frozen editions enter the effective overlay. The current version is always excluded from that overlay. Reserved future versions do not fabricate release entries. Archive01–05 keep their existing ownership; 06 holds v0.41/v0.44, 07 v0.45/v0.46, 08 v0.47/v0.48, 09 v0.49/v0.50, and 10 v0.42.

Each admission pins its infrastructure commit, successful Pages deployment and retained evidence. Validation compares every frozen asset, original manifest, record and ZIP checksum against the archive's complete accepted HTTP inventory. The HTTP report must cover that inventory without missing or failed files. Hosted runs also confirm that each archive's main commit and successful deployment still match the admission.

Browser admission is a review record tied to pinned native evidence. It does not turn an HTTP hash audit into a playthrough. Older unchanged editions retain their earlier scoped acceptance and known limitations. New redesign editions each need actual public play/offline acceptance. The original receipts retain timeouts, writer contention, unavailable legacy pictures and other limits. The initial candidate deliberately lacks archive07 browser admission until the v0.45/v0.46 checks finish. Evidence files are copied unchanged; links inside historical notes describe their original evidence locations.

## Build and publication

The workflow requires 8 GiB free on the hosted runner. No npm installation or historical source rebuild is needed.

1. Validate the selector, metadata, immutable tag pins and archive admissions.
2. Download only the selected original `distribution.zip` from the code-owned GitHub Release URL. Verify its exact SHA, every bounded safe member, CRC, length and SHA before promoting the extracted current graph. Links, duplicate members, traversal, unexpected files and altered original manifests are refused.
3. Copy the current graph under `releases/V/site/`, retaining its original worker. Copy its root assets and generate the existing current-entry aliases and retirement worker. Neither worker forces activation or deletes storage.
4. Derive historical HTML bridge paths and worker existence from authenticated original manifests. The pure bridge generators are the existing `scripts/pages-archive.mjs` protocol. No historical payload reads or placeholder bodies are used. ZIPs remain on their original GitHub Releases.
5. Style only the mutable release catalog using the selected current graph's own presentation assets. `catalog.mjs` preserves the P6 catalog helper behavior from `scripts/release-catalog.mjs` and `publishedReleaseIndex`; it is infrastructure code so that the final catalog can be published before the source integration merges. Earlier releases without the presentation bundle use the readable fallback.
6. Hash the full resulting artifact, enforce the 950,000,000-byte main cap, and independently reread all files against the receipt before upload. The artifact and receipt bind the controller commit/tree separately from the frozen game source.

An existing output is never overwritten. Failed preparation cannot receive a verified receipt or be deployed. ZIP extraction stages its own output and removes only that newly created staging directory on failure. A failed later assembly may retain an incomplete new artifact directory for inspection; retry in a fresh workflow workspace.

The new workflow deploys only `refs/heads/main` through the existing `github-pages` environment. Its concurrency waits for an earlier main deployment. The legacy workflow keeps all six source-gate commands for game changes; while this controller exists, it skips its older build/upload/deploy route. Infrastructure-only path exclusions route these changes to the focused controller checks. No environment protection policy is changed.

## Updating the selector

Freeze and qualify the exact game candidate first. Preserve all earlier metadata files and tag identities. Append new original metadata and pins, prepare and verify any archive allocation, attach honest scoped public/browser evidence, then change `currentVersion` and set `deploymentEnabled: true` in a reviewed publishing commit. Do not enable a deployment merely because schema checks pass. After deployment, audit every published byte and run the current main/old-entry migration journeys; the build receipt does not claim that public acceptance.

Focused checks:

```sh
node --test publishing/pages-controller/*.test.mjs
python3 -m unittest discover -s publishing/pages-controller -p 'test_*.py' -v
node publishing/pages-controller/publish.mjs verify --preview
```

`--preview` omits the final browser/deployment-enable requirement and always produces a non-publishable receipt. The workflow never uploads or deploys PR preview artifacts as Pages. The build and receipt verification commands use a fresh `.cache/frozen-pages/` directory; committed inputs and a clean checkout are required.
