# Offline play, download size and unique missions: reviewed plan

Reviewed on 30 September 2026 against freshly fetched main
`09a43d83351af276f184293ed3c72261575ed8bc`. This is the current plan for this
workstream. Earlier status files retain their original observations and test
results; they do not describe current release status.

The foundation is implemented, but **none of the five complete acceptance gates
in the approved unique-missions/offline plan is closed**. Remaining work includes
both implementation and proof through real player journeys. A merged PR, a
successful build and an installed-device result are different evidence.

## Player requirements retained

- Anyone can play available content online without installing an app, preparing
  an offline package or accepting an installation popup. Mission entry never
  invokes preparation. This supersedes the original missing-chapter consent gate;
  see [the current policy](../optional-offline-play.md).
- Install & offline play is an explicit menu choice. Show sizes before consent;
  afterward download, verify and prepare automatically. Reopening an interrupted
  preparation requires confirmation of the remaining transfer.
- Recorded music is independent of gameplay readiness. Recorded spatial effects
  are a separate optional extra; essential feedback must work through synthesized
  fallback with no recordings installed.
- Preserve progress, exact earned pictures, replays, user imports, historical
  identities and the last working installation. Keep frozen releases unchanged.
- Do not claim universal offline support or unique current artwork before the
  corresponding device, design and visual gates pass.

## Completed foundations and remaining phase gates

“Implemented” means present in inspected main. Historical focused checks apply
to their recorded source, not to a fresh all-main run.

| Original phase                       | Implemented                                                                                                                                                                                 | Remaining gate                                                                                                                                                                                            |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Inventory and preservation        | Base/company ownership reports, byte/pixel/physics comparisons, lifecycle classifications, archived discovery, conservative played-package retention and corrupt-owner cleanup protection.  | Refresh stale roster inputs; review every effective assignment; restore old saves, suspended flights, replays, earned pictures and backups through retirement/replacement.                                |
| 2. Distinct gameplay                 | Five neutral candidates, design/art briefs, real Solo/Versus/Team player, public-input recordings and replay verification. All five have first-return probes.                               | Complete candidate clears, alternative routes, failure/difficulty observations, design review and procedural variety measurements. A control mission clear does not qualify replacements.                 |
| 3. Unique artwork                    | Exact bytes/pixels, rotated/reflected copies and bounded similarity screening; contact sheets and explicit new-art review gate.                                                             | Actual approved replacement compositions, provenance/rights/descriptions, visual/in-game review and unchanged historical rewards. Screening alone is not originality approval.                            |
| 4. Smaller packages and installation | Direct menu controls, installation guidance, Horizon starter, per-pack Solo snapshots, optional mode runtimes/music, verified per-file checkpoints and automatic preparation after consent. | Remaining mode-internal splits, external binary artwork, rendition/export compatibility, precise reclamation and fresh size/update measurements. Rolling-main update safety needs separate qualification. |
| 5. Verification and release          | Publishing integration, scoped automated evidence and limited desktop offline/update journeys; current main is deployed.                                                                    | Exact-candidate complete blocked-network journeys, failure recovery, physical installed-device matrix and applicable source/artifact/public acceptance.                                                   |

Evidence: [implementation history](implementation.md),
[download/ownership model](../offline-pwa/README.md),
[pilot observations](PILOT-OBSERVATIONS.md), [screening](ARTWORK-SCREENING.md),
[retention repair](RETENTION-RECOVERY-2026-09-28.md).

## Corrections to the previous status

