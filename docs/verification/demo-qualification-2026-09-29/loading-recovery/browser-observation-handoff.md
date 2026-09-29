# Fresh finite browser observation — running

This is a new run, separate from the [earlier interrupted observation](../browser-observation-handoff.md). It started at **2026-09-29T03:30:56.950Z** and requests 7,200 wall-clock seconds; approximate completion is 05:30:57 UTC if execution continues. Requested duration is not achieved duration. Source/hash, complete sample and cleanup checks remain pending until the run ends.

- Checkout: `/Users/oleksandr.mekhovov/.codex/worktrees/community-admission/go_test`.
- Frozen production and harness source: `55c5ec57cc1ed478b44e065951073c0bdd3c3ead`. Later changes are tests/evidence/documentation only.
- Held draft: [PR #781](https://github.com/mekhovov/revealline/pull/781), branch `codex/local-experience-review-20260929`; inspect its live remote head before any continuation push.
- Existing in-app-browser tab **34**, browser **1**, marked for handoff. Reuse that tab and its session; do not reload or navigate it while running.
- URL: `http://127.0.0.1:8820/game/test/browser/demo-watch.html`.
- Task-owned Python server: exec session `67109`, serving this checkout on port 8820. Keep it running until the evidence is saved.
- Actual game: Legacy with **FPV Front · Pressure Lines · 5.0.0** confirmed in Installed chapters before the baseline. The observer does not start or steer gameplay.
- Separate `8820` origin; the user's port `8779` game/shared checkout are untouched.

The five-run diagnostic and all CPU-heavy task checks ended before this browser observation began. External host activity is uncontrolled. The preceding long Worker regression had a one-second deadline failure; it remains preserved and unexplained despite five successful isolated repetitions and the passing fault-to-replay regression. A completed browser duration cannot erase that finding or establish release qualification.

## Early manual control checks

Music was already playing on entry. During this run, explicit **Pause music** remained paused across **Next level**, from First Signal to Night Patrol. After explicit **Play music**, **Pause demo** held Night Patrol at 13% / three lives / 17 seconds while its music status remained playing. The demo was explicitly resumed; a later status showed Night Patrol advancing to 32% / 24 seconds while music remained playing. These are UI/DOM observations, not proof of audible output or physical devices. All observed visibility samples so far are visible, so no hidden-page result is claimed.

## Continuation

Use only supported `cua_repl` browser APIs. Read `#observer-status` and `#observation-checkpoint-status` without steering the game. If healthy and still running, save the current `#observation-report` value in chunks smaller than 80,000 characters, parse it, retain it as `browser-observation-running.json` in this folder, mark tab 34 for handoff again and stay quiet. The harness's separate observer-only IndexedDB also persists bounded incomplete checkpoints about every 15 seconds, with an explicit saved timestamp. Do not claim unsaved intervals from a later status line.

When automatic completion is visible, collect the entire finalized DOM report in bounded chunks, preserve exact bytes as `browser-observation-final.json`, and inspect terminal source/storage hashes, complete timing and sample/event/diagnostic arrays. Do not use a download-event wait. Report wall time separately from simulated progress, actual recorded/live scene rotation, explicit pauses/music intent, gaps, rendering samples and resource-cleanup limits. Visibility must demonstrate hidden execution before making that claim. Physical audio/device behavior, unfamiliar-viewer comprehension and release acceptance remain separate.

If the tab disappears, confirm using the browser inventory. It is permissible to open the **same observer page solely to retrieve its previously saved report** through the recovered-report UI; do not press Start or resume a new observation. Save the exact recovered checkpoint or finalized report, including its incomplete status and lost tail. A crash or missing tab is a limitation; do not invent completion or append new samples. If no report can be recovered, preserve the last on-disk checkpoint and report the missing interval.

Only observation evidence and qualification docs may change during this run. Do not edit served source, allocate a version, merge, publish Pages or remove the draft/release hold. Inspect the remote head and fast-forward only if safe; preserve all newer owner work. Send the already-authorized release coordination chat exact head and meaningful outcome when needed.

After the finite observation is reported, or cannot continue without new user action, pause `finish-demo-browser-observation` and stop its recurring work. Keep the server/tab until evidence is saved, then release only this observer's resources. Do not modify the user's port 8779 game or another checkout.
