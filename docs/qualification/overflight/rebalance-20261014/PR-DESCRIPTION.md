Mature builds could win while the player stopped moving, and surviving formations could accumulate at arena boundaries. This revision makes heading, return passes, target priority and committed enemy attacks matter across Survivor, Riy and Raid while preserving early clearing power and older authored content.

## Completed implementation

- New, explicit Survivor V3 / Riy V2 / Hunt V3 content uses `overflight-balance.v3`. Legacy projects retain their rules; Studios offer an updated copy. Compiled parameters drive play, previews, upgrade demonstrations and new record identities.
- Survivor gains committed standoff attacks, bounded ground threats, body-clear escape checks, safer replacement placement and returning boundary formations. Echo attacks the rear trail; Fan and charged Pulse retain distinct patterns. Shield recovery preserves progress, and supply cases can store a bounded six-second Overdrive.
- Riy has separately upgraded rear Sweeper and forward Breaker escorts. Focus shows its candidate, begins engagement on arrival and does not automatically retarget. Native cues now match the escorts' actual firing geometry.
- Raid machinery exposes the rear half while guarding and the whole body during recovery. Each plate requires a fresh boosted approach after leaving contact; several valid passes can succeed in one opening. Linked guards follow objectives, interruptions cannot cancel machinery or fired shots, and objective shields regain only one charge.
- Marathon keeps eight invested ranks and offers explicit equal-rank refits or useful field rewards. Time Attack accepts authored, visibly provisional medal budgets and records raw and adjusted times separately.
- Steering resumes immediately after menus while boost/Focus wait for confirmation release. Results identify damage causes and selected branches. Latest-main integration keeps all five operations on Home and accessible in both directions by keyboard/controller.

## Verification

- The original combined Overflight/Raid/offline suite passed **359/359**. Follow-up core/balance/Riy/legacy tests passed **83/83**, and post-main menu/input/access/offline checks passed **134/134**. These suites overlap; the totals are not additive. Scoped lint, localization and canonical package validation pass.
- Final Survivor/Riy matrix: **48 configurations, 236 outcomes; 19 active wins and zero wins in 188 unattended/repetitive continuations**, with zero spawn deferrals. The reproduced legacy Riy Echo unattended win now loses after input stops, while its active counterpart completes. Exact inputs, failures and source hashes are preserved.
- Raid route evidence from `14649912b`: **216/216 Raid routes**, including **54/54 baseline-kit routes**, **9/9 Time Attack routes**, and **8/9 five-contract Marathons**. The failed Marathon route remains in the report; this earlier matrix is not relabeled as a post-boundary rerun.
- Final canonical package is pinned to `ca03d7d7d84dcf50bbab6d2734a6d09097e27ed6`, build ID `5c1dcffbada0f3a176512d431af3db7e9611d2cafec1004dfac0f8c113b1b44b`. All **172 inventoried runtime files** match their committed blobs and stayed unchanged during preparation. The manifest pins the full 3,192-file package; core download is 65,381,834 bytes.
- UI-authored Riy content was previewed, exported, imported into Riy Studio, re-exported byte-for-byte, installed and played natively. Importing that package into Survivor Studio was correctly rejected. After stopping the package server, imported Riy reached an upgrade draft, and Raid and Survivor loaded and played offline. Snake also launched offline and advanced its game clock; `snake-offline-final.txt` preserves the UI receipt.
- Native lifecycle evidence includes a 15-minute soak, ten retries, actual graphics-context restoration with explicit resume and atlas accounting: **16.13 MiB base RGBA**, plus a separately accounted retained canvas copy. Earlier lifecycle captures predate the final boundary/menu correction.
- Three independently restarted final-source 1080p trials passed locally with 1,500 simulated / 700 visible enemies: **119.83 / 119.99 / 119.80 rendered frames/s**, p95 **9.9 / 9.5 / 11.3 ms**, p99 **12.3 / 10.0 / 13.9 ms**. Zero dropped simulation time; raw stalls retained. Apple M4 Pro, 48 GiB, macOS 26.7.1, Chromium user-agent 155.0.0.0, AC power, 960×540 backing canvas. This does not certify the waived Iris Xe reference target.

Evidence: [qualification report](docs/qualification/overflight/rebalance-20261014/README.md), [implementation map](docs/qualification/overflight/rebalance-20261014/IMPLEMENTATION.md), [final balance matrix](docs/qualification/overflight/rebalance-20261014/FINAL-BALANCE-MATRIX-REVIEW.md), [Raid report](docs/qualification/overflight/rebalance-20261014/raid-README.md), and [canonical/offline receipt](docs/qualification/overflight/rebalance-20261014/canonical-offline.json).

## Remaining tuning and review boundaries

- **Balance acceptance is partial.** Survivor Echo + Pulse won none of six sampled original-pilot configurations or three explicit lure-and-return probes. One return route earned all ten upgrades and cleared most enemies but failed the final tank. A successful completion route for that intended build remains unproven; Echo + Shield and Riy wins do not close the gap.
- Late collection can stall progression: the final matrix's longest choice gap was 126.68 seconds. Some peaks reached 1,005 visible actors, above the intended 600–800 surge composition. Review collection routes, final encounters and build parity before broadly increasing damage or lowering thresholds.
- Automated, state-reading pilots establish reachability and expose exploits; they do not establish ordinary first-run difficulty, enjoyment or a calibrated difficulty gradient. Very fast Raid routes are valid expert shortcuts and are not used to calibrate medals. Medal defaults remain provisional.
- Iris Xe/Windows, M1 Safari, physical controller/phone and five-player testing were explicitly waived because those resources are unavailable. They are **skipped, not passed**. Local Apple M4 Pro/Codex Chromium evidence does not certify the reference laptop.
- Captures respect the saved master mute setting and do not qualify audio quality. Short offline launches do not establish complete offline sorties or storage-eviction resilience. Publication remains separate.

## Native review media

- [Active Riy](docs/qualification/overflight/rebalance-20261014/riy-active-final.webm) and [controls stopped at 120 seconds](docs/qualification/overflight/rebalance-20261014/riy-idle-final.webm). The native unattended run loses at 134 seconds; active play survives beyond 296 seconds.
- [Priority build](docs/qualification/overflight/rebalance-20261014/survivor-priority-final.webm) and [earlier sweeping build](docs/qualification/overflight/rebalance-20261014/survivor-sweep.webm); source revisions and limits are in `native-media.json`.
- [Upgrade comparison and offline proof](docs/qualification/overflight/rebalance-20261014/creator-offline-final.jpg).

Main integration was conflict-free against `d8bca5ac2` at final review. The runtime tested by these receipts remains pinned to `ca03d7d7`.
