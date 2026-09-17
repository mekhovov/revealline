# Viewport lab

Inspect the real Solo or Couch game in a same-origin iframe at **390 × 844**, **844 × 390**, **768 × 1024**, **1280 × 720** or **1280 × 800 CSS pixels**. The frame keeps its intrinsic size inside a scrollable stage. There is no scale-to-fit transform.

From the repository root, use the existing server:

```sh
node scripts/game-cli.mjs serve --port 8768
```

Open [the viewport lab](http://127.0.0.1:8768/authoring/viewport-lab/). This is a source authoring surface; it is not added to a release or offline bundle.

1. Select **Solo** or **Couch**, then press **Load selected game**. No game starts loading before this action.
2. Play using the game’s ordinary menus and controls. For touch-control layout inspection, select **Always** in the game’s options; Couch has a separate preference for each player.
3. Change **Viewport size**. This changes the dimensions of the same iframe without setting its URL again or recreating it. Scroll the stage to inspect every edge. The header shows the selected dimensions and loaded game.
4. To switch games, select the other target and press **Load selected game**. Selecting a target alone leaves the current game running. Use the game’s own save and pause controls before replacing it. **Open directly** opens the selected game in a separate tab.

## Reading preferences and startup

The current supporting-tool correction is in development, with scoped local browser checks recorded and final source/release gates pending. The host reads shared Theme/Plain, Standard/Large and effective reduced-effects preferences through an entry independent of the main tool. These choices style the lab without changing the iframe's dimensions, pending game selection, source or input state, and without writing preferences or profiles.

While preview controls are preparing, Game, Viewport size and Load remain unavailable; **Open directly** stays usable. Slow or failed startup offers **Reload this tool**. Once the real handlers are ready, the controls become available without loading a game. A retiring Reload action hands focus to Game only when it still owns focus and the page is visible and focused. Newer focus or an inactive page wins; returning later does not trigger a queued focus move.

All five presets preserve the same iframe. Selecting Solo while Couch is loaded leaves Solo pending through text or reduced-motion changes; only **Load selected game** replaces the source. Repeating Load for the already loaded target does nothing. In an actual history review, compare the selector, direct-open link, dimension label and child frame after Back/Forward; synthetic persisted events alone do not qualify browser form restoration or BFCache. Inspect complete focus rings, phone portrait/short landscape and meaningful 200% zoom separately from this model coverage.

Resizing a desktop browser does not emulate a physical touchscreen, controller, device pixel ratio, safe-area inset or browser chrome. Parent controls may trigger the game’s normal pause or input-release behavior; resume explicitly inside the game. The lab does not read or modify child state, dispatch game inputs, change profiles or inject a recording. The real game continues to use its normal same-origin storage and settings, so this is not an isolated save profile.

For a browser review, inspect only the parent page to confirm the iframe element remains identical across size changes, its `src` stays unchanged, and its content box has the chosen width and height. Selecting another game must leave `src` unchanged until Load. Inspect the actual game visually and interact through its normal UI; report the viewport and input used, rather than claiming physical-device qualification.

See [the authoring kit](../README.md), [flight controls](../../docs/flight-controls.md) and [the Couch shell source evidence](../../docs/verification/round-47/couch-native-shell.md). Installed chapters use the [read-only Couch original-picture contract](../../docs/couch-installed-chapters.md); select and start them through the game’s ordinary menus.
