# Round 16 — controller layouts and saved preferences

These ten prose prompts target the working source after frozen v0.5.0, with v0.6.0 proposed as the next release. They are authoring/QA tasks, not CLI template IDs or automatic executions, and add no entries to the shared prompt catalog. Use [Runtime Maintainer](../skills/xonix-runtime-maintainer/SKILL.md), [current controls](../../docs/controller-navigation.md), the [bindings contract](../../docs/controller-bindings-contract.md), [router adoption](../../docs/controller-router-bindings.md) and [preference migration](../../docs/controller-preference-migration.md) as applicable.

Preserve original maps, class recipes, both turn policies, core-v2/replay-v3 identities, earned records and frozen release channels. Use isolated test stores or explicit export/import fixtures for persistence tests. The practice lab is intentionally non-writing and cannot prove an ordinary profile was saved. Separate automated schema/DOM results, actual browser virtual-pad journeys and physical-controller evidence in the report; none substitutes for another.

## 1. One useful remap through the real editor

> Use $xonix-runtime-maintainer to start from default controller settings. In Settings → Edit controller settings, assign Flight Ability to index 4, leaving the other default actions unchanged, and choose PlayStation labels. Apply the complete draft. Verify help says L1 for Ability, the router requires release after Apply, index 4 invokes the original equipped ability, and index 0 no longer invokes it. Menu Confirm remains index 0/Cross. Cancel a second draft and verify the accepted map stays active. Use both immediate and grid-center play without changing simulation rules or award identities.

## 2. A two-button swap with a rejected intermediate draft

> Use $xonix-runtime-maintainer to swap default Flight Ability/index 0 and Pickup/index 2 through the complete draft editor. First change Ability to 2 and Apply: the unresolved duplicate must reject without changing the live map, pending input or stored bytes. Then set Pickup to 0 and Apply once. Both actions must follow the complete new map after neutral release. Test Cancel and Restore defaults in draft; neither applies until its intended final action. Add a pure invalid-config regression for system/home index 16, unknown fields and getters without invocation if missing. Do not silently swap or unbind an unrelated action during single-field editing.

## 3. Menus on the right stick, flight on the left

> Use $xonix-runtime-maintainer to configure Flight axes 0/1 and Menu axes 2/3, then invert the Menu vertical axis. Keep distinct axis indices in each context. In the current Controller practice lab, use its four numeric axis sliders and Apply stick values to exercise each map through the actual iframe UI. Confirm a new stick draft is withheld until the game acknowledges sampling the neutral release. The same axis must not move both flight and menu in one scope. Verify configured digital directions still win and equal analog magnitudes favor vertical. Treat this as synthetic axis input, not a physical calibration result.

## 4. Hysteresis and both-context neutral release

> Use $xonix-runtime-maintainer to set press 0.35 and release 0.25. In an active scope, test magnitudes 0.35, 0.36, 0.30, 0.25, 0.30: expected activity is neutral, active, active, neutral, neutral. Then clear or remap while held at 0.30; this must remain blocked until a sample at or below 0.25. A later 0.30 must remain inactive until press is exceeded. Repeat across pause, Stop, Hangar, scope change, hidden return and selected-pad loss, including a held input used only by the opposite context. Use an injected continuous snapshot trace for exact thresholds: the lab deliberately inserts neutral when applying a new stick draft, so separate Apply actions do not constitute a continuous hysteresis trace.

## 5. Button-only alternatives and fixed joining

> Use $xonix-runtime-maintainer to disable both context sticks and verify configured digital directions still work despite simulated analog drift. Then enable the Menu stick only and confirm it participates in the shared neutral gate even during flight. Remap normal Menu Confirm away from index 0 and test joining separately: only physical face indices 0/1/2/3 or physical Menu/index 9 perform the existing deliberate join handshake. Joining must emit no menu or gameplay action. The next released-and-pressed configured Confirm acts normally. Do not infer join controls from glyph family or a pad's name.

## 6. Persistence, old profiles and a second tab

