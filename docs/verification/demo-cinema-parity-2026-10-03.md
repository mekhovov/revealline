# Demo presentation parity and scene transitions — 3 October 2026

Source base: `8896c4976afec6991c0a34b31ccf28e50dfebf96` (`origin/main` at branch creation).
Branch: `codex/demo-cinema-parity-20261003`.

## Behavior

- Revealing demo artwork no longer suppresses active jammer interference. Jammer intensity still comes from the real run, and is applied after picture concealment, before terrain and actors. Reduced effects retain the ordinary reduction.
- Demo and takeover pass the normal application's brutality, blood, remains, grid, text face and reduced-effects settings to BoardPainter. Scene preparation acquires the ordinary actor appearance and presentation leases, including installed character assets, and releases them with the scene. Running-character assets are reused when present in the installed renderer/content; this change does not add another animation implementation or import unmerged owner work.
- The whole board fits the viewport, including fullscreen, without cropping or a reserved sidebar/header row. Small floating title/actions and a bottom transport dock replace those areas. Audio, picture preferences, notes and credits expand through Audio & details; the current track remains in its summary. Touch targets remain at least 44px, with safe-area insets and bounded scrolling for expanded controls.
- Scene departure fades the already displayed board (or decoded earned video frame) over 450ms, holds darkness during preparation, then fades the next board in over 550ms. The new scene also uses the existing reception effect. Reduced effects shorten this to simple 120ms fades. There is one existing demo clock; no new animation timer, simulation, source, or progression writer.
- Repeated fallback, rapid Next, close and picture-privacy changes discard or retain only the appropriate displayed snapshot. The temporary canvas releases its pixel backing after departure. Normal defeat reception/wreck animation is enabled; ordinary victory/reward timing remains in charge of the recap.

## Automated evidence

Passing focused suites:

```sh
node --test --test-concurrency=1 game/test/demo-scene-transition.test.mjs game/test/demo-transition-picture.test.mjs game/test/demo-clear-pictures-host.test.mjs game/test/demo-host.test.mjs
node --test --test-concurrency=1 game/test/demo-loading-host.test.mjs game/test/demo-reward.test.mjs game/test/demo-sources.test.mjs game/test/demo-background.test.mjs game/test/demo-audio-host.test.mjs game/test/demo-fullscreen.test.mjs
node --test game/test/demo-reward.test.mjs game/test/demo-scene-transition.test.mjs
```

The first command passed 28 tests before the final rapid-Next regression was added. The second passed 31. The last passed all six final transition/reward tests, including rapid Next and decoded-video departure. These overlap; their counts must not be added as independent acceptance cases.

The loading deadline fixture initially failed because it assumed a restricted reviewed catalogue meant only one available source. Installed maps also receive improvised sources. Its correction waits for the timed-out painter's disposal and explicitly cancels subsequent fallback. Cleanup, late-decoder, storage and ordinary-checkpoint assertions remain intact. No production timeout or fallback rule was relaxed.

Focused ESLint, Prettier, `git diff --check`, and localization validation passed (English/Ukrainian, 12,488 messages). The real Solo offline import graph includes the new transition module. Static/native inventories include the game tree; a complete native package build was not performed for this change.

## Review limits and next priorities

1. **Visual acceptance remains pending:** the task-owned browser preview on port 8831 reached the existing password gate. No password was provided during this verification. No fullscreen screenshot, phone layout pass, live character-motion pass or subjective cinematic-quality pass is claimed. Review desktop, portrait, short landscape, large text, Ukrainian and reduced effects after access is available.
2. **Physical acceptance remains separate:** actual controller/touch hardware, sound output, iPhone/WebKit and long-running background playback were not requalified here. Passing modeled background/input suites does not close the historical long-run issues.
3. **Release integration:** this is a draft review input for the existing v0.150.0 milestone, not a deployment or release approval. No physics, replay version, rewards, saves or community scope changed.
