# Company journeys

See [shared Solo implementation and acceptance boundaries](company-editions-shared-solo.md)
for the canonical host, selected tool pages and evidence required before qualification.

Company editions reuse Reveal / Line's deterministic simulation, renderer, replay verifier,
campaign compiler and Journey store. `game/company.html` is the edition entry point; the current
implementation connects company content to the canonical Solo host. The current catalog contains 12 editions across six brands. Historical default content and the original Portuguese DroneAid pilot keep separate content identities. A changed catalog requires fresh release qualification; historical results below do not certify the current artifact.

## Try a draft

Run `node scripts/game-cli.mjs serve --port 8768`, then open
`http://127.0.0.1:8768/game/company.html`. Choose a company and audience in the selector.
The catalog contains the preserved three-mission Portuguese DroneAid pilot, seven Netherlands selections (the combined `droneaid-nl-community` edition plus six chapters), and Social Drone UA, Victory Drones, Ukraine: Living Culture and FPV Learning. The generator produces their reviewed JSON catalogs and content.

The Netherlands avatar uses the exact four propeller
paths extracted from the official Dutch logo, spinning twice per second. Original source
marks remain unchanged; reduced motion stops continuous rotation. DroneAid Netherlands uses six FPV quad families across all seven enemy roles, with four motors, a forward camera and animated propellers. Shared role badges, contact rings, warnings and enemy behaviour stay engine-owned. These are fictional game obstacles, not portrayals of workshop participants or recipients.

Six DroneAid Netherlands campaigns contain 36 distinct maps;
the three historical Portuguese maps remain available separately. The Netherlands missions pin
`journey-trail-impact-v3`, `journey-actors-v9` and `journey-difficulty-v2`. The host applies its
normal `gameplay-pressure.v4` attempt recipe once; authoring does not bake it into geometry.
The historical pilot retains its exact earlier policy and source bytes.

Current content now uses genuine encounter progression, rather than repeating an
introductory enemy roster in every chapter. Netherlands windows are Bands 1–2, 3–4, 5–6, 7–8, 9–10 and
11–12. Each chapter introduces its assigned mechanic before combining it later.
The later chapters use moving frontier patrols, capture-activated roamers,
territory eroders, finite trail/heading locks, warning lanes, numbered return gates,
directional fields and shield/core encounters. These are the main Journey's
registered primitives. The retained original wall/foundation topologies remain distinct;
new gates and directional fields are explicit authored geometry, never scenery rules.
The Netherlands gameplay successor advanced campaign/pack/edition revisions to 2. Changed
mission and map revisions also advance; prior frozen releases retain their own pins.
Later standalone chapters are introductions to advanced mechanics, not novice
Band-1 courses. Their onboarding and pacing need human testing.

## Author and compile

The guided authoring page is `authoring/company-studio/index.html`. It edits a bounded source
packet and links the existing Asset Studio. Preview/export uses the Node compiler rather
than executing arbitrary uploaded code in the browser.

After verifying a compiled preview, step 06 records per-mission artwork observations against
that exact artifact and picture revision. Record the observer, actual viewport, motion and
scene state, then mark each check observed, issue or not observed. Export the observation
packet before closing the tab. Optional generation receipts expose matched inspection notes
and warnings without fetching original masters. Changing the source or verified artifact
preserves prior notes for export under their original binding; explicitly discard them before
starting a new artifact's record. These packets support final review but never grant approval.
Source and observation imports enforce byte limits while reading, before JSON parsing.

```sh
node scripts/produce-company-content.mjs
node scripts/produce-company-content.mjs --check
node scripts/compile-edition.mjs --catalog game/editions/catalog.json \
  --edition droneaid-community --out .cache/droneaid-candidate \
  --version 0.132.5 --offline-base-path /revealline/
```

The destination must not already exist. `game/company-campaigns/brands.mjs` and the authored
campaign/lesson modules are build inputs. Their generated JSON is checked in so a static
server can run the hub. The standalone player exports only the selected brand, campaigns,
lessons, approved assets and explicit runtime module dependencies. Source registries,
authoring history, other audiences and internal art provenance are excluded.
Supported runtime locales preserve generic engine messages; unrelated translation namespaces
and the legacy authored-content lookup are pruned. No runtime SVG importer was added.

