# Reveal Line delivery status · 26 September 2026

This is the current execution view for the Ukrainian spatial-redesign programme and its immediate
release dependency. Older dated plans remain historical evidence, not a claim that their queued
versions or acceptance gates are still current.

## Public and release state

- Latest immutable and publicly accepted release: **v0.141.6**, published from exact source
  `d3b484363` with nine verified assets in guarded Fastline runs `36270086563` and `36270672580`.
  Its distribution is **612,291,985 bytes** and its compact source manifest is **4,547,777 bytes**.
  PR #703 and Pages main `b7857fff8` promote it. Documentation-only PR #704 subsequently advanced
  `main` to `494bc6a51` without changing runtime or release bytes. The complete public-byte audit
  passes and browser checks reach ready Solo (**91**), Versus (**91**) and Team (**12**) entry with usable primary
  actions. Full long suites remain explicitly skipped, not passed. The selector retains exactly five
  playable releases, while Archive99 independently preserves the exact v0.141.5 bytes.
- `main` reached this release through community S3 runtime work, publisher recovery/admission
  canaries, release root PR #696, S3 recovery PR #695 and publisher correction PR #697. The first
  guarded attempt stopped on a snapshot-binding defect without creating a public release. PR #697
  preserved the authority model by letting the terminal Fastline run own and inspect its exact
  artifact; no failed or stale source is represented as published. PR #695's S3 recovery work is in
  the immutable source. Its 88/88
  community-service cohort and repository validation pass. The pinned archived MinIO source now
  builds successfully. Head `f2529e3d4` adds retained failure logs and run `36262991676` proves the
  database initialization, migrations and MinIO startup succeed, then exposes an invalid local-socket
  fallback. Head `e28855184` parses the URI into explicit libpq environment fields and its focused
  gate passes. Run `36263377270` reaches seeded rows and restore, where PostgreSQL 17 rejects the
  unsupported `--exclude-table-data` restore option. Head `399acc48f` replaces that with fail-closed
  post-restore deletion of interrupted TUS rows. Run `36263743988` then exposes the final client
  contract gap: unlike `psql` and `pg_dump`, `pg_restore` requires explicit `--dbname` even when the
  parsed libpq environment is present. The bounded correction supplies the already parsed database
  name without placing credentials in process arguments and pins it across all runner wrappers.
  Exact-head run `36264035737` now passes the complete isolated MinIO recovery acceptance. Focused
  and release-ready gates also pass; full test/build remain explicitly skipped. The sole publisher
  owns selector/Pages promotion. PR #689 and later cultural work remain outside the immutable
  v0.141.5 source.
- Current `main` at `494bc6a51` contains merged PR #662's v0.141.6 source-manifest canary, the
  accepted Team neutral-poll fixture, PR #703's accepted Pages selector and PR #704's public-
  acceptance documentation. The cultural stack is locally replayed onto that exact main.
  Its creator, upload, localization, media, compact layout, Couch navigation, quick-start and
  publication files are preserved; no draft cultural version may downgrade them.
- Test-only PR #669 is superseded by PR #590's broader accepted clock/rearm fixture. PR #530's latest
  corrected-main hosted run passes the previously red controller-host cohort 8/8, but its Team
  remote-host file exposed a stale blur fixture: twelve records passed and the sole failure invoked
  an untrusted Back click before the accepted neutral poll. PR #689 isolated the one-frame fixture
  correction and passed two exact-head hosted focused gates before concurrent main movement; it was
  closed as superseded after the identical four-line patch merged as its own commit through PR #662.
  No runtime or cultural behavior changed in that fix. PR #530's first rebased run `36272467118`
  was cancelled during the focused command when a title/queue automation retriggered the workflow;
  its replacement run `36272613345` was rejected in preflight because the automation restored the
  obsolete v0.138 target. Neither event establishes a product-test failure. PR #530 now needs stable
  current-queue metadata and a fresh exact-head hosted run.