> Use $xonix-runtime-maintainer with isolated fixture storage to load a validated old library omitting controllerBindings. It must normalize only that omission to null while leaving the original bytes, campaign keys, gallery and scores intact. Apply a valid explicit layout, save, reload and compare its complete canonical value. Test explicit undefined, partial maps and unknown versions: they must reject before profile or recovery writes. In actual browser QA, a second tab may use session-only settings but must not overwrite the writer tab's saved layout. Export that session and confirm the file retains its accepted preference. Do not claim persistence from practice mode alone.

## 7. Complete backup import and Undo change the active layout

> Use $xonix-runtime-maintainer to create two valid isolated collections with different controller maps, original pack images and a replay-backed suspended flight. Export complete backup, import the other collection and verify its map, prompts and editor summary are adopted only after successful coordinated commit. Held old controls must not act through the new layout. Undo must restore the previous collection and mapping through the same journaled path. Compare original image bytes and the restored authoritative checkpoint. Repeat with an older backup omitting the preference and confirm null defaults. Invalid mappings reject before content decoding or destination writes. Preserve the original files; newer exports are not backward-compatible imports for frozen strict readers.

## 8. Earlier-release review, changed source and mapping adoption

> Use $xonix-runtime-maintainer to prepare a recognized earlier-release fixture through the actual transfer protocol. Keep the source writer/backup locks, source-byte preservation and prepared-backup capability. Review a source, then change its valid controller mapping through a legitimate isolated source writer. Copy must detect the changed canonical fingerprint, refresh the preview and require another explicit Copy without replacing the destination. On confirmed copy, the new layout and original saved-flight data must reach the existing target commit/Undo path. Pending source journals, cancelled checks and stale destination generations remain errors. Do not edit a real player's localStorage to fabricate this journey.

## 9. Labels, focus and six logical viewports

> Use $xonix-runtime-maintainer to inspect the editor, configured help and select/slider previews at 320×640, 390×844, 844×390, 768×1024, 1280×720 and 1920×1080 logical CSS viewports. Repeat position, Xbox and PlayStation labels. Confirm previews announce visible field names rather than generated IDs, options remain readable, expanded sections scroll, and interactive controls retain at least 44 CSS-pixel targets. Successful Apply must enable Edit before returning focus; Cancel must return focus without adopting. Test a stale draft invalidated by import or refresh and prevent focus on hidden/disconnected nodes. Report browser/device-pixel-ratio separately; resized browser fixtures are not physical phone, TV or controller tests.

## 10. Bridge v2, lifecycle and an honest release handoff

> Use $xonix-runtime-maintainer to verify the current Controller practice input/status v2 envelopes independently from controllerbindings.v1 settings. Both envelopes need the current per-load session of exactly 32 lowercase hexadecimal characters matching the iframe's controller-session query. Reject old-session messages before advancing sequence counters, including queued high-sequence status from a reused iframe WindowProxy. Accept exactly four finite axes in −1…1 and at most sixteen dense boolean buttons; reject v1 or malformed snapshots, wrong source/origin and stale sequence values. Preserve the 1200 ms input lease, 150 ms parent heartbeat and bridge-produced readSequence acknowledgement. Apply-stick must stop on Release all, disconnect, reload, hidden/pagehide or its two-second deadline, without a late draft reaching the iframe. Run a complete remapped join/start/pause/hangar/finish/picture journey through public UI controls, record actual outcomes, then check build inventory includes the editor stylesheet and new modules. Leave couch menu ownership, Replay Theater navigation, toggles, haptics and physical/native certification explicitly pending unless separately implemented and exercised.

Run relevant tests, for example:

```sh
mise exec node@22.22.2 -- node --test game/test/controller-*.test.mjs game/test/ui-input.test.mjs game/test/gallery-focus.test.mjs
mise exec node@22.22.2 -- node --test game/test/library.test.mjs game/test/backup.test.mjs game/test/backup-storage.test.mjs game/test/profile-transfer.test.mjs
```

Use [the original P0 journeys](round-15-controller-journeys.md) as historical default-layout scenarios and [the controller plan's status](../../docs/round-15-controller-plan.md) for scope. Freeze or publish only through the existing authorized release workflow after the exact candidate's checks; do not overwrite v0.5.0 artifacts or claim a proposed v0.6.0 was released by writing documentation.
