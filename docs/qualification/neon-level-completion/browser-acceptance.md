# Neon browser acceptance — 15 October 2026

The qualification pass started after a clean rebase onto `859d5cfc927daff2a350318b2325486a58959648`. Before publication, the branch was rebased again without conflicts onto `691351e1d757276eea7e94cc08fca07f6a16021f`. This pass used the normal password unlock, native browser controls and file chooser/download flows. It did not bypass the gate, inject game state or clear an existing profile. Local unit suites and translation remain deferred by request.

## Defect found and corrected

On GitHub Pages, starting **Neon FPV**, pausing and confirming **Restart mission** left the old flight paused with **“Saved picture owner differs from the installed authored map.”** Current-rule projections deliberately have a different gameplay revision from their original picture owner. Restart and result Retry were validating retained picture pins against the gameplay context.

`pictureContextForRun` now resolves the original picture execution and level, using the same ownership projection as first launch. Restart, result Retry and victory-story validation use this context. Exact identity validation remains enabled; no pin, image assignment, level, geometry or enemy is rewritten.

| Check | Observed result |
|---|---|
| Published Neon FPV restart | Reproduced the owner mismatch. [Before capture](public-restart-owner-error.png). |
| Corrected local Neon FPV restart | On an isolated local origin, Start → Pause → Restart → Confirm returned to an active flight, three lives, zero elapsed time and **Picture ready**. [Running flight afterward](fpv-restart-fixed.png). |
| Corrected local Neon FPV result Retry | Allowed the disposable test flight to lose naturally at 41 seconds, then activated **Try again**. It returned to an active flight with three lives and zero elapsed time. [Running flight afterward](fpv-retry-fixed.png). |
| Limit | Standard difficulty and current rules were exercised in the browser. Gentle, other packs and victory-story playback are not claimed as browser-qualified by these two checks. |

The running-flight screenshots were captured after the immediate reset observations; their clocks and lives can differ because enemies remain active. These are not winning-run screenshots.

## Published discovery and sharing

