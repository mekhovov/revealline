# Primary checkout release inventory review

Read-only review on 2026-09-29. Repository: `<shared-checkout>`. Observed branch `codex/mission-selector-level-cards`, HEAD `9e0bf4f69081a38f23514e006239891cd3c62942`. No repository edit, test, snapshot commit, PR mutation, build, or release action was performed by this review.

The current primary tree is a multi-feature integration workspace, not one release-ready change. Preserve it first, then integrate coherent inputs on latest accepted main. Do not overwrite current main with its full old file contents.

## Observation scope and preservation

- The first inventory had 524 dirty files; it grew to 525 and then 526 while being read. The 00:42:03 UTC manifest has **203 tracked modifications and 323 untracked files**, with **34,015,698 bytes of new files**. Existing native icon replacements add further tracked bytes. This confirms active writers; the inventory is not an atomic source snapshot.
- Exact observed paths, statuses, lengths and SHA-256 values are in `primary-inventory.json`. The appended path appendix comes from that manifest. Revalidate the manifest before preserving a checkpoint; retry/coordinate if source changes during copying or indexing.
- HEAD is already the source of **PR #776**, “Rebuild mission selector with global level cards.” Its committed selector implementation is not part of `git diff` and must be admitted only once.
- A whole-tree **draft preservation PR** is reasonable after a stable checkpoint is captured. Base that checkpoint on the current `9e0bf4...` commit and explicitly stack it on #776 / `codex/mission-selector-level-cards`, or otherwise document the included selector dependency. A PR against main would also include #776's committed change. Keep preservation separate from release admission; do not mutate/reset the live shared checkout to split it.
- Split from the preserved checkpoint into isolated branches, with original bytes retained for reference. Shared files need hunk-level integration; path-only staging will pull multiple features together. Large binary folders should stay with their corresponding provenance and consumers.
- Disk was briefly full enough that a shell heredoc failed with ENOSPC; the next read reported only **159 MiB free**. No full local artifact or native staging should be launched here without space. The new untracked files themselves are ~32.4 MiB; the large existing build/site/source outputs are the larger capacity issue.

## Cohesive release input boundaries

These are review boundaries, not ready-made cherry-pick lists. The appendix tags exact paths; files marked shared must be split by behavior or carried as an integration input.

### A. Shared native menu and controller editing foundation

Intent is documented in `docs/native-menus.md` and `docs/authoring-controller-navigation.md`: common Solo/Versus/Team/edition landing and eight-category Settings; directional groups; controller text/numeric/color editors; nested Back/focus behavior; keyboard/touch preservation; shared fullscreen state.

Core source: `game/ui/native-menus.mjs`, `native-menu.css`, `native-menu-icons.mjs`, `menu-navigation-groups.mjs`, `controller-field-editor.mjs`, `controller-field-editor.css`, `controller-text-draft.mjs`, `controller-navigation.mjs`, `fullscreen.mjs`, `settings-panels.mjs`, `mode-choice.mjs`, `game-shell.mjs`, `quick-music-controls.mjs`, and `launcher-navigation.mjs`; their host integrations are in `game/app.mjs`, `game/index.html`, all three `game/couch/` hosts, `game/ui/edition-solo.mjs`, `game/creator/player-navigation.mjs`, and the offline launcher.

Dependency: `native-menus.mjs` currently imports branding, scenes and retune directly. As written, A is coupled to B/C below. The safest first implementation batch is **native menus + branding/scenes + their resource closure**, unless adapters are deliberately separated and revalidated. Authoring adapters can follow as a dependent input.

### B. Authoring controller adapters and bundled in-app sources

Core source: `game/ui/authoring-{copy,editors,input-entry,input-host,reference-entry,reference,sources}.mjs`, `game/ui/authoring-input.css`, `authoring/shared/samples/`, and `game/creator/player-navigation.mjs`. Integrates the adapters into active authoring tools, reference pages, Community, Controller Lab, creator players, Replay Theater, Studio and Playground. `game/build-config.json` adds the sample directory.

Keep `authoring/library/reserve-illustrations-catalog/{catalog.py,test_catalog.py,README.md,index.html}` with this batch: its restricted preview server now explicitly serves the new controller dependency closure. It is not an unrelated artwork change. Likewise `scripts/produce-field-kit-sprites.mjs` and generated `game/assets/field-kit/sprites/review.html` belong together; the large HTML diff adds explicit document structure/navigation needed by unchanged native HTML validation.

### C. Branding, public edition identity and living landing artwork

Brand source: `game/ui/brand-identity.{mjs,css}`, `game/ui/art/identity/`, `authoring/library/fpv-line-identity/`, `authoring/library/droneaid-brand-kit-2026-09-29/`, `scripts/brand-icons.mjs`, `scripts/native-art.mjs`, native metadata/icons, site/current UI text and export filenames. Display identity becomes FPV / LINE; stable save/schema/bundle keys remain RevealLine/revealline.

Public identity source: `game/edition-context.mjs`, `game/editions/catalog.json`, `game/editions/{model,departure-destination}.mjs`, `game/installed-app.mjs`, `game/runtime-content-provider.mjs`, edition UI, `scripts/{compile-edition,edition-runtime,edition-offline,offline-launcher,pages-current-entry,build-pages,bundle-editions}.mjs`, `publishing/edition-promotion.mjs`, and `publishing/pages-controller/launcher.mjs`. The public `droneaid` slug maps to the retained `droneaid-nl-community` identity; canonical/legacy launcher, manifest identity, install-state and rollback behavior must ship together.

Scene source: `game/ui/menu-{scene-catalog,scene-motion,scenes,signal-loss,retune}.mjs`, `game/ui/menu-{scenes,retune}.css`, `game/ui/art/menu-scenes/`, `authoring/library/menu-scenes/`, font files/licenses, `scripts/prepare-menu-scenes.py`, `scripts/build-analog-noise-atlas.mjs`, `scripts/check-menu-editions.mjs`, and the edition/offline resource manifests. The current catalogue has 18 profiles and a selected-edition projection plus FPV fallback; do not add every scene to every edition indiscriminately.

These changes can be one coherent **player menus, identity and landing presentation** release input with A. Splitting branding/public aliases from presentation requires preserving exact resource closure and route compatibility rather than simply moving all PNG/SVG files to another PR.