- The cultural/pacing successor chain through draft PR #672/v32, performance successor PR #676 and
  accessibility/performance successors PRs #685/#687/#688 remains one linear 31-tip stack.
  The source stack's **120** commits before this status-only update and all **31** stacked branch tips
  retain the same order and subjects. The first atomic exact-lease update completed on the accepted
  selector base. After PR #704 moved `main`, the final documentation-base replay onto `494bc6a51`
  is clean and range-diff identical **121/121** to that pushed selector-base replay. Relative to the
  original
  remote stack, the sole implementation difference is the first cultural release advancing the new
  base from `0.141.6` to `0.142.0`; the final plan-only commit is intentional. The 31 remote tips are
  ready for one final atomic exact-lease update. Manual resolutions regenerate translation bundles from both
  authoritative locale sets, preserve Team quick-start behavior, keep the first cultural release at
  `0.142.0`, and retain the cultural library's 327-row/v25 expectations. The exact
  top passes **14/14** corrected cross-owner continuation, **100/100** selector/library,
  **15/15** observer and **24/24** reduced-effects/settings/surface checks with zero skips. The prior
  **8/8** actual controller-host cohort was not rerun on this base, and the wider 109-case Team
  quick-start cohort remains prior-base evidence. The exact rebased top validates **10,175** localized
  messages / **8,029** references, **1,273** content files and presentation metadata. Range-diff is
  one-to-one except for the documented version baseline and this status-only update.
  All remote cultural tips were atomically updated on the selector base; the documentation-only
  PR #704 replay is prepared locally but not yet pushed. Independent PRs
  #657/#684 are superseded by merged PR #686 rather than being rebased again. The dirty root checkout
  was not changed.

## Completed source work

