# Content production register

This authoring tool tracks selected work and missing production checks. It supplies plain JSON, a pure model and a [read-only source view](index.html). It does not change game packs, defaults, media storage, saved attempts, earned pictures or releases.

The seed describes source `62a92651b1dc51fc74ca25a545dd9bde35c2574c`, before v0.36 delivery. Its [production targets](../../docs/content-production-register.md) remain incomplete.

The separately retained [Sentinel theme candidate](register-sentinel-themes.json) advances the register to revision 2. It binds nine new originals to the three existing Sentinel layout families across Ukraine Atlas, 1994 Forever and Spend Network. The baseline stays unchanged and remains the source view's default. Choose **Sentinel themes · revision 2** in the [source view](./?snapshot=sentinel-themes) to inspect its pictures. The two snapshot links select only these known repository files; they never accept arbitrary paths. Inspect the candidate with:

```sh
node authoring/production/cli.mjs report authoring/production/register-sentinel-themes.json
node authoring/production/cli.mjs validate authoring/production/register-sentinel-themes.json --previous authoring/production/register.json --files
node authoring/production/cli.mjs inspect authoring/production/register-sentinel-themes.json --slot picture.sentinel-listening.ukraine
```

This candidate contains 36 unique pictures, 80 unbound picture slots and the same nine proposed layout families. It grants no production assessments and does not install a chapter. The finite `sentinel-world` adapter reads the exact theme compiler metadata and descriptors; it checks original hashes, paths, dimensions, theme and authored owners without executing a producer or game. New layout records explicitly expand each old Sentinel family with the additional owners, retaining every earlier layout, work, binding and assessment.

## Run from the repository root

```sh
node authoring/production/cli.mjs report authoring/production/register.json
node authoring/production/cli.mjs report authoring/production/register.json --json
node authoring/production/cli.mjs inspect authoring/production/register.json --slot picture.sentinel-listening.ukraine
node authoring/production/cli.mjs validate authoring/production/register.json
node authoring/production/cli.mjs validate authoring/production/register.json --files
```

`report` and `inspect` read only the register. `validate` checks pinned source metadata, exact original ownership and known recipe handles. `--files` also streams the referenced original and concept files through byte-count/hash verification. Conflicting byte/hash declarations for the same original path are rejected before deduplication, including conflicts in retained historical revisions. Keep changed originals at distinct immutable paths. Missing originals yield explicit `unavailable` entries and `originalBytesVerified:false`; metadata and history remain readable. Neither result certifies visual quality, decoding, listening or human challenge.

The CLI runs on the repository's supported Node versions, after the usual dependency installation. The finite synth adapter uses the existing ESLint dependency's Espree parser to read a literal array; it never executes the music module. No compiler, simulator, browser, network or build is invoked. Report output is deterministic for the same register; source availability can change between validations.

## What is counted

| Domain              | Target basis                                 | Initial registered coverage                                                       | Qualification                                                          |
| ------------------- | -------------------------------------------- | --------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Maps                | 29 stable planning slots                     | 9 proposed layout families; 20 unassigned                                         | None approved as the final campaign                                    |
| Pictures            | 29 maps × 4 themes = 116                     | 27 unique originals; 9 missing Sentinel themes and 80 cells under unassigned maps | Final production quality checklists remain open                        |
| Player presentation | 7 classes × 4 themes × compact/detailed = 56 | 56 configured handles sharing 6 rigs                                              | No finished presentation assessment is invented                        |
| Stories             | 3 per theme = 12                             | One Dawn movie/poster pair; 11 missing                                            | One historical delivered journey, separate from full production checks |
| Reserves            | 40 explicitly selected spare originals       | None                                                                              | A selected production picture does not become an additional reserve    |
| Tracks              | 24 compositions                              | 5 existing synth recipes; 19 unassigned                                           | No full-listen or finished-production approval is inferred             |

The 28 enemy skin handles describe seven behavior types across four themes. They are a separate supporting inventory, not an additional 56-player target. Current `microtile`/`hybrid` references describe the compact/detailed treatment mapping; they do not prove that a finished set exists.

Pressure, Route Choices and Sentinel supply three layout families each. The first two have four picture themes; Sentinel currently has FPV originals only. Five external entries contain fifteen original bodies, including three reused Pressure originals. Only twelve are new relative to the fifteen originals delivered before v0.36. Different campaign keys and picture themes do not increase geometry counts.

`historicalDelivery` records the fifteen older optional originals and Dawn using existing checked-in delivery summaries. It does not automatically fill the stricter quality checklist. The register contains no synthetic human assessments. The thirteen-song licensed candidate collection remains unregistered intake context; it is not added to the five synth recipes or treated as finished music.

## Data and replacement workflow

[register.json](register.json) contains:

