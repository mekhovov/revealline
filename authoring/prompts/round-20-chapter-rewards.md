# Round 20 — chapter-reward prompts

These prose tasks use the [chapter-reward contract](../../docs/chapter-rewards.md), current `game/progress.mjs` and the [accepted plan](../../docs/round-20-player-polish-plan.md). The helpers, integration tests and player interface exist; browser verification is separate evidence. Check the actual current source before describing a control as implemented. These prompts add no CLI catalog IDs, asset requirements or schema versions.

## 1. Show an attainable chapter target

> Use `appearanceMilestones(progressFor(library, campaign), campaign)` for the current campaign. Present First clear and Chapter explorer with their actual preset names, criterion, distinct-clear count and availability. For Homeward, show two clears as 2 / 3 and three as available; do not mix in another campaign's clears. The existing tier display caps progress at its target; preserve the helper's uncapped count and label this as reward progress rather than total campaign completion. Keep existing starters. Use original appearance thumbnails rather than inventing new models, and keep the primary game actions reachable.

## 2. Keep all campaign sizes consistent

> Exercise valid campaigns of 1, 2, 3, 4 and 12 distinct maps. Require one clear for the first tier and min(4, map count) for Chapter explorer and Pathfinder; Last light still needs every map. Include repeated map wins with another seed, class and steering policy, and an unknown clear ID. Neither repetition nor unknown IDs adds chapter progress. Pass campaign context to selector, class-matching fallback and collection calls. Preserve the deliberate legacy one-argument `unlockedBodies` behavior instead of silently changing its contract.

## 3. Acknowledge a real transition once

> Around an eligible normal live completion, retain the before-progress value, apply the existing ordinary award path, then compute `newAppearanceBodies(before, after, campaign)`. Name only newly available bodies beside the finished picture. Test a one-map chapter crossing both tiers, a repeated map and a duplicate run ID. Preserve Continue, View picture and the user's selected appearance; do not auto-equip or invent a claim screen. Do not call the delta helper from empty progress to an imported collection: it is a pure difference, not an adoption-event gate.

## 4. Welcome an already-complete older profile

> Import a compatible frozen-v0.9 profile with all three Homeward clears using the actual library importer. Confirm final-tier availability derives immediately, without a win, new stored field or retrospective celebration. Preserve the pinned portable bytes, gallery, setup variants, seen-run IDs and independently earned mastery metadata. Select a fresh Workshop campaign, then return: availability stays campaign-local. Remove and reinstall the same pack, and repeat through complete backup and Undo. Keep older release files and expectations immutable; use explicit forward transfer rather than writing an old release's storage channel.

## 5. Separate appearance from equipment and seals

> Choose Night signal FPV and Delta interceptor through the real appearance control while retaining the same gameplay class. Verify class ID/revision, loadout, movement, ammunition and replay checkpoint behavior remain unchanged; inspect the actual rendered result separately. Repeat the presentation check with Ukrainian, retro and business themes. Do not attach equipment statistics to an image or infer an optional seal from a tier. Use the existing ordinary Workshop routes as controls: they unlock chapter cosmetics but do not satisfy its equipment goals. No operational military behavior is needed.

## 6. Preserve preview and session-only boundaries

> In ordinary Playground practice and Controller practice, inspect the bodies exposed as preview access. Change maps, campaigns and the original scenario selection; complete a flight and confirm no in-memory or stored player awards appear. Keep couch and Replay Theater non-awarding. Separately inject a refused normal profile write: retain the old stored bytes, show the save warning, keep new progress available for the current session and its export, and verify that reloading old storage does not pretend the unlock persisted. Use test stores or explicit disposable browser UI workflows, never rewrite a real player's hidden storage.

## 7. Keep an earned picture replayable out of order

> Create a valid completion for mission 2 while mission 1 remains uncleared, using the existing real core/library award path. Confirm `canPlay` allows mission 2 itself and its next mission, preserves the missing earlier clear and rejects out-of-range/noninteger indexes. Repeat after profile and full-backup round trips in both steering modes. As a control, owning only mission 3 must not unlock uncleared mission 2. Do not repair imported history by fabricating earlier wins or merging maps from another campaign identity.

## 8. Record an honest playable review

> Run the relevant projection/progress, chapter integration, library/backup and frozen replay/session regressions without updating old oracles. Then inspect the actual reward UI with keyboard and simulated controller at 320 × 640, 844 × 390 and 1280 × 720. Check wrapping, focus return, 44 CSS-pixel targets, muted/reduced-effects feedback, selected-body preservation and reachable completed-picture actions. Report the exact source and what was observed; keep deterministic tests, browser viewport evidence and physical-device testing separate. Controller reading modes, hold/toggle alternatives, platform achievements and staged bosses remain separate work.