- The [artwork gallery](https://mekhovov.github.io/revealline/authoring/library/neon-artwork/) and [layout gallery](https://mekhovov.github.io/revealline/authoring/library/neon-mosaic/) both return HTTP 200. The former renders all 54 artwork cards. The Pages capacity blocker from the preceding pass is resolved on main.
- **Play Neon Channels** leads to its exact current-rule URL. Downloading the 6.6 MiB Reference pack opens the **Neon Channels** briefing with a 75% reachable-route goal; Start opens the live arena. [Capture](public-channels-paused.png).
- **Play Neon FPV** leads to its exact current-rule URL. After installing Words & Symbols, keyboard selection opens **Neon FPV** with its 75% reachable-route goal. [Capture](public-fpv-ready.png).
- Channels refresh returned to the same briefing and retained the URL. **Copy level link** reported success; the automation clipboard reader returned an empty value, so native clipboard bytes and permission-denied fallback are not qualified.
- A second simultaneous game tab displayed the explicit session-only/save-owner warning and did not claim it had launched the requested mission. This is not evidence of an independent recipient profile.
- Some mouse activations timed out in the browser-control transport and left the prior flight visible. Keyboard activation succeeded. Mouse behavior remains inconclusive; no product change was made from those timeouts.
- The public release marker advanced during the pass, from `3fe21888bfa4b406c51e1ab165c0782d5d936af0` to `d040b6b632a802c0ddcf348244d1475a5602a65f`. The new restart fix is local to this branch and is not claimed as deployed.

## Creator workflow

The normal Playground loaded the 38-map Words & Symbols pack. The original FPV scenario was 72 × 36 with one wall, 12 enemies and its authored picture fitted with `contain`.

| Action | Observed result |
|---|---|
| Generate `УКРАЇНА`, Safe islands, red material | Preview and Apply succeeded. Generated `symbol-47862620`: 72 × 36, three enemies, two foundations, 51 terrain rectangles, 75% reachable-route goal, 2,098 counted cells and 270 bonus/inaccessible cells. Original picture retained. |
| Export → Undo | A normal JSON download succeeded. Undo restored the original FPV identity, wall/enemy counts and picture. |
| Re-import → export again | Both complete downloaded JSON documents were deeply equal, including artwork, layout, settings and enemies. Canonical download: 378,933 bytes, SHA-256 `3e198d9ad2b6099d55bb0cba3322fd26d53437afd9aa0f06eeced1d60dc02eb3`. |
| Play configuration | Embedded practice opened the Cyrillic mission with the 75% reachable-route goal and three lives. Start reported **Picture ready**. This was a launch check, not a human win. |
| Opaque PNG cross → Preview → Apply → Export | Generated `symbol-fb394716` with 2,176 counted cells and 192 excluded cells; original reveal picture retained. |
| Image-generated map → coordinate edit → Export → Import → Export | After the final rebase, generated a fresh cross as `symbol-31d03512`, then added a 1 × 1 wall at column 20, row 6. The count changed from 2,176 to 2,175 reachable cells with 192 excluded cells. Both complete downloaded documents were deeply equal, including the wall, three enemies, artwork and settings. 376,008 bytes, SHA-256 `7b98d9b83ddbd037e200a6b8f9a44c44ccec269d0aff9bcb450e8eee7b4a029e`. [Restored edited map](creator-image-edited-roundtrip.png). |
| Transparent PNG, inverted white PNG, JPEG, WebP | All produced the same cross silhouette and 2,176/192 coverage counts. Apply enabled. |
| Blank, corrupt and oversized images | Rejected with actionable messages; Apply stayed disabled and the applied level stayed unchanged. |
| Blank text, 17-character line, four lines | Rejected; Apply disabled. |
| `FPV` / `DRONE AID` / `УКРАЇНА` | Three-line preview succeeded. |
| Layout/material changes | Safe islands, Staggered gates and Open arena produced different coverage results. Switching options invalidated the old preview. Blue slow material excluded no lethal cells. |
| Edit after preview | A native numeric step followed by blur invalidated Apply. The automation's direct numeric fill did not dispatch the native change event and was not treated as an application failure. |
| Malformed JSON | Rejected without replacing the current level. |

[Observed image/text results](creator-browser-fixtures.json) retain the UI messages and Apply states. Fixtures were a simple 600 × 240 cross on opaque/transparent backgrounds, not replacement game artwork. Full exported documents were compared locally; embedded picture data and browser credentials are not added to the report.

Still open: cancellation while image decoding/import is pending; actual image-generation artwork review. Preview success alone does not qualify those cases.

## Rebase and distribution checks

- [Rebase receipt](rebase-verification.json): all 216 checked-in routes reproduced their authoritative checkpoints, with 216 wins and no lives lost. This covers 54 maps × Standard/Gentle × grid-center/immediate, Scout, seed 1.
- Source audit: 77 distinct paintings correctly bound and 164 original Classic identities preserved.
- Production build completed: 3,488 files, distribution `ff378f6727f302bde691b83b3cf4c0e81c8227fd8fdadf5de35a83252c1fc8d4`. The build contains the ownership fix and no temporary diagnostics.
- [Distribution audit](build-delivery.json): all 92 exact gallery play links and linked files resolve; both offline package hashes match. Mandatory core is 71,907,808 bytes. This is not an offline installation claim.
- Changed application file passed syntax, formatting and lint checks. No local unit suite was run.
- The final rebase changed none of the Neon pack definitions, core/replay/difficulty code, Playground, application entry point, picture ownership/pin code or mission-library browser used above. Syntax, lint and formatting checks passed again after that rebase. The image edit/import round trip was checked after the final rebase. Other browser observations, the source inventory, route receipts and distribution fingerprint describe the earlier qualification candidate; the complete production build was not repeated for the later unrelated main changes.

## Remaining priorities

1. Review and merge the retained-picture fix, then repeat restart and Retry on Pages. Include Gentle, a Reference map and an original-rules Classic map.
2. Complete sharing acceptance: actual clipboard/fallback, Next after a win, independent recipient profile, optional and unavailable/retired identities. This catches wrong-map links and stale ownership before sharing is called fully accepted.
3. Inspect all 77 paintings under partial reveal and completion reward framing. Static gallery approval does not prove actor contrast or final crop quality.
4. Complete installed offline lifecycle checks using disposable profiles: interruption, restart without the server, older-version upgrade, saved-flight resume, custom art and progress retention. Online downloads and matching hashes do not prove that lifecycle.
5. Finish the creator's remaining asynchronous cancellation cases. Then perform human route-variety review before making any further layout changes.

No missing image or lost-level repair was justified by the audits. Unit-test expansion, Ukrainian translation, another level batch and hosted publishing remain deferred.

## Saved flights and offline follow-up

This later pass used isolated origins on ports 8786–8788. No existing player profile was cleared. It found an additional real defect: exporting a paused Current-rules Neon flight failed with **“Saved pictures require matching flight identity and explicit continuation.”** The simulator uses the projected execution identity while the exact picture pins correctly retain the original authored identity. Reload also could not reconstruct that projected execution from its installed original.

### Correction and trust boundary

Current-rules flights now use native `xonix-session.v7`. The bounded `pictureSource` records the original campaign and explicit Standard/Gentle difficulty. Restoring reconstructs the projection and requires it to equal the installed gameplay campaign, then verifies the replay, checkpoint, original picture identity catalog and any visual/actor pins. Source metadata is comparison data; it cannot install missing content. Old v1–v6 formats and replay/storage budgets are unchanged. The application resolves a saved projection from an already installed original, labels its difficulty correctly, and rebuilds the exact level URL after accepted restore. First-flight departure retention and full backups use the same verified context.

| Check | Observed result |
|---|---|
| Engine save/export/import and continued movement | [216 cases](saved-flights.json), covering all 54 Neon levels × Standard/Gentle × grid-center/immediate. Exact checkpoint, picture pins and continuation preserved; the next 12 ordinary input ticks match an uninterrupted run. Maximum native save: 322,057 bytes. Seven malformed/mismatched context cases rejected. This uses explicit authored-picture fallback pins, not decoded browser artwork. |
| Browser flight export → import → export | Neon FPV exported normally, restored paused through the file chooser, and exported again. Complete documents were deeply equal except `savedAt`. Native v7; original picture key `neon-mosaic/2/68f10772f1871b8b`; one picture choice. Download 313,978 bytes; second file SHA-256 `98b5eaffcfbe75001e4541f7b713de2000c2059ab1b7a6f2ba43c442903bdf5b`. |
| Independent verification of actual downloaded flight | Real `prepareAttemptExport` accepted the browser download as `installed-campaign`, with its identity catalog and original picture choice. Checkpoint `aae6f4f6a93efa1e`. |
| Full game-data export → import | Exported through the normal UI, imported that file, confirmed replacement only in the disposable profile. UI reported **Game data restored. Your saved flight is restored.** [Capture](current-rules-backup-import.png). No artwork or save payload is committed to the report. |
| Reload → Continue | Reloaded after backup import, then explicitly activated Continue. Neon FPV resumed at the 75% target with the original exact current-rule URL restored. Paused it again. [Capture](current-rules-reload-resumed.png). This is an online source-origin check, not offline Resume. |
| Packaged offline launch | Downloaded Solo Starter and both Neon packs through the normal installer on port 8786. Installer verified readiness. Stopped that origin’s local server, reloaded the exact FPV URL and launched it. Then opened Channels’ exact URL and activated Reference from the cached pack; it also launched at 75%. [FPV](offline-fpv-server-stopped.png), [Channels](offline-channels-server-stopped.png). This earlier packaged build contains the Restart/Retry fix, not the new v7 save correction. |

The new production candidate has 3,491 files and SHA-256 `a7024b6f4d52b39080d321794baba879fa96ffb19269104f35a8a4db69443110`. Its [distribution audit](build-delivery.json) passes all 92 exact links and both offline package hashes. Mandatory core is 71,918,306 bytes. Its source revision is null because it is a local candidate. Syntax, formatting and lint pass; no local unit suite ran.

Reproduce finite engine recovery checks with `node scripts/verify-neon-saved-flights.mjs --output=/tmp/neon-saved-flights.json`. These are integration receipts against shipped data, not a new unit-test suite.

### Packaged v7 offline recovery

On port 8788, downloaded Solo Starter and both Neon packs from the new production candidate. Paused the active download through its normal button; the UI reported **Download paused. Resume reuses verified files; only the interrupted file restarts.** Resumed it, and the installer verified the selected game ready offline. This qualifies user-initiated pause/resume, not connection-loss recovery.

Stopped the origin's own HTTP server (confirmed process exit), then reloaded the game. **Load saved flight** initially reported that its matching chapter must be installed. Activated Neon FPV through the ordinary chooser; the matching pack loaded from the verified offline cache, with the server still stopped. Loaded the retained save again. The UI reported **Saved flight verified and restored. Press Resume to continue.** Explicit Resume advanced the flight clock, with three lives and the 75% target, then Pause stopped it again. The exact FPV current-rule URL was restored. The library shows **Saved flight: Neon FPV · Standard**, rather than archived/difficulty unavailable.

[Verified restore](current-rules-offline-restored.png), [resumed then paused](current-rules-offline-resumed.png), [correct saved identity and difficulty](current-rules-offline-saved-label.png). This used ordinary UI/cache flows, not injected storage or replay state. It demonstrates recovery after matching chapter activation; it does not claim automatic chapter installation or an older-profile upgrade.

Remaining: connection-loss interruption, older installed-profile upgrade/custom-art/progress preservation, all-picture in-game framing/contrast, async creator cancellation and the sharing matrix listed above. These observations do not assert public deployment or a completed offline lifecycle.