| Scope                                            | State                         | Evidence boundary                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ------------------------------------------------ | ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Journey Ukrainian spatial stack v12-v24          | Rebased and pushed            | Candidate source only; each draft PR still needs its own promotion and public verification.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| Apex v25 / PR #625                               | Clean draft, source `0.140.0` | Earlier focused and production-build evidence exists; the exact terminal-base head still needs release CI.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| Complete Team adoption / PR #630                 | Clean draft, source `0.141.0` | Complete twelve-mission Team edition is wired as current in the candidate stack, with older editions preserved.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| First Team Ukrainian slice / PR #636             | Clean draft, source `0.142.0` | Three redesigned identities, 78/78 focused integration evidence, earlier production build; not public.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| Second Team Ukrainian slice / PR #642            | Clean non-default draft       | Crossed gardens, Split orchards and Weaver crossing redesigned copy-on-write; no selector/default/version change yet.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| Second Team current edition / PR #650            | Clean draft, source `0.149.0` | Default/previous edition, Team library, Studio, exact Next, isolated progress and EN/UK wiring. Current v0.141.4-main tip `be43e3bce` maps from the prior exact 79/79 zero-skip Team cohort covering current/default entry, v1/v2 cultural routes, preset/seed feasibility, safe openings, no-Support exchanges, pinned full clears, handoffs, Studio, preserved impact editions and exact Next. Hosted exact-tip gates remain.                                                                                                                                                                                                                                                                                                                                                                                                                      |
| Unified-library fixture reconciliation / PR #651 | Clean draft, test/docs only   | Confirms 91 current + 48 prior Journey + 188 Classic = 327 unique rows and updates stale 201/279 and `whole-spatial-v5/v6` expectations to current v25 ownership. Current v0.141.4-main tip `0a4134a90` maps from the prior exact 82/82 zero-skip run; accepted gallery integration passes at the stack top, but the full four-file per-tip cohort is not relabelled as rerun.                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| Team opaque-owner continuation / PR #657         | Superseded by PR #686         | The opaque Team Classic-owner correction is now on `main` through merged PR #686. PRs #657/#684 remain historical reviewed evidence and should not be merged separately into the release line.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| Team blur fixture neutral poll / PR #689         | Superseded by merged PR #662  | PR #689's identical four-line test-only correction was replayed twice as main moved; exact-head hosted run `36267212538` passed focused and release-ready, with test/build explicitly skipped. A later exact-head rerun also passed focused before another main advance. The patch now exists as distinct commit `b3306cefd` in merged PR #662. PR #689 is closed without merge; no runtime, mission, save or release-byte behavior was changed by the fixture.                                                                                                                                                                                                                                                                                                                                                                                      |
| Current Journey pacing inventory / PR #661       | Clean stacked draft           | Adds a reusable runtime-prepared spatial-variety inspector and pins exact v25 facts: 91 source missions, 71 core missions, bands 1–12, consistent Standard craft speed and 21 post-opening open/plain review candidates. Current v0.141.4-main tip `35b9c2730` maps from the prior 4/4, ESLint and Prettier pass; this is not human balance evidence.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| Relay cultural completion / PR #664              | Clean explicit v26 draft      | Redesigns Spiral stores, Nested relays and Watchpost exchange from bounded official-museum vocabulary; preserves v25/default ownership and reduces post-opening open/plain candidates from 21 to 18. Current v0.141.4-main tip `125cb5389` maps from the corrected 156/156 zero-skip cohort and owns the accepted creator actor-material fixture pass-through. Hosted exact-tip gates remain.                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| Crosswind cultural completion / PR #665          | Clean explicit v27 draft      | Redesigns Survey markers, Compass array and Outer loop with original wall fields informed by three official museum records. Preserves v25/default and v26 ownership, actors, foundations, arrows and objectives; reduces the post-opening open/plain queue from 18 to 15. Current v0.141.4-main tip `2a1af6ab1` maps from its 159/159 zero-skip candidate, route, bootstrap and host cohort; hosted exact-tip gates remain.                                                                                                                                                                                                                                                                                                                                                                                                                          |
| Fracture/Apex cultural completion / PR #666      | Clean explicit v28 draft      | Redesigns Bank the crossing, Five anchors and Final broadcast with original spatial fields informed by official Opishne museum, UNESCO Crimean Tatar Örnek and Museum Fund records. Preserves v25/default and v27 history, gameplay rules, objectives, relays, bonuses and actor roles; reduces the open/plain review queue from 15 to 12. Current v0.141.4-main tip `906d8173d` maps from its 162/162 zero-skip cohort; hosted exact-tip gates remain.                                                                                                                                                                                                                                                                                                                                                                                              |
| Neon cultural completion / PR #667               | Clean explicit v29 draft      | Adds original wall fields to Folded corner, Inside out and Four quarters using bounded Museum Fund, Ivan Honchar Museum and UNESCO vocabulary. Preserves v25/default and v28 history, foundations, spawns, actors and rules; retains Side-door bays as an intentional open contour puzzle and reduces the review queue from 12 to 9. Current v0.141.4-main tip `f7473dbd6` maps from its 165/165 zero-skip cohort; hosted exact-tip gates remain.                                                                                                                                                                                                                                                                                                                                                                                                    |
| Rover cultural completion / PR #670              | Clean explicit v30 draft      | Promotes the reviewed Split berths and Stepped return Ukrainian/FPV geometry into the current chain while preserving the newer pressure actors and rules. Current v0.141.4-main tip `7510d2b6c` maps from its expanded 156/156 zero-skip cohort. The open/plain queue falls from 9 to 7; hosted exact-tip qualification remains.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Border cultural completion / PR #671             | Clean explicit v31 draft      | Adds original Reshetylivka aperture, Petrykivka branch and Kosiv bilateral wall fields to Second landing, Long rail and New frontier. Preserves current actors, objectives, bonuses, foundations, art and rules; current v0.141.4-main tip `60621f7a1` maps from its 170/170 zero-skip cohort. The open/plain queue falls from 7 to 4; hosted exact-tip qualification remains.                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| Border frontier/pocket completion / PR #672      | Clean explicit v32 draft      | Adds original Bukovyna wave/dogleg and Podillia end-weighted wall fields to Turn the corner and Return pocket. Preserves current actors, objectives, bonuses, foundations, art and rules. Exact current-main tip `fabd1c9d2` retains the prior 201/201 route/bootstrap/navigation and 18/18 compact/controller evidence; those older cohorts are not relabelled as rerun. The queue closes with Behind the patrol and Side-door bays retained as open lessons. Hosted qualification remains.                                                                                                                                                                                                                                                                                                                                                         |
| Mission-library lookup performance / PR #676     | Clean stacked draft           | Replaces repeated linear exact-identity scans with an accepted-revision index, reuses immutable per-mode rows and keeps focused cards visible after lazy preview layout. Mission order, ownership, launch, progression and saves are unchanged. Current v0.141.4-main tip `eea030324` has game tree `da30fcc36`; the v41 successor freshly passes the affected selector and corrected cross-owner continuation checks on this base. Earlier 107/107 library, 8/8 controller-host and 109/109 Team quick-start cohorts remain prior-base evidence. A local 4,096-row synthetic comparison measured 100,000 indexed lookups at 2.90 ms versus 5,171.22 ms for the previous linear algorithm; this is algorithm evidence, not a public-device performance claim.                                                                                        |
| Mission-selector accessibility / PR #685         | Clean stacked draft           | Adds single-column compact layout for Large text, a one-column fallback below 380 px, and forced-colour card/current/completion/unavailable/campaign cues that do not depend on themed raster borders or colour alone. The development-only observer now measures Solo and Versus mission-library opening against the current default Journey and accepts readiness only after the chooser is open with an enabled card. Runtime tip `6fe9191d8` maps to the v41 source that passes the focused selector/library cohort 100/100 and observer cohort 14/14 with zero skips; the prior 8/8 actual controller-host cohort was not rerun. A local 360×720 browser check retained all 327 cards in one 320 px column with no horizontal overflow; this is local browser evidence, not physical-device, public-build or forced-colour human qualification. |
| Gameplay reduced-effects parity / PR #687        | Clean stacked draft           | The explicit Reduced effects choice now mirrors the operating-system DOM-motion contract across Solo, Versus and Team: decorative animations, transitions, smooth scrolling and Couch overlay filtering stop while canvas-rendered trail, impact, capture and danger feedback remains under the existing renderer. Exact runtime tip `808f6d32b` passes 24/24 focused reduced-effects, settings-host, shared-surface and compact-selector checks with zero skips plus formatting and lint. The combined top also passes 14/14 corrected continuation, 100/100 selector and 14/14 observer checks. Frozen-build, OS-emulation, physical-device and human contrast checks remain open.                                                                                                                                                                 |
| Journey paint/memory observer / PR #688          | Clean stacked draft           | Extends the development-only, non-release observer to record Navigation Timing, Paint Timing and optional `performance.memory` snapshots at frame load and verified playable readiness without driving input or storing telemetry. Unsupported heap counters are recorded as unavailable rather than zero. Exact runtime tip `0103f02a5` passes 15/15 observer checks with zero skips plus formatting and lint. This is measurement infrastructure, not a frozen-build, public-device or cross-device performance result.                                                                                                                                                                                                                                                                                                                            |