1. [PR818](https://github.com/mekhovov/revealline/pull/818) is merged. Subsequent
   main changes expanded optional extras from three to **four**: flight practice,
   Demo recordings, landing artwork and spatial sound effects. Their dependency
   is now shared runtime only, not every mode runtime. They remain unselected by
   Starter/All current gameplay and independent of readiness. See
   [the grouping policy](../../scripts/offline-content.mjs).
2. The company inventory is stale. Its catalogue pin describes 77,797 bytes and
   **14 editions / 26 retained presentations**. Today's catalogue is 167,733 bytes
   and contains **18 edition descriptors / 59 retained-presentation descriptors**;
   SHA-256 `2f7d5b08ef2826f161002943407f10dc09e7b126ae84bf12e92f5a924f205ecd`.
   These fresh descriptor counts are not regenerated mission/artwork totals.
3. The [rolling main deployment](https://github.com/mekhovov/revealline/actions/runs/36759567741)
   succeeded. Public `game/build-info.json` returned this exact main revision and
   game version `0.142.4`. Its receipt reports **949,948,426 hosted bytes**, leaving
   **51,574 bytes** below the 950,000,000-byte budget. Hosted payload is not the
   amount every player downloads. No public playthrough was performed here.
4. Latest immutable GitHub release remains
   [v0.142.3](https://github.com/mekhovov/revealline/releases/tag/v0.142.3), distinct
   from rolling Pages and the existing
   [v0.150.0 integration milestone](https://github.com/mekhovov/revealline/milestone/57).

### Relevant open PRs at this checkpoint

| Input                                                    | Contribution and evidence                                                                                                                                                                                    | Remaining boundary                                                                                                                                                     |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [PR869](https://github.com/mekhovov/revealline/pull/869) | Repairs projected-menu/offline checker assumptions and durable test-cache bodies. Reports 18 edition checker builds and 26 focused checks. Largest mandatory edition cache: 65,888,818 bytes, within 64 MiB. | Open verification repair, not a new player download flow. Integrate and verify the final source.                                                                       |
| [PR858](https://github.com/mekhovov/revealline/pull/858) | Stops failed optional sound requests repeating every render frame; five-second cooldown and explicit activation retry. Reports 167 checks and desktop Solo play after stopping the origin server.            | Open. Its Starter plus optional SFX observation does not qualify zero-extra iPhone play or every mode.                                                                 |
| [PR868](https://github.com/mekhovov/revealline/pull/868) | Restores two exact older Team import themes. Reconstructed fixtures exercised real import/play/retry.                                                                                                        | Open, capacity/provenance held: proposed payload 951,900,757 bytes before publication metadata exceeds the cap. Not proof of all historical user-backup compatibility. |

These are recorded PR results, not tests rerun for this document. Review admitted
changes on the final source; do not duplicate the pending work or label it released.

## Remaining items explained

P0 means immediate delivery risk or the reported failure. P1 means the next useful
bounded batch. P2 means independent work that should not delay reliable-play fixes.
These are recommendations for review, not new release allocations or changes to
the wider programme's approval policy.

### R1. Verify unrestricted online play — P0

**Work:** On the exact public/candidate build, enter previously unvisited Solo,
Versus, Team and company missions with no downloads, including denied persistent
storage. Confirm no install popup, package preparation or worker prerequisite.
Keep [local retention](../../game/offline-download-access.mjs) best effort.

**Why / benefit:** The source fix exists; verifying deployed behavior prevents a
repeat of “fixed locally, still broken publicly.” It protects the primary game.
**Deferring it risks:** locking ordinary players out despite passing downloader
fixtures. **Complete when:** exact public journeys succeed without offline consent,
with build identity and requests recorded. Repeat this protection for packaging changes.

### R2. Restore hosting headroom — P0

**Work:** Account for exact candidate bytes; remove redundant delivered copies
where identities permit; qualify capacity before admitting larger inputs. Preserve
compatibility dependencies and original assets. Do not silently raise the limit.

**Why / benefit:** Only 51,574 bytes of headroom remain in the inspected live build.
An optional file still occupies hosting space when shipped on Pages, even though
players can exclude it from their download. **Deferring it risks:** blocking otherwise
ready releases. **Complete when:** integrated output, publication metadata and
admitted inputs fit the existing budget with documented headroom. PR868's oversize
candidate is separate from the live build, which passed its capacity check.

### R3. Qualify rolling-main installation and updates — P0

**Work:** Prepare A, publish B at the same rolling URL, then test old icon launch,
update detection, repair, retained selection, suspended play, profile continuity
and rollback. If needed, add a verified build identity/retention strategy that
keeps A independently recoverable.

**Why / benefit:** Historical A → B evidence uses separate immutable URLs.
[Installed state](../../game/installed-app.mjs) retains version/scope/selection;
[launcher update messaging](../../game/offline/app.mjs) compares scopes. Rolling
deployment overwrites a path without necessarily changing semantic version.
This is a qualification gap, not a reproduced data-loss incident.
**Deferring it risks:** misidentifying a changed build or losing a recoverable
previous edition. **Complete when:** exact-source updates and interrupted/failed
updates preserve progress and usable A, including competing windows and partial music.

### R4. Prove cold offline play on real devices — P0 iPhone reproduction, P1 matrix

**Work:** First prepare only Starter, with zero music and zero optional SFX, inside
the iPhone Home Screen app. Close it, block actual outbound requests, launch from
the icon, open an unvisited included mission, finish it and view the original
reward. Record exact build/OS/browser versions and requests. Extend to selected/
all-current downloads, complete Solo/Versus/Team journeys, physical iPad/Android,
desktop Chrome/Edge and Safari Add to Dock.

**Why / benefit:** Downloaded files alone do not prove that the launcher, mission,
artwork and save dependencies survive a cold start. This directly reproduces
“Flight unavailable: load failed.” **Deferring it means:** support claims remain
unproven on the reported device. **Complete when:** actual installed evidence
covers cold launch, rotation, audio activation, background/resume, held-input
clearing and controllers. Desktop server-offline observations are partial evidence.
Device availability is an external dependency; no invented completion date.

### R5. Finish recovery, audio independence and historical restoration — P1

**Work:** Exercise mid-file interruption, app closure/worker termination, corrupt
or evicted assets, quota exhaustion and denied persistence. Test update cancellation,
busy writers, incompatible saved flights and interrupted migration. Restore old
saves/replays/earned pictures/backups across archival and replacement using exact
fixtures and explicit unchanged-gameplay mappings. Cover zero/some/all music,
zero/partial/full spatial effects, blocked/slow hosts, mute/pause and explicit playlists.

**Why / benefit:** Checkpoints, locks and fallback code already exist; real lifecycle
evidence establishes that they protect progress and responsive startup. PR858 fixes
one concrete optional-SFX retry storm. A partially loaded SFX bank needs its own
fallback check; zero-buffer behavior does not prove it.
**Deferring it risks:** repeated large transfers, inaccessible historical content
or missing feedback after failed optional downloads. **Complete when:** verified
files remain reusable, incomplete groups never report ready, imports/preferences
survive removal, failed updates retain a working game, and history restores exact
content. Required before dependency retirement or artwork-format changes.

### R6. Refresh ownership and size reports — P1, parallel

**Work:** Regenerate effective base/company ownership and screening against the
selected candidate, including presentation overrides and procedural backgrounds.
Recompute complete package dependencies, fresh/incremental downloads, stored payload,
verification/update peak and safely reclaimable bytes.

**Why / benefit:** New catalogue descriptors are absent from the old report. An
accurate inventory identifies which pictures need replacing and what consumes space.
**Deferring it risks:** replacement and optimization decisions based on an incomplete
roster. **Complete when:** reports reproduce the selected source and every owner/
dependency has a disposition. The historical 12 Classic shared groups and 106
authored originals reused across revisions are different categories, not a request
for 118 new pictures.

### R7. Make selected packages genuinely smaller — P1, separate slices

**Work:** Externalize embedded artwork from new official JSON/base64 packages into
individually verified binary files, retaining legacy readers/exports. Separately
split remaining Versus/Team chapter internals; their mode packages still contain
complete route sources. Preserve compiled gameplay identities, discovery, saves,
replays and original appearance authority.

**Why / benefit:** Binary reuse can remove repeated payloads and parsing overhead;
chapter splitting avoids unrelated route downloads. **Deferring it means:** a
small selection remains unnecessarily heavy, with greater storage/memory pressure.
**Complete when:** compiled parity and dependency closure hold, online loading
still needs no preparation, UI sizes match manifests, and before/after measurements
show actual savings. No speculative percentage or dependency on bulk new artwork.

### R8. Reclaim storage safely — P2; earlier if quota failures dominate

**Work:** Explicit bookmark-checkpoint removal and precise save/replay/reward-aware
cleanup. Current played-content pins retain whole closures; main chapter removal
does not remove separate bookmark owners. Explain reclaimable bytes before deletion.

**Why / benefit:** Recover space without losing pictures, replay dependencies or
imports. **Deferring it means:** safe removal may reclaim much less than the original
download and unused ownership records accumulate. **Complete when:** only unreferenced
official bytes are removed under the lock; unknown/corrupt ownership prevents
destructive cleanup. Depends on R5; see [the limitation](BOOKMARK-RECOVERY.md).

### R9. Finish the pilot and procedural variety evaluation — P2

**Work:** Complete five candidates, record alternate routes and failure points,
compare difficulty/duration against controls and Team's Twin Landings. Use
deterministic procedural seeds covering supported extremes; compare branching,
exposure and return distances. Review actual decisions, not just hashes/layouts.

**Why / benefit:** Avoid commissioning art for repetitive or unfair missions.
**Deferring it means:** replacements cannot claim meaningful variety. **Complete
when:** design review accepts complete-run evidence and the intended decisions
before promotion/bulk artwork. Formal player sessions and production review remain
subject to the wider programme's current deferral; preparation can continue without
pretending approval occurred.

### R10. Produce approved distinct artwork — P2, after R6/R9

**Work:** Review refreshed sheets, then create compositions in small approved
batches. Preserve Solo Journey/Homeward originals; replace current Versus sharing
and identified Frontier/Pressure Lines conflicts where refreshed ownership confirms
them. Retain masters, rights/provenance, descriptions and exact earned originals.

**Why / benefit:** Each separately listed current mission gets a recognizable
composition and distinct reward. **Deferring it means:** visual duplication remains,
but reliability fixes can ship. **Complete when:** no unexplained current duplicates
remain, exact/transform checks and human visual/in-game review pass, and historical
rewards restore unchanged. New unique originals may increase storage; uniqueness
is not itself an optimization.

### R11. Qualify lossless formats — P2, after package contracts

**Work:** Introduce a versioned rendition descriptor separating artwork identity
from delivered MIME/hash/size/dimensions. Then qualify lossless WebP against pixels,
colour, transparency, collections, backups and exact-byte exports. Preserve masters
and readable PNG contracts; keeping both mandatory encodings may erase savings.

**Why / benefit:** Reduce bytes without changing artwork or breaking original exports.
**Deferring it means:** larger payloads, but avoids an unsafe format conversion.
**Complete when:** compatibility and measured savings pass for each adopted encoding.
This follows externalization and preservation, not a blanket PNG replacement.

### R12. Qualify optional offline experiences — P2

**Work:** Complete offline practice, Demo playback, selected landing artwork and
recorded spatial-effect journeys when explicitly downloaded. Their absence or failure
must never invalidate gameplay readiness.

**Why / benefit:** Makes the selectable extras trustworthy. **Deferring it means:**
those extras need narrower support claims; core gameplay need not wait.
**Complete when:** each extra has complete dependencies, its own offline journey
and independence evidence. Audio safety/fallback in R5 stays higher priority.

## Recommended delivery batches

| Batch                                 | Scope                                                                               | Release boundary                                                                                                                            |
| ------------------------------------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| A: reliable play and delivery         | R1/R2; relevant PR869/858 admission; R3 rolling updates and R4 iPhone reproduction. | Ship bounded fixes as they qualify. Capacity/data-loss findings block affected additions. Broad installed/update claims wait for evidence.  |
| B: preservation and smaller downloads | R5/R6; then R7 external artwork and mode splits as independent PRs.                 | Preserve identities/online access, provide fresh measurements and fit hosting. Device/recovery work runs alongside.                         |
| C: distinct content                   | R9 pilot review, then R10 approved artwork batches.                                 | Refreshed inventory, preservation and design/visual approval required. Do not delay A/B for bulk production or deferred participant review. |
| D: further efficiency and extras      | R8 reclamation, R11 formats, R12 optional experiences.                              | Independent slices with their own safety/compatibility evidence; move reclamation earlier only if storage failures justify it.              |

Use the existing v0.150.0 milestone for admitted inputs; do not allocate a competing
number. Re-read live PR/milestone status before integration. Historical predecessor
wording is not proof those versions are published. The current
[continuous deployment workflow](../../.github/workflows/deploy-main-pages.yml)
builds protected main separately from immutable publication. Keep one immutable
publisher and distinguish source merge, rolling deployment, public play acceptance
and immutable release. Independent unfinished content should not delay a qualified fix.

## Size and verification limits

The [frozen v0.141.7 report](packages.md) measured Starter **63.47 MiB**, all current
gameplay **567.39 MiB**, optional music **346.78 MiB** and zero gameplay MP3s. Its
official content alone included 306.29 MiB PNG, 116.60 MiB media packs and 102.03 MiB
JSON. Type figures exclude separately counted runtime/launcher; selection totals
include them. These are historical payload numbers, not today's download or actual
browser storage. The withdrawn 393 MiB projection remains withdrawn.

The 949,948,426-byte receipt measures everything hosted, including assets outside
a player's selection. Core-cache capacity, transfer, installed storage and update
peak must remain separate numbers. New unique artwork changes saving assumptions.

This review used source/Git inspection, small GitHub/public-metadata reads and
existing evidence. It did not regenerate large reports, build the product, run
automated suites, play the public game or test devices. The repository's
[focused-suite waiver](../focused-test-waiver-20260930.md) remains
**WAIVED_SKIPPED_NOT_PASSED**; historical passes are not relabeled as current.
Source identity, applicable validation/formatting, provenance, build, capacity and
publication checks still apply. No completion percentage or unsupported date is assigned.
