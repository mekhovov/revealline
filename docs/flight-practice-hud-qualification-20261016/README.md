# HUD qualification evidence

See the [report](../flight-practice-hud-qualification-2026-10-16.md) for exact
source/candidate boundaries and remaining gates. Hosting is deferred.

- `hud-settings-completed.json` and its complete archive retain four EN/UK
  native Settings/reload/visible stationary-HUD passes, not moving-flight acceptance.
- `fpv-probe-failed.json` and its complete archive retain the original failed
  90-second FPV probe. There is no native completion, proof export or replay.
- The unchanged HUD candidate envelope/build receipt bind the actual tested bytes.
  The separate final-guide envelope/verification/build log bind the successful
  guide-inclusive all-three clean-source bundle. It is not fresh browser evidence.
- Test logs preserve both reproduced failures and passing suites. Targeted
  before/after runs contain intentional name-filter skips; they are not full suites.
  The full host, practice and observer suites have zero failures or skips.
- `final-guide-build-incomplete.log` preserves an earlier attempt rejected by
  the clean-tree guard after new evidence files were added. No partial candidate
  was accepted. Commit the evidence before rerunning; never weaken that guard.
  The later successful all-three build ran after that commit. A separate default
  Gym-only bundle is not used as all-three evidence.
- `independent-audit.json` transcribes the read-only review, not a release approval.

Both archives were independently compared with their originals: 22 HUD files and
15 failed-probe files. All referenced authority/screenshot pins match. Capture-time
paths remain original provenance. The inventory records byte sizes and SHA-256
for retained files; the inventory does not hash itself.