### D. Demo, replay takeover, shared audio and analog reception

Core source: new `game/demo-*.mjs`, `game/demo-data/`, `game/ui/demo-*.mjs`, `game/ui/demo.css`; changed `game/replay-player.mjs`, `game/mission-library/handoff.mjs`, shared `game/app.mjs`/`game/index.html`/`game/ui/controller-router.mjs`; new `scripts/{build-demo-recordings,import-demo-runtime-variants,soak-demo}.mjs` and `authoring/demo-recording-variants.{html,mjs}`. EN/UK demo catalogues and generated i18n bundle are inseparable.

The input owns the 60-second optional idle demo, explicit watching/practice handoff, bounded Worker bot, twelve frozen replay files representing six scenes, separate opt-in local recording cache, and shared soundtrack transport/style operations. It does not claim universal replay portability: the retained Node/Chromium variants are exact independently verified replays with ordinary failure/fallback behavior.

Related receiver source: `game/ui/{analog-signal,jammer-picture,signal-reception,player-locator}.mjs`, `game/ui/render.mjs`, company painter hooks, and their tests/evidence. Ordinary jammer reception and demo concealment have distinct disclosure policies; retain that separation. Landing receiver/retune modules reuse some analog primitives, so extract a shared primitive first if D is scheduled after C.

Recommended delivery: after preserving the snapshot, make D a separate dependent input after the common controller/menu foundation has been rebased on v0.142.3. Its exact-handoff, background-clock, audio, Worker and storage acceptance is wider than landing presentation and should not be hidden inside a branding PR.

### E. Small boot/compiler improvements within the integration

`game/content-design/project.mjs` and `game/test/content-project.test.mjs` add bounded memoization only for recursively immutable valid source; `game/runtime-content-provider.mjs` and edition-related code also change runtime resource/identity handling. Preserve their targeted regression coverage and distinguish the memoization hunk from presentation/alias hunks. It may be extracted as a small input if useful, but the current whole file also overlaps #758/#761.

## Existing PR ownership and deduplication

Open PRs were read through GitHub. Large PRs #758/#761 required the paginated files API: they contain 815/601 files, beyond the first 100 returned by the convenient PR view.

| Existing PR                               | Relationship to this primary snapshot                                                                                          | Handling                                                                                                                                             |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| #776 `codex/mission-selector-level-cards` | Exact current HEAD; 30 committed files, including selector/library/source and progress metadata                                | Preserve/update this PR; do not recreate its committed feature in the new dirty-tree input.                                                          |
| #771 `codex/pause-menu-universal-skip`    | Overlaps `app.mjs`, `index.html`, fullscreen, game-shell, quick music, presentation host, locales and Pause/Steam Deck tests   | One owner must reconcile Pause/Ready/landing action movement and universal Skip. Do not overwrite either implementation with the older full file.    |
| #779 `codex/audio-style-persistence`      | Primary `soundtrack-panel.mjs` diff is branding/export/credit strings, not the saved-style fix                                 | Admit #779's fix once; reapply branding hunks, regenerate its accepted production-ledger successor on final source.                                  |
| #756 `codex/team-result-difficulty`       | Overlaps Team host, locales and Team host tests                                                                                | Keep direct terminal difficulty recovery while native Settings moves the old setup destinations.                                                     |
| #757 `codex/team-more-navigation`         | Overlaps Team host and its tests                                                                                               | Keep More collapse on play/Pause/results; test against the new native menu layout.                                                                   |
| #758 `codex/discovery-rewards`            | 49 overlapping paths, including app/render-adjacent host, editions, runtime provider/compiler, locale bundles and source tools | Distinct discovery/FPV curriculum input, not duplicate primary work. Integrate all resource/identity/compiler changes against one accepted revision. |
| #761 `codex/actor-rotor-motion`           | 25 overlapping paths, including app/render, Team/Versus, tools, content project and locales                                    | Distinct actor/art/authoring input. Preserve accepted production history and coordinate renderer/editor ownership.                                   |
| #738 / #747                               | No dirty-path overlap found in current primary tree                                                                            | Retain their declared inventory/screening stack; regenerate source pins/reports after changed editions/art enter the cumulative candidate.           |

#778 is the active Steam Deck trace successor, not primary snapshot ownership. Do not include its pipeline or frozen artifact in this work. Community acceptance PRs #736/#745 are also a separate declared stack, not substitutes for the local Community UI adapter changes.

## Critical integration risks and remaining gates

1. **Steam Deck coordinator incompatibility is concrete.** Primary is still on v0.142.1-era API. `game/app.mjs` uses `controllerConfirmLifecycle.reset()` at lines around 3068 and 11821, `.filter()` around 9374, and `confirmTransaction` phase metadata around 9430/11818. The new Demo callback repeats that legacy protocol. Accepted v0.142.3 instead owns native/frame observations through `.sample()`/`.cancel()` and guarded release commit. `game/ui/controller-router.mjs` adds `spectator` to an older implementation; `controller-navigation.mjs` adds field editors to an older begin/commit implementation. A blind take-ours resolution would discard the reproduced Chrome fixes, while a partial take-theirs resolution would throw or strand Demo input. This is a mandatory code integration/host regression gate before scheduling A/D for release.
2. **Shared UI moves overlap already-reviewed player fixes.** Native Settings relocates Help, Fullscreen, collections, music transport and content actions; #771 changes Pause/Ready/Home and #756/#757 change Team recovery/More. Recheck all actions, nested Back, focus restoration, and release-only Confirm against the final combined source. Keep the new `click.isPrimary:false` regression and trace behavior.
3. **Generated closure cannot be cherry-picked independently.** `game/i18n/catalogs.mjs`, EN/UK namespaces, `game/editions/runtime-assets.json`, `runtime-asset-sources.json`, resource projections, icons/manifests and generated review HTML must reproduce from the final source. New font CSS imports brand CSS globally, so even seemingly isolated tool pages now need branding/font dependencies. Native/CSP collectors must retain those imports without weakening policy.
4. **Public alias changes require release-coordinator tests.** `droneaid` canonical scope, retained manifest id, legacy scope acceptance, alias launchers and rollback all touch publisher-generated entry points. Current docs explicitly leave actual installed-PWA migration/update behavior unverified. Treat static source tests as necessary but not physical installed-app acceptance.
5. **Evidence is not final-source release qualification.** Many docs report local v0.142.1 working-tree packages with `sourceRevision:null`. `landing-motion-packaging-2026-09-29.md` explicitly records app/company-player/signal-reception changing during its build. Demo reports no full build/native execution after its main port, and its soak is accelerated Node simulation, not two real browser hours. Native iOS evidence is staged static payload; full Xcode/simulator/device execution was unavailable.
6. **Known recorded test discrepancy remains to reconcile.** Branding evidence reports export/backup/media 215/216, with a pre-existing `xonix-session.v5` expectation while runtime emits v6. Determine whether accepted main already fixes that expectation, then qualify exact final source; do not report the partial suite as all passing.
7. **Active writers and tiny disk headroom block an honest immediate all-in release claim.** Freeze/manifest the intended checkpoint, preserve it, review/split off-copy, then run focused gates on exact heads. Existing reports do not cover the extra files added during this review.