`BrandPack` defines identity, allowed `themeIds` and asset/source references. The primary and
campaign themes supply distinct palettes, registered enemy recipes and procedural soundtracks.
Each mission selects its campaign theme; cosmetic differences do not alter engine behavior. `EditionManifest` selects
existing campaign projects and their boot content. The runtime catalog is an allowlist, not
a menu filter. Deep links cannot select omitted content.

`assets.json` is the public-byte inventory. `artwork.json` binds mission pictures to exact
hashes, revisions and dimensions in an immutable ledger. The authoring factory selects the highest positive integer revision for each picture ID and rejects duplicate revisions; retained presentations resolve their own exact embedded records. Artwork-only updates advance affected edition revisions and
asset identities, recompute exact execution/presentation hashes, and retain the previous selected
presentation. Unchanged gameplay, campaign and pack designs keep their revisions; logical Journey
progress remains compatible. Changed gameplay requires new gameplay identities and deliberate
progress migrations. Do not overwrite a published release.

## Persistence and restoration

The versioned context resolver keeps default installation keys compatible. New installation
channels, transfer journals and writer keys include edition plus engine release. Journey
progress and lesson mastery use stable logical edition keys; same-origin hub and standalone
views of that edition share them. Different audiences do not silently import one another's
records. Explicit backup/import transfers the same logical edition across origins.
Backups for other audiences are rejected; cross-audience migration is not implemented.

Current Solo attempts use `xonix-session.v6`, with the core replay, exact content reference and
pinned actor/picture presentation. Optional learning records have separate persistence and
backup; they do not change the attempt format or arcade progression. Restoration verifies
the replay and exact presentation before adopting the run. A missing older presentation
fails visibly rather than substituting new art. Keep its matching frozen release available.
Switching editions uses the shared departure flow: verify retention, then offer Stay/Leave.
A storage failure or occupied writer never silently discards the in-memory flight.

Only one tab writes an edition's progress. Other tabs can play without becoming a second
writer. Reduced-motion and other existing shared presentation preferences retain their
separate authority. Browser storage errors remain visible and export remains available.
An unreadable storage container disables durable writes rather than replacing unseen history.
Writer authority is checked again around asynchronous profile writes and recovery import.
Offline preparation has bounded timeouts, validates the exact edition/release receipt and can
repair an incomplete owned cache. An update waiting behind an open game asks the player to
close and reopen its tabs; it does not silently take control or erase another edition's cache.

Verified learning mastery stores its exact lesson/fixture revision, ordered actions and the
matching core replay. Hydration and import replay the simulation, evidence availability and
safe-checkpoint anchors. A saved `complete` flag has no authority. Rejected older records remain
in a bounded recovery journal for transfer to their matching release; they do not unlock new
lessons. Current optional learning export uses `revealline-edition-learning-backup.v1`,
carrying proof and recovery records for one exact logical edition with a 48 MiB import
budget. Inner replay, transcript, proof and recovery budgets remain independently enforced.
The historical company-player backup v2 is retained separately; it is not the Solo save format.

## Release sequence and gates

The current shipped-source and promotion batches are tracked in the
[28 September phase status](company-editions-phase-status-2026-09-28.md). Phases 1–6 are on main;
phase 7 is active. The public default v0.141.7 release contains the source changes, while the
standalone company selector remains empty until its separate approval and device gates pass.

The additive edition envelope must coexist with the default release format. Stable launchers
live at `editions/<id>/app/`; immutable sites live at
`editions/<id>/releases/<version>/site/`. Each edition has an explicit stable manifest identity,
separate service-worker scope and owned cache prefix. Storage is still origin-wide, so all
storage keys must remain scoped explicitly.

