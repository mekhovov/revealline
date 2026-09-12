# Round 15 — controller authoring and QA journeys

These **10 prose prompts** use the implemented solo controller path and the [Runtime Maintainer](../skills/xonix-runtime-maintainer/SKILL.md). They are not CLI template IDs, do not invoke an agent automatically, and do not increase the shared catalog's **124 entries**. Read [current navigation](../../docs/controller-navigation.md), [Controller practice](../../docs/controller-practice.md) and the [plan's implementation update](../../docs/round-15-controller-plan.md) before selecting a task.

Use the real game and existing validators. Preserve level geometry, class recipes, both steering modes, rewards, deterministic replays and release/save isolation unless the requested task explicitly changes one of them. A passing mock test, a virtual controller journey and a physical device session are three different kinds of evidence. Record which was actually performed.

## 1. A first mission from entry to picture

> Use $xonix-runtime-maintainer to inspect the real Controller practice lab. Load First Signal with Scout, connect the virtual pad, observe neutral, join with A, release and start with a new A press. Play a complete route, inspect the celebration and completed picture, then return through the actual UI. Repeat with immediate and grid-center steering. Confirm one press never joins, starts and uses an ability together. Report the exact browser/viewport and distinguish the simulated controller from untested physical hardware. Preserve the player's stored collection.

## 2. An equipment lesson with a hangar choice

> Use $xonix-runtime-maintainer and $xonix-expansion-author to review a copy of a Fieldcraft equipment mission. Keep its existing rules and registered classes. In Controller practice, open the hangar with Y, preview Heavy carrier, cancel with B and verify the original selection remains. Reopen, commit Light carrier and verify actual equipment/body feedback through the existing switch handler. Check a rejected switch while a live cut or invalid position prevents it. Navigation must not bypass core restrictions, refill charges or change cooldowns. Describe any proposed teaching-copy edit separately from verified behavior.

## 3. A four-world focus and contrast pass

> Use $xonix-runtime-maintainer and $xonix-theme-designer to inspect controller focus, Confirm/Back hints and select drafts in FPV Front, Ukraine Atlas, 1994 Forever and Navi Network. Use the same mission, class and control trace for each theme at 1280×720, 390×844 and 844×390 logical viewports. Record focus visibility over light and dark art and after responsive reflow. If adjustment is needed, change presentation only and repeat the same trace. A body, palette or prompt label must not change movement, collisions or controller mapping. Treat original Spend Sprite artwork as an original business helper, not an official Coupa character.

## 4. Draft settings that never restart on browsing

> Use $xonix-runtime-maintainer to test controller editing for campaign, starting class, world, steering and volume controls. Enter a draft with A; browse enabled values without invoking the underlying change handler; cancel with B, then repeat and commit once. Mutate or disable the current control during an injected DOM test and verify its draft cancels rather than applying to a replacement. Confirm keyboard/pointer interaction relinquishes the controller edit. Use the existing handlers and bounded preferences; do not create a new saved controller-remap format as part of this task.

## 5. Held controls across pause, visibility and result screens

> Use $xonix-runtime-maintainer to exercise simultaneous direction, boost and ability through the actual controller router, then pause, open a dialog, hide the page and return. Repeat the inactive transition from ready, celebration and results, where pausing the simulation may be a no-op. Require unconditional command/navigation clearing and a fresh neutral release before another UI gesture. Verify no stale repeat, resumed cut, extra charge or queued Confirm. Include a late heartbeat that arrives after the preview lease expires between app samples. Keep scope clearing separate from lifecycle preview clearing.

## 6. Device loss with another controller present

> Use $xonix-runtime-maintainer to extend the injected two-pad regression only if needed: join controller A, connect B, disconnect A while B remains, and require a pause with no silent takeover. Cover a reused index, changed descriptor, explicit disconnect/reconnect, null slots and denied/nonstandard input. Verify menu repeat is time-based with no catch-up burst after a stall. Use the practice lab's explicit Disconnect for the single virtual device. Report physical unplug/Bluetooth behavior only if an actual device test was performed; the current lab simulates slot 0 only.

## 7. Return to the same gallery picture

> Use $xonix-runtime-maintainer to prepare an isolated fixture collection with enough completed pictures for multiple pages. Through the actual solo controller UI, choose a filter/page, open a picture, then Back to the same logical card with visible focus. Test a deliberate fixture import or Undo that removes the card and verify a valid surviving fallback, keeping coordinator cancellation rules. Do not earn fixture progress by relabeling a practice run or write to a real player's profile. Preserve seed-specific picture rendering and original replay identities.

## 8. Practice isolation after campaign changes

> Use $xonix-runtime-maintainer to test Controller practice against an isolated stored profile containing a completed campaign. Enter through a validated scenario plus the explicit preview flag, then select another mission/campaign, leave the initial scenario, retry and complete a run. Verify this session remains practice, gameplay scope does not become completed-campaign overview, and no score, gallery, progress, unlock, suspended-flight or pack write occurs. Compare injected storage bytes before/after. The explicit Playground scenario handoff is allowed; ordinary stored data may remain readable/exportable. The preview flag alone must never enable input in prize-bearing solo play.

## 9. A complete saved-flight and protected-operation journey

> Use $xonix-runtime-maintainer to test controller focus around an isolated real replay-backed saved flight and earlier-release transfer fixture. Load and verify the flight, keep it paused, resume with a fresh gesture and compare its continued checkpoint. In transfer UI, Back may cancel preparation but cannot dismiss a committing backup transaction or activate a background control. After error, success or Undo, resolve focus against the new DOM. Preserve source locks, fingerprints, destination journal and original source bytes. Do not replace the transaction contract with controller-specific save logic.

## 10. Prepare the next controller capability with honest host evidence

> Use $xonix-runtime-maintainer to prepare a concrete P1 proposal for either bounded controller remapping/dead-zone settings or complete couch/Replay Theater menu navigation. Inspect current APIs first, define persistence/migration and ownership only for the chosen capability, and provide tests for neutral capture, cancellation, prompts, focus and existing normalized commands. Keep unsupported features labeled as proposals until implemented. Separately record an actual standard-pad browser session, and a native wrapper session only if the required device is available. Check audio, fullscreen, native pickers and exports with their real user-activation requirements; never manufacture trusted events or claim OS-level controller support from the virtual lab.

Run relevant `game/test/controller-*.test.mjs`, input, gallery and affected save/replay suites, then complete the actual UI journey. Use the [controller plan acceptance matrix](../../docs/round-15-controller-plan.md#acceptance-matrix-before-claiming-completion) for remaining coverage. Preserve frozen release artifacts and historical evidence; write new verification results for the actual working revision.