## Suggested queue plan

1. Leave v0.142.3 Steam Deck train isolated. Preserve this primary checkpoint as a held draft after writer coordination and hash stability checks.
2. Keep #776 and the independently reviewed small player fixes as explicit existing inputs; release owner decides the next unallocated slot. No new patch number is allocated by this report.
3. Prepare a native menu / identity / scene integration input (A+C), with shared primitives needed by D, explicitly rebased onto accepted v0.142.3. Add B as a dependent source input or include it when its final closure is already inseparable; avoid multiple full artifact builds for tiny shared-file follow-ups.
4. Prepare D demo/receiver input against that accepted controller/menu source, with final replay/Worker/IndexedDB/audio/offline tests and a bounded browser soak. Keep physical Steam Deck, native mobile and installed-PWA checks explicit.
5. Merge only exact-source qualified inputs in one canonical release candidate; regenerate localization/resources/production history once at the final combined head, then produce one immutable artifact per released version.

No fresh tests were run by this review; counts above are attributed to existing evidence and PR descriptions. This is a dependency/inventory review, not a complete line-by-line correctness certification of 526 files.

## Exact observed dirty paths by review group

Complete 526-file observation at 2026-09-29T00:42:03.626599+00:00. These groups describe primary ownership, not an automatic safe staging plan. Shared host, localization and packaging hunks remain interdependent. M = tracked modification; ?? = untracked. Exact hashes and sizes are retained in primary-inventory.json.

### 0. Shared integration files — preserve together, split only by reviewed hunks (52 files)

- `M` `game/app.mjs`
- `M` `game/build-config.json`
- `M` `game/company-entry.mjs`
- `M` `game/company-player.mjs`
- `M` `game/company.html`
- `M` `game/couch/coop-view.mjs`
- `M` `game/couch/couch-shell.mjs`
- `M` `game/couch/couch.mjs`
- `M` `game/couch/index.html`
- `M` `game/couch/mode-entry.js`
- `M` `game/couch/relay-rescue.html`
- `M` `game/couch/relay-rescue.mjs`
- `M` `game/editions/runtime-asset-sources.json`
- `M` `game/editions/runtime-assets.json`
- `M` `game/i18n/catalogs.mjs`
- `M` `game/index.html`
- `M` `game/locales/en/interface.json`
- `M` `game/locales/en/tools.json`
- `M` `game/locales/en/website.json`
- `M` `game/locales/uk/interface.json`
- `M` `game/locales/uk/tools.json`
- `M` `game/locales/uk/website.json`
- `M` `game/presentation/host.mjs`
- `M` `game/test/boot-build.test.mjs`
- `M` `game/test/company-player-lifecycle.test.mjs`
- `M` `game/test/controller-boost.test.mjs`
- `M` `game/test/coop-host.test.mjs`
- `M` `game/test/coop-shared-settings.test.mjs`
- `M` `game/test/edition-solo-host.test.mjs`
- `M` `game/test/field-kit-flow.test.mjs`
- `M` `game/test/helpers/couch-dom.mjs`
- `M` `game/test/helpers/solo-dom.mjs`
- `M` `game/test/quick-music-controls.test.mjs`
- `M` `game/test/soundtrack-panel.test.mjs`
- `M` `game/test/soundtrack-player.test.mjs`
- `M` `game/test/steamdeck-menu-confirm-host.test.mjs`
- `M` `game/test/team-journey-next-host.test.mjs`
- `M` `game/test/tiny5-font.test.mjs`
- `M` `game/ui/controller-navigation.mjs`
- `M` `game/ui/controller-router.mjs`
- `M` `game/ui/edition-solo.mjs`
- `M` `game/ui/field-kit-fonts.css`
- `M` `game/ui/field-kit-tokens.css`
- `M` `game/ui/game-shell.mjs`
- `M` `game/ui/quick-music-controls.mjs`
- `M` `game/ui/render.mjs`
- `M` `game/ui/soundtrack-panel.mjs`
- `M` `game/ui/soundtrack-player.mjs`
- `M` `scripts/game-cli.mjs`
- `M` `scripts/offline-core-closure.mjs`
- `M` `scripts/test-game-cli.mjs`
- `M` `scripts/test-offline-core-closure.mjs`

### A. Native menu, Settings/fullscreen and host integration (80 files)