After the earlier v0.132.5 main rebase, an uncontended bounded host rerun passed all selected corrected cases:
four Solo scenarios, four Versus scenarios, two representative Team source routes and the three-stage
Solo → Versus → Solo restoration. The test runner recorded 14 passing test/subtest records and no
failures. The earlier two chooser-opening timeouts occurred while another worktree continuously used
a CPU core; they were not changed-expectation failures. The full long host suite remains unrun.

PR #650's earlier exact rebased head passed **79/79 with zero skips** across current/default Team entry,
handoff and library behavior, both cultural editions, isolated progress, safe openings, alternate
routes across presets and seeds, no-Support partner exchanges, pinned full clears, preserved impact
editions, Studio and cross-campaign Next. It does not replace physical devices, public frozen-build
checks or human balance review. The v32 route/bootstrap/navigation cohort previously passed 201/201
and the compact/controller cohort passed 18/18; those wider cohorts were not rerun after the
v0.141.4 Couch-navigation rebase. The exact combined top instead has fresh 100/100 selector and
15/15 observer evidence. The 8/8 actual controller-host and 109-case Team quick-start cohorts were
not rerun on this base.

The second Team slice now has **13/13** focused checks. Every changed mission keeps one connected
field, idle-safe starts on all presets, two distinct no-down approaches, and a two-closure exchange
where the second pilot traverses the first pilot's reclaimed route without cutting or using Support.
Fresh input-only searches also found full clears on every preset; Standard routes are pinned at
33.8-52.2 seconds with both pilots contributing, no downs and no Support. This proves bounded route
feasibility and rules out a mandatory late-cleanup tail in those fixtures; it does not prove fun.

