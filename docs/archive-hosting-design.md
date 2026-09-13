# Playable archive hosting

The approved transition keeps current releases on the main Pages site and copies older frozen sites to bounded archive repositories on the same GitHub account. No frozen file, source archive, ZIP, manifest or tag is rewritten. The initial allocation is explicit in [pages-archives.json](../scripts/pages-archives.json): 31 versions through v0.26.0 belong to `mekhovov/revealline-archive-01`; v0.27.0 and newer remain on the main site. Repository creation, deployment and browser migration acceptance are release-owner steps, not outcomes of the local builder tests.

## Capacity and alternatives

The exact v0.27 layout is 891,397,420 bytes with 32 independently playable versions and a duplicate current root tree. Its 950,000,000-byte guard leaves 58,602,580 bytes. Another 68,241,024-byte playable edition cannot fit even before adding its metadata. [pages-capacity.mjs](../scripts/pages-capacity.mjs) measures the existing layout without building or changing it; a proposed future size is only a payload lower bound and can prove failure, never readiness.

GitHub documents a [1 GB published-site limit](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits). The [official upload action](https://github.com/actions/upload-pages-artifact#artifact-validation) excludes symbolic and hard links. Compressed upload archives do not remove the published-size restriction. Deleting the duplicated latest copy would buy only one release while changing the root URLs' behavior. A service-worker virtual filesystem would interfere with the historical integrity workers and introduce a new runtime dependency. Neither is the chosen solution.

Each archive has an 800,000,000-byte guard; the main site's 950,000,000-byte guard stays unchanged. A full shard is closed to new allocations. Subsequent shards are explicitly reviewed additions; never reassign an existing canonical version or silently evict it. This spreads independently playable history across [separate project sites](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages), not a claim of unlimited Pages capacity. Future production media and bandwidth still require capacity planning.

The local v0.27-based split measures **754,925,608 bytes** for archive-01 and **137,355,505 bytes** for the main artifact after the reviewed worker-origin guard. The first contains 31 versions; the main index retains all 32 versions, with v0.27 still copied at the root and its versioned path. These are prepared local artifacts, not deployed-site measurements.

## URL and byte contract

The canonical old game becomes `https://mekhovov.github.io/revealline-archive-01/releases/v0.26.0/site/game/`. Every original file beneath that `site/` is copied exactly except the redundant `distribution.zip`, which remains the original asset on the original repository's GitHub Release. The original checksum, manifest, worker, secondary tools, fonts and artwork are included. GitHub [Release assets](https://docs.github.com/en/repositories/releasing-projects-on-github/about-releases#storage-and-bandwidth-quotas) remain downloads, not a browser asset origin.

At the standing main-site paths, every old HTML document gets a native fallback link and a small `location.replace` bridge to its matching canonical document. Query parameters and fragments survive. This covers the landing page, game, couch, Playground, Replay Theater, controller lab, credits and every other HTML entry actually present in each version; no hand-maintained entry list is used. Original `release.json`, `site/manifest.json` and ZIP checksum bodies remain at their old URLs too. The version index retains the old `play` field, adds `canonicalPlay`, and sends Play directly to the canonical site. ZIP links continue to use the original repository and version tag.

Old JS, JSON, image and other binary asset URLs move to the canonical prefix; they are not HTTP redirects or byte-identical resources at the old prefix. Original HTML and worker bytes remain exact at the canonical path, while old HTML and worker delivery URLs deliberately serve migration documents. This is the explicit exception to the previous all-URLs byte-comparison policy. Current root and current versioned runtime files still match the frozen release exactly.

## Profiles and offline migration

Both sites use HTTPS on `mekhovov.github.io`, so the path change keeps the same [localStorage origin](https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage) and [IndexedDB origin](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API/Using_IndexedDB). The inspected host uses release-version channel keys for profile, installed packs, suspended attempts and writer locks, not the pathname. The soundtrack database name also remains unchanged. Existing version isolation, writer contention and historical schema limits remain; no profile copy, database upgrade or data deletion is added.

Offline registration and cache names include the distribution [scope URL](https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerRegistration/scope). A new canonical prefix therefore needs its own normal Prepare offline journey. Existing cached old HTML can intercept navigation before a bridge runs. Only the old public `service-worker.js` delivery URL receives a small retirement worker: normal installation/activation, no `skipWaiting`, no `clients.claim`, no forced navigation and no cache/profile/IDB clearing. On activation it unregisters that registration; its bounded navigation handler can forward same-scope documents. It does not intercept asset fetches or unrelated origins/scopes. [Unregistering](https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerRegistration/unregister) is not an immediate replacement of currently running clients.

An already-open historical game may continue under its existing worker until its controlled tabs close; its next old-path navigation may need another load after activation. The main version index's direct canonical link bypasses that old scope immediately. This transition never certifies offline readiness, and it must not interrupt a live attempt. Existing old caches are retained; their storage can be reclaimed later only through an explicit user action.

## Build and deployment order

The default `node scripts/build-pages.mjs` remains unchanged in routing. The release owner activates the reviewed plan explicitly:

```sh
# In a full checkout of the approved source commit, with its exact version tag:
node scripts/build-pages.mjs --archive-plan scripts/pages-archives.json --archive archive-01 --source-repository mekhovov/revealline

# Only after the archive is deployed and its exact files and journeys pass:
node scripts/build-pages.mjs --archive-plan scripts/pages-archives.json --source-repository mekhovov/revealline

# Read-only current-layout projection, with an assumed next tree size:
node scripts/pages-capacity.mjs 68241024
```

The first command produces `dist` for the archive repository's Pages workflow. That workflow should check out `mekhovov/revealline` at the reviewed full 40-character source SHA, fetch its tags, install its pinned dependencies, run the archive command, upload `dist` with `actions/upload-pages-artifact@fc324d3547104276b827a68afc52ff2a11cc49c9` (v5.0.0), and deploy using `actions/deploy-pages@v4`. The workflow runs **in the archive repository**, so its own Pages token targets that site. `--source-repository mekhovov/revealline` is essential: release downloads and tag ownership belong to the original repository, not the workflow repository. No cross-repository deployment token or runtime cross-origin fetch is required.

Both archive and main upload steps must use that pinned v5 action with `include-hidden-files: true`; v4 does not support this input and still excludes hidden files. Their strictly constructed `dist` includes the `.nojekyll` marker and historical `.xonix-build.json` metadata; these are part of the public byte inventory, not audit exclusions. Reject unexpected hidden files/directories, links and special files before upload, rather than including repository internals or credentials.

The initial public audit stopped locally on historical metadata before any HTTP request; its [preserved failure](../.cache/round37/archive-hosting/public-archive-01-attempt-1/fatal.json) remains unchanged. Adding the input to v4 was ineffective: [deployment 34731608651](https://github.com/mekhovov/revealline-archive-01/actions/runs/34731608651) succeeded with an unsupported-input warning, while the [second public audit](../.cache/round37/archive-hosting/public-archive-01-attempt-2/results.jsonl) recorded hidden-file HTTP 404 failures. It continues checking the remaining assets, but cannot pass with those failures. The owner is replacing the upload action with pinned v5 and redeploying; a new complete public audit is required afterward. Workflow success alone is not public byte acceptance.

After the archive passes public checks, update the main deployment command to the second form. Record the approved routing plan, source commit and both deployment run IDs. Keep the original root layout until that ordering is satisfied. Builders prepare a sibling staging directory and promote it only after copying and capacity validation; a failed preparation retains the last local `dist`. Output is limited to `dist` or a directory under project `.cache`. Frozen release creation retains its existing explicit tag/source checks. No automatic shard creation or allocation is performed.

## Acceptance

Focused tests cover exact main/canonical payload copies, all secondary HTML bridges, encoded query/fragment preservation, original download links and metadata, strict ownership/current-version exclusion, fixed independent budgets, scope-limited retirement and failure retaining the prior artifact. These are Node/filesystem/worker-handler checks, not browser migration evidence.

Local verification found 3,852 exact canonical files, 228 HTML bridges, and unchanged 4,153 local frozen files / 5,720,026,008 bytes plus all 33 tag refs. The [artifact record](../.cache/round37/archive-hosting/verification.json) and [nine-case focused test log](../.cache/round37/archive-hosting/tests-reviewed.tap) retain the evidence. Independent review caught and closed a redirect-origin edge case before publication; prior local reports remain separately preserved. Test and artifact scopes are separate; neither certifies cached-browser migration or repairs an older release's documented defects.

Before main routing switches, independently hash **every** canonical payload and original metadata against the local frozen trees; compare all prior local release/tag pins. Check public content types and representative root/versioned/canonical bytes. Browser acceptance must cover fresh and previously offline-controlled old links, all secondary entry families, saved-library/attempt retention, same-version writer contention, explicit canonical offline preparation and a server-unavailable reload. Test a running old tab during retirement, and verify it is not forcibly navigated. Check current root play separately. Preserve failures and distinguish desktop browser emulation from physical devices. Follow the existing [delivery workflow](feature-delivery-workflow.md); a successful archive build alone is not public delivery.