- `??` `docs/authoring-controller-navigation.md`
- `??` `docs/native-menu-inventory.json`
- `??` `docs/native-menus.md`
- `??` `docs/verification/authoring-artifact-validation-2026-09-29.json`
- `??` `docs/verification/authoring-navigation-2026-09-28.md`
- `??` `docs/verification/company-menu-source-2026-09-29.md`
- `??` `docs/verification/native-menu-2026-09-29/fullscreen-animated-packaged.png`
- `??` `docs/verification/native-menu-2026-09-29/fullscreen-animated-source.png`
- `??` `docs/verification/native-menu-2026-09-29/settings-desktop.png`
- `??` `docs/verification/native-menu-2026-09-29/settings-packaged.png`
- `??` `docs/verification/native-menu-2026-09-29/settings-portrait-uk.png`
- `??` `docs/verification/native-menu-2026-09-29/solo-desktop.png`
- `??` `docs/verification/native-menu-2026-09-29/solo-landscape-uk.png`
- `??` `docs/verification/native-menu-2026-09-29/solo-packaged.png`
- `??` `docs/verification/native-menu-2026-09-29/solo-portrait-uk.png`
- `??` `docs/verification/native-menu-packaging-2026-09-29.md`
- `??` `docs/verification/native-menus-2026-09-28.md`
- `??` `game/community/directory.css`
- `M` `game/community/index.html`
- `M` `game/community/moderation.html`
- `M` `game/controller-lab/index.html`
- `M` `game/creator/creator.css`
- `M` `game/creator/index.html`
- `M` `game/creator/player.html`
- `M` `game/creator/player.mjs`
- `M` `game/creator/team.html`
- `M` `game/downloads.html`
- `??` `game/locales/en/controllerEditor.json`
- `??` `game/locales/uk/controllerEditor.json`
- `M` `game/offline/app.html`
- `M` `game/offline/app.mjs`
- `??` `game/offline/navigation.css`
- `M` `game/playground/index.html`
- `M` `game/playground/model.mjs`
- `M` `game/playground/playground.mjs`
- `M` `game/presentation/combat-review.html`
- `M` `game/presentation/journey-actor-review.html`
- `M` `game/profile-recovery.html`
- `M` `game/replay-theater/app.mjs`
- `M` `game/replay-theater/index.html`
- `M` `game/studio/index.html`
- `M` `game/studio/studio.mjs`
- `M` `game/test/authored-mode-entry-host.test.mjs`
- `M` `game/test/controller-navigation.test.mjs`
- `M` `game/test/coop-display-reflow.test.mjs`
- `M` `game/test/couch-catalogue-host.test.mjs`
- `M` `game/test/couch-composite-menu-navigation.test.mjs`
- `M` `game/test/couch-shell.test.mjs`
- `M` `game/test/defeat-presentation-host.test.mjs`
- `M` `game/test/display-preferences-host.test.mjs`
- `M` `game/test/field-kit-surfaces.test.mjs`
- `M` `game/test/fullscreen.test.mjs`
- `M` `game/test/install-offline-panel.test.mjs`
- `??` `game/test/launcher-navigation.test.mjs`
- `M` `game/test/localization-couch-host.test.mjs`
- `??` `game/test/native-landing-fullscreen.test.mjs`
- `??` `game/test/native-menu-inventory.test.mjs`
- `M` `game/test/presentation-host.test.mjs`
- `M` `game/test/settings-panels-locale-host.test.mjs`
- `M` `game/test/settings-panels.test.mjs`
- `M` `game/test/settings-restoration-host.test.mjs`
- `M` `game/test/shared-settings-solo.test.mjs`
- `M` `game/test/shared-settings-versus.test.mjs`
- `M` `game/test/still-media-host.test.mjs`
- `M` `game/test/video-poster-workshop.test.mjs`
- `M` `game/ui/field-kit-surfaces.mjs`
- `M` `game/ui/fullscreen.mjs`
- `??` `game/ui/launcher-navigation.mjs`
- `M` `game/ui/library-panel.mjs`
- `??` `game/ui/menu-navigation-groups.mjs`
- `M` `game/ui/mode-choice.mjs`
- `??` `game/ui/native-menu-icons.mjs`
- `??` `game/ui/native-menu.css`
- `??` `game/ui/native-menus.mjs`
- `M` `game/ui/pwa-install.mjs`
- `M` `game/ui/settings-panels.mjs`
- `M` `game/ui/still-media-host.mjs`
- `M` `game/ui/video-poster-workshop.mjs`
- `??` `scripts/check-menu-editions.mjs`
- `M` `scripts/native-cli.mjs`

### B. Authoring/reference controller adapters and generated tool entry points (54 files)

- `M` `authoring/asset-studio/index.html`
- `M` `authoring/asset-studio/sprite-panel.mjs`
- `M` `authoring/community/index.html`
- `M` `authoring/company-studio/index.html`
- `M` `authoring/company-studio/playtest.html`
- `M` `authoring/design-atlas/atlas.mjs`
- `M` `authoring/design-atlas/index.html`
- `M` `authoring/design-atlas/reveal-audit.html`
- `M` `authoring/enemy-catalog/index.html`
- `M` `authoring/enemy-catalog/workshop.mjs`
- `M` `authoring/library/countercurrent-art/index.html`
- `M` `authoring/library/fpv-enemy-presentations/index.html`
- `M` `authoring/library/fpv-field-kit/prepared/reveals/review.html`
- `M` `authoring/library/fpv-field-kit/prepared/titles/review.html`
- `M` `authoring/library/fpv-role-presentations/index.html`
- `M` `authoring/library/reserve-illustrations-catalog/README.md`
- `M` `authoring/library/reserve-illustrations-catalog/catalog.py`
- `M` `authoring/library/reserve-illustrations-catalog/index.html`
- `??` `authoring/library/reserve-illustrations-catalog/test_catalog.py`
- `M` `authoring/library/revealline-original-soundtrack/local-production/audition.html`
- `M` `authoring/library/runtime-sprite-candidates-v1/inspection/index.html`
- `M` `authoring/library/ukraine-role-presentations/index.html`
- `M` `authoring/library/ukraine-role-wide-variants/index.html`
- `M` `authoring/motion-lab/app.js`
- `M` `authoring/motion-lab/index.html`
- `M` `authoring/production/index.html`
- `M` `authoring/prompts/native-edition-workflows.json`
- `??` `authoring/shared/samples/README.md`
- `??` `authoring/shared/samples/dawn-signal.mp4`
- `??` `authoring/shared/samples/dawn-signal.png`
- `M` `authoring/still-media/index.html`
- `M` `authoring/video-poster/index.html`
- `M` `authoring/viewport-lab/index.html`
- `M` `game/assets/field-kit/icons/review.html`
- `M` `game/assets/field-kit/sprites/review.html`
- `??` `game/creator/player-navigation.mjs`
- `??` `game/test/authoring-input.test.mjs`
- `??` `game/test/authoring-reference.test.mjs`
- `??` `game/test/controller-text-draft.test.mjs`
- `??` `game/test/creator-player-navigation.test.mjs`
- `M` `game/test/sprite-panel-focus.test.mjs`
- `??` `game/ui/authoring-copy.mjs`
- `??` `game/ui/authoring-editors.mjs`
- `??` `game/ui/authoring-input-entry.mjs`
- `??` `game/ui/authoring-input-host.mjs`
- `??` `game/ui/authoring-input.css`
- `??` `game/ui/authoring-reference-entry.mjs`
- `??` `game/ui/authoring-reference.mjs`
- `??` `game/ui/authoring-sources.mjs`
- `??` `game/ui/controller-field-editor.css`
- `??` `game/ui/controller-field-editor.mjs`
- `??` `game/ui/controller-text-draft.mjs`
- `M` `scripts/produce-field-kit-sprites.mjs`
- `M` `scripts/test-localization-pages.mjs`