The three completion batches immediately after Relay retain earlier exact-tip evidence:
Crosswind passes **159/159**, Fracture/Apex passes **162/162**, and Neon passes **165/165**, all with
zero skips. These cohorts cover both authored approaches across presets, control styles and seeds,
safe openings, replay-stable Versus parity and the shared route/bootstrap/host integration. They do
not replace hosted gates, long suites, production builds, public frozen-build checks, physical
devices or human balance and cultural review.

The remaining completion tips likewise retain earlier local exact-tip evidence: Rover passed
**156/156** and Border passed **170/170**, both with zero skips. The final Border
frontier/pocket top previously passed **201/201** through its plan-only descendant; its current
v0.141.3-based runtime source is `04b4ba9db`. Together these receipts close the local focused
candidate/route/bootstrap/host queue
for v26-v32 on the accepted compact-gallery base. Hosted gates and every wider evidence boundary
above remain open.

## Remaining implementation and ETA

Effort starts when the item has an uncontested release or implementation slot. GitHub runner,
large-asset and archive delays are outside these estimates.

| Priority | Remaining item                          | Exit condition                                                                                                                                                                                                                                                                                                                                                                                                                                             |                                                              Indicative effort |
| -------: | --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -----------------------------------------------------------------------------: |
|        0 | Hosted exact-head qualification         | Run the focused hosted gates on the rebased tips and preserve truthful skipped-suite boundaries                                                                                                                                                                                                                                                                                                                                                            |                                                **2–6 hours per bounded batch** |
|        1 | Promote the cultural Journey chain      | Review/merge in dependency order, immutable release and public play for each accepted batch                                                                                                                                                                                                                                                                                                                                                                |                                         **1–2 working days per release batch** |
|        2 | Complete second Team slice and fixtures | Review PRs #650/#651, immutable public delivery and frozen-build checks; source wiring and bounded runtime/host verification are complete                                                                                                                                                                                                                                                                                                                  |                                               **3–6 hours** plus release queue |
|        3 | Team continuation and qualification     | PR #686 is merged, immutable v0.141.4 is published and the complete public-byte audit passes. Finish bounded browser acceptance. PRs #657/#684 are superseded. Paired-board fairness, physical controller/touch/keyboard, Skip, reload/Continue and broader frozen-build proof remain separate evidence                                                                                                                                                    |                                 **1–4 hours** plus release queue/device access |
|        4 | Whole-Journey accessibility/performance | The spatial disposition queue is resolved with two intentional open lessons retained. PR #676 removes the selector's quadratic exact-ID path; PR #685 adds compact Large-text/forced-colour treatment; PR #687 adds explicit reduced-effects parity; PR #688 adds navigation/paint/optional-heap observation. Remaining work is collecting real frozen-build measurements, human contrast review, physical compact devices and deterministic qualification | **2–4 working days** for remaining accessibility and performance qualification |
|        5 | Human balance and cultural review       | Understandable failures, distinct missions, enjoyable retries, Team cooperation quality and cultural review by people                                                                                                                                                                                                                                                                                                                                      |                             **1–2 days synthesis** after testers are available |

