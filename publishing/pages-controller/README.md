# Frozen Pages publication controller

This directory publishes one explicitly selected immutable game and the semantic release explorer. It does not rebuild historical games or change their release records, tags, assets, original workers, saved-data keys or ZIP files. The current `retainedReleasesPerMajor: 100` setting includes all 57 pinned semantic releases. The root and `/game/` select only the newest published stable release; historical and comparison entries link to their own canonical archives. A canonical archive URL satisfies each earlier phase's Pages testing; main does not need to cycle through those phases.

The publishing controller commit is different from `gameSourceRevision`. For example, v0.42.0 is frozen source `e9928cdaad2f55d912aadd2ef25f635fb99e938c`; the main merge `f56ce9d98f0ce5d77a8f3c7dc310bf1a7e6b795c` was its publishing controller. The same distinction applies here. Infrastructure changes do not increment a frozen game version.

## Inputs and admission

`catalog.json` pins the original bytes of every release record, manifest and ZIP checksum, plus each annotated tag object and peeled source commit. `metadata/` contains those exact small original files. Neither formatting nor regeneration may rewrite them. Every catalog tag object and peeled source must still agree before publication. New uncataloged tags may exist; they do not become catalog entries or bypass the highest published stable release guard.

`sync-release-metadata.mjs` prepares new metadata only. It validates the original record/manifest/ZIP-checksum chain and the complete requested batch plus selected qualification before writing. Existing pins and files are immutable; an identical request changes neither bytes nor modification times. The helper normalizes paths, refuses symlink or stale-input changes, uses an exclusive preparation lock and no-clobber writes, and rolls back its own newly published files after a failed batch. Preserve these checks and review any refusal; never run this preparation helper during deployment.

The current selector separately pins its published source-qualification receipt. All six gates must have passed for that exact game commit/tree, and hosted publication verifies the identical receipt from its GitHub Release. A missing gate, changed body or mismatched source tree refuses publication. The first public native/offline check of a newly published current edition remains a post-deployment acceptance task; it cannot precede the edition's first public availability.

`allocations.json` reserves archive ownership independently of the selected current version. Ordinary historical entries use admitted archive routes. An explicitly reviewed `testingRoutes` entry may expose a frozen comparison edition before its native admission; it never becomes the root default. Direct version URLs receive the same metadata bridges as explorer links. All original catalog metadata and pins remain preserved and validated. The current version is always excluded from that overlay. Reserved future versions do not fabricate release entries. Archive01–05 keep their existing ownership; 06 holds v0.41/v0.44, 07 v0.45/v0.46, 08 v0.47/v0.48, 09 v0.49/v0.50, 10 v0.42, and 11 v0.51.

Each admission pins its infrastructure commit, successful Pages deployment and retained evidence. Validation compares every frozen asset, original manifest, record and ZIP checksum against the archive's complete accepted HTTP inventory. The HTTP report must cover that inventory without missing or failed files. Hosted runs also confirm that each archive's main commit and successful deployment still match the admission.

Browser admission is a review record tied to pinned native evidence. It does not turn an HTTP hash audit into a playthrough. Older unchanged editions retain their earlier scoped acceptance and known limitations. New redesign editions each need actual public play/offline acceptance. The original receipts retain timeouts, writer contention, unavailable legacy pictures and other limits. Archive07 now retains both v0.45/v0.46 canonical browser and offline admissions, including their first preparation timeouts and successful normal retries. Evidence files are copied unchanged; links inside historical notes describe their original evidence locations.

Archive08 now admits the exact v0.47/v0.48 freezes and their native play, Studio and offline checks. Its HTTP evidence retains the first 760 successful bodies and 13 transport failures, then independently reconciles the 13 successful retries against the same 773-file inventory. The original failure and retry receipts remain attached. Browser evidence retains all ordinary offline preparation timeouts and successful offered retries. Those receipts establish the archive admission independently of a later current-edition selection.

Archive11 preserves v0.51.0 from its original release ZIP. Its public audit verifies all 620 files and 323,017,169 bytes without failures or retries. Native evidence verifies online mission installation, keyboard capture, pause/resume and saved-flight restoration. Two uninterrupted offline preparation attempts timed out after an initial interrupted attempt; disconnected reload was not tested. This admission is scoped to historical online preservation and does not claim offline acceptance. The current selector remains v0.51.0 until a separately qualified release is selected.