### C1. FPV / LINE and edition public identity, native icons and publication (121 files)

- `??` `authoring/library/droneaid-brand-kit-2026-09-29/README.md`
- `??` `authoring/library/droneaid-brand-kit-2026-09-29/background-original.png`
- `??` `authoring/library/droneaid-brand-kit-2026-09-29/logomark-light.svg`
- `??` `authoring/library/droneaid-brand-kit-2026-09-29/review.html`
- `??` `authoring/library/droneaid-brand-kit-2026-09-29/sources.json`
- `??` `authoring/library/droneaid-brand-kit-2026-09-29/wordmark-dark.svg`
- `??` `authoring/library/droneaid-brand-kit-2026-09-29/wordmark-light.svg`
- `??` `authoring/library/fpv-line-identity/icon-original.png`
- `??` `authoring/library/fpv-line-identity/prompts.json`
- `??` `docs/edition-public-identity.md`
- `??` `docs/fpv-line-branding.md`
- `??` `docs/verification/droneaid-brand-2026-09-29.md`
- `??` `docs/verification/droneaid-brand-2026-09-29/landing-desktop.jpg`
- `??` `docs/verification/droneaid-brand-2026-09-29/landing-portrait.jpg`
- `??` `docs/verification/fpv-line-brand-2026-09-29.md`
- `??` `docs/verification/fpv-line-brand-2026-09-29/about-en.jpg`
- `??` `docs/verification/fpv-line-brand-2026-09-29/about-uk.jpg`
- `??` `docs/verification/fpv-line-brand-2026-09-29/company-studio.jpg`
- `??` `docs/verification/fpv-line-brand-2026-09-29/coupa-developers-390-corrected.jpg`
- `??` `docs/verification/fpv-line-brand-2026-09-29/coupa-developers-390.jpg`
- `??` `docs/verification/fpv-line-brand-2026-09-29/creator.jpg`
- `??` `docs/verification/fpv-line-brand-2026-09-29/design-atlas.jpg`
- `??` `docs/verification/fpv-line-brand-2026-09-29/droneaid-390-corrected.jpg`
- `??` `docs/verification/fpv-line-brand-2026-09-29/droneaid-390.jpg`
- `??` `docs/verification/fpv-line-brand-2026-09-29/droneaid-desktop-final.jpg`
- `??` `docs/verification/fpv-line-brand-2026-09-29/droneaid-standalone-final.jpg`
- `??` `docs/verification/fpv-line-brand-2026-09-29/edition-source-390-corrected.json`
- `??` `docs/verification/fpv-line-brand-2026-09-29/edition-source-390.json`
- `??` `docs/verification/fpv-line-brand-2026-09-29/focused-tests.txt`
- `??` `docs/verification/fpv-line-brand-2026-09-29/fpv-desktop-final.jpg`
- `??` `docs/verification/fpv-line-brand-2026-09-29/fpv-plain-desktop.jpg`
- `??` `docs/verification/fpv-line-brand-2026-09-29/fpv-uk-390-final.jpg`
- `??` `docs/verification/fpv-line-brand-2026-09-29/standalone-build.json`
- `??` `docs/verification/fpv-line-brand-2026-09-29/team-uk-390-final.jpg`
- `??` `docs/verification/fpv-line-brand-2026-09-29/versus-desktop-final.jpg`
- `??` `docs/verification/fpv-line-brand-2026-09-29/versus-ready-logo.jpg`
- `??` `docs/verification/fpv-line-brand-2026-09-29/versus-title-tests.txt`
- `??` `docs/verification/fpv-line-copy-2026-09-29.md`
- `??` `docs/verification/fpv-line-edition-browser-2026-09-29.md`
- `??` `docs/verification/fpv-line-icons-2026-09-29.md`
- `M` `game/backup-set.mjs`
- `??` `game/community/store.html`
- `M` `game/company-campaigns/brands.mjs`
- `M` `game/edition-context.mjs`
- `M` `game/editions/catalog.json`
- `M` `game/editions/departure-destination.mjs`
- `M` `game/editions/model.mjs`
- `M` `game/installed-app.mjs`
- `M` `game/runtime-content-provider.mjs`
- `M` `game/test/backup-set-host.test.mjs`
- `M` `game/test/backup-set.test.mjs`
- `??` `game/test/brand-identity.test.mjs`
- `??` `game/test/community-directory.test.mjs`
- `??` `game/test/couch-brand-title.test.mjs`
- `M` `game/test/edition-context.test.mjs`
- `M` `game/test/edition-departure-destination.test.mjs`
- `??` `game/test/edition-example-packs-host.test.mjs`
- `??` `game/test/edition-public-identity.test.mjs`
- `M` `game/test/edition-runtime.test.mjs`
- `??` `game/test/edition-theme-label.test.mjs`
- `M` `game/test/editions.test.mjs`
- `M` `game/test/runtime-content-provider.test.mjs`
- `M` `game/test/session-only-release-next-host.test.mjs`
- `M` `game/test/session-originals-export.test.mjs`
- `M` `game/test/still-media-bundle-ui.test.mjs`
- `M` `game/test/still-story-panel.test.mjs`
- `??` `game/ui/art/identity/fpv-line/icon-16.png`
- `??` `game/ui/art/identity/fpv-line/icon-180.png`
- `??` `game/ui/art/identity/fpv-line/icon-192.png`
- `??` `game/ui/art/identity/fpv-line/icon-32.png`
- `??` `game/ui/art/identity/fpv-line/icon-512.png`
- `??` `game/ui/art/identity/fpv-line/icon-master.png`
- `??` `game/ui/art/identity/fpv-line/install-icons.json`
- `??` `game/ui/art/identity/fpv-line/provenance.json`
- `??` `game/ui/art/identity/fpv-line/wordmark.png`
- `??` `game/ui/brand-identity.css`
- `??` `game/ui/brand-identity.mjs`
- `M` `game/ui/edition-navigation.mjs`
- `M` `game/ui/edition-play.css`
- `??` `game/ui/edition-theme-label.mjs`
- `M` `game/ui/session-originals-export.mjs`
- `M` `game/ui/still-media-panel.mjs`
- `M` `game/ui/still-story-panel.mjs`
- `M` `platforms/desktop/README.md`
- `M` `platforms/desktop/assets/revealline.icns`
- `M` `platforms/desktop/main.mjs`
- `M` `platforms/desktop/package-security.mjs`
- `M` `platforms/desktop/package.json`
- `M` `platforms/desktop/package.mjs`
- `M` `platforms/desktop/test/package-security.test.mjs`
- `M` `platforms/desktop/test/packaging.test.mjs`
- `M` `platforms/ios/README.md`
- `M` `platforms/ios/capacitor.config.json`
- `M` `platforms/ios/diagnostics/index.html`
- `M` `platforms/ios/native/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png`
- `M` `platforms/ios/native/App/App/Assets.xcassets/Splash.imageset/splash-2732x2732-1.png`
- `M` `platforms/ios/native/App/App/Assets.xcassets/Splash.imageset/splash-2732x2732-2.png`
- `M` `platforms/ios/native/App/App/Assets.xcassets/Splash.imageset/splash-2732x2732.png`
- `M` `platforms/ios/native/App/App/Info.plist`
- `M` `platforms/ios/package.json`
- `M` `publishing/edition-fixture.mjs`
- `M` `publishing/edition-promotion.mjs`
- `M` `publishing/edition-promotion.test.mjs`
- `M` `publishing/pages-controller/launcher.mjs`
- `??` `scripts/brand-icons.mjs`
- `??` `scripts/brand-icons.test.mjs`
- `M` `scripts/build-pages.mjs`
- `M` `scripts/bundle-editions.mjs`
- `M` `scripts/company-studio.mjs`
- `M` `scripts/compile-edition.mjs`
- `M` `scripts/edition-offline.mjs`
- `M` `scripts/edition-runtime.mjs`
- `M` `scripts/native-art.mjs`
- `M` `scripts/native-art.test.mjs`
- `M` `scripts/offline-launcher.mjs`
- `M` `scripts/pages-current-entry.mjs`
- `M` `scripts/test-edition-offline.mjs`
- `M` `scripts/test-offline-publication.mjs`
- `M` `scripts/test-pages-current-entry.mjs`
- `M` `site/about.html`
- `M` `site/index.html`

