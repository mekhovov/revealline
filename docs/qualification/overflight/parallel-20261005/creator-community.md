# Creator and Community integration — 2026-10-05

Source candidate evidence, not release or player qualification.

Overflight now enters the existing global Community package inspector, publisher selection, native installed adapter, catalogue metadata and offline play route. The service uses the same strict native project compiler and exact dependency closure. It reports `not-play-qualified`; no server preview is advertised because no gameplay image is bundled in this format. No live submission, publication or service deployment was performed.

The existing Overflight profile library owns both Studio imports and Community editions. A semantic project keeps its 16-hex native identity; each Community receipt retains its exact original UTF-8 text and 64-hex SHA-256. Pretty-printed and compact editions can share one native project without conflating their recovery bytes. Transactions preserve a Studio owner when Community offloads its edition, reject stale offload reviews, and preserve other editions that use the same project. Legacy Studio-only records migrate as local owners. Native mission management offers local removal only for local owners and points Community-owned entries to the existing Community recovery/offload flow.

Creator displays English/Ukrainian names for all admitted enemies and upgrades. Soldier names come from the shared actor catalogue; upgrade names are checked against the native rank-one build labels. Checkboxes preserve the author's family ordering. Compiler validation still rejects an empty or unknown family selection. The Studio navigation keeps the chosen language and links to Community packages.

## Verification

The first hosted Creator CI run exposed a test-only optional-dependency import:
the root-only job does not install Studio's `fake-indexeddb`. Commit `9e7c03240`
uses the repository's transactional IndexedDB model with independent named
databases, preserving all four original cases and adding install/offload rollback
fault injection. The focused file passes 5/5; the actual Creator CI job now passes
216/216 with zero failures/skips. See `creator-ci-portability.tap` and the
source-bound `creator-ci-fixed.json`. This repair changes no runtime/build bytes.

`creator-community-targeted.tap`: 46 tests passed, 0 failed, 0 skipped; exit 0. This contains:

- `game/test/overflight-community.test.mjs`
- `game/test/overflight-studio.test.mjs`
- `game/test/overflight-project.test.mjs`
- `game/test/community-native-families.test.mjs`
- `game/test/community-ownership-concurrency.test.mjs`
- `game/test/community-store.test.mjs`
- `game/test/classic-community-package.test.mjs`
- `services/community/test/overflight-package.test.mjs`

The tests execute exact-byte install → recovery download removal → recover from installed → offload → reinstall, local/global co-ownership, two editions of the same project, stale review rejection, legacy owner migration, forbidden resource references, and service admission without embedded assets. Existing Team, FPV, Classic and Creator Community regressions pass.

Targeted ESLint, formatting and `git diff --check` passed for this agent's source files. The root-owned `app.mjs` and `copy.mjs` have only narrow mission-management edits from this work; their combined formatting and integration remain the root's responsibility.

For local service execution only, the previously absent declared `pngjs@7.0.0` and authoring test dependency `fake-indexeddb@6.2.5` were unpacked into ignored `node_modules`, without lifecycle scripts or package/lockfile edits. Only the two tracked service source files needed for the patch were hydrated; no sparse checkout rules changed.

## Remaining explicit gates

The EN/UK checkbox UI, Studio preview/export, fresh-origin import and native installed mission flow have browser evidence in `creator-browser.json`, `creator-uk.png` and `import-native.png`. Live authenticated Community ownership UI, publication and deployment were not exercised. Packages remain restricted to the code-owned Overflight resource revisions; arbitrary new artwork or logic is not admitted. Device performance, human play quality and release admission are separate gates. The existing Asset Studio/Motion Lab links remain the actual artwork review path. The separate `reuse.html`/`reuse-browser.png` review demonstrates the actual Capture painter and Asset Studio adapter using one decoded shared supply-case asset; it is a paused renderer demonstration, not a second game's playtest.
