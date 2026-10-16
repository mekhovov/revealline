# Overflight and Snake: shared PWA integration

Implementation: `92367843769c2d9ac380bf0caae3f3b196602951`, stacked on the humanoid sound-choice branch. Initial three-mode smoke checks used `4fd4df8dc0c6821e23cc3a50e55da27ec8384f1e`; the later commit also repairs the main home's offline return path. This is local qualification, not deployment or release approval.

## Player flow

The shared home row contains Solo, Team, VS, Snake, Overflight and SIM. Survivor and Raid are operations inside the single Overflight entry. The same row is used by Overflight instead of separate ad-hoc navigation links.

In **Settings → Install & offline play**, select **Overflight · Survivor and Raid** and/or **Snake · Classic**, then confirm the download. Both use the main installed game's runtime and include the shared recorded game-effect package. “All current levels, modes and communities” selects both; deselecting one keeps the other approved selections.

Both native modes use the main manifest, worker, installation and update system. There is no second app or duplicate runtime download. Soundtrack albums, SIM and authoring tools remain separately selectable. Imported content retains the existing local-library rules.

Installation activation is allowed from safe ready/results states. Active or paused runs defer it. Snake additionally checks its round writer, pending imports and page lifecycle; shared edition locks and migration checks remain in effect.

## Automated checks

- Integrated offline/download/home/host cohort: **203 passed**, zero failures or skips.
- Snake host, shared install panel and global settings cohort: **84 passed**. This overlaps the integrated cohort; counts are not a distinct-test total.
- After the home-return regression fix, the offline closure/publication/experience/checkbox/worker cohort: **84 passed**, including the new source-backed dependency regression.
- ESLint, Prettier and `git diff --check` passed for the changes.
- Shared reaction-runtime, academy-audio and play-shell generated projections passed their canonical refresh/check commands.
- Root-scope and immutable-release-scope tests cover first native navigations with query parameters, dependency closure and catalogue admission. Partial native hosts fail publication instead of advertising an incomplete offline mode.

## Browser qualification

Initial three-mode checks passed against the exact generated `main-pages` distribution, build `4182ffc3295750594fce2bd977c85374fe82f88a70a15a60b650557e94fdf99e`. Its 1,620 core files total 60,048,300 bytes. Runtime source matches the initial candidate, including the builder's canonical whitespace projection for Snake and downloads (see `build.json`).

On fresh origin `http://127.0.0.1:8894`, selected the starter content, Overflight and Snake through the normal download UI. It displayed **93.9 MiB total**, including the launcher and original artwork, and completed with both modes **Ready offline**. Shared dependency totals shown beside each mode overlap; they are not additive. Soundtrack albums and authoring tools were not selected.

Closed that preview's HTTP listener before the first browser visit to any of the three modes. `curl` failed with exit 7 before and after the checks. The preview also supplied `Cache-Control: no-store` and a self-only CSP. No mode page was prewarmed online. Restored the same in-memory build afterward for review.

- **Survivor:** native sprites and combat, 30 enemies cleared, an earned Wide Fan upgrade applied at level 2, pause and restart. No console errors.
- **Raid:** launched from the Survivor operation selector; combat, six enemies cleared, score 1,600, pause, restart and reload of its query-bearing URL. Its Settings download iframe loaded offline and displayed both mode packages ready. No console errors.
- **Snake:** launched from Raid's shared mode row; gameplay through results, retry, pause/resume and reload of its query-bearing URL. Its Settings → Content & Offline download iframe also loaded offline. No console errors.
- **Navigation:** the native Overflight home shows the shared six-mode row and one Overflight operation group. The main game's home initially reached its existing password gate. Once unlocked, its menu correctly showed Snake and a single Overflight entry. The gate was not bypassed or changed.

Returning to the main game with its server off exposed an inherited missing dependency: `app.mjs → solo-route-host.mjs → encounter-host.mjs → versus-host.mjs`. The offline selector still excluded that last module as optional despite its static import. Commit `923678437` removes that exclusion, adding **4,386 bytes**; its eight direct dependencies already belong to core. The actual Versus entrypoint remains optional. The source-backed regression fails without the fix and passes with it. An independent audit of all 1,620 original core entries and the generated launcher found no second static-import omission.

### Final corrected-build verification

Prepared and checked build `7240cc6c399f859926b6fbe13b6ad8f0021b96f4dadc4fd3ef91c9b37e866849` from implementation `923678437`. The download UI verified **1,621 core files / 60,052,456 bytes**, with zero missing or corrupt files, after the new worker activated naturally when the old clients closed. Both mode selections and the downloaded gameplay remained ready. `final-build.json` records the served bytes and canonical source matches; the original mode runtime bytes are unchanged.

Stopped the listener again before loading the main game. The complete path passed offline: **main home → Survivor → Raid → main home → Snake → main home**. Started and paused both Overflight operations; restored Snake's saved run through its result, retried and paused it. Both returns to the main game booted successfully; its six-mode row contains one Overflight link and a Snake link. Final main-home console errors: none. `curl` continued to fail with exit 7 after the round-trip. See `final-browser.json`, `final-downloads-verification.txt` and `final-main-return-offline.txt`.

The identical prepared build's listener was restored afterward at `http://127.0.0.1:8894/game/` for review. No publication, deployment or merge was performed.

Screenshots and concise observations are stored alongside this report. These are functional smoke checks, not complete campaign runs or subjective audio-quality approval.

## Limits

This work does not qualify GPU performance, full-run balance, physical controllers or OS-specific app-icon installation. Player downloads do not imply that optional creator tools or soundtrack albums have also been downloaded.
