# Frozen Pages publication controller

This directory publishes one explicitly selected immutable game and the semantic release explorer. It does not rebuild historical games or change their release records, tags, assets, original workers, saved-data keys or ZIP files. The current `retainedReleasesPerMajor: 100` setting includes all 88 pinned semantic releases. The root and `/game/` select only the newest published stable release; historical and comparison entries link to their own canonical archives. A canonical archive URL satisfies each earlier phase's Pages testing; main does not need to cycle through those phases.

The publishing controller commit is different from `gameSourceRevision`. For example, v0.42.0 is frozen source `e9928cdaad2f55d912aadd2ef25f635fb99e938c`; the main merge `f56ce9d98f0ce5d77a8f3c7dc310bf1a7e6b795c` was its publishing controller. The same distinction applies here. Infrastructure changes do not increment a frozen game version.

The selector now proposes published **v0.61.7** from exact source `b3262eb02a998c50354758ba922324d023138875`. Archive25 retains both v0.61.5 and v0.61.6 through its accepted 1,398-file / 626,758,906-byte inventory and scoped native practice. It preserves 699 prior rows, changes only the root index and adds 698 rows. All 87 prior catalog records and the 24 other archive admissions/allocations remain unchanged; earlier Archive25 evidence stays immutable. The accepted public baseline is v0.61.6. This selector requires publisher preview/merge, Pages deployment, the complete public byte audit and the shipped Motion Lab rotation/focus journey. See [current-source inputs](evidence/current-v0617/README.md), [archive retention](evidence/archive-25/append-v0616/README.md) and [publication record](delivery/evidence/cross-mode-p03/motion-v0617-publication/README.md).

## Inputs and admission

`catalog.json` pins the original bytes of every release record, manifest and ZIP checksum, plus each annotated tag object and peeled source commit. `metadata/` contains those exact small original files. Neither formatting nor regeneration may rewrite them. Every catalog tag object and peeled source must still agree before publication. New uncataloged tags may exist; they do not become catalog entries or bypass the highest published stable release guard.

`sync-release-metadata.mjs` prepares new metadata only. It validates the original record/manifest/ZIP-checksum chain and the complete requested batch plus selected qualification before writing. Existing pins and files are immutable; an identical request changes neither bytes nor modification times. The helper normalizes paths, refuses symlink or stale-input changes, uses an exclusive preparation lock and no-clobber writes, and rolls back its own newly published files after a failed batch. Preserve these checks and review any refusal; never run this preparation helper during deployment.

The current selector separately pins its published source-qualification receipt. All six gates must have passed for that exact game commit/tree, and hosted publication verifies the identical receipt from its GitHub Release. A missing gate, changed body or mismatched source tree refuses publication. The first public native/offline check of a newly published current edition remains a post-deployment acceptance task; it cannot precede the edition's first public availability.

Before an archive append, run `node archive-tag-fetch.mjs --source-lock <archive/source-lock.json> --workflow <archive/.github/workflows/deploy.yml>` from this directory. It checks every source-lock cohort against the archive template's direct `jobs/build/steps` explicit same-tag fetch refs in an unconditional named step with `working-directory: source`. Missing refs, another destination, conditional steps and dynamic shell cannot establish coverage. This local check performs no fetch and does not prove hosted execution, tag identity, byte preservation or native acceptance. Keep the actual hosted checks and the original failed attempt. The [deployment skill](../../.cursor/skills/deploy-release-pages/SKILL.md) gives the repository-root command and complete release gate.

`allocations.json` reserves archive ownership independently of the selected current version. Ordinary historical entries use admitted archive routes. An explicitly reviewed `testingRoutes` entry may expose a frozen comparison edition before its native admission; it never becomes the root default. Direct version URLs receive the same metadata bridges as explorer links. All original catalog metadata and pins remain preserved and validated. The current version is always excluded from that overlay. Reserved future versions do not fabricate release entries. Archive01–05 keep their existing ownership; 06 holds v0.41/v0.44, 07 v0.45/v0.46, 08 v0.47/v0.48, 09 v0.49/v0.50, 10 v0.42, 11 v0.51, 12 v0.52, and 13 v0.54/v0.55.

Each admission pins its infrastructure commit, successful Pages deployment and retained evidence. Validation compares every frozen asset, original manifest, record and ZIP checksum against the archive's complete accepted HTTP inventory. The HTTP report must cover that inventory without missing or failed files. Hosted runs also confirm that each archive's main commit and successful deployment still match the admission.

Every retained modern edition must reach the main live catalog through its actual title **Release explorer** action. A shared archive index is publication infrastructure: preserve an obsolete list under `legacy/`, then use the reviewed accessible redirect/fallback instead of freezing misleading “Current” text. Keep every canonical edition body, original tag and metadata pin unchanged. Verify the native title → explorer → main catalog → Back journey as well as the complete revised HTTP inventory; a byte-perfect obsolete index does not pass this gate. See the [archive explorer review and AI prompt](delivery/archive-explorer-review.md).