### C2. Living landing scenes, receiver/retune and font assets (92 files)

- `??` `authoring/library/menu-scenes/aggregate-prompts.json`
- `??` `authoring/library/menu-scenes/coupa-overview-v1.png`
- `??` `authoring/library/menu-scenes/droneaid-nl-overview-v1.png`
- `??` `authoring/library/menu-scenes/prompts.json`
- `??` `authoring/library/menu-scenes/retro-rainy-arcade-v1.png`
- `??` `authoring/library/menu-scenes/ukraine-dawn-v1.png`
- `M` `docs/fpv-typography.md`
- `??` `docs/menu-scenes.md`
- `??` `docs/verification/analog-retune-2026-09-29/menu-retune-held.png`
- `??` `docs/verification/landing-cinemagraph-2026-09-29/fallback-settled.json`
- `??` `docs/verification/landing-cinemagraph-2026-09-29/fpv-fixed-view.jpg`
- `??` `docs/verification/landing-cinemagraph-research-2026-09-29.md`
- `??` `docs/verification/landing-motion-browser-2026-09-29.md`
- `??` `docs/verification/landing-motion-fullscreen-2026-09-29.md`
- `??` `docs/verification/landing-motion-packaging-2026-09-29.json`
- `??` `docs/verification/landing-motion-packaging-2026-09-29.md`
- `??` `docs/verification/landing-reception-2026-09-29.md`
- `??` `docs/verification/landing-reception-2026-09-29/dropout-0.jpg`
- `??` `docs/verification/landing-reception-2026-09-29/dropout-1.jpg`
- `??` `docs/verification/landing-reception-2026-09-29/dropout-2.jpg`
- `??` `docs/verification/landing-reception-2026-09-29/dropout-3.jpg`
- `??` `docs/verification/landing-reception-2026-09-29/dropout-4.jpg`
- `??` `docs/verification/landing-reception-2026-09-29/dropout-5.jpg`
- `??` `docs/verification/landing-reception-2026-09-29/dropout-6.jpg`
- `??` `docs/verification/landing-reception-2026-09-29/dropout-7.jpg`
- `??` `docs/verification/landing-reception-2026-09-29/dropout-8.jpg`
- `??` `docs/verification/landing-reception-2026-09-29/dropout-9.jpg`
- `??` `docs/verification/landing-reception-2026-09-29/fallback-and-controls.json`
- `??` `docs/verification/landing-reception-2026-09-29/home-arrival.jpg`
- `??` `docs/verification/landing-reception-2026-09-29/home-signal-loss.jpg`
- `??` `docs/verification/landing-reception-2026-09-29/portrait.jpg`
- `??` `docs/verification/living-artwork-2026-09-29.md`
- `??` `docs/verification/living-artwork-2026-09-29/fpv-moving-a.jpg`
- `??` `docs/verification/living-artwork-2026-09-29/fpv-moving-b.jpg`
- `??` `docs/verification/living-artwork-2026-09-29/fpv-paused-a.jpg`
- `??` `docs/verification/living-artwork-2026-09-29/fpv-paused-b.jpg`
- `??` `docs/verification/living-artwork-2026-09-29/frame-comparison.json`
- `??` `docs/verification/living-artwork-2026-09-29/home-desktop.jpg`
- `??` `docs/verification/living-artwork-2026-09-29/home-portrait.jpg`
- `??` `docs/verification/menu-scenes/edition-compilation.json`
- `??` `docs/verification/menu-scenes/final-packaging.json`
- `??` `docs/verification/menu-scenes/final-source-fingerprints.json`
- `??` `docs/verification/menu-scenes/measure.html`
- `??` `docs/verification/menu-scenes/measure.mjs`
- `??` `docs/verification/menu-scenes/motion-multiframe-2026-09-29.json`
- `??` `docs/verification/menu-scenes/motion-native-visibility-2026-09-29.json`
- `??` `docs/verification/menu-scenes/performance.md`
- `??` `game/test/manual/living-artwork.html`
- `??` `game/test/manual/living-artwork.mjs`
- `??` `game/test/manual/menu-retune.html`
- `??` `game/test/manual/menu-retune.mjs`
- `??` `game/test/menu-font.test.mjs`
- `??` `game/test/menu-retune-host.test.mjs`
- `??` `game/test/menu-retune.test.mjs`
- `??` `game/test/menu-scene-motion.test.mjs`
- `??` `game/test/menu-scenes.test.mjs`
- `??` `game/test/menu-signal-loss.test.mjs`
- `??` `game/ui/art/menu-scenes/analog-noise-atlas.png`
- `??` `game/ui/art/menu-scenes/coupa-developer-integration-theme.webp`
- `??` `game/ui/art/menu-scenes/coupa-inside-village-theme.webp`
- `??` `game/ui/art/menu-scenes/coupa-product-operations-theme.webp`
- `??` `game/ui/art/menu-scenes/coupa-source-to-pay-theme.webp`
- `??` `game/ui/art/menu-scenes/coupa-spend-in-motion-theme.webp`
- `??` `game/ui/art/menu-scenes/coupa-village.webp`
- `??` `game/ui/art/menu-scenes/coupa.webp`
- `??` `game/ui/art/menu-scenes/droneaid-community.webp`
- `??` `game/ui/art/menu-scenes/droneaid-main-background.png`
- `??` `game/ui/art/menu-scenes/droneaid-nl-careful-handoff-theme.webp`
- `??` `game/ui/art/menu-scenes/droneaid-nl-community.webp`
- `??` `game/ui/art/menu-scenes/droneaid-nl-makers-together-theme.webp`
- `??` `game/ui/art/menu-scenes/droneaid-nl-parts-in-motion-theme.webp`
- `??` `game/ui/art/menu-scenes/droneaid-nl-shared-horizon-theme.webp`
- `??` `game/ui/art/menu-scenes/droneaid-nl-signals-of-support-theme.webp`
- `??` `game/ui/art/menu-scenes/droneaid-nl-workshop-lights-theme.webp`
- `??` `game/ui/art/menu-scenes/droneaid-wordmark-light.svg`
- `??` `game/ui/art/menu-scenes/fpv-portrait.webp`
- `??` `game/ui/art/menu-scenes/fpv.webp`
- `??` `game/ui/art/menu-scenes/provenance.json`
- `??` `game/ui/art/menu-scenes/retro.webp`
- `??` `game/ui/art/menu-scenes/ukraine.webp`
- `??` `game/ui/fonts/departure-mono/DepartureMono-Regular.otf`
- `??` `game/ui/fonts/departure-mono/DepartureMono-Regular.woff2`
- `??` `game/ui/fonts/departure-mono/LICENSE`
- `??` `game/ui/fonts/departure-mono/provenance.json`
- `??` `game/ui/menu-retune.css`
- `??` `game/ui/menu-retune.mjs`
- `??` `game/ui/menu-scene-catalog.mjs`
- `??` `game/ui/menu-scene-motion.mjs`
- `??` `game/ui/menu-scenes.css`
- `??` `game/ui/menu-scenes.mjs`
- `??` `game/ui/menu-signal-loss.mjs`
- `??` `scripts/prepare-menu-scenes.py`

