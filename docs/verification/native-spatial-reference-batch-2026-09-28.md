# Cumulative native/spatial/reference preparation evidence

Date: 28 September 2026. Owned branch:
`codex/post-v141-pressure-corridor-triptych`; existing PR #735. This is **source
preparation**, not a new public-release receipt. No release version, default route,
historical frozen release, user media or root dirty worktree is changed here.

## Scope

- Existing ancestry: v35 finite Remix pair (#730), v36 contested wall triptych
  (#733), v37 pressure corridor triptych (#735), after #728/v34.
- New source: explicit retained predecessors for v26–v37; Studio's twelve newer
  review imports and links; active-play pointer context-menu ownership; one pinned
  local CC0 Synevyr reference and explicit verified download.
- Cumulative prior-edition addition: **33** genuinely changed mission-editions,
  latest v37 total **81** prior cards. Existing v25/default identity is unchanged.

## Final focused check

```sh
node --test \
  game/test/studio-real-world-reference.test.mjs \
  game/test/studio-image-locale.test.mjs \
  game/test/content-image-trace.test.mjs \
  game/test/studio-spatial-editions.test.mjs \
  game/test/studio-candidate-library.test.mjs \
  game/test/spatial-candidate-edition-history.test.mjs \
  game/test/playfield-context-menu.test.mjs \
  game/test/ui-input.test.mjs \
  game/test/couch-input.test.mjs \
  game/test/continuous-input.test.mjs \
  game/test/coop-input-policy.test.mjs
```

**196 tests, 196 passed, 0 failed, 0 skipped**, 8.58 seconds. This combines real
source adapters with bounded DOM, fetch, image-decoder and event fixtures. It is
not physical input, a real browser image decode, a full-mission clear or a public
download/installed-worker test.

Covered behaviors include:

- Exact full-source Studio import, detached edits and registered identities;
  source/selection/new-inspection supersession, current versus stale failure;
  both languages, unchanged focus/selection and existing library search controls.
- Historical delta sets compared with immediate predecessors, rule/presentation
  identities across both modes and three presets, manual launch, route ownership
  and no eager media fetch during library construction.
- Active versus inactive canvas context requests, mouse/touch/pen, modifiers,
  keyboard context menu and virtual origins, late Solo canvas, both Versus boards,
  Team board and teardown; existing continuous/input/recovery regressions.
- JPEG length/hash/MIME, truncation/oversize/corruption, header/decoded-size boundary,
  late fetch/stream/digest cancellation, prior-reference retention, stale owner
  rejection, explicit no-apply/no-play, download failure/cleanup, uninitialized
  Studio session and actual host persisted-pageshow listener restoration.

Targeted ESLint on all changed/new JS modules and tests: **pass**.
Targeted Prettier on JS, HTML, locale sources, research/plan and asset README:
**pass**. `git diff --check`: **pass**. Generated catalog rebuilt from the two
locale sources; generated content registry unchanged.

Localization check: **pass**, 10,479 messages / 8,300 source references, English
and Ukrainian. Content validation: **pass**, 1,625 files, literal references valid;
five existing navigation warnings (`downloads → app`, `game → diagnostics`, and
three site release/privacy/credits destinations) remain reported. Presentation
metadata validation: **pass**, unchanged field-kit revision 93.

## Review corrections and retained failures

- Independent review required `{ fullSource: true }` for Studio so a future
  current-route snapshot cannot return navigation-only data to the editor. Fixed
  and tested through the injected production loader boundary.
- Initial Studio run: **18/20 passed, two failed**. One fixture did not honor HTML's
  `selected` option; one static-link inventory included new hidden dynamic links
  before they had an href. Fixtures now distinguish these cases, without giving
  hidden links misleading launch targets. Actual stale-result handler tests were
  added rather than relying only on the ticket helper. Corrected Studio run:
  **24/24 passed**, then included in the final combined run above.
- Packaging review found the installed worker's optional-content gate. The explicit
  one-file loader now uses `cache: 'no-store'`; no service-worker broadening or eager
  tooling package download was added. Built/offline verification remains open.
- Independent lifecycle review found pagehide disposal removed the new controls'
  listeners across BFCache restoration. Persisted pageshow now re-syncs when a
  session exists; the test evaluates the actual host callback and deduplication.
- One attempted focused command used nonexistent older fixture filenames and ran
  no tests. The final explicit command above uses the actual files; no pass is
  inferred from that failed invocation.

## Packaging and rights

Read-only source inspection confirms the game-tree collector includes the JPEG in
site, ZIP and manifest; optional-artwork pruning does not remove undeclared
standalone files. The Studio-only path belongs to `tooling:workshop`, not ordinary
gameplay media. This is **packaging-source evidence, not a new build receipt**.

The committed JPEG is 124,649 bytes, SHA-256
`3ca8b4caf48a016e2e9c59afb8bcce45d5e93451a82496f099b644fe37837de8`.
Its adjacent README records the file-level CC0 license, author, exact rendition
and source revision. Other shortlisted sources are not downloaded or represented
as cleared game assets.

## Remaining release gates

Exact admitted-base reconciliation and review, production build/provenance,
immutable assets/hash/archive checks, Pages availability, and bounded frozen public
Studio/play/download/return checks belong to the publisher's later integrated
release. No large local build or archive duplication was attempted with roughly
200 MiB free. Full automated suites remain waived, not passed. Human balance,
whole-Journey/Team routes, physical controllers/touch and Safari-only callouts
remain unverified. The current default is not promoted by this batch.