## Build and publication

The workflow requires 8 GiB free on the hosted runner. No npm installation or historical source rebuild is needed.

1. Validate the selector, metadata, immutable tag pins and archive admissions.
2. Download only the selected original `distribution.zip` from the code-owned GitHub Release URL. Verify its exact SHA, every bounded safe member, CRC, length and SHA before promoting the extracted current graph. Links, duplicate members, traversal, unexpected files and altered original manifests are refused.
3. Copy the current graph under `releases/V/site/`, retaining its original worker. Copy its root assets and generate the existing current-entry aliases and retirement worker. Neither worker forces activation or deletes storage.
4. Derive retained historical HTML bridge paths and worker existence from authenticated original manifests. The pure bridge generators are the existing `scripts/pages-archive.mjs` protocol. No historical payload reads or placeholder bodies are used. ZIPs remain on their original GitHub Releases.
5. Style only the mutable release catalog using the selected current graph's own presentation assets. `catalog.mjs` preserves the P6 catalog helper behavior from `scripts/release-catalog.mjs` and `publishedReleaseIndex`; it is infrastructure code so that the final catalog can be published before the source integration merges. Earlier releases without the presentation bundle use the readable fallback.
6. Hash the full resulting artifact, enforce the 950,000,000-byte main cap, and independently reread all files against the receipt before upload. The artifact and receipt bind the controller commit/tree separately from the frozen game source.

An existing output is never overwritten. Failed preparation cannot receive a verified receipt or be deployed. ZIP extraction stages its own output and removes only that newly created staging directory on failure. A failed later assembly may retain an incomplete new artifact directory for inspection; retry in a fresh workflow workspace.

The publisher deploys only `refs/heads/main` through the existing `github-pages` environment.
Its concurrency waits for an earlier frozen publication. Source pull requests retain main's
preflight, provenance checks, all four test shards and ordinary build in a separate non-cancelling
group. The legacy workflow has no Pages upload/deploy route. Its release/manual entry reads the
selector from `main` and dispatches the sole publisher there; it never invokes a current-only test
runner from a historical release. Historical tags retain their own workflow files, so retry those
through a main dispatch. No environment protection policy is changed.

Actual publication must select the highest published stable semantic version, ignoring drafts and
prereleases. The policy runs during each hosted artifact check and again after any protected
deployment wait. Older release events are skipped; a newer event whose tag lacks a matching enabled
selector fails without changing configuration. An optional dispatch `release_tag` must match exactly.
PR previews are explicitly non-publishable and must still use a valid selector for their pinned catalog and retention policy.

## Updating the selector

Freeze and qualify the exact game candidate first. Preserve all earlier metadata files and tag identities. Append new original metadata and pins, prepare and verify any archive allocation, attach honest scoped public/browser evidence, then change `currentVersion` and set `deploymentEnabled: true` in a reviewed publishing commit. Do not enable a deployment merely because schema checks pass. After deployment, audit every published byte and run current main play/offline plus retained-entry journeys; the build receipt does not claim that public acceptance. Check an existing scoped offline installation separately from fresh navigation through its historical bridge. The installed worker may still serve original bytes; that does not establish the bridge or canonical archive behavior in a fresh profile.

Focused checks:

```sh
node --test publishing/pages-controller/*.test.mjs
python3 -m unittest discover -s publishing/pages-controller -p 'test_*.py' -v
node publishing/pages-controller/publish.mjs verify --preview
```

`--preview` omits the final browser/deployment-enable requirement and always produces a non-publishable receipt. The workflow never uploads or deploys PR preview artifacts as Pages. The build and receipt verification commands use a fresh `.cache/frozen-pages/` directory; committed inputs and a clean checkout are required.

## Delivery evidence updates

The [delivery record](delivery/README.md) is publication metadata. Changes confined to `delivery/**` retain pull-request preview checks but are excluded from the publisher's main push trigger. This prevents completing an acceptance report from starting a new deployment that would need another report. The exclusion follows the positive controller path pattern and does not suppress a mixed commit that changes the selector, workflow or other publication inputs. Immutable game source and release artifacts remain unchanged.