Versions through v0.141.6 are occupied by published immutable releases. v0.141.6 qualification,
freeze, inspection, publication, archive preservation, selector admission, public-byte audit and
bounded public browser acceptance are complete. Cultural draft labels do not reserve a release
number; the sole publisher assigns versions from the accepted predecessor when a batch is promoted.

## Blockers and concerns

1. **Serialized publication:** one publisher owns tags, frozen assets, archives and Pages. Feature
   preparation can continue in parallel, but releases cannot safely publish in parallel. v0.141.6 is
   public and accepted. A documentation-only acceptance merge crossed the first coordinated handoff;
   the publisher has been asked to hold further main merges while the final exact-base update and
   first cultural gate run. A green or clean status alone is not release permission.
2. **Long-suite waiver:** focused checks are real; skipped long suites are not passes. Exact source,
   validation, formatting, build/provenance, hashes, archive preservation and public availability
   remain mandatory.
3. **Second Team human balance:** bounded no-Support full clears now exist on every preset and the
   Standard routes are pinned. These do not establish human cooperation quality or enjoyment.
4. **Full-suite boundary:** the duplicate audit confirms the 327-row inventory is intentional and
   unique. The corrected focused cases pass, but the entire long host suite has not been rerun and
   is not represented as passing.
5. **Human/device evidence:** deterministic routes cannot establish enjoyment, cultural approval or
   physical controller/touch behavior.
6. **Disk pressure:** only reviewed disposable build caches were removed; worktrees, releases, media,
   patches and active task data were preserved. After concurrent publication/rebase work, free space
   recovered temporarily but is about 1.5 GiB during concurrent v0.141.5 qualification and the clean local
   replay. Avoid duplicate
   production archives and never remove unpushed source, user
   media or another task's workspace; further cleanup needs ownership-aware review.
7. **Host performance:** the uncontended PR #651 scenarios pass, but individual chooser paths took
   about 5.5–30.6 seconds in the fixture harness. This closes the corrected-assertion gap, not the
   broader startup/performance qualification.
8. **First cultural gate:** PR #530's corrected-main run `36257823669` passes the previously red
   controller-host file 8/8. Its only failure moved to the Team remote-host blur case: twelve records
   passed, while a synthetic untrusted Back click was attempted before PR #590's accepted lifecycle
   neutral gate had observed a neutral frame. PR #689 isolated the test-only correction and its exact
   old exact head passes blur plus Escape 2/2. Hosted run `36261809983` passes focused and
   release-ready on old exact head `4250151be`; full test/build remains explicitly skipped. The
   patch-identical v0.141.5 head `01872585b`; hosted run `36264694561` passes focused and
   release-ready with full test/build explicitly skipped. After two later exact-main hosted focused
   passes, the same patch merged in PR #662 as commit `b3306cefd`; PR #689 is superseded. Rebase PR
   #530 onto the final accepted base and rerun it. No cancelled or failed hosted run is represented as
   a pass.
9. **Inventory is not balance evidence:** PR #661 finds 21 post-opening missions with neither wall
   nor slow/lethal terrain and confirms consistent Standard speed and post-opening actor counts.
   Those are review candidates, not automatic defects; deterministic routes and human play still
   decide whether an open layout is distinct, fair and enjoyable.
10. **v26 remains opt-in:** PR #664 registers a preserved successor and repairs native bootstrap
    links for v12-v26, but deliberately leaves v25 as the default until review and release allocation.
    Its earlier exact-tip 156/156 zero-skip cohort does not establish enjoyment or cultural approval.
11. **v27 remains opt-in:** PR #665 registers a separate v27 review identity while keeping v25 as
    default. Its earlier exact-tip 159/159 zero-skip cohort passed, but it still needs hosted gates,
    review and promotion through the serialized release lane.
12. **v28 remains opt-in:** PR #666 preserves v25 as default and v27 as history. Its earlier exact-tip
    candidate/route/bootstrap/host cohort passed 162/162 with zero skips. Review, hosted
    qualification, promotion and public evidence are still required.
