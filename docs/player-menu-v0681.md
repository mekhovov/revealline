# v0.68.1 player menu correction

Status: implemented and locally verified; source qualification, immutable release and public acceptance remain pending.

- Solo Settings retains Close and category tabs while its active panel scrolls. A resized layout returns focus to the visible Game menu when its original toolbar opener disappears.
- Saved-flight status follows actual explicit Resume/Pause state and preserves important interruption warnings. Simulation, checkpoints, queued turns and score authority are unchanged.
- About includes distinct Solo, Versus and Team entry links with 44px targets. Stable descriptions replace stale manually maintained counts. Online remains deferred.

The correction is based on publisher candidate `5dc68feaa8234e03f3e87ad5d00470262bf19ce4`. Runtime changes come from reviewed `43ce705a` and `577ebc0e`; About uses the sealed five-path candidate with SHA-256 `178b72e4438dbb765e88a91071c2c803b728d6c4a7ad8be48dcae8f4bd3a1599`. It does not adopt the later Journey foundation or change its provisional version.

## Verification

Ten focused files passed 171 tests on Node 20.19.5. Source lint and formatting passed. The first test attempt lacked sparse-checkout binary fixtures; exact Git originals were hydrated before the passing run. It was a setup failure, not a waived test. Afterward eight unchanged generated fixture copies were retired only after exact-source byte/hash comparison; originals and Git remain preserved.

Native keyboard checks used a candidate server with exact Git base bytes and pinned overrides. Plain/Large Settings at 390×844 and 844×390 retained visible Close and panel-local scrolling. Escape returned to title Settings or, after hiding the flight opener through resizing, visible Game menu without resuming the paused run. Reload/Continue showed the resumed cue; Pause replaced it with explicit Resume guidance. About’s Team link was reached with Tab and Enter, loaded the Team arena, and retained a separate Start action. All four mode links measured 44px at 390px width without horizontal overflow. Escape focused Return without leaving About. Captured console warnings/errors were empty.

See [retained local evidence](verification/player-menus-v0681/manifest.json). Screenshot observations were inline; no exported screenshot hashes are claimed. Browser sizing is not physical-device testing. Actual controllers, mobile touch, public source, audible listening, offline use, performance and human playtests remain separate gates.

## Research and maintenance

The [W3C modal dialog guidance](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/) supports a visible close action, contained keyboard navigation and logical focus restoration. The correction follows the [controller/navigation guide](controller-navigation.md#responsive-settings-and-accurate-pause-status). Source-level and public acceptance remain separate; a passing source PR alone does not complete the release.
