# v0.40 native interface candidate

This is a source and browser-preview checkpoint. The initial v0.40 source gate found one outdated test expectation; the corrected successor still requires full qualification, a frozen release, PR and public deployment. Public v0.38 remains the verified release. v0.39 PR #15 passed its replacement CI and merged as `4d6154e8`; its main deployment checks are running.

## Player-visible changes

- More worlds has theme/mode filters and four-card desktop or two-card portrait pages. Download/recovery actions retain focus and the active operation remains visible.
- Warnings no longer change arena width. A stationary unfinished line asks the player to choose a turn. Compact pause actions fit the tested portrait and landscape layouts at Large text.
- Seven FPV role bodies are independently selectable. Match appearance chooses the authored role; disabling it preserves an available manual selection through class changes and reload.
- An explicit Settings action requests browser download retention and reports the actual result. Missing original-picture metadata points to chapter re-download or media backup; owner mismatches remain rejected.
- Production metadata retains exact historical JSON when the appearance catalog advances. The old registers, original images and gameplay identities are unchanged.

## Scoped browser evidence

The combined online preview uses runtime source `ea59eb24b2d5d2946d805a9dd52ce1ed8669a87c` over frozen v0.39. Its 22 changed files total 6,208,007 bytes. It is not a v0.40 package or an offline-qualified overlay.

Earlier checks covered the actual 17-choice profile, theme/mode filters, desktop/portrait paging, compact pause/brief/back navigation, stable warning cycles, manual Light appearance with Heavy class and the authored Heavy six-hub recommendation. The storage request was denied and the interface truthfully retained “not enabled.”

A later actual game check selected each of Scout, Light carrier, Heavy carrier, Interceptor, Fiber relay, Impact craft and Trapper with Match enabled. All seven painted distinct intended bodies during short First Signal flights followed by Pause. Six selected class/body pairs are recorded directly from visible controls; Scout selection was also observed in the preceding tool output. Root and an independent reviewer inspected all seven restored body screenshots. This uses the legacy 48×36 First Signal board: it does not qualify wide-board compact sizing, every animation state, ability use or human balance.

The first Scout image failed because the preview served an active sparse worktree whose image files were later removed by a checkout transition. The visible fallback and server 404 are retained. A replacement serves fixed copies of the same exact committed files on the same preview origin; reload/Continue restored the real Scout. No game validator, saved state or artwork was changed to resolve that preview failure. Follow the [fixed-preview workflow](../../feature-delivery-workflow.md#fixed-source-previews-during-parallel-work).

Local evidence: `native-ui-retention-browser/role-followup/receipt.json`, 7,429 bytes, SHA-256 `498e2ba6aa5d6af4844f4c74fc3b18fb518d38e08609c2925eb6b87b327da9e1`; independent peer, 4,766 bytes, `fd7a08375975d0271fb08a72d5100b42ac8e89031e2abc0d7f7c7d5a4a689946`, beneath the task's `.cache/round47/`.

## Follow-up before the combined source gate

The wide Orchard Crossing preview also retained its complete arena and four external direction controls at 844×390 with Large text. Manual Scout camera quad selection remained independent of the authored Arcade class and was visible during a short flight. At 390×844, the compact three-action pause panel fit. The portrait pad was present in the live DOM, but the scrollable outer lab clipped its lower section in the screenshots; full portrait control comfort is not claimed. Entering the iframe after changing the outer viewport required a pointer action in this test, so this is not a complete keyboard-only journey. No additional win or physical-device qualification was recorded. Scoped evidence: `.cache/round47/fpv-role-viewport/receipt.json`, 5,876 bytes, SHA-256 `5ed2656cf15e22060377613817aae0f0ff1a2cddd6d02044240c09a030aad6a0`.

A stale “Installing…” message prompted a source regression: focus loss invalidates the pending chapter launch, but previously left its progress caption unchanged. Commit `b59e11e2` now announces cancellation immediately while preserving late-response and storage guards. The old source fails the new deferred-response case; all four chapter-download host tests pass on Node 20 and 22. The earlier native iframe symptom is consistent with this path, but its actual blur event was not recorded. The frozen and public gate must still qualify the combined source.

## Initial full-source gate and targeted correction

The first complete attempt at `1d5f9f906a0685b8a43161570cd52b2a3ffc84fd` passed 3,380 of 3,381 tests with no skips; the other five source gates passed. The single failure was the still-workshop publication test's old expectation that only three teaching documents ship under `authoring/library/`. The build configuration and live appearance catalog already intentionally include the seven FPV role originals. The correction lists those exact seven paths alongside the three documents and retains every other exclusion and dependency assertion. No runtime or build configuration changed.

The first targeted run in the sparse worktree failed all five cases on absent checkout fixtures (`site/` or `authoring/still-media/index.html`); those errors remain recorded. The corrected file then passed all five cases on Node 22 and Node 20, with no skips, using a hash-bound loader that substitutes only this exact test URL in the complete, unchanged `1d5f9f906a06` source snapshot. All other imports and fixture paths use that snapshot normally. This is targeted corrected-test evidence, not successor source qualification. The next full source gate uses an ordinary fresh archive without this loader.

Retained evidence: `.cache/releases/verification-1d5f9f906a06/source-gates.json` (SHA-256 `32c67f83dffac89626734b9b4b66c62f94327b72c27236e85dfe80ad153b8ba2`) and its original `test.log`; the UI worktree's `.cache/v040-workshop-allowlist/` holds the sparse failure, exact loader/admission, both corrected test outputs and scoped static checks.

## Release checks still required

Qualify the exact combined source, immutable artifacts, packaged online/offline flight and recovery, native menu/appearance selection, reviewed PR, deployed public bytes and actual public play. Preserve old releases through their separately verified archive allocation. Physical controllers, touch hardware, complete animation-state review and the full production targets remain separate gates. The [production plan](../../production-plan.md) and [current UI research](../../research/round-47-native-ui-followup.md) retain priorities and reference limits.