13. **v29 remains opt-in:** PR #667 preserves v25 as default and v28 as history. Its earlier exact-tip
    candidate/route/bootstrap/host cohort passed 165/165 with zero skips. Review, hosted
    qualification, promotion and public evidence are still required.
14. **v30 remains opt-in:** draft PR #670 preserves v25 as default and v29 as history. Its earlier
    exact-tip candidate/route/bootstrap/host cohort passed 156/156 with zero skips. Hosted qualification,
    review, promotion and public evidence are still required.
15. **v31 remains opt-in:** draft PR #671 preserves v25 as default and v30 as history. Its earlier
    exact-tip candidate/route/bootstrap/host cohort passed 170/170 with zero skips. Hosted
    qualification, review, promotion and public evidence remain.
16. **v32 remains opt-in:** draft PR #672 preserves v25 as default and v31 as history. Its earlier
    candidate/route/bootstrap/navigation cohort passed 201/201 with zero skips and its
    compact/controller integration passed 18/18. After the v0.141.3 rebase, fresh combined-top
    selector and Team quick-start cohorts pass 107/107 and 109/109 respectively; the wider v32
    cohort is not relabelled as rerun. The two remaining open/plain boards are intentional accepted
    lessons, not unfinished count targets. Hosted qualification, review, promotion and public
    evidence remain.
17. **Selector performance evidence is local:** draft PR #676 removes the known quadratic exact-ID
    lookup path and passes its bounded regression cohort. A 1280×720 local browser opened the full
    327-card selector with 15 near-viewport canvases and exposed a focused-card shift after lazy
    preview layout; the same PR now corrects and regression-tests that shift. This remains local
    browser evidence: production startup/paint, compact-device memory and frozen-public measurement
    are open.
18. **Selector accessibility evidence is local:** the v40 successor deterministically qualifies its
    Large-text and forced-colour CSS contracts, and a local 360×720 browser retained the 327-card
    library as one 320 px column without horizontal overflow. Forced-colour human inspection,
    physical touch/controller use, frozen-public timing and compact-device memory remain open. The
    development observer records library readiness but does not itself supply a passing public
    sample.

## Immediate execution order

1. Preserve v0.141.6 as the accepted public baseline; do not duplicate its release or Pages
   mutations. Its skipped long suite remains a skip, not a pass.
2. Atomically update all 31 cultural remote tips from the clean 121-commit replay on `494bc6a51`,
   using exact old-head leases, correct PR #530's obsolete queue target and rerun its focused hosted
   gate.
3. Complete hosted review for locally qualified PRs #650 and #651, then qualify PR #661's pacing
   inventory at its exact rebased head.
4. Review PRs #664-#672 in dependency order. Do not redesign Behind the patrol or Side-door bays
   merely to force a zero open/plain count; both are documented intentional lessons.
5. Promote accepted cultural releases through the sole publisher, reporting immutable release and
   actual public delivery rather than a merge or workflow start.
6. Review PR #676 after its v32 predecessor. Measure the indexed selector in the real browser and
   retain the accepted lazy-preview, focus, download and owner-isolation contracts.
7. Review PR #685, the v40 selector-accessibility/measurement successor, after PR #676. Collect
   frozen-build Solo and Versus library-open timing without relabelling its local 360×720 check as
   device or public evidence.
8. Review PR #687 after PR #685. Run its OS-emulated, frozen-build and physical-device checks without
   relabelling the 24-case source cohort as human contrast evidence.
9. Review PR #688 after PR #687, then collect its navigation, paint and optional heap snapshots from
   actual frozen builds without comparing unsupported browser counters as if they were zero.
10. Run the remaining gameplay-surface contrast, physical-device and human balance/cultural
    qualification work after the source batches are frozen.

The original P13-P15 whole-Journey pacing, Team cooperation, accessibility/performance and final
human acceptance remain incomplete.
