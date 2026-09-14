# v0.40 native interface candidate

This is a source and browser-preview checkpoint. Full v0.40 source gates, frozen release, PR and public deployment are still pending at this checkpoint. Public v0.38 remains the verified release while v0.39's replacement CI runs.

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

## Release checks still required

Qualify the exact combined source, immutable artifacts, packaged online/offline flight and recovery, native menu/appearance selection, reviewed PR, deployed public bytes and actual public play. Preserve old releases through their separately verified archive allocation. Physical controllers, touch hardware, complete animation-state review and the full production targets remain separate gates. The [production plan](../../production-plan.md) and [current UI research](../../research/round-47-native-ui-followup.md) retain priorities and reference limits.
