# P00 ordinary-build browser and offline check

Date: 2026-09-15. Source supplied for the ordinary build: `9a9fc8f7a3c129a8e2c4fbfd2caef27056a25554`. Tested URL: `http://127.0.0.1:8943/dist/game/`.

This is a local ordinary-build check. Its actual `build-info.json` reports version `0.55.0`, entry `game/index.html`, format version `1`, and **`sourceRevision: null`**. It is not a frozen release, public deployment, or independent proof of source identity. P00 still requires the exact-source and public release gates.

## Environment and method

- Isolated `agent-browser` session `p00-offline-audit`; closed at completion.
- Headless Chromium 153 on macOS. Observed CSS viewport: 1280 × 633.
- Navigated and activated the visible application controls; no DOM click injection, application-state injection, storage seeding or debug run manipulation.
- Used browser network emulation (`set offline on`) for the offline portion. Read-only evaluation inspected actual metadata, build identity, status detail, service-worker controller, `navigator.onLine` and boot state.
- Used ordinary keyboard `ArrowDown` for gameplay. This does not establish keyboard-only navigation, physical touch/controller behavior, installed PWA behavior or cold browser-process restart support.

## Observations

1. Initial page showed the launch screen, then the title menu. Opened **Settings → Game data → Prepare offline play**. The status immediately changed to downloading/verifying, and the button disabled while work ran. The game later displayed **600 files verified** and changed the action to **Verify offline files**.
2. The actual offline report was `status: ready`, version `0.55.0`, count/verified `600`, bytes `55,102,105`, empty `missing` and `corrupt` arrays. Build ID: `05d723ec194d624d1d88623b34c59b0761e35f5b8fde7bc486fa83a297200cc5`.
3. The active controller was `http://127.0.0.1:8943/dist/service-worker.js`. The UI correctly described optional packs as separate online installations and warned that browser retention is independent of downloaded files.
4. Switched the browser network offline, reloaded the same route, and reached the title with `navigator.onLine === false`, `data-boot-state="ready"`, and the same controlling worker.
5. Opened **Missions**, retained **Base game · 12 levels / First Signal**, and chose **Deploy**. The game loaded its arena and actual release picture while offline. Pressing `ArrowDown` completed First Signal: **52.2% revealed / 45% target, 3 lives, time 0:10, score 08160**. The victory picture and subsequent results actions were visible. No victory/run-state shortcut was used.
6. Browser `errors` returned no recorded page errors at the checked end of this journey. This is not an exhaustive console/network audit of every route.

## Actual PWA metadata

The manifest fetched through the page's real `link[rel=manifest]` contained:

```json
{
  "display": "fullscreen",
  "display_override": ["fullscreen", "standalone", "minimal-ui"],
  "orientation": "any",
  "start_url": "./game/",
  "scope": "./",
  "id": "./"
}
```

The loaded game document contained one of each declaration:

```text
mobile-web-app-capable = yes
apple-mobile-web-app-capable = yes
apple-mobile-web-app-status-bar-style = black-translucent
```

This proves generated declarations, not installation, OS chrome removal, iOS Home Screen handling, or device safe-area behavior. The focused source fixture independently checks generated manifest values and metadata deduplication.

## Evidence

- [Preparation status](ordinary-offline-preparing.png)
- [Ready status, viewport capture](ordinary-offline-ready.png)
- [Ready status, full page](ordinary-offline-ready-full.png)
- [First Signal deployed offline](ordinary-offline-first-signal.png)
- [Offline victory and original artwork](ordinary-offline-victory.png)
- [Offline results](ordinary-offline-result.png)

The viewport preparation/ready screenshots show that the long optional-content explanation makes this Settings category scroll at this height. These captures do not establish short-landscape/phone usability or the planned compact loading treatment. The victory screenshot was visually inspected: the released field illustration is visible and correctly proportioned, with the achieved coverage/lives/score in the HUD.

## Qualification limits

This covers core offline preparation, an offline reload, one ordinary Solo mission completion and generated PWA metadata on the local ordinary build. It does not cover a fresh browser process with network absent, optional pack installation, Team/Versus offline play, saved-flight restoration, all artwork bindings, all maps, Safari/mobile, physical controllers, or Pages. Those remain distinct acceptance rows; do not reuse this report as their pass evidence.