| Phase                   | Implemented                                                                                                    | Remaining acceptance                                                                         |
| ----------------------- | -------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| 1. Foundation           | Registries, player-only catalogues, exclusion reports and fixture editions                                     | Preserve compatibility as new packs enter                                                    |
| 3. Independent editions | Per-edition reproducible compilation and downloaded-artifact checks                                         | Two actual OS-installed PWAs, update/rollback and device storage recovery                    |
| 4. Release admission    | Reproducible archives, whole-source eligibility, original ZIP-member admission and candidate CI                | A new freeze for every changed source revision                                               |
| 6. Expansion            | Retained campaign maps, pictures and deterministic route proofs                            | Final artifact artwork/content review; preserve individual review records                    |
| 7. Promotion            | Evidence-bound delivery/selector tooling and rollback path                                                     | Approved evidence, release allocation, downloaded/deployed-byte verification and publication |

Candidate builds are not qualified releases. Public promotion requires the human and deployed
artifact gates below; private source must never enter a public source archive, evidence bundle
or GitHub release. Restrictive source checks run before the default source archive as well.
The existing 64 MiB / 2,000-file core offline budget remains unchanged. Measure the whole
hosted target against the GitHub Pages 1 GB limit before promotion.

### Candidate and promotion commands

Commit the reviewed source before building. The bundle command checks the actual Git commit,
tree and selected source blob hashes, compiles twice, compares archive bytes, then independently
inspects ZIP member names, CRCs, lengths and hashes. Outputs are immutable and never overwritten.

```sh
node scripts/bundle-editions.mjs \
  --editions droneaid-community,droneaid-nl-community \
  --out .cache/company-candidate --base-path /revealline/
node scripts/publish-editions.mjs review-template \
  --bundle .cache/company-candidate --review .cache/edition-review.json
```

`Company edition candidates` runs on relevant pull requests and main changes, storing
the explicitly selected candidates as Actions artifacts for 14 days. The successful
14-edition runs and exact downloaded-byte receipts are recorded in the qualification log. The workflow defaults to all 14 edition IDs; the command above builds only the two combined examples. It cannot publish releases. Each bundle
includes `editions.json`, standalone ZIPs, selected-source ZIPs, manifests, checksums and a
candidate verification receipt. The source ZIP is a selected input packet, not a full repository
checkout. The legacy full-source archive separately runs the public-source eligibility gate.

The review template starts with every gate **pending**. Reviewers supply public, approved,
hash-pinned evidence for automation, content, assets, human comprehension/pacing, accessibility,
two installed PWAs, update/rollback, storage/backup recovery and same-device performance.
Receipt structure and hashes provide traceability; they cannot establish the truth of a human
observation. Review these receipts through the repository's normal review process.

After those gates pass, `publish-editions.mjs verify` validates the exact bundle and evidence.
`upload-draft` additionally requires `--repository mekhovov/revealline`, an existing draft
release whose tag resolves to the bundle's engine commit and tree, and never replaces an asset.
It rereads every uploaded byte before producing a delivery receipt. The command does not create
tags or publish the draft. Allocate a new release version before promotion; a development
candidate using the current package version does not reserve or replace that release slot.

After the reviewed release is published, `sync-selector` downloads and verifies all artifacts
for the complete retained-plus-new selector, including the combined edition overlay budget,
and updates `publishing/pages-controller/editions.json` using `--selector` and
`--base-path /revealline/`. It preserves historical releases and selects one active launcher
per edition. Published-release checks resolve the explicit tag reference, and concurrent
selector edits abort the write without replacing another writer's changes. The existing sole
Pages publisher composes these verified edition files with
the default artifact and rechecks the combined 950 MB operational budget. Empty selection
preserves default publication. `editions/index.html` links the same standalone artifacts.
Rollback changes the active edition selection to a retained version; it never rewrites frozen
release bytes or changes another edition's launcher. Use the verified local-selector command:

```sh
node scripts/publish-editions.mjs select-retained --version vX.Y.Z \
  --editions droneaid-community --selector publishing/pages-controller/editions.json \
  --repository mekhovov/revealline --base-path /revealline/
```

