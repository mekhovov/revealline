# Company journeys

Company editions reuse Reveal / Line's deterministic simulation, renderer, replay verifier,
campaign compiler and Journey store. The bounded host is `game/company.html`; the existing
game and its historical Coupa theme remain separate, unchanged content identities.

## Try a draft

Run `node scripts/game-cli.mjs serve --port 8768`, then open
`http://127.0.0.1:8768/game/company.html`. Choose a company and audience in the selector.
The source hub has seven editions: all five Coupa journeys together, five individual
audience editions, and the three-mission DroneAid community pilot.

The official Coupa flower is a rigid image. Only its cosmetic pose rotates; reduced motion
stops rotation. Paper tangles, missing-information clouds, stale fragments and backlog knots
use registered silhouette recipes over the existing enemy behaviours. These are fictional
frictions, not portrayals of colleagues or suppliers.

Five Coupa campaigns contain 30 distinct maps. DroneAid adds three different maps. The 24
learning missions use fictional records and deterministic Inspect / Configure / Commit
transcripts; six culture activities are unscored reflections. Completing the map and its
lesson are separate requirements. The game remains paused when a workbench closes.
Positive capture and objective events recover evidence records; winning recovers the remainder.
Records stay available at results. Workbenches require safe ground or a terminal result,
clear movement input, and never resume the simulation implicitly.

## Author and compile

The guided authoring page is `authoring/company-studio/index.html`. It edits a bounded source
packet and links the existing Asset Studio. Preview/export uses the Node compiler rather
than executing arbitrary uploaded code in the browser.

```sh
node scripts/produce-company-content.mjs
node scripts/produce-company-content.mjs --check
node scripts/compile-edition.mjs --catalog game/editions/catalog.json \
  --edition coupa-adventure --out .cache/coupa-candidate \
  --version 0.132.1 --offline-base-path /revealline/
```

The destination must not already exist. `game/company-campaigns/brands.mjs` and the authored
campaign/lesson modules are build inputs. Their generated JSON is checked in so a static
server can run the hub. The standalone player exports only the selected brand, campaigns,
lessons, approved assets and explicit runtime module dependencies. Source registries,
authoring history, other audiences, unused locales and internal art provenance are excluded.
English runtime catalogues preserve generic engine messages; unrelated translation namespaces
and the legacy authored-content lookup are pruned. No runtime SVG importer was added.

`BrandPack` defines identity and asset/source references; the boot theme supplies palette,
registered enemy recipes and an original procedural soundtrack. `EditionManifest` selects
existing campaign projects and their boot content. The runtime catalog is an allowlist, not
a menu filter. Deep links cannot select omitted content.

`assets.json` is the public-byte inventory. `artwork.json` binds mission pictures to exact
hashes, revisions and dimensions. Every compiled immutable release must advance changed pack
revisions. Art updates retain compatible Journey progress; gameplay changes need new
gameplay identities and deliberate progress migrations. Do not overwrite a published release.

## Persistence and restoration

The versioned context resolver keeps default installation keys compatible. New installation
channels, transfer journals and writer keys include edition plus engine release. Journey
progress and lesson mastery use stable logical edition keys; same-origin hub and standalone
views of that edition share them. Different audiences do not silently import one another's
records. Backups are explicit across origins or editions.

Suspended games include the full core replay, edition, exact presentation identity, run ID
and learning transcript. Restoration verifies the replay and current lesson/simulation/seed
pins before retiring the active picture. A missing older presentation fails visibly; it does
not substitute new art. Keep the matching frozen release available for restoration.

Only one tab writes an edition's progress. Other tabs can play without becoming a second
writer. Reduced-motion and other existing shared presentation preferences retain their
separate authority. Browser storage errors remain visible and export remains available.

Verified learning mastery stores its exact lesson/fixture revision, ordered actions and the
matching core replay. Hydration and import replay the simulation, evidence availability and
safe-checkpoint anchors. A saved `complete` flag has no authority. Rejected older records remain
in a bounded recovery journal for transfer to their matching release; they do not unlock new
lessons. Backup v2 carries both proof and recovery records. The outer import budget is 96 MiB;
inner replay, transcript, proof and recovery budgets remain independently enforced.

## Release sequence and gates

