# Reproduction commands and scope

Run from the repository root with its installed dependencies. Browser captures use the ordinary localhost game and fixture controls; browser interaction is not reproduced by these Node checks.

```sh
node --test game/test/fpv-world-*.test.mjs game/test/fpv-appearance*.test.mjs game/test/fpv-theme-family-controls.test.mjs game/test/fpv-role-presentation.test.mjs
node --test game/test/classic-snake-ui.test.mjs game/test/enemy-stats.test.mjs game/test/mode-settings-view.test.mjs
node --test game/test/classic-snake-result-fixture.test.mjs
node --test game/test/solo-continuous-library-next-host.test.mjs game/test/win-picture-host.test.mjs
node scripts/refresh-fpv-play-shell.mjs --check
node scripts/refresh-fpv-reaction-runtime.mjs --check
node scripts/refresh-fpv-presentation-assets.mjs --check
node scripts/refresh-theme-bootstrap.mjs --check
unzip docs/verification/theme-results-2026-10-16/pixel-captures.zip -d /tmp/appearance-pixel-recheck
python3 game/test/fixtures/sample-appearance-contrast.py /tmp/appearance-pixel-recheck --output /tmp/appearance-pixel-recheck.json
```

The retained TAP logs include overlapping earlier focused runs. Do not add their counts as distinct tests. `source-manifest.json` pins the final touched runtime/test sources; the SIM comparison JSON pins its own immutable snapshot from before these UI-only corrections.

An initial new automatic-progression test used the fixture's manual “skip celebration” action, which itself intentionally cancels automatic continuation. Its “countdown active” assertion therefore failed. The final regression reaches the result through the natural presentation clock and tests disabling the real shared setting before victory and during the countdown. This changes test setup, not the expected cancellation behavior.

The captured-pixel test preserves every original screenshot and measurement. JPEG output is detected from bytes and checked with the additional 0.2 margin. Full reprocessing can take several minutes.