### D. Demo/replay/bot/audio and analog reception (125 files)

- `??` `authoring/demo-recording-variants.html`
- `??` `authoring/demo-recording-variants.mjs`
- `??` `docs/demo-mode.md`
- `??` `docs/verification/analog-flight-references-2026-09-29.md`
- `??` `docs/verification/analog-menu-references-2026-09-29.md`
- `??` `docs/verification/analog-retune-2026-09-29.md`
- `??` `docs/verification/analog-retune-2026-09-29/flight-acquisition.png`
- `??` `docs/verification/analog-retune-2026-09-29/flight-mid-loss.png`
- `??` `docs/verification/analog-retune-2026-09-29/flight-reduced-loss.png`
- `??` `docs/verification/analog-retune-2026-09-29/flight-signal-lost.png`
- `??` `docs/verification/demo-analog-continuous-2026-09-28.md`
- `??` `docs/verification/demo-atmosphere-2026-09-29.md`
- `??` `docs/verification/demo-atmosphere-2026-09-29/accelerated-soak.json`
- `??` `docs/verification/demo-atmosphere-2026-09-29/desktop-en.png`
- `??` `docs/verification/demo-atmosphere-2026-09-29/desktop-uk.png`
- `??` `docs/verification/demo-atmosphere-2026-09-29/landscape-en.png`
- `??` `docs/verification/demo-atmosphere-2026-09-29/portrait-en.png`
- `??` `docs/verification/demo-mode-2026-09-28.md`
- `??` `docs/verification/demo-mode-2026-09-28/analog-direct-takeover.png`
- `??` `docs/verification/demo-mode-2026-09-28/analog-final-preview.png`
- `??` `docs/verification/demo-mode-2026-09-28/analog-fullscreen-orchard.png`
- `??` `docs/verification/demo-mode-2026-09-28/analog-phone-preview.png`
- `??` `docs/verification/demo-mode-2026-09-28/bot-qualification.json`
- `??` `docs/verification/demo-mode-2026-09-28/browser-adapters.txt`
- `??` `docs/verification/demo-mode-2026-09-28/courtyard-mosaic.png`
- `??` `docs/verification/demo-mode-2026-09-28/desktop-lighter-blur.png`
- `??` `docs/verification/demo-mode-2026-09-28/orchard-mosaic-practice.png`
- `??` `docs/verification/demo-mode-2026-09-28/orchard-mosaic-victory.png`
- `??` `docs/verification/demo-mode-2026-09-28/orchard-mosaic.png`
- `??` `docs/verification/demo-mode-2026-09-28/recorded-takeover.png`
- `??` `docs/verification/demo-mode-2026-09-28/signal-demo-gameplay.png`
- `??` `docs/verification/demo-mode-2026-09-28/signal-demo-practice.png`
- `??` `docs/verification/demo-mode-2026-09-28/signal-picture-comparison.png`
- `??` `docs/verification/demo-mode-2026-09-28/soak-attempt-1-timeout.json`
- `??` `docs/verification/demo-mode-2026-09-28/soak-attempt-2-timeout.json`
- `??` `docs/verification/demo-mode-2026-09-28/soak-report-before-runtime-variants.json`
- `??` `docs/verification/demo-mode-2026-09-28/soak-report.json`
- `??` `docs/verification/demo-picture-2026-09-28.md`
- `??` `docs/verification/demo-picture-signal-2026-09-28.md`
- `??` `docs/verification/signal-picture-2026-09-29.md`
- `??` `docs/verification/signal-picture-2026-09-29/picture-variety-and-jammer.png`
- `??` `docs/verification/signal-picture-2026-09-29/relay-perimeter-active.png`
- `??` `docs/verification/signal-picture-2026-09-29/relay-perimeter-recovery.png`
- `??` `docs/verification/signal-picture-2026-09-29/relay-perimeter-warning.png`
- `??` `docs/verification/signal-picture-2026-09-29/relay-storm-inputs.json`
- `??` `docs/verification/signal-reception-2026-09-29.md`
- `??` `docs/verification/signal-reception-2026-09-29/acquisition.png`
- `??` `docs/verification/signal-reception-2026-09-29/reduced-loss.png`
- `??` `docs/verification/signal-reception-2026-09-29/signal-lost.png`
- `??` `game/demo-bot-player.mjs`
- `??` `game/demo-bot-worker.mjs`
- `??` `game/demo-bot.mjs`
- `??` `game/demo-catalog.mjs`
- `??` `game/demo-data/catalog.json`
- `??` `game/demo-data/crosswind-openings.chromium-macos.replay.json`
- `??` `game/demo-data/crosswind-openings.replay.json`
- `??` `game/demo-data/first-signal-left.chromium-macos.replay.json`
- `??` `game/demo-data/first-signal-left.replay.json`
- `??` `game/demo-data/first-signal-right.chromium-macos.replay.json`
- `??` `game/demo-data/first-signal-right.replay.json`
- `??` `game/demo-data/night-patrol-loop.chromium-macos.replay.json`
- `??` `game/demo-data/night-patrol-loop.replay.json`
- `??` `game/demo-data/relay-orchard-loop.chromium-macos.replay.json`
- `??` `game/demo-data/relay-orchard-loop.replay.json`
- `??` `game/demo-data/relay-orchard-stairs.chromium-macos.replay.json`
- `??` `game/demo-data/relay-orchard-stairs.replay.json`
- `??` `game/demo-data/variant-provenance.json`
- `??` `game/demo-director.mjs`
- `??` `game/demo-experience.mjs`
- `??` `game/demo-library.mjs`
- `??` `game/demo-sources.mjs`
- `??` `game/locales/en/demo.json`
- `??` `game/locales/uk/demo.json`
- `M` `game/mission-library/handoff.mjs`
- `M` `game/replay-player.mjs`
- `??` `game/test/analog-signal.test.mjs`
- `??` `game/test/demo-audio-host.test.mjs`
- `??` `game/test/demo-audio.test.mjs`
- `??` `game/test/demo-background.test.mjs`
- `??` `game/test/demo-bot.test.mjs`
- `??` `game/test/demo-clock.test.mjs`
- `??` `game/test/demo-director.test.mjs`
- `??` `game/test/demo-experience.test.mjs`
- `??` `game/test/demo-fresh-handoff.test.mjs`
- `??` `game/test/demo-fullscreen.test.mjs`
- `??` `game/test/demo-host.test.mjs`
- `??` `game/test/demo-input.test.mjs`
- `??` `game/test/demo-library.test.mjs`
- `??` `game/test/demo-picture.test.mjs`
- `??` `game/test/demo-recordings.test.mjs`
- `??` `game/test/demo-sources.test.mjs`
- `??` `game/test/demo-transition-picture.test.mjs`
- `??` `game/test/helpers/demo-host-fixture.mjs`
- `??` `game/test/jammer-picture.test.mjs`
- `??` `game/test/manual/authoring-controller.html`
- `??` `game/test/manual/authoring-controller.mjs`
- `??` `game/test/manual/edition-launcher-controller.html`
- `??` `game/test/manual/menu-motion-evidence.html`
- `??` `game/test/manual/menu-motion-evidence.mjs`
- `??` `game/test/manual/menu-motion-pane.html`
- `??` `game/test/manual/signal-reception.html`
- `??` `game/test/manual/signal-reception.mjs`
- `??` `game/test/manual/verify-authoring-downloads.mjs`
- `M` `game/test/mission-library-handoff.test.mjs`
- `M` `game/test/optional-world-play-scenarios.mjs`
- `??` `game/test/player-locator.test.mjs`
- `??` `game/test/signal-reception-host.test.mjs`
- `??` `game/test/signal-reception-renderer.test.mjs`
- `??` `game/test/signal-reception-restore-host.test.mjs`
- `??` `game/test/signal-reception.test.mjs`
- `??` `game/ui/analog-signal.mjs`
- `??` `game/ui/demo-audio.mjs`
- `??` `game/ui/demo-clock.mjs`
- `??` `game/ui/demo-fullscreen.mjs`
- `??` `game/ui/demo-host.mjs`
- `??` `game/ui/demo-input.mjs`
- `??` `game/ui/demo-picture.mjs`
- `??` `game/ui/demo.css`
- `??` `game/ui/jammer-picture.mjs`
- `??` `game/ui/player-locator.mjs`
- `??` `game/ui/signal-reception.mjs`
- `??` `scripts/build-analog-noise-atlas.mjs`
- `??` `scripts/build-demo-recordings.mjs`
- `??` `scripts/import-demo-runtime-variants.mjs`
- `??` `scripts/soak-demo.mjs`

### E. Immutable content compilation memoization (2 files)

- `M` `game/content-design/project.mjs`
- `M` `game/test/content-project.test.mjs`