It downloads and checks the retained published artifacts before writing the selected edition's
launcher choice. A failed check leaves the selector untouched. Review and deploy that selector
through the ordinary pipeline; this command does not publish or deploy. Additional distribution targets require
their own reviewed configuration. Restricted editions have no public promotion path.

## Evidence and outstanding human gates

`game/test/fixtures/company-campaign-routes.json` contains 414 verified legal replay
proofs: 66 current and three historical missions, three difficulties, two steering policies, seed 1.
The independent six-check route suite replays the advanced content successor and
verifies actual connector openings and core releases, not only the earlier introductory maps.
Current runs include the exact default Journey tuning recipe; historical runs retain their
original recipe. All routes won with their required objectives and no life loss. Tests execute those routes and
pin exact discrete outcomes, complete board cells, objective flags and event/capture histories.
Raw checkpoint references retain their generating runtime metadata; a fresh independent
replay must match the full unrounded state and summary on the executing runtime.
Continuous terminal sub-tick time and enemy floating tails are not portable fixed goldens.
Strict saved-replay imports can reject incompatible math runtimes. This proves those routes are legal; it does not establish enjoyable
pacing, comprehension, learning transfer or coverage of every seed and input sequence.

Session tests cover active-cut continuation, release-input boundaries, mismatched edition/art,
tampered replay input, wrong mission and mismatched learning pins. Learning tests recompute
outcomes rather than trusting stored completion. Packaging tests reject disallowed assets,
hidden campaign data and corrupt dependency hashes. Offline tests simulate failed downloads
and cache ownership. Report test failures or absent fixtures explicitly, without waiving them
implicitly.

Human content review, final asset approval, two real installed PWAs, device storage recovery, a published-artifact rollback exercise and same-device performance comparison remain promotion checks tied to the final artifact. Preserve actual observations separately from automatic test results.

Art-only updates preserve stable mission IDs and gameplay manifests. Before changing art,
capture the affected edition's exact selected presentation with
`captureEditionPresentation` from `game/editions/retained-presentation.mjs`; keep the canonical
snapshot bytes, receipt, hash and media unchanged. Register only explicitly supported
snapshots in `EditionManifest.presentationHistory`, never a whole authoring registry. The
home recovery controls open the retained presentation explicitly through the same Solo
host; active-flight departure still verifies its save. Replay Theater acquires the exact
manifest picture and releases it on cancellation/replacement. Compilation admits only the
selected audience's history and its exact media dependencies. History counts against the
existing offline budget. An art update changes strict execution/presentation references,
while existing Journey completion remains under stable logical mission identities.

For subsequent art batches, capture history before changing registry inputs, retain generated
masters outside the public player dependency set, and review each exact derivative. Validate
complete receipts before writing them:

```sh
node scripts/import-company-art.mjs game/editions/art-prompts-droneaid-workshop-bulk-02.json
# Add --write only after the complete selected batch is reviewed.
node scripts/produce-company-content.mjs
```

The importer validates authored mission identities, exact PNG hashes/dimensions, portable
master provenance, inspection records and the 1 MiB selection target. It refuses replacement
of an existing revision, duplicate mission registration within a batch, revision gaps and reused media paths. Omitted receipt revisions mean revision 1 for existing tooling; replacements explicitly specify the next integer revision and use a fresh path. Reimporting an older exact receipt is idempotent and does not roll back current selection. It does not certify
human artwork approval or change gameplay. Completed original/export inspections use explicit
states; prose alone cannot authorize an inspected source claim. Recorded native `sips` resize
commands must bind the exact master, selected output and dimensions. Register a complete batch in one catalogue update;
intermediate generation receipts can contain planned rows, which are deliberately rejected.
Keep immutable history JSON byte-for-byte and advance affected edition revisions once per
compiled batch. A source master is not a runtime dependency merely because it is cited in a
provenance receipt.

The completed bulk receipts link exact generated masters and selected files:
[DroneAid workshops](../game/editions/art-prompts-droneaid-workshop-bulk-02.json), and
[DroneAid community scenes](../game/editions/art-prompts-droneaid-community-bulk-02.json).
Generation used the built-in image tool; exports preserve opaque RGB pixels with a
mechanical resize. Full bounded PNG decoding rejects incomplete, corrupt or transparent
selections before registration. Final artwork approval remains separate.

