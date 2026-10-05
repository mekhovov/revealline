# Overflight and Snake: shared PWA integration

Implementation candidate: `4fd4df8dc0c6821e23cc3a50e55da27ec8384f1e`, stacked on the humanoid sound-choice branch. This is local qualification, not deployment or release approval.

## Player flow

The shared home row contains Solo, Team, VS, Snake, Overflight and SIM. Survivor and Raid are operations inside the single Overflight entry. The same row is used by Overflight instead of separate ad-hoc navigation links.

In **Settings → Install & offline play**, select **Overflight · Survivor and Raid** and/or **Snake · Classic**, then confirm the download. Both use the main installed game's runtime and include the shared recorded game-effect package. “All current levels, modes and communities” selects both; deselecting one keeps the other approved selections.

Both native modes use the main manifest, worker, installation and update system. There is no second app or duplicate runtime download. Soundtrack albums, SIM and authoring tools remain separately selectable. Imported content retains the existing local-library rules.

Installation activation is allowed from safe ready/results states. Active or paused runs defer it. Snake additionally checks its round writer, pending imports and page lifecycle; shared edition locks and migration checks remain in effect.

## Automated checks

- Integrated offline/download/home/host cohort: **203 passed**, zero failures or skips.
- Snake host, shared install panel and global settings cohort: **84 passed**. This overlaps the integrated cohort; counts are not a distinct-test total.
- ESLint, Prettier and `git diff --check` passed for the changes.
- Shared reaction-runtime, academy-audio and play-shell generated projections passed their canonical refresh/check commands.
- Root-scope and immutable-release-scope tests cover first native navigations with query parameters, dependency closure and catalogue admission. Partial native hosts fail publication instead of advertising an incomplete offline mode.

## Browser qualification

Passed against the exact generated `main-pages` distribution, build `4182ffc3295750594fce2bd977c85374fe82f88a70a15a60b650557e94fdf99e`. Its 1,620 core files total 60,048,300 bytes. Runtime source matches the implementation candidate, including the builder's canonical whitespace projection for Snake and downloads (see `build.json`).

On fresh origin `http://127.0.0.1:8894`, selected the starter content, Overflight and Snake through the normal download UI. It displayed **93.9 MiB total**, including the launcher and original artwork, and completed with both modes **Ready offline**. Shared dependency totals shown beside each mode overlap; they are not additive. Soundtrack albums and authoring tools were not selected.

Closed that preview's HTTP listener before the first browser visit to any of the three modes. `curl` failed with exit 7 before and after the checks. The preview also supplied `Cache-Control: no-store` and a self-only CSP. No mode page was prewarmed online. Restored the same in-memory build afterward for review.

- **Survivor:** native sprites and combat, 30 enemies cleared, an earned Wide Fan upgrade applied at level 2, pause and restart. No console errors.
- **Raid:** launched from the Survivor operation selector; combat, six enemies cleared, score 1,600, pause, restart and reload of its query-bearing URL. Its Settings download iframe loaded offline and displayed both mode packages ready. No console errors.
- **Snake:** launched from Raid's shared mode row; gameplay through results, retry, pause/resume and reload of its query-bearing URL. Its Settings → Content & Offline download iframe also loaded offline. No console errors.
- **Navigation:** the native Overflight home shows the shared six-mode row and one Overflight operation group. The main game's home reached its existing password gate offline; its browser menu check awaits the user's preview password. Automated main-home navigation tests passed. The gate was not bypassed or changed.

Screenshots and concise observations are stored alongside this report. These are functional smoke checks, not complete campaign runs or subjective audio-quality approval.

## Limits

This work does not qualify GPU performance, full-run balance, physical controllers or OS-specific app-icon installation. Player downloads do not imply that optional creator tools or soundtrack albums have also been downloaded.
