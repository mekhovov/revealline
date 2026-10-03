# Unified mode UX verification

Automated suites are waived by `publishing/test-policy.json` and were not run. Relevant regressions were authored for the shared shell, Snake, native flight hosts, navigation and Studio returns.

Mandatory localization, game validation and presentation metadata checks passed. The game validator reports seven existing links to release-generated destinations (app, diagnostics, releases, privacy and credits).

Manual browser review verified title → mission/briefing → Start → play → Pause/Continue in Snake, Worlds, Academy and the assisted gym. Snake menu arrows retain input ownership. Retry preserves the accepted URL recipe and resets its counters. Flight Settings and Back/Escape were checked against retained paused state. Ukrainian Versus was inspected at 320×740, 360×780, 390×844 and 740×360; boards/controls fit without horizontal page overflow and preserve 44 px controls. Physical two-player touch, gamepads/radios, enlarged text, native fullscreen, offline package installation and human play qualification remain deferred.

## Committed runtime

All receipts bind runtime commit `2b338c0e7aeb5f2d3ecbd24c7eda39ecca79d914` and tree `eff980e02e9c5bd611c8fa6f58711867f8611447`. The following documentation-only commit does not change that runtime.

- Full configured ESLint passed, followed by targeted checks on final fixes. Changed-file Prettier and whitespace checks passed. The generated aggregate SIM stylesheet is verified through its exact source projection rather than rewritten independently. The previously documented 23 unrelated baseline full-format failures remain unchanged.
- EN/UK localization, distribution references, presentation metadata and public-source eligibility passed. Eligibility covers 24,977 files and 372 assets.
- Shared reaction, audio, play-shell and presentation-asset projections reproduce their checked-in bytes. The play shell projection is 16,541 bytes and adds no native Worlds/Academy package slots.
- [Raw source identity](unified-mode-ux-raw-source.json) confirms every tracked working-file byte and Git mode matches the commit. [Source-manifest verification](unified-mode-ux-source.json) authenticates all 24,977 files and 2,352,562,624 source bytes against immutable Git blobs.

## Production preparation

[Exact committed-source preparation](unified-mode-ux-build.json), with candidate version `v0.143.0`, passed: 2,969 prepared files and 995,377,822 payload bytes. Core contains 1,343 files and 67,095,618 bytes, leaving 13,246 bytes below the unchanged 67,108,864-byte cap.

A complete archive was not written. The ZIP alone requires 995,882,946 bytes; the expanded build plus ZIP requires 1,991,260,768, compared with 716,910,592 available at preparation. No unrelated files were deleted, no caps raised, and no public-release qualification is claimed.

## Optional packages

[Production builds, candidate construction and independent admission](unified-mode-ux-packages.json) passed under the repository's existing `v0.142.4` optional-package version. Public eligibility remains false.

| Package | Runtime files / bytes | Complete source files / bytes | Limit |
| ------- | --------------------: | ----------------------------: | ----- |

| fpv-worlds | 102 / 15,515,618 | 104 / 15,549,027 | 104 files / 16,777,216 bytes |
| civilian-fpv | 69 / 4,325,001 | 71 / 4,353,446 | 72 files / 8,388,608 bytes |
| civilian-flight | 45 / 618,738 | 47 / 643,601 | 64 files / 8,388,608 bytes |