- **Maps/layouts:** stable planning slots and explicitly curated geometry families. `variantOf` declares reuse; two related variants cannot fill two map slots. This is not a universal geometry detector. Source maps are never rewritten here.
- **Works:** immutable `{id, revision}` records referencing exact source metadata, files, dependencies and authored owners. Shared rigs retain their concept image and renderer/animation references. Source bytes or dependencies changing require a new work revision.
- **Bindings:** one revision chain per slot, pointing at an exact work and typed replacement handle. Picture handles must match a declared owner in that map family. A story keeps its authored owner and immutable story revision. These handles describe proposed authoring adoption, not permission to replace a retained game receipt.
- **Assessments:** explicit reviewer, valid date, evidence pins, result, check and exact binding/work revision. A new binding receives no prior approvals. An unresolved failure blocks its check even if another pass exists; a resolution must explicitly name the earlier assessment for the same subject/check.
- **Deliveries and enemies:** separate historical/supporting facts that cannot silently promote production stages.

Import or derive new raster work with the existing [media tool](../media/README.md). Preserve a versioned metadata snapshot beside its unchanged content-addressed files when registering it; later edits to a mutable manifest must not destroy an older pinned source. The `authored` adapter reads a produced `mediaVersion:1.0.0` asset record and verifies derivative-parent identity. It does not invent provenance, copy bytes or implement another media store. New video/audio formats require an explicit adapter addition; the current model references Dawn and the known synth recipes only.

Append a new work revision to a separate candidate JSON, advance the register revision once and retain the old JSON for comparison:

```sh
node authoring/production/cli.mjs validate authoring/production/candidate.json --previous authoring/production/register.json
```

Then propose a binding using a work already present in that candidate. For a picture, pass the **exact** declared owner as its handle. This example shows the argument shape after a new revision has been registered; revision 2 is not pre-created in the seed:

```sh
node authoring/production/cli.mjs propose-binding authoring/production/candidate.json \
  --slot picture.pressure-orchard.fpv --work picture-orchard-crossing --revision 2 \
  --expected-binding 1 \
  --handle '{"kind":"picture","owner":{"baseCampaignKey":"original-fpv-pressure-lines/1/b86804fb3ab94151","levelId":"original-fpv-orchard-crossing","levelRevision":"1","themeId":"fpv"}}' \
  --out authoring/production/replacement.json
```

To add another Sentinel theme, append a new layout record with a new ID and `variantOf` pointing at the immutable original Sentinel layout. Its owners must retain every old exact owner and add the newly authored theme owner. Point the existing planning map slot at this expanded variant; keep its slot ID, old layout, works, bindings and assessments unchanged. Then register and bind the new theme work. This expands one layout family; it cannot occupy another map slot or count as new geometry. The metadata adapter must still verify the new source owner before a CLI proposal can be published.

Use `--expected-binding none` for an unbound slot. A stale revision, incompatible owner/theme, changed immutable history or malformed data refuses before publication. The destination directory must already exist, be ordinary, and lie under `authoring/production`. Publication writes a temporary complete file, checks that the input is unchanged, then links it exclusively into a **new** destination. Existing files and symlinks are never overwritten. Review and commit the candidate deliberately; no game adoption follows automatically.

Use `validateProductionRegister(next, { previous })` whenever an editor saves a candidate. Validation without `previous` checks internal consistency but cannot establish that unseen prior history was preserved. The previous comparison preserves work, binding, assessment, delivery and layout rows. The register is bounded to 2 MiB with strict fields, finite arrays and repository-relative ordinary-file paths.

## Quality stages and frontend seam

The [pure model](model.mjs) exports `validateProductionRegister`, `summarizeProduction`, `inspectProductionSlot`, `listProductionSlots` and `proposeProductionBinding`. It imports neither Node nor browser services and returns frozen data. `listProductionSlots` validates once for a complete bounded frontend inventory. A future editor may clone the returned data, then validate the candidate against its retained original.

Serve this repository on localhost and open `/authoring/production/`. Native filters cover domain, theme, stage, search and unbound slots; twenty-row pages lead to an inline checklist, exact identities and retained history. Tab/Enter navigate and Back returns to the selected row; Escape leaves details while native input fields retain their own keys. Source reload retains the previous valid view if new JSON is unavailable or invalid. There are no approval, save, assignment or game-storage controls.

Images load only after an explicit Preview action for the selected PNG original, poster or rig concept. The reader uses same-origin repository paths, refuses redirects and verifies declared bytes/SHA-256 before native decoding. Preview limits are 8 MiB, 4096 pixels per edge and 8 megapixels, within the larger metadata pin limit. Back, filters, reload and page hiding cancel pending work and revoke preview URLs. A failed or missing original stays unavailable. Preview does not verify all source metadata, establish image quality or add an assessment. Movie/audio work displays metadata here; listening and playback remain separate tasks. The reader is source-only and is not included in the v0.36 release.

Stages advance only when all matching prerequisites pass: planned → produced → inspected → source-integrated → browser-verified → released. Existing original files establish the produced step for pictures/stories. Rigs and synth recipes require an explicit production assessment. Their availability alone stays planned.