The additive edition envelope must coexist with the default release format. Stable launchers
live at `editions/<id>/app/`; immutable sites live at
`editions/<id>/releases/<version>/site/`. Each edition has an explicit stable manifest identity,
separate service-worker scope and owned cache prefix. Storage is still origin-wide, so all
storage keys must remain scoped explicitly.

1. Foundation: schema/closure validation, default compatibility, two fixture editions.
2. Vertical slice: official Coupa identity, First Connection, exact Continue/Retry and reduced motion.
3. Installation: two standalone editions, shared logical progress, updates and rollback.
4. Release admission: deterministic ZIPs, source eligibility, checksums and actual ZIP-member checks.
5. Reuse and learning: one representative lesson in each learning campaign plus all three DroneAid maps.
6. Expansion: review batches of at most three missions; create final mission art after formative playtesting.
7. Promotion: review-qualified downloaded and deployed bytes match the frozen candidates.

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
  --editions coupa-all,coupa-adventure,coupa-culture,coupa-foundations,coupa-operations,coupa-developers,droneaid-community \
  --out .cache/company-candidate --base-path /revealline/
node scripts/publish-editions.mjs review-template \
  --bundle .cache/company-candidate --review .cache/edition-review.json
```

`Company edition candidates` runs on relevant pull requests and main changes, storing the
seven candidates as Actions artifacts for 14 days. It cannot publish releases. Each bundle
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
and updates `publishing/pages-controller/editions.json` using `--selector` and
`--base-path /revealline/`. It preserves historical releases and selects one active launcher
per edition. The existing sole Pages publisher composes these verified edition files with
the default artifact and rechecks the combined 950 MB operational budget. Empty selection
preserves default publication. `editions/index.html` links the same standalone artifacts.
Rollback changes the active edition selection to a retained version; it never rewrites frozen
release bytes or changes another edition's launcher. Additional distribution targets require
their own reviewed configuration. Restricted editions have no public promotion path.

## Evidence and outstanding human gates

`game/test/fixtures/company-campaign-routes.json` contains 198 legal replay proofs: all 33
missions, three difficulties, two steering policies, seed 1. Tests execute those routes and
verify their checkpoints. This proves those routes are legal; it does not establish enjoyable
pacing, comprehension, learning transfer or coverage of every seed and input sequence.

Session tests cover active-cut continuation, release-input boundaries, mismatched edition/art,
tampered replay input, wrong mission and mismatched learning pins. Learning tests recompute
outcomes rather than trusting stored completion. Packaging tests reject disallowed assets,
hidden campaign data and corrupt dependency hashes. Offline tests simulate failed downloads
and cache ownership. Report test failures or absent fixtures explicitly, without waiving them
implicitly.

Before expanding the final learning artwork, play First Connection and one lesson in each
learning campaign. Ask the player to describe the objective, identify the threat, explain the
consequence of a decision and transfer the idea to a second fictional fixture. Record these
human observations separately from route proofs. Content accuracy, final asset approval,
two real installed PWAs, storage-exhaustion recovery, rollback and same-device performance
comparison remain promotion gates until their evidence is captured. Draft maps may use the
procedural fallback until their individual picture is reviewed; do not advertise that as 30
finished mission illustrations.

## Sources and asset boundaries

The official flower comes from the [Coupa brand library](https://drive.google.com/drive/folders/1Bhq6KoBjES--iHt3gWZA2rhjo456Q9j6).
Current culture content follows [Life at Coupa](https://careers.coupa.com/en/life-at-coupa/):
Drive Success for #AllofUs, Build Tomorrow Together, Cultivate Belonging and Own our Results.
API concepts cite [current developer documentation](https://docs.coupa.com/en/developer-documentation/the-coupa-core-api/get-started-with-the-api).
No live endpoint, tenant policy or credentials are used.

DroneAid's logo is the [Portugal regional identity](https://drone-aid.pt/en); community references
also cite [Germany](https://drone-aid.de/). The pilot is fictional civilian cooperation and makes
no claim of proven wildfire deployment outcomes. Generated environments are illustrations,
not employee/event photographs. Getty/iStock material from Drive is not included. Poppins
ships with its [SIL Open Font License](https://github.com/google/fonts/tree/main/ofl/poppins).
Original research/private files stay outside this repository; only public derivatives and
publication-safe attribution belong in an edition.
