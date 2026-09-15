# Public v0.55 Versus and retained-history qualification

**Scoped result: passed, with existing layout findings retained.** Executed ordinary browser interactions on 2026-09-15 in isolated `agent-browser` sessions `p00-v055-versus` and `p00-v055-history`. Both sessions were closed; the parent's `p00-main-v055` session was left untouched. No code edits, state injection, storage seeding, network interception or simulation commands were used.

Deployment context supplied by the release owner: successful production run **34942712768**, publishing revision **da4459b706555007468d053a578caa215d08eca3**. This receipt independently checks browser-visible build identity and the journeys below; it does not replace the whole public-byte audit. Browser: **HeadlessChrome/153.0.0.0**, macOS host, device scale 1. Viewports are desktop Chromium resizing, not mobile device or touch emulation. Earliest retained screenshot: **07:42:12.037 UTC**; last play observation: **07:46:06.732 UTC**.

## Canonical Versus

Route: `https://mekhovov.github.io/revealline/releases/v0.55.0/site/game/couch/`.

1. Fresh session loaded the ordinary lobby, default **FPV Front / Pressure Lines / Orchard Crossing / Arcade / 90 seconds**. Sunflower showed W/A/S/D and Skyline showed arrow keys. `localStorage` initially had no keys.
2. Selected **Start round**. Both running HUDs showed 0.0%, three lives, zero points. No launch/setup state was injected.
3. Pressed **S** and **ArrowDown**, then **Escape**. The shared pause panel appeared. A further Escape left it paused; the visible **Resume round** action was required.
4. Selected Resume, pressed S and ArrowDown and observed both players at **1.5%, three lives, 340 points**, timer **1:11**. The screenshot shows each player at the end of its cut and visible revealed strips. This establishes ordinary keyboard response and capture on both boards, not completion of a match or all bindings.
5. Paused, resized to portrait, explicitly resumed and captured both boards/HUD. Paused and resized to short landscape. The initial offscreen Resume click did not activate it; focused keyboard activation of the same visible Resume control succeeded. Both boards then ran at **1.5%, three lives, 340 points**, timer **0:52**. No game state changed to make the layout capture possible.
6. Browser fetch of `../build-info.json` returned **200**, **143 bytes**, SHA-256 **e77f9076ebdc2d4f93aa537e5f03f5db302499e46a899aa97e6f15e7320b6171**, version **v0.55.0**, source **acc9f265b651017fd268ffd8bbe6989bec614c41**. The resource observation records actual requested compiled PNGs and shared FPV body/hunter/contour assets. `localStorage` still had no keys; this is not an exhaustive IndexedDB/solo-save-write audit.

| Viewport | Canvas 1 CSS box (x, y, width, height) | Canvas 2 CSS box | Playing page scroll size |
| --- | --- | --- | --- |
| 1280×800 | 13, 103.19, 618, 607.81 | 649, 103.19, 618, 607.81 | 1280×800 |
| 390×844 | 13, 97.19, 364, 313.61 | 13, 484.39, 364, 313.61 | 390×844 |
| 844×390 | 13, 103.19, 400, 234.81 | 431, 103.19, 400, 234.81 | 844×390 |

Each canvas backing store is **1152×576**. Visual inspection shows the 2:1 map contained within a taller element, with black bands rather than a stretched map. Desktop has particularly substantial unused vertical space; portrait uses two stacked boards. Both running boards and critical HUD fit in these captured viewports. Touch controls were not enabled in these mouse/keyboard sessions; no touch-target or touch-only usability acceptance is claimed.

The short-landscape **paused** page is 844×764; Resume begins at y=485.77 with height49.30, below the initial 390-pixel viewport. Preserve this as a **P03/P08-A layout finding**. The retained `06-...` screenshot/observation shows the first unsuccessful offscreen activation; `07-...` shows the successful explicit keyboard Resume. Do not present the first attempt as success or as a demonstrated application event-handler failure: this CLI also failed to activate offscreen history links until focused.

Artwork visible during this small capture has detailed orchard/field picture strips, textured obstacles and recognizable drone sprites. Resource loading plus visual inspection does **not** establish matching Solo/Versus revision resolution, approved artwork parity, all 15 maps, or full reveal-art correctness. Those remain P08-A acceptance.

## Current release and retained v0.52 history

1. Opened `https://mekhovov.github.io/revealline/` in a separate fresh session. It reached the canonical **v0.55** title. Selected the title's **Release explorer** link, arriving at `/revealline/releases/`.
2. Explorer displayed **v0.55.0 · Current**, followed by v0.54 and retained v0.52. Selected current **Play**, reached the v0.55 title, and independently fetched the same 143-byte build identity/SHA listed above.
3. Returned through Release explorer. Its v0.52 Play href is directly `https://mekhovov.github.io/revealline-archive-12/releases/v0.52.0/site/game/`. The first two CLI clicks targeted a link at y=944 while scrollY remained zero and did not navigate. A waiting CLI process was interrupted; there was no failed archive HTTP request established. Focused **Enter** on that actual link reached the Archive 12 title. These interaction attempts are retained as an automation limitation, not hidden or labelled an archive outage.
4. Separately opened the retained compatibility address `https://mekhovov.github.io/revealline/releases/v0.52.0/site/game/`. Its automatic navigation reached `https://mekhovov.github.io/revealline-archive-12/releases/v0.52.0/site/game/index.html` and the v0.52 title. No redirect or storage state was injected.
5. Archive 12 `build-info.json` returned **200**, **143 bytes**, SHA-256 **42a7ae63cad9b43a7f408326388c03c41b5ba9c696702929eebcb2823b67900c**, version **v0.52.0**, source **d2b53987672b0501c391b48655180f59ea03d142**, matching its explorer identity.
6. Selected title **Deploy**. It visibly disabled while preparing the featured chapter; the initial waiting observation is retained. Preparation completed into **Orchard Crossing** mission selection. Selected **Deploy →**, pressed **ArrowDown** and captured an active cut with timer **2:57**, target68%, three lives and zero score. Escape then displayed the explicit Resume panel. This proves retained title-to-flight operation, not mission completion or historical offline qualification.

## Evidence and limits

Numbered PNGs and JSON observations are in this directory. `report.json` indexes their byte lengths and SHA-256 hashes. The JSON observations were decoded from CLI JSON-string output; unchanged raw output is retained beside each as `.raw.txt`. `observe.js` only reads DOM, viewport/canvas bounds and localStorage key names. No private game objects or checkpoint mutation were used.

This receipt covers one default Versus map, keyboard movement/capture, pause/explicit Resume, three resized viewports, current title/explorer identity, and v0.52 bridge/title/start. It excludes physical devices, controllers/gamepad modeling, touch-only input, zoom/large-text/reduced-motion checks, complete matches, other maps, Solo v0.55 play, Team and offline. The release owner separately owns those latter journeys. No full redesign phase is accepted by this receipt.