The FPV follow-up replaces all 36 current Netherlands pictures with practical carbon-frame
quad, goggle, component-bench and donation-case scenes. Its three revision-2 receipts are
[Workshop and Parts](../game/editions/art-prompts-droneaid-fpv-workshop-v2.json),
[Makers and Handoff](../game/editions/art-prompts-droneaid-fpv-makers-handoff-v2.json), and
[Support and Horizon](../game/editions/art-prompts-droneaid-fpv-community-v2.json).
The first workshop picture also supplies the current home hero. The new per-image target
is 384 KiB, using opaque 2:1 native-resized derivatives; the seven exact pre-FPV presentation
snapshots preserve the larger original pictures for saved runs. The offline cap remains
64 MiB. Brand revision 2 and Netherlands edition revision 4 are presentation changes;
campaign, mission, gameplay and logical progress identities stay unchanged. The
historical Portuguese pilot retains its existing content. Research, composition decisions
and source boundaries are in [the FPV art direction](droneaid-fpv-art-direction.md).

The player verifies identity and shared presentation assets at startup. Reveal-only mission
pictures load through the exact per-attempt verifier when needed. Their complete catalogue,
publication eligibility, offline budget and historical pins remain authoritative; lazy
loading never authorizes a substitute picture. Images reused as a hero, actor body, explicit
edition root or shared dependency remain eager.

When CacheStorage is unavailable or full, verified online bytes can still support play.
Install, repair and offline verification remain strict: a failed cache operation cannot
produce an offline-ready receipt. Automated fault injection verifies these paths without
claiming real device storage or OS installation evidence.

The [qualification record](company-editions-validation.md) separates successful candidate
automation from unresolved historical tests and promotion gates. The [accessibility review](company-editions-accessibility.md)
records implemented mobile, focus and status fixes plus outstanding assistive-technology checks.
The [same-device review tool](verification/company-review.html) observes real player pages with
bounded, exportable measurements. It supports the current Solo host and historical company
player, with independent viewport width/height. Arm a measurement, then start/resume the
game normally; the observer never resumes it. The two hosts expose different preparation
endpoints, recorded in each observation, so do not compare them as identical timings.
It reports buffered resource entries, animation callback
intervals and approximate shared heap, not complete network traffic, renderer timings or a
memory-leak verdict. Every observation remains unqualified until reviewed.

The [qualification recorder](verification/company-qualification.html) captures the separate
human and device evidence against one immutable candidate. It validates exact envelope, source
and downloaded-artifact identity, all nine promotion gates per edition, actual-device constraints
and bounded scenario coverage. It starts with no passes and never edits the game, release metadata
or public selector.

## Sources and asset boundaries

The new `droneaid-nl` brand follows [DroneAid Netherlands](https://drone-aid.nl/nl): violet
`#4238EB`, yellow `#FFD62C`, light blue `#DCEBFD`, and its original propeller mark. These are
verified live-site tokens, not a discovered formal brand guide. The site uses KyivTypeSans;
that font is not redistributed because its license has not been established. The new pack
uses the host's existing font fallback. Workshop, collection and reporting activities inspire
fictional stories, not representations of actual deployments. The official site describes both
military support and humanitarian uses; the organization is not described here as exclusively civilian.

The historical `droneaid` brand still refers to the [Portugal regional identity](https://drone-aid.pt/en)
and [Germany's workshop context](https://drone-aid.de/). It is not silently relabelled as Dutch.
Its three scenes remain fictional and make no claim of proven wildfire deployment outcomes. Generated environments are illustrations,
not employee/event photographs. Getty/iStock material from Drive is not included. Poppins
ships with its [SIL Open Font License](https://github.com/google/fonts/tree/main/ofl/poppins).
Original research/private files stay outside this repository; only public derivatives and
publication-safe attribution belong in an edition.