Browser admission is a review record tied to pinned native evidence. It does not turn an HTTP hash audit into a playthrough. Older unchanged editions retain their earlier scoped acceptance and known limitations. New redesign editions each need actual public play/offline acceptance. The original receipts retain timeouts, writer contention, unavailable legacy pictures and other limits. Archive07 now retains both v0.45/v0.46 canonical browser and offline admissions, including their first preparation timeouts and successful normal retries. Evidence files are copied unchanged; links inside historical notes describe their original evidence locations.

Archive08 now admits the exact v0.47/v0.48 freezes and their native play, Studio and offline checks. Its HTTP evidence retains the first 760 successful bodies and 13 transport failures, then independently reconciles the 13 successful retries against the same 773-file inventory. The original failure and retry receipts remain attached. Browser evidence retains all ordinary offline preparation timeouts and successful offered retries. Those receipts establish the archive admission independently of a later current-edition selection.

Archive11 preserves v0.51.0 from its original release ZIP. Its public audit verifies all 620 files and 323,017,169 bytes without failures or retries. Native evidence verifies online mission installation, keyboard capture, pause/resume and saved-flight restoration. Two uninterrupted offline preparation attempts timed out after an initial interrupted attempt; disconnected reload was not tested. This admission is scoped to historical online preservation and does not claim offline acceptance.

Archive10's later deployment retains v0.42.0 and an additional v0.51.0 copy. Its successor admission preserves the earlier evidence and pins the complete 976-file, 633,532,427-byte audit plus scoped native journeys at infrastructure `55019541f8210ccef70f09cc04885f0debf1c4a7`. Independent review reconciled every retained HTTP observation with both original manifests; 18 fresh probes corroborated the unchanged deployment. Those probes are not a new full audit or offline acceptance. Main allocations still route v0.42.0 to archive10 and v0.51.0 to archive11.

Archive13 preserves v0.54.0 from its original release ZIP. Its public audit verifies all 652 files / 312,209,411 bytes. Automated Chromium interaction verifies online capture, Retry, explicit pause/resume, saved-flight restoration, and offline reload/play after an offered preparation retry verified all 600 core files. The initial preparation timeout remains recorded for P01. Native evidence is limited to accepted source-format and desktop/iOS/tooling tests; physical-device testing is not claimed.

The earlier v0.58.0 selector preparation (P02-A shared master audio) used frozen source `c113a348ae69bd013b67f0d22a5391d604253545`. Its exact original published metadata and six-gate source qualification are pinned without changing release assets. The four small published metadata and qualification bodies match the reviewed release-attachment hashes; all nine GitHub Release asset identities were verified before this selector preparation. For every selector, public byte, browser and offline acceptance are separately scoped post-deployment checks. P00 and P01 acceptance records remain under `delivery/evidence/`.

Archive13 now preserves v0.54 and v0.55 at infrastructure `58b21ebeff3c2d8e8ca37d5b7764f8203b8824ed`, deployment `6454910731`. Its complete 1,303-file / 624,422,286-byte public inventory passed without failures or retries. The added release-explorer bridge fixes the real game link; root exercised keyboard navigation through both archived titles, alongside scoped v0.55 online capture/save/load. The predecessor 404 and historical offline evidence remain recorded. This successor browser admission does not claim a new disconnected archive test or physical-device certification.

Archive17 now preserves v0.57.3 and v0.57.4 at infrastructure `d92391c40a1757de0497c2b7709c0a4925318e5a`, deployment `6472983959`. Its complete 1,323-file / 625,323,826-byte public audit passed without failed files, retries or skips. All 660 predecessor v0.57.3 payload rows remain exact; its native observations keep their original infrastructure and scope. New canonical v0.57.4 evidence covers an installed mission, an actual cut/capture, explicit pause/resume and re-pause. The native addendum records unresolved CSS viewport changes and final body focus: screenshot pixel dimensions are not viewport measurements. This admission claims historical online preservation, with no new offline, full keyboard, touch, physical-controller or responsive-layout acceptance. Original receipts, local inspection corrections, native captures and the addendum are retained separately under `evidence/archive-17/append-v0574/`.

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

## Archive18 preservation: v0.58.0

Archive18 preserves the original v0.58.0 release for historical online play when another edition becomes current. Its admitted infrastructure commit is `b83acdd80f0aaa35a72cff8c6b861250e894b1d7`, tree `69b9a690589500ea78b240ae242efb7309474730`, deployment `6474004290`. The original ZIP extraction and complete public HTTP audit verified all **665 files / 312,702,795 bytes**, without failed, retried or skipped files. The existing v0.58.0 catalog metadata and source revision remain unchanged.

The scoped native review covers the title, existing saved-flight restoration paused until explicit Resume, flight, a clock-expired result, retry, pause, audio settings and return to title. Original captures and the review are retained under `evidence/archive-18/native/`; the browser-admission record binds them to the exact archive deployment. This is historical online preservation, not a new phase acceptance, victory test, offline qualification, physical touch/controller test or audible listening pass. The historical v0.58.0 Team notice defect is preserved; this admission does not claim the v0.58.1 correction.