Each domain has a fixed checklist. Pictures include framing and partial/full reveal; rigs include idle, movement, warning/ability, hit/recovery, reduced effects and display sizes; stories include poster/segment, audio review, Play/Pause/Skip/end, first-earned, Collection and recovery; tracks include full listening, transitions and game mix. Reserves stop at inspected after explicit curation. A silent movie's audio-review assessment must state its actual scope; a codec test is not a listening assessment.

Slot coverage and unique work totals answer different questions. SHA identity, stable work IDs, explicit derivation and recipe handles prevent renamed, recompressed or shared work from inflating unique totals. Two bindings of one movie remain one unique story even when their slots differ. Intentional reuse stays visible. No hash comparison can identify undeclared semantic copying; curation must record `derivedFrom` and layout relationships truthfully.

## Shared reading preferences

The current supporting-tool correction is in development; its scoped source tests are not release acceptance. The independent display entry reads the game's shared Theme/Plain, Standard/Large and effective reduced-effects policy before the tool's main initialization. It keeps loading/error text readable if that application module is delayed or fails. This read-only owner does not save settings, change the register or write game profiles.

Reading changes preserve the active search/filter, selected detail, pending original decode and displayed image. **Back to slots** retains the existing exact-row focus return. Existing page hiding still cancels pending preview work; a history return does not silently restart it. Persisted display restoration reads current shared/system policy without remounting the panel or taking focus. Verify actual Back/Forward and focus visibility at enlarged text separately from modeled lifecycle events; the source view remains a local authoring tool.

## Verification

Run only the focused source test for this tool:

```sh
node --test scripts/test-production-register.mjs
```

It exercises real cohort/owner adapters and original bytes, unavailable originals, browser-compatible import, wrong owner/theme, append-only replacements and stale history, stage failure/resolution, duplicate work/recipe/segment counting, exclusive CLI output, malformed paths and symlinks. It generates no artwork and makes no runtime/build/public completion claim.

## Preserve metadata revisions

Current appearance/catalog metadata may advance while a production register still describes an earlier immutable source. Keep that register's path, byte count, hash and approval history unchanged. Do not reformat historical snapshot bytes. The optional [metadata history index](history/index.json) lists complete prior text identities. Version 1 accepts JSON only; version 2 accepts JSON and ES-module source (`.mjs`) as inert bytes. Each snapshot lives at `history/<sha256><original-extension>` and must match that exact byte count and hash. The first entry preserves the v0.39 motion presets before the seven FPV presentations were added.

To revise another JSON or ES-module source authority, retain its exact prior bytes under that content-addressed name and append one explicit original-path/bytes/SHA entry before changing the live file. The reader selects history only when the register declares that complete identity. New pins read the live authority; a missing, changed or symlinked snapshot refuses. An index cannot name an arbitrary snapshot destination. Its 32 KiB/64-entry bound and the existing 4 MiB metadata cap are separate from original media budgets. This preserves metadata lineage; it is not binary asset history, runtime storage recovery or production approval.

Source-only metadata checks can run without hashing original pictures:

```sh
node --test scripts/test-production-metadata-history.mjs
```

The combined enemy presentation changes preserve the former 25,033-byte actor renderer as an exact `.mjs` snapshot. Verification reads and hashes source text; it never imports or executes archived modules. Older v1 authoring readers refuse the v2 index. Frozen releases and runtime storage schemas are unchanged; historical register pins and approvals stay exact.

## Preserve recipe implementation revisions

The optional [source history index](history/source-index.json) preserves the exact renderer bytes referenced by earlier recipe records. It uses the separate `revealline-production-source-history.v1` format; the metadata-history v1/v2 index and all existing production registers retain their own identities. Only `authoring/motion-lab/render-character.mjs` and `game/ui/actor-presentation.mjs` are admitted by this finite reader. Each complete original path, byte count and SHA-256 identity resolves to `history/<sha256>.source`. These snapshots are read and hashed as inert bytes; they are never imported, evaluated or used by the game renderer.

Retain the prior body before revising either live renderer. Add its complete identity and exact unformatted bytes, without changing an old register or its assessments. An unmapped new pin reads the current source. An explicitly mapped old pin requires its exact ordinary snapshot file; missing, changed or symlinked history fails instead of substituting a newer implementation. A checkout without this optional index still verifies when its current source matches every declared pin. The index remains bounded to 32 KiB and 64 entries, each snapshot to 4 MiB. Authenticating historical source does not approve production quality or change gameplay, saves or media ownership.

```sh
node --test scripts/test-production-source-history.mjs
```

When both optional indexes declare the same complete source identity, verification authenticates every declared snapshot before using its bytes. Either missing, changed or symlinked copy refuses; the second history format cannot conceal damage to the first. The retained `.mjs` and `.source` actor snapshots stay separate and exact.
